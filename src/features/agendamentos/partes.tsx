"use client";

import { CalendarDays, Clock, ExternalLink, History, Video } from "lucide-react";
import {
  rotuloDoStatus,
  statusDaCall,
  urlDaSala,
  type AgendamentoPrimeiraCall,
  type StatusCall,
} from "@/lib/agendamentos/primeiraCall";
import { classesDoBotao } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Peças pequenas da tela de Agendamentos, no padrão do design system. Status é
// SEMPRE cor + ícone + texto (nunca só cor).
// ---------------------------------------------------------------------------

const ICONE_STATUS = { hoje: Clock, passada: History, futura: CalendarDays } as const;

// Tags do DS: hoje = warning (o destaque do painel), passada = tag neutra,
// futura = info.
const TAG_STATUS: Record<StatusCall, string> = {
  hoje: "tag-warning",
  passada: "opacity-70",
  futura: "tag-info",
};

export function StatusCallBadge({ ag, agora }: { ag: AgendamentoPrimeiraCall; agora: Date }) {
  const status = statusDaCall(ag, agora);
  const Icone = ICONE_STATUS[status];
  return (
    <span className={cn("tag shrink-0", TAG_STATUS[status])}>
      <Icone className="h-3 w-3" aria-hidden />
      {rotuloDoStatus(ag, agora)}
    </span>
  );
}

export function IconeDoStatus({ status, className }: { status: StatusCall; className?: string }) {
  const Icone = ICONE_STATUS[status];
  return <Icone className={className} aria-hidden />;
}

// Botões de ação do agendamento. "Abrir na Clint" só existe com `link_crm`
// (pode vir nulo: some só o botão, o item fica). "Abrir sala" só quando o link
// da call vira uma URL.
export function AcoesDoAgendamento({
  ag,
  tamanho = "sm",
  className,
}: {
  // Só os dois links: serve à fila e ao histórico de agendamentos.
  ag: Pick<AgendamentoPrimeiraCall, "link_call" | "link_crm">;
  tamanho?: "sm" | "md";
  className?: string;
}) {
  const sala = urlDaSala(ag.link_call);
  if (!sala && !ag.link_crm) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {sala && (
        <a
          href={sala}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={classesDoBotao({ variant: "primary", size: tamanho })}
        >
          <Video className="h-3.5 w-3.5" aria-hidden />
          Abrir sala
        </a>
      )}
      {ag.link_crm && (
        <a
          href={ag.link_crm}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={classesDoBotao({ variant: "secondary", size: tamanho })}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Abrir na Clint
        </a>
      )}
    </div>
  );
}
