import type { LeadListItem, Temperatura } from "@/lib/api/contracts";
import { leadAtivo } from "@/features/dashboard/derivacoes";

// ---------------------------------------------------------------------------
// Centro de Ações em modo LEITURA (roadmap Parte 7, decisão 1): agrega
// proxima_acao + alertas dos leads visíveis ao papel. A ação é TEXTO
// recalculado pelo motor de score — não há "concluir". Funções puras.
// ---------------------------------------------------------------------------

// Os alertas do motor são texto livre; categorizamos por substring (sem acento,
// case-insensitive) para virar filtro — mesma técnica dos produtos no 5.2.
export const TIPOS_ALERTA = [
  { chave: "no_show", label: "No-show" },
  { chave: "parado", label: "Parado" },
  { chave: "conjuge_socio", label: "Cônjuge/sócio" },
  { chave: "call_proxima", label: "Call em menos de 24h" },
  { chave: "ciclo_longo", label: "Ciclo longo" },
  { chave: "urgencia_baixa", label: "Urgência baixa" },
] as const;
export type TipoAlertaChave = (typeof TIPOS_ALERTA)[number]["chave"];

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function tipoDoAlerta(alerta: string | null | undefined): TipoAlertaChave | null {
  const n = normalizar(alerta);
  if (n.includes("no-show") || n.includes("no show")) return "no_show";
  if (n.includes("parado")) return "parado";
  if (n.includes("conjuge") || n.includes("socio")) return "conjuge_socio";
  if (n.includes("call em menos")) return "call_proxima";
  if (n.includes("ciclo longo")) return "ciclo_longo";
  if (n.includes("urgencia baixa")) return "urgencia_baixa";
  return null;
}

export function tiposDoLead(lead: LeadListItem): TipoAlertaChave[] {
  const tipos = new Set<TipoAlertaChave>();
  // alertas pode vir ausente/não-array em dados fora do contrato — não quebra.
  for (const alerta of Array.isArray(lead.alertas) ? lead.alertas : []) {
    const tipo = tipoDoAlerta(alerta);
    if (tipo) tipos.add(tipo);
  }
  return [...tipos];
}

function csv(valor: string | null): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

// Filtros da tela (URL como fonte de verdade): temperatura, tipo de alerta e,
// para admin, closer/SDR. Só leads ATIVOS entram (blacklist/fechado fora),
// ordenados por score desc — a prioridade recomendada.
export function filtrarAcoes(
  leads: LeadListItem[],
  sp: URLSearchParams,
): LeadListItem[] {
  const temperaturas = csv(sp.get("temperatura")) as Temperatura[];
  const alertas = csv(sp.get("alerta")) as TipoAlertaChave[];
  const closer = sp.get("closer");
  const sdr = sp.get("sdr");

  return leads
    .filter((l) => {
      if (!leadAtivo(l)) return false;
      if (temperaturas.length && !temperaturas.includes(l.temperatura)) return false;
      if (alertas.length) {
        const doLead = tiposDoLead(l);
        if (!alertas.some((a) => doLead.includes(a))) return false;
      }
      if (closer && l.closer_id !== closer) return false;
      if (sdr && l.sdr_id !== sdr) return false;
      return true;
    })
    .sort((a, b) => b.score_final - a.score_final);
}

export type GrupoAcao = { acao: string; leads: LeadListItem[] };

// Agrupamento opcional por tipo de ação: a proxima_acao é template do motor,
// então o próprio texto identifica o tipo. Grupos ordenados pelo maior score.
export function agruparPorAcao(leads: LeadListItem[]): GrupoAcao[] {
  const grupos = new Map<string, LeadListItem[]>();
  for (const lead of leads) {
    const atual = grupos.get(lead.proxima_acao) ?? [];
    atual.push(lead);
    grupos.set(lead.proxima_acao, atual);
  }
  return [...grupos.entries()]
    .map(([acao, doGrupo]) => ({ acao, leads: doGrupo }))
    .sort((a, b) => b.leads[0].score_final - a.leads[0].score_final);
}
