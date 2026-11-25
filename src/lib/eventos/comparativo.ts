import { z } from "zod";
import type { Role } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Aba "Eventos ao Vivo" (GET /api/eventos/comparativo?de&ate, backend eb4a332):
// a série do funil dos webinars WG, uma linha por evento. A API manda só
// CONTAGENS. Taxa, variação contra o evento anterior e média são calculadas
// aqui, e é aqui que se decide o que vira travessão.
//
// Princípio do contrato: não medido é NULO, nunca zero. Por isso quase toda
// contagem aceita null, e null nunca vira 0%.
// ---------------------------------------------------------------------------

/** Só o admin vê a aba (o backend responde 403 para os demais papéis). */
export function podeVerEventosAoVivo(role: Role | null | undefined): boolean {
  return role === "admin";
}

// ─── Contrato (backend de93b17, docs/eventos-comparativo.md §6) ─────────────
// Nulo SÓ onde o contrato diz que pode vir nulo, e cada nulo tem um sentido:
//   ao_vivo/total.assistiram e presentes_por_tier → a presença não foi medida;
//   *.agendaram → não há 1ª call registrada na janela (primeiras_calls = 0);
//   replay / resgate (bloco) → não houve replay / campanha;
//   retencao → modo aproximado.
// `aplicaram` nunca é nulo (a tag de pós-evento é permanente). Um campo fora
// disso torna o evento inválido: ele é descartado e logado, não vira número.

const RE_DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const contagem = z.number().int().nonnegative();

const EtapasSchema = z.object({
  assistiram: contagem.nullable(),
  aplicaram: contagem,
  agendaram: contagem.nullable(),
});
const ReplaySchema = z.object({
  acessaram: contagem,
  assistiram: contagem,
  aplicaram: contagem,
  agendaram: contagem.nullable(),
});
const ResgateSchema = z.object({
  convidados: contagem,
  assistiram: contagem,
  aplicaram: contagem,
  agendaram: contagem.nullable(),
});

export const EventoComparativoSchema = z.object({
  data_evento: z.string().regex(RE_DATA),
  tag: z.string(),
  modo_presenca: z.enum(["exato", "aproximado"]),
  janela_fechada: z.boolean(),
  /** < 50 inscritos: fora das médias, da tendência e da comparação com o anterior. */
  base_insuficiente: z.boolean(),
  capturado_em: z.string().nullable(),
  atualizado_em: z.string().nullable(),
  inscritos: contagem,
  desqualificados: contagem,
  /** 1ªs calls na janela, em toda a base. 0 com a janela fechada explica os agendaram nulos. */
  primeiras_calls_na_janela: contagem,
  ao_vivo: EtapasSchema,
  replay: ReplaySchema.nullable(),
  total: EtapasSchema,
  resgate: ResgateSchema.nullable(),
  retencao: z.record(z.string(), contagem).nullable(),
  presentes_por_tier: z.record(z.string(), contagem).nullable(),
  avisos: z.array(z.string()),
});
export type Evento = z.infer<typeof EventoComparativoSchema>;

const EnvelopeSchema = z.object({
  de: z.string().nullable().default(null),
  ate: z.string().nullable().default(null),
  eventos: z.array(z.unknown()),
  gerado_em: z.string().nullable().default(null),
});

export type Comparativo = {
  de: string | null;
  ate: string | null;
  gerado_em: string | null;
  /** Do mais RECENTE para o mais antigo (a ordem da tabela). */
  eventos: Evento[];
  /** Quantos eventos vieram fora do contrato e foram descartados. */
  descartados: number;
};

export class ContratoComparativoError extends Error {}

// Valida o envelope (fora dele, a tela não tem o que mostrar) e cada evento à
// parte: o evento inválido sai da lista e vai para o console, sem quebrar a tela.
export function adaptarComparativo(json: unknown): Comparativo {
  const env = EnvelopeSchema.safeParse(json);
  if (!env.success) {
    const i = env.error.issues[0];
    throw new ContratoComparativoError(
      `Resposta de /api/eventos/comparativo fora do contrato: ${i?.path.join(".")} — ${i?.message}`,
    );
  }
  const eventos: Evento[] = [];
  let descartados = 0;
  env.data.eventos.forEach((bruto, posicao) => {
    const r = EventoComparativoSchema.safeParse(bruto);
    if (!r.success) {
      descartados += 1;
      const tag = (bruto as { tag?: unknown } | null)?.tag;
      const i = r.error.issues[0];
      console.warn(
        `[eventos-ao-vivo] evento descartado (posição ${posicao}${typeof tag === "string" ? `, ${tag}` : ""}): ${i?.path.join(".")} — ${i?.message}`,
      );
      return;
    }

    eventos.push(r.data);
  });
  eventos.sort((a, b) => b.data_evento.localeCompare(a.data_evento));
  return { de: env.data.de, ate: env.data.ate, gerado_em: env.data.gerado_em, eventos, descartados };
}

// ─── Taxa ───────────────────────────────────────────────────────────────────

export type Taxa =
  | { tipo: "pct"; valor: number } // 0 a 100
  | { tipo: "nao_medido" } // numerador ou denominador nulo
  | { tipo: "sem_base" } // denominador zero
  | { tipo: "acima" }; // mais de 100%: sinal de base errada, nunca um número

export function taxa(numerador: number | null | undefined, denominador: number | null | undefined): Taxa {
  if (numerador == null || denominador == null) return { tipo: "nao_medido" };
  if (denominador === 0) return { tipo: "sem_base" };
  if (numerador > denominador) return { tipo: "acima" };
  return { tipo: "pct", valor: (numerador / denominador) * 100 };
}

export const TRAVESSAO = "—";
export const DICA_NAO_MEDIDO = "não medido neste evento";
export const DICA_SEM_BASE = "sem base: o denominador é zero";
export const DICA_ACIMA = "acima de 100%: a etapa tem mais gente que a anterior, verificar a base";

/**
 * Dica do agendaram nulo. Com a janela fechada e nenhuma 1ª call registrada na
 * janela, o motivo é conhecido (não há registro daquela semana) e vale dizê-lo.
 */
export function dicaAgendamentoNulo(e: Evento): string {
  return e.janela_fechada && e.primeiras_calls_na_janela === 0
    ? `${DICA_NAO_MEDIDO}: nenhuma 1ª call registrada na janela`
    : DICA_NAO_MEDIDO;
}

// Inteiro a partir de 10%, uma casa abaixo. Decide pelo valor já arredondado:
// 9,96% é "10%", não "10,0%".
export function formatarPct(v: number): string {
  const casas = Number(v.toFixed(1)) >= 10 ? 0 : 1;
  return `${v.toFixed(casas).replace(".", ",")}%`;
}

/** Texto e dica de uma taxa: travessão para não medido e sem base, alerta acima de 100%. */
export function textoDaTaxa(t: Taxa): { texto: string; dica: string | null; alerta: boolean } {
  switch (t.tipo) {
    case "pct":
      return { texto: formatarPct(t.valor), dica: null, alerta: false };
    case "nao_medido":
      return { texto: TRAVESSAO, dica: DICA_NAO_MEDIDO, alerta: false };
    case "sem_base":
      return { texto: TRAVESSAO, dica: DICA_SEM_BASE, alerta: false };
    case "acima":
      return { texto: "⚠", dica: DICA_ACIMA, alerta: true };
  }
}

// ─── Métricas ───────────────────────────────────────────────────────────────

export type ChaveMetrica =
  | "inscritos"
  | "assistiram"
  | "aplicaram"
  | "agendaram"
  | "presenca"
  | "levantaram"
  | "agendamento";

export type Metrica = {
  chave: ChaveMetrica;
  rotulo: string;
  tipo: "contagem" | "taxa";
  /** Número de agendamento: "em andamento" com a janela aberta. */
  agendamento: boolean;
  /** Medida pela presença: aproximada no modo aproximado. */
  dependeDaPresenca: boolean;
};

export const METRICAS: Record<ChaveMetrica, Metrica> = {
  inscritos: { chave: "inscritos", rotulo: "Inscritos", tipo: "contagem", agendamento: false, dependeDaPresenca: false },
  assistiram: { chave: "assistiram", rotulo: "Assistiram ao vivo", tipo: "contagem", agendamento: false, dependeDaPresenca: true },
  aplicaram: { chave: "aplicaram", rotulo: "Levantaram a mão", tipo: "contagem", agendamento: false, dependeDaPresenca: false },
  agendaram: { chave: "agendaram", rotulo: "Agendaram", tipo: "contagem", agendamento: true, dependeDaPresenca: false },
  presenca: { chave: "presenca", rotulo: "Presença", tipo: "taxa", agendamento: false, dependeDaPresenca: true },
  levantaram: { chave: "levantaram", rotulo: "Levantaram a mão (taxa)", tipo: "taxa", agendamento: false, dependeDaPresenca: true },
  agendamento: { chave: "agendamento", rotulo: "Agendamento", tipo: "taxa", agendamento: true, dependeDaPresenca: false },
};

/** As taxas do bloco ao vivo (as dos cards e do gráfico). */
export function taxasAoVivo(e: Evento): { presenca: Taxa; levantaram: Taxa; agendamento: Taxa } {
  return {
    presenca: taxa(e.ao_vivo.assistiram, e.inscritos),
    levantaram: taxa(e.ao_vivo.aplicaram, e.ao_vivo.assistiram),
    agendamento: taxa(e.ao_vivo.agendaram, e.ao_vivo.aplicaram),
  };
}

/** Contagem de uma métrica de contagem (null = não medido). */
export function contagemDe(e: Evento, chave: ChaveMetrica): number | null {
  switch (chave) {
    case "inscritos":
      return e.inscritos;
    case "assistiram":
      return e.ao_vivo.assistiram;
    case "aplicaram":
      return e.ao_vivo.aplicaram;
    case "agendaram":
      return e.ao_vivo.agendaram;
    default:
      return null;
  }
}

export function taxaDe(e: Evento, chave: ChaveMetrica): Taxa {
  const t = taxasAoVivo(e);
  if (chave === "presenca") return t.presenca;
  if (chave === "levantaram") return t.levantaram;
  if (chave === "agendamento") return t.agendamento;
  return { tipo: "nao_medido" };
}

/**
 * O valor numérico de uma métrica num evento, para média, variação e gráfico:
 * a contagem, ou a taxa em %. null quando não há número (não medido, sem base
 * ou acima de 100%).
 */
export function valorDe(e: Evento, chave: ChaveMetrica): number | null {
  if (METRICAS[chave].tipo === "contagem") return contagemDe(e, chave);
  const t = taxaDe(e, chave);
  return t.tipo === "pct" ? t.valor : null;
}

/** Taxas de cada bloco (tabela). Resgate: cada degrau sobre o anterior, a partir dos convidados. */
export function taxasDoBloco(e: Evento) {
  return {
    aoVivo: taxasAoVivo(e),
    replay: {
      assistiram: taxa(e.replay?.assistiram, e.replay?.acessaram),
      aplicaram: taxa(e.replay?.aplicaram, e.replay?.assistiram),
      agendaram: taxa(e.replay?.agendaram, e.replay?.aplicaram),
    },
    total: {
      aplicaram: taxa(e.total.aplicaram, e.total.assistiram),
      agendaram: taxa(e.total.agendaram, e.total.aplicaram),
    },
    resgate: {
      assistiram: taxa(e.resgate?.assistiram, e.resgate?.convidados),
      aplicaram: taxa(e.resgate?.aplicaram, e.resgate?.assistiram),
      agendaram: taxa(e.resgate?.agendaram, e.resgate?.aplicaram),
    },
  };
}

// ─── Evento anterior, variação e média ──────────────────────────────────────

/**
 * O evento imediatamente anterior ao dado (lista do mais recente ao mais
 * antigo). Evento com base insuficiente não conta como evento: é pulado. Se o
 * anterior não tiver o dado, a variação é travessão, sem buscar um mais antigo.
 */
export function eventoAnterior(eventos: Evento[], evento: Evento): Evento | null {
  const i = eventos.findIndex((e) => e.data_evento === evento.data_evento);
  if (i < 0) return null;
  return eventos.slice(i + 1).find((e) => !e.base_insuficiente) ?? null;
}

export type Variacao =
  | { tipo: "pp"; valor: number } // taxa: pontos percentuais
  | { tipo: "pct"; valor: number } // contagem: variação relativa
  | { tipo: "indisponivel"; motivo: string };

/** Diferença entre dois valores da métrica: p.p. para taxa, % para contagem. */
export function diferenca(chave: ChaveMetrica, atual: number | null, referencia: number | null, motivoSemReferencia: string): Variacao {
  if (atual == null) return { tipo: "indisponivel", motivo: DICA_NAO_MEDIDO };
  if (referencia == null) return { tipo: "indisponivel", motivo: motivoSemReferencia };
  if (METRICAS[chave].tipo === "taxa") return { tipo: "pp", valor: atual - referencia };
  if (referencia === 0) return { tipo: "indisponivel", motivo: "a referência é zero" };
  return { tipo: "pct", valor: ((atual - referencia) / referencia) * 100 };
}

export type ModoPresenca = Evento["modo_presenca"];
export const DICA_MODOS_DIFERENTES = "medições diferentes: exata × aproximada";
const NOME_DO_MODO: Record<ModoPresenca, string> = { exato: "exata", aproximado: "aproximada" };

/**
 * Presença exata e aproximada NÃO se comparam: a aproximada é um teto (a tag
 * não tem data e conta quem assistiu a eventos anteriores), a exata é medida.
 * Vale para as métricas que dependem da presença (`dependeDaPresenca`).
 */
function mesmaMedicao(chave: ChaveMetrica, a: Evento, b: Evento): boolean {
  return !METRICAS[chave].dependeDaPresenca || a.modo_presenca === b.modo_presenca;
}

export function variacaoContraAnterior(eventos: Evento[], evento: Evento, chave: ChaveMetrica): Variacao {
  if (evento.base_insuficiente) return { tipo: "indisponivel", motivo: "base insuficiente: fora das comparações" };
  const anterior = eventoAnterior(eventos, evento);
  if (!anterior) return { tipo: "indisponivel", motivo: "sem evento anterior no período" };
  if (!mesmaMedicao(chave, evento, anterior)) return { tipo: "indisponivel", motivo: DICA_MODOS_DIFERENTES };
  return diferenca(chave, valorDe(evento, chave), valorDe(anterior, chave), "o evento anterior não tem este dado");
}

/** Evento que entra na média: janela fechada e base suficiente. */
export function entraNaMedia(e: Evento): boolean {
  return e.janela_fechada && !e.base_insuficiente;
}

export type Media = { valor: number | null; eventos: number };

/**
 * Média sobre os eventos VISÍVEIS (os 12 mais recentes, ou todos em "ver
 * todos"): só os de janela fechada e base suficiente, e os nulos (e as taxas sem
 * número) ficam de fora. Para taxa, é a média simples das taxas de cada evento
 * (cada webinar pesa igual). `eventos` = quantos entraram; null = nenhum.
 */
export function mediaDe(eventos: Evento[], valor: (e: Evento) => number | null): Media {
  const valores = eventos
    .filter(entraNaMedia)
    .map(valor)
    .filter((v): v is number => v != null);
  if (valores.length === 0) return { valor: null, eventos: 0 };
  return { valor: valores.reduce((s, v) => s + v, 0) / valores.length, eventos: valores.length };
}

/** Os eventos de um modo de presença (todos, quando `modo` é null). */
export function doModo(eventos: Evento[], modo: ModoPresenca | null): Evento[] {
  return modo ? eventos.filter((e) => e.modo_presenca === modo) : eventos;
}

/**
 * Média de uma métrica. Nas que dependem da presença, só entram eventos do
 * `modo` dado (o do evento selecionado); nas demais, todos.
 */
export function mediaDaMetrica(visiveis: Evento[], chave: ChaveMetrica, modo: ModoPresenca | null): Media {
  const base = METRICAS[chave].dependeDaPresenca ? doModo(visiveis, modo) : visiveis;
  return mediaDe(base, (e) => valorDe(e, chave));
}

/**
 * A média contra a qual o evento é comparado. Nas métricas de presença, é a dos
 * eventos do MESMO modo, e precisa de pelo menos um OUTRO evento desse modo com
 * o dado: comparar o evento só consigo mesmo não diz nada.
 */
export function mediaParaComparar(visiveis: Evento[], evento: Evento, chave: ChaveMetrica): Media & { motivo: string | null } {
  if (!METRICAS[chave].dependeDaPresenca) return { ...mediaDaMetrica(visiveis, chave, null), motivo: null };
  const outros = mediaDe(
    visiveis.filter((e) => e.data_evento !== evento.data_evento && e.modo_presenca === evento.modo_presenca),
    (e) => valorDe(e, chave),
  );
  if (outros.eventos === 0) {
    return { valor: null, eventos: 0, motivo: `sem outros eventos com presença ${NOME_DO_MODO[evento.modo_presenca]} na tela` };
  }
  return { ...mediaDaMetrica(visiveis, chave, evento.modo_presenca), motivo: null };
}

/** A taxa como número (para média), ou null quando ela não tem número. */
export function pctOuNulo(t: Taxa): number | null {
  return t.tipo === "pct" ? t.valor : null;
}

export function comparacaoComMedia(visiveis: Evento[], evento: Evento, chave: ChaveMetrica): Variacao {
  if (evento.base_insuficiente) return { tipo: "indisponivel", motivo: "base insuficiente: fora das comparações" };
  const media = mediaParaComparar(visiveis, evento, chave);
  if (media.motivo) return { tipo: "indisponivel", motivo: media.motivo };
  return diferenca(chave, valorDe(evento, chave), media.valor, "nenhum evento com este dado na tela");
}

/** A variação pode ser pintada de queda/alta? Agendamento com a janela aberta, não. */
export function variacaoColorivel(evento: Evento, chave: ChaveMetrica): boolean {
  return !(METRICAS[chave].agendamento && !evento.janela_fechada);
}

// O valor como aparece na tela (inteiro a partir de 10, senão uma casa). Sinal e
// cor seguem o valor ARREDONDADO: −0,04 p.p. é "0,0 p.p.", sem cor de queda.
function arredondada(valor: number): number {
  const casas = Math.abs(valor) >= 10 ? 0 : 1;
  const r = Number(valor.toFixed(casas));
  return Object.is(r, -0) ? 0 : r;
}

/** -1 queda, 0 estável, 1 alta (pelo valor exibido); null quando não há variação. */
export function sentidoDaVariacao(v: Variacao): -1 | 0 | 1 | null {
  if (v.tipo === "indisponivel") return null;
  return Math.sign(arredondada(v.valor)) as -1 | 0 | 1;
}

export function textoDaVariacao(v: Variacao): string {
  if (v.tipo === "indisponivel") return TRAVESSAO;
  const r = arredondada(v.valor);
  const sinal = r > 0 ? "+" : r < 0 ? "−" : "";
  const abs = Math.abs(r);
  const n = abs.toFixed(Math.abs(v.valor) >= 10 ? 0 : 1).replace(".", ",");
  return v.tipo === "pp" ? `${sinal}${n} p.p.` : `${sinal}${n}%`;
}

/** Valor da média formatado (contagem com uma casa, taxa em %). */
export function textoDaMedia(chave: ChaveMetrica, valor: number | null): string {
  if (valor == null) return TRAVESSAO;
  if (METRICAS[chave].tipo === "taxa") return formatarPct(valor);
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

// ─── Gráfico de tendência ───────────────────────────────────────────────────

export type PontoTendencia = {
  data: string;
  rotulo: string;
  modo: ModoPresenca;
  /** null = vão na linha (sem número neste evento). */
  valor: number | null;
  /**
   * O mesmo valor partido por modo de presença, para as métricas que dependem
   * dela: cada modo é uma linha própria, e a linha nunca liga um ponto exato a
   * um aproximado. Nas demais métricas, ambos são null (vale `valor`).
   */
  valorExato: number | null;
  valorAproximado: number | null;
  janelaAberta: boolean;
};

/** Do mais antigo ao mais recente, sem os eventos de base insuficiente. */
export function serieDeTendencia(eventos: Evento[], chave: ChaveMetrica): PontoTendencia[] {
  const porModo = METRICAS[chave].dependeDaPresenca;
  return eventos
    .filter((e) => !e.base_insuficiente)
    .slice()
    .reverse()
    .map((e) => {
      const valor = valorDe(e, chave);
      return {
        data: e.data_evento,
        rotulo: rotuloData(e.data_evento),
        modo: e.modo_presenca,
        valor,
        valorExato: porModo && e.modo_presenca === "exato" ? valor : null,
        valorAproximado: porModo && e.modo_presenca === "aproximado" ? valor : null,
        janelaAberta: !e.janela_fechada,
      };
    });
}

export function rotuloData(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

// ─── Retenção ───────────────────────────────────────────────────────────────

/** Degraus da curva (chaves em segundos, como no contrato). */
export const DEGRAUS_RETENCAO = [300, 900, 1800, 2700, 4500, 6300, 8100] as const;

export type CurvaRetencao = { data: string; rotulo: string; pontos: (number | null)[] };

/**
 * Uma curva por evento EXATO com retenção (aproximado não tem régua de tempo, e
 * misturar as duas réguas enganaria). Cada degrau em % dos presentes ao vivo.
 * Degrau ausente ou acima de 100% fica sem número (vão).
 */
export function curvasDeRetencao(eventos: Evento[]): CurvaRetencao[] {
  return eventos
    .filter((e) => e.modo_presenca === "exato" && e.retencao)
    .slice()
    .reverse()
    .map((e) => ({
      data: e.data_evento,
      rotulo: rotuloData(e.data_evento),
      pontos: DEGRAUS_RETENCAO.map((s) => {
        const t = taxa(e.retencao?.[String(s)] ?? null, e.ao_vivo.assistiram);
        return t.tipo === "pct" ? t.valor : null;
      }),
    }));
}

// ─── Presentes por tier ─────────────────────────────────────────────────────

export const ORDEM_TIERS = ["UMQL+", "UMQL", "HMQL", "SMQL", "MQL+", "MQL", "QC", "Ninja", "sem_tier"] as const;
const SMQL_OU_ACIMA = new Set(["UMQL+", "UMQL", "HMQL", "SMQL"]);

export type TiersDoEvento = {
  linhas: { tier: string; rotulo: string; n: number; smqlOuAcima: boolean }[];
  smqlOuAcima: number;
  total: number;
  taxaSmqlOuAcima: Taxa;
};

/** null quando a presença não foi medida. Tier desconhecido entra no fim, na ordem em que veio. */
export function tiersDoEvento(e: Evento): TiersDoEvento | null {
  const p = e.presentes_por_tier;
  if (!p) return null;
  const chaves = [
    ...ORDEM_TIERS.filter((t) => t in p),
    ...Object.keys(p).filter((t) => !(ORDEM_TIERS as readonly string[]).includes(t)),
  ];
  const linhas = chaves.map((t) => ({
    tier: t,
    rotulo: t === "sem_tier" ? "Sem tier" : t,
    n: p[t] ?? 0,
    smqlOuAcima: SMQL_OU_ACIMA.has(t),
  }));
  const total = linhas.reduce((s, l) => s + l.n, 0);
  const smql = linhas.filter((l) => l.smqlOuAcima).reduce((s, l) => s + l.n, 0);
  return { linhas, smqlOuAcima: smql, total, taxaSmqlOuAcima: taxa(smql, total) };
}

// ─── Seleção padrão e recorte ───────────────────────────────────────────────

export const EVENTOS_VISIVEIS = 12;

/** O evento selecionado por padrão: o mais recente com base suficiente (ou o mais recente). */
export function eventoPadrao(eventos: Evento[]): Evento | null {
  return eventos.find((e) => !e.base_insuficiente) ?? eventos[0] ?? null;
}
