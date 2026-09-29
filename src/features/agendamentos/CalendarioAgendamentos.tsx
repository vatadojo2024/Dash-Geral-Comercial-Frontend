"use client";

import { useMemo } from "react";
import { CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import {
  diaDaSemanaCurto,
  diaMes,
  diasDaSemana,
  gradeDoMes,
  nomeDoLead,
  porDia,
  produtoDoAgendamento,
  rotuloDoDia,
  rotuloDoStatus,
  somarDias,
  somarMeses,
  statusDaCall,
  tituloDaSemana,
  tituloDoMes,
  type AgendamentoPrimeiraCall,
  type StatusCall,
  type VisaoCalendario,
} from "@/lib/agendamentos/primeiraCall";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { AgendamentoCard } from "./AgendamentoCard";
import { IconeDoStatus } from "./partes";

// ---------------------------------------------------------------------------
// Calendário das primeiras calls. O projeto não tinha componente de calendário;
// em vez de trazer uma biblioteca com estética própria, a grade é feita com os
// tokens e utilitários do design system (ver decisão no PROGRESSO.md).
//   - md+: grade de MÊS (semanas dom→sáb) ou de SEMANA (7 colunas);
//   - < md: a grade não cabe → AGENDA (lista por dia, com o card da fila).
// Clicar num evento abre o MESMO detalhe do item da fila.
// ---------------------------------------------------------------------------

const MAX_POR_DIA = 3;

const CHIP_STATUS: Record<StatusCall, string> = {
  hoje: "border-laranja/50 bg-laranja/15 text-texto",
  passada: "border-white/10 bg-white/5 text-texto-sec",
  futura: "border-azul/40 bg-azul/15 text-texto",
};

function EventoChip({
  ag,
  agora,
  onAbrir,
  detalhado = false,
}: {
  ag: AgendamentoPrimeiraCall;
  agora: Date;
  onAbrir: (id: string) => void;
  detalhado?: boolean;
}) {
  const status = statusDaCall(ag, agora);
  const nome = nomeDoLead(ag);
  const rotulo = rotuloDoStatus(ag, agora);
  const produto = produtoDoAgendamento(ag);
  return (
    <button
      type="button"
      onClick={() => onAbrir(ag.evento_id)}
      title={`${ag.hora_br} · ${nome} · ${rotulo}`}
      aria-label={`Primeira call de ${nome} às ${ag.hora_br}, ${rotulo}. Ver detalhes.`}
      className={cn(
        "w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-all hover:-translate-y-px hover:border-white/30",
        CHIP_STATUS[status],
      )}
    >
      <span className="flex items-center gap-1">
        <IconeDoStatus status={status} className="h-3 w-3 shrink-0" />
        <span className="font-semibold tabular-nums">{ag.hora_br}</span>
        <span className="truncate">{nome}</span>
      </span>
      {detalhado && (
        <span className="mt-0.5 block truncate text-[10px] text-texto-sec">
          {rotulo}
          {produto && <> · {produto}</>}
          {ag.closer_nome && <> · {ag.closer_nome}</>}
        </span>
      )}
    </button>
  );
}

function NumeroDoDia({ dia, hoje, apagado }: { dia: string; hoje: string; apagado?: boolean }) {
  const ehHoje = dia === hoje;
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
        ehHoje ? "border border-azul/50 bg-azul/30 font-semibold text-texto" : "text-texto-sec",
        apagado && !ehHoje && "opacity-40",
      )}
      title={ehHoje ? "Hoje" : undefined}
    >
      {Number(dia.slice(8))}
      {ehHoje && <span className="sr-only"> (hoje)</span>}
    </span>
  );
}

export function CalendarioAgendamentos({
  itens,
  carregando,
  visao,
  onVisao,
  ancora,
  onAncora,
  hoje,
  agora,
  onAbrir,
}: {
  itens: AgendamentoPrimeiraCall[];
  carregando: boolean;
  visao: VisaoCalendario;
  onVisao: (v: VisaoCalendario) => void;
  // Dia (AAAA-MM-DD) que define a semana/mês à mostra.
  ancora: string;
  onAncora: (dia: string) => void;
  hoje: string;
  agora: Date;
  onAbrir: (id: string) => void;
}) {
  const mapa = useMemo(() => porDia(itens), [itens]);
  const semanas = useMemo(() => gradeDoMes(ancora), [ancora]);
  const semana = useMemo(() => diasDaSemana(ancora), [ancora]);
  const mesDaAncora = ancora.slice(0, 7);
  const diasVisiveis = visao === "mes" ? semanas.flat() : semana;
  const diasComCall = diasVisiveis.filter((d) => (mapa.get(d)?.length ?? 0) > 0);

  const anterior = () => onAncora(visao === "mes" ? somarMeses(ancora, -1) : somarDias(ancora, -7));
  const proximo = () => onAncora(visao === "mes" ? somarMeses(ancora, 1) : somarDias(ancora, 7));
  const titulo = visao === "mes" ? tituloDoMes(ancora) : tituloDaSemana(ancora);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <button type="button" onClick={anterior} aria-label={visao === "mes" ? "Mês anterior" : "Semana anterior"} className="icon-button">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={proximo} aria-label={visao === "mes" ? "Próximo mês" : "Próxima semana"} className="icon-button">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <h4 className="font-medium text-texto" aria-live="polite">
            {titulo}
          </h4>
          <Button variant="secondary" size="sm" onClick={() => onAncora(hoje)} disabled={diasVisiveis.includes(hoje)}>
            Hoje
          </Button>
        </div>
        <Alternador<VisaoCalendario>
          rotulo="Período do calendário"
          valor={visao}
          onChange={onVisao}
          opcoes={[
            { valor: "semana", label: "Semana" },
            { valor: "mes", label: "Mês" },
          ]}
        />
      </div>

      <CardContent className="space-y-3 pt-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-texto-sec">
          <span className="inline-flex items-center gap-1">
            <IconeDoStatus status="hoje" className="h-3 w-3 text-laranja" /> Hoje
          </span>
          <span className="inline-flex items-center gap-1">
            <IconeDoStatus status="futura" className="h-3 w-3 text-azul-claro" /> Agendada
          </span>
          <span className="inline-flex items-center gap-1">
            <IconeDoStatus status="passada" className="h-3 w-3" /> Já passou
          </span>
          <span className="ml-auto tabular-nums">
            {itens.length} {itens.length === 1 ? "call" : "calls"} no período
          </span>
        </p>

        {carregando ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            {/* md+: grade */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 border-b border-borda/60 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-texto-sec">
                {semana.map((d) => (
                  <span key={d}>{diaDaSemanaCurto(d)}</span>
                ))}
              </div>

              {visao === "mes" ? (
                <div role="grid" aria-label={`Calendário de ${titulo}`}>
                  {semanas.map((linha) => (
                    <div key={linha[0]} role="row" className="grid grid-cols-7">
                      {linha.map((dia) => {
                        const doDia = mapa.get(dia) ?? [];
                        const fora = dia.slice(0, 7) !== mesDaAncora;
                        return (
                          <div
                            key={dia}
                            role="gridcell"
                            aria-label={`${rotuloDoDia(dia, hoje)}, ${diaMes(dia)}: ${doDia.length} ${doDia.length === 1 ? "call" : "calls"}`}
                            className={cn(
                              "min-h-[7rem] space-y-1 border-b border-r border-borda/30 p-1.5 first:border-l",
                              dia === hoje && "bg-white/[0.04]",
                            )}
                          >
                            <NumeroDoDia dia={dia} hoje={hoje} apagado={fora} />
                            {doDia.slice(0, MAX_POR_DIA).map((ag) => (
                              <EventoChip key={ag.evento_id} ag={ag} agora={agora} onAbrir={onAbrir} />
                            ))}
                            {doDia.length > MAX_POR_DIA && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAncora(dia);
                                  onVisao("semana");
                                }}
                                className="text-[11px] text-texto-sec underline-offset-2 hover:text-texto hover:underline"
                              >
                                +{doDia.length - MAX_POR_DIA} {doDia.length - MAX_POR_DIA === 1 ? "call" : "calls"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div role="grid" aria-label={`Calendário da semana de ${titulo}`} className="grid grid-cols-7">
                  {semana.map((dia) => {
                    const doDia = mapa.get(dia) ?? [];
                    return (
                      <div
                        key={dia}
                        role="gridcell"
                        aria-label={`${rotuloDoDia(dia, hoje)}, ${diaMes(dia)}: ${doDia.length} ${doDia.length === 1 ? "call" : "calls"}`}
                        className={cn(
                          "min-h-[20rem] space-y-1.5 border-b border-r border-borda/30 p-1.5 first:border-l",
                          dia === hoje && "bg-white/[0.04]",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <NumeroDoDia dia={dia} hoje={hoje} />
                          {dia === hoje && <span className="text-[10px] font-medium uppercase tracking-wide text-azul-claro">Hoje</span>}
                        </div>
                        {doDia.map((ag) => (
                          <EventoChip key={ag.evento_id} ag={ag} agora={agora} onAbrir={onAbrir} detalhado />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {itens.length === 0 && (
                <p className="pt-3 text-center text-xs text-texto-sec" role="status">
                  Nenhuma primeira call agendada neste período.
                </p>
              )}
            </div>

            {/* < md: a grade não cabe — agenda por dia, com o card da fila */}
            <div className="space-y-4 md:hidden">
              {diasComCall.length === 0 ? (
                <EmptyState
                  icon={CalendarX}
                  titulo="Nenhuma primeira call agendada"
                  descricao={`Não há calls ${visao === "mes" ? "neste mês" : "nesta semana"}. Use as setas para navegar.`}
                />
              ) : (
                diasComCall.map((dia) => (
                  <section key={dia} aria-label={`Calls de ${rotuloDoDia(dia, hoje)}`}>
                    <h5 className="mb-2 flex items-baseline gap-2 border-b border-borda/60 pb-1.5 text-sm font-semibold text-texto">
                      {rotuloDoDia(dia, hoje)}
                      {!rotuloDoDia(dia, hoje).includes("/") && (
                        <span className="text-xs font-normal text-texto-sec">{diaMes(dia)}</span>
                      )}
                    </h5>
                    <div className="space-y-3">
                      {(mapa.get(dia) ?? []).map((ag) => (
                        <AgendamentoCard key={ag.evento_id} ag={ag} agora={agora} hoje={hoje} onAbrir={onAbrir} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
