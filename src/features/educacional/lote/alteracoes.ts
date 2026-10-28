import type {
  AlunoDetalhe,
  AlunoLinha,
  CampoAjustavel,
  CamposCheckpoint,
  Etapa,
  NivelInicial,
  Responsavel,
  StatusAluno,
} from "@/lib/educacional/contrato";
import { dataCurta, ROTULO_NIVEL, ROTULO_STATUS_ALUNO, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { AJUSTE_AFETA_TOTAIS, campoDe, comCampo, formatarValor } from "../campos";
import type { Alteracao, LeituraDoServidor } from "./pendencias";

// ---------------------------------------------------------------------------
// Cada edição da aba Alunos vira uma Alteracao: o pedido do lote, o valor do
// servidor (anterior) e o texto dele, e a sobreposição na linha. `a` é a linha
// como aparece (com as outras pendências por cima); a chave da célula só muda
// a parte dela, então o anterior lido aqui é o do servidor.
// ---------------------------------------------------------------------------

type Usuario = { id: string; nome: string };

const textoAcao = (descricao: string | null, prazo: string | null) =>
  descricao ? `${descricao}${prazo ? ` (até ${dataCurta(prazo)})` : ""}` : "—";

export function alteracaoDoNome(a: AlunoLinha, nome: string): Alteracao {
  return {
    chave: "campo:nome",
    valor: nome,
    anterior: a.nome,
    antes: a.nome,
    depois: nome,
    pedido: { tipo: "campos", campos: { nome } },
    linha: { nome },
  };
}

export function alteracaoDoNivel(a: AlunoLinha, nivel: NivelInicial): Alteracao {
  return {
    chave: "campo:nivel_inicial",
    valor: nivel,
    anterior: a.nivel_inicial,
    antes: ROTULO_NIVEL[a.nivel_inicial],
    depois: ROTULO_NIVEL[nivel],
    pedido: { tipo: "campos", campos: { nivel_inicial: nivel } },
    linha: { nivel_inicial: nivel },
  };
}

export function alteracaoDaEtapa(a: AlunoLinha, e: Pick<Etapa, "id" | "nome">): Alteracao {
  return {
    chave: "campo:etapa_id",
    valor: e.id,
    anterior: a.etapa.id,
    antes: a.etapa.nome,
    depois: e.nome,
    pedido: { tipo: "campos", campos: { etapa_id: e.id } },
    linha: { etapa: { id: e.id, nome: e.nome } },
    afetaTotais: true,
  };
}

export function alteracaoDoResponsavel(a: AlunoLinha, r: Pick<Responsavel, "id" | "nome" | "tipo"> | null): Alteracao {
  return {
    chave: "campo:responsavel_id",
    valor: r?.id ?? null,
    anterior: a.responsavel?.id ?? null,
    antes: a.responsavel?.nome ?? "Sem responsável",
    depois: r?.nome ?? "Sem responsável",
    pedido: { tipo: "campos", campos: { responsavel_id: r?.id ?? null } },
    linha: { responsavel: r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null },
  };
}

export function alteracaoDoStatus(a: AlunoLinha, s: StatusAluno): Alteracao {
  return {
    chave: "campo:status_aluno",
    valor: s,
    anterior: a.status_aluno,
    antes: ROTULO_STATUS_ALUNO[a.status_aluno],
    depois: ROTULO_STATUS_ALUNO[s],
    pedido: { tipo: "campos", campos: { status_aluno: s } },
    linha: { status_aluno: s },
    afetaTotais: true,
  };
}

export function alteracaoDaAcao(a: AlunoLinha, descricao: string | null, prazo: string | null): Alteracao {
  const d = descricao || null;
  const p = d ? prazo || null : null;
  return {
    chave: "campo:proxima_acao",
    valor: { proxima_acao: d, proxima_acao_prazo: p },
    anterior: { proxima_acao: a.proxima_acao?.descricao ?? null, proxima_acao_prazo: a.proxima_acao?.prazo ?? null },
    antes: textoAcao(a.proxima_acao?.descricao ?? null, a.proxima_acao?.prazo ?? null),
    depois: textoAcao(d, p),
    pedido: { tipo: "campos", campos: { proxima_acao: d, proxima_acao_prazo: p } },
    linha: { proxima_acao: d ? { descricao: d, prazo: p } : null },
  };
}

// Status do próximo checkpoint (o que a tabela mostra).
export function alteracaoDoCheckpoint(a: AlunoLinha, campos: CamposCheckpoint & { status: NonNullable<CamposCheckpoint["status"]> }): Alteracao | null {
  const cp = a.proximo_checkpoint;
  if (!cp) return null;
  return {
    chave: `checkpoint:${cp.id}`,
    valor: campos.status,
    anterior: cp.status,
    antes: ROTULO_STATUS_CHECKPOINT[cp.status],
    depois: ROTULO_STATUS_CHECKPOINT[campos.status],
    pedido: { tipo: "checkpoint", item: { id: cp.id, ...campos } },
    linha: { proximo_checkpoint: { ...cp, status: campos.status } },
    afetaTotais: true,
  };
}

// Só as chaves da linha que o campo muda (para sobrepor sem apagar as outras).
function parteDaLinha(a: AlunoLinha, campo: CampoAjustavel, novo: Parameters<typeof comCampo>[2]): Partial<AlunoLinha> {
  const com = comCampo(a, campo, novo);
  return Object.fromEntries(Object.entries(com).filter(([k, v]) => v !== a[k as keyof AlunoLinha])) as Partial<AlunoLinha>;
}

// Ajuste manual (valor + motivo) ou "Voltar ao automático" (remover).
export function alteracaoDoAjuste(
  a: AlunoLinha,
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
  return {
    chave: `ajuste:${campo}`,
    valor: remover ? null : r.valor,
    anterior: atual.ajuste?.valor ?? null,
    antes: formatarValor(campo, atual.valor),
    depois: remover ? `automático (${formatarValor(campo, atual.automatico)})` : formatarValor(campo, r.valor),
    pedido: { tipo: "ajuste", ajuste: remover ? { campo, remover: true } : { campo, valor: r.valor, motivo: r.motivo } },
    linha: parteDaLinha(a, campo, novo),
    afetaTotais: AJUSTE_AFETA_TOTAIS.has(campo),
  };
}

// Valor de cada célula no aluno atual do servidor ("Reaplicar" depois do 409).
// null = o servidor não tem mais o item (checkpoint arquivado ou de fora da jornada).
export const lerDoServidor: LeituraDoServidor = (chave, atual: AlunoDetalhe) => {
  const [tipo, nome] = [chave.slice(0, chave.indexOf(":")), chave.slice(chave.indexOf(":") + 1)];
  if (tipo === "checkpoint") {
    const cp = atual.checkpoints.find((c) => c.id === nome);
    return cp ? { anterior: cp.status, antes: ROTULO_STATUS_CHECKPOINT[cp.status] } : null;
  }
  if (tipo === "ajuste") {
    const c = campoDe(atual, nome as CampoAjustavel);
    return c ? { anterior: c.ajuste?.valor ?? null, antes: formatarValor(nome as CampoAjustavel, c.valor) } : null;
  }
  switch (nome) {
    case "nome":
      return { anterior: atual.nome, antes: atual.nome };
    case "nivel_inicial":
      return { anterior: atual.nivel_inicial, antes: ROTULO_NIVEL[atual.nivel_inicial] };
    case "etapa_id":
      return { anterior: atual.etapa.id, antes: atual.etapa.nome };
    case "responsavel_id":
      return { anterior: atual.responsavel?.id ?? null, antes: atual.responsavel?.nome ?? "Sem responsável" };
    case "status_aluno":
      return { anterior: atual.status_aluno, antes: ROTULO_STATUS_ALUNO[atual.status_aluno] };
    case "proxima_acao":
      return {
        anterior: { proxima_acao: atual.proxima_acao?.descricao ?? null, proxima_acao_prazo: atual.proxima_acao?.prazo ?? null },
        antes: textoAcao(atual.proxima_acao?.descricao ?? null, atual.proxima_acao?.prazo ?? null),
      };
    default:
      return null;
  }
};
