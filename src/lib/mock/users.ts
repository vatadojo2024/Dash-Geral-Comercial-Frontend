import type { Role, SessionUser } from "@/lib/api/contracts";
import { AREAS_DO_PAPEL } from "@/lib/auth/areas";

// No mock não há API: as áreas saem da reserva por papel (lib/auth/areas.ts).
function conta(id: string, nome: string, email: string, role: Role): SessionUser {
  return { id, nome, email, role, areas: [...AREAS_DO_PAPEL[role]] };
}

// As 9 contas reais do time (roadmap Parte 2) — usadas só no login mock.
// Pós-aprovação: substituídas por Supabase Auth + GET /api/me.
export const DEMO_ACCOUNTS: SessionUser[] = [
  conta("vata", "Vata", "contato@vatadojo.com.br", "admin"),
  conta("cindy", "Cindy", "cindy@vatadojo.com.br", "admin"),
  conta("jonas", "Jonas", "jonas@vatadojo.com.br", "admin"),
  conta("marcio", "Marcio", "marcio@vatadojo.com.br", "closer"),
  conta("giba", "Giba", "giba@vatadojo.com.br", "closer"),
  conta("aurelio", "Aurelio", "aurelio@vatadojo.com.br", "closer"),
  conta("benhur", "Benhur", "benhur@vatadojo.com.br", "sdr"),
  conta("guilherme", "Guilherme", "guilherme@vatadojo.com.br", "sdr"),
  conta("glaucio", "Glaucio", "glaucio@vatadojo.com.br", "sdr"),
];

// Contas SÓ de teste do login mock para os papéis sem ninguém do time ainda.
// Ficam fora de DEMO_ACCOUNTS para não aparecerem no diretório de usuários.
export const CONTAS_DE_TESTE: SessionUser[] = [
  conta("marketing", "Marketing (teste)", "marketing.teste@vatadojo.com.br", "marketing"),
  conta("educacional", "Educacional (teste)", "educacional.teste@vatadojo.com.br", "educacional"),
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  closer: "Closer",
  sdr: "SDR",
  marketing: "Marketing",
  educacional: "Educacional",
};

export const CLOSERS = DEMO_ACCOUNTS.filter((a) => a.role === "closer");
export const SDRS = DEMO_ACCOUNTS.filter((a) => a.role === "sdr");

export function findAccountById(id: string): SessionUser | null {
  return DEMO_ACCOUNTS.find((a) => a.id === id) ?? CONTAS_DE_TESTE.find((a) => a.id === id) ?? null;
}

// Traduz um id de dono em nome. Prioridade: mapa do diretório (/api/usuarios,
// onde os UUIDs reais resolvem) → conta conhecida do mock → o próprio id como
// fallback (não quebra). O mapa é opcional para manter as chamadas legadas.
export function nomeDoUsuario(
  id: string | null,
  mapa?: ReadonlyMap<string, string> | null,
): string {
  if (!id) return "—";
  return mapa?.get(id) ?? findAccountById(id)?.nome ?? id;
}
