import { z } from "zod";
import {
  EtapaSchema,
  LeadDetailSchema,
  TemperaturaSchema,
  TETOS_BLOCOS,
  type AnaliseResumo,
  type Etapa,
  type LeadDetail,
  type LeadEvent,
  type ScoreBreakdown,
} from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Adapter do GET /api/leads/:id REAL (mapacalor-api.infradojo.pro) → contrato
// do app (LeadDetailSchema). Mesma raiz do adapter da lista: o corpo real ≠ o
// shape do mock, então repassar cru fazia o Zod do client derrubar a tela
// ("Não foi possível carregar o lead") mesmo com 200 válido.
//
// Contrato real (campos NULL onde a API manda null — NADA disso pode quebrar):
//   { id, nome_exibicao, telefone, email, score_final, score_bruto,
//     score_momento, score_fit, score_urgencia, score_engajamento, score_timing,
//     trava_aplicada (null ok),
//     score_breakdown {
//       avisos[], blocos { fit, timing, momento, urgencia, engajamento },
//       alertas[], financeiro { ... }, teto_aplicado (null ok),
//       travas_ativas[], fonte_urgencia
//     },
//     temperatura, motivo_curto, proxima_acao, alertas[],
//     score_calculated_at, tier_final, produto_sugerido, produto_variante,
//     etapa_atual (null ok), next_call_at (null ok), link_crm (null ok),
//     analise_sdr { resumo_curto:null, sinais_positivos:null, sinais_de_risco:null },
//     analise_call (null ok),
//     timeline [ { event_type, occurred_at, etapa, call_at } ]  (pode ser vazia)
//   }
//
// Tudo o que é opcional/ausente vira default seguro; erro só em status != 2xx
// (tratado no route handler). Um campo opcional faltando é "ausente", não falha.
// ---------------------------------------------------------------------------

// Os 5 blocos reais (objeto pontos-por-bloco). Cada um é opcional/nullable: um
// bloco ausente conta como 0, não derruba o detalhe.
const ApiBlocosSchema = z
  .object({
    momento: z.number().nullish(),
    fit: z.number().nullish(),
    urgencia: z.number().nullish(),
    engajamento: z.number().nullish(),
    timing: z.number().nullish(),
  })
  .partial()
  .passthrough();

// analise_sdr / analise_call: TODOS os campos podem vir null (ou o bloco
// inteiro null). Note o nome real do campo: sinais_de_risco.
const ApiAnaliseSchema = z
  .object({
    resumo_curto: z.string().nullish(),
    sinais_positivos: z.array(z.string()).nullish(),
    sinais_de_risco: z.array(z.string()).nullish(),
    analisado_em: z.string().nullish(),
  })
  .passthrough()
  .nullish();

const ApiTimelineEventSchema = z
  .object({
    event_type: z.string().nullish(),
    occurred_at: z.string().nullish(),
    etapa: z.string().nullish(),
    call_at: z.string().nullish(),
  })
  .passthrough();

// Schema tolerante do corpo real: campos opcionais são .nullish() para que um
// null ou uma ausência nunca falhem o parse. O mapeamento abaixo aplica os
// defaults do contrato do app.
const ApiLeadDetailSchema = z
  .object({
    id: z.string(),
    nome_exibicao: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    score_final: z.number().min(0).max(100),
    score_bruto: z.number().min(0).max(100).nullish(),
    score_momento: z.number().nullish(),
    score_fit: z.number().nullish(),
    score_urgencia: z.number().nullish(),
    score_engajamento: z.number().nullish(),
    score_timing: z.number().nullish(),
    trava_aplicada: z.string().nullish(),
    score_breakdown: z
      .object({
        blocos: ApiBlocosSchema.nullish(),
        teto_aplicado: z.number().nullish(),
        travas_ativas: z.array(z.string()).nullish(),
      })
      .passthrough()
      .nullish(),
    temperatura: TemperaturaSchema,
    motivo_curto: z.string().nullish(),
    proxima_acao: z.string().nullish(),
    alertas: z.array(z.string()).nullish(),
    score_calculated_at: z.string().nullish(),
    tier_final: z.string().nullish(),
    produto_sugerido: z.string().nullish(),
    etapa_atual: z.string().nullish(),
    next_call_at: z.string().nullish(),
    link_crm: z.string().nullish(),
    // Posse: o backend passou a expor closer/sdr no detalhe. Tolerante ao nome do
    // campo (id ou nome) — a UI resolve via /api/usuarios (nome↔UUID) ou exibe
    // o valor como veio. Ausência → null ("Sem closer atribuído").
    closer_id: z.string().nullish(),
    sdr_id: z.string().nullish(),
    closer: z.string().nullish(),
    sdr: z.string().nullish(),
    sdr_pool: z.boolean().nullish(),
    last_activity_at: z.string().nullish(),
    analise_sdr: ApiAnaliseSchema,
    analise_call: ApiAnaliseSchema,
    timeline: z.array(ApiTimelineEventSchema).nullish(),
  })
  .passthrough();
type ApiLeadDetail = z.infer<typeof ApiLeadDetailSchema>;

function coagirEtapa(valor: string | null | undefined): Etapa | null {
  return valor && EtapaSchema.safeParse(valor).success ? (valor as Etapa) : null;
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

// Objeto {fit, timing, ...} → array do contrato, na ordem fixa dos 5 blocos,
// com os tetos reais. Sem itens (a API não os expõe neste contrato).
function mapBreakdown(api: ApiLeadDetail): ScoreBreakdown {
  const blocos = api.score_breakdown?.blocos ?? {};
  const blocosArray = (Object.keys(TETOS_BLOCOS) as (keyof typeof TETOS_BLOCOS)[]).map(
    (bloco) => {
      const teto = TETOS_BLOCOS[bloco];
      const pontos = typeof blocos[bloco] === "number" ? (blocos[bloco] as number) : 0;
      return { bloco, pontos: clamp(pontos, teto), teto, itens: [] };
    },
  );

  const teto = api.score_breakdown?.teto_aplicado;
  const travasAtivas = api.score_breakdown?.travas_ativas ?? [];
  const temTrava = (teto !== null && teto !== undefined) || travasAtivas.length > 0;
  const trava = temTrava
    ? {
        tipo: travasAtivas[0] ?? api.trava_aplicada ?? "trava",
        teto: teto ?? 0,
        motivo: travasAtivas.length
          ? `Travas ativas: ${travasAtivas.join(", ")}.`
          : "Trava aplicada ao score.",
      }
    : null;

  return { blocos: blocosArray, trava };
}

// analise_sdr/call → AnaliseResumo | null. Sem resumo nem sinais = sem análise
// (null) — exatamente o caso do contrato real (todos os campos null).
function mapAnalise(
  api: ApiLeadDetail["analise_sdr"],
  analisadoEmFallback: string,
): AnaliseResumo | null {
  if (!api) return null;
  const resumo = api.resumo_curto ?? "";
  const positivos = api.sinais_positivos ?? [];
  const risco = api.sinais_de_risco ?? [];
  if (!resumo && positivos.length === 0 && risco.length === 0) return null;
  return {
    resumo_curto: resumo,
    sinais_positivos: positivos,
    sinais_risco: risco,
    analisado_em: api.analisado_em ?? analisadoEmFallback,
  };
}

const TIPOS_EVENTO = new Set<LeadEvent["tipo"]>([
  "entrada",
  "analise_sdr",
  "call_agendada",
  "call_realizada",
  "analise_call",
  "no_show",
  "mensagem",
  "mudanca_etapa",
  "score_recalculado",
]);

function mapEvento(
  ev: z.infer<typeof ApiTimelineEventSchema>,
  idx: number,
): LeadEvent {
  const tipoBruto = ev.event_type ?? "";
  const tipo: LeadEvent["tipo"] = TIPOS_EVENTO.has(tipoBruto as LeadEvent["tipo"])
    ? (tipoBruto as LeadEvent["tipo"])
    : "mudanca_etapa";
  const occurred_at = ev.occurred_at ?? ev.call_at ?? "";
  const descricao =
    DESCRICAO_EVENTO[tipo] +
    (ev.etapa ? ` — ${ev.etapa}` : "") +
    (ev.call_at && tipo === "call_agendada" ? ` (${ev.call_at})` : "");
  return { event_id: `ev_${idx}`, tipo, descricao, occurred_at };
}

const DESCRICAO_EVENTO: Record<LeadEvent["tipo"], string> = {
  entrada: "Entrada do lead",
  analise_sdr: "Análise do SDR",
  call_agendada: "Call agendada",
  call_realizada: "Call realizada",
  analise_call: "Análise da call",
  no_show: "No-show",
  mensagem: "Mensagem",
  mudanca_etapa: "Mudança de etapa",
  score_recalculado: "Score recalculado",
};

function mapApiLeadDetail(api: ApiLeadDetail): LeadDetail {
  const scoreFinal = api.score_final;
  const scoreCalc = api.score_calculated_at ?? "";
  const timeline = (api.timeline ?? []).map(mapEvento);

  return {
    lead_id: api.id,
    nome_exibicao: api.nome_exibicao,
    score_final: scoreFinal,
    score_bruto: api.score_bruto ?? scoreFinal,
    temperatura: api.temperatura,
    etapa_atual: coagirEtapa(api.etapa_atual),
    score_momento: clamp(api.score_momento ?? 0, TETOS_BLOCOS.momento),
    score_fit: clamp(api.score_fit ?? 0, TETOS_BLOCOS.fit),
    score_urgencia: clamp(api.score_urgencia ?? 0, TETOS_BLOCOS.urgencia),
    score_engajamento: clamp(api.score_engajamento ?? 0, TETOS_BLOCOS.engajamento),
    score_timing: clamp(api.score_timing ?? 0, TETOS_BLOCOS.timing),
    trava_aplicada: api.trava_aplicada ?? null,
    motivo_curto: api.motivo_curto ?? "",
    proxima_acao: api.proxima_acao ?? "",
    alertas: api.alertas ?? [],
    tier_final: api.tier_final ?? "",
    produto_sugerido: api.produto_sugerido ?? null,
    // Posse: lê o que o backend mandar (id ou nome, sob qualquer um dos campos);
    // ausência → null e a UI mostra "Sem closer/SDR atribuído".
    closer_id: api.closer_id ?? api.closer ?? null,
    sdr_id: api.sdr_id ?? api.sdr ?? null,
    sdr_pool: api.sdr_pool ?? false,
    next_call_at: api.next_call_at ?? null,
    next_call_numero: null,
    score_calculated_at: scoreCalc,
    last_activity_at: api.last_activity_at ?? null,
    telefone: api.telefone ?? "",
    email: api.email ?? "",
    link_crm: api.link_crm ?? null,
    score_breakdown: mapBreakdown(api),
    resumo_analises: {
      sdr: mapAnalise(api.analise_sdr, scoreCalc),
      call: mapAnalise(api.analise_call, scoreCalc),
    },
    timeline,
  };
}

export type AdaptDetailResult =
  | { ok: true; lead: LeadDetail }
  | { ok: false; motivo: string };

/**
 * Converte o corpo (já parseado em JSON) do GET /api/leads/:id real para o
 * contrato do app (LeadDetailSchema). Loga no servidor o motivo exato de
 * qualquer divergência — diagnóstico sem mascarar, sem derrubar a tela por um
 * campo opcional ausente.
 */
export function adaptApiLeadDetail(corpo: unknown): AdaptDetailResult {
  const parsed = ApiLeadDetailSchema.safeParse(corpo);
  if (!parsed.success) {
    const motivo = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
      .join("; ");
    console.error("[/api/leads/:id] api 200 fora do contrato:", motivo);
    return { ok: false, motivo };
  }

  const mapeado = mapApiLeadDetail(parsed.data);
  const contrato = LeadDetailSchema.safeParse(mapeado);
  if (!contrato.success) {
    const motivo = contrato.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
      .join("; ");
    console.error(
      `[/api/leads/:id] (id=${parsed.data.id}) falhou no contrato do app após mapeamento:`,
      motivo,
    );
    return { ok: false, motivo };
  }

  return { ok: true, lead: contrato.data };
}
