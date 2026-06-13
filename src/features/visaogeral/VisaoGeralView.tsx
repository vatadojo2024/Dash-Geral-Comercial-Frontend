"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarX2,
  Flame,
  Gauge,
  PauseCircle,
  PhoneCall,
  Wallet,
} from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { fetchLeads } from "@/lib/data/dataClient";
import { fetchVendasDoMes, type VendasDoMes } from "@/lib/data/salesOps";
import {
  agregarDashboard,
  fetchSdrPayload,
  mesPadrao,
} from "@/lib/data/sdrDashboard";
import { METAS_EQUIPE } from "@/lib/sdr/lideranca";
import { metasPorCloser } from "@/lib/config/salesops";
import { formatarBRL, formatarPct } from "@/lib/formatters/moeda";
import { TEMPERATURA_CONFIG, TEMPERATURAS_ORDENADAS } from "@/lib/formatters/score";
import { leadAtivo } from "@/features/dashboard/derivacoes";
import { tiposDoLead } from "@/features/acoes/acoes";
import { CLOSERS, nomeDoUsuario } from "@/lib/mock/users";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { ScoreBadge, TemperatureBadge } from "@/components/domain/Badges";

const NO_SHOW_ETAPAS = ["no_show_1a", "no-show"];

function CardNumero({
  icon: Icon,
  rotulo,
  valor,
  href,
}: {
  icon: typeof Gauge;
  rotulo: string;
  valor: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-borda bg-painel px-4 py-3 transition-colors hover:border-azul/50"
    >
      <Icon className="h-4 w-4 shrink-0 text-azul-claro" aria-hidden />
      <div>
        <p className="text-xs text-texto-sec">{rotulo}</p>
        <p className="text-lg font-bold tabular-nums text-texto">{valor}</p>
      </div>
    </Link>
  );
}

function MiniBarra({ pct, batida }: { pct: number; batida: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-borda/40">
      <div
        className={`h-full rounded-full ${batida ? "bg-verde" : "bg-azul"}`}
        style={{ width: `${Math.min(pct, 1) * 100}%` }}
      />
    </div>
  );
}

export function VisaoGeralView() {
  const user = useSession();

  const leadsQuery = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });
  const vendasQuery = useQuery({
    queryKey: ["vendas", "todos-closers"],
    queryFn: async () => {
      const porCloser = await Promise.all(
        CLOSERS.map(async (c) => [c.id, await fetchVendasDoMes(c.id)] as const),
      );
      return new Map<string, VendasDoMes>(porCloser);
    },
  });
  const sdrQuery = useQuery({ queryKey: ["sdr-dashboard"], queryFn: fetchSdrPayload });

  const ativos = useMemo(
    () => (leadsQuery.data ?? []).filter(leadAtivo),
    [leadsQuery.data],
  );

  if (leadsQuery.isLoading || vendasQuery.isLoading || sdrQuery.isLoading) {
    return (
      <div className="space-y-4" aria-label="Carregando visão geral">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (leadsQuery.isError || vendasQuery.isError || sdrQuery.isError) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar a visão geral"
          descricao="Tente novamente; se persistir, acione o suporte interno."
          onRetry={() => {
            leadsQuery.refetch();
            vendasQuery.refetch();
            sdrQuery.refetch();
          }}
        />
      </Card>
    );
  }

  const leads = leadsQuery.data ?? [];
  const vendas = vendasQuery.data!;
  const payload = sdrQuery.data!;

  const porTemperatura = TEMPERATURAS_ORDENADAS.map((t) => ({
    temperatura: t,
    total: ativos.filter((l) => l.temperatura === t).length,
  }));
  const scoreMedio = ativos.length
    ? Math.round(ativos.reduce((a, l) => a + l.score_final, 0) / ativos.length)
    : 0;
  const parados = ativos.filter((l) => tiposDoLead(l).includes("parado")).length;
  const noShows = leads.filter(
    (l) => l.etapa_atual !== null && NO_SHOW_ETAPAS.includes(l.etapa_atual),
  ).length;
  const top5 = [...ativos].sort((a, b) => b.score_final - a.score_final).slice(0, 5);

  // Equipe SDR: qualificados do mês corrente vs metas 150/188/225 (mês inteiro)
  const hojeISO = new Date().toISOString().slice(0, 10);
  const mes = mesPadrao(payload, hojeISO);
  const dashboardSdr = agregarDashboard(payload, mes);
  const qualificadosEquipe = dashboardSdr.sdrs.reduce((a, s) => a + s.qualificados, 0);

  const volumeTotal = CLOSERS.reduce(
    (a, c) => a + (vendas.get(c.id)?.volumeVendido ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Leads ativos por temperatura (6 chips clicáveis → fila filtrada) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {porTemperatura.map(({ temperatura, total }) => {
          const cfg = TEMPERATURA_CONFIG[temperatura];
          const Icon = cfg.icon;
          return (
            <Link
              key={temperatura}
              href={`/leads?temperatura=${temperatura}`}
              title={`Ver a fila filtrada: ${cfg.label}`}
              className="flex items-center gap-3 rounded-xl border border-borda bg-painel px-4 py-3 transition-colors hover:border-azul/50"
            >
              <Icon className={`h-4 w-4 shrink-0 ${cfg.text}`} aria-hidden />
              <div>
                <p className="text-xs text-texto-sec">{cfg.label}</p>
                <p className="text-lg font-bold tabular-nums text-texto">{total}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CardNumero icon={Gauge} rotulo="Score médio (ativos)" valor={String(scoreMedio)} href="/dashboard" />
        <CardNumero icon={PauseCircle} rotulo="Leads parados" valor={String(parados)} href="/acoes?alerta=parado" />
        <CardNumero icon={CalendarX2} rotulo="No-shows a recuperar" valor={String(noShows)} href="/leads?etapa=no_show_1a,no-show" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top 5 mais quentes */}
        <Card>
          <CardHeader title="Top 5 mais quentes" subtitle="Leads ativos por score" />
          <CardContent className="space-y-2">
            {top5.map((l: LeadListItem) => (
              <Link
                key={l.lead_id}
                href={`/leads/${l.lead_id}`}
                className="flex items-center gap-3 rounded-lg border border-borda/60 bg-noite/40 px-3 py-2 transition-colors hover:border-azul/60"
              >
                <Flame className="h-4 w-4 shrink-0 text-rosa" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-texto">{l.nome_exibicao}</p>
                  <span className="mt-1 inline-flex">
                    <TemperatureBadge temperatura={l.temperatura} size="sm" />
                  </span>
                </div>
                <ScoreBadge final={l.score_final} />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Closers: faturamento vs metas */}
        <Card>
          <CardHeader
            title="Closers"
            subtitle={`Faturamento consolidado: ${formatarBRL(volumeTotal)}`}
            action={
              <Link
                href="/salesops"
                className="inline-flex items-center gap-1 text-xs font-medium text-azul-claro hover:underline"
              >
                Sales Ops <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          />
          <CardContent className="space-y-4">
            {CLOSERS.map((c) => {
              const v = vendas.get(c.id);
              const meta = metasPorCloser[c.id];
              if (!v || !meta) return null;
              const pct = v.volumeVendido / meta.m1;
              return (
                <div key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-texto">
                      <Wallet className="h-3.5 w-3.5 text-texto-sec" aria-hidden />
                      {nomeDoUsuario(c.id)}
                    </span>
                    <span className="tabular-nums text-texto-sec">
                      {formatarBRL(v.volumeVendido)}{" "}
                      <span className="text-xs">/ M1 {formatarBRL(meta.m1)}</span>
                    </span>
                  </div>
                  <MiniBarra pct={pct} batida={v.volumeVendido >= meta.m1} />
                  <p className="mt-1 text-xs text-texto-sec">
                    {v.volumeVendido >= meta.m2
                      ? "Meta 2 batida ✓"
                      : v.volumeVendido >= meta.m1
                        ? `M1 batida ✓ · faltam ${formatarBRL(meta.m2 - v.volumeVendido)} p/ M2`
                        : `${formatarPct(pct)} da M1`}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* SDRs: qualificados da equipe vs metas 150/188/225 */}
        <Card>
          <CardHeader
            title="Equipe de pré-venda"
            subtitle={`${qualificadosEquipe} reuniões qualificadas no mês`}
            action={
              <Link
                href="/sdr"
                className="inline-flex items-center gap-1 text-xs font-medium text-azul-claro hover:underline"
              >
                Produtividade <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            }
          />
          <CardContent className="space-y-4">
            {METAS_EQUIPE.map((meta, i) => {
              const pct = qualificadosEquipe / meta;
              const batida = qualificadosEquipe >= meta;
              return (
                <div key={meta}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-texto">
                      <PhoneCall className="h-3.5 w-3.5 text-texto-sec" aria-hidden />
                      Meta {i + 1}: {meta}
                    </span>
                    <span className={batida ? "text-xs font-semibold text-verde" : "text-xs tabular-nums text-texto-sec"}>
                      {batida ? "Batida ✓" : `faltam ${meta - qualificadosEquipe}`}
                    </span>
                  </div>
                  <MiniBarra pct={pct} batida={batida} />
                </div>
              );
            })}
            <p className="text-xs text-texto-sec">
              Qualificados do time inteiro (inclui Hana) no mês corrente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
