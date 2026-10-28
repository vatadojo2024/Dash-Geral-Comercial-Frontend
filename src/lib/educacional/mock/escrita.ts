import {
  AUTORIZACOES_PROVA_SOCIAL,
  CAMPOS_AJUSTAVEIS,
  LIMITE_LOTE,
  MOTIVO_MINIMO,
  NIVEIS_INICIAIS,
  CAMPOS_ROTEIRO,
  MENTORIAS,
  STATUS_ALUNO,
  STATUS_CHECKPOINT,
  ResultadoAnaliseSchema,
  TIPOS_RESPONSAVEL,
  type AlunoDetalhe,
  type CampoAjustavel,
  type CamposCheckpoint,
  type CamposDiretosAluno,
  type CamposIntervencao,
  type CheckpointModelo,
  type Etapa,
  type EntidadeHistorico,
  type NovoAluno,
  type PreviaTroca,
  type Programa,
  type RespostaLote,
  type ResultadoLoteAluno,
  type Responsavel,
  type TipoIntervencao,
  type Usuario,
} from "../contrato";
import { marcoDe } from "../contrato";
import { limparTranscricao, MARCA_DE_ERRO, resultadoDeExemplo, statusDe, TEXTO_DOCX_EXEMPLO } from "./analises";
import { dataPrevistaDoModelo, montarAluno, naJornada, somarMeses } from "./motor";
import { ErroDaApi, type AlunoBanco, type AnaliseBanco, type Banco, type CheckpointBanco } from "./tipos";

// ---------------------------------------------------------------------------
// Escritas do modo demonstração, no MESMO caminho da seção 5 do backend:
// valida (400) → confere a versão (409 com o aluno atual) → grava e incrementa
// a versão → registra no histórico uma linha por campo → responde o aluno já
// recalculado. Cada função MUDA o banco recebido (o chamador passa uma cópia e
// só persiste se não houver erro — como uma transação).
// ---------------------------------------------------------------------------

export type Contexto = { usuario: Usuario; hoje: string; agora: string };

let contador = 0;
export function novoId(prefixo: string): string {
  contador += 1;
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${contador}`;
  return `${prefixo}-${aleatorio}`;
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function erro400(campo: string, mensagem: string): never {
  throw new ErroDaApi(400, { error: "validacao", campo, mensagem });
}

function texto(campo: string, v: unknown, obrigatorio: boolean): string | null {
  if (v == null || (typeof v === "string" && v.trim() === "")) {
    if (obrigatorio) erro400(campo, "Campo obrigatório.");
    return null;
  }
  if (typeof v !== "string") erro400(campo, "Texto inválido.");
  return v.trim();
}

function data(campo: string, v: unknown, obrigatorio: boolean): string | null {
  if (v == null || v === "") {
    if (obrigatorio) erro400(campo, "Data obrigatória.");
    return null;
  }
  if (typeof v !== "string" || !RE_DATA.test(v)) erro400(campo, "Use uma data no formato AAAA-MM-DD.");
  return v;
}

function umDe<T extends string>(campo: string, valores: readonly T[], v: unknown): T {
  if (typeof v !== "string" || !(valores as readonly string[]).includes(v)) erro400(campo, "Valor fora da lista permitida.");
  return v as T;
}

function alunoOu404(banco: Banco, id: string): AlunoBanco {
  const a = banco.alunos.find((x) => x.id === id);
  if (!a) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Aluno não encontrado." });
  return a;
}

function conferirVersao(banco: Banco, a: AlunoBanco, versao: number, ctx: Contexto) {
  if (versao !== a.versao) {
    throw new ErroDaApi(409, { error: "versao", aluno: montarAluno(banco, a, ctx.hoje) });
  }
}

function registrar(
  banco: Banco,
  ctx: Contexto,
  aluno: AlunoBanco,
  entidade: EntidadeHistorico,
  entidadeId: string,
  campo: string,
  antes: unknown,
  depois: unknown,
  motivo: string | null = null,
) {
  banco.historico.push({
    id: novoId("hist"),
    aluno_id: aluno.id,
    entidade,
    entidade_id: entidadeId,
    campo,
    valor_antes: antes ?? null,
    valor_depois: depois ?? null,
    motivo,
    usuario: ctx.usuario,
    em: ctx.agora,
  });
}

function etapaAtiva(banco: Banco, id: unknown): Etapa {
  const e = banco.config.etapas.find((x) => x.id === id);
  if (!e || !e.ativo) erro400("etapa_id", "Etapa inexistente ou inativa.");
  return e;
}

function responsavelAtivo(banco: Banco, id: unknown): Responsavel | null {
  if (id == null || id === "") return null;
  const r = banco.config.responsaveis.find((x) => x.id === id);
  if (!r || !r.ativo) erro400("responsavel_id", "Responsável inexistente ou inativo.");
  return r;
}

function tipoAtivo(banco: Banco, id: unknown): TipoIntervencao {
  const t = banco.config.tipos_intervencao.find((x) => x.id === id);
  if (!t || !t.ativo) erro400("tipo_id", "Tipo de intervenção inexistente ou inativo.");
  return t;
}

const fim = (banco: Banco, a: AlunoBanco, ctx: Contexto): AlunoDetalhe => {
  a.versao += 1;
  return montarAluno(banco, a, ctx.hoje);
};

// ---------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------

export function patchAluno(banco: Banco, id: string, campos: CamposDiretosAluno, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, id);
  conferirVersao(banco, a, versao, ctx);
  const novos: Partial<AlunoBanco> = {};
  for (const [chave, valor] of Object.entries(campos)) {
    switch (chave) {
      case "nome":
        novos[chave] = texto(chave, valor, true) as string;
        break;
      case "mentoria":
        erro400("mentoria", "A mentoria vem do programa; para mudar, use Trocar programa.");
        break;
      case "objetivo":
      case "proxima_acao":
      case "diagnostico":
      case "motivo_risco":
      case "observacoes":
        novos[chave] = texto(chave, valor, false);
        break;
      case "data_entrada":
        novos.data_entrada = data(chave, valor, true) as string;
        break;
      case "data_termino":
      case "proxima_acao_prazo":
        novos[chave] = data(chave, valor, false);
        break;
      case "nivel_inicial":
        novos.nivel_inicial = umDe(chave, NIVEIS_INICIAIS, valor);
        break;
      case "status_aluno":
        novos.status_aluno = umDe(chave, STATUS_ALUNO, valor);
        break;
      case "autorizacao_prova_social":
        novos.autorizacao_prova_social = umDe(chave, AUTORIZACOES_PROVA_SOCIAL, valor);
        break;
      case "etapa_id":
        novos.etapa_id = etapaAtiva(banco, valor).id;
        break;
      case "responsavel_id":
        novos.responsavel_id = responsavelAtivo(banco, valor)?.id ?? null;
        break;
      case "programa_id":
        erro400("programa_id", "Para mudar o programa, use Trocar programa.");
        break;
      default:
        erro400(chave, "Campo desconhecido.");
    }
  }
  // Mudança de etapa (inclusive pelo Kanban): etapa_desde = hoje → dias na etapa
  // zeram, e o ajuste manual de dias na etapa cai (decisão de 27/10, backend a971add).
  const trocouEtapa = Boolean(novos.etapa_id && novos.etapa_id !== a.etapa_id);
  if (trocouEtapa) novos.etapa_desde = ctx.hoje;
  const nomeEtapa = (eid: string) => banco.config.etapas.find((e) => e.id === eid)?.nome ?? eid;
  for (const [chave, depois] of Object.entries(novos) as [keyof AlunoBanco, unknown][]) {
    const antes = a[chave];
    if (antes === depois) continue;
    if (chave === "etapa_id") registrar(banco, ctx, a, "aluno", a.id, "etapa", nomeEtapa(antes as string), nomeEtapa(depois as string));
    else if (chave === "responsavel_id") {
      const nome = (rid: unknown) => banco.config.responsaveis.find((r) => r.id === rid)?.nome ?? null;
      registrar(banco, ctx, a, "aluno", a.id, "responsavel", nome(antes), nome(depois));
    } else registrar(banco, ctx, a, "aluno", a.id, chave, antes, depois);
    (a as Record<string, unknown>)[chave] = depois;
  }
  const ajusteDias = trocouEtapa && banco.ajustes.find((x) => x.aluno_id === a.id && x.campo === "dias_na_etapa" && x.ativo);
  if (ajusteDias) {
    ajusteDias.ativo = false;
    registrar(banco, ctx, a, "ajuste", a.id, "dias_na_etapa", ajusteDias.valor, 0, "Removido por mudança de etapa");
  }
  return fim(banco, a, ctx);
}

export function arquivarAluno(banco: Banco, id: string, arquivar: boolean, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, id);
  conferirVersao(banco, a, versao, ctx);
  const antes = Boolean(a.arquivado_em);
  if (antes !== arquivar) {
    a.arquivado_em = arquivar ? ctx.agora : null;
    registrar(banco, ctx, a, "aluno", a.id, "arquivado", antes, arquivar);
  }
  return fim(banco, a, ctx);
}

export function criarAluno(banco: Banco, dados: NovoAluno, ctx: Contexto) {
  const etapaId = dados.etapa_id ?? banco.config.etapas.filter((e) => e.ativo).sort((x, y) => x.ordem - y.ordem)[0]?.id;
  // Como o backend: o programa é obrigatório e dá a mentoria (recusada aqui), o
  // início (= entrada), o término padrão (início + duração) e os checkpoints.
  if ("mentoria" in dados) erro400("mentoria", "A mentoria vem do programa.");
  if (!dados.programa_id) erro400("programa_id", "Escolha o programa.");
  const programa = programaAtivo(banco, dados.programa_id);
  const entrada = data("data_entrada", dados.data_entrada, true) as string;
  const a: AlunoBanco = {
    id: novoId("aluno"),
    nome: texto("nome", dados.nome, true) as string,
    mentoria: programa.mentoria,
    data_entrada: entrada,
    data_termino: data("data_termino", dados.data_termino, false) ?? somarMeses(entrada, programa.duracao_meses),
    programa_id: programa.id,
    data_inicio_programa: entrada,
    objetivo: texto("objetivo", dados.objetivo, false),
    nivel_inicial: umDe("nivel_inicial", NIVEIS_INICIAIS, dados.nivel_inicial),
    status_aluno: dados.status_aluno ? umDe("status_aluno", STATUS_ALUNO, dados.status_aluno) : "ativo",
    etapa_id: etapaAtiva(banco, etapaId).id,
    etapa_desde: ctx.hoje,
    responsavel_id: responsavelAtivo(banco, dados.responsavel_id)?.id ?? null,
    proxima_acao: null,
    proxima_acao_prazo: null,
    diagnostico: null,
    motivo_risco: null,
    autorizacao_prova_social: dados.autorizacao_prova_social
      ? umDe("autorizacao_prova_social", AUTORIZACOES_PROVA_SOCIAL, dados.autorizacao_prova_social)
      : "pendente",
    observacoes: texto("observacoes", dados.observacoes, false),
    highlights: [],
    arquivado_em: null,
    versao: 0,
  };
  banco.alunos.push(a);
  // Checkpoints a partir do modelo ATIVO do programa, status previsto.
  modelosDoPrograma(banco, programa.id).forEach((m, i) => {
    banco.checkpoints.push({
      id: novoId("cp"),
      aluno_id: a.id,
      modelo_id: m.id,
      nome: m.nome,
      ordem: i + 1,
      data_prevista: dataPrevista(m, a.data_entrada),
      data_realizada: null,
      status: "previsto",
      big_win: m.big_win,
      observacao: null,
      arquivado_em: null,
    });
  });
  registrar(banco, ctx, a, "aluno", a.id, "criado", null, a.nome);
  return fim(banco, a, ctx);
}

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Ajuste manual (seção 3 do backend)
// ---------------------------------------------------------------------------

export function ajustar(banco: Banco, id: string, campo: string, valor: unknown, motivo: unknown, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, id);
  conferirVersao(banco, a, versao, ctx);
  if (!(campo in CAMPOS_AJUSTAVEIS)) erro400("campo", "Campo sem ajuste manual.");
  const nome = campo as CampoAjustavel;
  const r = CAMPOS_AJUSTAVEIS[nome].safeParse(valor);
  if (!r.success) erro400("valor", "Valor fora do domínio do campo.");
  if (typeof motivo !== "string" || motivo.trim().length < MOTIVO_MINIMO) {
    erro400("motivo", `O motivo precisa ter pelo menos ${MOTIVO_MINIMO} caracteres.`);
  }
  const antes = montarAluno(banco, a, ctx.hoje);
  // Um novo ajuste desativa o anterior; os dois ficam no histórico.
  banco.ajustes.forEach((x) => {
    if (x.aluno_id === a.id && x.campo === nome) x.ativo = false;
  });
  banco.ajustes.push({
    id: novoId("aj"),
    aluno_id: a.id,
    campo: nome,
    valor: r.data,
    motivo: motivo.trim(),
    ajustado_por: ctx.usuario,
    ajustado_em: ctx.agora,
    ativo: true,
  });
  registrar(banco, ctx, a, "ajuste", a.id, nome, valorEfetivo(antes, nome), r.data, motivo.trim());
  return fim(banco, a, ctx);
}

export function removerAjuste(banco: Banco, id: string, campo: string, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, id);
  conferirVersao(banco, a, versao, ctx);
  const ativo = banco.ajustes.find((x) => x.aluno_id === a.id && x.campo === campo && x.ativo);
  if (ativo) {
    const antes = montarAluno(banco, a, ctx.hoje);
    ativo.ativo = false;
    const depois = montarAluno(banco, a, ctx.hoje);
    registrar(
      banco,
      ctx,
      a,
      "ajuste",
      a.id,
      campo,
      valorEfetivo(antes, campo as CampoAjustavel),
      valorEfetivo(depois, campo as CampoAjustavel),
      "Voltou ao automático",
    );
  }
  return fim(banco, a, ctx);
}

export function valorEfetivo(a: AlunoDetalhe, campo: CampoAjustavel): unknown {
  const mapa: Record<CampoAjustavel, { valor: unknown }> = {
    health_score: a.health_score,
    faixa_saude: a.faixa_saude,
    dias_na_etapa: a.dias_na_etapa,
    ultima_atividade: a.ultima_atividade,
    dias_sem_atividade: a.dias_sem_atividade,
    status_financeiro: a.status_financeiro,
    ltv: a.ltv,
    progresso_consumiu: a.progresso.consumiu,
    progresso_entendeu: a.progresso.entendeu,
    progresso_aplicou: a.progresso.aplicou,
    progresso_validou: a.progresso.validou,
    sinal_upgrade: a.sinais.upgrade,
    sinal_renovacao: a.sinais.renovacao,
    sinal_prova_social: a.sinais.prova_social,
  };
  return mapa[campo].valor;
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

function checkpointOu404(banco: Banco, id: string) {
  const c = banco.checkpoints.find((x) => x.id === id && !x.arquivado_em);
  if (!c) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Checkpoint não encontrado." });
  return c;
}

export function criarCheckpoint(banco: Banco, alunoId: string, campos: CamposCheckpoint, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, alunoId);
  conferirVersao(banco, a, versao, ctx);
  const ordem = Math.max(0, ...banco.checkpoints.filter((c) => c.aluno_id === a.id).map((c) => c.ordem)) + 1;
  const status = campos.status ? umDe("status", STATUS_CHECKPOINT, campos.status) : "previsto";
  const c = {
    id: novoId("cp"),
    aluno_id: a.id,
    modelo_id: null,
    nome: texto("nome", campos.nome, true) as string,
    ordem,
    data_prevista: data("data_prevista", campos.data_prevista, false),
    data_realizada: data("data_realizada", campos.data_realizada, false) ?? (status === "realizado" ? ctx.hoje : null),
    status,
    big_win: Boolean(campos.big_win),
    observacao: texto("observacao", campos.observacao, false),
    arquivado_em: null,
  };
  banco.checkpoints.push(c);
  registrar(banco, ctx, a, "checkpoint", c.id, `${c.nome} · criado`, null, c.nome);
  return fim(banco, a, ctx);
}

export function patchCheckpoint(banco: Banco, id: string, campos: CamposCheckpoint, versao: number, ctx: Contexto) {
  const c = checkpointOu404(banco, id);
  const a = alunoOu404(banco, c.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  const novos: Partial<typeof c> = {};
  if ("nome" in campos) novos.nome = texto("nome", campos.nome, true) as string;
  if ("data_prevista" in campos) novos.data_prevista = data("data_prevista", campos.data_prevista, false);
  if ("data_realizada" in campos) novos.data_realizada = data("data_realizada", campos.data_realizada, false);
  if ("observacao" in campos) novos.observacao = texto("observacao", campos.observacao, false);
  if ("big_win" in campos) novos.big_win = Boolean(campos.big_win);
  if ("status" in campos) novos.status = umDe("status", STATUS_CHECKPOINT, campos.status);
  // Checkpoint realizado exige data: sem data, a API usa hoje.
  const status = novos.status ?? c.status;
  const realizada = "data_realizada" in novos ? novos.data_realizada : c.data_realizada;
  if (status === "realizado" && !realizada) novos.data_realizada = ctx.hoje;
  const rotulo = novos.nome ?? c.nome;
  for (const [chave, depois] of Object.entries(novos)) {
    const antes = (c as Record<string, unknown>)[chave];
    if (antes === depois) continue;
    registrar(banco, ctx, a, "checkpoint", c.id, `${rotulo} · ${chave}`, antes, depois);
    (c as Record<string, unknown>)[chave] = depois;
  }
  return fim(banco, a, ctx);
}

export function arquivarCheckpoint(banco: Banco, id: string, versao: number, ctx: Contexto) {
  const c = checkpointOu404(banco, id);
  const a = alunoOu404(banco, c.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  c.arquivado_em = ctx.agora;
  registrar(banco, ctx, a, "checkpoint", c.id, `${c.nome} · arquivado`, false, true);
  return fim(banco, a, ctx);
}

// ---------------------------------------------------------------------------
// Intervenções
// ---------------------------------------------------------------------------

function intervencaoOu404(banco: Banco, id: string) {
  const i = banco.intervencoes.find((x) => x.id === id && !x.arquivado_em);
  if (!i) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Intervenção não encontrada." });
  return i;
}

export function criarIntervencao(
  banco: Banco,
  dados: { aluno_id: string; tipo_id: string; descricao: string; responsavel_id?: string | null; prazo?: string | null },
  versao: number,
  ctx: Contexto,
) {
  const a = alunoOu404(banco, dados.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  const i = {
    id: novoId("int"),
    aluno_id: a.id,
    tipo_id: tipoAtivo(banco, dados.tipo_id).id,
    descricao: texto("descricao", dados.descricao, true) as string,
    responsavel_id: responsavelAtivo(banco, dados.responsavel_id)?.id ?? null,
    prazo: data("prazo", dados.prazo, false),
    status: "aberta" as const,
    concluida_em: null,
    criada_por: ctx.usuario,
    criada_em: ctx.agora,
    arquivado_em: null,
  };
  banco.intervencoes.push(i);
  registrar(banco, ctx, a, "intervencao", i.id, "criada", null, i.descricao);
  return fim(banco, a, ctx);
}

export function patchIntervencao(banco: Banco, id: string, campos: CamposIntervencao, versao: number, ctx: Contexto) {
  const i = intervencaoOu404(banco, id);
  const a = alunoOu404(banco, i.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  const novos: Partial<typeof i> = {};
  if ("tipo_id" in campos) novos.tipo_id = tipoAtivo(banco, campos.tipo_id).id;
  if ("descricao" in campos) novos.descricao = texto("descricao", campos.descricao, true) as string;
  if ("responsavel_id" in campos) novos.responsavel_id = responsavelAtivo(banco, campos.responsavel_id)?.id ?? null;
  if ("prazo" in campos) novos.prazo = data("prazo", campos.prazo, false);
  if ("status" in campos) {
    novos.status = umDe("status", ["aberta", "concluida"] as const, campos.status);
    // Concluir grava a data; reabrir limpa.
    novos.concluida_em = novos.status === "concluida" ? (i.concluida_em ?? ctx.agora) : null;
  }
  // No histórico, tipo e responsável vão pelo nome (como no aluno).
  const nomeTipo = (tid: unknown) => banco.config.tipos_intervencao.find((t) => t.id === tid)?.nome ?? null;
  const nomeResp = (rid: unknown) => banco.config.responsaveis.find((r) => r.id === rid)?.nome ?? null;
  for (const [chave, depois] of Object.entries(novos)) {
    const antes = (i as Record<string, unknown>)[chave];
    if (antes === depois) continue;
    if (chave === "tipo_id") registrar(banco, ctx, a, "intervencao", i.id, "tipo", nomeTipo(antes), nomeTipo(depois));
    else if (chave === "responsavel_id") registrar(banco, ctx, a, "intervencao", i.id, "responsavel", nomeResp(antes), nomeResp(depois));
    else if (chave !== "concluida_em") registrar(banco, ctx, a, "intervencao", i.id, chave, antes, depois);
    (i as Record<string, unknown>)[chave] = depois;
  }
  return fim(banco, a, ctx);
}

export function arquivarIntervencao(banco: Banco, id: string, versao: number, ctx: Contexto) {
  const i = intervencaoOu404(banco, id);
  const a = alunoOu404(banco, i.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  i.arquivado_em = ctx.agora;
  registrar(banco, ctx, a, "intervencao", i.id, "arquivada", false, true);
  return fim(banco, a, ctx);
}

// ---------------------------------------------------------------------------
// Configuração (seção 4.3 do backend). Mudança no modelo vale só para alunos novos.
// ---------------------------------------------------------------------------

type ItemConfig = { id: string; ativo: boolean };
export type ColecaoConfig = "etapas" | "checkpoints_modelo" | "tipos_intervencao" | "responsaveis" | "programas";

function validarItem(banco: Banco, colecao: ColecaoConfig, campos: Record<string, unknown>, parcial: boolean) {
  const idsDosProgramas = (banco.config.programas ?? []).map((p) => p.id);
  const v: Record<string, unknown> = {};
  if (!parcial || "nome" in campos) v.nome = texto("nome", campos.nome, true);
  if ("ativo" in campos) v.ativo = Boolean(campos.ativo);
  if ("ordem" in campos) {
    if (!Number.isInteger(campos.ordem)) erro400("ordem", "Ordem inválida.");
    v.ordem = campos.ordem;
  }
  if (colecao === "programas") {
    if (!parcial || "mentoria" in campos) v.mentoria = umDe("mentoria", MENTORIAS, campos.mentoria);
    if (!parcial || "duracao_meses" in campos) {
      const d = campos.duracao_meses;
      if (!Number.isInteger(d) || (d as number) < 1) erro400("duracao_meses", "Use um número inteiro de meses, 1 ou mais.");
      v.duracao_meses = d;
    }
    if ("observacoes" in campos) v.observacoes = texto("observacoes", campos.observacoes, false);
  }
  if (colecao === "checkpoints_modelo") {
    if ("programa_id" in campos) {
      if (!(idsDosProgramas as string[]).includes(campos.programa_id as string)) erro400("programa_id", "Programa inexistente.");
      v.programa_id = campos.programa_id;
    }
    // Roteiro: os 4 textos soltos (ou num objeto `roteiro`; o formato final será confirmado).
    const r = campos.roteiro && typeof campos.roteiro === "object" ? (campos.roteiro as Record<string, unknown>) : campos;
    if (campos.roteiro !== undefined || CAMPOS_ROTEIRO.some((k) => k in campos)) {
      v.roteiro = Object.fromEntries(CAMPOS_ROTEIRO.map((k) => [k, texto(k, r[k], false)]));
    }
    // Contagem: dias_apos_entrada OU meses_apos_inicio (a combinação é conferida ao gravar).
    if ("dias_apos_entrada" in campos) {
      const d = campos.dias_apos_entrada;
      if (d != null && (!Number.isInteger(d) || (d as number) < 0)) erro400("dias_apos_entrada", "Use um número inteiro de dias, 0 ou mais.");
      v.dias_apos_entrada = d ?? null;
    }
    if ("meses_apos_inicio" in campos) {
      const m = campos.meses_apos_inicio;
      if (m != null && (!Number.isInteger(m) || (m as number) < 1)) erro400("meses_apos_inicio", "Use um número inteiro de meses, 1 ou mais.");
      v.meses_apos_inicio = m ?? null;
    }
    if ("prazo_sla_dias" in campos) {
      const p = campos.prazo_sla_dias;
      if (p != null && (!Number.isInteger(p) || (p as number) < 0)) erro400("prazo_sla_dias", "Use um número inteiro de dias ou deixe em branco.");
      v.prazo_sla_dias = p ?? null;
    }
    if ("big_win" in campos) v.big_win = Boolean(campos.big_win);
  }
  if (colecao === "responsaveis" && (!parcial || "tipo" in campos)) v.tipo = umDe("tipo", TIPOS_RESPONSAVEL, campos.tipo);
  return v;
}

// Checkpoint padrão: exatamente uma contagem preenchida (a outra null, nunca 0).
function conferirContagem(c: Record<string, unknown>) {
  const dias = c.dias_apos_entrada != null;
  const meses = c.meses_apos_inicio != null;
  if (dias === meses) {
    erro400("dias_apos_entrada", "Informe dias após a entrada OU meses após o início (só um dos dois).");
  }
}

export function criarItemConfig(banco: Banco, colecao: ColecaoConfig, campos: Record<string, unknown>) {
  const lista = banco.config[colecao] as unknown as (ItemConfig & { ordem?: number })[];
  const v = validarItem(banco, colecao, campos, false);
  const base: Record<string, unknown> = { id: novoId(colecao.slice(0, 4)), ativo: true, ...v };
  if (colecao === "etapas" || colecao === "checkpoints_modelo" || colecao === "programas") {
    base.ordem = Math.max(0, ...lista.map((x) => x.ordem ?? 0)) + 1;
  }
  if (colecao === "checkpoints_modelo") {
    base.prazo_sla_dias = base.prazo_sla_dias ?? null;
    base.big_win = base.big_win ?? false;
    base.programa_id = base.programa_id ?? null;
    base.roteiro = base.roteiro ?? null;
    base.dias_apos_entrada = base.dias_apos_entrada ?? null;
    base.meses_apos_inicio = base.meses_apos_inicio ?? null;
    conferirContagem(base);
  }
  if (colecao === "programas") base.observacoes = base.observacoes ?? null;
  lista.push(base as unknown as ItemConfig);
  return banco.config;
}

export function patchItemConfig(banco: Banco, colecao: ColecaoConfig, id: string, campos: Record<string, unknown>) {
  const lista = banco.config[colecao] as unknown as (ItemConfig & Record<string, unknown>)[];
  const item = lista.find((x) => x.id === id);
  if (!item) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Item não encontrado." });
  const v = validarItem(banco, colecao, campos, true);
  // Inativar etapa com alunos ativos → 409 com a contagem (Q4).
  if (colecao === "etapas" && v.ativo === false && item.ativo) {
    const n = banco.alunos.filter((a) => naJornada(a) && a.etapa_id === id).length;
    if (n > 0) {
      throw new ErroDaApi(409, {
        error: "etapa_com_alunos",
        alunos: n,
        mensagem: `Esta etapa ainda tem ${n} ${n === 1 ? "aluno" : "alunos"}. Mova-os antes de inativar.`,
      });
    }
  }
  if (colecao === "checkpoints_modelo" && ("dias_apos_entrada" in v || "meses_apos_inicio" in v)) conferirContagem({ ...item, ...v });
  // Inativar programa com alunos na jornada → 409 com a contagem (como a etapa).
  if (colecao === "programas" && v.ativo === false && item.ativo) {
    const n = banco.alunos.filter((a) => naJornada(a) && a.programa_id === id).length;
    if (n > 0) {
      throw new ErroDaApi(409, {
        error: "programa_com_alunos",
        alunos: n,
        mensagem: `Este programa ainda tem ${n} ${n === 1 ? "aluno" : "alunos"}. Troque o programa deles antes de inativar.`,
      });
    }
  }
  Object.assign(item, v);
  return banco.config;
}

// ---------------------------------------------------------------------------
// Fase 3 — lote (seção 3 do backend): atômico por aluno. Cada aluno roda numa
// cópia do banco; erro descarta só a cópia dele. Uma conferência de versão e um
// incremento por aluno; histórico com o mesmo lote_id.
// ---------------------------------------------------------------------------

type ItemDoLote = Record<string, unknown> & { id?: unknown; novo?: unknown; arquivar?: unknown };

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const listaDe = (campo: string, v: unknown): ItemDoLote[] => {
  if (v == null) return [];
  if (!Array.isArray(v)) erro400(campo, "Envie uma lista.");
  return v.map(objeto);
};
function semChaves(o: Record<string, unknown>, ...chaves: string[]) {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !chaves.includes(k)));
}

function gravarAlunoDoLote(banco: Banco, item: Record<string, unknown>, motivoPadrao: string | null, ctx: Contexto): AlunoDetalhe {
  const alunoId = typeof item.aluno_id === "string" ? item.aluno_id : "";
  const a = alunoOu404(banco, alunoId);
  const versao = item.versao;
  if (typeof versao !== "number" || !Number.isInteger(versao)) erro400("versao", "Envie a versão do aluno.");
  conferirVersao(banco, a, versao, ctx);
  const campos = objeto(item.campos);
  const ajustes = listaDe("ajustes", item.ajustes);
  const checkpoints = listaDe("checkpoints", item.checkpoints);
  const intervencoes = listaDe("intervencoes", item.intervencoes);
  if (!Object.keys(campos).length && !ajustes.length && !checkpoints.length && !intervencoes.length) {
    erro400("aluno", "Nenhuma alteração para este aluno.");
  }
  // Cada passo usa a versão do momento; no fim, a versão sobe UMA vez.
  const v = () => a.versao;
  if (Object.keys(campos).length) patchAluno(banco, a.id, campos as CamposDiretosAluno, v(), ctx);
  for (const aj of ajustes) {
    const campo = typeof aj.campo === "string" ? aj.campo : "";
    if (aj.remover === true) removerAjuste(banco, a.id, campo, v(), ctx);
    else {
      const motivo = typeof aj.motivo === "string" && aj.motivo.trim() ? aj.motivo : motivoPadrao;
      if (!motivo) erro400("motivo", `Ajuste de ${campo} sem motivo: informe o motivo ou um motivo padrão.`);
      ajustar(banco, a.id, campo, aj.valor, motivo, v(), ctx);
    }
  }
  const doAluno = (lista: { id: string; aluno_id: string }[], id: unknown, campo: string) => {
    if (!lista.some((x) => x.id === id && x.aluno_id === a.id)) erro400(campo, "Item inexistente ou de outro aluno.");
    return id as string;
  };
  for (const c of checkpoints) {
    if (c.novo === true) criarCheckpoint(banco, a.id, semChaves(c, "novo", "id") as CamposCheckpoint, v(), ctx);
    else {
      const id = doAluno(banco.checkpoints, c.id, "checkpoints");
      if (c.arquivar === true) arquivarCheckpoint(banco, id, v(), ctx);
      else patchCheckpoint(banco, id, semChaves(c, "id") as CamposCheckpoint, v(), ctx);
    }
  }
  for (const i of intervencoes) {
    if (i.novo === true) {
      criarIntervencao(banco, { ...(semChaves(i, "novo", "id") as Record<string, string>), aluno_id: a.id } as never, v(), ctx);
    } else {
      const id = doAluno(banco.intervencoes, i.id, "intervencoes");
      if (i.arquivar === true) arquivarIntervencao(banco, id, v(), ctx);
      else patchIntervencao(banco, id, semChaves(i, "id") as CamposIntervencao, v(), ctx);
    }
  }
  a.versao = versao + 1;
  return montarAluno(banco, a, ctx.hoje);
}

export function salvarLote(banco: Banco, corpo: Record<string, unknown>, ctx: Contexto): RespostaLote {
  const alunos = corpo.alunos;
  if (!Array.isArray(alunos) || alunos.length === 0) erro400("alunos", "Envie ao menos um aluno.");
  if (alunos.length > LIMITE_LOTE) erro400("alunos", `No máximo ${LIMITE_LOTE} alunos por lote.`);
  const motivoPadrao = typeof corpo.motivo_padrao === "string" && corpo.motivo_padrao.trim() ? corpo.motivo_padrao : null;
  const loteId = novoId("lote");
  const resultados = alunos.map((bruto): ResultadoLoteAluno => {
    const item = objeto(bruto);
    const alunoId = typeof item.aluno_id === "string" ? item.aluno_id : "";
    const copia = structuredClone(banco);
    const desde = copia.historico.length;
    try {
      const aluno = gravarAlunoDoLote(copia, item, motivoPadrao, ctx);
      copia.historico.slice(desde).forEach((h) => (h.lote_id = loteId));
      Object.assign(banco, copia);
      return { aluno_id: alunoId, ok: true, aluno };
    } catch (e) {
      if (!(e instanceof ErroDaApi)) throw e;
      if (e.status === 409 && e.corpo.aluno) return { aluno_id: alunoId, ok: false, error: "versao", aluno: e.corpo.aluno as AlunoDetalhe };
      return {
        aluno_id: alunoId,
        ok: false,
        error: "validacao",
        campo: e.corpo.campo ?? (e.status === 404 ? "aluno_id" : ""),
        mensagem: e.corpo.mensagem ?? e.corpo.error,
      };
    }
  });
  return { lote_id: loteId, resultados };
}

// ---------------------------------------------------------------------------
// Fase 3 — análise de aula (seção 5.2 do backend)
// ---------------------------------------------------------------------------

function analiseOu404(banco: Banco, id: string): AnaliseBanco {
  const an = (banco.analises ?? []).find((x) => x.id === id);
  if (!an) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Análise não encontrada." });
  return an;
}

export function criarAnalise(banco: Banco, corpo: Record<string, unknown>, ctx: Contexto): { id: string } {
  const a = alunoOu404(banco, texto("aluno_id", corpo.aluno_id, true) as string);
  if (a.arquivado_em) erro400("aluno_id", "Aluno arquivado.");
  const dataAula = data("data_aula", corpo.data_aula, true) as string;
  let etapaId = a.etapa_id;
  if (corpo.etapa_id) {
    if (!banco.config.etapas.some((e) => e.id === corpo.etapa_id)) erro400("etapa_id", "Etapa inexistente.");
    etapaId = corpo.etapa_id as string;
  }
  const arquivo = typeof corpo.arquivo_nome === "string" ? corpo.arquivo_nome : null;
  let bruto = typeof corpo.texto === "string" ? corpo.texto : "";
  if (arquivo) {
    if (/\.docx$/i.test(arquivo)) bruto = TEXTO_DOCX_EXEMPLO;
    else if (/\.(txt|vtt|srt)$/i.test(arquivo)) bruto = typeof corpo.arquivo_texto === "string" ? corpo.arquivo_texto : "";
    else erro400("arquivo", "Formato não aceito. Envie .txt, .vtt, .srt ou .docx.");
  }
  const transcricao = limparTranscricao(bruto, arquivo);
  if (!transcricao) erro400(arquivo ? "arquivo" : "texto", "A transcrição está vazia.");
  const id = novoId("an");
  banco.analises = banco.analises ?? [];
  banco.analises.push({
    id,
    aluno_id: a.id,
    data_aula: dataAula,
    etapa_id: etapaId,
    arquivo_nome: arquivo,
    transcricao,
    estado: "processamento",
    inicio: ctx.agora,
    falhar: transcricao.includes(MARCA_DE_ERRO) || corpo.simular_erro === "1",
    resultado_ia: resultadoDeExemplo(transcricao),
    resultado_confirmado: null,
    criada_por: ctx.usuario,
    criada_em: ctx.agora,
    confirmada_por: null,
    confirmada_em: null,
  });
  return { id };
}

export function confirmarAnalise(banco: Banco, id: string, resultado: unknown, versao: number, ctx: Contexto) {
  const an = analiseOu404(banco, id);
  if (statusDe(an, ctx.agora) !== "pronta") erro400("status", "Só uma análise pronta pode ser confirmada.");
  const a = alunoOu404(banco, an.aluno_id);
  conferirVersao(banco, a, versao, ctx);
  const r = ResultadoAnaliseSchema.safeParse(resultado);
  if (!r.success) erro400("resultado", "Resultado fora do formato (resumo, 4 notas de 0 a 100 e highlights).");
  an.estado = "confirmada";
  an.resultado_confirmado = r.data;
  an.confirmada_por = ctx.usuario;
  an.confirmada_em = ctx.agora;
  registrar(banco, ctx, a, "aluno", a.id, "analise_aula", null, an.data_aula);
  return fim(banco, a, ctx);
}

export function descartarAnalise(banco: Banco, id: string, ctx: Contexto): AnaliseBanco {
  const an = analiseOu404(banco, id);
  if (statusDe(an, ctx.agora) === "confirmada") erro400("status", "Análise confirmada não pode ser descartada.");
  an.estado = "descartada";
  return an;
}

export function reprocessarAnalise(banco: Banco, id: string, ctx: Contexto): AnaliseBanco {
  const an = analiseOu404(banco, id);
  const status = statusDe(an, ctx.agora);
  if (status !== "erro" && status !== "pronta" && status !== "descartada") {
    erro400("status", "Só dá para reprocessar uma análise com erro, pronta ou descartada.");
  }
  an.estado = "processamento";
  an.inicio = ctx.agora;
  an.resultado_ia = resultadoDeExemplo(an.transcricao);
  return an;
}

// ---------------------------------------------------------------------------
// Programas: troca com prévia (specs/educacional/programas, respostas de 28/10).
//   - Ficam os realizados.
//   - Os não realizados do programa antigo saem da jornada sem ser apagados
//     (substituídos: fora da timeline e do SLA, com linha no histórico).
//   - Os do programa novo são criados a partir do início, pulando os de data
//     igual ou anterior à do último realizado.
//   - Grava início, mentoria e término (início + duração).
// ---------------------------------------------------------------------------

function programaAtivo(banco: Banco, id: unknown): Programa {
  const p = (banco.config.programas ?? []).find((x) => x.id === id);
  if (!p) erro400("programa_id", "Programa inexistente.");
  if (!p.ativo) erro400("programa_id", "programa inativo");
  return p;
}

function modelosDoPrograma(banco: Banco, programaId: string) {
  return banco.config.checkpoints_modelo
    .filter((m) => m.ativo && m.programa_id === programaId)
    .sort((x, y) => x.ordem - y.ordem);
}

// Data prevista de um checkpoint padrão a partir do início do programa.
const dataPrevista = (m: CheckpointModelo, inicio: string) => dataPrevistaDoModelo(inicio, m);

function planoDaTroca(banco: Banco, a: AlunoBanco, corpo: Record<string, unknown>) {
  const programa = programaAtivo(banco, corpo.programa_id);
  const inicio = data("data_inicio", corpo.data_inicio, true) as string;
  const atuais = banco.checkpoints.filter((c) => c.aluno_id === a.id && !c.arquivado_em && !c.substituido_em);
  const ficam = atuais.filter((c) => c.status === "realizado");
  const saem = atuais.filter((c) => c.status !== "realizado");
  const ultimoRealizado = ficam.map((c) => c.data_realizada ?? c.data_prevista ?? "").sort().at(-1) ?? "";
  const criados = modelosDoPrograma(banco, programa.id)
    .map((m) => ({ modelo: m, data_prevista: dataPrevista(m, inicio) }))
    .filter((x) => x.data_prevista > ultimoRealizado);
  return { programa, inicio, ficam, saem, criados, termino: somarMeses(inicio, programa.duracao_meses) };
}

const resumoDoCheckpoint = (banco: Banco) => (c: CheckpointBanco) => ({
  id: c.id,
  nome: c.nome,
  marco: (c.modelo_id && marcoDe(banco.config.checkpoints_modelo.find((m) => m.id === c.modelo_id) ?? {})) || null,
  status: c.status,
  data_prevista: c.data_prevista,
});

export function previaTrocaPrograma(banco: Banco, id: string, corpo: Record<string, unknown>): PreviaTroca {
  const a = alunoOu404(banco, id);
  const t = planoDaTroca(banco, a, corpo);
  return {
    programa: { id: t.programa.id, nome: t.programa.nome },
    data_inicio: t.inicio,
    data_termino_sugerida: t.termino,
    ficam: t.ficam.map(resumoDoCheckpoint(banco)),
    saem: t.saem.map(resumoDoCheckpoint(banco)),
    criados: t.criados.map((x) => ({ nome: x.modelo.nome, marco: marcoDe(x.modelo), data_prevista: x.data_prevista })),
  };
}

export function trocarPrograma(banco: Banco, id: string, corpo: Record<string, unknown>, versao: number, ctx: Contexto) {
  const a = alunoOu404(banco, id);
  conferirVersao(banco, a, versao, ctx);
  const motivo = corpo.motivo;
  if (typeof motivo !== "string" || motivo.trim().length < MOTIVO_MINIMO) {
    erro400("motivo", `O motivo precisa ter pelo menos ${MOTIVO_MINIMO} caracteres.`);
  }
  const t = planoDaTroca(banco, a, corpo);
  const nomeAntes = (banco.config.programas ?? []).find((p) => p.id === a.programa_id)?.nome ?? null;
  for (const c of t.saem) {
    c.substituido_em = ctx.agora;
    registrar(banco, ctx, a, "checkpoint", c.id, `${c.nome} · substituido`, c.status, "Substituído pela troca de programa", motivo.trim());
  }
  const ordem = Math.max(0, ...banco.checkpoints.filter((c) => c.aluno_id === a.id).map((c) => c.ordem));
  t.criados.forEach((x, i) => {
    const c: CheckpointBanco = {
      id: novoId("cp"),
      aluno_id: a.id,
      modelo_id: x.modelo.id,
      nome: x.modelo.nome,
      ordem: ordem + i + 1,
      data_prevista: x.data_prevista,
      data_realizada: null,
      status: "previsto",
      big_win: x.modelo.big_win,
      observacao: null,
      arquivado_em: null,
      substituido_em: null,
    };
    banco.checkpoints.push(c);
    registrar(banco, ctx, a, "checkpoint", c.id, `${c.nome} · criado`, null, { nome: c.nome, data_prevista: c.data_prevista });
  });
  registrar(banco, ctx, a, "aluno", a.id, "programa", nomeAntes, t.programa.nome, motivo.trim());
  if (a.data_inicio_programa !== t.inicio) registrar(banco, ctx, a, "aluno", a.id, "data_inicio_programa", a.data_inicio_programa, t.inicio);
  if (a.mentoria !== t.programa.mentoria) registrar(banco, ctx, a, "aluno", a.id, "mentoria", a.mentoria, t.programa.mentoria);
  if (a.data_termino !== t.termino) registrar(banco, ctx, a, "aluno", a.id, "data_termino", a.data_termino, t.termino);
  a.programa_id = t.programa.id;
  a.data_inicio_programa = t.inicio;
  a.mentoria = t.programa.mentoria;
  a.data_termino = t.termino;
  return fim(banco, a, ctx);
}

export type { CheckpointModelo };
