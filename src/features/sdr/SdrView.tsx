"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CalendarDays,
  Inbox,
  Percent,
  PhoneCall,
  Sparkles,
  Target,
  UserCheck2,
  UserX,
} from "lucide-react";
import {
  agregarDashboard,
  corDoGap,
  corDoNoShow,
  fetchSdrPayload,
  mesesDisponiveis,
  mesPadrao,
  normalizarSdr,
  periodoDoMes,
  PRODUTO_ROTULO,
  rotuloMes,
  type ProdutoChave,
  type SdrMetrics,
} from "@/lib/data/sdrDashboard";
import { getInsights } from "@/lib/sdr/insights";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { ABAS_SDR, hrefDaAba, type AbaSdr } from "./abas";
import type { RecorteLevantou } from "@/lib/sdr/oportunidades";
import { AgendamentosPanel } from "./AgendamentosPanel";
import { ChartsPanel } from "./ChartsPanel";
import { ComissoesPanel } from "./ComissoesPanel";
import { InsightsPanel } from "./InsightsPanel";
import { KpiChip } from "./KpiChip";
import { LevantouMaoPanel } from "./LevantouMaoPanel";
import { PerformanceTable } from "./PerformanceTable";
import { LeadershipPanel } from "./LeadershipPanel";

const COR_STATUS = {
  verde: "text-verde",
  amarelo: "text-amarelo",
  vermelho: "text-rosa",
} as const;

function notaDeMetas(m: SdrMetrics): string {
  if (!m.metas) return "Linha informativa — sem meta";
  if (m.metasBatidas === 0) return "Nenhuma meta batida ainda";
  return `${["M1", "M1/M2", "M1/M2/M3"][m.metasBatidas - 1]} ${m.metasBatidas === 1 ? "batida" : "batidas"}`;
}

function Metrica({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-borda/40 py-1.5 text-sm last:border-0">
      <span className="text-texto-sec">{rotulo}</span>
      <span className="text-right font-medium tabular-nums text-texto">{children}</span>
    </div>
  );
}

function SdrCard({ m, destaque }: { m: SdrMetrics; destaque: boolean }) {
  const linhaProdutos = (Object.keys(PRODUTO_ROTULO) as ProdutoChave[])
    .map((k) => `${PRODUTO_ROTULO[k]} ${m.produtos[k]}`)
    .join(" | ");

  return (
    <Card className={cn(destaque && "border-azul/60 ring-1 ring-azul/40")}>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-texto">
              {m.sdr}
              {destaque && (
                <span className="rounded-full border border-azul/30 bg-azul/15 px-2 py-px text-[10px] font-medium text-azul-claro">
                  você
                </span>
              )}
            </p>
            <p className="text-xs text-texto-sec">{notaDeMetas(m)}</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              m.metas
                ? "border-azul/30 bg-azul/15 text-azul-claro"
                : "border-borda bg-painel-claro text-texto-sec",
            )}
          >
            {m.metas ? `Meta ${m.nivelAtual?.slice(1)}: ${m.metaAtual}` : "Sem meta"}
          </span>
        </div>

        <div className="mt-3">
          <Metrica rotulo="Calls agendadas">{m.callsAgendadas}</Metrica>
          <Metrica rotulo="Calls realizadas">{m.callsRealizadas}</Metrica>
          <Metrica rotulo="Leads qualificados">
            {m.qualificados}{" "}
            <span className="text-xs text-texto-sec">
              ({m.qualificadosBase}+{m.bonusQC} bônus)
            </span>
          </Metrica>
          <Metrica rotulo="Bônus QC (+1 a cada 3)">{m.bonusQC}</Metrica>
          <Metrica rotulo="Produtos">{linhaProdutos}</Metrica>
          {m.gap !== null && (
            <Metrica rotulo="Gap p/ meta">
              <span className={COR_STATUS[corDoGap(m.gap)]}>{m.gap}</span>
            </Metrica>
          )}
          <Metrica rotulo="No-show">
            <span className={COR_STATUS[corDoNoShow(m.noShowPct)]}>
              {m.noShowCount} ({m.noShowPct.toFixed(1).replace(".", ",")}%)
            </span>
          </Metrica>
        </div>
      </CardContent>
    </Card>
  );
}

export function SdrView({ aba, recorte = "geral" }: { aba: AbaSdr; recorte?: RecorteLevantou }) {
  const user = useSession();
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  const { data: payload, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sdr-dashboard"],
    queryFn: fetchSdrPayload,
  });

  const meses = useMemo(() => (payload ? mesesDisponiveis(payload) : []), [payload]);
  const mes = mesSelecionado ?? (payload ? mesPadrao(payload, hojeISO) : null);

  const dashboard = useMemo(
    () => (payload && mes ? agregarDashboard(payload, mes) : null),
    [payload, mes],
  );

  const insights = useMemo(
    () => (dashboard ? getInsights(dashboard.sdrs.filter((s) => s.sdr !== "Hana")) : []),
    [dashboard],
  );

  // O SDR logado vê o time inteiro (a tela é comparativa, como no original);
  // o card/linha dele ganha destaque visual.
  const meuSdr = user.role === "sdr" ? normalizarSdr(user.nome) : null;

  // Barra de abas — SEMPRE disponível, para o usuário navegar mesmo que o payload
  // do Dashboard SDR (/api/sdr-dashboard) esteja carregando ou tenha falhado. O
  // filtro de mês (que depende do payload) só entra quando há meses e na aba certa.
  const barraAbas = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="tablist"
        aria-label="Abas da produtividade"
        className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1"
      >
        {ABAS_SDR.filter((a) => !a.soAdmin || user.role === "admin").map((a) => (
          <Link
            key={a.aba}
            role="tab"
            href={hrefDaAba(a.aba)}
            aria-selected={aba === a.aba}
            className={cn(
              "nav-link whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition-all",
              aba === a.aba ? "border-azul/50 bg-azul/15 text-texto" : "border-transparent text-texto",
            )}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {(aba === "dashboard" || aba === "comissoes") && meses.length > 0 && mes && (
        <div className="flex items-center gap-2">
          <label htmlFor="mes-sdr" className="text-xs text-texto-sec">
            Filtrar por mês (data da call):
          </label>
          <select
            id="mes-sdr"
            value={mes}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="h-9 rounded-xl border border-white/20 bg-white/5 px-2 text-sm text-texto"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // "Calls por Ciclo" e "Oportunidades do Evento" são autossuficientes (fontes
  // próprias) — NÃO dependem do payload do Dashboard SDR. Renderizam antes dos
  // guards dele. ("Retenção da audiência" tem página própria: /retencao.)
  if (aba === "agendamentos" || aba === "levantou") {
    return (
      <div className="space-y-4">
        {barraAbas}
        {aba === "agendamentos" ? <AgendamentosPanel /> : <LevantouMaoPanel recorte={recorte} />}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Carregando produtividade SDR">
        {barraAbas}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !payload || !mes || !dashboard) {
    return (
      <div className="space-y-4">
        {barraAbas}
        <Card>
          <ErrorState
            titulo="Não foi possível carregar a produtividade SDR"
            descricao={error instanceof Error ? error.message : "Tente novamente."}
            onRetry={() => refetch()}
          />
        </Card>
      </div>
    );
  }

  if (meses.length === 0) {
    return (
      <div className="space-y-4">
        {barraAbas}
        <Card>
          <EmptyState
            icon={Inbox}
            titulo="Sem dados de produtividade"
            descricao="O payload do Dashboard SDR não trouxe nenhum mês com calls."
          />
        </Card>
      </div>
    );
  }

  // A Hana (IA) não é exibida: cards, KPIs, gráficos, tabela e comissões só com o time.
  const sdrs = dashboard.sdrs.filter((s) => s.sdr !== "Hana");
  const comMeta = sdrs.filter((s) => s.metas !== null);
  const totalAgendadas = sdrs.reduce((a, s) => a + s.callsAgendadas, 0);
  const totalRealizadas = sdrs.reduce((a, s) => a + s.callsRealizadas, 0);
  const totalQualificados = sdrs.reduce((a, s) => a + s.qualificados, 0);
  const totalNoShow = sdrs.reduce((a, s) => a + s.noShowCount, 0);
  const totalQC = sdrs.reduce((a, s) => a + s.produtos.qc, 0);
  const totalBonus = sdrs.reduce((a, s) => a + s.bonusQC, 0);
  const gapConsolidado = comMeta.reduce((a, s) => a + (s.gap ?? 0), 0);
  const noShowMedio = totalAgendadas > 0 ? (totalNoShow / totalAgendadas) * 100 : 0;
  const taxaQualificacao =
    totalRealizadas > 0 ? (totalQualificados / totalRealizadas) * 100 : 0;

  const pctBR = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

  return (
    <div className="space-y-4">
      {barraAbas}

      {aba === "lideranca" ? (
        <LeadershipPanel payload={payload} />
      ) : aba === "comissoes" ? (
        <ComissoesPanel
          payload={payload}
          sdrs={sdrs}
          mes={mes}
          destaqueSdr={meuSdr}
        />
      ) : (
        <>
          <p className="text-xs text-texto-sec" role="status">
            {periodoDoMes(mes)} · contabilização pelo mês da data da call, não pela data
            de agendamento · meta escalonada individual 40/50/60
          </p>

          {/* 6.3 — os 9 KPIs agregados do original */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
            <KpiChip icon={CalendarDays} rotulo="Calls agendadas" valor={String(totalAgendadas)} />
            <KpiChip icon={PhoneCall} rotulo="Calls realizadas" valor={String(totalRealizadas)} />
            <KpiChip icon={UserCheck2} rotulo="Leads qualificados" valor={String(totalQualificados)} />
            <KpiChip icon={UserX} rotulo="No-show (total)" valor={String(totalNoShow)} />
            <KpiChip icon={BookOpenCheck} rotulo="QC (reuniões)" valor={String(totalQC)} />
            <KpiChip icon={Sparkles} rotulo="Bônus QC (+1/3)" valor={String(totalBonus)} />
            <KpiChip icon={Target} rotulo="Gap consolidado" valor={String(gapConsolidado)} />
            <KpiChip icon={Percent} rotulo="No-show médio" valor={pctBR(noShowMedio)} />
            <KpiChip icon={Percent} rotulo="Taxa de qualificação" valor={pctBR(taxaQualificacao)} />
          </div>

          {/* 6.4a — cards por SDR (destaque no SDR logado) */}
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {sdrs.map((m) => (
              <SdrCard key={m.sdr} m={m} destaque={meuSdr === m.sdr} />
            ))}
          </div>

          {/* 6.4b — gráficos */}
          <ChartsPanel sdrs={sdrs} />

          {/* 6.4c — insights */}
          <InsightsPanel insights={insights} />

          {/* 6.4d — tabela detalhada */}
          <PerformanceTable sdrs={sdrs} destaqueSdr={meuSdr} />

          {/* 6.4e — rodapé */}
          <p className="flex items-center gap-2 text-xs text-texto-sec/70">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Regra aplicada: contabilização pelo mês da data da call, não pela data de
            agendamento.
          </p>
        </>
      )}
    </div>
  );
}
