import { z } from "zod";

// ---------------------------------------------------------------------------
// Contratos do backend real (roadmap_frontend.md, Parte 1).
// O mock (data_clients.json) e a futura API real respondem por estes schemas.
// ---------------------------------------------------------------------------

export const TemperaturaSchema = z.enum([
  "muito_quente", // 90–100
  "quente", // 75–89
  "morno_alto", // 60–74
  "morno_baixo", // 45–59
  "frio", // 30–44
  "congelado", // 0–29
]);
export type Temperatura = z.infer<typeof TemperaturaSchema>;

export const ETAPAS = [
  "1a_call_agendada",
  "no_show_1a",
  "em_atendimento",
  "2a_call_agendada",
  "3a_call_agendada",
  "4a_call_agendada",
  "5a_mais_call_agendada",
  "no-show",
  "fup_pos_pitch",
  "fup_infinito_perdido",
  "blacklist",
  "fechado",
] as const;
export const EtapaSchema = z.enum(ETAPAS);
export type Etapa = z.infer<typeof EtapaSchema>;

export const RoleSchema = z.enum(["admin", "closer", "sdr"]);
export type Role = z.infer<typeof RoleSchema>;

// GET /api/me
export const SessionUserSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().email(),
  role: RoleSchema,
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

// Tetos reais dos 5 blocos do score (momento/fit/urgência/engajamento/timing)
export const TETOS_BLOCOS = {
  momento: 25,
  fit: 20,
  urgencia: 25,
  engajamento: 20,
  timing: 10,
} as const;
export type BlocoScore = keyof typeof TETOS_BLOCOS;

// Item da lista — espelho de GET /api/leads (lista enxuta, SEM contato)
export const LeadListItemSchema = z.object({
  lead_id: z.string(),
  nome_exibicao: z.string(),
  score_final: z.number().min(0).max(100),
  score_bruto: z.number().min(0).max(100),
  temperatura: TemperaturaSchema,
  etapa_atual: EtapaSchema.nullable(),
  score_momento: z.number().min(0).max(25),
  score_fit: z.number().min(0).max(20),
  score_urgencia: z.number().min(0).max(25),
  score_engajamento: z.number().min(0).max(20),
  score_timing: z.number().min(0).max(10),
  trava_aplicada: z.string().nullable(),
  motivo_curto: z.string(),
  proxima_acao: z.string(),
  alertas: z.array(z.string()),
  tier_final: z.string(),
  // Produto oficial SEM variante S/A (nota do roadmap 6.2) — nulo quando o
  // motor ainda não sugeriu produto.
  produto_sugerido: z.string().nullable(),
  closer_id: z.string().nullable(),
  sdr_id: z.string().nullable(),
  sdr_pool: z.boolean(),
  // Próxima call agendada (Agenda, Parte 7.3) — null quando não há call futura.
  // PENDÊNCIA DE INTEGRAÇÃO: o GET /api/leads real ainda não expõe estes campos.
  next_call_at: z.string().nullable(),
  next_call_numero: z.number().int().positive().nullable(),
  score_calculated_at: z.string(),
});
export type LeadListItem = z.infer<typeof LeadListItemSchema>;

export const LeadsResponseSchema = z.object({
  total: z.number(),
  items: z.array(LeadListItemSchema),
});
export type LeadsResponse = z.infer<typeof LeadsResponseSchema>;

// Detalhe do cálculo (score_breakdown jsonb)
export const ScoreBreakdownBlocoSchema = z.object({
  bloco: z.enum(["momento", "fit", "urgencia", "engajamento", "timing"]),
  pontos: z.number(),
  teto: z.number(),
  itens: z.array(z.object({ label: z.string(), pontos: z.number() })),
});

export const ScoreBreakdownSchema = z.object({
  blocos: z.array(ScoreBreakdownBlocoSchema),
  trava: z
    .object({ tipo: z.string(), teto: z.number(), motivo: z.string() })
    .nullable(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// Resumo das análises de IA (lead_sdr_analysis / lead_call_analysis)
export const AnaliseResumoSchema = z.object({
  resumo_curto: z.string(),
  sinais_positivos: z.array(z.string()),
  sinais_risco: z.array(z.string()),
  analisado_em: z.string(),
});
export type AnaliseResumo = z.infer<typeof AnaliseResumoSchema>;

// Evento da timeline (lead_events)
export const LeadEventSchema = z.object({
  event_id: z.string(),
  tipo: z.enum([
    "entrada",
    "analise_sdr",
    "call_agendada",
    "call_realizada",
    "analise_call",
    "no_show",
    "mensagem",
    "mudanca_etapa",
    "score_recalculado",
  ]),
  descricao: z.string(),
  occurred_at: z.string(),
});
export type LeadEvent = z.infer<typeof LeadEventSchema>;

// Detalhe do lead — espelho do futuro GET /api/leads/:id (F5).
// Contato (telefone/e-mail) aparece DIRETO aqui (decisão Vata 3.1.3);
// link_crm é o botão "Abrir na Clint" (pendência de backend 3.2 — no mock já existe).
export const LeadDetailSchema = LeadListItemSchema.extend({
  telefone: z.string(),
  email: z.string().email(),
  link_crm: z.string().url(),
  score_breakdown: ScoreBreakdownSchema,
  resumo_analises: z.object({
    sdr: AnaliseResumoSchema.nullable(),
    call: AnaliseResumoSchema.nullable(),
  }),
  timeline: z.array(LeadEventSchema),
});
export type LeadDetail = z.infer<typeof LeadDetailSchema>;
