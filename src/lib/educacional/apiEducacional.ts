import {
  AlunoLinhaSchema,
  CheckpointModeloSchema,
  EtapaSchema,
  ItemHistoricoSchema,
  ResponsavelSchema,
  ResumoEducacionalSchema,
  TipoIntervencaoSchema,
  validarAlunoDetalhe,
  validarLista,
  type AlunoDetalhe,
  type AlunoLinha,
  type CampoAjustavel,
  type CamposCheckpoint,
  type CamposDiretosAluno,
  type CamposIntervencao,
  type Config,
  type EntidadeHistorico,
  type FaixaSaude,
  type ItemHistorico,
  type NovoAluno,
  type ResumoEducacional,
  type Sinal,
  type StatusAluno,
  type StatusCheckpoint,
  type Usuario,
} from "./contrato";

// ---------------------------------------------------------------------------
// ÚNICA porta de dados do módulo Educacional (Fase 2). Não importa nada do
// comercial e não chama nenhuma rota comercial. Mesmas rotas nos dois modos
// (seção 4 do backend da Fase 2, relativas a /api/educacional); muda só o
// transporte:
//   - "mock" (padrão): o "servidor" do modo demonstração (mock/servidor.ts)
//     sobre o banco do navegador (localStorage). Imita o backend: versão, 409,
//     400, histórico, ajuste manual e checkpoints de aluno novo.
//     Desenvolvimento: ?simular_gravacao=409|400|rede força a resposta das escritas.
//   - "api": proxy /api/educacional/[...caminho] com o JWT da sessão. Pronto e
//     DESLIGADO até o backend da Fase 2.
// Validação Zod com tolerância item a item nos dois modos.
// ---------------------------------------------------------------------------

export type FonteEducacional = "mock" | "api";
export const FONTE_EDUCACIONAL: FonteEducacional =
  process.env.NEXT_PUBLIC_EDU_DATA_SOURCE === "api" ? "api" : "mock";

export const TAMANHO_PAGINA = 25;
export const TAMANHO_PAGINA_HISTORICO = 20;

export type CorpoDoErro = {
  error: string;
  campo?: string;
  mensagem?: string;
  aluno?: unknown;
  alunos?: number;
};

// status 0 = erro de rede (sem resposta do servidor).
export class EducacionalError extends Error {
  readonly corpo: CorpoDoErro;
  constructor(
    message: string,
    public readonly status: number,
    corpo?: CorpoDoErro,
  ) {
    super(message);
    this.corpo = corpo ?? { error: message };
  }
  get rede() {
    return this.status === 0;
  }
  // 409 de versão: o aluno como está agora no servidor.
  get alunoAtual(): AlunoDetalhe | null {
    return this.status === 409 && this.corpo.error === "versao" ? validarAlunoDetalhe(this.corpo.aluno) : null;
  }
}

const CHAVES_ORDEM = [
  "risco",
  "nome",
  "mentoria",
  "nivel_inicial",
  "status_aluno",
  "etapa",
  "checkpoint",
  "dias_na_etapa",
  "dias_sem_atividade",
  "health_score",
  "faixa_saude",
  "proxima_acao",
  "responsavel",
] as const;
export type ChaveOrdem = (typeof CHAVES_ORDEM)[number];
export type OrdemAlunos = ChaveOrdem | `-${ChaveOrdem}`;
export function ehOrdem(v: string): v is OrdemAlunos {
  return (CHAVES_ORDEM as readonly string[]).includes(v.replace(/^-/, ""));
}

export type FiltrosAlunos = {
  etapa?: string | null; // id da etapa
  risco?: FaixaSaude | null; // faixa de saúde efetiva
  checkpoint?: StatusCheckpoint[];
  responsavel?: string | null; // id do responsável
  sinal?: Sinal | null;
  // EXCLUSIVO: health_max=50 → Health Score efetivo abaixo de 50.
  health_max?: number | null;
  status_aluno?: StatusAluno | null;
  incluir_arquivados?: boolean;
  ordem?: OrdemAlunos;
  pagina?: number;
  por_pagina?: number | "todos";
};

// `simular`: só no mock, para ver os estados de leitura (erro, vazio, sem permissão).
export type Simular = "erro" | "vazio" | "sem_permissao" | null | undefined;

export type PaginaAlunos = { itens: AlunoLinha[]; total: number; descartados: number };
export type PaginaHistorico = { itens: ItemHistorico[]; total: number };

export function queryDosFiltros(f: FiltrosAlunos): string {
  const qs = new URLSearchParams();
  if (f.etapa) qs.set("etapa", f.etapa);
  if (f.risco) qs.set("risco", f.risco);
  if (f.checkpoint?.length) qs.set("checkpoint", f.checkpoint.join(","));
  if (f.responsavel) qs.set("responsavel", f.responsavel);
  if (f.sinal) qs.set("sinal", f.sinal);
  if (f.health_max != null) qs.set("health_max", String(f.health_max));
  if (f.status_aluno) qs.set("status_aluno", f.status_aluno);
  if (f.incluir_arquivados) qs.set("incluir_arquivados", "1");
  if (f.ordem && f.ordem !== "risco") qs.set("ordem", f.ordem);
  if (f.por_pagina != null) qs.set("por_pagina", String(f.por_pagina));
  if (f.pagina && f.pagina > 1) qs.set("pagina", String(f.pagina));
  return qs.toString();
}

// Query de GET /alunos no backend. A URL da página (acima) não muda; aqui vão os
// nomes da API: etapa_id, responsavel_id, incluir_arquivados=true, um status de
// checkpoint só (mais de um: ver buscarAlunos) e health_max INCLUSIVO. Ordem e
// tamanho da página vão sempre, porque os padrões do backend são nome e 50.
export function queryDaApi(f: FiltrosAlunos): string {
  const qs = new URLSearchParams();
  if (f.etapa) qs.set("etapa_id", f.etapa);
  if (f.risco) qs.set("risco", f.risco);
  if (f.checkpoint?.length === 1) qs.set("checkpoint", f.checkpoint[0]);
  if (f.responsavel) qs.set("responsavel_id", f.responsavel);
  if (f.sinal) qs.set("sinal", f.sinal);
  // A tela diz "abaixo de 50"; o backend devolve "até N" com N inteiro.
  if (f.health_max != null) qs.set("health_max", String(Math.max(0, Math.ceil(f.health_max) - 1)));
  if (f.status_aluno) qs.set("status_aluno", f.status_aluno);
  if (f.incluir_arquivados) qs.set("incluir_arquivados", "true");
  qs.set("ordem", f.ordem ?? "risco");
  qs.set("por_pagina", String(f.por_pagina ?? TAMANHO_PAGINA));
  if (f.pagina && f.pagina > 1) qs.set("pagina", String(f.pagina));
  return qs.toString();
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Pedido = { metodo: Metodo; caminho: string; query?: string; corpo?: unknown };

// Usuário que aparece no histórico do modo demonstração (no modo api, o backend usa o JWT).
let usuarioDemo: Usuario = { id: "demo", nome: "Demonstração" };
export function definirUsuarioDaSessao(u: Usuario) {
  usuarioDemo = { id: u.id, nome: u.nome };
}

const ESPERA_MS = 300;
const esperar = () => new Promise((r) => setTimeout(r, process.env.NODE_ENV === "test" ? 0 : ESPERA_MS));

export type SimularGravacao = "409" | "400" | "rede" | null;
let simularGravacaoTeste: SimularGravacao = null;
export function _simularGravacaoEmTeste(v: SimularGravacao) {
  simularGravacaoTeste = v;
}
function simularGravacao(): SimularGravacao {
  if (simularGravacaoTeste) return simularGravacaoTeste;
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("simular_gravacao");
  return v === "409" || v === "400" || v === "rede" ? v : null;
}

const ERRO_DE_REDE = "Sem conexão com o servidor. Verifique a internet e tente de novo.";
const NAO_ENCONTRADO = "Registro não encontrado. Ele pode ter sido arquivado ou removido; atualize a página.";

async function transporteMock(p: Pedido): Promise<unknown> {
  const [{ carregarBanco, salvarBanco }, { atender }, { hojeBR }, { ErroDaApi }] = await Promise.all([
    import("./mock/banco"),
    import("./mock/servidor"),
    import("./mock/motor"),
    import("./mock/tipos"),
  ]);
  await esperar();
  const hoje = hojeBR();
  const agora = new Date().toISOString();
  const banco = carregarBanco(hoje);
  const escrita = p.metodo !== "GET";
  const forcar = escrita ? simularGravacao() : null;
  if (forcar === "rede") throw new EducacionalError(ERRO_DE_REDE, 0, { error: "rede", mensagem: ERRO_DE_REDE });
  if (forcar === "400") {
    const mensagem = "Erro de validação simulado (simular_gravacao=400).";
    throw new EducacionalError(mensagem, 400, { error: "validacao", campo: "simulado", mensagem });
  }
  if (forcar === "409") {
    // "Outra pessoa" grava antes: a versão do aluno sobe e a escrita cai no 409 de verdade.
    const id = alunoDoPedido(banco, p);
    const aluno = id ? banco.alunos.find((a) => a.id === id) : null;
    if (aluno) {
      aluno.versao += 1;
      salvarBanco(banco, hoje);
    }
  }
  try {
    const resposta = atender(
      banco,
      { metodo: p.metodo, caminho: p.caminho, query: new URLSearchParams(p.query ?? ""), corpo: p.corpo },
      { usuario: usuarioDemo, hoje, agora },
    );
    if (escrita) salvarBanco(banco, hoje);
    return JSON.parse(JSON.stringify(resposta)) as unknown;
  } catch (e) {
    if (e instanceof ErroDaApi) throw new EducacionalError(e.corpo.mensagem ?? e.corpo.error, e.status, e.corpo);
    throw e;
  }
}

// Aluno dono de uma escrita (para o 409 simulado).
function alunoDoPedido(
  banco: { checkpoints: { id: string; aluno_id: string }[]; intervencoes: { id: string; aluno_id: string }[] },
  p: Pedido,
): string | null {
  const s = p.caminho.split("/");
  if (s[0] === "alunos" && s[1]) return s[1];
  if (s[0] === "checkpoints") return banco.checkpoints.find((c) => c.id === s[1])?.aluno_id ?? null;
  if (s[0] === "intervencoes" && s[1]) return banco.intervencoes.find((i) => i.id === s[1])?.aluno_id ?? null;
  if (s[0] === "intervencoes") return (p.corpo as { aluno_id?: string } | undefined)?.aluno_id ?? null;
  return null;
}

async function headersComToken(): Promise<Record<string, string>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return {};
  const { getSupabaseClient } = await import("@/lib/auth/supabase");
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function transporteApi(p: Pedido): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`/api/educacional/${p.caminho}${p.query ? `?${p.query}` : ""}`, {
      method: p.metodo,
      headers: { ...(await headersComToken()), ...(p.corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: p.corpo !== undefined ? JSON.stringify(p.corpo) : undefined,
    });
  } catch {
    throw new EducacionalError(ERRO_DE_REDE, 0, { error: "rede", mensagem: ERRO_DE_REDE });
  }
  const corpo = (await res.json().catch(() => null)) as CorpoDoErro | null;
  if (!res.ok) {
    // 401 → login (limpa o cookie antes, para não cair em loop com o middleware).
    if (res.status === 401 && typeof window !== "undefined") {
      const { limparCookieSessao } = await import("@/lib/auth/clientSession");
      limparCookieSessao();
      window.location.href = "/login";
    }
    // 404 vem sem `mensagem` ({ error: "nao_encontrado" }): não mostrar o código cru.
    const mensagem =
      corpo?.mensagem ??
      (res.status === 404 ? NAO_ENCONTRADO : corpo?.error) ??
      `O serviço educacional respondeu ${res.status}.`;
    throw new EducacionalError(mensagem, res.status, corpo ?? { error: mensagem });
  }
  return corpo;
}

function chamar(p: Pedido): Promise<unknown> {
  return FONTE_EDUCACIONAL === "api" ? transporteApi(p) : transporteMock(p);
}

function falhaSimulada(simular: Simular): void {
  if (FONTE_EDUCACIONAL === "api") return;
  if (simular === "erro") throw new EducacionalError("Não foi possível falar com o serviço educacional.", 502);
  if (simular === "sem_permissao") throw new EducacionalError("Sem permissão", 403);
}

const id = (v: string) => encodeURIComponent(v);

// Toda escrita em aluno devolve o AlunoDetalhe recalculado.
async function escreverAluno(p: Pedido): Promise<AlunoDetalhe> {
  const a = validarAlunoDetalhe(await chamar(p));
  if (!a) throw new EducacionalError("Gravado, mas a resposta veio fora do contrato.", 502);
  return a;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function buscarResumo(simular?: Simular): Promise<ResumoEducacional> {
  falhaSimulada(simular);
  const r = ResumoEducacionalSchema.safeParse(await chamar({ metodo: "GET", caminho: "resumo" }));
  if (!r.success) throw new EducacionalError("Resumo educacional fora do contrato.", 502);
  if (simular === "vazio" && FONTE_EDUCACIONAL === "mock") {
    return {
      ...r.data,
      kpis: { health_score_medio: null, alunos_ativos: 0, intervencoes_sla: 0, em_risco: 0 },
      funil: r.data.funil.map((e) => ({ ...e, alunos: 0 })),
      sinais: { upgrade: 0, renovacao: 0, prova_social: 0 },
    };
  }
  return r.data;
}

export async function buscarAlunos(f: FiltrosAlunos, simular?: Simular): Promise<PaginaAlunos> {
  falhaSimulada(simular);
  if (simular === "vazio" && FONTE_EDUCACIONAL === "mock") return { itens: [], total: 0, descartados: 0 };
  const pagina = Math.max(1, f.pagina ?? 1);
  // Mais de um status de checkpoint (o card de SLA: pendente + não respondeu): o
  // backend filtra um por vez. Busca a lista inteira, na mesma ordem, e fica com
  // quem tem o próximo checkpoint (devolvido pela API) num dos status.
  const varios = f.checkpoint && f.checkpoint.length > 1 ? f.checkpoint : null;
  const query = queryDaApi(varios ? { ...f, checkpoint: [], pagina: 1, por_pagina: "todos" } : { ...f, pagina });
  const corpo = (await chamar({ metodo: "GET", caminho: "alunos", query })) as {
    itens?: unknown;
    total?: unknown;
  } | null;
  const { validos, descartados } = validarLista(corpo?.itens, AlunoLinhaSchema, "aluno");
  if (varios) {
    const itens = validos.filter((a) => a.proximo_checkpoint && varios.includes(a.proximo_checkpoint.status));
    if (f.por_pagina === "todos") return { itens, total: itens.length, descartados };
    const tamanho = f.por_pagina ?? TAMANHO_PAGINA;
    return { itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho), total: itens.length, descartados };
  }
  const total = typeof corpo?.total === "number" ? corpo.total : validos.length;
  return { itens: validos, total, descartados };
}

export async function buscarAluno(alunoId: string, simular?: Simular): Promise<AlunoDetalhe> {
  falhaSimulada(simular);
  const a = validarAlunoDetalhe(await chamar({ metodo: "GET", caminho: `alunos/${id(alunoId)}` }));
  if (!a) throw new EducacionalError("Aluno fora do contrato.", 502);
  return a;
}

export async function buscarHistorico(
  alunoId: string,
  opcoes: { pagina?: number; entidade?: EntidadeHistorico | null } = {},
): Promise<PaginaHistorico> {
  // por_pagina sempre: o padrão do backend é 50, a tela pagina de 20 em 20.
  const qs = new URLSearchParams({ por_pagina: String(TAMANHO_PAGINA_HISTORICO) });
  if (opcoes.pagina && opcoes.pagina > 1) qs.set("pagina", String(opcoes.pagina));
  if (opcoes.entidade) qs.set("entidade", opcoes.entidade);
  const corpo = (await chamar({ metodo: "GET", caminho: `alunos/${id(alunoId)}/historico`, query: qs.toString() })) as {
    itens?: unknown;
    total?: unknown;
  } | null;
  const { validos } = validarLista(corpo?.itens, ItemHistoricoSchema, "histórico");
  return { itens: validos, total: typeof corpo?.total === "number" ? corpo.total : validos.length };
}

// Config com tolerância item a item (inclui inativos; quem mostra listas de escolha filtra `ativo`).
function validarConfig(bruto: unknown): Config {
  const c = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  return {
    etapas: validarLista(c.etapas, EtapaSchema, "etapa").validos.sort((a, b) => a.ordem - b.ordem),
    checkpoints_modelo: validarLista(c.checkpoints_modelo, CheckpointModeloSchema, "checkpoint modelo").validos.sort(
      (a, b) => a.ordem - b.ordem,
    ),
    tipos_intervencao: validarLista(c.tipos_intervencao, TipoIntervencaoSchema, "tipo de intervenção").validos,
    responsaveis: validarLista(c.responsaveis, ResponsavelSchema, "responsável").validos,
    sync_planilha_erros: typeof c.sync_planilha_erros === "number" ? c.sync_planilha_erros : 0,
  };
}

export async function buscarConfig(): Promise<Config> {
  return validarConfig(await chamar({ metodo: "GET", caminho: "config" }));
}

// Lista enxuta para a busca de aluno do modal de intervenção.
export async function buscarNomesDeAlunos(): Promise<{ id: string; nome: string; versao: number }[]> {
  const { itens } = await buscarAlunos({ ordem: "nome", por_pagina: "todos" });
  return itens.map((a) => ({ id: a.id, nome: a.nome, versao: a.versao }));
}

// ---------------------------------------------------------------------------
// Escrita em alunos (toda escrita envia a versão do aluno — Q5)
// ---------------------------------------------------------------------------

export function criarAluno(dados: NovoAluno): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "POST", caminho: "alunos", corpo: dados });
}

export function atualizarAluno(alunoId: string, versao: number, campos: CamposDiretosAluno): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "PATCH", caminho: `alunos/${id(alunoId)}`, corpo: { ...campos, versao } });
}

export function arquivarAluno(alunoId: string, versao: number, arquivar = true): Promise<AlunoDetalhe> {
  const acao = arquivar ? "arquivar" : "reativar";
  return escreverAluno({ metodo: "POST", caminho: `alunos/${id(alunoId)}/${acao}`, corpo: { versao } });
}

export function ajustarCampo(
  alunoId: string,
  versao: number,
  campo: CampoAjustavel,
  valor: unknown,
  motivo: string,
): Promise<AlunoDetalhe> {
  return escreverAluno({
    metodo: "PUT",
    caminho: `alunos/${id(alunoId)}/ajustes/${campo}`,
    corpo: { valor, motivo, versao },
  });
}

export function voltarAoAutomatico(alunoId: string, versao: number, campo: CampoAjustavel): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "DELETE", caminho: `alunos/${id(alunoId)}/ajustes/${campo}`, corpo: { versao } });
}

export function criarCheckpoint(alunoId: string, versao: number, campos: CamposCheckpoint): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "POST", caminho: `alunos/${id(alunoId)}/checkpoints`, corpo: { ...campos, versao } });
}

export function atualizarCheckpoint(checkpointId: string, versao: number, campos: CamposCheckpoint): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "PATCH", caminho: `checkpoints/${id(checkpointId)}`, corpo: { ...campos, versao } });
}

export function arquivarCheckpoint(checkpointId: string, versao: number): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "POST", caminho: `checkpoints/${id(checkpointId)}/arquivar`, corpo: { versao } });
}

export type NovaIntervencao = {
  aluno_id: string;
  tipo_id: string;
  descricao: string;
  responsavel_id?: string | null;
  prazo?: string | null;
};

export function criarIntervencao(versao: number, dados: NovaIntervencao): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "POST", caminho: "intervencoes", corpo: { ...dados, versao } });
}

export function atualizarIntervencao(intervencaoId: string, versao: number, campos: CamposIntervencao): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "PATCH", caminho: `intervencoes/${id(intervencaoId)}`, corpo: { ...campos, versao } });
}

export function arquivarIntervencao(intervencaoId: string, versao: number): Promise<AlunoDetalhe> {
  return escreverAluno({ metodo: "POST", caminho: `intervencoes/${id(intervencaoId)}/arquivar`, corpo: { versao } });
}

// ---------------------------------------------------------------------------
// Escrita em configuração (sem versão: não é escrita em aluno)
// ---------------------------------------------------------------------------

export type ColecaoConfig = "etapas" | "checkpoints-modelo" | "tipos-intervencao" | "responsaveis";

export async function criarItemConfig(colecao: ColecaoConfig, campos: Record<string, unknown>): Promise<Config> {
  return validarConfig(await chamar({ metodo: "POST", caminho: `config/${colecao}`, corpo: campos }));
}

export async function atualizarItemConfig(
  colecao: ColecaoConfig,
  itemId: string,
  campos: Record<string, unknown>,
): Promise<Config> {
  return validarConfig(await chamar({ metodo: "PATCH", caminho: `config/${colecao}/${id(itemId)}`, corpo: campos }));
}

// Só no modo demonstração: volta o banco do navegador à semente.
export async function restaurarDemonstracao(): Promise<void> {
  if (FONTE_EDUCACIONAL !== "mock") return;
  const [{ restaurarBanco }, { hojeBR }] = await Promise.all([import("./mock/banco"), import("./mock/motor")]);
  restaurarBanco(hojeBR());
}
