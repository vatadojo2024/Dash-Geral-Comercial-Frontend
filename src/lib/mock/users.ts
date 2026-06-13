import type { Role, SessionUser } from "@/lib/api/contracts";

// As 9 contas reais do time (roadmap Parte 2) — usadas só no login mock.
// Pós-aprovação: substituídas por Supabase Auth + GET /api/me.
export const DEMO_ACCOUNTS: SessionUser[] = [
  { id: "vata", nome: "Vata", email: "contato@vatadojo.com.br", role: "admin" },
  { id: "cindy", nome: "Cindy", email: "cindy@vatadojo.com.br", role: "admin" },
  { id: "jonas", nome: "Jonas", email: "jonas@vatadojo.com.br", role: "admin" },
  { id: "marcio", nome: "Marcio", email: "marcio@vatadojo.com.br", role: "closer" },
  { id: "giba", nome: "Giba", email: "giba@vatadojo.com.br", role: "closer" },
  { id: "aurelio", nome: "Aurelio", email: "aurelio@vatadojo.com.br", role: "closer" },
  { id: "benhur", nome: "Benhur", email: "benhur@vatadojo.com.br", role: "sdr" },
  { id: "guilherme", nome: "Guilherme", email: "guilherme@vatadojo.com.br", role: "sdr" },
  { id: "glaucio", nome: "Glaucio", email: "glaucio@vatadojo.com.br", role: "sdr" },
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  closer: "Closer",
  sdr: "SDR",
};

export const CLOSERS = DEMO_ACCOUNTS.filter((a) => a.role === "closer");
export const SDRS = DEMO_ACCOUNTS.filter((a) => a.role === "sdr");

export function findAccountById(id: string): SessionUser | null {
  return DEMO_ACCOUNTS.find((a) => a.id === id) ?? null;
}

export function nomeDoUsuario(id: string | null): string {
  if (!id) return "—";
  return findAccountById(id)?.nome ?? id;
}
