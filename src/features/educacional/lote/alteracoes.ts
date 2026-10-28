import type {
  AlunoDetalhe,
  AlunoLinha,
  CampoAjustavel,
  CamposCheckpoint,
  CamposDiretosAluno,
  CamposIntervencao,
  Checkpoint,
  Etapa,
  Intervencao,
  NivelInicial,
  Responsavel,
  StatusAluno,
} from "@/lib/educacional/contrato";
import {
  dataCurta,
  ROTULO_AUTORIZACAO,
  ROTULO_NIVEL,
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_STATUS_INTERVENCAO,
} from "@/lib/educacional/rotulos";
import { AJUSTE_AFETA_TOTAIS, campoDe, formatarValor } from "../campos";
import type { Alteracao, LeituraDoServidor, Sobreposicao } from "./pendencias";

// ---------------------------------------------------------------------------
// Cada edição (aba Alunos ou ficha do Raio-X) vira uma Alteracao: o pedido do
// lote, o valor do servidor (anterior) e o texto dele, e as operações que a
// sobrepõem na tela. `a` é o aluno como aparece (com as outras pendências por
// cima); a chave só muda a parte dela, então o anterior lido aqui é o do servidor.
// Item já pendente (checkpoint ou intervenção) recebe a alteração anterior em
// `base`: a nova soma os campos (vale a última de cada campo).
// ---------------------------------------------------------------------------

type Usuario = { id: string; nome: string };
type Aluno = AlunoLinha | AlunoDetalhe;

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const textoAcao = (descricao: string | null, prazo: string | null) =>
  descricao ? `${descricao}${prazo ? ` (até ${dataCurta(prazo)})` : ""}` : "—";

// Texto de um campo direto (marca "Antes: X").
export function rotuloDoCampoDireto(campo: keyof CamposDiretosAluno, valor: unknown): string {
  if (valor == null || valor === "") return "—";
  switch (campo) {
    case "status_aluno":
      return ROTULO_STATUS_ALUNO[valor as StatusAluno] ?? String(valor);
    case "nivel_inicial":
      return ROTULO_NIVEL[valor as NivelInicial] ?? String(valor);
    case "autorizacao_prova_social":
      return ROTULO_AUTORIZACAO[valor as keyof typeof ROTULO_AUTORIZACAO] ?? String(valor);
    case "data_entrada":
    case "data_termino":
    case "proxima_acao_prazo":
      return dataCurta(String(valor));
    default:
      return String(valor);
  }
}

// Campo direto simples (o mesmo nome no aluno e no PATCH).
export function alteracaoDeCampo(a: Aluno, campo: keyof CamposDiretosAluno, valor: unknown): Alteracao {
  const anterior = (a as Record<string, unknown>)[campo] ?? null;
  return {
    chave: `campo:${campo}`,
    valor,
    anterior,
    antes: rotuloDoCampoDireto(campo, anterior),
    depois: rotuloDoCampoDireto(campo, valor),
    pedido: { tipo: "campos", campos: { [campo]: valor } },
    sobrepor: [{ tipo: "campo", campo, valor }],
    afetaTotais: campo === "status_aluno",
  };
}

export const alteracaoDoNome = (a: Aluno, nome: string) => alteracaoDeCampo(a, "nome", nome);
export const alteracaoDoNivel = (a: Aluno, nivel: NivelInicial) => alteracaoDeCampo(a, "nivel_inicial", nivel);
export const alteracaoDoStatus = (a: Aluno, s: StatusAluno) => alteracaoDeCampo(a, "status_aluno", s);

export function alteracaoDaEtapa(a: Aluno, e: Pick<Etapa, "id" | "nome">): Alteracao {
  return {
    chave: "campo:etapa_id",
    valor: e.id,
    anterior: a.etapa.id,
    antes: a.etapa.nome,
    depois: e.nome,
    pedido: { tipo: "campos", campos: { etapa_id: e.id } },
    sobrepor: [{ tipo: "campo", campo: "etapa", valor: { id: e.id, nome: e.nome } }],
    afetaTotais: true,
  };
}

export function alteracaoDoResponsavel(a: Aluno, r: Pick<Responsavel, "id" | "nome" | "tipo"> | null): Alteracao {
  return {
    chave: "campo:responsavel_id",
    valor: r?.id ?? null,
    anterior: a.responsavel?.id ?? null,
    antes: a.responsavel?.nome ?? "Sem responsável",
    depois: r?.nome ?? "Sem responsável",
    pedido: { tipo: "campos", campos: { responsavel_id: r?.id ?? null } },
    sobrepor: [{ tipo: "campo", campo: "responsavel", valor: r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null }],
  };
}

export function alteracaoDaAcao(a: Aluno, descricao: string | null, prazo: string | null): Alteracao {
  const d = descricao || null;
  const p = d ? prazo || null : null;
  return {
    chave: "campo:proxima_acao",
    valor: { proxima_acao: d, proxima_acao_prazo: p },
    anterior: { proxima_acao: a.proxima_acao?.descricao ?? null, proxima_acao_prazo: a.proxima_acao?.prazo ?? null },
    antes: textoAcao(a.proxima_acao?.descricao ?? null, a.proxima_acao?.prazo ?? null),
    depois: textoAcao(d, p),
    pedido: { tipo: "campos", campos: { proxima_acao: d, proxima_acao_prazo: p } },
    sobrepor: [{ tipo: "campo", campo: "proxima_acao", valor: d ? { descricao: d, prazo: p } : null }],
  };
}

// ---------- ajustes ----------

// Onde o campo calculado mora no aluno (para sobrepor sem apagar os vizinhos).
function ondeMora(campo: CampoAjustavel): { campo: string; chave?: string } {
  if (campo.startsWith("sinal_")) return { campo: "sinais", chave: campo.slice("sinal_".length) };
  if (campo.startsWith("progresso_")) return { campo: "progresso", chave: campo.slice("progresso_".length) };
  return { campo };
}

// Ajuste manual (valor + motivo) ou "Voltar ao automático" (remover).
export function alteracaoDoAjuste(
  a: Aluno,
  campo: CampoAjustavel,
  r: { valor: unknown; motivo: string } | { remover: true },
  usuario: Usuario,
): Alteracao | null {
  const atual = campoDe(a, campo);
  if (!atual) return null;
  const remover = "remover" in r;
  const novo = remover
    ? { valor: atual.automatico, automatico: atual.automatico, ajuste: null }
    : {
        valor: r.valor,
        automatico: atual.automatico,
        ajuste: { valor: r.valor, motivo: r.motivo, ajustado_por: usuario, ajustado_em: new Date().toISOString() },
      };
  const onde = ondeMora(campo);
  const sobrepor: Sobreposicao = onde.chave
    ? { tipo: "dentro", campo: onde.campo, chave: onde.chave, valor: novo }
    : { tipo: "campo", campo: onde.campo, valor: novo };
  return {
    chave: `ajuste:${campo}`,
    valor: remover ? null : r.valor,
    anterior: atual.ajuste?.valor ?? null,
    antes: formatarValor(campo, atual.valor),
    depois: remover ? `automático (${formatarValor(campo, atual.automatico)})` : formatarValor(campo, r.valor),
    pedido: { tipo: "ajuste", ajuste: remover ? { campo, remover: true } : { campo, valor: r.valor, motivo: r.motivo } },
    sobrepor: [sobrepor],
    afetaTotais: AJUSTE_AFETA_TOTAIS.has(campo),
  };
}

// ---------- checkpoints ----------

type CheckpointVisto = Pick<Checkpoint, "id" | "nome" | "status" | "data_prevista"> & Partial<Checkpoint>;
const textoCheckpoint = (c: { nome?: unknown; status?: unknown }) =>
  `${c.nome ?? "Checkpoint"} · ${ROTULO_STATUS_CHECKPOINT[c.status as keyof typeof ROTULO_STATUS_CHECKPOINT] ?? "—"}`;
const pegar = (origem: Record<string, unknown>, chaves: string[]) => Object.fromEntries(chaves.map((k) => [k, origem[k] ?? null]));

export const ID_NOVO = "novo:"; // id na tela de um item novo ainda não salvo

// Mudança num checkpoint existente (status na tabela; formulário na ficha).
export function alteracaoDoCheckpoint(cp: CheckpointVisto, campos: CamposCheckpoint, base?: Alteracao): Alteracao {
  const valor = { ...(base && ehObjeto(base.valor) ? base.valor : {}), ...campos };
  return {
    chave: `checkpoint:${cp.id}`,
    valor,
    anterior: pegar(cp as Record<string, unknown>, Object.keys(valor)),
    antes: textoCheckpoint(cp),
    depois: textoCheckpoint({ ...cp, ...valor }),
    pedido: { tipo: "checkpoint", item: { id: cp.id, ...valor } },
    sobrepor: [{ tipo: "item", lista: "checkpoints", id: cp.id, campos: valor }],
    afetaTotais: "status" in valor,
  };
}

export function checkpointArquivado(cp: CheckpointVisto): Alteracao {
  return {
    chave: `checkpoint:${cp.id}`,
    valor: "arquivar",
    anterior: "ativo",
    antes: textoCheckpoint(cp),
    depois: "Arquivado",
    pedido: { tipo: "checkpoint", item: { id: cp.id, arquivar: true } },
    sobrepor: [{ tipo: "remover", lista: "checkpoints", id: cp.id }],
    afetaTotais: true,
  };
}

// Checkpoint avulso novo; `temp` identifica-o até salvar (editar de novo usa o mesmo).
export function checkpointNovo(temp: string, campos: CamposCheckpoint, base?: Alteracao): Alteracao {
  const valor = { ...(base && ehObjeto(base.valor) ? base.valor : {}), ...campos };
  return {
    chave: `checkpoint:${ID_NOVO}${temp}`,
    valor,
    anterior: null,
    antes: "—",
    depois: `${valor.nome ?? "Checkpoint"} (novo)`,
    pedido: { tipo: "checkpoint", item: { novo: true, ...valor } },
    sobrepor: [
      {
        tipo: "novo",
        lista: "checkpoints",
        item: {
          id: `${ID_NOVO}${temp}`,
          ordem: 10_000,
          modelo_id: null,
          marco: null,
          roteiro: null,
          status: "previsto",
          data_prevista: null,
          data_realizada: null,
          observacao: null,
          big_win: false,
          ...valor,
        },
      },
    ],
    afetaTotais: true,
  };
}

// ---------- intervenções ----------

// O que a tela mostra de uma intervenção editada (nomes do tipo e do responsável).
export type IntervencaoNaTela = Partial<Pick<Intervencao, "tipo" | "responsavel" | "descricao" | "prazo" | "status">>;

const textoIntervencao = (i: { descricao?: unknown; status?: unknown }) =>
  `${String(i.descricao ?? "Intervenção").slice(0, 60)} · ${ROTULO_STATUS_INTERVENCAO[i.status as keyof typeof ROTULO_STATUS_INTERVENCAO] ?? "—"}`;

function naTela(campos: CamposIntervencao, tela: IntervencaoNaTela): Record<string, unknown> {
  const o: Record<string, unknown> = { ...tela };
  if (campos.descricao !== undefined) o.descricao = campos.descricao;
  if (campos.prazo !== undefined) o.prazo = campos.prazo;
  if (campos.status !== undefined) {
    o.status = campos.status;
    o.concluida_em = campos.status === "concluida" ? new Date().toISOString() : null;
  }
  return o;
}

function sobreposicaoAnterior(base?: Alteracao): Record<string, unknown> {
  const s = base?.sobrepor[0];
  return s?.tipo === "item" ? s.campos : s?.tipo === "novo" ? s.item : {};
}

export function alteracaoDaIntervencao(i: Intervencao, campos: CamposIntervencao, tela: IntervencaoNaTela = {}, base?: Alteracao): Alteracao {
  const valor = { ...(base && ehObjeto(base.valor) ? base.valor : {}), ...campos };
  const servidor: Record<string, unknown> = {
    tipo_id: i.tipo.id,
    descricao: i.descricao,
    responsavel_id: i.responsavel?.id ?? null,
    prazo: i.prazo,
    status: i.status,
  };
  const campoNaTela = { ...sobreposicaoAnterior(base), ...naTela(campos, tela) };
  return {
    chave: `intervencao:${i.id}`,
    valor,
    anterior: pegar(servidor, Object.keys(valor)),
    antes: textoIntervencao(i),
    depois: textoIntervencao({ ...i, ...campoNaTela }),
    pedido: { tipo: "intervencao", item: { id: i.id, ...valor } },
    sobrepor: [{ tipo: "item", lista: "intervencoes", id: i.id, campos: campoNaTela }],
  };
}

export function intervencaoArquivada(i: Intervencao): Alteracao {
  return {
    chave: `intervencao:${i.id}`,
    valor: "arquivar",
    anterior: "ativa",
    antes: textoIntervencao(i),
    depois: "Arquivada",
    pedido: { tipo: "intervencao", item: { id: i.id, arquivar: true } },
    sobrepor: [{ tipo: "remover", lista: "intervencoes", id: i.id }],
  };
}

export function intervencaoNova(
  temp: string,
  campos: CamposIntervencao,
  tela: IntervencaoNaTela,
  usuario: Usuario,
  base?: Alteracao,
): Alteracao {
  const valor = { ...(base && ehObjeto(base.valor) ? base.valor : {}), ...campos };
  const item = {
    id: `${ID_NOVO}${temp}`,
    status: "aberta",
    concluida_em: null,
    criada_por: usuario,
    criada_em: new Date().toISOString(),
    responsavel: null,
    prazo: null,
    ...sobreposicaoAnterior(base),
    ...naTela(campos, tela),
  };
  return {
    chave: `intervencao:${ID_NOVO}${temp}`,
    valor,
    anterior: null,
    antes: "—",
    depois: `${String(valor.descricao ?? "Intervenção").slice(0, 60)} (nova)`,
    pedido: { tipo: "intervencao", item: { novo: true, ...valor } },
    sobrepor: [{ tipo: "novo", lista: "intervencoes", item }],
  };
}

// Alteração da tabela no status do próximo checkpoint.
export function alteracaoDoProximoCheckpoint(a: AlunoLinha, campos: CamposCheckpoint, base?: Alteracao): Alteracao | null {
  return a.proximo_checkpoint ? alteracaoDoCheckpoint(a.proximo_checkpoint, campos, base) : null;
}

// ---------- reaplicar ----------

// Valor de cada alteração no aluno atual do servidor ("Reaplicar" depois do
// 409). null = o servidor não tem mais o item (arquivado ou fora da jornada).
export const lerDoServidor: LeituraDoServidor = (alt, atual) => {
  const i = alt.chave.indexOf(":");
  const tipo = alt.chave.slice(0, i);
  const nome = alt.chave.slice(i + 1);
  if ((tipo === "checkpoint" || tipo === "intervencao") && nome.startsWith(ID_NOVO)) return { anterior: null, antes: alt.antes };
  if (tipo === "checkpoint") {
    const cp = atual.checkpoints.find((c) => c.id === nome);
    if (!cp) return null;
    if (alt.valor === "arquivar") return { anterior: "ativo", antes: textoCheckpoint(cp) };
    return { anterior: pegar(cp as unknown as Record<string, unknown>, Object.keys(alt.valor as object)), antes: textoCheckpoint(cp) };
  }
  if (tipo === "intervencao") {
    const it = atual.intervencoes.find((x) => x.id === nome);
    if (!it) return null;
    if (alt.valor === "arquivar") return { anterior: "ativa", antes: textoIntervencao(it) };
    const servidor = { tipo_id: it.tipo.id, descricao: it.descricao, responsavel_id: it.responsavel?.id ?? null, prazo: it.prazo, status: it.status };
    return { anterior: pegar(servidor, Object.keys(alt.valor as object)), antes: textoIntervencao(it) };
  }
  if (tipo === "ajuste") {
    const c = campoDe(atual, nome as CampoAjustavel);
    return c ? { anterior: c.ajuste?.valor ?? null, antes: formatarValor(nome as CampoAjustavel, c.valor) } : null;
  }
  switch (nome) {
    case "etapa_id":
      return { anterior: atual.etapa.id, antes: atual.etapa.nome };
    case "responsavel_id":
      return { anterior: atual.responsavel?.id ?? null, antes: atual.responsavel?.nome ?? "Sem responsável" };
    case "proxima_acao":
      return {
        anterior: { proxima_acao: atual.proxima_acao?.descricao ?? null, proxima_acao_prazo: atual.proxima_acao?.prazo ?? null },
        antes: textoAcao(atual.proxima_acao?.descricao ?? null, atual.proxima_acao?.prazo ?? null),
      };
    default: {
      const campo = nome as keyof CamposDiretosAluno;
      const anterior = (atual as Record<string, unknown>)[campo] ?? null;
      return { anterior, antes: rotuloDoCampoDireto(campo, anterior) };
    }
  }
};
