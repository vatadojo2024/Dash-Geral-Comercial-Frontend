// ---------------------------------------------------------------------------
// Cálculo de comissão dos closers (roadmap 6.2) — funções PURAS e testáveis.
//
// Regra progressiva e RETROATIVA:
//   - abaixo da Meta 1  → 3% (base)
//   - atingiu a Meta 1  → 5% sobre TODO o volume do mês
//   - atingiu a Meta 2  → 7% sobre TODO o volume do mês
// TRAVA DO CAIXA: taxas acima de 3% só valem se o cash collected for ≥ 65%
// do volume vendido; senão a taxa volta a 3%.
// ---------------------------------------------------------------------------

export const TAXA_BASE = 0.03;
export const TAXA_META1 = 0.05;
export const TAXA_META2 = 0.07;
export const MINIMO_CASH_PCT = 0.65;

export type EntradaComissao = {
  volumeVendido: number;
  cashCollected: number;
  meta1: number;
  meta2: number;
};

export type ResultadoComissao = {
  /** 0 = abaixo da Meta 1 · 1 = Meta 1 atingida · 2 = Meta 2 atingida */
  patamar: 0 | 1 | 2;
  /** Taxa que o volume garantiria (antes da trava do caixa) */
  taxaPorVolume: number;
  /** Taxa efetivamente aplicada (após a trava) */
  taxaVigente: number;
  travaDoCaixa: boolean;
  /** cash collected / volume vendido (1 quando não há volume) */
  percentualCash: number;
  comissao: number;
  motivo: string;
};

function pctBR(fracao: number): string {
  return `${(fracao * 100).toFixed(1).replace(".", ",")}%`;
}

export function calcularComissao(entrada: EntradaComissao): ResultadoComissao {
  const { volumeVendido, cashCollected, meta1, meta2 } = entrada;

  const patamar: 0 | 1 | 2 =
    volumeVendido >= meta2 ? 2 : volumeVendido >= meta1 ? 1 : 0;
  const taxaPorVolume =
    patamar === 2 ? TAXA_META2 : patamar === 1 ? TAXA_META1 : TAXA_BASE;

  const percentualCash = volumeVendido > 0 ? cashCollected / volumeVendido : 1;
  const travaDoCaixa = taxaPorVolume > TAXA_BASE && percentualCash < MINIMO_CASH_PCT;
  const taxaVigente = travaDoCaixa ? TAXA_BASE : taxaPorVolume;

  let motivo: string;
  if (travaDoCaixa) {
    motivo = `Trava do caixa: ${pctBR(percentualCash)} coletado, mínimo 65% — taxa reduzida a 3% (volume daria ${pctBR(taxaPorVolume)}).`;
  } else if (patamar === 2) {
    motivo = "Meta 2 atingida — 7% retroativos sobre todo o volume do mês.";
  } else if (patamar === 1) {
    motivo = "Meta 1 atingida — 5% retroativos sobre todo o volume do mês.";
  } else {
    motivo = "Abaixo da Meta 1 — taxa base de 3%.";
  }

  return {
    patamar,
    taxaPorVolume,
    taxaVigente,
    travaDoCaixa,
    percentualCash,
    comissao: volumeVendido * taxaVigente,
    motivo,
  };
}

export type Projecao = {
  volumeProjetado: number;
  cashProjetadoEstimado: number;
  resultado: ResultadoComissao;
};

// Projeção de cenário (ex.: "se fechar os quentes"): soma o valor adicional ao
// volume e PRESUME cash collected proporcional ao percentual atual — premissa
// que a tela deve sinalizar.
export function projetarComissao(
  atual: EntradaComissao,
  valorAdicional: number,
): Projecao {
  const ratio = atual.volumeVendido > 0 ? atual.cashCollected / atual.volumeVendido : 1;
  const volumeProjetado = atual.volumeVendido + valorAdicional;
  const cashProjetadoEstimado = volumeProjetado * ratio;
  return {
    volumeProjetado,
    cashProjetadoEstimado,
    resultado: calcularComissao({
      ...atual,
      volumeVendido: volumeProjetado,
      cashCollected: cashProjetadoEstimado,
    }),
  };
}
