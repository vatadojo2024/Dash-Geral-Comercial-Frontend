import type { SessionUser } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// FONTE ÚNICA da regra de visibilidade por papel (roadmap Parte 2). É a MESMA
// regra que o backend real aplica em GET /api/leads:
//   - admin  → todos os leads
//   - closer → só os dele (closer_id = ele)
//   - SDR    → os dele (sdr_id = ele) + o pool da Hana (sdr_pool = true)
//
// Usada server-side no route handler /api/leads (mock) E client-side, de forma
// defensiva, por Fila, Ações e Agenda — assim nenhuma tela pode divergir nem
// vazar lead de outro dono, mesmo que a fonte mude. Trabalha sobre o shape
// MÍNIMO de dono, então serve tanto LeadListItem quanto LeadDetail.
// ---------------------------------------------------------------------------

export type LeadComDono = {
  closer_id: string | null;
  sdr_id: string | null;
  sdr_pool: boolean;
};

export function leadNoEscopo(lead: LeadComDono, user: SessionUser): boolean {
  if (user.role === "admin") return true;
  if (user.role === "closer") return lead.closer_id === user.id;
  return lead.sdr_id === user.id || lead.sdr_pool;
}

export function filtrarPorEscopo<T extends LeadComDono>(
  leads: T[],
  user: SessionUser,
): T[] {
  return leads.filter((lead) => leadNoEscopo(lead, user));
}
