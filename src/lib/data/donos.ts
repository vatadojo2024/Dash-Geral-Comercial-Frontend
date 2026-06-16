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
// O rótulo usa nomeDoUsuario com o mapa do diretório (/api/usuarios): o value
// segue sendo o id exato do lead (para o filtro casar), mas o label vira o nome
// quando o id é conhecido (UUID no diretório ou conta do mock) e cai no próprio
// id quando não há fonte de nome — nunca quebra.
// ---------------------------------------------------------------------------

export type OpcaoDono = { id: string; nome: string };

function distintos(ids: (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function paraOpcoes(
  ids: string[],
  mapa?: ReadonlyMap<string, string> | null,
): OpcaoDono[] {
  return ids
    .map((id) => ({ id, nome: nomeDoUsuario(id, mapa) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function opcoesDeDono(
  leads: LeadListItem[],
  mapa?: ReadonlyMap<string, string> | null,
): {
  closers: OpcaoDono[];
  sdrs: OpcaoDono[];
} {
  return {
    closers: paraOpcoes(distintos(leads.map((l) => l.closer_id)), mapa),
    sdrs: paraOpcoes(distintos(leads.map((l) => l.sdr_id)), mapa),
  };
}
