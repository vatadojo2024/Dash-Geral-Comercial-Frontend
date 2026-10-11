import { z } from "zod";
import { SemPermissaoError } from "@/lib/auth/semPermissao";

// ---------------------------------------------------------------------------
// Adapter ISOLADO do Dashboard de Produtividade SDR (DOCUMENTACAO.md).
// Consome o route handler /api/sdr-dashboard (server-side; modo mock|api via
// SDR_DASHBOARD_MODE) e aplica AS MESMAS regras de negócio do dashboard
// existente: aliases (5.1), produtos por substring (5.2), qualificados +
// bônus QC (5.3), metas escalonadas 40/50/60 (5.4), mês padrão (5.13) e
// no-show % (5.7). As regras da aba Liderança vivem em src/lib/sdr/lideranca.ts.
//
// REGRA DA META INDIVIDUAL (confirmada pelo Vata em 11/10/2026): reuniões de
// produto Ninja e QC NÃO contam para a meta — de NENHUM SDR, sem exceção e sem
// data de corte. Cada 3 QC ainda valem +1 (o "Bônus QC"):
//   contam_para_meta = (reuniões de todos os produtos − Ninja − QC) + ⌊QC/3⌋
// Produto por RÓTULO EXATO ("Ninja", "QC" ou "Quebrando Código"); produto
// desconhecido CONTA. O
// número de "qualificados" (bônus QC incluso) segue igual: é ele que alimenta a
// meta da EQUIPE e a comissão por reunião.
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

// 5.1 — aliases canônicos; nomes que não casam são descartados.
export const SDRS_DASHBOARD = ["Glaucio", "Delrue", "Benhur", "Arthur", "Hana"] as const;
export type SdrCanonico = (typeof SDRS_DASHBOARD)[number];

export function normalizarSdr(nome: string): SdrCanonico | null {
  const n = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("glaucio")) return "Glaucio";
  if (n.includes("delrue")) return "Delrue";
  if (n.includes("arthur") || n.includes("artur")) return "Arthur";
  if (n.includes("ben")) return "Benhur";
  if (n.includes("hana")) return "Hana";
  return null;
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

// 5.4 — metas escalonadas individuais; Hana não tem meta.
export const METAS_SDR: number[] = [40, 50, 60];

/** Metas próprias de quem não segue a escala padrão. */
export const METAS_POR_SDR: Partial<Record<SdrCanonico, number[]>> = {
  Arthur: [30, 40, 50],
};

// Rótulos (comparação EXATA, sem acento/caixa) que NÃO contam para a meta
// individual. O QC aparece também pelo nome completo ("Quebrando Código", como
// no mock e em meses antigos) — é o mesmo produto, não um produto novo.
// Qualquer outro rótulo — inclusive um produto novo — CONTA.
const ROTULOS_NINJA = new Set(["ninja"]);
const ROTULOS_QC = new Set(["qc", "quebrando codigo", "quebrando o codigo"]);

function rotuloExato(produto: string): string {
  return produto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function metasDoSdr(sdr: SdrCanonico): number[] | null {
  if (sdr === "Hana") return null;
  return METAS_POR_SDR[sdr] ?? METAS_SDR;
}

export type SdrMetrics = {
  sdr: SdrCanonico;
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
  /** O número que bate na meta INDIVIDUAL: (tudo − Ninja − QC) + ⌊QC/3⌋. */
  qualificadosMeta: number;
  /** Reuniões Ninja + QC do mês, que não contam direto para a meta. */
  foraDaMeta: number;
  /** O detalhe da conta da meta, para a tela mostrar: Ninja fora, QC fora, bônus. */
  metaDetalhe: { ninja: number; qc: number; bonusQC: number };
  /** null = sem meta (Hana) */
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

function somaPorSdr(
  linhas: { sdr: string; data_referencia: string; total: number }[],
  mes: string,
): Map<SdrCanonico, number> {
  const mapa = new Map<SdrCanonico, number>();
  for (const linha of linhas) {
    if (!linha.data_referencia.startsWith(mes)) continue;
    const sdr = normalizarSdr(linha.sdr);
    if (!sdr) continue;
    mapa.set(sdr, (mapa.get(sdr) ?? 0) + linha.total);
  }
  return mapa;
}

export function agregarDashboard(
  payload: SdrDashboardPayload,
  mes: string,
): SdrDashboard {
  const agendadas = somaPorSdr(payload.agendadas, mes);
  const realizadas = somaPorSdr(payload.realizadas, mes);
  const noShows = somaPorSdr(payload.no_show, mes);
  const remarcadas = somaPorSdr(payload.remarcadas, mes);

  const zerado = (): Record<ProdutoChave, number> => ({
    qc: 0,
    ninja: 0,
    black: 0,
    prime: 0,
    private: 0,
  });
  const produtosPorSdr = new Map<SdrCanonico, Record<ProdutoChave, number>>();
  // Conta da meta, por rótulo exato: o que conta direto, Ninja e QC à parte.
  const metaPorSdr = new Map<SdrCanonico, { contam: number; ninja: number; qc: number }>();
  for (const linha of payload.por_produto) {
    if (!linha.data_referencia.startsWith(mes)) continue;
    const sdr = normalizarSdr(linha.sdr);
    if (!sdr) continue;

    const meta = metaPorSdr.get(sdr) ?? { contam: 0, ninja: 0, qc: 0 };
    const rotulo = rotuloExato(linha.produto);
    if (ROTULOS_NINJA.has(rotulo)) meta.ninja += linha.total;
    else if (ROTULOS_QC.has(rotulo)) meta.qc += linha.total;
    else meta.contam += linha.total; // inclusive produto desconhecido
    metaPorSdr.set(sdr, meta);

    const chave = produtoChave(linha.produto);
    if (!chave) continue;
    const atual = produtosPorSdr.get(sdr) ?? zerado();
    atual[chave] += linha.total;
    produtosPorSdr.set(sdr, atual);
  }

  const sdrs: SdrMetrics[] = SDRS_DASHBOARD.map((sdr) => {
    const ag = agendadas.get(sdr) ?? 0;
    const re = realizadas.get(sdr) ?? 0;
    const ns = noShows.get(sdr) ?? 0;
    const produtos = produtosPorSdr.get(sdr) ?? zerado();
    const conta = metaPorSdr.get(sdr) ?? { contam: 0, ninja: 0, qc: 0 };

    // 5.3 — qualificados = Ninja+ + bônus de 1 a cada 3 QC
    const qualificadosBase =
      produtos.ninja + produtos.black + produtos.prime + produtos.private;
    const bonusQC = Math.floor(produtos.qc / 3);
    const qualificados = qualificadosBase + bonusQC;

    // Meta individual (todos os SDRs): Ninja e QC fora; cada 3 QC valem +1.
    const bonusQCMeta = Math.floor(conta.qc / 3);
    const qualificadosMeta = conta.contam + bonusQCMeta;
    const foraDaMeta = conta.ninja + conta.qc;

    // 5.4 — Hana é linha informativa, sem meta
    const metas = metasDoSdr(sdr);
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
      metaDetalhe: { ninja: conta.ninja, qc: conta.qc, bonusQC: bonusQCMeta },
      metas,
      metaAtual,
      nivelAtual,
      metasBatidas,
      gap,
    };
  });

  return { mes, periodoLabel: periodoDoMes(mes), sdrs };
}

// 7.1.4 — vendas do mês agrupadas por SDR canônico (aba Comissões)
export function vendasDoMesPorSdr(
  payload: SdrDashboardPayload,
  mes: string,
): Map<SdrCanonico, VendaSdr[]> {
  const mapa = new Map<SdrCanonico, VendaSdr[]>();
  for (const venda of payload.vendas_por_sdr ?? []) {
    if (!venda.data_referencia.startsWith(mes)) continue;
    const sdr = normalizarSdr(venda.sdr);
    if (!sdr) continue;
    const atual = mapa.get(sdr) ?? [];
    atual.push(venda);
    mapa.set(sdr, atual);
  }
  return mapa;
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

// Texto da conta da meta no card: "8 · 3 Ninja fora", "8 · 3 Ninja, 2 QC fora ·
// +0 bônus", "10 · nada fora". O bônus só aparece quando há QC.
export function notaDaMeta(m: Pick<SdrMetrics, "metaDetalhe">): string {
  const { ninja, qc, bonusQC } = m.metaDetalhe;
  const partes = [ninja > 0 ? `${ninja} Ninja` : null, qc > 0 ? `${qc} QC` : null].filter(Boolean);
  if (partes.length === 0) return "nada fora";
  return `${partes.join(", ")} fora${qc > 0 ? ` · +${bonusQC} bônus` : ""}`;
}
