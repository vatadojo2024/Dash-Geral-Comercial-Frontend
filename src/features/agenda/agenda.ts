import type { LeadListItem } from "@/lib/api/contracts";
import { leadAtivo } from "@/features/dashboard/derivacoes";

// ---------------------------------------------------------------------------
// Agenda (roadmap Parte 7, decisão 3): derivada do PRÓPRIO banco (next_call_at
// dos leads visíveis ao papel), NÃO do Google Calendar. Funções puras.
// ---------------------------------------------------------------------------

export type DiaAgenda = {
  /** Data local yyyy-mm-dd */
  dia: string;
  /** "Hoje", "Amanhã" ou "sexta-feira · 19/06" */
  label: string;
  leads: LeadListItem[];
};

function dataLocalISO(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function rotuloDoDia(diaISO: string, hojeISO: string): string {
  if (diaISO === hojeISO) return "Hoje";
  const [ano, mes, dia] = hojeISO.split("-").map(Number);
  const amanha = dataLocalISO(new Date(ano, mes - 1, dia + 1));
  if (diaISO === amanha) return "Amanhã";
  const [a, m, d] = diaISO.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  const semana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  const curta = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${semana} · ${curta}`;
}

// Próximas calls do papel logado: só leads ATIVOS com next_call_at, ordenadas
// por data/hora e agrupadas por dia local. hojeISO injetado p/ testabilidade.
export function agruparAgenda(
  leads: LeadListItem[],
  hojeISO: string,
): DiaAgenda[] {
  const comCall = leads
    .filter((l) => leadAtivo(l) && l.next_call_at !== null)
    .sort((a, b) => a.next_call_at!.localeCompare(b.next_call_at!));

  const dias = new Map<string, LeadListItem[]>();
  for (const lead of comCall) {
    const dia = dataLocalISO(new Date(lead.next_call_at!));
    const atual = dias.get(dia) ?? [];
    atual.push(lead);
    dias.set(dia, atual);
  }

  return [...dias.entries()].map(([dia, doDia]) => ({
    dia,
    label: rotuloDoDia(dia, hojeISO),
    leads: doDia,
  }));
}

export function horaDaCall(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
