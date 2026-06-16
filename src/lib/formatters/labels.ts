import type { Etapa } from "@/lib/api/contracts";
import { PRODUTOS_OFICIAIS, chaveDoProduto, etapaLabel } from "@/lib/formatters/score";

// ---------------------------------------------------------------------------
// DICIONÁRIO CENTRAL de exibição (raw → label PT). Único lugar para traduzir os
// valores crus que a API devolve (etapa, tier, produto, trava) — fix num lugar
// só. etapa/temperatura já têm casa em formatters/score.ts; aqui consolidamos o
// acesso e cobrimos tier/produto/trava que vazavam crus na UI.
// Qualquer valor desconhecido cai no humanizar (snake_case → "Snake case"),
// nunca quebra e fica fácil de mapear depois adicionando uma entrada abaixo.
// ---------------------------------------------------------------------------

export { etapaLabel };
export type { Etapa };

// snake_case / kebab → "Frase capitalizada" (fallback p/ raw sem entrada fixa).
export function humanizar(raw: string): string {
  const s = raw.trim().replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// Tier: mock usa A/B/C; a API real também manda "sem_qualificacao".
const TIER_LABEL: Record<string, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  sem_qualificacao: "Sem qualificação",
};
export function labelTier(raw: string | null | undefined): string {
  if (!raw) return "Sem tier";
  return TIER_LABEL[raw] ?? humanizar(raw);
}

// Produto: o lead manda produto_sugerido bare e em caixa variada ("private",
// "Black"...). Usa a MESMA derivação de chave da fila (chaveDoProduto) e cai na
// marca capitalizada. null quando não há produto.
const PRODUTO_LABEL: Record<string, string> = Object.fromEntries(
  PRODUTOS_OFICIAIS.map((p) => [p.chave, p.label]),
);
export function labelProduto(raw: string | null | undefined): string | null {
  const chave = chaveDoProduto(raw);
  if (!chave) return null;
  return PRODUTO_LABEL[chave] ?? humanizar(chave);
}

// Trava: o mock já manda frase legível ("2 no-shows — teto de 60 aplicado").
// Se a API mandar um código (snake_case, sem espaço), humaniza; frase passa.
export function labelTrava(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return /\s/.test(raw) ? raw : humanizar(raw);
}
