import {
  ENTIDADES_HISTORICO,
  FILTROS_MURAL,
  TIPOS_EVENTO_CALENDARIO,
  type EventoCalendario,
  linhaDoDetalhe,
  type ItemMural,
  type AlunoLinha,
  type Config,
  type FaixaSaude,
  type StatusCheckpoint,
} from "../contrato";
import { detalheDaAnalise, itemDaLista, statusDe } from "./analises";
import * as escrita from "./escrita";
import { montarAluno, montarComentario, montarResumo, numeroDaAula } from "./motor";
import { ErroDaApi, type Banco } from "./tipos";

// ---------------------------------------------------------------------------
// "Servidor" do modo demonstração: atende as MESMAS rotas da seção 4 do backend
// da Fase 2 (caminho relativo a /api/educacional), sobre o banco do navegador.
// Assim o adapter tem um só caminho para mock e api — muda só o transporte.
// ---------------------------------------------------------------------------

// Padrões do backend quando a query não diz (o adapter sempre diz: 25 e 20).
export const TAMANHO_PAGINA = 50;
export const TAMANHO_PAGINA_HISTORICO = 50;
export const TAMANHO_PAGINA_ANALISES = 20;
export const TAMANHO_PAGINA_MURAL = 20;
export const LIMITE_OPCOES = 20;

export type Requisicao = {
  metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  caminho: string; // ex.: "alunos/123/ajustes/ltv"
  query?: URLSearchParams;
  corpo?: unknown;
};

const COLECOES: Record<string, escrita.ColecaoConfig> = {
  etapas: "etapas",
  "checkpoints-modelo": "checkpoints_modelo",
  "tipos-intervencao": "tipos_intervencao",
  responsaveis: "responsaveis",
  programas: "programas",
};

const PESO_FAIXA: Record<FaixaSaude, number> = { risco: 0, atencao: 1, saudavel: 2 };
const PESO_CHECKPOINT: Record<StatusCheckpoint, number> = {
  nao_respondeu: 0,
  pendente: 1,
  em_pausa: 2,
  previsto: 3,
  realizado: 4,
};
const PESO_NIVEL = { iniciante: 0, intermediario: 1, avancado: 2 } as const;
const VAZIO = Number.MAX_SAFE_INTEGER; // valor ausente vai para o fim

function naoEncontrado(): never {
  throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Rota não encontrada." });
}

function versaoDo(corpo: Record<string, unknown>, query?: URLSearchParams): number {
  const v = corpo.versao ?? (query?.get("versao") != null ? Number(query.get("versao")) : undefined);
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ErroDaApi(400, { error: "validacao", campo: "versao", mensagem: "Envie a versão do aluno." });
  }
  return v;
}

function semVersao(corpo: Record<string, unknown>) {
  const { versao: _v, ...resto } = corpo;
  return resto;
}

// Ordem padrão (spec Fase 2, seção 3): faixa de saúde (risco primeiro), depois dias na etapa desc.
function ordenador(ordem: string, banco: Banco): (a: AlunoLinha, b: AlunoLinha) => number {
  const ordemEtapa = new Map(banco.config.etapas.map((e) => [e.id, e.ordem]));
  const faixa = (a: AlunoLinha) => (a.faixa_saude.valor ? PESO_FAIXA[a.faixa_saude.valor] : 3);
  const padrao = (a: AlunoLinha, b: AlunoLinha) =>
    faixa(a) - faixa(b) ||
    (b.dias_na_etapa.valor ?? -1) - (a.dias_na_etapa.valor ?? -1) ||
    a.nome.localeCompare(b.nome, "pt-BR");
  const num = (v: number | null | undefined) => v ?? VAZIO;
  const txt = (v: string | null | undefined) => v ?? "￿";
  const base: Record<string, (a: AlunoLinha, b: AlunoLinha) => number> = {
    risco: padrao,
    nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    mentoria: (a, b) => a.mentoria.localeCompare(b.mentoria, "pt-BR"),
    nivel_inicial: (a, b) => PESO_NIVEL[a.nivel_inicial] - PESO_NIVEL[b.nivel_inicial],
    status_aluno: (a, b) => a.status_aluno.localeCompare(b.status_aluno),
    etapa: (a, b) => num(ordemEtapa.get(a.etapa.id)) - num(ordemEtapa.get(b.etapa.id)),
    checkpoint: (a, b) =>
      num(a.proximo_checkpoint && PESO_CHECKPOINT[a.proximo_checkpoint.status]) -
      num(b.proximo_checkpoint && PESO_CHECKPOINT[b.proximo_checkpoint.status]),
    dias_na_etapa: (a, b) => num(a.dias_na_etapa.valor) - num(b.dias_na_etapa.valor),
    dias_sem_atividade: (a, b) => num(a.dias_sem_atividade.valor) - num(b.dias_sem_atividade.valor),
    health_score: (a, b) => num(a.health_score.valor) - num(b.health_score.valor),
    faixa_saude: (a, b) => faixa(a) - faixa(b),
    proxima_acao: (a, b) => txt(a.proxima_acao?.descricao).localeCompare(txt(b.proxima_acao?.descricao), "pt-BR"),
    responsavel: (a, b) => txt(a.responsavel?.nome).localeCompare(txt(b.responsavel?.nome), "pt-BR"),
    // D3: faixa efetiva (risco, atenção, saudável), depois dias sem atividade
    // decrescente, com os sem valor no fim.
    atencao: (a, b) =>
      faixa(a) - faixa(b) || (b.dias_sem_atividade.valor ?? -1) - (a.dias_sem_atividade.valor ?? -1),
  };
  const desc = ordem.startsWith("-");
  const f = base[desc ? ordem.slice(1) : ordem] ?? padrao;
  return (a, b) => (desc ? -f(a, b) : f(a, b)) || padrao(a, b);
}

// Sem acento e em minúsculas, para a busca por nome.
export const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const listaDaQuery = (q: URLSearchParams, k: string) => (q.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);

// Mesma query do backend: etapa_id, responsavel_id (ou "sem"), incluir_arquivados
// (true/1), status de checkpoint, de aluno, faixa e mentoria em lista por vírgula,
// busca no nome (2+ letras, sem acento), health_max inclusivo, ordem padrão nome.
function listarAlunos(banco: Banco, q: URLSearchParams, hoje: string) {
  const arquivados = q.get("incluir_arquivados") === "true" || q.get("incluir_arquivados") === "1";
  const checkpoint = listaDaQuery(q, "checkpoint");
  // Substituído não é da jornada: o backend recusa o filtro.
  if (checkpoint.includes("substituido")) throw new ErroDaApi(400, { error: "validacao", campo: "checkpoint", mensagem: "Status de checkpoint inválido." });
  const statusAluno = listaDaQuery(q, "status_aluno");
  const faixas = listaDaQuery(q, "faixa_saude");
  const mentorias = listaDaQuery(q, "mentoria");
  const programas = listaDaQuery(q, "programa_id");
  // Busca como o backend: vazia = sem busca; 1 letra = 400; 2+ = contém (sem acento).
  const busca = normalizar((q.get("busca") ?? "").trim());
  if (busca.length === 1) throw new ErroDaApi(400, { error: "validacao", campo: "busca", mensagem: "Digite ao menos 2 letras para buscar." });
  const healthMax = q.get("health_max");
  const todos = banco.alunos
    .filter((a) => arquivados || !a.arquivado_em)
    .map((a) => linhaDoDetalhe(montarAluno(banco, a, hoje)))
    .filter((a) => {
      if (q.get("etapa_id") && a.etapa.id !== q.get("etapa_id")) return false;
      if (q.get("risco") && a.faixa_saude.valor !== q.get("risco")) return false;
      if (checkpoint.length && !(a.proximo_checkpoint && checkpoint.includes(a.proximo_checkpoint.status))) return false;
      const resp = q.get("responsavel_id");
      if (resp === "sem" ? a.responsavel !== null : resp && a.responsavel?.id !== resp) return false;
      if (statusAluno.length && !statusAluno.includes(a.status_aluno)) return false;
      if (faixas.length && !(a.faixa_saude.valor && faixas.includes(a.faixa_saude.valor))) return false;
      if (mentorias.length && !mentorias.includes(a.mentoria)) return false;
      if (programas.length && !programas.includes(a.programa_id ?? "sem")) return false;
      if (busca.length >= 2 && !normalizar(a.nome).includes(busca)) return false;
      const sinal = q.get("sinal") as keyof AlunoLinha["sinais"] | null;
      if (sinal && a.sinais[sinal]?.valor !== true) return false;
      // INCLUSIVO, como no backend: health_max=49 → Health Score efetivo até 49.
      if (healthMax != null && !(a.health_score.valor != null && a.health_score.valor <= Number(healthMax))) return false;
      return true;
    })
    .sort(ordenador(q.get("ordem") ?? "nome", banco));
  if (q.get("por_pagina") === "todos") return { itens: todos, total: todos.length };
  const tamanho = Math.max(1, Number(q.get("por_pagina")) || TAMANHO_PAGINA);
  const pagina = Math.max(1, Number(q.get("pagina")) || 1);
  return { itens: todos.slice((pagina - 1) * tamanho, pagina * tamanho), total: todos.length };
}

// D2: mentorias existentes (distintas, em ordem), para o filtro e as sugestões.
function configComMentorias(banco: Banco): Config {
  const mentorias = [...new Set(banco.alunos.map((a) => a.mentoria.trim()).filter(Boolean))].sort((x, y) =>
    x.localeCompare(y, "pt-BR"),
  );
  return { ...banco.config, mentorias };
}

// GET /alunos/opcoes: até 20 alunos não arquivados, por nome.
function opcoesDeAlunos(banco: Banco, q: URLSearchParams, hoje: string) {
  const busca = normalizar((q.get("busca") ?? "").trim());
  const itens = banco.alunos
    .filter((a) => !a.arquivado_em && (busca.length < 2 || normalizar(a.nome).includes(busca)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, LIMITE_OPCOES)
    .map((a) => {
      const d = montarAluno(banco, a, hoje);
      return { id: d.id, nome: d.nome, mentoria: d.mentoria, etapa: d.etapa };
    });
  return { itens };
}

function listarAnalises(banco: Banco, q: URLSearchParams, agora: string) {
  const alunoId = q.get("aluno_id");
  const status = listaDaQuery(q, "status");
  const itens = (banco.analises ?? [])
    .filter((x) => (!alunoId || x.aluno_id === alunoId) && (!status.length || status.includes(statusDe(x, agora))))
    .sort((a, b) => b.criada_em.localeCompare(a.criada_em))
    .map((x) => itemDaLista(banco, x, agora));
  const tamanho = Math.max(1, Number(q.get("por_pagina")) || TAMANHO_PAGINA_ANALISES);
  const pagina = Math.max(1, Number(q.get("pagina")) || 1);
  return { itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho), total: itens.length };
}

function historico(banco: Banco, alunoId: string, q: URLSearchParams) {
  const entidade = q.get("entidade");
  if (entidade && !(ENTIDADES_HISTORICO as readonly string[]).includes(entidade)) {
    throw new ErroDaApi(400, { error: "validacao", campo: "entidade", mensagem: "Tipo de histórico inválido." });
  }
  const itens = banco.historico
    .filter((h) => h.aluno_id === alunoId && (!entidade || h.entidade === entidade))
    .sort((a, b) => b.em.localeCompare(a.em))
    .map(({ id, em, usuario, entidade: e, campo, valor_antes, valor_depois, motivo }) => ({
      id,
      em,
      usuario,
      entidade: e,
      campo,
      valor_antes,
      valor_depois,
      motivo,
    }));
  const pagina = Math.max(1, Number(q.get("pagina")) || 1);
  const tamanho = Math.max(1, Number(q.get("por_pagina")) || TAMANHO_PAGINA_HISTORICO);
  return {
    itens: itens.slice((pagina - 1) * tamanho, pagina * tamanho),
    total: itens.length,
  };
}

// Mural (Entrega 2, M2): comentários e histórico juntos, mais recente primeiro.
// `cursor` = "em|id" do último item da página anterior (opaco para a tela).
function mural(banco: Banco, alunoId: string, q: URLSearchParams, usuarioId: string) {
  const tipo = q.get("tipo");
  if (tipo && !(FILTROS_MURAL as readonly string[]).includes(tipo)) {
    throw new ErroDaApi(400, { error: "validacao", campo: "tipo", mensagem: "Filtro do mural inválido." });
  }
  const comentarios: ItemMural[] =
    tipo && tipo !== "comentario"
      ? []
      : (banco.comentarios ?? []).filter((c) => c.aluno_id === alunoId && !c.arquivado_em).map((c) => montarComentario(banco, c, usuarioId));
  const alteracoes: ItemMural[] =
    tipo === "comentario"
      ? []
      : banco.historico
          .filter((h) => h.aluno_id === alunoId && (!tipo || h.entidade === tipo))
          .map(({ id, em, usuario, entidade, campo, valor_antes, valor_depois, motivo }) => ({
            tipo: "historico" as const,
            id,
            em,
            usuario,
            entidade,
            campo,
            valor_antes,
            valor_depois,
            motivo,
          }));
  const ordem = (x: ItemMural, y: ItemMural) => y.em.localeCompare(x.em) || y.id.localeCompare(x.id);
  let todos = [...comentarios, ...alteracoes].sort(ordem);
  const cursor = q.get("cursor");
  if (cursor) {
    const i = cursor.indexOf("|");
    const [em, id] = [cursor.slice(0, i), cursor.slice(i + 1)];
    todos = todos.filter((x) => x.em < em || (x.em === em && x.id < id));
  }
  const limite = Math.min(50, Math.max(1, Number(q.get("por_pagina")) || TAMANHO_PAGINA_MURAL));
  const itens = todos.slice(0, limite);
  const ultimo = itens.at(-1);
  return { itens, proximo_cursor: todos.length > limite && ultimo ? `${ultimo.em}|${ultimo.id}` : null };
}

// Calendário (Entrega 2, M3): checkpoints (data prevista), intervenções e
// próximas ações (prazo) e aulas (data e hora) dos alunos não arquivados, no
// período [inicio, fim]. Responsável do item: o do aluno (checkpoint e próxima
// ação), o da intervenção ou o mentor da aula. SLA: checkpoint pendente ou sem
// resposta (o mesmo critério do resumo).
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_DIAS_CALENDARIO = 100;

function calendario(banco: Banco, q: URLSearchParams) {
  const inicio = q.get("inicio") ?? "";
  const fim = q.get("fim") ?? "";
  if (!RE_DIA.test(inicio) || !RE_DIA.test(fim) || fim < inicio) {
    throw new ErroDaApi(400, { error: "validacao", campo: "inicio", mensagem: "Informe o início e o fim do período (AAAA-MM-DD)." });
  }
  if ((Date.parse(fim) - Date.parse(inicio)) / 86_400_000 > LIMITE_DIAS_CALENDARIO) {
    throw new ErroDaApi(400, { error: "validacao", campo: "fim", mensagem: `O período pode ter no máximo ${LIMITE_DIAS_CALENDARIO} dias.` });
  }
  const tipo = q.get("tipo");
  if (tipo && !(TIPOS_EVENTO_CALENDARIO as readonly string[]).includes(tipo)) {
    throw new ErroDaApi(400, { error: "validacao", campo: "tipo", mensagem: "Tipo de item do calendário inválido." });
  }
  const responsavelId = q.get("responsavel_id");
  const programaId = q.get("programa_id");
  const resp = (id: string | null) => {
    const r = id ? banco.config.responsaveis.find((x) => x.id === id) : null;
    return r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null;
  };
  const noPeriodo = (d: string | null | undefined): d is string => !!d && d.slice(0, 10) >= inicio && d.slice(0, 10) <= fim;
  const itens: EventoCalendario[] = [];
  for (const a of banco.alunos) {
    if (a.arquivado_em || (programaId && a.programa_id !== programaId)) continue;
    const aluno = { id: a.id, nome: a.nome };
    const p = (banco.config.programas ?? []).find((x) => x.id === a.programa_id);
    const programa = p ? { id: p.id, nome: p.nome } : null;
    const base = { aluno, programa };
    for (const c of banco.checkpoints) {
      if (c.aluno_id !== a.id || c.arquivado_em || c.substituido_em || !noPeriodo(c.data_prevista)) continue;
      itens.push({ ...base, id: `checkpoint:${c.id}`, tipo: "checkpoint", data: c.data_prevista, hora: null, titulo: c.nome, responsavel: resp(a.responsavel_id), status: c.status, sla: c.status === "pendente" || c.status === "nao_respondeu" });
    }
    for (const i of banco.intervencoes) {
      if (i.aluno_id !== a.id || i.arquivado_em || !noPeriodo(i.prazo)) continue;
      itens.push({ ...base, id: `intervencao:${i.id}`, tipo: "intervencao", data: i.prazo, hora: null, titulo: i.descricao, responsavel: resp(i.responsavel_id), status: i.status, sla: false });
    }
    if (a.proxima_acao && noPeriodo(a.proxima_acao_prazo)) {
      itens.push({ ...base, id: `proxima_acao:${a.id}`, tipo: "proxima_acao", data: a.proxima_acao_prazo, hora: null, titulo: a.proxima_acao, responsavel: resp(a.responsavel_id), status: null, sla: false });
    }
    for (const x of banco.aulas ?? []) {
      if (x.aluno_id !== a.id || x.arquivado_em || !noPeriodo(x.data)) continue;
      itens.push({ ...base, id: `aula:${x.id}`, tipo: "aula", data: x.data, hora: x.hora, titulo: `Aula ${numeroDaAula(banco, x)}`, responsavel: resp(x.mentor_id), status: x.status, sla: false });
    }
  }
  const filtrados = itens.filter((e) => (!tipo || e.tipo === tipo) && (!responsavelId || e.responsavel?.id === responsavelId));
  filtrados.sort((x, y) => x.data.localeCompare(y.data) || (x.hora ?? "").localeCompare(y.hora ?? "") || x.aluno.nome.localeCompare(y.aluno.nome));
  return { itens: filtrados };
}

// Atende uma requisição. Escritas MUDAM o banco recebido; quem chama decide se persiste.
export function atender(banco: Banco, req: Requisicao, ctx: escrita.Contexto): unknown {
  const s = req.caminho.split("/").filter(Boolean);
  const q = req.query ?? new URLSearchParams();
  const corpo = (req.corpo && typeof req.corpo === "object" ? req.corpo : {}) as Record<string, unknown>;
  const { metodo } = req;
  const aluno = (id: string) => {
    const a = banco.alunos.find((x) => x.id === id);
    if (!a) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Aluno não encontrado." });
    return montarAluno(banco, a, ctx.hoje);
  };

  // ---- leitura ----
  if (metodo === "GET") {
    if (s.length === 1 && s[0] === "resumo") return montarResumo(banco, ctx.hoje, ctx.agora);
    if (s.length === 1 && s[0] === "config") return configComMentorias(banco);
    if (s.length === 1 && s[0] === "calendario") return calendario(banco, q);
    if (s.length === 1 && s[0] === "alunos") return listarAlunos(banco, q, ctx.hoje);
    if (s.length === 2 && s[0] === "alunos" && s[1] === "opcoes") return opcoesDeAlunos(banco, q, ctx.hoje);
    if (s.length === 1 && s[0] === "analises") return listarAnalises(banco, q, ctx.agora);
    if (s.length === 2 && s[0] === "analises") {
      const an = (banco.analises ?? []).find((x) => x.id === s[1]);
      if (!an) throw new ErroDaApi(404, { error: "nao_encontrado", mensagem: "Análise não encontrada." });
      return detalheDaAnalise(banco, an, ctx.agora);
    }
    if (s.length === 2 && s[0] === "alunos") return aluno(s[1]);
    if (s.length === 3 && s[0] === "alunos" && s[2] === "historico") {
      aluno(s[1]);
      return historico(banco, s[1], q);
    }
    if (s.length === 3 && s[0] === "alunos" && s[2] === "mural") {
      aluno(s[1]);
      return mural(banco, s[1], q, ctx.usuario.id);
    }
    naoEncontrado();
  }

  // ---- Fase 3: lote e análises ----
  if (s.length === 1 && s[0] === "lote" && metodo === "POST") return escrita.salvarLote(banco, corpo, ctx);
  if (s[0] === "analises" && metodo === "POST") {
    if (s.length === 1) return escrita.criarAnalise(banco, corpo, ctx);
    if (s.length === 3 && s[2] === "confirmar") return escrita.confirmarAnalise(banco, s[1], corpo.resultado, versaoDo(corpo), ctx);
    if (s.length === 3 && s[2] === "descartar") return detalheDaAnalise(banco, escrita.descartarAnalise(banco, s[1], ctx), ctx.agora);
    if (s.length === 3 && s[2] === "reprocessar") return detalheDaAnalise(banco, escrita.reprocessarAnalise(banco, s[1], ctx), ctx.agora);
  }

  // ---- Entrega 2 (M2): mural ----
  if (s.length === 2 && s[0] === "mural" && s[1] === "imagens" && metodo === "POST") return escrita.enviarImagem(banco, corpo, ctx);
  if (s.length === 3 && s[0] === "alunos" && s[2] === "comentarios" && metodo === "POST") return escrita.comentar(banco, s[1], corpo, ctx);
  if (s[0] === "comentarios" && s.length >= 2) {
    if (s.length === 2 && metodo === "PATCH") return escrita.editarComentario(banco, s[1], corpo, ctx);
    if (s.length === 3 && s[2] === "arquivar" && metodo === "POST") return escrita.arquivarComentario(banco, s[1], ctx);
  }

  // ---- escrita em alunos ----
  if (s[0] === "alunos") {
    if (s.length === 1 && metodo === "POST") return escrita.criarAluno(banco, corpo as never, ctx);
    const id = s[1];
    if (s.length === 2 && metodo === "PATCH") return escrita.patchAluno(banco, id, semVersao(corpo), versaoDo(corpo), ctx);
    if (s.length === 3 && metodo === "POST" && (s[2] === "arquivar" || s[2] === "reativar")) {
      return escrita.arquivarAluno(banco, id, s[2] === "arquivar", versaoDo(corpo), ctx);
    }
    if (s.length === 4 && s[2] === "ajustes" && metodo === "PUT") {
      return escrita.ajustar(banco, id, s[3], corpo.valor, corpo.motivo, versaoDo(corpo), ctx);
    }
    if (s.length === 4 && s[2] === "ajustes" && metodo === "DELETE") {
      return escrita.removerAjuste(banco, id, s[3], versaoDo(corpo, q), ctx);
    }
    // Troca de programa: uma rota só; `simular: true` devolve a prévia sem gravar.
    if (s.length === 3 && s[2] === "programa" && metodo === "POST") {
      if (corpo.simular === true) return escrita.previaTrocaPrograma(banco, id, corpo);
      return escrita.trocarPrograma(banco, id, semVersao(corpo), versaoDo(corpo), ctx);
    }
    // Entrega 2: aula na hora (Calendário). Na ficha, a aula vai pelo lote.
    if (s.length === 3 && s[2] === "aulas" && metodo === "POST") {
      return escrita.criarAula(banco, id, semVersao(corpo), versaoDo(corpo), ctx);
    }
    if (s.length === 3 && s[2] === "checkpoints" && metodo === "POST") {
      return escrita.criarCheckpoint(banco, id, semVersao(corpo), versaoDo(corpo), ctx);
    }
  }
  if (s[0] === "checkpoints" && s.length >= 2) {
    if (s.length === 2 && metodo === "PATCH") return escrita.patchCheckpoint(banco, s[1], semVersao(corpo), versaoDo(corpo), ctx);
    if (s.length === 3 && s[2] === "arquivar" && metodo === "POST") {
      return escrita.arquivarCheckpoint(banco, s[1], versaoDo(corpo), ctx);
    }
  }
  if (s[0] === "intervencoes") {
    if (s.length === 1 && metodo === "POST") return escrita.criarIntervencao(banco, corpo as never, versaoDo(corpo), ctx);
    if (s.length === 2 && metodo === "PATCH") return escrita.patchIntervencao(banco, s[1], semVersao(corpo), versaoDo(corpo), ctx);
    if (s.length === 3 && s[2] === "arquivar" && metodo === "POST") {
      return escrita.arquivarIntervencao(banco, s[1], versaoDo(corpo), ctx);
    }
  }

  // ---- escrita em configuração ----
  if (s[0] === "config" && s[1] && COLECOES[s[1]]) {
    const colecao = COLECOES[s[1]];
    // Como o backend: toda escrita de config devolve a config inteira (com mentorias).
    if (s.length === 2 && metodo === "POST") {
      escrita.criarItemConfig(banco, colecao, corpo);
      return configComMentorias(banco);
    }
    if (s.length === 3 && metodo === "PATCH") {
      escrita.patchItemConfig(banco, colecao, s[2], corpo);
      return configComMentorias(banco);
    }
  }
  naoEncontrado();
}
