import { z } from "zod";

// ---------------------------------------------------------------------------
// Contrato do módulo Educacional — FASE 2 (seção 2 de
// specs/educacional/Módulo Educacional — Fase 2 (Edição) — Frontend.md).
// Substitui o contrato da Fase 1. Vale para o mock e para a API; mudança aqui
// precisa ser alinhada com o back.
//   - Etapas vêm da configuração (id, nome, ordem), não são mais fixas.
//   - Campos calculados usam CampoCalculado: valor efetivo = ajuste ?? automático.
//   - O aluno tem `versao`: toda escrita envia a versão (409 se divergir).
// O front não calcula regra de negócio: exibe o aluno que a API devolve.
// ---------------------------------------------------------------------------

// ---------- domínios ----------
export const STATUS_CHECKPOINT = ["previsto", "pendente", "realizado", "nao_respondeu", "em_pausa"] as const;
export const StatusCheckpointSchema = z.enum(STATUS_CHECKPOINT);
export type StatusCheckpoint = z.infer<typeof StatusCheckpointSchema>;

export const FAIXAS_SAUDE = ["saudavel", "atencao", "risco"] as const;
export const FaixaSaudeSchema = z.enum(FAIXAS_SAUDE);
export type FaixaSaude = z.infer<typeof FaixaSaudeSchema>;

export const NIVEIS_INICIAIS = ["iniciante", "intermediario", "avancado"] as const;
export const NivelInicialSchema = z.enum(NIVEIS_INICIAIS);
export type NivelInicial = z.infer<typeof NivelInicialSchema>;

export const STATUS_ALUNO = ["ativo", "em_pausa", "concluido", "cancelado", "reembolsado"] as const;
export const StatusAlunoSchema = z.enum(STATUS_ALUNO);
export type StatusAluno = z.infer<typeof StatusAlunoSchema>;

export const STATUS_FINANCEIRO = ["adimplente", "inadimplente"] as const;
export const StatusFinanceiroSchema = z.enum(STATUS_FINANCEIRO);
export type StatusFinanceiro = z.infer<typeof StatusFinanceiroSchema>;

export const AUTORIZACOES_PROVA_SOCIAL = ["sim", "nao", "pendente"] as const;
export const AutorizacaoProvaSocialSchema = z.enum(AUTORIZACOES_PROVA_SOCIAL);
export type AutorizacaoProvaSocial = z.infer<typeof AutorizacaoProvaSocialSchema>;

export const TIPOS_RESPONSAVEL = ["mentor", "suporte", "comercial"] as const;
export const TipoResponsavelSchema = z.enum(TIPOS_RESPONSAVEL);
export type TipoResponsavel = z.infer<typeof TipoResponsavelSchema>;

export const STATUS_INTERVENCAO = ["aberta", "concluida"] as const;
export const SINAIS = ["upgrade", "renovacao", "prova_social"] as const;
export type Sinal = (typeof SINAIS)[number];

const Usuario = z.object({ id: z.string(), nome: z.string() });
export type Usuario = z.infer<typeof Usuario>;

// ---------- campo calculado com ajuste manual ----------
export function AjusteSchema<T extends z.ZodTypeAny>(valor: T) {
  return z.object({ valor, motivo: z.string(), ajustado_por: Usuario, ajustado_em: z.string() });
}
export function CampoCalculadoSchema<T extends z.ZodTypeAny>(valor: T) {
  return z.object({
    valor: valor.nullable(), // efetivo: ajuste ?? automatico
    automatico: valor.nullable(), // null = ainda sem cálculo
    ajuste: AjusteSchema(valor).nullable(),
  });
}
export type Ajuste<T> = { valor: T; motivo: string; ajustado_por: Usuario; ajustado_em: string };
export type CampoCalculado<T> = { valor: T | null; automatico: T | null; ajuste: Ajuste<T> | null };

const Nota = z.number().min(0).max(100);
const Dias = z.number().int().min(0);
const Data = z.string(); // AAAA-MM-DD ou ISO

// ---------- configuração ----------
export const EtapaSchema = z.object({ id: z.string(), nome: z.string(), ordem: z.number().int(), ativo: z.boolean() });
export type Etapa = z.infer<typeof EtapaSchema>;

// ---------- programas e roteiros (specs/educacional/programas) ----------
// Contrato alinhado com o backend em 28/10. Programa = mentoria + duração, com a
// sua lista de checkpoints padrão. Rotas em /config/programas, como as outras.
export const MENTORIAS = ["Blackbelt", "Prime", "Private"] as const;
export const ProgramaSchema = z.object({
  id: z.string(),
  nome: z.string(), // "Blackbelt 6 meses"
  mentoria: z.string(), // Blackbelt, Prime ou Private — é o que a tela mostra como mentoria
  duracao_meses: z.number().int().positive(),
  observacoes: z.string().nullable().default(null),
  ordem: z.number().int().default(0),
  ativo: z.boolean(),
});
export type Programa = z.infer<typeof ProgramaSchema>;

// Programa aninhado na linha e no detalhe do aluno (além de `programa_id`).
// Só `id` e `nome` são garantidos; o resto, quando faltar, vem da config.
export const ProgramaDoAlunoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  mentoria: z.string().optional(),
  duracao_meses: z.number().int().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});
export type ProgramaDoAluno = z.infer<typeof ProgramaDoAlunoSchema>;

// Roteiro do contato de um checkpoint (os 4 textos do checkpoint padrão). É
// referência: no checkpoint do aluno vem como objeto `roteiro` (null quando o
// padrão não tem nenhum dos 4 textos); só leitura no Raio-X. No checkpoint
// padrão (Configurações) os 4 textos vêm e vão soltos. A leitura aceita os dois.
export const CAMPOS_ROTEIRO = ["objetivo_contato", "perguntas_chave", "sinais_upsell", "estrategia_monetizacao"] as const;
export const RoteiroSchema = z.object({
  objetivo_contato: z.string().nullable().default(null),
  perguntas_chave: z.string().nullable().default(null),
  sinais_upsell: z.string().nullable().default(null),
  estrategia_monetizacao: z.string().nullable().default(null),
});
export type Roteiro = z.infer<typeof RoteiroSchema>;

function comRoteiro(b: Record<string, unknown>): Record<string, unknown> {
  if (b.roteiro !== undefined || !CAMPOS_ROTEIRO.some((k) => k in b)) return b;
  return { ...b, roteiro: Object.fromEntries(CAMPOS_ROTEIRO.map((k) => [k, b[k] ?? null])) };
}

// Contagem do checkpoint padrão: EXATAMENTE uma das duas (a outra null, nunca 0).
//   dias_apos_entrada → "Dia N" (início + N dias)
//   meses_apos_inicio → "Mês N" (N meses de calendário; fim do mês quando o dia não existe)
export type Contagem = { dias_apos_entrada: number | null; meses_apos_inicio: number | null };
export const RE_MARCO = /^(Dia|Mês) (\d{1,3})$/;
export function marcoDe(c: Partial<Contagem>): string | null {
  if (c.meses_apos_inicio != null) return `Mês ${c.meses_apos_inicio}`;
  if (c.dias_apos_entrada != null) return `Dia ${c.dias_apos_entrada}`;
  return null;
}
export function contagemDoMarco(marco: string): Contagem | null {
  const m = RE_MARCO.exec(marco);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === "Dia" ? { dias_apos_entrada: n, meses_apos_inicio: null } : { dias_apos_entrada: null, meses_apos_inicio: n };
}

// Objeto vindo da API: roteiro em objeto (aceita os 4 campos soltos) e o marco
// derivado da contagem quando ela vier.
const daApi = (bruto: unknown) => {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return bruto;
  const b = comRoteiro(bruto as Record<string, unknown>);
  return b.marco === undefined && ("dias_apos_entrada" in b || "meses_apos_inicio" in b) ? { ...b, marco: marcoDe(b as Partial<Contagem>) } : b;
};

export const CheckpointModeloSchema = z.preprocess(
  (bruto) => (bruto && typeof bruto === "object" && !Array.isArray(bruto) ? comRoteiro(bruto as Record<string, unknown>) : bruto),
  z.object({
    id: z.string(),
    nome: z.string(),
    ordem: z.number().int(),
    dias_apos_entrada: z.number().int().nullable().default(null),
    meses_apos_inicio: z.number().int().nullable().default(null),
    prazo_sla_dias: z.number().int().nullable(),
    big_win: z.boolean(),
    ativo: z.boolean(),
    programa_id: z.string().nullable().default(null),
    roteiro: RoteiroSchema.nullable().default(null),
  }),
);
export type CheckpointModelo = z.infer<typeof CheckpointModeloSchema>;

export const TipoIntervencaoSchema = z.object({ id: z.string(), nome: z.string(), ativo: z.boolean() });
export type TipoIntervencao = z.infer<typeof TipoIntervencaoSchema>;

export const ResponsavelSchema = z.object({ id: z.string(), nome: z.string(), tipo: TipoResponsavelSchema, ativo: z.boolean() });
export type Responsavel = z.infer<typeof ResponsavelSchema>;

export const ConfigSchema = z.object({
  etapas: z.array(EtapaSchema),
  checkpoints_modelo: z.array(CheckpointModeloSchema),
  tipos_intervencao: z.array(TipoIntervencaoSchema),
  responsaveis: z.array(ResponsavelSchema),
  sync_planilha_erros: z.number().int().min(0),
  // Fase 3 (D2): mentorias existentes, para o filtro e as sugestões do campo.
  mentorias: z.array(z.string()).default([]),
  programas: z.array(ProgramaSchema).default([]),
});
export type Config = z.infer<typeof ConfigSchema>;

// ---------- resumo ----------
export const ResumoEducacionalSchema = z.object({
  atualizado_em: z.string(),
  kpis: z.object({
    health_score_medio: Nota.nullable(),
    alunos_ativos: Dias,
    intervencoes_sla: Dias,
    em_risco: Dias,
  }),
  funil: z.array(z.object({ etapa_id: z.string(), nome: z.string(), alunos: Dias })),
  sinais: z.object({ upgrade: Dias, renovacao: Dias, prova_social: Dias }),
});
export type ResumoEducacional = z.infer<typeof ResumoEducacionalSchema>;

// ---------- aluno ----------
const ResponsavelDoAluno = z.object({ id: z.string(), nome: z.string(), tipo: TipoResponsavelSchema });

export const AlunoLinhaSchema = z.object({
  id: z.string().min(1),
  versao: z.number().int(),
  nome: z.string().min(1),
  mentoria: z.string(),
  nivel_inicial: NivelInicialSchema,
  status_aluno: StatusAlunoSchema,
  etapa: z.object({ id: z.string(), nome: z.string() }),
  proximo_checkpoint: z
    .object({ id: z.string(), nome: z.string(), status: StatusCheckpointSchema, data_prevista: z.string().nullable() })
    .nullable(),
  dias_na_etapa: CampoCalculadoSchema(Dias),
  dias_sem_atividade: CampoCalculadoSchema(Dias),
  health_score: CampoCalculadoSchema(Nota),
  faixa_saude: CampoCalculadoSchema(FaixaSaudeSchema),
  proxima_acao: z.object({ descricao: z.string(), prazo: z.string().nullable() }).nullable(),
  responsavel: ResponsavelDoAluno.nullable(),
  sinais: z.object({
    upgrade: CampoCalculadoSchema(z.boolean()),
    renovacao: CampoCalculadoSchema(z.boolean()),
    prova_social: CampoCalculadoSchema(z.boolean()),
  }),
  arquivado: z.boolean(),
  // Programas: null = aluno sem programa (antigo). `mentoria` continua vindo
  // (do programa; não é mais editável). `programa` vem aninhado (use
  // `programaDoAluno`, que completa pela config o que faltar).
  programa_id: z.string().nullable().default(null),
  programa: ProgramaDoAlunoSchema.nullable().default(null),
});
export type AlunoLinha = z.infer<typeof AlunoLinhaSchema>;

export const CheckpointSchema = z.preprocess(
  daApi,
  z.object({
    id: z.string(),
    nome: z.string(),
    ordem: z.number().int(),
    data_prevista: z.string().nullable(),
    data_realizada: z.string().nullable(),
    status: StatusCheckpointSchema,
    big_win: z.boolean(),
    observacao: z.string().nullable(),
    // Programas: checkpoint padrão de origem (null no avulso), marco ("Dia N"/
    // "Mês N", da contagem do padrão) e roteiro do padrão.
    modelo_id: z.string().nullable().default(null),
    marco: z.string().nullable().default(null),
    roteiro: RoteiroSchema.nullable().default(null),
  }),
);
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const IntervencaoSchema = z.object({
  id: z.string(),
  tipo: z.object({ id: z.string(), nome: z.string() }),
  descricao: z.string(),
  responsavel: ResponsavelDoAluno.nullable(),
  prazo: z.string().nullable(),
  status: z.enum(STATUS_INTERVENCAO),
  concluida_em: z.string().nullable(),
  criada_por: Usuario,
  criada_em: z.string(),
});
export type Intervencao = z.infer<typeof IntervencaoSchema>;

export const HighlightSchema = z.object({ data_aula: z.string(), texto: z.string() });

// ---------- análise de aula (Fase 3, seção 7) ----------
export const STATUS_ANALISE = ["na_fila", "processando", "pronta", "erro", "confirmada", "descartada"] as const;
export const StatusAnaliseSchema = z.enum(STATUS_ANALISE);
export type StatusAnalise = z.infer<typeof StatusAnaliseSchema>;
export const STATUS_ANALISE_PENDENTE: readonly StatusAnalise[] = ["na_fila", "processando"];

export const PASSOS_PROGRESSO = ["consumiu", "entendeu", "aplicou", "validou"] as const;
export type PassoProgresso = (typeof PASSOS_PROGRESSO)[number];

export const NotaProgressoSchema = z.object({ nota: Nota, justificativa: z.string(), evidencias: z.array(z.string()) });
export type NotaProgresso = z.infer<typeof NotaProgressoSchema>;

export const ResultadoAnaliseSchema = z.object({
  resumo: z.string(),
  progresso: z.object({
    consumiu: NotaProgressoSchema,
    entendeu: NotaProgressoSchema,
    aplicou: NotaProgressoSchema,
    validou: NotaProgressoSchema,
  }),
  highlights: z.array(z.string()),
});
export type ResultadoAnalise = z.infer<typeof ResultadoAnaliseSchema>;

const EtapaRef = z.object({ id: z.string(), nome: z.string() });

export const AnaliseResumoSchema = z.object({
  id: z.string(),
  data_aula: Data,
  etapa: EtapaRef,
  resumo: z.string(),
  notas: z.object({ consumiu: Nota, entendeu: Nota, aplicou: Nota, validou: Nota }),
});
export type AnaliseResumo = z.infer<typeof AnaliseResumoSchema>;

export const AnaliseItemListaSchema = z.object({
  id: z.string(),
  aluno: z.object({ id: z.string(), nome: z.string() }),
  data_aula: Data,
  etapa: EtapaRef,
  status: StatusAnaliseSchema,
  criada_por: Usuario,
  criada_em: z.string(),
});
export type AnaliseItemLista = z.infer<typeof AnaliseItemListaSchema>;

export const AnaliseDetalheSchema = AnaliseItemListaSchema.extend({
  arquivo_nome: z.string().nullable(),
  transcricao: z.string(),
  resultado_ia: ResultadoAnaliseSchema.nullable(),
  resultado_confirmado: ResultadoAnaliseSchema.nullable(),
  erro: z.string().nullable(),
  confirmada_por: Usuario.nullable(),
  confirmada_em: z.string().nullable(),
});
export type AnaliseDetalhe = z.infer<typeof AnaliseDetalheSchema>;

export const OrigemProgressoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("analise"), analise_id: z.string(), data_aula: Data }),
  z.object({ tipo: z.literal("ajuste") }),
  z.object({ tipo: z.literal("nenhuma") }),
]);
export type OrigemProgresso = z.infer<typeof OrigemProgressoSchema>;
const SEM_ORIGEM = { tipo: "nenhuma" } as const;

export const OpcaoAlunoSchema = z.object({ id: z.string(), nome: z.string(), mentoria: z.string(), etapa: EtapaRef });
export type OpcaoAluno = z.infer<typeof OpcaoAlunoSchema>;

export const AlunoDetalheSchema = AlunoLinhaSchema.extend({
  data_entrada: Data,
  data_termino: z.string().nullable(),
  etapa_desde: Data,
  objetivo: z.string().nullable(),
  diagnostico: z.string().nullable(),
  motivo_risco: z.string().nullable(),
  observacoes: z.string().nullable(),
  autorizacao_prova_social: AutorizacaoProvaSocialSchema,
  ultima_atividade: CampoCalculadoSchema(Data),
  status_financeiro: CampoCalculadoSchema(StatusFinanceiroSchema),
  ltv: CampoCalculadoSchema(z.number().min(0)),
  progresso: z.object({
    consumiu: CampoCalculadoSchema(Nota),
    entendeu: CampoCalculadoSchema(Nota),
    aplicou: CampoCalculadoSchema(Nota),
    validou: CampoCalculadoSchema(Nota),
  }),
  highlights: z.array(HighlightSchema),
  checkpoints: z.array(CheckpointSchema),
  intervencoes: z.array(IntervencaoSchema),
  // Programas: início do programa (a troca grava).
  data_inicio_programa: z.string().nullable().default(null),
  // Fase 3: com padrão, para a tela não cair enquanto a API ainda não manda.
  analises: z.array(AnaliseResumoSchema).default([]),
  progresso_origem: z
    .object({
      consumiu: OrigemProgressoSchema.default(SEM_ORIGEM),
      entendeu: OrigemProgressoSchema.default(SEM_ORIGEM),
      aplicou: OrigemProgressoSchema.default(SEM_ORIGEM),
      validou: OrigemProgressoSchema.default(SEM_ORIGEM),
    })
    .default({ consumiu: SEM_ORIGEM, entendeu: SEM_ORIGEM, aplicou: SEM_ORIGEM, validou: SEM_ORIGEM }),
});
export type AlunoDetalhe = z.infer<typeof AlunoDetalheSchema>;

// ---------- troca de programa ----------
// Uma rota só: POST /alunos/:id/programa { programa_id, data_inicio, motivo,
// versao, simular }. Com `simular: true` devolve a prévia sem gravar (motivo e
// versao opcionais); na confirmação os dois são obrigatórios. Formato fechado
// com o backend em 28/10: `programa` é o mesmo objeto do aluno; ficam, saem e
// criados são checkpoints completos (saem com o status atual; criados com
// id null). Avulso (sem modelo_id) fica sempre.
const CheckpointDaPrevia = z.preprocess(
  daApi,
  z.object({
    id: z.string().nullable(),
    nome: z.string(),
    modelo_id: z.string().nullable().default(null),
    marco: z.string().nullable().default(null),
    status: StatusCheckpointSchema.default("previsto"),
    data_prevista: z.string().nullable(),
    data_realizada: z.string().nullable().default(null),
  }),
);
export type CheckpointDaPrevia = z.infer<typeof CheckpointDaPrevia>;
export const PreviaTrocaSchema = z.object({
  programa: ProgramaDoAlunoSchema,
  data_inicio: Data,
  data_termino_sugerida: Data,
  ficam: z.array(CheckpointDaPrevia),
  saem: z.array(CheckpointDaPrevia),
  criados: z.array(CheckpointDaPrevia),
});
export type PreviaTroca = z.infer<typeof PreviaTrocaSchema>;
export type PedidoTroca = { programa_id: string; data_inicio: string };

// ---------- lote (Fase 3, seção 7; POST /lote) ----------
export type AjusteLote = { campo: CampoAjustavelNome; valor: unknown; motivo?: string } | { campo: CampoAjustavelNome; remover: true };
type CampoAjustavelNome = string;
export type ItemLote = Record<string, unknown>; // { id, ...mudanças } | { novo: true, ... } | { id, arquivar: true }
export type AlunoNoLote = {
  aluno_id: string;
  versao: number;
  campos?: Record<string, unknown>;
  ajustes?: AjusteLote[];
  checkpoints?: ItemLote[];
  intervencoes?: ItemLote[];
};
export type PedidoLote = { motivo_padrao?: string; alunos: AlunoNoLote[] };
export const LIMITE_LOTE = 100;

export type ResultadoLoteAluno =
  | { aluno_id: string; ok: true; aluno: AlunoDetalhe }
  | { aluno_id: string; ok: false; error: "versao"; aluno: AlunoDetalhe }
  | { aluno_id: string; ok: false; error: "validacao"; campo: string; mensagem: string };
export type RespostaLote = { lote_id: string; resultados: ResultadoLoteAluno[] };

export const ENTIDADES_HISTORICO = ["aluno", "checkpoint", "intervencao", "ajuste"] as const;
export type EntidadeHistorico = (typeof ENTIDADES_HISTORICO)[number];

export const ItemHistoricoSchema = z.object({
  id: z.string(),
  em: z.string(),
  usuario: Usuario,
  entidade: z.enum(ENTIDADES_HISTORICO),
  campo: z.string(),
  valor_antes: z.unknown(),
  valor_depois: z.unknown(),
  motivo: z.string().nullable(),
});
export type ItemHistorico = z.infer<typeof ItemHistoricoSchema>;

// ---------- campos ajustáveis (PUT/DELETE /alunos/:id/ajustes/:campo) ----------
// Nome do campo na API → schema do valor. É a lista da seção 3 do backend.
export const CAMPOS_AJUSTAVEIS = {
  health_score: Nota,
  faixa_saude: FaixaSaudeSchema,
  dias_na_etapa: Dias,
  ultima_atividade: Data,
  dias_sem_atividade: Dias,
  status_financeiro: StatusFinanceiroSchema,
  ltv: z.number().min(0),
  progresso_consumiu: Nota,
  progresso_entendeu: Nota,
  progresso_aplicou: Nota,
  progresso_validou: Nota,
  sinal_upgrade: z.boolean(),
  sinal_renovacao: z.boolean(),
  sinal_prova_social: z.boolean(),
} as const;
export type CampoAjustavel = keyof typeof CAMPOS_AJUSTAVEIS;
export const MOTIVO_MINIMO = 5;

// ---------- corpos de escrita (seção 4 do backend) ----------
// Campos diretos do aluno (PATCH /alunos/:id). Nome igual ao do banco.
// `mentoria` não entra: vem do programa (não é mais editável).
export type CamposDiretosAluno = Partial<{
  nome: string;
  data_entrada: string;
  data_termino: string | null;
  objetivo: string | null;
  nivel_inicial: NivelInicial;
  status_aluno: StatusAluno;
  etapa_id: string;
  responsavel_id: string | null;
  proxima_acao: string | null;
  proxima_acao_prazo: string | null;
  diagnostico: string | null;
  motivo_risco: string | null;
  autorizacao_prova_social: AutorizacaoProvaSocial;
  observacoes: string | null;
}>;

export type NovoAluno = {
  nome: string;
  // Obrigatório; a mentoria vem dele (o backend recusa `mentoria` aqui).
  programa_id: string;
  data_entrada: string;
  nivel_inicial: NivelInicial;
  etapa_id: string;
  data_termino?: string | null;
  objetivo?: string | null;
  responsavel_id?: string | null;
  status_aluno?: StatusAluno;
  autorizacao_prova_social?: AutorizacaoProvaSocial;
  observacoes?: string | null;
};

export type CamposCheckpoint = Partial<{
  nome: string;
  data_prevista: string | null;
  data_realizada: string | null;
  status: StatusCheckpoint;
  observacao: string | null;
  big_win: boolean;
}>;

export type CamposIntervencao = Partial<{
  tipo_id: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: "aberta" | "concluida";
}>;

// ---------------------------------------------------------------------------
// Tolerância: registro inválido é descartado e logado, nunca derruba a tela.
// No Raio-X, cada checkpoint, intervenção e highlight é validado sozinho.
// ---------------------------------------------------------------------------

function motivo(erro: z.ZodError): string {
  return erro.issues.map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`).join("; ");
}

// Tipado pela SAÍDA do schema (campos com padrão chegam preenchidos).
export function validarLista<S extends z.ZodTypeAny>(
  itens: unknown,
  schema: S,
  rotulo: string,
): { validos: z.output<S>[]; descartados: number } {
  if (!Array.isArray(itens)) return { validos: [], descartados: 0 };
  const validos: z.output<S>[] = [];
  let descartados = 0;
  itens.forEach((bruto, i) => {
    const r = schema.safeParse(bruto);
    if (r.success) validos.push(r.data);
    else {
      descartados += 1;
      console.warn(`[educacional] ${rotulo} #${i} descartado (fora do contrato):`, motivo(r.error));
    }
  });
  return { validos, descartados };
}

export function validarAlunoDetalhe(bruto: unknown): AlunoDetalhe | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  // Checkpoint substituído numa troca de programa não é da jornada: sai sem aviso
  // (o backend ainda vai definir a marcação; o histórico continua mostrando).
  const daJornada = Array.isArray(b.checkpoints)
    ? b.checkpoints.filter((c) => (c as { status?: unknown } | null)?.status !== "substituido")
    : b.checkpoints;
  const candidato = {
    ...b,
    checkpoints: validarLista(daJornada, CheckpointSchema, "checkpoint").validos,
    intervencoes: validarLista(b.intervencoes, IntervencaoSchema, "intervenção").validos,
    highlights: validarLista(b.highlights, HighlightSchema, "highlight").validos,
    // Fase 3: cada análise validada sozinha (uma ruim não derruba o aluno).
    analises: b.analises === undefined ? undefined : validarLista(b.analises, AnaliseResumoSchema, "análise").validos,
  };
  const r = AlunoDetalheSchema.safeParse(candidato);
  if (!r.success) {
    console.warn("[educacional] aluno descartado (fora do contrato):", motivo(r.error));
    return null;
  }
  return r.data;
}

// O AlunoLinha de um AlunoDetalhe (para atualizar listas com a resposta de uma escrita).
export function linhaDoDetalhe(a: AlunoDetalhe): AlunoLinha {
  return AlunoLinhaSchema.parse(a);
}
