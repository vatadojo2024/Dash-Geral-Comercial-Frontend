import {
  ENTIDADES_HISTORICO,
  linhaDoDetalhe,
  type AlunoLinha,
  type FaixaSaude,
  type StatusCheckpoint,
} from "../contrato";
import * as escrita from "./escrita";
import { montarAluno, montarResumo } from "./motor";
import { ErroDaApi, type Banco } from "./tipos";

// ---------------------------------------------------------------------------
// "Servidor" do modo demonstração: atende as MESMAS rotas da seção 4 do backend
// da Fase 2 (caminho relativo a /api/educacional), sobre o banco do navegador.
// Assim o adapter tem um só caminho para mock e api — muda só o transporte.
// ---------------------------------------------------------------------------

// Padrões do backend quando a query não diz (o adapter sempre diz: 25 e 20).
export const TAMANHO_PAGINA = 50;
export const TAMANHO_PAGINA_HISTORICO = 50;

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
  };
  const desc = ordem.startsWith("-");
  const f = base[desc ? ordem.slice(1) : ordem] ?? padrao;
  return (a, b) => (desc ? -f(a, b) : f(a, b)) || padrao(a, b);
}

// Mesma query do backend: etapa_id, responsavel_id, incluir_arquivados=true, UM
// status de checkpoint, health_max inclusivo, ordem padrão nome.
function listarAlunos(banco: Banco, q: URLSearchParams, hoje: string) {
  const arquivados = q.get("incluir_arquivados") === "true";
  const checkpoint = q.get("checkpoint");
  const healthMax = q.get("health_max");
  const todos = banco.alunos
    .filter((a) => arquivados || !a.arquivado_em)
    .map((a) => linhaDoDetalhe(montarAluno(banco, a, hoje)))
    .filter((a) => {
      if (q.get("etapa_id") && a.etapa.id !== q.get("etapa_id")) return false;
      if (q.get("risco") && a.faixa_saude.valor !== q.get("risco")) return false;
      if (checkpoint && a.proximo_checkpoint?.status !== checkpoint) return false;
      if (q.get("responsavel_id") && a.responsavel?.id !== q.get("responsavel_id")) return false;
      if (q.get("status_aluno") && a.status_aluno !== q.get("status_aluno")) return false;
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
    if (s.length === 1 && s[0] === "config") return banco.config;
    if (s.length === 1 && s[0] === "alunos") return listarAlunos(banco, q, ctx.hoje);
    if (s.length === 2 && s[0] === "alunos") return aluno(s[1]);
    if (s.length === 3 && s[0] === "alunos" && s[2] === "historico") {
      aluno(s[1]);
      return historico(banco, s[1], q);
    }
    naoEncontrado();
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
    if (s.length === 2 && metodo === "POST") return escrita.criarItemConfig(banco, colecao, corpo);
    if (s.length === 3 && metodo === "PATCH") return escrita.patchItemConfig(banco, colecao, s[2], corpo);
  }
  naoEncontrado();
}
