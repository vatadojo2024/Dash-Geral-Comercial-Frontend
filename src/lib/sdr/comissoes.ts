import { z } from "zod";
import { normalizarSdr, type SdrCanonico } from "@/lib/data/sdrDashboard";
import { PATAMARES_SDR, type ResultadoComissaoSdr } from "@/lib/salesops/comissaoSdr";

// ---------------------------------------------------------------------------
// Aba "Comissões" (Produtividade SDR). O TOTAL oficial do mês de cada SDR vem
// pronto do Financeiro via GET /api/sdr/comissoes?mes=AAAA-MM (backend
// mapacalor-api): reuniões + QC + vendas, com a parte de vendas sobre o CAIXA
// que entrou no mês. O front não recalcula esse total; só deriva a linha
// "Comissão de vendas" (total − reuniões − QC) e a projeção da próxima meta.
// SDR sem linha no mês = "sem comissão registrada" (nunca zero).
// ---------------------------------------------------------------------------

// Contrato TOLERANTE (campo a mais não derruba a aba); `comissao` é obrigatório.
export const ComissaoFinanceiroSchema = z
  .object({
    mes: z.string().nullish(),
    sdr: z.string(),
    comissao: z.number(),
  })
  .passthrough();
export type ComissaoFinanceiro = z.infer<typeof ComissaoFinanceiroSchema>;

export const ComissoesResponseSchema = z.object({
  mes: z.string(),
  atualizado_em: z.string().nullish(),
  comissoes: z.array(ComissaoFinanceiroSchema),
});
export type ComissoesResponse = z.infer<typeof ComissoesResponseSchema>;

// Códigos do 502 do backend → mensagem para a tela.
export const MENSAGEM_ERRO_FINANCEIRO: Record<string, string> = {
  financeiro_sem_token: "A integração com o Financeiro está sem credencial configurada. Avise o time técnico.",
  financeiro_auth: "O Financeiro recusou as credenciais da integração. Avise o time técnico.",
  financeiro_indisponivel: "O Financeiro não respondeu. Tente de novo em instantes.",
};

export function mensagemErroFinanceiro(codigo: unknown): string | null {
  return typeof codigo === "string" && Object.hasOwn(MENSAGEM_ERRO_FINANCEIRO, codigo)
    ? MENSAGEM_ERRO_FINANCEIRO[codigo]
    : null;
}

// Nome do Financeiro → SDR do dashboard. Linhas de outro mês ou de nome não
// reconhecido ficam de fora; duas linhas do mesmo SDR somam.
export function comissoesPorSdr(resposta: ComissoesResponse): Map<SdrCanonico, number> {
  const mapa = new Map<SdrCanonico, number>();
  for (const linha of resposta.comissoes) {
    if (linha.mes && linha.mes !== resposta.mes) continue;
    const sdr = normalizarSdr(linha.sdr);
    if (!sdr) continue;
    mapa.set(sdr, (mapa.get(sdr) ?? 0) + linha.comissao);
  }
  return mapa;
}

export type ProjecaoComissao = {
  meta: number;
  valorPorReuniao: number;
  taxaVenda: number;
  total: number;
};

export type NumerosComissao = {
  /** Total oficial do Financeiro; null = SDR sem linha no mês */
  total: number | null;
  /** total − reuniões − QC; null quando não há total ou a diferença é negativa */
  comissaoVendas: number | null;
  /** "Se bater a meta de X…"; null quando não dá para estimar o caixa */
  projecao: ProjecaoComissao | null;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

// Números de um card: total do backend + o que o patamar atual explica dele.
// O caixa do mês é estimado pela diferença ÷ taxa do patamar atual e
// recalculado na taxa/valor por reunião do próximo patamar.
export function numerosDoCard(
  resultado: ResultadoComissaoSdr,
  reunioesQualificadas: number,
  totalFinanceiro: number | undefined,
): NumerosComissao {
  if (resultado.semComissao || totalFinanceiro === undefined) {
    return { total: null, comissaoVendas: null, projecao: null };
  }
  const diferenca = centavos(totalFinanceiro - resultado.comissaoReunioes - resultado.bonusQC);
  if (diferenca < 0) return { total: totalFinanceiro, comissaoVendas: null, projecao: null };

  let projecao: ProjecaoComissao | null = null;
  if (resultado.proximaMeta && resultado.taxaVenda > 0) {
    const caixaEstimado = diferenca / resultado.taxaVenda;
    const proximo = PATAMARES_SDR[resultado.proximaMeta.patamar];
    projecao = {
      meta: resultado.proximaMeta.meta,
      valorPorReuniao: proximo.valorReuniao,
      taxaVenda: proximo.taxaVenda,
      total: centavos(
        reunioesQualificadas * proximo.valorReuniao +
          resultado.bonusQC +
          caixaEstimado * proximo.taxaVenda,
      ),
    };
  }
  return { total: totalFinanceiro, comissaoVendas: diferenca, projecao };
}

// "Total do time": só o que veio do Financeiro (sem linha não soma zero nem
// cálculo local).
export function totalDoTime(numeros: readonly NumerosComissao[]): number {
  return numeros.reduce((a, n) => a + (n.total ?? 0), 0);
}
