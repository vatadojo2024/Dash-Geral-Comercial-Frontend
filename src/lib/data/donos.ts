import type { LeadListItem } from "@/lib/api/contracts";
import { nomeDoUsuario } from "@/lib/mock/users";

// ---------------------------------------------------------------------------
// Opções dos filtros de Closer/SDR derivadas dos PRÓPRIOS leads carregados.
//
// Por que não usar a lista fixa de contas (CLOSERS/SDRS do mock): os ids do
// mock são slugs ("marcio", "benhur"), mas a API real manda closer_id/sdr_id
// como UUID. Um dropdown com slugs comparado contra UUIDs nunca casa → o filtro
// ZERAVA a lista. Derivar dos dados garante que o `value` da opção é exatamente
// o id que está nos leads (slug no mock, UUID na API), então o filtro reduz.
//
// O rótulo usa nomeDoUsuario: vira o nome quando o id é conhecido (mock) e cai
// no próprio id quando é um UUID desconhecido (API sem fonte de nomes ainda).
// ---------------------------------------------------------------------------

export type OpcaoDono = { id: string; nome: string };

function distintos(ids: (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function paraOpcoes(ids: string[]): OpcaoDono[] {
  return ids
    .map((id) => ({ id, nome: nomeDoUsuario(id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function opcoesDeDono(leads: LeadListItem[]): {
  closers: OpcaoDono[];
  sdrs: OpcaoDono[];
} {
  return {
    closers: paraOpcoes(distintos(leads.map((l) => l.closer_id))),
    sdrs: paraOpcoes(distintos(leads.map((l) => l.sdr_id))),
  };
}
