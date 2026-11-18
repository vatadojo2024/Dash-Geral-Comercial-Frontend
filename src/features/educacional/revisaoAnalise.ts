import {
  CHECKPOINT_PARECE_CUMPRIDO,
  PILARES_ANALISE,
  type AnaliseAula,
  type Aula,
  type CheckpointSugerido,
  type DecisaoPilar,
  type PedidoDecisao,
  type PilarAnalise,
  type PilarSugerido,
  type PropostaAnalise,
  type ResumoAnaliseDaAula,
  type SituacaoAnalise,
} from "@/lib/educacional/contrato";
import { dataCurta, dataHoraBr } from "@/lib/educacional/rotulos";

// ---------------------------------------------------------------------------
// Apoio da tela de revisão da análise de aula com IA (16/11/2026). Nada aqui é
// regra de negócio: só o que precisa de decisão, se dá para aplicar e o corpo
// do "decidir". Notas, faixas e trechos vêm prontos (e validados) do backend.
// ---------------------------------------------------------------------------

export type EscolhaPilar = { decisao: "aprovar" | "editar" | "rejeitar"; nota?: string };
export type Decisoes = {
  pilares: Partial<Record<PilarAnalise, EscolhaPilar>>;
  checkpoints: Record<string, "aprovar" | "rejeitar">;
};
export const SEM_DECISOES: Decisoes = { pilares: {}, checkpoints: {} };

export const ROTULO_CONFIANCA = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
export const ROTULO_QUALIDADE = { boa: "boa", parcial: "parcial", insuficiente: "insuficiente" } as const;
const ROTULO_SITUACAO: Record<string, string> = {
  parece_cumprido: "Parece cumprido",
  em_andamento: "Em andamento",
  nao_abordado: "Não abordado",
};

// "risco_renovacao" → "Risco renovacao": código desconhecido aparece legível.
const legivel = (codigo: string) => {
  const t = codigo.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};
const ROTULO_ALERTA: Record<string, string> = {
  risco_renovacao: "Risco de renovação",
  risco_operacional: "Risco operacional",
  risco_cancelamento: "Risco de cancelamento",
};
export const rotuloDoAlerta = (tipo: string) => ROTULO_ALERTA[tipo] ?? legivel(tipo);
export const rotuloDaSituacao = (s: string) => ROTULO_SITUACAO[s] ?? legivel(s);

// Os três pilares na ordem da ficha (Consumiu não é avaliado aqui).
export function pilaresDaProposta(p: PropostaAnalise): (PilarSugerido & { pilar: PilarAnalise })[] {
  return PILARES_ANALISE.flatMap((k) => {
    const x = p.pilares.find((y) => y.pilar === k);
    return x ? [{ ...x, pilar: k }] : [];
  });
}
export const pilaresParaDecidir = (p: PropostaAnalise) => pilaresDaProposta(p).filter((x) => x.notaSugerida != null);
export const checkpointsParaDecidir = (p: PropostaAnalise): CheckpointSugerido[] =>
  p.checkpoints.filter((c) => c.situacao === CHECKPOINT_PARECE_CUMPRIDO);
export const checkpointsInformativos = (p: PropostaAnalise): CheckpointSugerido[] =>
  p.checkpoints.filter((c) => c.situacao !== CHECKPOINT_PARECE_CUMPRIDO);

// Nota do "editar": inteiro de 0 a 100, obrigatória.
export function notaValida(texto: string | undefined): number | null {
  if (!texto || !/^\d{1,3}$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return n >= 0 && n <= 100 ? n : null;
}

// O que ainda falta para "Aplicar decisões" (vazio = pode aplicar).
export function pendenciasDaRevisao(p: PropostaAnalise, d: Decisoes): string[] {
  const faltam: string[] = [];
  for (const x of pilaresParaDecidir(p)) {
    const e = d.pilares[x.pilar];
    if (!e) faltam.push(`pilar:${x.pilar}`);
    else if (e.decisao === "editar" && notaValida(e.nota) == null) faltam.push(`nota:${x.pilar}`);
  }
  for (const c of checkpointsParaDecidir(p)) if (!d.checkpoints[c.id]) faltam.push(`checkpoint:${c.id}`);
  return faltam;
}

export const temAlgoParaDecidir = (p: PropostaAnalise) => pilaresParaDecidir(p).length + checkpointsParaDecidir(p).length > 0;
export const podeAplicar = (p: PropostaAnalise, d: Decisoes) => temAlgoParaDecidir(p) && pendenciasDaRevisao(p, d).length === 0;

// Corpo do POST /analises/:id/decidir. Em "aprovar" e "rejeitar" a nota NÃO vai.
export function corpoDaDecisao(p: PropostaAnalise, d: Decisoes, versao: number, motivo?: string): PedidoDecisao {
  const pilares: DecisaoPilar[] = pilaresParaDecidir(p).map((x) => {
    const e = d.pilares[x.pilar]!;
    return e.decisao === "editar" ? { pilar: x.pilar, decisao: "editar", nota: notaValida(e.nota)! } : { pilar: x.pilar, decisao: e.decisao };
  });
  const checkpoints = checkpointsParaDecidir(p).map((c) => ({ id: c.id, decisao: d.checkpoints[c.id] }));
  const m = motivo?.trim();
  return { versao, pilares, checkpoints, ...(m ? { motivo: m } : {}) };
}

export const decidida = (a: AnaliseAula) => a.decidida_em != null;

// Quem decidiu: o nome que o backend manda ao lado do id; sem nome (usuário sem
// nome gravado ou removido), "alguém da equipe". O id nunca aparece.
export const quemDecidiu = (a: Pick<AnaliseAula, "decidida_por_nome">) => a.decidida_por_nome?.trim() || "alguém da equipe";
export const textoDaDecisao = (a: AnaliseAula) => `Análise decidida por ${quemDecidiu(a)} em ${dataHoraBr(a.decidida_em)}`;

// ---------------------------------------------------------------------------
// Situação da última análise de cada aula, na linha da tabela (backend f4154a5).
// ---------------------------------------------------------------------------

export const ROTULO_SITUACAO_ANALISE: Record<SituacaoAnalise, string> = {
  analisando: "Analisando",
  interrompida: "Interrompida",
  aguardando_decisao: "Aguardando decisão",
  decidida: "Decidida",
  erro: "Erro",
};

// A situação que o backend manda (40d18c8). Sem ela (o resumo da aula na ficha
// ainda não a traz), só a leitura direta do status: "interrompida" depende do
// backend, que é quem sabe há quanto tempo a análise está processando.
export function situacaoDe(
  r: { situacao?: SituacaoAnalise | null; status: string; decidida: boolean } | null | undefined,
): SituacaoAnalise | null {
  if (!r) return null;
  if (r.situacao) return r.situacao;
  if (r.decidida) return "decidida";
  if (r.status === "processando") return "analisando";
  return r.status === "pronta" ? "aguardando_decisao" : "erro";
}

export const resumoDaAnalise = (a: AnaliseAula): ResumoAnaliseDaAula => ({ id: a.id, status: a.status, decidida: decidida(a), situacao: a.situacao });

// O que a tela sabe da análise de cada aula, e desde quando. Chave `analise`
// AUSENTE = não carregado: fica o que a tela já tinha. `null` = sem análise.
export type ResumoConhecido = { resumo: ResumoAnaliseDaAula | null; em: number };
export function lembrarResumos(
  anterior: ReadonlyMap<string, ResumoConhecido>,
  aulas: Pick<Aula, "id" | "analise">[],
  em: number,
): Map<string, ResumoConhecido> {
  const m = new Map(anterior);
  for (const x of aulas) if (x.analise !== undefined) m.set(x.id, { resumo: x.analise, em });
  return m;
}

// Vale o mais novo: o resumo da ficha ou a lista da aula já buscada (painel aberto).
export function resumoNaTela(
  conhecido: ResumoConhecido | undefined,
  lista: { analises: AnaliseAula[] | undefined; em: number },
): ResumoAnaliseDaAula | null {
  const daLista = lista.analises ? (lista.analises[0] ? resumoDaAnalise(lista.analises[0]) : null) : undefined;
  if (daLista === undefined) return conhecido?.resumo ?? null;
  if (!conhecido) return daLista;
  return lista.em >= conhecido.em ? daLista : conhecido.resumo;
}

// ---------------------------------------------------------------------------
// Central de análises (backend 40d18c8).
// ---------------------------------------------------------------------------

// "Aula 7 · 14/11/2026"; sem número (aula arquivada depois da análise), só a data.
export function rotuloDaAulaDaAnalise(aula: { numero: number | null; data: string | null }): string {
  const data = aula.data ? dataCurta(aula.data) : null;
  if (aula.numero == null) return data ?? "Aula sem data";
  return data ? `Aula ${aula.numero} · ${data}` : `Aula ${aula.numero}`;
}

// Quem e quando, para as colunas "Enviada" e "Decidida" (o id nunca aparece).
export const quemEQuando = (nome: string | null, em: string | null) => `${nome?.trim() || "alguém da equipe"} · ${dataHoraBr(em)}`;

// Pode refazer: a análise travou (interrompida) ou terminou em erro.
export const podeRefazer = (s: SituacaoAnalise | null) => s === "interrompida" || s === "erro";
