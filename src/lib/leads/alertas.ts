import type { LeadListItem } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Categorização dos ALERTAS do motor de score (texto livre → tipo). Veio do
// antigo Centro de Ações (removido em set/2026); hoje alimenta a Visão Geral
// ("Leads parados"). Funções puras.
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
