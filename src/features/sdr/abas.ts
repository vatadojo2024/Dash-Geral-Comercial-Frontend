// ---------------------------------------------------------------------------
// Sub-abas da Produtividade SDR — módulo SEM "use client" de propósito: é
// importado tanto pelo SdrView (client) quanto pela página (server) para
// resolver o slug da rota. Exportar isto de um módulo client faria o servidor
// receber uma referência de client component em vez do array.
// ---------------------------------------------------------------------------

import type { RecorteLevantou } from "@/lib/sdr/oportunidades";

export type AbaSdr = "dashboard" | "agendamentos" | "levantou" | "comissoes" | "lideranca";

export const ABAS_SDR: { aba: AbaSdr; slug: string; label: string; soAdmin?: boolean }[] = [
  { aba: "dashboard", slug: "", label: "Dashboard SDR" },
  { aba: "agendamentos", slug: "calls-por-ciclo", label: "Calls por Ciclo" },
  { aba: "levantou", slug: "oportunidades", label: "Oportunidades do Evento" },
  { aba: "comissoes", slug: "comissoes", label: "Comissões" },
  { aba: "lideranca", slug: "lideranca", label: "Liderança Pré-venda", soAdmin: true },
];

export const ROTA_SDR = "/produtividade-sdr";

// Sub-abas (recortes) de "Levantou a Mão": /produtividade-sdr/levantou-a-mao/<slug>.
export const RECORTES_LEVANTOU: { recorte: RecorteLevantou; slug: string; label: string }[] = [
  { recorte: "geral", slug: "", label: "Visão geral" },
  { recorte: "ao_vivo", slug: "ao-vivo", label: "Ao vivo" },
  { recorte: "replay", slug: "replay", label: "Replay" },
  { recorte: "resgate", slug: "resgate", label: "Campanha de resgate" },
  { recorte: "nao_abordados", slug: "nao-abordados", label: "Não abordados" },
];

export function hrefDoRecorte(recorte: RecorteLevantou): string {
  const base = hrefDaAba("levantou");
  const slug = RECORTES_LEVANTOU.find((r) => r.recorte === recorte)?.slug ?? "";
  return slug ? `${base}/${slug}` : base;
}

export function hrefDaAba(aba: AbaSdr): string {
  const slug = ABAS_SDR.find((a) => a.aba === aba)?.slug ?? "";
  return slug ? `${ROTA_SDR}/${slug}` : ROTA_SDR;
}
