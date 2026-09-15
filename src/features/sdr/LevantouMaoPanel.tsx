"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Database,
  Download,
  ExternalLink,
  FileText,
  Gem,
  Hand,
  Hourglass,
  MessageCircle,
  PartyPopper,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { fetchOportunidades, OportunidadesError } from "@/lib/data/dataClient";
import {
  rotuloCiclo,
  rotuloCicloEvento,
  tagsEventoNoIntervalo,
  ultimosCiclos,
  type Ciclo,
} from "@/lib/sdr/ciclo";
import {
  altoValorPendente,
  baseDeLevantaram,
  contarPorTier,
  csvDePendentes,
  distribuicaoPorTier,
  etapasDoFunil,
  filtrarPendentes,
  formatarPct,
  linkWhatsApp,
  MAX_DIAS_INTERVALO,
  ordenarPendentes,
  pct,
  TIERS,
  TIERS_ALTO_VALOR,
  validarIntervalo,
  type LeadPendente,
  type Ordenacao,
  type OportunidadesResponse,
  type TierChave,
} from "@/lib/sdr/oportunidades";
import { dataCompleta, dataHora, tempoRelativo } from "@/lib/formatters/date";
import { MqlBadge } from "@/components/domain/Badges";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { CicloSelect } from "./CicloSelect";
import { KpiChip } from "./KpiChip";

// ---------------------------------------------------------------------------
// Aba "Levantou a Mão": quem aplicou no webinar e NÃO agendou call, com contato
// para o SDR agir sem sair da tela. Período (ciclo | intervalo) vai ao backend;
// MQL, busca, ordenação, paginação e CSV são client-side (lib/sdr/oportunidades).
// ---------------------------------------------------------------------------

type ModoPeriodo = "ciclo" | "intervalo";
const TAMANHO_PAGINA = 50;
const CLASSE_INPUT = "h-9 rounded-lg border bg-painel-claro px-2 text-sm text-texto";

export function LevantouMaoPanel() {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ciclos = useMemo(() => ultimosCiclos(hojeISO, 12), [hojeISO]);
  const cicloAtual = ciclos[0];

  // --- Período -------------------------------------------------------------
  const [modo, setModo] = useState<ModoPeriodo>("ciclo");
  const [inicioSel, setInicioSel] = useState(cicloAtual.inicio);
  const cicloSel: Ciclo = ciclos.find((c) => c.inicio === inicioSel) ?? cicloAtual;
  // Intervalo padrão: os 4 últimos ciclos (consolidar semanas é o uso do modo).
  const [de, setDe] = useState(ciclos[3]?.inicio ?? cicloAtual.inicio);
  const [ate, setAte] = useState(cicloAtual.fim);

  const erroIntervalo = modo === "intervalo" ? validarIntervalo(de, ate) : null;
  const periodo =
    modo === "ciclo" ? { de: cicloSel.inicio, ate: cicloSel.fim } : { de, ate };

  const { data, error, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["oportunidades", periodo.de, periodo.ate],
    queryFn: () => fetchOportunidades(periodo.de, periodo.ate),
    enabled: !erroIntervalo,
    retry: false,
  });

  // --- Filtros client-side --------------------------------------------------
  const [tiersSel, setTiersSel] = useState<TierChave[]>([]);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(null);
  const [pagina, setPagina] = useState(1);
  // Pendente aberto no painel lateral de detalhe (clique no nome).
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const contagem = useMemo(() => contarPorTier(leads), [leads]);
  const filtrados = useMemo(
    () => ordenarPendentes(filtrarPendentes(leads, { tiers: tiersSel, busca }), ordenacao),
    [leads, tiersSel, busca, ordenacao],
  );
  const multiEvento = (data?.eventos.length ?? 0) > 1;
  const selecionado = useMemo(
    () => leads.find((l) => l.clint_contact_id === selecionadoId) ?? null,
    [leads, selecionadoId],
  );

  useEffect(() => setPagina(1), [tiersSel, busca, ordenacao, data]);

  function alternarTier(chave: TierChave) {
    setTiersSel((atual) =>
      atual.includes(chave) ? atual.filter((t) => t !== chave) : [...atual, chave],
    );
  }
  const soAltoValor =
    tiersSel.length === TIERS_ALTO_VALOR.length && TIERS_ALTO_VALOR.every((t) => tiersSel.includes(t));

  function alternarOrdenacao(campo: "nome" | "tier") {
    setOrdenacao((atual) => {
      if (!atual || atual.campo !== campo) return { campo, direcao: campo === "nome" ? "asc" : "desc" };
      if (atual.direcao === (campo === "nome" ? "asc" : "desc")) {
        return { campo, direcao: campo === "nome" ? "desc" : "asc" };
      }
      return null; // terceiro clique volta à ordem do backend
    });
  }

  function exportarCsv() {
    const csv = "﻿" + csvDePendentes(filtrados, multiEvento);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `levantou-a-mao_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Erro 400 do backend: destaca os campos de data (ambos — o backend não diz qual).
  const erro400 = error instanceof OportunidadesError && error.status === 400;
  const campoInvalido = erroIntervalo?.campo ?? (erro400 ? "ambos" : null);

  return (
    <div className="space-y-4">
      {/* Cabeçalho + controle de período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-texto">
            <Hand className="h-4 w-4 text-azul-claro" aria-hidden />
            Levantou a mão e não agendou
          </h2>
          <p className="mt-0.5 text-xs text-texto-sec">
            Contatos com a tag do evento (WG) que marcaram &ldquo;Levantou a Mão&rdquo; na Clint e
            ainda não têm call agendada (em nenhum estágio). Métrica de time — sem escopo por
            papel. Nome com ícone de ficha abre o lead no Mapa de Calor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Modo do período"
            className="flex gap-1 rounded-lg border border-borda bg-painel p-0.5"
          >
            {(["ciclo", "intervalo"] as ModoPeriodo[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  modo === m ? "bg-azul/20 text-azul-claro" : "text-texto-sec hover:text-texto",
                )}
              >
                {m === "ciclo" ? "Ciclo" : "Intervalo"}
              </button>
            ))}
          </div>

          {modo === "ciclo" ? (
            <CicloSelect
              id="ciclo-levantou"
              ciclos={ciclos}
              value={inicioSel}
              onChange={setInicioSel}
              rotulo={rotuloCicloEvento}
              label={null}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  aria-label="Data inicial"
                  aria-invalid={campoInvalido === "de" || campoInvalido === "ambos"}
                  value={de}
                  max={ate || undefined}
                  onChange={(e) => setDe(e.target.value)}
                  className={cn(
                    CLASSE_INPUT,
                    campoInvalido === "de" || campoInvalido === "ambos"
                      ? "border-rosa ring-1 ring-rosa/40"
                      : "border-borda",
                  )}
                />
                <span className="text-xs text-texto-sec">até</span>
                <input
                  type="date"
                  aria-label="Data final"
                  aria-invalid={campoInvalido === "ate" || campoInvalido === "ambos"}
                  value={ate}
                  min={de || undefined}
                  onChange={(e) => setAte(e.target.value)}
                  className={cn(
                    CLASSE_INPUT,
                    campoInvalido === "ate" || campoInvalido === "ambos"
                      ? "border-rosa ring-1 ring-rosa/40"
                      : "border-borda",
                  )}
                />
              </div>
              <p className={cn("text-[11px]", erroIntervalo ? "text-rosa" : "text-texto-sec")} role="status">
                {erroIntervalo?.mensagem ?? `Máximo de ${MAX_DIAS_INTERVALO} dias.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {erroIntervalo ? null : isLoading ? (
        <Carregando />
      ) : isError || !data ? (
        <ErroOportunidades error={error} onRetry={() => refetch()} />
      ) : data.totais.no_evento === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            titulo="Nenhum contato com a tag deste ciclo"
            descricao={
              data.eventos.length > 0
                ? `Tag consultada: ${data.eventos.join(", ")}. Confira se ela existe na Clint.`
                : `Nenhuma terça entre ${rotuloCiclo({ inicio: data.de, fim: data.ate })} — nenhuma tag WG para consultar.`
            }
          />
        </Card>
      ) : (
        <>
          <Kpis data={data} />
          <Funil totais={data.totais} />

          {data.totais.pendentes === 0 || leads.length === 0 ? (
            <Card>
              <EmptyState
                icon={PartyPopper}
                tom="positivo"
                titulo="Todos que levantaram a mão já agendaram"
                descricao={`${data.totais.levantaram_mao} levantaram a mão e ${data.totais.agendaram} agendaram neste período.`}
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Pendentes por classificação (MQL)"
                  subtitle="Clique numa barra ou num chip para filtrar a lista. Nenhum selecionado = todos."
                />
                <CardContent className="space-y-4">
                  <FiltroMql
                    contagem={contagem}
                    selecionados={tiersSel}
                    soAltoValor={soAltoValor}
                    onAlternar={alternarTier}
                    onAltoValor={() => setTiersSel(soAltoValor ? [] : [...TIERS_ALTO_VALOR])}
                    onLimpar={() => setTiersSel([])}
                  />
                  <BarrasPorTier leads={leads} selecionados={tiersSel} onAlternar={alternarTier} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title={`Pendentes${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
                  subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "pendente" : "pendentes"} no recorte`}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportarCsv}
                      disabled={filtrados.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Exportar CSV
                    </Button>
                  }
                />
                <CardContent className="space-y-3">
                  <div className="relative max-w-sm">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, e-mail ou telefone"
                      aria-label="Buscar pendente"
                      className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
                    />
                  </div>

                  {filtrados.length === 0 ? (
                    <EmptyState
                      titulo="Nenhum pendente neste recorte"
                      descricao="Ajuste os chips de MQL ou a busca."
                    />
                  ) : (
                    <ListaPendentes
                      leads={filtrados}
                      pagina={pagina}
                      onPagina={setPagina}
                      multiEvento={multiEvento}
                      ordenacao={ordenacao}
                      onOrdenar={alternarOrdenacao}
                      onAbrir={setSelecionadoId}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Rodape data={data} atualizando={isFetching} onAtualizar={() => refetch()} />
        </>
      )}

      {selecionado && (
        <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />
      )}
    </div>
  );
}

// --- Estados ---------------------------------------------------------------

function Carregando() {
  return (
    <div className="space-y-4" aria-label="Carregando oportunidades" aria-busy>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function ErroOportunidades({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const e = error instanceof OportunidadesError ? error : null;
  const codigo = e?.codigo ?? "desconhecido";

  if (codigo === "clint_auth" || codigo === "clint_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Integração com a Clint indisponível. Avise o time técnico."
          descricao={
            codigo === "clint_auth"
              ? "A Clint recusou as credenciais da integração (token ausente ou inválido)."
              : "A Clint não respondeu (limite de requisições, instabilidade ou timeout)."
          }
          onRetry={codigo === "clint_indisponivel" ? onRetry : undefined}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "agendamentos_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Base de agendamentos indisponível"
          descricao="Sem o conjunto de quem agendou, a lista de pendentes não pode ser calculada."
          onRetry={onRetry}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "intervalo_muito_grande") {
    return (
      <Card>
        <ErrorState
          titulo="Período muito amplo. Reduza o intervalo."
          descricao="A consulta à Clint ultrapassou o limite de páginas. Escolha um intervalo menor."
        />
      </Card>
    );
  }
  if (codigo === "parametros_invalidos") {
    return (
      <Card>
        <ErrorState
          titulo="Datas inválidas"
          descricao={e?.message ?? "Confira as datas do período."}
        />
      </Card>
    );
  }
  return (
    <Card>
      <ErrorState
        titulo="Não foi possível carregar as oportunidades"
        descricao={error instanceof Error ? error.message : "Tente novamente."}
        onRetry={onRetry}
      />
    </Card>
  );
}

// --- KPIs e funil ------------------------------------------------------------

function Kpis({ data }: { data: OportunidadesResponse }) {
  const t = data.totais;
  const altoValor = altoValorPendente(data.leads);
  const temAssistiram = t.assistiram != null;
  const base = baseDeLevantaram(t);
  const nEventos = `${data.eventos.length} ${data.eventos.length === 1 ? "evento" : "eventos"}`;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3",
        temAssistiram ? "xl:grid-cols-6" : "xl:grid-cols-5",
      )}
    >
      <KpiChip
        icon={Users}
        rotulo={temAssistiram ? "Inscritos" : "No evento"}
        valor={String(t.no_evento)}
        detalhe={temAssistiram ? `tag do evento · ${nEventos}` : nEventos}
      />
      {temAssistiram && (
        <KpiChip
          icon={Eye}
          rotulo="Assistiram"
          valor={String(t.assistiram)}
          detalhe={`${formatarPct(pct(t.assistiram ?? 0, t.no_evento))} dos inscritos`}
        />
      )}
      <KpiChip
        icon={Hand}
        rotulo="Levantaram a mão"
        valor={String(t.levantaram_mao)}
        detalhe={`${formatarPct(pct(t.levantaram_mao, base.valor))} ${base.rotulo}`}
      />
      <KpiChip
        icon={CalendarCheck2}
        rotulo="Agendaram"
        valor={String(t.agendaram)}
        detalhe={`${formatarPct(pct(t.agendaram, t.levantaram_mao))} dos que levantaram · conversão`}
      />
      <KpiChip
        icon={Hourglass}
        rotulo="Pendentes"
        valor={String(t.pendentes)}
        detalhe={`${formatarPct(pct(t.pendentes, t.levantaram_mao))} dos que levantaram`}
        destaque
      />
      <KpiChip
        icon={Gem}
        rotulo="Alto valor pendente"
        valor={String(altoValor)}
        detalhe="UMQL+ · UMQL · HMQL"
      />
    </div>
  );
}

// Cor de cada etapa do funil (tokens do tema). "Assistiram" só aparece quando
// o backend manda `totais.assistiram`.
const COR_ETAPA: Record<string, string> = {
  inscritos: "bg-azul/25 text-azul-claro",
  assistiram: "bg-violeta/25 text-violeta",
  levantaram: "bg-teal/25 text-teal",
  agendaram: "bg-verde/25 text-verde",
};

function Funil({ totais }: { totais: OportunidadesResponse["totais"] }) {
  const etapas = etapasDoFunil(totais);
  const base = totais.no_evento || 1;
  return (
    <Card>
      <CardContent className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {etapas.map((e, i) => (
          <div key={e.chave} className="contents">
            {i > 0 && (
              <div
                className="flex shrink-0 items-center justify-center px-1 text-xs font-medium text-texto-sec sm:flex-col"
                aria-label={`Taxa de passagem: ${formatarPct(pct(e.valor, etapas[i - 1].valor))}`}
              >
                <ArrowDown className="h-3.5 w-3.5 sm:hidden" aria-hidden />
                <ChevronRight className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
                <span className="tabular-nums">{formatarPct(pct(e.valor, etapas[i - 1].valor))}</span>
              </div>
            )}
            <div
              className={cn("min-w-0 rounded-lg px-3 py-2", COR_ETAPA[e.chave])}
              style={{ flexGrow: Math.max(e.valor / base, 0.18), flexBasis: 0 }}
            >
              <p className="text-[11px] font-medium opacity-90">{e.rotulo}</p>
              <p className="text-xl font-bold tabular-nums">{e.valor}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Filtro por MQL --------------------------------------------------------------

function FiltroMql({
  contagem,
  selecionados,
  soAltoValor,
  onAlternar,
  onAltoValor,
  onLimpar,
}: {
  contagem: Record<TierChave, number>;
  selecionados: TierChave[];
  soAltoValor: boolean;
  onAlternar: (t: TierChave) => void;
  onAltoValor: () => void;
  onLimpar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por MQL">
      {TIERS.map((t) => {
        const ativo = selecionados.includes(t.chave);
        return (
          <button
            key={t.chave}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(t.chave)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              ativo ? t.chipAtivo : "border-borda text-texto-sec hover:text-texto",
              contagem[t.chave] === 0 && !ativo && "opacity-50",
            )}
          >
            {t.label} <span className="tabular-nums">({contagem[t.chave]})</span>
          </button>
        );
      })}
      <span className="mx-1 h-4 w-px bg-borda" aria-hidden />
      <button
        type="button"
        aria-pressed={soAltoValor}
        onClick={onAltoValor}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          soAltoValor
            ? "border-laranja/60 bg-laranja/15 text-laranja"
            : "border-borda text-texto-sec hover:text-texto",
        )}
      >
        <Gem className="h-3 w-3" aria-hidden />
        Só alto valor
      </button>
      {selecionados.length > 0 && (
        <button
          type="button"
          onClick={onLimpar}
          className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}

function BarrasPorTier({
  leads,
  selecionados,
  onAlternar,
}: {
  leads: LeadPendente[];
  selecionados: TierChave[];
  onAlternar: (t: TierChave) => void;
}) {
  const dist = distribuicaoPorTier(leads);
  const max = dist[0]?.total ?? 1;
  return (
    <ul className="space-y-1.5" aria-label="Pendentes por tier">
      {dist.map(({ tier, total }) => {
        const ativo = selecionados.includes(tier.chave);
        return (
          <li key={tier.chave}>
            <button
              type="button"
              aria-pressed={ativo}
              onClick={() => onAlternar(tier.chave)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-painel-claro",
                ativo && "bg-painel-claro ring-1 ring-borda",
              )}
            >
              <span className={cn("w-32 shrink-0 truncate text-xs font-medium", tier.text)}>
                {tier.label}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-borda/30">
                <span
                  className={cn("block h-full rounded-full", tier.barra)}
                  style={{ width: `${Math.max((total / max) * 100, 3)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-texto">
                {total}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Tabela / cards ----------------------------------------------------------

function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1500);
    return () => clearTimeout(t);
  }, [copiado]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valor).then(() => setCopiado(true)).catch(() => {});
      }}
      aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
      title={copiado ? "Copiado!" : `Copiar ${rotulo}`}
      className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-verde" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

function LinkWhatsApp({ telefone, destaque = false }: { telefone: string | null | undefined; destaque?: boolean }) {
  const href = linkWhatsApp(telefone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir conversa no WhatsApp"
      title="Abrir no WhatsApp"
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium text-verde transition-colors hover:bg-verde/10",
        destaque ? "border border-verde/40 bg-verde/10 px-3 py-1.5 text-sm" : "p-1 text-xs",
      )}
    >
      <MessageCircle className={destaque ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {destaque && "WhatsApp"}
    </a>
  );
}

// Nome do pendente: botão que abre o painel lateral com os dados do contato.
// O ícone de ficha sinaliza que o backend casou o contato com um lead do Mapa
// de Calor (o link para /leads/:id fica dentro do painel).
function NomePendente({
  lead,
  onAbrir,
  className,
}: {
  lead: LeadPendente;
  onAbrir: (id: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(lead.clint_contact_id)}
      title={
        lead.lead_id
          ? "Ver detalhes — tem ficha no Mapa de Calor"
          : "Ver detalhes do contato (sem ficha no Mapa de Calor)"
      }
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-left font-medium text-texto hover:text-azul-claro hover:underline",
        className,
      )}
    >
      <span className="truncate">{lead.nome}</span>
      {lead.lead_id && <FileText className="h-3.5 w-3.5 shrink-0 text-azul-claro" aria-hidden />}
    </button>
  );
}

// --- Painel lateral de detalhe do pendente -----------------------------------

function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-borda/40 py-2.5 last:border-0">
      <p className="text-[11px] uppercase tracking-wide text-texto-sec">{rotulo}</p>
      <div className="mt-0.5 text-sm text-texto">{children}</div>
    </div>
  );
}

function DetalhePendente({ lead, onClose }: { lead: LeadPendente; onClose: () => void }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const wa = linkWhatsApp(lead.telefone);
  const tags = lead.tags ?? [];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Detalhes de ${lead.nome}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-borda bg-painel shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-borda/60 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-texto">{lead.nome}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <MqlBadge lead={lead} size="sm" />
              {lead.evento_tag && <span className="text-xs text-texto-sec">{lead.evento_tag}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <LinhaDetalhe rotulo="Ficha no Mapa de Calor">
            {lead.lead_id ? (
              <Link
                href={`/leads/${encodeURIComponent(lead.lead_id)}`}
                className="inline-flex items-center gap-1 font-medium text-azul-claro hover:underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Abrir ficha do lead
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : (
              <span className="text-texto-sec">
                Sem ficha — o contato ainda não entrou em nenhum estágio na Clint, então o motor
                de score não o conhece. Aja pelo WhatsApp ou e-mail.
              </span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Telefone">
            {lead.telefone ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{lead.telefone}</span>
                <BotaoCopiar valor={lead.telefone} rotulo="telefone" />
                {wa && <LinkWhatsApp telefone={lead.telefone} destaque />}
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="E-mail">
            {lead.email ? (
              <span className="flex flex-wrap items-center gap-1">
                <a href={`mailto:${lead.email}`} className="break-all hover:text-azul-claro hover:underline">
                  {lead.email}
                </a>
                <BotaoCopiar valor={lead.email} rotulo="e-mail" />
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Entrou em">
            {lead.created_at ? (
              <span>
                {dataCompleta(lead.created_at)}{" "}
                <span className="text-texto-sec">
                  ({dataHora(lead.created_at)} · {tempoRelativo(lead.created_at)})
                </span>
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo={`Tags na Clint (${tags.length})`}>
            {tags.length === 0 ? (
              <span className="text-texto-sec">—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-borda bg-painel-claro px-2 py-0.5 text-[11px] text-texto-sec"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Id do contato na Clint">
            <span className="flex items-center gap-1 text-xs text-texto-sec">
              <span className="font-mono">{lead.clint_contact_id}</span>
              <BotaoCopiar valor={lead.clint_contact_id} rotulo="id do contato" />
            </span>
          </LinhaDetalhe>
        </div>
      </aside>
    </div>
  );
}

function Tags({ tags }: { tags: string[] | null | undefined }) {
  const lista = tags ?? [];
  if (lista.length === 0) return <span className="text-texto-sec/50">—</span>;
  const visiveis = lista.slice(0, 3);
  const resto = lista.slice(3);
  return (
    <span className="flex flex-wrap gap-1">
      {visiveis.map((t) => (
        <span
          key={t}
          className="max-w-[140px] truncate rounded-full border border-borda bg-painel-claro px-2 py-0.5 text-[11px] text-texto-sec"
          title={t}
        >
          {t}
        </span>
      ))}
      {resto.length > 0 && (
        <span
          className="rounded-full border border-borda px-2 py-0.5 text-[11px] font-medium text-texto-sec"
          title={resto.join(", ")}
          tabIndex={0}
          aria-label={`Mais ${resto.length}: ${resto.join(", ")}`}
        >
          +{resto.length}
        </span>
      )}
    </span>
  );
}

function EntrouEm({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-texto-sec/50">—</span>;
  return (
    <time dateTime={iso} title={dataHora(iso)} className="whitespace-nowrap text-texto-sec">
      {tempoRelativo(iso)}
    </time>
  );
}

function CabecalhoOrdenavel({
  rotulo,
  campo,
  ordenacao,
  onOrdenar,
}: {
  rotulo: string;
  campo: "nome" | "tier";
  ordenacao: Ordenacao;
  onOrdenar: (c: "nome" | "tier") => void;
}) {
  const ativo = ordenacao?.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(campo)}
      aria-sort={ativo ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:text-texto",
        ativo ? "text-texto" : "text-texto-sec",
      )}
    >
      {rotulo}
      <Icone className="h-3 w-3" aria-hidden />
    </button>
  );
}

function ListaPendentes({
  leads,
  pagina,
  onPagina,
  multiEvento,
  ordenacao,
  onOrdenar,
  onAbrir,
}: {
  leads: LeadPendente[];
  pagina: number;
  onPagina: (p: number) => void;
  multiEvento: boolean;
  ordenacao: Ordenacao;
  onOrdenar: (c: "nome" | "tier") => void;
  onAbrir: (id: string) => void;
}) {
  const paginar = leads.length > TAMANHO_PAGINA;
  const totalPaginas = Math.max(1, Math.ceil(leads.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = paginar
    ? leads.slice((paginaAtual - 1) * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA)
    : leads;

  return (
    <>
      {/* Tabela (≥ md) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda text-xs text-texto-sec">
              <th className="px-2 py-2 text-left">
                <CabecalhoOrdenavel rotulo="Nome" campo="nome" ordenacao={ordenacao} onOrdenar={onOrdenar} />
              </th>
              <th className="px-2 py-2 text-left">
                <CabecalhoOrdenavel rotulo="MQL" campo="tier" ordenacao={ordenacao} onOrdenar={onOrdenar} />
              </th>
              {multiEvento && <th className="px-2 py-2 text-left font-medium">Evento</th>}
              <th className="px-2 py-2 text-left font-medium">Telefone</th>
              <th className="px-2 py-2 text-left font-medium">E-mail</th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium">Entrou em</th>
              <th className="min-w-[280px] px-2 py-2 text-left font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.clint_contact_id} className="border-b border-borda/40 align-top">
                <td className="max-w-[220px] px-2 py-2">
                  <NomePendente lead={l} onAbrir={onAbrir} />
                </td>
                <td className="px-2 py-2">
                  <MqlBadge lead={l} size="sm" />
                </td>
                {multiEvento && (
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-texto-sec">
                    {l.evento_tag ?? "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-2">
                  {l.telefone ? (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="tabular-nums text-texto">{l.telefone}</span>
                      <BotaoCopiar valor={l.telefone} rotulo="telefone" />
                      <LinkWhatsApp telefone={l.telefone} />
                    </span>
                  ) : (
                    <span className="text-texto-sec/50">—</span>
                  )}
                </td>
                <td className="max-w-[240px] px-2 py-2">
                  {l.email ? (
                    <span className="inline-flex max-w-full items-center gap-0.5">
                      <span className="truncate text-texto" title={l.email}>
                        {l.email}
                      </span>
                      <BotaoCopiar valor={l.email} rotulo="e-mail" />
                    </span>
                  ) : (
                    <span className="text-texto-sec/50">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-xs">
                  <EntrouEm iso={l.created_at} />
                </td>
                <td className="px-2 py-2">
                  <Tags tags={l.tags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (< md): nome + MQL + WhatsApp em destaque */}
      <ul className="space-y-2 md:hidden">
        {visiveis.map((l) => (
          <li key={l.clint_contact_id} className="rounded-xl border border-borda bg-painel-claro/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <NomePendente lead={l} onAbrir={onAbrir} />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <MqlBadge lead={l} size="sm" />
                  {multiEvento && l.evento_tag && (
                    <span className="text-[11px] text-texto-sec">{l.evento_tag}</span>
                  )}
                  <EntrouEm iso={l.created_at} />
                </div>
              </div>
              <LinkWhatsApp telefone={l.telefone} destaque />
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {l.telefone && (
                <p className="flex items-center gap-1 text-texto">
                  <span className="tabular-nums">{l.telefone}</span>
                  <BotaoCopiar valor={l.telefone} rotulo="telefone" />
                </p>
              )}
              {l.email && (
                <p className="flex items-center gap-1 text-texto">
                  <span className="truncate">{l.email}</span>
                  <BotaoCopiar valor={l.email} rotulo="e-mail" />
                </p>
              )}
              <Tags tags={l.tags} />
            </div>
          </li>
        ))}
      </ul>

      {paginar && (
        <nav className="flex items-center justify-between text-xs text-texto-sec" aria-label="Paginação">
          <span>
            Página {paginaAtual} de {totalPaginas} · {leads.length} pendentes
          </span>
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={paginaAtual <= 1}
              onClick={() => onPagina(paginaAtual - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => onPagina(paginaAtual + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </span>
        </nav>
      )}
    </>
  );
}

// --- Rodapé -----------------------------------------------------------------------

function Rodape({
  data,
  atualizando,
  onAtualizar,
}: {
  data: OportunidadesResponse;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-sec">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Atualizado em{" "}
          <time dateTime={data.gerado_em} className="text-texto">
            {dataHora(data.gerado_em)}
          </time>
        </span>
        {data.cache === "hit" && (
          <span className="inline-flex items-center gap-1 text-texto-sec/70" title="Resposta servida do cache do backend">
            <Database className="h-3 w-3" aria-hidden />
            Dado em cache — pode ter até 5 min.
          </span>
        )}
        <span className="text-texto-sec/70">
          Tags consultadas: {data.eventos.length > 0 ? data.eventos.join(", ") : tagsEventoNoIntervalo(data.de, data.ate).join(", ") || "nenhuma"}
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onAtualizar} loading={atualizando}>
        {!atualizando && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        Atualizar
      </Button>
    </div>
  );
}
