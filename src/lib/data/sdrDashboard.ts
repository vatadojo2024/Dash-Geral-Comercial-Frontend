import { z } from "zod";
import { SemPermissaoError } from "@/lib/auth/semPermissao";

// ---------------------------------------------------------------------------
// Adapter ISOLADO do Dashboard de Produtividade SDR (DOCUMENTACAO.md).
// Consome o route handler /api/sdr-dashboard (server-side; modo mock|api via
// SDR_DASHBOARD_MODE) e aplica AS MESMAS regras de negócio do dashboard
// existente: produtos por substring (5.2), qualificados + bônus QC (5.3), mês
// padrão (5.13) e no-show % (5.7). Os SDRs e as metas do mês (5.1, 5.4) vêm da
// rota de operadores (montarTime). As regras da aba Liderança vivem em src/lib/sdr/lideranca.ts.
//
// REGRA DA META INDIVIDUAL (decisões do Vata, 11/10/2026), a partir de
// INICIO_REGRA_NINJA_QC (calls de 01/10/2026 em diante):
//   - Para quem tem `regra_ninja_qc` no mês (vem da rota), TODA reunião vale 1
//     para a meta — Ninja e QC inclusive (sem o "3 QC = 1").
//   - Para os demais SDRs, Ninja não conta para a meta e QC não conta direto:
//     contam_para_meta = (reuniões de todos os produtos − Ninja − QC) + ⌊QC/3⌋
//   - Ninja e QC reconhecidos por qualquer nome que os contenha ("Ninja Anual",
//     "Quebrando Código"); produto realmente novo CONTA.
// Meses anteriores ao corte NÃO mudam: seguem a regra antiga (Ninja vale 1, QC
// vale 1 a cada 3). O número de "qualificados" (bônus QC incluso) segue igual
// em qualquer mês: é ele que alimenta a meta da EQUIPE e a comissão por reunião.
// ---------------------------------------------------------------------------

const LinhaSdrSchema = z.object({
  sdr: z.string(),
  data_referencia: z.string(),
  total: z.number(),
});

const LinhaSdrProdutoSchema = LinhaSdrSchema.extend({ produto: z.string() });

const LinhaCloserSchema = z.object({
  closer: z.string(),
  data_referencia: z.string(),
  total: z.number(),
});

const LinhaCloserProdutoSchema = LinhaCloserSchema.extend({ produto: z.string() });

const LinhaMarketingSchema = z.object({
  data_referencia: z.string(),
  total: z.number(),
});

const LinhaQualificadoSchema = LinhaMarketingSchema.extend({
  qualificacao: z.string(),
});

// 7.1.4 — vendas do mês originadas dos agendamentos de cada SDR
export const VendaSdrSchema = z.object({
  sdr: z.string(),
  data_referencia: z.string(),
  produto: z.string(),
  // SEM .nonnegative(): a Dashboard Comercial manda ESTORNO como valor NEGATIVO
  // (decisão: estorno ABATE). O negativo flui e subtrai na soma do volume.
  valor: z.number(),
  // Linhas reais vêm agregadas por (data, produto): quantidade de vendas ≥ 1
  // (total_vendas nunca é negativo). Opcional p/ o mock antigo seguir válido.
  quantidade: z.number().int().positive().optional(),
});
export type VendaSdr = z.infer<typeof VendaSdrSchema>;

// Payload completo — espelho dos 12 endpoints da API externa (5 da aba SDR +
// 7 da Liderança). Os campos da liderança são opcionais: se a carga da
// liderança falhar no modo api, a aba SDR continua funcionando (erro isolado,
// regra 6.5g) e `lideranca_erro` carrega a mensagem.
export const SdrDashboardPayloadSchema = z.object({
  agendadas: z.array(LinhaSdrSchema),
  realizadas: z.array(LinhaSdrSchema),
  no_show: z.array(LinhaSdrSchema),
  por_produto: z.array(LinhaSdrProdutoSchema),
  remarcadas: z.array(LinhaSdrSchema),
  marketing_leads: z.array(LinhaMarketingSchema).optional(),
  marketing_qualificados: z.array(LinhaQualificadoSchema).optional(),
  closer_agendadas: z.array(LinhaCloserSchema).optional(),
  closer_realizadas: z.array(LinhaCloserSchema).optional(),
  closer_no_show: z.array(LinhaCloserSchema).optional(),
  closer_por_produto: z.array(LinhaCloserProdutoSchema).optional(),
  closer_remarcadas: z.array(LinhaCloserSchema).optional(),
  // Vendas atribuídas por SDR (aba Comissões). Opcional: a API externa ainda
  // não expõe — no modo api a aba mostra estado vazio até a integração.
  vendas_por_sdr: z.array(VendaSdrSchema).optional(),
  lideranca_erro: z.string().nullable().optional(),
});
export type SdrDashboardPayload = z.infer<typeof SdrDashboardPayloadSchema>;

// 5.1 — Os SDRs vêm da rota GET /api/sdr/operadores?mes=AAAA-MM (backend
// 4197783, docs/comercial-operadores.md): o nome do cadastro para exibir, os
// nomes externos para reconhecer o que chega da API externa, e as metas DO MÊS.
// Nenhum nome de SDR fica no código — salvo o pool (abaixo).
const FaixasSchema = z.tuple([z.number(), z.number(), z.number()]);
export type Faixas = z.infer<typeof FaixasSchema>;

export const OperadorSdrSchema = z.object({
  id: z.string(),
  nome: z.string(),
  nomes_externos: z.array(z.string()).default([]),
  /** null = não há meta que já valha no mês (NÃO é zero). */
  faixas: FaixasSchema.nullable(),
  meta_desde: z.string().nullable().default(null),
  /** Sinalizador: a regra Ninja/QC vale para a pessoa no mês (o cálculo é do front). */
  regra_ninja_qc: z.boolean().default(false),
});
export type OperadorSdr = z.infer<typeof OperadorSdrSchema>;

export const OperadoresDoMesSchema = z.object({
  mes: z.string(),
  metrica: z.string().optional(),
  equipe: z.object({ faixas: FaixasSchema.nullable(), meta_desde: z.string().nullable().default(null) }),
  operadores: z.array(OperadorSdrSchema),
  // A IA de agendamento (o "pool", hoje a Hana), separada dos operadores
  // (backend 7c75a94). null = "não sei quais nomes são da IA": nenhum nome é
  // tratado como dela (e as linhas dela entram no aviso de não identificadas).
  pool: z.object({ nome: z.string(), nomes_externos: z.array(z.string()) }).nullable().default(null),
});
export type OperadoresDoMes = z.infer<typeof OperadoresDoMesSchema>;

// Chave do pool nas métricas: fora dos cards e da tela de SDR, dentro da meta da EQUIPE.
export const POOL = "pool";

const comparavel = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// O time do mês: quem é SDR, como reconhecer o nome que vem de fora, o nome a
// exibir e as metas. `reconhecer` devolve o id do operador, POOL ou null (não
// identificado: quem chama conta e AVISA).
export type TimeSdr = {
  mes: string;
  operadores: OperadorSdr[];
  /** Meta da equipe do mês; null = sem meta definida. */
  equipe: number[] | null;
  reconhecer: (nome: string | null | undefined) => string | null;
  nomeDe: (id: string) => string;
  /** A rota mandou o pool (com os nomes da IA)? */
  temPool: boolean;
};

// Reconhecimento: sem acento e sem maiúsculas, contra o nome do cadastro e os
// nomes externos. Vale o nome INTEIRO; um nome parcial casa só se todas as
// palavras dele estão num nome aceito ("Lucio" → "Lucio Borges"). O contrato
// do backend casa por pedaço nos dois sentidos; aqui não, para um apelido curto
// ("Ben", "Ramos") não puxar "Ruben" ou "Pedro Ramos". Se o nome servir para
// mais de um operador, fica não identificado (não se chuta). O pool entra pelos
// nomes que a rota manda, com a mesma regra.
export function montarTime(o: OperadoresDoMes): TimeSdr {
  const palavrasDe = (lista: string[]) => lista.map(comparavel).filter(Boolean).map((n) => n.split(" "));
  const aceitos = [
    ...o.operadores.map((op) => ({ id: op.id, nomes: palavrasDe([op.nome, ...op.nomes_externos]) })),
    ...(o.pool ? [{ id: POOL, nomes: palavrasDe([o.pool.nome, ...o.pool.nomes_externos]) }] : []),
  ];
  const nomes = new Map(o.operadores.map((op) => [op.id, op.nome]));
  if (o.pool) nomes.set(POOL, o.pool.nome);
  const reconhecer = (nome: string | null | undefined): string | null => {
    if (!nome?.trim()) return null;
    const palavras = comparavel(nome).split(" ");
    const exatos = aceitos.filter((a) => a.nomes.some((n) => n.join(" ") === palavras.join(" ")));
    if (exatos.length) return exatos.length === 1 ? exatos[0].id : null;
    const parciais = aceitos.filter((a) => a.nomes.some((n) => palavras.every((p) => n.includes(p))));
    return parciais.length === 1 ? parciais[0].id : null;
  };
  return {
    mes: o.mes,
    operadores: o.operadores,
    equipe: o.equipe.faixas ? [...o.equipe.faixas] : null,
    reconhecer,
    nomeDe: (id) => nomes.get(id) ?? "SDR",
    temPool: Boolean(o.pool),
  };
}

// 5.2 — produtos canônicos por substring (sem acento, case-insensitive)
export type ProdutoChave = "qc" | "ninja" | "black" | "prime" | "private";
export const PRODUTO_ROTULO: Record<ProdutoChave, string> = {
  qc: "QC",
  ninja: "Ninja",
  black: "Black",
  prime: "Prime",
  private: "Private",
};

export function produtoChave(nome: string): ProdutoChave | null {
  const n = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("quebrando") || n === "qc" || n.includes("qc ")) return "qc";
  if (n.includes("ninja")) return "ninja";
  if (n.includes("black")) return "black";
  if (n.includes("prime")) return "prime";
  if (n.includes("private")) return "private";
  return null;
}

/**
 * Data da call (inclusive) a partir da qual vale a regra Ninja/QC da meta.
 * Antes dela, todos seguem a regra antiga — meses fechados não mudam.
 */
export const INICIO_REGRA_NINJA_QC = "2026-10-01";

// Regra que valeu para a conta da meta do mês (o card explica qual).
export type RegraDaMeta = "padrao" | "ninja_qc" | "anterior";

export type SdrMetrics = {
  /** Id do operador (da rota) ou POOL. É a chave; o nome a exibir é `nome`. */
  sdr: string;
  nome: string;
  /** Pool (Hana): fora dos cards, dentro da meta da equipe. */
  pool: boolean;
  callsAgendadas: number;
  callsRealizadas: number;
  callsRemarcadas: number;
  noShowCount: number;
  /** 0–100, 1 casa decimal */
  noShowPct: number;
  produtos: Record<ProdutoChave, number>;
  qualificadosBase: number;
  bonusQC: number;
  /** Qualificados do mês (Ninja+ e bônus QC). Alimenta a meta da EQUIPE. */
  qualificados: number;
  /** O número que bate na meta INDIVIDUAL (ver REGRA DA META no topo). */
  qualificadosMeta: number;
  /** Reuniões Ninja + QC do mês que não contam direto para a meta. */
  foraDaMeta: number;
  /** O detalhe da conta da meta, para a tela mostrar: Ninja fora, QC fora, bônus. */
  metaDetalhe: { ninja: number; qc: number; bonusQC: number; regra: RegraDaMeta };
  /** Faixas do mês; null = sem meta definida (ou o pool). */
  metas: number[] | null;
  metaAtual: number | null;
  nivelAtual: "M1" | "M2" | "M3" | null;
  metasBatidas: number;
  gap: number | null;
};

export type SdrDashboard = {
  mes: string;
  periodoLabel: string;
  sdrs: SdrMetrics[];
  /** Linhas do mês com um SDR que a dash não reconhece: ficam fora, e a tela avisa. */
  naoIdentificadas: number;
};

// --- Meses disponíveis (derivados das datas do payload) ---------------------

export function mesesDisponiveis(payload: SdrDashboardPayload): string[] {
  const meses = new Set<string>();
  for (const linha of [...payload.agendadas, ...payload.realizadas]) {
    meses.add(linha.data_referencia.slice(0, 7));
  }
  return [...meses].sort();
}

// 5.13 — mês corrente se houver dados; senão o último disponível.
export function mesPadrao(payload: SdrDashboardPayload, hojeISO: string): string {
  const meses = mesesDisponiveis(payload);
  const corrente = hojeISO.slice(0, 7);
  if (meses.includes(corrente)) return corrente;
  return meses[meses.length - 1] ?? corrente;
}

export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const texto = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function periodoDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return `01/${mm}/${ano} a ${ultimo}/${mm}/${ano}`;
}

// --- Agregação da aba "Dashboard SDR" ---------------------------------------

// Quantas linhas vieram com um nome de SDR que a tabela não reconhece. Elas não
// entram nos números, mas não somem caladas: a tela mostra a quantidade (nunca
// o nome, que pode ser o da Clint).
export function contarNaoIdentificadas<T extends { sdr: string }>(
  linhas: readonly T[],
  reconhecer: TimeSdr["reconhecer"],
  dentro: (l: T) => boolean = () => true,
): number {
  return linhas.filter((l) => dentro(l) && !reconhecer(l.sdr)).length;
}

function somaPorSdr(
  linhas: { sdr: string; data_referencia: string; total: number }[],
  mes: string,
  reconhecer: TimeSdr["reconhecer"],
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    if (!linha.data_referencia.startsWith(mes)) continue;
    const sdr = reconhecer(linha.sdr);
    if (!sdr) continue;
    mapa.set(sdr, (mapa.get(sdr) ?? 0) + linha.total);
  }
  return mapa;
}

export function agregarDashboard(
  payload: SdrDashboardPayload,
  mes: string,
  time: TimeSdr,
): SdrDashboard {
  const { reconhecer } = time;
  const agendadas = somaPorSdr(payload.agendadas, mes, reconhecer);
  const realizadas = somaPorSdr(payload.realizadas, mes, reconhecer);
  const noShows = somaPorSdr(payload.no_show, mes, reconhecer);
  const remarcadas = somaPorSdr(payload.remarcadas, mes, reconhecer);
  const operador = new Map(time.operadores.map((o) => [o.id, o]));
  const ninjaQC = (sdr: string) => operador.get(sdr)?.regra_ninja_qc === true;

  const zerado = (): Record<ProdutoChave, number> => ({
    qc: 0,
    ninja: 0,
    black: 0,
    prime: 0,
    private: 0,
  });
  const produtosPorSdr = new Map<string, Record<ProdutoChave, number>>();
  // Conta da meta: o que conta direto (1 cada), o "pote" de QC que vale 1 a
  // cada 3, e o que ficou fora (Ninja/QC) — só para a tela explicar.
  type ContaMeta = { contam: number; poteQC: number; ninjaFora: number; qcFora: number; regra: RegraDaMeta };
  const metaPorSdr = new Map<string, ContaMeta>();
  for (const linha of payload.por_produto) {
    if (!linha.data_referencia.startsWith(mes)) continue;
    const sdr = reconhecer(linha.sdr);
    if (!sdr) continue;

    const chave = produtoChave(linha.produto);
    const regraNova = linha.data_referencia.slice(0, 10) >= INICIO_REGRA_NINJA_QC;
    const regra: RegraDaMeta = !regraNova ? "anterior" : ninjaQC(sdr) ? "ninja_qc" : "padrao";
    const meta = metaPorSdr.get(sdr) ?? { contam: 0, poteQC: 0, ninjaFora: 0, qcFora: 0, regra };
    meta.regra = regra;
    if (regra === "ninja_qc") meta.contam += linha.total; // regra Ninja/QC: tudo vale 1
    else if (chave === "qc") {
      meta.poteQC += linha.total; // QC: 1 a cada 3, nas duas regras
      if (regra === "padrao") meta.qcFora += linha.total;
    } else if (chave === "ninja" && regra === "padrao") meta.ninjaFora += linha.total;
    else meta.contam += linha.total; // inclusive produto desconhecido
    metaPorSdr.set(sdr, meta);

    if (!chave) continue;
    const atual = produtosPorSdr.get(sdr) ?? zerado();
    atual[chave] += linha.total;
    produtosPorSdr.set(sdr, atual);
  }

  // Os operadores do mês, na ordem da rota, e o pool por último.
  const sdrs: SdrMetrics[] = [...time.operadores.map((o) => o.id), ...(time.temPool ? [POOL] : [])].map((sdr) => {
    const ag = agendadas.get(sdr) ?? 0;
    const re = realizadas.get(sdr) ?? 0;
    const ns = noShows.get(sdr) ?? 0;
    const produtos = produtosPorSdr.get(sdr) ?? zerado();
    const conta = metaPorSdr.get(sdr) ?? {
      contam: 0,
      poteQC: 0,
      ninjaFora: 0,
      qcFora: 0,
      regra: (mes >= INICIO_REGRA_NINJA_QC.slice(0, 7)
        ? ninjaQC(sdr) ? "ninja_qc" : "padrao"
        : "anterior") as RegraDaMeta,
    };

    // 5.3 — qualificados = Ninja+ + bônus de 1 a cada 3 QC
    const qualificadosBase =
      produtos.ninja + produtos.black + produtos.prime + produtos.private;
    const bonusQC = Math.floor(produtos.qc / 3);
    const qualificados = qualificadosBase + bonusQC;

    // Meta individual: ver REGRA DA META no topo do arquivo.
    const bonusQCMeta = Math.floor(conta.poteQC / 3);
    const qualificadosMeta = conta.contam + bonusQCMeta;
    const foraDaMeta = conta.ninjaFora + conta.qcFora;

    // 5.4 — faixas do mês, da rota; o pool não tem meta individual.
    const faixas = sdr === POOL ? null : (operador.get(sdr)?.faixas ?? null);
    const metas = faixas ? [...faixas] : null;
    const metasBatidas = metas ? metas.filter((m) => qualificadosMeta >= m).length : 0;
    const metaAtual = metas
      ? (metas.find((m) => qualificadosMeta < m) ?? metas[metas.length - 1])
      : null;
    const nivelAtual = metas
      ? ((`M${Math.min(metasBatidas + 1, metas.length)}`) as "M1" | "M2" | "M3")
      : null;
    const gap = metaAtual !== null ? Math.max(metaAtual - qualificadosMeta, 0) : null;

    return {
      sdr,
      nome: time.nomeDe(sdr),
      pool: sdr === POOL,
      callsAgendadas: ag,
      callsRealizadas: re,
      callsRemarcadas: remarcadas.get(sdr) ?? 0,
      noShowCount: ns,
      noShowPct: ag > 0 ? Math.round((ns / ag) * 1000) / 10 : 0,
      produtos,
      qualificadosBase,
      bonusQC,
      qualificados,
      qualificadosMeta,
      foraDaMeta,
      metaDetalhe: { ninja: conta.ninjaFora, qc: conta.qcFora, bonusQC: bonusQCMeta, regra: conta.regra },
      metas,
      metaAtual,
      nivelAtual,
      metasBatidas,
      gap,
    };
  });

  const doMes = (l: { data_referencia: string }) => l.data_referencia.startsWith(mes);
  const naoIdentificadas = [payload.agendadas, payload.realizadas, payload.no_show, payload.remarcadas, payload.por_produto].reduce(
    (a, linhas) => a + contarNaoIdentificadas(linhas, reconhecer, doMes),
    0,
  );
  return { mes, periodoLabel: periodoDoMes(mes), sdrs, naoIdentificadas };
}

// Vendas do mês com SDR não reconhecido (aba Comissões avisa).
export const vendasNaoIdentificadas = (payload: SdrDashboardPayload, mes: string, reconhecer: TimeSdr["reconhecer"]) =>
  contarNaoIdentificadas(payload.vendas_por_sdr ?? [], reconhecer, (v) => v.data_referencia.startsWith(mes));

// 7.1.4 — vendas do mês agrupadas por SDR canônico (aba Comissões)
export function vendasDoMesPorSdr(
  payload: SdrDashboardPayload,
  mes: string,
  reconhecer: TimeSdr["reconhecer"],
): Map<string, VendaSdr[]> {
  const mapa = new Map<string, VendaSdr[]>();
  for (const venda of payload.vendas_por_sdr ?? []) {
    if (!venda.data_referencia.startsWith(mes)) continue;
    const sdr = reconhecer(venda.sdr);
    if (!sdr) continue;
    const atual = mapa.get(sdr) ?? [];
    atual.push(venda);
    mapa.set(sdr, atual);
  }
  return mapa;
}

// O texto da regra no topo da aba, a partir dos dados do mês (era fixo:
// "meta escalonada individual 40/50/60 (Arthur 30/40/50)").
export function textoDasMetas(time: TimeSdr, mes: string): string {
  const grupos = new Map<string, string[]>();
  const semMeta: string[] = [];
  for (const o of time.operadores) {
    if (o.faixas) grupos.set(o.faixas.join("/"), [...(grupos.get(o.faixas.join("/")) ?? []), o.nome]);
    else semMeta.push(o.nome);
  }
  const metas = grupos.size
    ? `meta escalonada individual do mês: ${[...grupos].map(([f, nomes]) => `${f} (${nomes.join(", ")})`).join(", ")}`
    : "sem meta individual definida no mês";
  const sem = grupos.size && semMeta.length ? ` · sem meta definida: ${semMeta.join(", ")}` : "";
  let regra = "antes de out/2026, regra antiga de Ninja e QC";
  if (mes >= INICIO_REGRA_NINJA_QC.slice(0, 7)) {
    const ninja = time.operadores.filter((o) => o.regra_ninja_qc).map((o) => o.nome);
    regra = ninja.length
      ? `Ninja e QC contam 1 cada só para ${ninja.join(", ")}; para os demais, Ninja não conta e cada 3 QC valem +1`
      : "Ninja não conta e cada 3 QC valem +1";
  }
  return `${metas}${sem} · ${regra}`;
}

// 6.4a / item 6 — classes de status compartilhadas
export function corDoGap(gap: number): "verde" | "amarelo" | "vermelho" {
  if (gap <= 1) return "verde";
  if (gap <= 2) return "amarelo";
  return "vermelho";
}

// 5.7 — classificação do no-show
export function corDoNoShow(pct: number): "verde" | "amarelo" | "vermelho" {
  if (pct < 12) return "verde";
  if (pct <= 20) return "amarelo";
  return "vermelho";
}

// --- Fetch (única chamada; as agregações por mês são puras/client-side) -----

export async function fetchSdrPayload(): Promise<SdrDashboardPayload> {
  const res = await fetch("/api/sdr-dashboard");
  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 403) throw new SemPermissaoError(corpo?.error);
    throw new Error(corpo?.error ?? `Dashboard SDR respondeu ${res.status}`);
  }
  return SdrDashboardPayloadSchema.parse(await res.json());
}

// Dica do número de "Leads qualificados" no card (que é o que conta para a meta):
// "30 qualificados · 6 Ninja fora · 0 bônus QC" (30 − 6 + 0 = 24). Os números
// fecham a conta da meta. Arthur: "21 qualificados · 12 QC · Ninja e QC valem 1
// cada". Mês anterior a out/2026: "12 qualificados · 3 bônus QC · regra antiga".
export function detalheDosQualificados(m: MetricasDoCard): string {
  const p = partesDosQualificados(m);
  if (p.regra === "ninja_qc") return `${p.qualificados} qualificados · ${p.qcValem1} QC · Ninja e QC valem 1 cada`;
  if (p.regra === "anterior") {
    return `${p.qualificados} qualificados · ${p.bonusQC} bônus QC · regra antiga (antes de out/2026)`;
  }
  return `${p.qualificados} qualificados · ${p.ninjaFora} Ninja fora · ${p.bonusQC} bônus QC`;
}

type MetricasDoCard = Pick<SdrMetrics, "sdr" | "nome" | "pool" | "metas" | "qualificados" | "qualificadosBase" | "bonusQC" | "qualificadosMeta" | "produtos" | "metaDetalhe">;

// O número de "Leads qualificados" no card: o que conta para a meta (sem meta, o total).
export function qualificadosDoCard(m: MetricasDoCard): number {
  return m.pool ? m.qualificados : m.qualificadosMeta;
}

// Partes da conta do card, que sempre fecham: qualificados − ninjaFora + bonusQC +
// qcValem1 = número do card. Sem meta: o total (Ninja+ e bônus QC).
function partesDosQualificados(m: MetricasDoCard) {
  if (m.pool) {
    return { qualificados: m.qualificadosBase, ninjaFora: 0, bonusQC: m.bonusQC, qcValem1: 0, regra: m.metaDetalhe.regra };
  }
  const { ninja, bonusQC, regra } = m.metaDetalhe;
  if (regra === "ninja_qc") {
    return { qualificados: m.qualificadosMeta - m.produtos.qc, ninjaFora: 0, bonusQC: 0, qcValem1: m.produtos.qc, regra };
  }
  if (regra === "anterior") return { qualificados: m.qualificadosMeta - bonusQC, ninjaFora: 0, bonusQC, qcValem1: 0, regra };
  return { qualificados: m.qualificadosMeta - bonusQC + ninja, ninjaFora: ninja, bonusQC, qcValem1: 0, regra };
}

// Total do topo da aba: a soma dos cards, com a dica somada no mesmo formato. No
// mês da regra nova, o QC de quem conta 1 cada (Arthur) entra como parte própria.
export function totalDosQualificados(sdrs: MetricasDoCard[]): { total: number; detalhe: string } {
  const partes = sdrs.map(partesDosQualificados);
  const soma = (k: "qualificados" | "ninjaFora" | "bonusQC" | "qcValem1") => partes.reduce((a, p) => a + p[k], 0);
  const total = sdrs.reduce((a, m) => a + qualificadosDoCard(m), 0);
  if (partes.length > 0 && partes.every((p) => p.regra === "anterior")) {
    return { total, detalhe: `${soma("qualificados")} qualificados · ${soma("bonusQC")} bônus QC · regra antiga (antes de out/2026)` };
  }
  const nomes = sdrs.filter((_, i) => partes[i].qcValem1 > 0).map((m) => m.nome);
  const qc = soma("qcValem1") > 0 ? ` · ${soma("qcValem1")} QC que valem 1 (${nomes.join(", ")})` : "";
  return {
    total,
    detalhe: `${soma("qualificados")} qualificados · ${soma("ninjaFora")} Ninja fora · ${soma("bonusQC")} bônus QC${qc}`,
  };
}
