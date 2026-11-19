"use client";

import { ArrowRight, Flame, Landmark, Package, Wallet } from "lucide-react";
import {
  diaDaSemanaCurto,
  diaMes,
  nomeDoLead,
  partesDaUrgencia,
  produtoDoAgendamento,
  rotuloDoDia,
  statusDaCall,
  type AgendamentoPrimeiraCall,
} from "@/lib/agendamentos/primeiraCall";
import { cn } from "@/lib/utils/cn";
import { AcoesDoAgendamento, StatusCallBadge } from "./partes";

// Item da fila de primeiras calls — mesmo esqueleto do card da fila de leads
// (LeadPriorityCard): .card-interactive, bloco à esquerda, conteúdo, seta. No
// lugar do rank, a HORA da call. Clicar abre o detalhe (o mesmo do calendário).
// Hoje = destaque do DS (borda/fundo laranja) + tag "Hoje"; passada = atenuada
// + tag "Já passou".
export function AgendamentoCard({
  ag,
  agora,
  hoje,
  onAbrir,
}: {
  ag: AgendamentoPrimeiraCall;
  agora: Date;
  hoje: string;
  onAbrir: (eventoId: string) => void;
}) {
  const status = statusDaCall(ag, agora);
  const nome = nomeDoLead(ag);
  const produto = produtoDoAgendamento(ag);
  const urgencia = partesDaUrgencia(ag.urgencia);
  const abrir = () => onAbrir(ag.evento_id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrir();
        }
      }}
      aria-label={`Ver detalhes da primeira call de ${nome}, ${rotuloDoDia(ag.dia, hoje)} às ${ag.hora_br}`}
      className={cn(
        "card-interactive block cursor-pointer rounded-xl p-4",
        status === "hoje" && "border-laranja/50 bg-laranja/10",
        status === "passada" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <p className={cn("text-lg font-semibold tabular-nums", status === "hoje" ? "text-laranja" : "text-texto")}>
            {ag.hora_br}
          </p>
          <p className="text-[11px] text-texto-sec">
            {diaDaSemanaCurto(ag.dia)}, {diaMes(ag.dia)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
            <div className="min-w-0 max-w-full">
              <p className="truncate text-sm font-semibold text-texto">{nome}</p>
              <p className="text-xs text-texto-sec/80">
                closer {ag.closer_nome ?? "não identificado"}
                {ag.sdr_nome && <> · SDR {ag.sdr_nome}</>}
              </p>
            </div>
            <StatusCallBadge ag={ag} agora={agora} />
          </div>

          {(produto || ag.patrimonio || ag.renda) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {produto && (
                <span className="tag" title="Produto indicado">
                  <Package className="h-3 w-3" aria-hidden />
                  {produto}
                </span>
              )}
              {ag.patrimonio && (
                <span className="tag normal-case tracking-normal" title="Patrimônio (faixa)">
                  <Landmark className="h-3 w-3" aria-hidden />
                  Patrimônio: {ag.patrimonio}
                </span>
              )}
              {ag.renda && (
                <span className="tag normal-case tracking-normal" title="Renda (faixa)">
                  <Wallet className="h-3 w-3" aria-hidden />
                  Renda: {ag.renda}
                </span>
              )}
            </div>
          )}

          {urgencia && (
            <p className="mt-3 flex items-start gap-2 text-sm text-texto">
              <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-laranja" aria-hidden />
              <span className="line-clamp-2">
                <span className="font-medium text-texto-sec">Urgência: </span>
                {urgencia.nota != null && <span className="font-semibold tabular-nums">{urgencia.nota}/10 </span>}
                {urgencia.nota != null && urgencia.texto && "— "}
                {urgencia.texto}
              </span>
            </p>
          )}

          <AcoesDoAgendamento ag={ag} className="mt-3" />
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-texto-sec/40" aria-hidden />
      </div>
    </article>
  );
}
