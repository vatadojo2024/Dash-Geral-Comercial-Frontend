// ---------------------------------------------------------------------------
// Comissão dos SDRs (roadmap 7.1.4 — regras oficiais jun/2026). Função PURA.
//
//  - Bônus por reunião: R$ por reunião QUALIFICADA realizada (lead compareceu
//    E foi qualificado). Conta as qualificadas SEM o bônus de meta.
//  - QC: R$ 20 a cada 3 calls QC (⌊qc/3⌋ × 20). NÃO confundir com o bônus de
//    meta "+1 qualificado a cada 3 QC", que vale só para definir o PATAMAR.
//  - Aceleradores RETROATIVOS pelo atingimento da meta individual (40/50/60):
//      abaixo da M1 → R$ 40/reunião + 0,7% por venda
//      atingiu M1   → R$ 60/reunião + 1,2% por venda
//      atingiu M2   → R$ 80/reunião + 1,8% por venda
//      atingiu M3   → R$ 100/reunião + 2,5% por venda
//    A taxa do patamar aplica sobre TODAS as reuniões e vendas do mês.
//  - Bônus por venda: % sobre o valor das vendas originadas dos agendamentos.
//  - Hana: sem comissão (linha informativa, fora dos totais).
// ---------------------------------------------------------------------------

export const PATAMARES_SDR = [
  { nivel: 0, valorReuniao: 40, taxaVenda: 0.007 },
  { nivel: 1, valorReuniao: 60, taxaVenda: 0.012 },
  { nivel: 2, valorReuniao: 80, taxaVenda: 0.018 },
  { nivel: 3, valorReuniao: 100, taxaVenda: 0.025 },
] as const;

export const BONUS_POR_TRES_QC = 20;

export type EntradaComissaoSdr = {
  /** Reuniões qualificadas realizadas (Ninja+), SEM o bônus de meta */
  reunioesQualificadas: number;
  /** Qualificados COM o bônus ⌊QC/3⌋ — é o número que bate na meta 40/50/60 */
  qualificadosParaMeta: number;
  /** Calls QC realizadas no mês */
  callsQC: number;
  /** Volume (R$) das vendas originadas dos agendamentos do SDR no mês */
  volumeVendas: number;
  /** Metas individuais escalonadas; null = sem comissão (Hana) */
  metas: number[] | null;
};

export type CenarioComissaoSdr = {
  patamar: 0 | 1 | 2 | 3;
  valorPorReuniao: number;
  taxaVenda: number;
  comissaoReunioes: number;
  bonusQC: number;
  comissaoVendas: number;
  total: number;
};

export type ResultadoComissaoSdr = CenarioComissaoSdr & {
  /** true para SDR sem meta/comissão (Hana) — valores zerados */
  semComissao: boolean;
  /** Projeção retroativa "se bater a próxima meta"; null no patamar máximo */
  proximaMeta: (CenarioComissaoSdr & { meta: number }) | null;
};

function cenario(
  entrada: EntradaComissaoSdr,
  patamar: 0 | 1 | 2 | 3,
): CenarioComissaoSdr {
  const regra = PATAMARES_SDR[patamar];
  const comissaoReunioes = entrada.reunioesQualificadas * regra.valorReuniao;
  const bonusQC = Math.floor(entrada.callsQC / 3) * BONUS_POR_TRES_QC;
  const comissaoVendas = entrada.volumeVendas * regra.taxaVenda;
  return {
    patamar,
    valorPorReuniao: regra.valorReuniao,
    taxaVenda: regra.taxaVenda,
    comissaoReunioes,
    bonusQC,
    comissaoVendas,
    total: comissaoReunioes + bonusQC + comissaoVendas,
  };
}

export function calcularComissaoSdr(
  entrada: EntradaComissaoSdr,
): ResultadoComissaoSdr {
  if (entrada.metas === null) {
    return {
      semComissao: true,
      patamar: 0,
      valorPorReuniao: 0,
      taxaVenda: 0,
      comissaoReunioes: 0,
      bonusQC: 0,
      comissaoVendas: 0,
      total: 0,
      proximaMeta: null,
    };
  }

  const metas = entrada.metas;
  const patamar = Math.min(
    metas.filter((m) => entrada.qualificadosParaMeta >= m).length,
    PATAMARES_SDR.length - 1,
  ) as 0 | 1 | 2 | 3;

  const atual = cenario(entrada, patamar);

  // Projeção retroativa: as MESMAS reuniões/vendas do mês, na taxa do próximo
  // patamar (é assim que o acelerador funciona — recalcula o mês inteiro).
  const proximaMeta =
    patamar < metas.length
      ? { meta: metas[patamar], ...cenario(entrada, (patamar + 1) as 1 | 2 | 3) }
      : null;

  return { semComissao: false, ...atual, proximaMeta };
}
