// ---------------------------------------------------------------------------
// Configuração do Sales Ops (roadmap 6.2 — doc oficial Vata, jun/2026).
// Metas MUDAM por mês: editar AQUI (nunca hard-coded em componente).
// ---------------------------------------------------------------------------

export type MetaMes = { m1: number; m2: number };

export const metasPorCloser: Record<string, MetaMes> = {
  aurelio: { m1: 260_000, m2: 320_000 },
  marcio: { m1: 260_000, m2: 320_000 },
  giba: { m1: 75_000, m2: 85_000 },
};

export type PrecoProduto = { avista: number; parcelado12x: number };

// Tabela oficial de preços (Vata, jun/2026)
export const precosProdutos: Record<string, PrecoProduto> = {
  qc: { avista: 1_997, parcelado12x: 206 },
  ninja_s: { avista: 7_000, parcelado12x: 720 },
  ninja_a: { avista: 12_000, parcelado12x: 1_250 },
  black_s: { avista: 25_000, parcelado12x: 2_600 },
  black_a: { avista: 44_000, parcelado12x: 4_600 },
  prime_s: { avista: 68_000, parcelado12x: 6_800 },
  prime_a: { avista: 98_000, parcelado12x: 9_800 },
  private_s: { avista: 120_000, parcelado12x: 12_000 },
  private_a: { avista: 180_000, parcelado12x: 18_000 },
};

// REGRA de projeção: o lead só tem o produto SEM variante (S/A), então a
// projeção usa o À VISTA da variante S (conservador).
export const valorProjecaoPorProdutoSugerido: Record<string, number> = {
  qc: 1_997,
  ninja: 7_000,
  black: 25_000,
  prime: 68_000,
  private: 120_000,
};

// produto_sugerido do lead ("QC", "Ninja", ...) → valor de projeção.
// Lead sem produto (null) não soma na projeção.
export function valorDeProjecao(
  produtoSugerido: string | null | undefined,
): number | null {
  if (!produtoSugerido) return null;
  const chave = produtoSugerido.trim().toLowerCase();
  return valorProjecaoPorProdutoSugerido[chave] ?? null;
}

// Nomenclatura oficial (7.1.3): as variantes S e A são EXIBIDAS como
// "Semestral" e "Anual" em todos os labels; as chaves internas (ninja_s,
// "Black A"...) permanecem como estão nos dados.
export function rotuloProduto(nome: string): string {
  return nome.replace(/ s$/i, " Semestral").replace(/ a$/i, " Anual");
}
