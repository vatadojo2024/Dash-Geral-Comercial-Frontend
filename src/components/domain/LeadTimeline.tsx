import {
  BadgeCheck,
  Bot,
  CalendarClock,
  Circle,
  GitBranch,
  LogIn,
  MessageSquareText,
  Phone,
  RefreshCw,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { LeadEvent } from "@/lib/api/contracts";
import { dataHora, tempoRelativo } from "@/lib/formatters/date";

const ICONE_EVENTO: Record<LeadEvent["tipo"], LucideIcon> = {
  entrada: LogIn,
  analise_sdr: Bot,
  call_agendada: CalendarClock,
  call_realizada: Phone,
  analise_call: BadgeCheck,
  no_show: UserX,
  mensagem: MessageSquareText,
  mudanca_etapa: GitBranch,
  score_recalculado: RefreshCw,
};

// O "filme" do lead (lead_events), do mais recente para o mais antigo.
export function LeadTimeline({ eventos }: { eventos: LeadEvent[] }) {
  const ordenados = [...eventos].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return (
    <ol className="space-y-0">
      {ordenados.map((ev, i) => {
        const Icon = ICONE_EVENTO[ev.tipo] ?? Circle;
        return (
          <li key={ev.event_id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < ordenados.length - 1 && (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-32px)] w-px bg-borda/60"
                aria-hidden
              />
            )}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-borda bg-painel-claro">
              <Icon className="h-4 w-4 text-texto-sec" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm text-texto">{ev.descricao}</p>
              <p className="text-xs text-texto-sec/80">
                {dataHora(ev.occurred_at)} · {tempoRelativo(ev.occurred_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
