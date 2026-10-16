import { z } from "zod";

// ---------------------------------------------------------------------------
// Contrato do módulo Educacional — seção 8 de specs/educacional_frontend.md.
// É o MESMO contrato que o backend vai implementar; mudança aqui precisa ser
// alinhada com o back. O front não calcula regra de negócio: Health Score,
// risco, sinais e dias estagnados chegam prontos.
// ---------------------------------------------------------------------------

export const ETAPAS = [
  "fundamentos_iniciais",
  "tres_pilares",
  "oferta_e_demanda",
  "construcao_operacional",
  "validacao",
] as const;
export const EtapaSchema = z.enum(ETAPAS);
export type Etapa = z.infer<typeof EtapaSchema>;

// `previsto`: a data do checkpoint ainda não chegou. Vem PRONTO no payload (o
// front não calcula por data) e não conta em Intervenções SLA.
export const STATUS_CHECKPOINT = ["realizado", "pendente", "nao_respondeu", "em_pausa", "previsto"] as const;
export const StatusCheckpointSchema = z.enum(STATUS_CHECKPOINT);
export type StatusCheckpoint = z.infer<typeof StatusCheckpointSchema>;

export const NIVEIS_RISCO = ["saudavel", "atencao", "risco"] as const;
export const NivelRiscoSchema = z.enum(NIVEIS_RISCO);
export type NivelRisco = z.infer<typeof NivelRiscoSchema>;

export const NivelInicialSchema = z.enum(["iniciante", "intermediario", "avancado"]);
export type NivelInicial = z.infer<typeof NivelInicialSchema>;

export const PASSOS = ["consumiu", "entendeu", "aplicou", "validou"] as const;
export const PassoMetodologicoSchema = z.enum(PASSOS);
export type PassoMetodologico = z.infer<typeof PassoMetodologicoSchema>;

export const StatusFinanceiroSchema = z.enum(["adimplente", "inadimplente"]);
export type StatusFinanceiro = z.infer<typeof StatusFinanceiroSchema>;

export const SINAIS = ["upgrade", "renovacao", "prova_social"] as const;
export const SinalSchema = z.enum(SINAIS);
export type Sinal = z.infer<typeof SinalSchema>;

export const TIPOS_RESPONSAVEL = ["mentor", "suporte", "comercial"] as const;
export const TipoResponsavelSchema = z.enum(TIPOS_RESPONSAVEL);
export type TipoResponsavel = z.infer<typeof TipoResponsavelSchema>;

export const TIPOS_INTERVENCAO = ["contato", "reuniao", "ajuste_plano", "outro"] as const;
export const TipoIntervencaoSchema = z.enum(TIPOS_INTERVENCAO);
export type TipoIntervencao = z.infer<typeof TipoIntervencaoSchema>;

export const ResponsavelSchema = z.object({ tipo: TipoResponsavelSchema, nome: z.string().min(1) });
export type Responsavel = z.infer<typeof ResponsavelSchema>;

const Score = z.number().min(0).max(100);
const Contagem = z.number().int().min(0);

export const ResumoEducacionalSchema = z.object({
  atualizado_em: z.string(),
  kpis: z.object({
    health_score_medio: Score,
    alunos_ativos: Contagem,
    intervencoes_sla: Contagem,
    em_risco: Contagem,
  }),
  funil: z.array(z.object({ etapa: EtapaSchema, alunos: Contagem })),
  sinais: z.object({ upgrade: Contagem, renovacao: Contagem, prova_social: Contagem }),
});
export type ResumoEducacional = z.infer<typeof ResumoEducacionalSchema>;

export const AlunoLinhaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  nivel_inicial: NivelInicialSchema,
  etapa_atual: EtapaSchema,
  proximo_checkpoint: z.object({
    nome: z.string(),
    status: StatusCheckpointSchema,
    data_prevista: z.string().nullable(),
  }),
  dias_estagnados: Contagem,
  health_score: Score,
  risco: NivelRiscoSchema,
  proxima_acao: z.object({ descricao: z.string(), prazo: z.string().nullable() }).nullable(),
  responsavel: ResponsavelSchema.nullable(),
  sinais: z.array(SinalSchema),
});
export type AlunoLinha = z.infer<typeof AlunoLinhaSchema>;

export const CheckpointSchema = z.object({
  id: z.string(),
  nome: z.string(),
  ordem: z.number().int(),
  data_prevista: z.string().nullable(),
  data_realizada: z.string().nullable(),
  status: StatusCheckpointSchema,
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const IntervencaoSchema = z.object({
  id: z.string(),
  tipo: TipoIntervencaoSchema,
  descricao: z.string(),
  responsavel: ResponsavelSchema,
  prazo: z.string().nullable(),
  criada_em: z.string(),
});
export type Intervencao = z.infer<typeof IntervencaoSchema>;

export const HighlightSchema = z.object({ data_aula: z.string(), texto: z.string() });

export const AlunoDetalheSchema = AlunoLinhaSchema.extend({
  mentoria: z.string(),
  data_entrada: z.string(),
  data_termino: z.string().nullable(),
  objetivo: z.string().nullable(),
  status_geral: z.string(),
  etapa_desde: z.string(),
  status_financeiro: StatusFinanceiroSchema,
  ltv: z.number(),
  checkpoints: z.array(CheckpointSchema),
  progresso_metodologico: z.object({
    passo_atual: PassoMetodologicoSchema.nullable(),
    highlights: z.array(HighlightSchema),
  }),
  diagnostico: z.string().nullable(),
  intervencoes: z.array(IntervencaoSchema),
});
export type AlunoDetalhe = z.infer<typeof AlunoDetalheSchema>;

// Corpo de POST /api/educacional/intervencoes.
export const NovaIntervencaoSchema = z.object({
  aluno_id: z.string().min(1),
  tipo: TipoIntervencaoSchema,
  descricao: z.string().trim().min(1),
  responsavel: ResponsavelSchema,
  prazo: z.string().nullable(),
});
export type NovaIntervencao = z.infer<typeof NovaIntervencaoSchema>;

// ---------------------------------------------------------------------------
// Tolerância aluno a aluno: registro inválido é descartado e logado, nunca
// derruba a tela. No Raio-X, a mesma tolerância vale para cada checkpoint,
// intervenção e highlight — o aluno aparece com o que veio válido.
// ---------------------------------------------------------------------------

const ROTA = "[educacional]";

function motivo(erro: z.ZodError): string {
  return erro.issues.map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`).join("; ");
}

export function validarLista<T>(
  itens: unknown,
  schema: z.ZodType<T>,
  rotulo: string,
): { validos: T[]; descartados: number } {
  if (!Array.isArray(itens)) return { validos: [], descartados: 0 };
  const validos: T[] = [];
  let descartados = 0;
  itens.forEach((bruto, i) => {
    const r = schema.safeParse(bruto);
    if (r.success) validos.push(r.data);
    else {
      descartados += 1;
      console.warn(`${ROTA} ${rotulo} #${i} descartado (fora do contrato):`, motivo(r.error));
    }
  });
  return { validos, descartados };
}

export function validarAlunoDetalhe(bruto: unknown): AlunoDetalhe | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  const progresso = (b.progresso_metodologico ?? {}) as Record<string, unknown>;
  const candidato = {
    ...b,
    checkpoints: validarLista(b.checkpoints, CheckpointSchema, "checkpoint").validos,
    intervencoes: validarLista(b.intervencoes, IntervencaoSchema, "intervenção").validos,
    progresso_metodologico: {
      passo_atual: progresso.passo_atual ?? null,
      highlights: validarLista(progresso.highlights, HighlightSchema, "highlight").validos,
    },
  };
  const r = AlunoDetalheSchema.safeParse(candidato);
  if (!r.success) {
    console.warn(`${ROTA} aluno descartado (fora do contrato):`, motivo(r.error));
    return null;
  }
  return r.data;
}
