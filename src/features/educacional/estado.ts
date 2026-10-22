import { FAIXAS_SAUDE, SINAIS, STATUS_ALUNO, STATUS_CHECKPOINT, type StatusCheckpoint } from "@/lib/educacional/contrato";
import { ehOrdem, queryDosFiltros, type FiltrosAlunos, type Simular } from "@/lib/educacional/apiEducacional";
import { ROTULO_FAIXA, ROTULO_SINAL, ROTULO_STATUS_ALUNO, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";

// ---------------------------------------------------------------------------
// Estado da Tabela tática na URL (filtros, ordem, página, Lista | Kanban): os
// cliques do Cockpit escrevem nesses parâmetros e o Raio-X volta para a mesma
// URL. Puro (sem React), para testar. Na Fase 2, etapa e responsável são ids
// (vêm da configuração); os nomes chegam por `nomes` para descrever o filtro.
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
    e.etapa || e.risco || e.checkpoint?.length || e.responsavel || e.sinal || e.health_max != null || e.status_aluno,
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
    pagina: 1,
  };
}

export type NomesDosFiltros = { etapa?: (id: string) => string | undefined; responsavel?: (id: string) => string | undefined };

// Descrição do chip "Filtro ativo".
export function descreverFiltros(e: EstadoTabela, nomes: NomesDosFiltros = {}): string[] {
  const partes: string[] = [];
  if (e.etapa) partes.push(`Etapa: ${nomes.etapa?.(e.etapa) ?? "—"}`);
  if (e.risco) partes.push(`Faixa: ${ROTULO_FAIXA[e.risco]}`);
  if (e.checkpoint?.length) partes.push(`Checkpoint: ${e.checkpoint.map((c) => ROTULO_STATUS_CHECKPOINT[c]).join(" + ")}`);
  if (e.responsavel) partes.push(`Responsável: ${nomes.responsavel?.(e.responsavel) ?? "—"}`);
  if (e.sinal) partes.push(`Sinal: ${ROTULO_SINAL[e.sinal]}`);
  if (e.health_max != null) partes.push(`Health Score abaixo de ${e.health_max}`);
  if (e.status_aluno) partes.push(`Status: ${ROTULO_STATUS_ALUNO[e.status_aluno]}`);
  return partes;
}

// Link de um clique do Cockpit: troca os filtros (mantém a visão) e desce até a tabela.
export function hrefDoFiltro(atual: EstadoTabela, filtro: Partial<EstadoTabela>, simular?: Simular): string {
  const q = queryDoEstado({ ...semFiltros(atual), incluir_arquivados: false, ...filtro, pagina: 1 }, simular);
  return `/educacional${q ? `?${q}` : ""}#tabela-tatica`;
}
