import {
  CHECKPOINT_PARECE_CUMPRIDO,
  PILARES_ANALISE,
  type AnaliseAula,
  type CheckpointSugerido,
  type DecisaoPilar,
  type PedidoDecisao,
  type PilarAnalise,
  type PilarSugerido,
  type PropostaAnalise,
} from "@/lib/educacional/contrato";
import { dataHoraBr } from "@/lib/educacional/rotulos";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quem decidiu, sem nunca mostrar um id cru: o nome quando vem, "você" quando é
// a sessão atual; senão, "alguém da equipe".
export function quemDecidiu(por: AnaliseAula["decidida_por"], usuario: { id: string; nome?: string } | null): string {
  if (!por) return "alguém da equipe";
  const id = typeof por === "string" ? por : por.id;
  if (usuario && id === usuario.id) return "você";
  if (typeof por !== "string") return por.nome;
  return UUID.test(por) ? "alguém da equipe" : por;
}

export const decidida = (a: AnaliseAula) => a.decidida_em != null;

// Situação da análise mais recente de uma aula, para a linha da tabela.
export function situacaoDaAnalise(a: AnaliseAula | undefined, usuario: { id: string } | null): string | null {
  if (!a) return null;
  if (decidida(a)) return `Análise decidida por ${quemDecidiu(a.decidida_por, usuario)} em ${dataHoraBr(a.decidida_em)}`;
  if (a.status === "processando") return "Analisando a aula…";
  if (a.status === "erro") return "Análise com erro";
  return "Análise pronta para revisar";
}
