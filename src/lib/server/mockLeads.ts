import { z } from "zod";
import { LeadDetailSchema, type LeadDetail } from "@/lib/api/contracts";
import rawLeads from "@/lib/mock/data_clients.json";

// ---------------------------------------------------------------------------
// Fonte MOCK de leads no servidor (LEADS_MODE=mock). A regra de visibilidade
// por papel vem do helper ÚNICO src/lib/data/escopo.ts (leadNoEscopo) — o
// mesmo usado client-side por Fila, Ações e Agenda, sem divergência.
// ---------------------------------------------------------------------------

export { leadNoEscopo } from "@/lib/data/escopo";

let cache: LeadDetail[] | null = null;

export function todosOsLeadsMock(): LeadDetail[] {
  if (!cache) {
    cache = z.array(LeadDetailSchema).parse(rawLeads);
  }
  return cache;
}

// Escrita do destaque no MOCK (LEADS_MODE=mock): muta o cache em memória para
// que a marcação sobreviva enquanto o servidor de dev estiver de pé — dá para
// testar o ciclo completo (switch → PATCH → estrela → reordenação da fila) sem
// a API real. Some no restart; o data_clients.json não é reescrito de propósito.
export function marcarDestaqueMock(
  leadId: string,
  destaque: boolean,
  porUsuario: string,
): LeadDetail | null {
  const lead = todosOsLeadsMock().find((l) => l.lead_id === leadId);
  if (!lead) return null;
  lead.destaque = destaque;
  lead.destaque_por = destaque ? porUsuario : null;
  lead.destaque_em = destaque ? new Date().toISOString() : null;
  return lead;
}
