"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Lightbulb,
  Mail,
  Package,
  Phone,
  ShieldAlert,
} from "lucide-react";
import type { FichaLead, LeadDetail } from "@/lib/api/contracts";
import { DataError, fetchLeadDetail } from "@/lib/data/dataClient";
import { useUsuariosMap } from "@/lib/data/useUsuarios";
import { dataHora, tempoRelativo } from "@/lib/formatters/date";
import { nomeDoCloser, nomeDoSdr } from "@/lib/data/donos";
import { labelProduto } from "@/lib/formatters/labels";
import { brParaQuebras } from "@/lib/formatters/texto";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  AlertaBadge,
  EtapaBadge,
  HanaBadge,
  ScoreBadge,
  TemperatureBadge,
  TravaBadge,
} from "@/components/domain/Badges";
import { LeadScoreBlocks } from "@/components/domain/LeadScoreBlocks";
import { LeadTimeline } from "@/components/domain/LeadTimeline";

const ABAS = [
  { id: "geral", label: "Visão geral" },
  { id: "score", label: "Score" },
  { id: "timeline", label: "Timeline" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function LinhaCopiavel({
  icon: Icon,
  rotulo,
  valor,
}: {
  icon: typeof Phone;
  rotulo: string;
  valor: string;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-noite/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-texto-sec" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-texto-sec/80">{rotulo}</p>
          <p className="truncate text-sm font-medium text-texto">{valor}</p>
        </div>
      </div>
      <button
        onClick={copiar}
        aria-label={`Copiar ${rotulo.toLowerCase()}`}
        className="rounded-md p-1.5 text-texto-sec hover:bg-painel-claro hover:text-texto"
      >
        {copiado ? (
          <Check className="h-4 w-4 text-verde" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

// Accordion de análise da IA: <details> nativo (acessível, recolhido por
// padrão). Com conteúdo → texto com as quebras do briefing (brParaQuebras +
// pre-wrap, sem HTML cru); ausente/vazio → placeholder "ainda não disponível".
function AccordionAnalise({
  titulo,
  conteudo,
}: {
  titulo: string;
  // Possivelmente undefined: conducao_da_call/guia_sdr ainda não vêm da API.
  conteudo?: string | null;
}) {
  const texto = typeof conteudo === "string" ? conteudo.trim() : "";
  return (
    <details className="group rounded-xl border border-borda">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-texto [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-texto-sec transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-borda/60 px-4 py-3">
        {texto ? (
          <p className="whitespace-pre-wrap break-words text-sm text-texto-sec">
            {brParaQuebras(texto)}
          </p>
        ) : (
          <p className="text-sm text-texto-sec/70">Ainda não disponível.</p>
        )}
      </div>
    </details>
  );
}

// Seção "Análises da IA": três accordions empilhados, fechados por padrão.
function AnalisesIA({ lead }: { lead: LeadDetail }) {
  return (
    <Card>
      <CardHeader
        title="Análises da IA"
        subtitle="Briefing e guias gerados pela IA a partir das conversas."
      />
      <CardContent className="space-y-2">
        <AccordionAnalise titulo="Briefing" conteudo={lead.briefing} />
        <AccordionAnalise titulo="Condução da Call" conteudo={lead.conducao_da_call} />
        <AccordionAnalise titulo="Análise para SDR" conteudo={lead.guia_sdr} />
      </CardContent>
    </Card>
  );
}

// Rótulos PT da ficha (dados frios do Clint), na ordem de exibição. São TEXTO —
// renda_faixa/patrimonio_faixa não têm relação com o NÍVEL numérico do score.
const CAMPOS_FICHA: { campo: keyof FichaLead; rotulo: string }[] = [
  { campo: "renda_faixa", rotulo: "Renda" },
  { campo: "patrimonio_faixa", rotulo: "Patrimônio" },
  { campo: "investimento_mensal", rotulo: "Investimento mensal" },
  { campo: "profissao", rotulo: "Profissão" },
  { campo: "objetivo_mercado", rotulo: "Objetivo com o mercado" },
  { campo: "obstaculo", rotulo: "Obstáculo" },
  { campo: "momento_financeiro", rotulo: "Momento financeiro" },
  { campo: "motivacao", rotulo: "Motivação" },
  { campo: "tempo_disponivel", rotulo: "Tempo disponível" },
  { campo: "momento_atual", rotulo: "Momento atual" },
  { campo: "desafio_resolver", rotulo: "Desafio a resolver" },
];

// Ficha do lead: Produto sugerido (Fit comercial, SEM Tier) + os 11 campos
// frios do Clint. Tolerância campo-a-campo: campo nulo/vazio não renderiza a
// linha; o Produto cai num texto neutro quando o motor ainda não sugeriu.
function FichaLeadCard({ ficha, produto }: { ficha: FichaLead; produto: string | null }) {
  const preenchidos = CAMPOS_FICHA.filter(({ campo }) => {
    const v = ficha[campo];
    return typeof v === "string" && v.trim().length > 0;
  });

  return (
    <Card>
      <CardHeader
        title="Ficha do lead"
        subtitle="Dados informados na qualificação (Clint)."
      />
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-noite/60 px-3 py-2">
          <Package className="h-4 w-4 text-texto-sec" aria-hidden />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-texto-sec/80">
              Produto sugerido
            </p>
            <p className="text-sm font-semibold text-texto">
              {labelProduto(produto) ?? "Ainda sem sugestão do motor"}
            </p>
          </div>
        </div>

        {preenchidos.length === 0 ? (
          <p className="text-sm text-texto-sec">Sem dados de ficha para este lead.</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {preenchidos.map(({ campo, rotulo }) => (
              <div key={campo}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
                  {rotulo}
                </dt>
                <dd className="mt-0.5 text-sm text-texto">{ficha[campo]}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function LeadDetailView({ leadId }: { leadId: string }) {
  const user = useSession();
  const usuarios = useUsuariosMap();
  const [aba, setAba] = useState<AbaId>("geral");

  const { data: lead, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lead", user.id, leadId],
    queryFn: () => fetchLeadDetail(user, leadId),
    retry: (count, err) =>
      !(err instanceof DataError && err.code === "not_found") && count < 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Carregando detalhe do lead">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-10 w-96 rounded-lg" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !lead) {
    const naoEncontrado = error instanceof DataError && error.code === "not_found";
    return (
      <Card>
        <ErrorState
          titulo={naoEncontrado ? "Lead não encontrado" : "Não foi possível carregar o lead"}
          descricao={
            naoEncontrado
              ? "Este lead não existe ou está fora do escopo do seu papel."
              : "Tente novamente; se persistir, acione o suporte interno."
          }
          onRetry={naoEncontrado ? undefined : () => refetch()}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-texto-sec hover:text-texto"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para a fila
      </Link>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-texto">{lead.nome_exibicao}</h1>
              <p className="mt-0.5 text-xs text-texto-sec/80">
                score calculado {tempoRelativo(lead.score_calculated_at)}
              </p>
              {/* Badges + posse: parte dinâmica do cabeçalho. Se algo aqui
                  estourar, nome e score acima continuam visíveis. */}
              <ErrorBoundary rotulo="cabeçalho do lead" fallback={null}>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <TemperatureBadge temperatura={lead.temperatura} />
                  <EtapaBadge etapa={lead.etapa_atual} />
                  {lead.sdr_pool && <HanaBadge />}
                  {lead.trava_aplicada && <TravaBadge trava={lead.trava_aplicada} />}
                </div>
                <p className="mt-2 text-xs text-texto-sec">
                  Closer:{" "}
                  <span className="font-medium text-texto">
                    {lead.closer_id
                      ? nomeDoCloser(lead, usuarios)
                      : "Sem closer atribuído"}
                  </span>
                  {" · "}
                  SDR:{" "}
                  <span className="font-medium text-texto">
                    {lead.sdr_pool
                      ? "Hana (IA)"
                      : lead.sdr_id
                        ? nomeDoSdr(lead, usuarios)
                        : "Sem SDR atribuído"}
                  </span>
                </p>
              </ErrorBoundary>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <ScoreBadge final={lead.score_final} bruto={lead.score_bruto} size="lg" />
              {lead.link_crm && (
                <a href={lead.link_crm} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Abrir na Clint
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div role="tablist" aria-label="Seções do lead" className="flex gap-1 border-b border-borda/60">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              aba === a.id
                ? "border-azul text-azul-claro"
                : "border-transparent text-texto-sec hover:text-texto"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Cada aba é envolvida por um ErrorBoundary: um valor inesperado numa
          seção mostra um fallback limpo SEM derrubar o resto do lead. */}
      {aba === "geral" && (
        <ErrorBoundary rotulo="aba geral" fallback={<FallbackSecao />}>
          <AbaGeral lead={lead} />
        </ErrorBoundary>
      )}

      {aba === "score" && (
        <ErrorBoundary rotulo="aba score" fallback={<FallbackSecao />}>
          <Card>
            <CardHeader title="Por que essa nota" subtitle="Os 5 blocos do motor de score e a trava, quando aplicada." />
            <CardContent>
              <LeadScoreBlocks lead={lead} />
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}

      {aba === "timeline" && (
        <ErrorBoundary rotulo="aba timeline" fallback={<FallbackSecao />}>
          <Card>
            <CardHeader title="Timeline" subtitle="O filme do lead, do evento mais recente ao mais antigo." />
            <CardContent>
              <LeadTimeline eventos={lead.timeline} />
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}
    </div>
  );
}

// Fallback de uma seção que estourou ao renderizar — o cabeçalho e as demais
// abas do lead seguem de pé.
function FallbackSecao() {
  return (
    <Card>
      <ErrorState
        titulo="Não foi possível exibir esta seção"
        descricao="Os demais dados do lead seguem disponíveis acima."
      />
    </Card>
  );
}

// Visão Geral agora é uma página contínua (a aba "Comercial" foi fundida aqui):
// (a) Prioridade/Contato → (b) Ficha do lead → (c) Análises da IA, separadas por
// divisórias. Cada seção é independente — uma não derruba a outra.
function AbaGeral({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-6">
      {/* (a) Prioridade + Contato */}
      <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Prioridade" />
        <CardContent className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
              Motivo
            </p>
            <p className="mt-0.5 text-sm text-texto">{lead.motivo_curto}</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-laranja/30 bg-laranja/10 px-3 py-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-laranja" aria-hidden />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-laranja">
                Próxima ação
              </p>
              <p className="text-sm text-texto">{lead.proxima_acao}</p>
            </div>
          </div>
          {lead.alertas.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Alertas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.alertas.map((a) => (
                  <AlertaBadge key={a} alerta={a} />
                ))}
              </div>
            </div>
          )}
          {lead.sdr_pool && (
            <p className="flex items-center gap-2 rounded-lg border border-violeta/30 bg-violeta/10 px-3 py-2 text-xs text-violeta">
              <Bot className="h-4 w-4 shrink-0" aria-hidden />
              Lead originado pela Hana (IA agendadora) — disponível no pool de todos os SDRs.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Contato"
          subtitle="Exibido direto no detalhe (decisão Vata) — a listagem continua sem contato."
        />
        <CardContent className="space-y-2">
          <LinhaCopiavel icon={Phone} rotulo="Telefone" valor={lead.telefone} />
          <LinhaCopiavel icon={Mail} rotulo="E-mail" valor={lead.email} />
          <p className="pt-1 text-xs text-texto-sec/80">
            Score calculado em {dataHora(lead.score_calculated_at)}.
          </p>
        </CardContent>
      </Card>
      </div>

      <hr className="border-borda/60" />

      {/* (b) Ficha do lead */}
      <FichaLeadCard ficha={lead.ficha} produto={lead.produto_sugerido} />

      <hr className="border-borda/60" />

      {/* (c) Análises da IA */}
      <AnalisesIA lead={lead} />
    </div>
  );
}
