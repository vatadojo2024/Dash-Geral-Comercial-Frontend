// ---------------------------------------------------------------------------
// Sub-abas da Produtividade SDR — módulo SEM "use client" de propósito: é
// importado tanto pelo SdrView (client) quanto pela página (server) para
// resolver o slug da rota. Exportar isto de um módulo client faria o servidor
// receber uma referência de client component em vez do array.
// ---------------------------------------------------------------------------

import type { Area } from "@/lib/api/contracts";
import type { RecorteLevantou } from "@/lib/sdr/oportunidades";

export type AbaSdr = "dashboard" | "agendamentos" | "levantou" | "comissoes" | "lideranca";

// Cada sub-aba pertence a uma área (GET /api/me → areas): todas são
// `produtividade_sdr`, menos a Liderança, que tem área própria.
export const ABAS_SDR: { aba: AbaSdr; slug: string; label: string; area: Area }[] = [
  { aba: "dashboard", slug: "", label: "Dashboard SDR", area: "produtividade_sdr" },
  { aba: "agendamentos", slug: "calls-por-ciclo", label: "Calls por Ciclo", area: "produtividade_sdr" },
  { aba: "levantou", slug: "oportunidades", label: "Oportunidades do Evento", area: "produtividade_sdr" },
  { aba: "comissoes", slug: "comissoes", label: "Comissões", area: "produtividade_sdr" },
  { aba: "lideranca", slug: "lideranca", label: "Liderança Pré-venda", area: "lideranca_pre_venda" },
];

export const ROTA_SDR = "/produtividade-sdr";

// Sub-abas (recortes) de "Levantou a Mão": /produtividade-sdr/levantou-a-mao/<slug>.
export const RECORTES_LEVANTOU: { recorte: RecorteLevantou; slug: string; label: string }[] = [
  { recorte: "geral", slug: "", label: "Visão geral" },
  { recorte: "ao_vivo", slug: "ao-vivo", label: "Ao vivo" },
  { recorte: "replay", slug: "replay", label: "Replay" },
  { recorte: "presentes", slug: "presentes-sem-aplicar", label: "Presentes que não aplicaram" },
  { recorte: "ausentes", slug: "nao-participaram", label: "Não participaram — Qualificados" },
  { recorte: "resgate", slug: "resgate", label: "Campanha de resgate" },
  { recorte: "nao_abordados", slug: "nao-abordados", label: "Não abordados" },
  { recorte: "descartes", slug: "descartes", label: "Descartes" },
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
