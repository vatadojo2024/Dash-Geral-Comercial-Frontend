"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  Filter,
  Megaphone,
  Percent,
  UserCheck2,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  mesesDisponiveis,
  mesPadrao,
  rotuloMes,
  type SdrDashboardPayload,
} from "@/lib/data/sdrDashboard";
import { agregarLideranca, semanasDoMes, SEM_CLOSER } from "@/lib/sdr/lideranca";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";

// 6.5 — aba "Liderança Pré-venda" (visível só para admin). Filtros próprios
// de mês e semana; tudo respeita o recorte, EXCETO as métricas da equipe
// (sempre o mês inteiro).

function KpiLideranca({
  icon: Icon,
  rotulo,
  valor,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-borda bg-painel px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-azul-claro" aria-hidden />
      <div>
        <p className="text-xs text-texto-sec">{rotulo}</p>
        <p className="text-lg font-bold tabular-nums text-texto">{valor}</p>
      </div>
    </div>
  );
}

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-texto-sec",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function LeadershipPanel({ payload }: { payload: SdrDashboardPayload }) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const meses = mesesDisponiveis(payload);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  const [semana, setSemana] = useState<number | null>(null);

  const mes = mesSelecionado ?? mesPadrao(payload, hojeISO);

  const temDadosLideranca =
    (payload.marketing_leads?.length ?? 0) > 0 ||
    (payload.closer_agendadas?.length ?? 0) > 0;

  const lideranca = useMemo(
    () => (temDadosLideranca ? agregarLideranca(payload, mes, semana, hojeISO) : null),
    [payload, mes, semana, hojeISO, temDadosLideranca],
  );

  // 6.5g — erro isolado: só esta aba mostra a falha da carga da liderança.
  if (payload.lideranca_erro || !lideranca) {
    return (
      <Card>
        <ErrorState
          titulo="Falha ao carregar dados da liderança"
          descricao={
            payload.lideranca_erro ??
            "Os dados de marketing/closers não vieram no payload. A aba Dashboard SDR continua funcionando."
          }
        />
      </Card>
    );
  }

  const totalSemanas = semanasDoMes(mes);
  const recorteLabel =
    semana === null ? "mês inteiro" : `semana ${semana} de ${totalSemanas}`;

  return (
    <div className="space-y-4">
      {/* a) Filtros próprios (mês independente do topo + semana) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-painel p-3">
        <Filter className="h-4 w-4 text-texto-sec" aria-hidden />
        <select
          aria-label="Mês da liderança"
          value={mes}
          onChange={(e) => {
            setMesSelecionado(e.target.value);
            setSemana(null);
          }}
          className="h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto"
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {rotuloMes(m)}
            </option>
          ))}
        </select>
        <select
          aria-label="Semana do mês"
          value={semana ?? ""}
          onChange={(e) => setSemana(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto"
        >
          <option value="">Mês inteiro</option>
          {Array.from({ length: totalSemanas }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>
              Semana {s}
            </option>
          ))}
        </select>
        <p className="text-xs text-texto-sec">
          Recorte: <span className="font-medium text-texto">{recorteLabel}</span> · métricas
          da equipe sempre do mês inteiro
        </p>
      </div>

      {/* b) 6 KPIs da liderança */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiLideranca icon={Megaphone} rotulo="Leads que entraram" valor={String(lideranca.kpis.leadsEntraram)} />
        <KpiLideranca icon={UserCheck2} rotulo="Leads qualificados" valor={String(lideranca.kpis.leadsQualificados)} />
        <KpiLideranca icon={Users} rotulo="Leads desqualificados" valor={String(lideranca.kpis.leadsDesqualificados)} />
        <KpiLideranca icon={CalendarCheck2} rotulo="Ocorridas" valor={String(lideranca.kpis.ocorridas)} />
        <KpiLideranca icon={UserX} rotulo="No-show" valor={String(lideranca.kpis.noShow)} />
        <KpiLideranca
          icon={Percent}
          rotulo="Comparecimento geral"
          valor={`${lideranca.kpis.taxaComparecimento.toFixed(1).replace(".", ",")}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* c) Comparecimento por SDR */}
        <Card>
          <CardHeader
            title="Comparecimento por SDR"
            subtitle="Só calls com data até hoje entram na base"
          />
          {lideranca.comparecimentoPorSdr.length === 0 ? (
            <EmptyState
              titulo="Sem calls no recorte"
              descricao="Ajuste o mês ou a semana para ver o comparecimento."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda/60">
                    <TH>SDR</TH>
                    <TH right>Agendadas (até hoje)</TH>
                    <TH right>Ocorridas</TH>
                    <TH right>No-show</TH>
                    <TH right>Comparecimento</TH>
                  </tr>
                </thead>
                <tbody>
                  {lideranca.comparecimentoPorSdr.map((c) => (
                    <tr key={c.sdr} className="border-b border-borda/30 last:border-0">
                      <td className="px-3 py-2 font-medium text-texto">{c.sdr}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-texto">{c.agendadasAteHoje}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-texto">{c.ocorridas}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-rosa">{c.noShow}</td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          c.taxa >= 80 ? "text-verde" : c.taxa >= 65 ? "text-amarelo" : "text-rosa",
                        )}
                      >
                        {c.taxa.toFixed(1).replace(".", ",")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* d) Produtos no recorte */}
        <Card>
          <CardHeader
            title="Produtos no recorte"
            subtitle="Leads qualificados do marketing por produto/perfil"
          />
          {lideranca.produtosNoRecorte.length === 0 ? (
            <EmptyState
              titulo="Sem qualificados no recorte"
              descricao="Nenhum lead qualificado do marketing neste período."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borda/60">
                    <TH>Produto / Perfil</TH>
                    <TH right>Qualificados</TH>
                  </tr>
                </thead>
                <tbody>
                  {lideranca.produtosNoRecorte.map((p) => (
                    <tr key={p.produto} className="border-b border-borda/30 last:border-0">
                      <td className="px-3 py-2 text-texto">{p.produto}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-texto">
                        {p.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* e) Matriz SDR × Closer */}
      <Card>
        <CardHeader
          title="Relação SDR × Closer — calls marcadas"
          subtitle="A API não traz o vínculo direto: as calls de cada SDR são distribuídas proporcionalmente à participação de cada closer no mesmo dia, com arredondamento que preserva o total por SDR."
        />
        {lideranca.matriz.linhas.length === 0 ? (
          <EmptyState
            titulo="Sem calls marcadas no recorte"
            descricao="Ajuste o mês ou a semana para ver a matriz."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-borda/60">
                  <TH>SDR</TH>
                  {lideranca.matriz.closers.map((c) => (
                    <TH key={c} right>
                      {c === SEM_CLOSER ? <span className="italic">{c}</span> : c}
                    </TH>
                  ))}
                  <TH right>Total</TH>
                </tr>
              </thead>
              <tbody>
                {lideranca.matriz.linhas.map((linha) => (
                  <tr key={linha.sdr} className="border-b border-borda/30 last:border-0">
                    <td className="px-3 py-2 font-medium text-texto">{linha.sdr}</td>
                    {lideranca.matriz.closers.map((c) => (
                      <td key={c} className="px-3 py-2 text-right tabular-nums text-texto-sec">
                        {linha.valores[c] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-texto">
                      {linha.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* f) Métricas da equipe — sempre o mês inteiro */}
      <Card>
        <CardHeader
          title="Métricas da equipe (mês)"
          subtitle={`Reuniões qualificadas de toda a pré-venda em ${rotuloMes(mes)} — ignora o filtro de semana`}
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-3xl font-bold tabular-nums text-texto">
              {lideranca.equipe.qualificadosMes}
              <span className="ml-2 text-sm font-normal text-texto-sec">
                reuniões qualificadas no mês
              </span>
            </p>
            <p className="text-sm text-texto-sec">
              Meta atual da equipe:{" "}
              <span className="font-semibold text-azul-claro">{lideranca.equipe.metaAtual}</span>
            </p>
          </div>

          <div className="space-y-3">
            {lideranca.equipe.progresso.map((p) => {
              const atual = p.meta === lideranca.equipe.metaAtual && !p.batida;
              return (
                <div key={p.meta}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className={cn("text-texto-sec", atual && "font-semibold text-texto")}>
                      Meta {p.meta}
                      {atual && " (atual)"}
                    </span>
                    <span className={p.batida ? "font-semibold text-verde" : "text-texto-sec"}>
                      {p.batida ? "Batida ✓" : `Faltam ${p.faltam}`}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-borda/40"
                    role="progressbar"
                    aria-valuenow={Math.round(p.pct * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Meta ${p.meta}: ${Math.round(p.pct * 100)}%`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        p.batida ? "bg-verde" : atual ? "bg-azul" : "bg-borda",
                      )}
                      style={{ width: `${p.pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda/60">
                  <TH>Meta</TH>
                  <TH right>Objetivo</TH>
                  <TH right>Realizado (mês)</TH>
                  <TH right>Status</TH>
                </tr>
              </thead>
              <tbody>
                {lideranca.equipe.progresso.map((p, i) => (
                  <tr key={p.meta} className="border-b border-borda/30 last:border-0">
                    <td className="px-3 py-2 text-texto">M{i + 1}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-texto">{p.meta}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-texto">
                      {lideranca.equipe.qualificadosMes}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium",
                        p.batida ? "text-verde" : "text-texto-sec",
                      )}
                    >
                      {p.batida ? "Batida" : `Faltam ${p.faltam}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
