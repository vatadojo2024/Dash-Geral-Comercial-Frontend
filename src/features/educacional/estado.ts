import {
  FAIXAS_SAUDE,
  SINAIS,
  STATUS_ALUNO,
  STATUS_CHECKPOINT,
  type StatusAluno,
  type StatusCheckpoint,
} from "@/lib/educacional/contrato";
import {
  buscaValida,
  ehOrdem,
  queryDosFiltros,
  RESPONSAVEL_NENHUM,
  type FiltrosAlunos,
  type Simular,
} from "@/lib/educacional/apiEducacional";
import { ROTULO_FAIXA, ROTULO_SINAL, ROTULO_STATUS_ALUNO, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";

// ---------------------------------------------------------------------------
// Estado da aba Alunos na URL (busca, filtros, ordem, página, Lista | Kanban):
// os cliques do Cockpit escrevem nesses parâmetros e o Raio-X volta para a
// mesma URL. Puro (sem React), para testar. Etapa e responsável são ids (vêm
// da configuração); os nomes chegam por `nomes` para descrever o filtro.
// ---------------------------------------------------------------------------

export type Visao = "lista" | "kanban";
export type EstadoTabela = Required<Pick<FiltrosAlunos, "ordem" | "pagina">> &
  Omit<FiltrosAlunos, "ordem" | "pagina" | "por_pagina"> & { visao: Visao };

function umDe<T extends string>(valores: readonly T[], v: string | null): T | null {
  return v && (valores as readonly string[]).includes(v) ? (v as T) : null;
}

const id = (v: string | null) => (v && /^[A-Za-z0-9_.-]{1,120}$/.test(v) ? v : null);

export function lerEstado(sp: URLSearchParams): EstadoTabela {
  const checkpoint = (sp.get("checkpoint") ?? "")
    .split(",")
    .flatMap((v) => (umDe(STATUS_CHECKPOINT, v.trim()) ? [v.trim() as StatusCheckpoint] : []));
  const health = Number(sp.get("health_max"));
  const pagina = Number(sp.get("pagina"));
  const ordem = sp.get("ordem");
  return {
    etapa: id(sp.get("etapa")),
    risco: umDe(FAIXAS_SAUDE, sp.get("risco")),
    checkpoint,
    responsavel: id(sp.get("responsavel")),
    sinal: umDe(SINAIS, sp.get("sinal")),
    health_max: sp.get("health_max") && Number.isFinite(health) ? health : null,
    status_aluno: umDe(STATUS_ALUNO, sp.get("status_aluno")),
    busca: buscaValida(sp.get("busca")),
    programa: (sp.get("programa") ?? "").split(",").flatMap((v) => (id(v.trim()) ? [v.trim()] : [])),
    incluir_arquivados: sp.get("incluir_arquivados") === "1",
    ordem: ordem && ehOrdem(ordem) ? ordem : "risco",
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : 1,
    visao: sp.get("visao") === "kanban" ? "kanban" : "lista",
  };
}

export function lerSimular(sp: URLSearchParams): Simular {
  const v = sp.get("simular");
  return v === "erro" || v === "vazio" || v === "sem_permissao" ? v : null;
}

// Query da página (filtros + visão + `simular`, que só vale no mock).
export function queryDoEstado(e: EstadoTabela, simular?: Simular): string {
  const qs = new URLSearchParams(queryDosFiltros(e));
  if (e.visao === "kanban") qs.set("visao", "kanban");
  if (simular) qs.set("simular", simular);
  return qs.toString();
}

export function temFiltro(e: EstadoTabela): boolean {
  return Boolean(
    e.etapa ||
      e.risco ||
      e.checkpoint?.length ||
      e.responsavel ||
      e.sinal ||
      e.health_max != null ||
      e.status_aluno ||
      e.programa?.length ||
      buscaValida(e.busca),
  );
}

export function semFiltros(e: EstadoTabela): EstadoTabela {
  return {
    ...e,
    etapa: null,
    risco: null,
    checkpoint: [],
    responsavel: null,
    sinal: null,
    health_max: null,
    status_aluno: null,
    programa: [],
    busca: null,
    pagina: 1,
  };
}

export type NomesDosFiltros = {
  etapa?: (id: string) => string | undefined;
  responsavel?: (id: string) => string | undefined;
  programa?: (id: string) => string | undefined;
};

// Descrição do chip "Filtro ativo".
export function descreverFiltros(e: EstadoTabela, nomes: NomesDosFiltros = {}): string[] {
  const partes: string[] = [];
  if (buscaValida(e.busca)) partes.push(`Nome: “${buscaValida(e.busca)}”`);
  if (e.etapa) partes.push(`Etapa: ${nomes.etapa?.(e.etapa) ?? "—"}`);
  if (e.risco) partes.push(`Faixa: ${ROTULO_FAIXA[e.risco]}`);
  if (e.checkpoint?.length) partes.push(`Checkpoint: ${e.checkpoint.map((c) => ROTULO_STATUS_CHECKPOINT[c]).join(" + ")}`);
  if (e.responsavel === RESPONSAVEL_NENHUM) partes.push("Sem responsável");
  else if (e.responsavel) partes.push(`Responsável: ${nomes.responsavel?.(e.responsavel) ?? "—"}`);
  if (e.sinal) partes.push(`Sinal: ${ROTULO_SINAL[e.sinal]}`);
  if (e.health_max != null) partes.push(`Health Score abaixo de ${e.health_max}`);
  const status = e.status_aluno == null ? [] : ([] as StatusAluno[]).concat(e.status_aluno);
  if (status.length) partes.push(`Status: ${status.map((s) => ROTULO_STATUS_ALUNO[s]).join(" + ")}`);
  if (e.programa?.length) partes.push(`Programa: ${e.programa.map((p) => nomes.programa?.(p) ?? "—").join(" + ")}`);
  return partes;
}

export const ROTA_ALUNOS = "/educacional/alunos";

// Link de um clique do Cockpit: abre a aba Alunos só com aquele filtro.
export function hrefDoFiltro(filtro: Partial<EstadoTabela>, simular?: Simular): string {
  const q = queryDoEstado({ ...lerEstado(new URLSearchParams()), ...filtro, pagina: 1 }, simular);
  return `${ROTA_ALUNOS}${q ? `?${q}` : ""}`;
}

// Raio-X: `?voltar=` guarda o caminho de onde a pessoa veio (aba Alunos com os
// filtros, ou o Cockpit). Só caminhos do módulo; link antigo (só a query da
// tabela, da Fase 2) volta para a aba Alunos com aquela query.
export function hrefDeVolta(voltar: string | null): string {
  if (!voltar) return ROTA_ALUNOS;
  if (/^\/educacional(\/|\?|$)/.test(voltar)) return voltar;
  return voltar.startsWith("/") ? ROTA_ALUNOS : `${ROTA_ALUNOS}?${voltar}`;
}

// Página do Raio-X com o caminho de volta.
export function hrefDoRaioX(alunoId: string, voltar: string): string {
  return `${ROTA_ALUNOS}/${encodeURIComponent(alunoId)}?voltar=${encodeURIComponent(voltar)}`;
}

// Link salvo da Fase 2 (`/educacional?etapa=…`): a tabela mudou para a aba
// Alunos. Devolve o destino com a mesma query, ou null se não houver o que levar.
export function destinoDeLinkAntigo(sp: URLSearchParams): string | null {
  const e = lerEstado(sp);
  const temAlgo = temFiltro(e) || e.incluir_arquivados || e.visao === "kanban" || e.pagina > 1 || sp.has("ordem");
  if (!temAlgo) return null;
  const q = queryDoEstado(e, lerSimular(sp));
  return `${ROTA_ALUNOS}?${q}`;
}
