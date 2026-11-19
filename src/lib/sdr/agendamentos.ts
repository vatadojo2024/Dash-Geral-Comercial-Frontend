import { z } from "zod";
import { PRODUTOS_OFICIAIS, chaveDoProduto } from "@/lib/formatters/score";

// ---------------------------------------------------------------------------
// Aba "Calls por Ciclo" (Produtividade SDR). A fonte é o endpoint agregado
// GET /api/sdr/agendamentos (backend mapacalor-api), que já corta pelo ciclo
// (occurred_at, janela semi-aberta) e resolve SDR/closer/produto SEM escopo e
// SEM dado sensível. Aqui só validamos o contrato e montamos as matrizes.
// ---------------------------------------------------------------------------

// Contrato TOLERANTE do endpoint (nunca derruba a aba por um campo a mais/nulo).
export const AgendamentoSchema = z
  .object({
    lead_id: z.string(),
    nome_exibicao: z.string().nullish(),
    sdr_id: z.string().nullish(),
    sdr_nome: z.string().nullish(),
    closer_id: z.string().nullish(),
    closer_nome: z.string().nullish(),
    produto: z.string().nullish(),
    produto_variante: z.string().nullish(),
    agendado_em: z.string(),
    data_call: z.string().nullish(),
    resolvido: z.boolean().nullish(),
  })
  .passthrough();
export type Agendamento = z.infer<typeof AgendamentoSchema>;

export const AgendamentosResponseSchema = z.object({
  periodo: z.object({ inicio: z.string(), fim: z.string() }).nullish(),
  total: z.number().nullish(),
  agendamentos: z.array(AgendamentoSchema),
});
export type AgendamentosResponse = z.infer<typeof AgendamentosResponseSchema>;

export const SEM_CLOSER = "Sem closer";
export const SEM_SDR = "Sem SDR";
export const SEM_PRODUTO = "Sem produto";

// Colunas de produto na ordem de ticket (menor → maior) + "Sem produto".
export const COLUNAS_PRODUTO: { chave: string; label: string }[] = [
  ...PRODUTOS_OFICIAIS.map((p) => ({ chave: p.chave, label: p.label })),
  { chave: SEM_PRODUTO, label: SEM_PRODUTO },
];

const CHAVES_OFICIAIS = new Set<string>(PRODUTOS_OFICIAIS.map((p) => p.chave));

// Nome do SDR: nome legível → id (fallback) → "Sem SDR". (Hana já vem "Hana".)
export function nomeSdr(a: Agendamento): string {
  return a.sdr_nome?.trim() || a.sdr_id?.trim() || SEM_SDR;
}

// Nome do closer: nome legível → id (fallback) → "Sem closer".
export function nomeCloser(a: Agendamento): string {
  return a.closer_nome?.trim() || a.closer_id?.trim() || SEM_CLOSER;
}

// Produto → chave oficial (qc/ninja/black/prime/private) ou "Sem produto".
export function chaveProduto(a: Agendamento): string {
  const chave = chaveDoProduto(a.produto);
  return chave && CHAVES_OFICIAIS.has(chave) ? chave : SEM_PRODUTO;
}

// Rótulo do produto com variante para o drill-down ("Black Anual", "QC").
export function labelProdutoCompleto(a: Agendamento): string {
  const base = a.produto?.trim();
  if (!base) return SEM_PRODUTO;
  const variante = a.produto_variante?.trim();
  return variante ? `${base} ${variante}` : base;
}

export type ItemAgendado = {
  leadId: string;
  nome: string;
  sdr: string;
  closer: string;
  produtoChave: string;
  produtoLabel: string;
  quando: string;
};

export type Agregado = {
  sdrs: string[];
  closers: string[];
  matrizCloser: Record<string, Record<string, number>>;
  totalPorSdr: Record<string, number>;
  totalPorCloser: Record<string, number>;
  matrizProduto: Record<string, Record<string, number>>;
  totalProdutoPorSdr: Record<string, number>;
  totalPorProduto: Record<string, number>;
  resumoPorCloser: {
    closer: string;
    total: number;
    porProduto: Record<string, number>;
  }[];
  itens: ItemAgendado[];
  total: number;
};

// "Sem SDR"/"Sem closer" sempre por último; o resto em ordem alfabética pt-BR.
function ordenarComPlaceholderNoFim(nomes: Set<string>, placeholder: string): string[] {
  const lista = [...nomes].filter((n) => n !== placeholder);
  lista.sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (nomes.has(placeholder)) lista.push(placeholder);
  return lista;
}

export function agregarAgendamentos(agendamentos: Agendamento[]): Agregado {
  const itens: ItemAgendado[] = agendamentos.map((a) => ({
    leadId: a.lead_id,
    nome: a.nome_exibicao?.trim() || a.lead_id,
    sdr: nomeSdr(a),
    closer: nomeCloser(a),
    produtoChave: chaveProduto(a),
    produtoLabel: labelProdutoCompleto(a),
    quando: a.agendado_em,
  }));

  const sdrsSet = new Set<string>();
  const closersSet = new Set<string>();
  const matrizCloser: Record<string, Record<string, number>> = {};
  const matrizProduto: Record<string, Record<string, number>> = {};
  const totalPorSdr: Record<string, number> = {};
  const totalPorCloser: Record<string, number> = {};
  const totalProdutoPorSdr: Record<string, number> = {};
  const totalPorProduto: Record<string, number> = {};
  const porCloserProduto: Record<string, Record<string, number>> = {};

  for (const l of itens) {
    sdrsSet.add(l.sdr);
    closersSet.add(l.closer);

    (matrizCloser[l.sdr] ??= {})[l.closer] = (matrizCloser[l.sdr]?.[l.closer] ?? 0) + 1;
    (matrizProduto[l.sdr] ??= {})[l.produtoChave] =
      (matrizProduto[l.sdr]?.[l.produtoChave] ?? 0) + 1;

    totalPorSdr[l.sdr] = (totalPorSdr[l.sdr] ?? 0) + 1;
    totalPorCloser[l.closer] = (totalPorCloser[l.closer] ?? 0) + 1;
    totalProdutoPorSdr[l.sdr] = (totalProdutoPorSdr[l.sdr] ?? 0) + 1;
    totalPorProduto[l.produtoChave] = (totalPorProduto[l.produtoChave] ?? 0) + 1;

    (porCloserProduto[l.closer] ??= {})[l.produtoChave] =
      (porCloserProduto[l.closer]?.[l.produtoChave] ?? 0) + 1;
  }

  const sdrs = ordenarComPlaceholderNoFim(sdrsSet, SEM_SDR);
  const closers = ordenarComPlaceholderNoFim(closersSet, SEM_CLOSER);

  const resumoPorCloser = closers.map((closer) => ({
    closer,
    total: totalPorCloser[closer] ?? 0,
    porProduto: porCloserProduto[closer] ?? {},
  }));

  return {
    sdrs,
    closers,
    matrizCloser,
    totalPorSdr,
    totalPorCloser,
    matrizProduto,
    totalProdutoPorSdr,
    totalPorProduto,
    resumoPorCloser,
    itens,
    total: itens.length,
  };
}
