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

// GET /api/usuarios — diretório usado para traduzir closer_id/sdr_id (UUID) →
// nome nos dropdowns de filtro, no detalhe do lead e onde aparecer um dono.
// Enxuto de propósito: o front só precisa de id→nome (papel não é usado aqui).
export const UsuarioSchema = z.object({
  id: z.string(),
  nome: z.string(),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

export const UsuariosResponseSchema = z.object({
  usuarios: z.array(UsuarioSchema),
});

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
  // Data da última atividade do lead (base da retenção de 65 dias) — eixo padrão
  // do filtro de data na fila. Opcional/tolerante: a API pode não expor ainda
  // (o filtro cai no score_calculated_at) e o mock não traz.
  last_activity_at: z.string().nullish(),
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

// Ficha do lead (dados frios da qualificação, vindos do Clint). TODOS de
// exibição como TEXTO e independentes: um campo nulo NÃO afeta os outros. São
// distintos do NÍVEL numérico do score (renda_nivel etc., de outra fonte) —
// renda_faixa/patrimonio_faixa são texto ("Entre R$ 11 mil e R$ 25 mil"), nunca
// usados no cálculo do score.
export const FichaLeadSchema = z.object({
  renda_faixa: z.string().nullable(),
  patrimonio_faixa: z.string().nullable(),
  investimento_mensal: z.string().nullable(),
  profissao: z.string().nullable(),
  objetivo_mercado: z.string().nullable(),
  obstaculo: z.string().nullable(),
  momento_financeiro: z.string().nullable(),
  motivacao: z.string().nullable(),
  tempo_disponivel: z.string().nullable(),
  momento_atual: z.string().nullable(),
  desafio_resolver: z.string().nullable(),
});
export type FichaLead = z.infer<typeof FichaLeadSchema>;

// Ficha toda vazia — default quando a fonte (mock) não traz os campos do Clint.
export const FICHA_VAZIA: FichaLead = {
  renda_faixa: null,
  patrimonio_faixa: null,
  investimento_mensal: null,
  profissao: null,
  objetivo_mercado: null,
  obstaculo: null,
  momento_financeiro: null,
  motivacao: null,
  tempo_disponivel: null,
  momento_atual: null,
  desafio_resolver: null,
};

// Detalhe do lead — espelho do futuro GET /api/leads/:id (F5).
// Contato (telefone/e-mail) aparece DIRETO aqui (decisão Vata 3.1.3);
// link_crm é o botão "Abrir na Clint" (pendência de backend 3.2 — no mock já existe).
export const LeadDetailSchema = LeadListItemSchema.extend({
  telefone: z.string(),
  // E-mail aceito como string livre: a API real pode mandar um valor não
  // estritamente válido (ou vazio) e isso NÃO pode derrubar a tela.
  email: z.string(),
  // link_crm é o botão "Abrir na Clint". A API real responde NULL enquanto a
  // integração com o CRM não popula o link — nullable, e a UI esconde o botão.
  link_crm: z.string().url().nullable(),
  score_breakdown: ScoreBreakdownSchema,
  resumo_analises: z.object({
    sdr: AnaliseResumoSchema.nullable(),
    call: AnaliseResumoSchema.nullable(),
  }),
  // Textos da IA exibidos como accordions em "Análises da IA". Todos com
  // .default(null): o mock não traz e o contrato segue válido. conducao_da_call
  // e guia_sdr AINDA não vêm da API (backend ainda vai capturá-los) → ficam null
  // e a UI mostra placeholder até lá.
  briefing: z.string().nullable().default(null),
  conducao_da_call: z.string().nullable().default(null),
  guia_sdr: z.string().nullable().default(null),
  // Ficha do Clint (dados frios). .default: idem — mock antigo segue válido.
  ficha: FichaLeadSchema.default(FICHA_VAZIA),
  timeline: z.array(LeadEventSchema),
});
export type LeadDetail = z.infer<typeof LeadDetailSchema>;
