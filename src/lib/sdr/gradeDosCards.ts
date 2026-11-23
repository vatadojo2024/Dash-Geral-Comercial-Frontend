// ---------------------------------------------------------------------------
// Grade dos cards por SDR (aba Dashboard SDR), no desktop (xl): até 4 cards,
// uma linha só; mais que isso, linhas equilibradas, nunca um card sozinho na
// última: 5 → 2 e 3, 6 → 3 e 3, 7 → 3 e 4, 8 → 4 e 4 (e assim por diante, com
// no máximo 4 por linha e as linhas maiores por último). A grade tem 12 colunas
// e cada card ocupa 12 ÷ (cards da linha), então cada linha ocupa a largura
// toda com cards de larguras iguais. Abaixo de xl, o comportamento de antes (1
// ou 2 colunas). Classes fixas: o Tailwind não enxerga classe montada.
// ---------------------------------------------------------------------------

export function linhasDosCards(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 4) return [n];
  const linhas = Math.ceil(n / 4);
  const base = Math.floor(n / linhas);
  const sobra = n % linhas;
  return Array.from({ length: linhas }, (_, i) => base + (i >= linhas - sobra ? 1 : 0));
}

// Até 4 cards: as colunas de antes (uma linha no desktop).
const ATE_QUATRO: Record<number, string> = {
  1: "grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 xl:grid-cols-4",
};

// Mesma altura em todos os cards (auto-rows-fr: as linhas ficam da altura da
// mais alta), também quando a linha de Produtos quebra em duas.
export function classeDaGrade(n: number): string {
  if (n <= 4) return `${ATE_QUATRO[Math.max(n, 1)]} auto-rows-fr`;
  return "lg:grid-cols-2 xl:grid-cols-12 auto-rows-fr";
}

const SPAN: Record<number, string> = { 2: "xl:col-span-6", 3: "xl:col-span-4", 4: "xl:col-span-3" };

// Classe do card de posição `i` (na ordem de sempre) numa grade de `n` cards.
export function classeDoCard(i: number, n: number): string {
  if (n <= 4) return "";
  let inicio = 0;
  for (const tamanho of linhasDosCards(n)) {
    if (i < inicio + tamanho) return SPAN[tamanho] ?? "";
    inicio += tamanho;
  }
  return "";
}
