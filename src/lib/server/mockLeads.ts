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
