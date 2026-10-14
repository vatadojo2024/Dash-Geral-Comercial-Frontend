import {
  ETAPAS,
  NIVEIS_RISCO,
  SINAIS,
  STATUS_CHECKPOINT,
  type Etapa,
  type NivelRisco,
  type Sinal,
  type StatusCheckpoint,
} from "@/lib/educacional/contrato";
import { queryDosFiltros, type FiltrosAlunos, type OrdemAlunos, type Simular } from "@/lib/educacional/apiEducacional";
import { ROTULO_ETAPA, ROTULO_RISCO, ROTULO_SINAL, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";

// ---------------------------------------------------------------------------
// Estado da Tabela tática na URL (filtros, ordem, página, Lista | Kanban): os
// cliques do Cockpit escrevem nesses parâmetros e o Raio-X volta para a mesma
// URL. Puro (sem React), para testar.
// ---------------------------------------------------------------------------

export type Visao = "lista" | "kanban";
export type EstadoTabela = Required<Pick<FiltrosAlunos, "ordem" | "pagina">> &
  Omit<FiltrosAlunos, "ordem" | "pagina"> & { visao: Visao };

const ORDENS: readonly OrdemAlunos[] = [
  "risco", "-risco", "nome", "-nome", "nivel_inicial", "-nivel_inicial", "etapa_atual", "-etapa_atual",
  "checkpoint", "-checkpoint", "dias_estagnados", "-dias_estagnados", "proxima_acao", "-proxima_acao",
  "responsavel", "-responsavel",
];

function umDe<T extends string>(valores: readonly T[], v: string | null): T | null {
  return v && (valores as readonly string[]).includes(v) ? (v as T) : null;
}

export function lerEstado(sp: URLSearchParams): EstadoTabela {
  const checkpoint = (sp.get("checkpoint") ?? "")
    .split(",")
    .flatMap((v) => (umDe(STATUS_CHECKPOINT, v.trim()) ? [v.trim() as StatusCheckpoint] : []));
  const health = Number(sp.get("health_max"));
  const pagina = Number(sp.get("pagina"));
  return {
    etapa: umDe<Etapa>(ETAPAS, sp.get("etapa")),
    risco: umDe<NivelRisco>(NIVEIS_RISCO, sp.get("risco")),
    checkpoint,
    responsavel: sp.get("responsavel")?.trim() || null,
    sinal: umDe<Sinal>(SINAIS, sp.get("sinal")),
    health_max: sp.get("health_max") && Number.isFinite(health) ? health : null,
    ordem: umDe(ORDENS, sp.get("ordem")) ?? "risco",
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
  return Boolean(e.etapa || e.risco || e.checkpoint?.length || e.responsavel || e.sinal || e.health_max != null);
}

export function semFiltros(e: EstadoTabela): EstadoTabela {
  return { ...e, etapa: null, risco: null, checkpoint: [], responsavel: null, sinal: null, health_max: null, pagina: 1 };
}

// Descrição do chip "Filtro ativo".
export function descreverFiltros(e: EstadoTabela): string[] {
  const partes: string[] = [];
  if (e.etapa) partes.push(`Etapa: ${ROTULO_ETAPA[e.etapa]}`);
  if (e.risco) partes.push(`Risco: ${ROTULO_RISCO[e.risco]}`);
  if (e.checkpoint?.length) partes.push(`Checkpoint: ${e.checkpoint.map((c) => ROTULO_STATUS_CHECKPOINT[c]).join(" + ")}`);
  if (e.responsavel) partes.push(`Responsável: ${e.responsavel}`);
  if (e.sinal) partes.push(`Sinal: ${ROTULO_SINAL[e.sinal]}`);
  if (e.health_max != null) partes.push(`Health Score abaixo de ${e.health_max}`);
  return partes;
}

// Link de um clique do Cockpit: troca os filtros (mantém a visão) e desce até a tabela.
export function hrefDoFiltro(atual: EstadoTabela, filtro: Partial<EstadoTabela>, simular?: Simular): string {
  const q = queryDoEstado({ ...semFiltros(atual), ...filtro, pagina: 1 }, simular);
  return `/educacional${q ? `?${q}` : ""}#tabela-tatica`;
}
