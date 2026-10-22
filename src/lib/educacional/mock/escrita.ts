import {
  AUTORIZACOES_PROVA_SOCIAL,
  CAMPOS_AJUSTAVEIS,
  MOTIVO_MINIMO,
  NIVEIS_INICIAIS,
  STATUS_ALUNO,
  STATUS_CHECKPOINT,
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
  type Responsavel,
  type TipoIntervencao,
  type Usuario,
} from "../contrato";
import { montarAluno, naJornada } from "./motor";
import { ErroDaApi, type AlunoBanco, type Banco } from "./tipos";

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
      case "mentoria":
        novos[chave] = texto(chave, valor, true) as string;
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
      default:
        erro400(chave, "Campo desconhecido.");
    }
  }
  // Mudança de etapa (inclusive pelo Kanban): etapa_desde = hoje → dias na etapa zeram.
  if (novos.etapa_id && novos.etapa_id !== a.etapa_id) novos.etapa_desde = ctx.hoje;
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
  const a: AlunoBanco = {
    id: novoId("aluno"),
    nome: texto("nome", dados.nome, true) as string,
    mentoria: texto("mentoria", dados.mentoria, true) as string,
    data_entrada: data("data_entrada", dados.data_entrada, true) as string,
    data_termino: data("data_termino", dados.data_termino, false),
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
  // Checkpoints a partir do modelo ATIVO: data_prevista = entrada + dias, status previsto.
  const modelo = banco.config.checkpoints_modelo.filter((m) => m.ativo).sort((x, y) => x.ordem - y.ordem);
  modelo.forEach((m, i) => {
    banco.checkpoints.push({
      id: novoId("cp"),
      aluno_id: a.id,
      modelo_id: m.id,
      nome: m.nome,
      ordem: i + 1,
      data_prevista: somarDias(a.data_entrada, m.dias_apos_entrada),
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
  for (const [chave, depois] of Object.entries(novos)) {
    const antes = (i as Record<string, unknown>)[chave];
    if (antes === depois) continue;
    if (chave !== "concluida_em") registrar(banco, ctx, a, "intervencao", i.id, chave, antes, depois);
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
export type ColecaoConfig = "etapas" | "checkpoints_modelo" | "tipos_intervencao" | "responsaveis";

function validarItem(colecao: ColecaoConfig, campos: Record<string, unknown>, parcial: boolean) {
  const v: Record<string, unknown> = {};
  if (!parcial || "nome" in campos) v.nome = texto("nome", campos.nome, true);
  if ("ativo" in campos) v.ativo = Boolean(campos.ativo);
  if ("ordem" in campos) {
    if (!Number.isInteger(campos.ordem)) erro400("ordem", "Ordem inválida.");
    v.ordem = campos.ordem;
  }
  if (colecao === "checkpoints_modelo") {
    if (!parcial || "dias_apos_entrada" in campos) {
      const d = campos.dias_apos_entrada;
      if (!Number.isInteger(d) || (d as number) < 0) erro400("dias_apos_entrada", "Use um número inteiro de dias, 0 ou mais.");
      v.dias_apos_entrada = d;
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

export function criarItemConfig(banco: Banco, colecao: ColecaoConfig, campos: Record<string, unknown>) {
  const lista = banco.config[colecao] as unknown as (ItemConfig & { ordem?: number })[];
  const v = validarItem(colecao, campos, false);
  const base: Record<string, unknown> = { id: novoId(colecao.slice(0, 4)), ativo: true, ...v };
  if (colecao === "etapas" || colecao === "checkpoints_modelo") {
    base.ordem = Math.max(0, ...lista.map((x) => x.ordem ?? 0)) + 1;
  }
  if (colecao === "checkpoints_modelo") {
    base.prazo_sla_dias = base.prazo_sla_dias ?? null;
    base.big_win = base.big_win ?? false;
  }
  lista.push(base as unknown as ItemConfig);
  return banco.config;
}

export function patchItemConfig(banco: Banco, colecao: ColecaoConfig, id: string, campos: Record<string, unknown>) {
  const lista = banco.config[colecao] as unknown as (ItemConfig & Record<string, unknown>)[];
  const item = lista.find((x) => x.id === id);
  if (!item) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Item não encontrado." });
  const v = validarItem(colecao, campos, true);
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
  Object.assign(item, v);
  return banco.config;
}

export type { CheckpointModelo };
