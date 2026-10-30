"use client";

import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, GraduationCap, ListTodo, Plus } from "lucide-react";
import {
  diaDaSemanaCurto,
  diaMes,
  diasDaSemana,
  gradeDoMes,
  horaDe,
  horasDaSemana,
  porDia,
  rotuloDoDia,
  somarDias,
  somarMeses,
  tituloDaSemana,
  tituloDoMes,
  type VisaoCalendario,
} from "@/lib/educacional/calendario";
import { TIPOS_EVENTO_CALENDARIO, type EventoCalendario, type TipoEventoCalendario } from "@/lib/educacional/contrato";
import {
  ROTULO_STATUS_AULA,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_STATUS_INTERVENCAO,
  ROTULO_TIPO_EVENTO,
} from "@/lib/educacional/rotulos";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Grade do Calendário do Educacional (Entrega 2, M3). O visual é uma CÓPIA do
// calendário de primeiras calls (features/agendamentos), sem importar nada de
// lá: mês (semanas dom→sáb, até 3 itens por dia) e semana. Na semana, o que
// tem hora (aula) fica na linha da hora; o resto, em "Dia todo". Cor por tipo;
// checkpoint em SLA (marcado pela API) com borda vermelha e alerta.
// Clicar num item abre o Raio-X; clicar no dia (ou no "+") oferece criar uma
// intervenção ou uma aula naquele dia (na semana, naquela hora).
// ---------------------------------------------------------------------------

const MAX_POR_DIA = 3;

export const COR_DO_TIPO: Record<TipoEventoCalendario, string> = {
  checkpoint: "border-info-forte/40 bg-info-forte/15",
  intervencao: "border-laranja/40 bg-laranja/15",
  proxima_acao: "border-violeta/40 bg-violeta/10",
  aula: "border-teal/40 bg-teal/15",
};
export const PONTO_DO_TIPO: Record<TipoEventoCalendario, string> = {
  checkpoint: "bg-info",
  intervencao: "bg-laranja",
  proxima_acao: "bg-violeta",
  aula: "bg-teal",
};

// Status com rótulo da tela (código desconhecido não aparece).
function rotuloDoStatus(e: EventoCalendario): string | null {
  const s = e.status ?? "";
  if (e.tipo === "checkpoint") return ROTULO_STATUS_CHECKPOINT[s as keyof typeof ROTULO_STATUS_CHECKPOINT] ?? null;
  if (e.tipo === "intervencao") return ROTULO_STATUS_INTERVENCAO[s as keyof typeof ROTULO_STATUS_INTERVENCAO] ?? null;
  if (e.tipo === "aula") return ROTULO_STATUS_AULA[s as keyof typeof ROTULO_STATUS_AULA] ?? null;
  return null;
}

// Já resolvido (só apagado na tela): checkpoint realizado, intervenção concluída, aula feita ou cancelada.
const resolvido = (e: EventoCalendario) => ["realizado", "concluida", "feito", "cancelada"].includes(e.status ?? "");

function descricao(e: EventoCalendario): string {
  const status = rotuloDoStatus(e);
  return [
    `${ROTULO_TIPO_EVENTO[e.tipo]}: ${e.titulo}`,
    e.aluno.nome,
    e.hora ? e.hora.slice(0, 5) : null,
    status,
    e.responsavel?.nome,
    e.sla ? "em SLA" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Chip({ e, onAbrir, detalhado = false }: { e: EventoCalendario; onAbrir: (e: EventoCalendario) => void; detalhado?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(e)}
      title={descricao(e)}
      aria-label={`${descricao(e)}. Abrir o Raio-X.`}
      className={cn(
        "w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight text-texto transition-all hover:-translate-y-px hover:border-white/30",
        COR_DO_TIPO[e.tipo],
        e.sla && "border-erro-forte/70 ring-1 ring-erro-forte/50",
        resolvido(e) && "opacity-55",
      )}
    >
      <span className="flex items-center gap-1">
        {e.sla ? (
          <AlertTriangle className="h-3 w-3 shrink-0 text-erro" aria-hidden />
        ) : (
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PONTO_DO_TIPO[e.tipo])} aria-hidden />
        )}
        {e.hora && <span className="font-semibold tabular-nums">{e.hora.slice(0, 5)}</span>}
        <span className="truncate">{e.aluno.nome}</span>
      </span>
      {detalhado && (
        <span className="mt-0.5 block truncate text-[10px] text-texto-sec">
          {ROTULO_TIPO_EVENTO[e.tipo]} · {e.titulo}
          {e.responsavel && <> · {e.responsavel.nome}</>}
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

export type PedidoDoDia = { dia: string; hora: string | null; x: number; y: number };

function BotaoCriar({ dia, hora, onDia }: { dia: string; hora?: string; onDia: (p: PedidoDoDia) => void }) {
  return (
    <button
      type="button"
      onClick={(ev) => {
        const r = ev.currentTarget.getBoundingClientRect();
        onDia({ dia, hora: hora ?? null, x: r.left, y: r.bottom + 4 });
      }}
      aria-label={`Criar em ${diaMes(dia)}${hora ? ` às ${hora}` : ""}`}
      title="Nova intervenção ou aula"
      className="icon-button h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

// Clique no fundo da célula (não num item): o mesmo que o "+".
const noFundo = (dia: string, hora: string | null, onDia: (p: PedidoDoDia) => void) => (ev: MouseEvent<HTMLDivElement>) => {
  if (ev.target === ev.currentTarget) onDia({ dia, hora, x: ev.clientX, y: ev.clientY });
};

export function GradeDoCalendario({
  itens,
  carregando,
  visao,
  onVisao,
  ancora,
  onAncora,
  hoje,
  onAbrir,
  onDia,
}: {
  itens: EventoCalendario[];
  carregando: boolean;
  visao: VisaoCalendario;
  onVisao: (v: VisaoCalendario) => void;
  ancora: string;
  onAncora: (dia: string) => void;
  hoje: string;
  onAbrir: (e: EventoCalendario) => void;
  onDia: (p: PedidoDoDia) => void;
}) {
  const mapa = useMemo(() => porDia(itens), [itens]);
  const semanas = useMemo(() => gradeDoMes(ancora), [ancora]);
  const semana = useMemo(() => diasDaSemana(ancora), [ancora]);
  const horas = useMemo(() => horasDaSemana(itens), [itens]);
  const mesDaAncora = ancora.slice(0, 7);
  const diasVisiveis = visao === "mes" ? semanas.flat() : semana;
  const titulo = visao === "mes" ? tituloDoMes(ancora) : tituloDaSemana(ancora);
  const anterior = () => onAncora(visao === "mes" ? somarMeses(ancora, -1) : somarDias(ancora, -7));
  const proximo = () => onAncora(visao === "mes" ? somarMeses(ancora, 1) : somarDias(ancora, 7));
  const contagem = (dia: string) => {
    const n = mapa.get(dia)?.length ?? 0;
    return `${n} ${n === 1 ? "item" : "itens"}`;
  };

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
          <h2 className="font-medium text-texto" aria-live="polite">
            {titulo}
          </h2>
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
          {TIPOS_EVENTO_CALENDARIO.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", PONTO_DO_TIPO[t])} aria-hidden /> {ROTULO_TIPO_EVENTO[t]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-erro" aria-hidden /> Checkpoint em SLA
          </span>
          <span className="ml-auto tabular-nums">
            {itens.length} {itens.length === 1 ? "item" : "itens"} no período
          </span>
        </p>

        {carregando ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : visao === "mes" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-borda/60 pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-texto-sec">
              {semana.map((d) => (
                <span key={d}>{diaDaSemanaCurto(d)}</span>
              ))}
            </div>
            <div role="grid" aria-label={`Calendário de ${titulo}`}>
              {semanas.map((linha) => (
                <div key={linha[0]} role="row" className="grid grid-cols-7">
                  {linha.map((dia) => {
                    const doDia = mapa.get(dia) ?? [];
                    return (
                      <div
                        key={dia}
                        role="gridcell"
                        aria-label={`${rotuloDoDia(dia, hoje)}, ${diaMes(dia)}: ${contagem(dia)}`}
                        onClick={noFundo(dia, null, onDia)}
                        className={cn(
                          "group min-h-[7.5rem] cursor-pointer space-y-1 border-b border-r border-borda/30 p-1.5 first:border-l",
                          dia === hoje && "bg-white/[0.04]",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <NumeroDoDia dia={dia} hoje={hoje} apagado={dia.slice(0, 7) !== mesDaAncora} />
                          <BotaoCriar dia={dia} onDia={onDia} />
                        </div>
                        {doDia.slice(0, MAX_POR_DIA).map((e) => (
                          <Chip key={e.id} e={e} onAbrir={onAbrir} />
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
                            +{doDia.length - MAX_POR_DIA} {doDia.length - MAX_POR_DIA === 1 ? "item" : "itens"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {itens.length === 0 && (
              <p className="pt-3 text-center text-xs text-texto-sec" role="status">
                Nada neste período. Clique num dia para criar uma intervenção ou uma aula.
              </p>
            )}
          </div>
        ) : (
          <Semana semana={semana} horas={horas} mapa={mapa} hoje={hoje} titulo={titulo} onAbrir={onAbrir} onDia={onDia} vazio={itens.length === 0} />
        )}
      </CardContent>
    </Card>
  );
}

// Semana em linhas: "Dia todo" (sem hora) e uma linha por hora.
function Semana({
  semana,
  horas,
  mapa,
  hoje,
  titulo,
  onAbrir,
  onDia,
  vazio,
}: {
  semana: string[];
  horas: number[];
  mapa: Map<string, EventoCalendario[]>;
  hoje: string;
  titulo: string;
  onAbrir: (e: EventoCalendario) => void;
  onDia: (p: PedidoDoDia) => void;
  vazio: boolean;
}) {
  const colunas = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <div role="grid" aria-label={`Calendário da semana de ${titulo}`}>
      <div role="row" className={cn(colunas, "border-b border-borda/60 pb-1")}>
        {/* Coluna das horas: célula vazia que ocupa o lugar na grade. */}
        <span role="columnheader" aria-label="Hora" />
        {semana.map((dia) => (
          <div key={dia} role="columnheader" className="group flex items-center justify-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-texto-sec">{diaDaSemanaCurto(dia)}</span>
            <NumeroDoDia dia={dia} hoje={hoje} />
            <BotaoCriar dia={dia} onDia={onDia} />
          </div>
        ))}
      </div>
      <div role="row" className={colunas}>
        <span role="rowheader" className="py-2 pr-2 text-right text-[10px] uppercase tracking-wide text-texto-sec">
          Dia todo
        </span>
        {semana.map((dia) => (
          <div
            key={dia}
            role="gridcell"
            aria-label={`${rotuloDoDia(dia, hoje)}, ${diaMes(dia)}, dia todo`}
            onClick={noFundo(dia, null, onDia)}
            className={cn("min-h-[3rem] cursor-pointer space-y-1 border-b border-r border-borda/40 p-1 first-of-type:border-l", dia === hoje && "bg-white/[0.04]")}
          >
            {(mapa.get(dia) ?? [])
              .filter((e) => horaDe(e) == null)
              .map((e) => (
                <Chip key={e.id} e={e} onAbrir={onAbrir} detalhado />
              ))}
          </div>
        ))}
      </div>
      {horas.map((h) => (
        <div key={h} role="row" className={colunas}>
          <span role="rowheader" className="-mt-1.5 pr-2 text-right text-[10px] tabular-nums text-texto-sec">
            {hh(h)}
          </span>
          {semana.map((dia) => (
            <div
              key={dia}
              role="gridcell"
              aria-label={`${rotuloDoDia(dia, hoje)}, ${diaMes(dia)}, ${hh(h)}`}
              onClick={noFundo(dia, hh(h), onDia)}
              className={cn("min-h-[2.75rem] cursor-pointer space-y-1 border-b border-r border-borda/20 p-1", dia === hoje && "bg-white/[0.04]")}
            >
              {(mapa.get(dia) ?? [])
                .filter((e) => horaDe(e) === h)
                .map((e) => (
                  <Chip key={e.id} e={e} onAbrir={onAbrir} detalhado />
                ))}
            </div>
          ))}
        </div>
      ))}
      {vazio && (
        <p className="pt-3 text-center text-xs text-texto-sec" role="status">
          Nada nesta semana. Clique num dia ou num horário para criar uma intervenção ou uma aula.
        </p>
      )}
    </div>
  );
}

// Menu do dia clicado: criar intervenção ou aula (no <body>: o vidro do card prende o `fixed`).
export function MenuDoDia({
  pedido,
  onEscolher,
  onFechar,
}: {
  pedido: PedidoDoDia;
  onEscolher: (tipo: "intervencao" | "aula") => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const aberto = Date.now();
    const fora = (e: Event) => !ref.current?.contains(e.target as Node) && onFechar();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    // Rolar a página fecha (o menu é `fixed`); a rolagem do próprio clique, logo ao abrir, não.
    const rolou = () => Date.now() - aberto > 300 && onFechar();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", rolou, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", rolou, true);
    };
  }, [onFechar]);
  const LARGURA = 220;
  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-texto hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none";
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Criar em ${diaMes(pedido.dia)}`}
      style={{ top: Math.min(pedido.y, window.innerHeight - 120), left: Math.min(pedido.x, window.innerWidth - LARGURA - 8), width: LARGURA }}
      className="fixed z-[70] rounded-xl border border-white/15 bg-painel p-1 shadow-2xl"
    >
      <p className="px-2 pb-1 pt-1.5 text-[11px] text-texto-sec">
        {diaDaSemanaCurto(pedido.dia)}, {diaMes(pedido.dia)}
        {pedido.hora && ` · ${pedido.hora}`}
      </p>
      <button type="button" role="menuitem" className={item} onClick={() => onEscolher("intervencao")}>
        <ListTodo className="h-3.5 w-3.5" aria-hidden />
        Nova intervenção
      </button>
      <button type="button" role="menuitem" className={item} onClick={() => onEscolher("aula")}>
        <GraduationCap className="h-3.5 w-3.5" aria-hidden />
        Nova aula
      </button>
    </div>,
    document.body,
  );
}
