import { z } from "zod";
import {
  EtapaSchema,
  LeadListItemSchema,
  TemperaturaSchema,
  type Etapa,
  type LeadListItem,
} from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Adapter do GET /api/leads REAL (mapacalor-api.infradojo.pro) → contrato do
// app (LeadListItemSchema). A API real responde uma lista ENXUTA:
//   { "leads": [ { id, nome_exibicao, etapa_atual (null ok), score_final,
//                  temperatura, motivo_curto, proxima_acao, alertas,
//                  next_call_at (null ok), no_show_count } ] }
// Os campos de cálculo (blocos do score), posse (closer_id/sdr_id) e detalhe
// (telefone, produto, trava) NÃO vêm na lista — só no detalhe. Por isso este
// schema NÃO os exige; o mapeamento preenche defaults seguros para o contrato.
// Tolerância: cada lead é validado isoladamente — um lead fora do formato é
// logado e descartado, NUNCA derruba a fila inteira.
// ---------------------------------------------------------------------------

const ApiLeadSchema = z.object({
  id: z.string(),
  // Pode ser o e-mail do lead quando o nome não veio — segue sendo uma string
  // válida e renderiza normalmente (o card trunca).
  nome_exibicao: z.string(),
  // etapa_atual PODE ser null; aceitamos qualquer string e coagimos para o
  // enum no mapeamento (uma etapa inesperada da API vira null, não quebra).
  etapa_atual: z.string().nullable().default(null),
  score_final: z.number().min(0).max(100),
  temperatura: TemperaturaSchema,
  motivo_curto: z.string().default(""),
  proxima_acao: z.string().default(""),
  alertas: z.array(z.string()).default([]),
  next_call_at: z.string().nullable().default(null), // PODE ser null
  no_show_count: z.number().int().nonnegative().default(0),
  // Campos ENRIQUECIDOS da lista real (quando presentes). A lista antiga era
  // enxuta e não os trazia; descartá-los fazia o filtro de produto ZERAR a
  // lista (todo lead com produto_sugerido=null) e, para closer/SDR, o escopo
  // client-side esvaziar a fila (closer_id/sdr_id sempre null). Lê-los quando
  // a API os envia; ausência cai no default seguro (compatível com a enxuta).
  score_bruto: z.number().min(0).max(100).nullish(),
  produto_sugerido: z.string().nullish(),
  closer_id: z.string().nullish(),
  sdr_id: z.string().nullish(),
  // Nomes legíveis do dono (backend casa com a tabela users). Ausência/null → a
  // UI cai no id; sdr_nome nulo no caso Hana/pool.
  closer_nome: z.string().nullish(),
  sdr_nome: z.string().nullish(),
  sdr_pool: z.boolean().nullish(),
  trava_aplicada: z.string().nullish(),
  tier_final: z.string().nullish(),
  next_call_numero: z.number().int().positive().nullish(),
  score_calculated_at: z.string().nullish(),
  last_activity_at: z.string().nullish(),
});
type ApiLead = z.infer<typeof ApiLeadSchema>;

const ApiLeadsResponseSchema = z.object({
  // Envelope real: { leads: [...] }. Validamos lead a lead depois.
  leads: z.array(z.unknown()),
});

function mapApiLead(api: ApiLead): LeadListItem {
  const etapa: Etapa | null =
    api.etapa_atual && EtapaSchema.safeParse(api.etapa_atual).success
      ? (api.etapa_atual as Etapa)
      : null;

  return {
    lead_id: api.id,
    nome_exibicao: api.nome_exibicao,
    score_final: api.score_final,
    score_bruto: api.score_bruto ?? api.score_final,
    temperatura: api.temperatura,
    etapa_atual: etapa,
    // Blocos do score só existem no detalhe — neutros na lista.
    score_momento: 0,
    score_fit: 0,
    score_urgencia: 0,
    score_engajamento: 0,
    score_timing: 0,
    trava_aplicada: api.trava_aplicada ?? null,
    motivo_curto: api.motivo_curto,
    proxima_acao: api.proxima_acao,
    alertas: api.alertas,
    tier_final: api.tier_final ?? "",
    // Produto sugerido alimenta o filtro de produto (heatmap e fila). Quando a
    // API o envia, normalizamos para a chave canônica; ausência = null (neutro).
    produto_sugerido: api.produto_sugerido ?? null,
    closer_id: api.closer_id ?? null,
    closer_nome: api.closer_nome ?? null,
    sdr_id: api.sdr_id ?? null,
    sdr_nome: api.sdr_nome ?? null,
    sdr_pool: api.sdr_pool ?? false,
    next_call_at: api.next_call_at,
    next_call_numero: api.next_call_numero ?? null,
    // A API real pode não expor o instante do cálculo na lista; vazio é tratado
    // de forma segura por tempoRelativo (mostra "—").
    score_calculated_at: api.score_calculated_at ?? "",
    last_activity_at: api.last_activity_at ?? null,
  };
}

export type AdaptResult =
  | { ok: true; items: LeadListItem[] }
  | { ok: false; motivo: string };

/**
 * Converte o corpo (já parseado em JSON) do GET /api/leads real para o
 * contrato do app. Loga no console (server-side) o motivo exato de qualquer
 * lead descartado ou de um envelope inválido — diagnóstico sem mascarar.
 */
export function adaptApiLeads(corpo: unknown): AdaptResult {
  const envelope = ApiLeadsResponseSchema.safeParse(corpo);
  if (!envelope.success) {
    const motivo = `envelope inesperado (esperado { leads: [...] }): ${envelope.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
      .join("; ")}`;
    console.error("[/api/leads] api 200 fora do contrato:", motivo);
    return { ok: false, motivo };
  }

  const items: LeadListItem[] = [];
  envelope.data.leads.forEach((bruto, idx) => {
    const parsed = ApiLeadSchema.safeParse(bruto);
    if (!parsed.success) {
      console.error(
        `[/api/leads] lead #${idx} descartado (fora do contrato):`,
        parsed.error.issues
          .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
          .join("; "),
        "| recebido:",
        bruto,
      );
      return;
    }
    const mapeado = mapApiLead(parsed.data);
    // Cinto de segurança: garante que o mapeamento satisfaz o contrato do app
    // antes de servir ao client (se um default quebrar, o lead é logado, não a fila).
    const contrato = LeadListItemSchema.safeParse(mapeado);
    if (!contrato.success) {
      console.error(
        `[/api/leads] lead #${idx} (id=${parsed.data.id}) falhou no contrato do app após mapeamento:`,
        contrato.error.issues
          .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
          .join("; "),
      );
      return;
    }
    items.push(contrato.data);
  });

  return { ok: true, items };
}
