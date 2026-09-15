// ---------------------------------------------------------------------------
// Sub-abas da Produtividade SDR — módulo SEM "use client" de propósito: é
// importado tanto pelo SdrView (client) quanto pela página (server) para
// resolver o slug da rota. Exportar isto de um módulo client faria o servidor
// receber uma referência de client component em vez do array.
// ---------------------------------------------------------------------------

export type AbaSdr = "dashboard" | "agendamentos" | "levantou" | "comissoes" | "lideranca";

export const ABAS_SDR: { aba: AbaSdr; slug: string; label: string; soAdmin?: boolean }[] = [
  { aba: "dashboard", slug: "", label: "Dashboard SDR" },
  { aba: "agendamentos", slug: "calls-por-ciclo", label: "Calls por Ciclo" },
  { aba: "levantou", slug: "levantou-a-mao", label: "Levantou a Mão" },
  { aba: "comissoes", slug: "comissoes", label: "Comissões" },
  { aba: "lideranca", slug: "lideranca", label: "Liderança Pré-venda", soAdmin: true },
];

export const ROTA_SDR = "/produtividade-sdr";

export function hrefDaAba(aba: AbaSdr): string {
  const slug = ABAS_SDR.find((a) => a.aba === aba)?.slug ?? "";
  return slug ? `${ROTA_SDR}/${slug}` : ROTA_SDR;
}
