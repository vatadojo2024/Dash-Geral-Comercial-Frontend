"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, FileText, MessageCircle, X } from "lucide-react";
import {
  nomeDoLead,
  partesDaUrgencia,
  produtoDoAgendamento,
  rotuloDoDia,
  urlDaSala,
  type AgendamentoPrimeiraCall,
} from "@/lib/agendamentos/primeiraCall";
import { dataHora, tempoRelativo } from "@/lib/formatters/date";
import { brParaQuebras } from "@/lib/formatters/texto";
import { linkWhatsApp } from "@/lib/sdr/oportunidades";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { AcoesDoAgendamento, StatusCallBadge } from "./partes";

// Painel lateral de detalhe — o MESMO para o item da fila e para o evento do
// calendário. Anatomia do Glass Modal do design system (como o painel de
// pendentes e o recorte do dashboard): header pt-6, corpo p-6 com linhas
// rótulo/valor, barra de ações p-6 pt-0. Somente leitura.
function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="border-b border-white/10 py-3 last:border-0">
      <p className="text-[10px] uppercase tracking-wide opacity-60">{rotulo}</p>
      <div className="mt-1 text-sm text-texto">{children}</div>
    </div>
  );
}

const vazio = <span className="text-texto-sec">Não informado</span>;

export function DetalheAgendamento({
  ag,
  agora,
  hoje,
  onClose,
}: {
  ag: AgendamentoPrimeiraCall;
  agora: Date;
  hoje: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const nome = nomeDoLead(ag);
  const produto = produtoDoAgendamento(ag);
  const urgencia = partesDaUrgencia(ag.urgencia);
  const sala = urlDaSala(ag.link_call);
  const wa = linkWhatsApp(ag.lead_telefone);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Primeira call de ${nome}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside className="modal-surface modal-border absolute inset-y-0 right-0 flex w-full max-w-md flex-col rounded-l-modal shadow-layered">
        <div className="flex items-start justify-between gap-4 pb-0 pl-6 pr-6 pt-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="icon-circle shadow-layered">
              <CalendarClock className="h-5 w-5 text-violeta" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-jakarta text-xl font-semibold tracking-tight text-texto">{nome}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusCallBadge ag={ag} agora={agora} />
                {produto && <span className="tag">{produto}</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="icon-button">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Linha rotulo="Data e hora da call">
            <span className="font-semibold tabular-nums">
              {ag.data_br} às {ag.hora_br}
            </span>{" "}
            <span className="text-texto-sec">
              ({rotuloDoDia(ag.dia, hoje).toLowerCase()}, horário de Brasília)
            </span>
          </Linha>

          <Linha rotulo="Closer">{ag.closer_nome ?? vazio}</Linha>
          <Linha rotulo="SDR">{ag.sdr_nome ?? vazio}</Linha>
          <Linha rotulo="Produto indicado">{produto ?? vazio}</Linha>
          <Linha rotulo="Patrimônio (faixa)">{ag.patrimonio ?? vazio}</Linha>
          <Linha rotulo="Renda (faixa)">{ag.renda ?? vazio}</Linha>

          <Linha rotulo="Urgência">
            {urgencia ? (
              <span className="whitespace-pre-wrap">
                {urgencia.nota != null && <span className="font-semibold tabular-nums">{urgencia.nota}/10</span>}
                {urgencia.nota != null && urgencia.texto && " — "}
                {brParaQuebras(urgencia.texto)}
              </span>
            ) : (
              vazio
            )}
          </Linha>

          <Linha rotulo="Link da call">
            {ag.link_call ? (
              <span className="flex flex-wrap items-center gap-1">
                {sala ? (
                  <a
                    href={sala}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all font-medium text-azul-claro hover:underline"
                  >
                    {sala.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <span className="break-all">{ag.link_call}</span>
                )}
                <BotaoCopiar valor={sala ?? ag.link_call} rotulo="link da call" />
              </span>
            ) : (
              <span className="text-texto-sec">Sem link de sala neste agendamento.</span>
            )}
          </Linha>

          <Linha rotulo="Card na Clint">
            {ag.link_crm ? (
              <span className="text-texto-sec">Disponível — use o botão “Abrir na Clint” abaixo.</span>
            ) : (
              <span className="text-texto-sec">
                Card não localizado na Clint para este agendamento.
              </span>
            )}
          </Linha>

          <Linha rotulo="Telefone do lead">
            {ag.lead_telefone ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{ag.lead_telefone}</span>
                <BotaoCopiar valor={ag.lead_telefone} rotulo="telefone" />
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-verde/40 bg-verde/10 px-3 py-1.5 text-sm font-medium text-verde transition-colors hover:bg-verde/10"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    WhatsApp
                  </a>
                )}
              </span>
            ) : (
              vazio
            )}
          </Linha>

          <Linha rotulo="E-mail do lead">
            {ag.lead_email ? (
              <span className="flex flex-wrap items-center gap-1">
                <a href={`mailto:${ag.lead_email}`} className="break-all hover:text-azul-claro hover:underline">
                  {ag.lead_email}
                </a>
                <BotaoCopiar valor={ag.lead_email} rotulo="e-mail" />
              </span>
            ) : (
              vazio
            )}
          </Linha>

          {ag.lead_id && (
            <Linha rotulo="Ficha no Mapa de Calor">
              <Link
                href={`/leads/${encodeURIComponent(ag.lead_id)}`}
                className="inline-flex items-center gap-1 font-medium text-azul-claro hover:underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Abrir ficha do lead
              </Link>
            </Linha>
          )}

          {ag.agendado_em && (
            <Linha rotulo="Agendado em">
              <span className="text-texto-sec">
                {dataHora(ag.agendado_em)} ({tempoRelativo(ag.agendado_em)})
              </span>
            </Linha>
          )}
        </div>

        <AcoesDoAgendamento ag={ag} tamanho="md" className="border-t border-white/10 p-6" />
      </aside>
    </div>
  );
}
