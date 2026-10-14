import mock from "@/lib/mock/data_educacional.json";
import {
  AlunoLinhaSchema,
  IntervencaoSchema,
  NovaIntervencaoSchema,
  ResumoEducacionalSchema,
  STATUS_CHECKPOINT,
  validarAlunoDetalhe,
  validarLista,
  type AlunoDetalhe,
  type AlunoLinha,
  type Etapa,
  type Intervencao,
  type NivelRisco,
  type NovaIntervencao,
  type ResumoEducacional,
  type Sinal,
  type StatusCheckpoint,
} from "./contrato";

// ---------------------------------------------------------------------------
// ÚNICA porta de dados do módulo Educacional (spec, seção 3). Não importa nada
// do comercial e não chama nenhuma rota comercial.
//   - "mock" (padrão): lê src/lib/mock/data_educacional.json (contrato da
//     seção 8, coerente com as regras da seção 9 — conferido em mock.test.ts).
//     Filtro, ordem e página de 25 seguem os parâmetros da seção 8.3, como o
//     backend fará. Intervenções novas ficam em memória até recarregar.
//   - "api": chama /api/educacional/* (proxies com o JWT da sessão). Pronto e
//     DESLIGADO até o backend ter fonte de dados.
// Modo por NEXT_PUBLIC_EDU_DATA_SOURCE. Validação Zod com tolerância aluno a
// aluno em qualquer modo.
// ---------------------------------------------------------------------------

export type FonteEducacional = "mock" | "api";
export const FONTE_EDUCACIONAL: FonteEducacional =
  process.env.NEXT_PUBLIC_EDU_DATA_SOURCE === "api" ? "api" : "mock";

export const TAMANHO_PAGINA = 25;

export class EducacionalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type OrdemAlunos =
  | "risco"
  | "nome"
  | "-nome"
  | "nivel_inicial"
  | "-nivel_inicial"
  | "etapa_atual"
  | "-etapa_atual"
  | "checkpoint"
  | "-checkpoint"
  | "dias_estagnados"
  | "-dias_estagnados"
  | "-risco"
  | "proxima_acao"
  | "-proxima_acao"
  | "responsavel"
  | "-responsavel";

export type FiltrosAlunos = {
  etapa?: Etapa | null;
  risco?: NivelRisco | null;
  checkpoint?: StatusCheckpoint[];
  responsavel?: string | null; // nome do responsável
  sinal?: Sinal | null;
  // EXCLUSIVO: health_max=50 → Health Score abaixo de 50 (alinhar com o back).
  health_max?: number | null;
  ordem?: OrdemAlunos;
  pagina?: number;
};

// `simular`: só no mock, para ver os estados (erro, vazio, sem permissão).
export type Simular = "erro" | "vazio" | "sem_permissao" | null | undefined;

export type PaginaAlunos = { itens: AlunoLinha[]; total: number; descartados: number };

export function queryDosFiltros(f: FiltrosAlunos): string {
  const qs = new URLSearchParams();
  if (f.etapa) qs.set("etapa", f.etapa);
  if (f.risco) qs.set("risco", f.risco);
  if (f.checkpoint?.length) qs.set("checkpoint", f.checkpoint.join(","));
  if (f.responsavel) qs.set("responsavel", f.responsavel);
  if (f.sinal) qs.set("sinal", f.sinal);
  if (f.health_max != null) qs.set("health_max", String(f.health_max));
  if (f.ordem && f.ordem !== "risco") qs.set("ordem", f.ordem);
  if (f.pagina && f.pagina > 1) qs.set("pagina", String(f.pagina));
  return qs.toString();
}

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

const ESPERA_MS = 350;
const esperar = () => new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 0 : ESPERA_MS));

function falhaSimulada(simular: Simular): void {
  if (simular === "erro") throw new EducacionalError("Não foi possível falar com o serviço educacional.", 502);
  if (simular === "sem_permissao") throw new EducacionalError("Sem permissão", 403);
}

// Intervenções criadas no modo mock (memória da sessão do navegador).
const intervencoesEmMemoria = new Map<string, Intervencao[]>();

function alunosDoMock(): AlunoDetalhe[] {
  const brutos = Array.isArray((mock as { alunos?: unknown }).alunos) ? (mock as { alunos: unknown[] }).alunos : [];
  return brutos.flatMap((b) => {
    const a = validarAlunoDetalhe(b);
    return a ? [a] : [];
  });
}

const PESO_RISCO: Record<NivelRisco, number> = { risco: 0, atencao: 1, saudavel: 2 };
const PESO_CHECKPOINT: Record<StatusCheckpoint, number> = { nao_respondeu: 0, pendente: 1, em_pausa: 2, realizado: 3 };
const ORDEM_ETAPA: Record<Etapa, number> = {
  fundamentos_iniciais: 0,
  tres_pilares: 1,
  oferta_e_demanda: 2,
  construcao_operacional: 3,
  validacao: 4,
};
const ORDEM_NIVEL = { iniciante: 0, intermediario: 1, avancado: 2 } as const;

function comparar(ordem: OrdemAlunos): (a: AlunoLinha, b: AlunoLinha) => number {
  // Padrão (spec, seção 5): Risco → Atenção → Saudável, depois dias estagnados desc.
  const padrao = (a: AlunoLinha, b: AlunoLinha) =>
    PESO_RISCO[a.risco] - PESO_RISCO[b.risco] || b.dias_estagnados - a.dias_estagnados || a.nome.localeCompare(b.nome, "pt-BR");
  const desc = ordem.startsWith("-");
  const campo = desc ? ordem.slice(1) : ordem;
  const texto = (v: string | null | undefined) => v ?? "￿"; // vazio por último
  const base: Record<string, (a: AlunoLinha, b: AlunoLinha) => number> = {
    risco: padrao,
    nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    nivel_inicial: (a, b) => ORDEM_NIVEL[a.nivel_inicial] - ORDEM_NIVEL[b.nivel_inicial],
    etapa_atual: (a, b) => ORDEM_ETAPA[a.etapa_atual] - ORDEM_ETAPA[b.etapa_atual],
    checkpoint: (a, b) => PESO_CHECKPOINT[a.proximo_checkpoint.status] - PESO_CHECKPOINT[b.proximo_checkpoint.status],
    dias_estagnados: (a, b) => a.dias_estagnados - b.dias_estagnados,
    proxima_acao: (a, b) => texto(a.proxima_acao?.descricao).localeCompare(texto(b.proxima_acao?.descricao), "pt-BR"),
    responsavel: (a, b) => texto(a.responsavel?.nome).localeCompare(texto(b.responsavel?.nome), "pt-BR"),
  };
  const f = base[campo] ?? padrao;
  return (a, b) => (desc ? -f(a, b) : f(a, b)) || padrao(a, b);
}

function filtrarMock(alunos: AlunoLinha[], f: FiltrosAlunos): AlunoLinha[] {
  return alunos.filter((a) => {
    if (f.etapa && a.etapa_atual !== f.etapa) return false;
    if (f.risco && a.risco !== f.risco) return false;
    if (f.checkpoint?.length && !f.checkpoint.includes(a.proximo_checkpoint.status)) return false;
    if (f.responsavel && a.responsavel?.nome !== f.responsavel) return false;
    if (f.sinal && !a.sinais.includes(f.sinal)) return false;
    if (f.health_max != null && !(a.health_score < f.health_max)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Modo api (desligado): proxies /api/educacional/* com o JWT da sessão.
// ---------------------------------------------------------------------------

async function headersComToken(): Promise<HeadersInit> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return {};
  const { getSupabaseClient } = await import("@/lib/auth/supabase");
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function chamarApi(caminho: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(caminho, {
    ...init,
    headers: { ...(await headersComToken()), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    // 401 → login (limpa o cookie antes, para não cair em loop com o middleware).
    if (res.status === 401 && typeof window !== "undefined") {
      const { limparCookieSessao } = await import("@/lib/auth/clientSession");
      limparCookieSessao();
      window.location.href = "/login";
    }
    throw new EducacionalError(corpo?.error ?? `O serviço educacional respondeu ${res.status}.`, res.status);
  }
  return corpo;
}

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

export async function buscarResumo(simular?: Simular): Promise<ResumoEducacional> {
  if (FONTE_EDUCACIONAL === "api") {
    const r = ResumoEducacionalSchema.safeParse(await chamarApi("/api/educacional/resumo"));
    if (!r.success) throw new EducacionalError("Resumo educacional fora do contrato.", 502);
    return r.data;
  }
  await esperar();
  falhaSimulada(simular);
  const resumo = ResumoEducacionalSchema.parse((mock as { resumo: unknown }).resumo);
  if (simular === "vazio") {
    return {
      ...resumo,
      kpis: { health_score_medio: 0, alunos_ativos: 0, intervencoes_sla: 0, em_risco: 0 },
      funil: resumo.funil.map((e) => ({ ...e, alunos: 0 })),
      sinais: { upgrade: 0, renovacao: 0, prova_social: 0 },
    };
  }
  return resumo;
}

export async function buscarAlunos(f: FiltrosAlunos, simular?: Simular): Promise<PaginaAlunos> {
  const pagina = Math.max(1, f.pagina ?? 1);
  if (FONTE_EDUCACIONAL === "api") {
    const qs = queryDosFiltros({ ...f, pagina });
    const corpo = (await chamarApi(`/api/educacional/alunos${qs ? `?${qs}` : ""}`)) as { itens?: unknown; total?: unknown } | null;
    const { validos, descartados } = validarLista(corpo?.itens, AlunoLinhaSchema, "aluno");
    const total = typeof corpo?.total === "number" ? corpo.total : validos.length;
    return { itens: validos, total, descartados };
  }
  await esperar();
  falhaSimulada(simular);
  if (simular === "vazio") return { itens: [], total: 0, descartados: 0 };
  const brutos = (mock as { alunos: unknown[] }).alunos;
  const { validos, descartados } = validarLista(brutos, AlunoLinhaSchema, "aluno");
  const todos = filtrarMock(validos, f).sort(comparar(f.ordem ?? "risco"));
  return {
    // A validação já devolve só os campos de AlunoLinha (o detalhe fica de fora).
    itens: todos.slice((pagina - 1) * TAMANHO_PAGINA, pagina * TAMANHO_PAGINA),
    total: todos.length,
    descartados,
  };
}

export async function buscarAluno(id: string, simular?: Simular): Promise<AlunoDetalhe> {
  if (FONTE_EDUCACIONAL === "api") {
    const a = validarAlunoDetalhe(await chamarApi(`/api/educacional/alunos/${encodeURIComponent(id)}`));
    if (!a) throw new EducacionalError("Aluno fora do contrato.", 502);
    return a;
  }
  await esperar();
  falhaSimulada(simular);
  const aluno = alunosDoMock().find((a) => a.id === id);
  if (!aluno) throw new EducacionalError("Aluno não encontrado.", 404);
  const novas = intervencoesEmMemoria.get(id) ?? [];
  const intervencoes = [...novas, ...aluno.intervencoes].sort((a, b) => b.criada_em.localeCompare(a.criada_em));
  return { ...aluno, intervencoes };
}

// Lista enxuta para a busca de aluno do modal (no mock, todos; no api, a 1ª página).
export async function buscarNomesDeAlunos(): Promise<{ id: string; nome: string }[]> {
  const { itens } = await buscarAlunos({ ordem: "nome" });
  return itens.map((a) => ({ id: a.id, nome: a.nome }));
}

export async function criarIntervencao(dados: NovaIntervencao): Promise<Intervencao> {
  const corpo = NovaIntervencaoSchema.parse(dados);
  if (FONTE_EDUCACIONAL === "api") {
    const r = IntervencaoSchema.safeParse(
      await chamarApi("/api/educacional/intervencoes", { method: "POST", body: JSON.stringify(corpo) }),
    );
    if (!r.success) throw new EducacionalError("Intervenção criada, mas a resposta veio fora do contrato.", 502);
    return r.data;
  }
  await esperar();
  if (!alunosDoMock().some((a) => a.id === corpo.aluno_id)) throw new EducacionalError("Aluno não encontrado.", 404);
  const nova: Intervencao = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `mock-${Date.now()}`,
    tipo: corpo.tipo,
    descricao: corpo.descricao.trim(),
    responsavel: corpo.responsavel,
    prazo: corpo.prazo,
    criada_em: new Date().toISOString(),
  };
  intervencoesEmMemoria.set(corpo.aluno_id, [nova, ...(intervencoesEmMemoria.get(corpo.aluno_id) ?? [])]);
  return nova;
}

// Responsáveis presentes no mock/página, para o filtro (o contrato não tem lista própria).
export function responsaveisDe(alunos: readonly AlunoLinha[]): string[] {
  return [...new Set(alunos.flatMap((a) => (a.responsavel ? [a.responsavel.nome] : [])))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export const TODOS_STATUS_CHECKPOINT = STATUS_CHECKPOINT;
