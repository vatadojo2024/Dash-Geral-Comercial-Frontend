"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  ExternalLink,
  Lightbulb,
  Mail,
  Package,
  Phone,
  ShieldAlert,
  Star,
} from "lucide-react";
import type { AnaliseResumo, LeadDetail } from "@/lib/api/contracts";
import { DataError, fetchLeadDetail } from "@/lib/data/dataClient";
import { dataHora, tempoRelativo } from "@/lib/formatters/date";
import { nomeDoUsuario } from "@/lib/mock/users";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
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
  { id: "comercial", label: "Comercial" },
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

function BlocoAnalise({ titulo, analise }: { titulo: string; analise: AnaliseResumo | null }) {
  if (!analise) {
    return (
      <div className="rounded-xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-sec">
        {titulo}: ainda não há análise registrada.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-borda p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-texto">{titulo}</p>
        <p className="text-xs text-texto-sec/80">{tempoRelativo(analise.analisado_em)}</p>
      </div>
      <p className="text-sm text-texto-sec">{analise.resumo_curto}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {analise.sinais_positivos.map((s) => (
          <span
            key={s}
            className="rounded-full border border-verde/30 bg-verde/15 px-2 py-0.5 text-[11px] font-medium text-verde"
          >
            + {s}
          </span>
        ))}
        {analise.sinais_risco.map((s) => (
          <span
            key={s}
            className="rounded-full border border-rosa/30 bg-rosa/15 px-2 py-0.5 text-[11px] font-medium text-rosa"
          >
            ! {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LeadDetailView({ leadId }: { leadId: string }) {
  const user = useSession();
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
                {lead.lead_id} · score calculado {tempoRelativo(lead.score_calculated_at)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TemperatureBadge temperatura={lead.temperatura} />
                <EtapaBadge etapa={lead.etapa_atual} />
                {lead.sdr_pool && <HanaBadge />}
                {lead.trava_aplicada && <TravaBadge trava={lead.trava_aplicada} />}
              </div>
              <p className="mt-2 text-xs text-texto-sec">
                Closer: <span className="font-medium text-texto">{nomeDoUsuario(lead.closer_id)}</span>
                {" · "}
                SDR:{" "}
                <span className="font-medium text-texto">
                  {lead.sdr_pool ? "Hana (IA)" : nomeDoUsuario(lead.sdr_id)}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <ScoreBadge final={lead.score_final} bruto={lead.score_bruto} size="lg" />
              <a href={lead.link_crm} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Abrir na Clint
                </Button>
              </a>
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

      {aba === "geral" && <AbaGeral lead={lead} />}

      {aba === "score" && (
        <Card>
          <CardHeader title="Por que essa nota" subtitle="Os 5 blocos do motor de score e a trava, quando aplicada." />
          <CardContent>
            <LeadScoreBlocks lead={lead} />
          </CardContent>
        </Card>
      )}

      {aba === "comercial" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Fit comercial" />
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-noite/60 px-3 py-2">
                <Star className="h-4 w-4 text-laranja" aria-hidden />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-texto-sec/80">Tier</p>
                  <p className="text-sm font-semibold text-texto">Tier {lead.tier_final}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-noite/60 px-3 py-2">
                <Package className="h-4 w-4 text-texto-sec" aria-hidden />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-texto-sec/80">
                    Produto sugerido
                  </p>
                  <p className="text-sm font-semibold text-texto">
                    {lead.produto_sugerido ?? "Ainda sem sugestão do motor"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Análises da IA"
              subtitle="Resumo da conversa do SDR e da call mais recente."
            />
            <CardContent className="space-y-3">
              <BlocoAnalise titulo="Análise SDR" analise={lead.resumo_analises.sdr} />
              <BlocoAnalise titulo="Análise da call" analise={lead.resumo_analises.call} />
            </CardContent>
          </Card>
        </div>
      )}

      {aba === "timeline" && (
        <Card>
          <CardHeader title="Timeline" subtitle="O filme do lead, do evento mais recente ao mais antigo." />
          <CardContent>
            <LeadTimeline eventos={lead.timeline} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AbaGeral({ lead }: { lead: LeadDetail }) {
  return (
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
  );
}
