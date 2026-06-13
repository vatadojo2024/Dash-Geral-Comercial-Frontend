import { corDoGap, corDoNoShow, type SdrMetrics } from "@/lib/data/sdrDashboard";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

// 6.4d — Visão Detalhada por SDR: tabela com todas as colunas do original.
const COR_STATUS = {
  verde: "text-verde",
  amarelo: "text-amarelo",
  vermelho: "text-rosa",
} as const;

const COLUNAS = [
  "SDR",
  "Meta",
  "Estágio",
  "Agendadas",
  "Realizadas",
  "QC",
  "Ninja",
  "Black",
  "Prime",
  "Private",
  "Bônus QC",
  "Qualificados",
  "Gap p/ Meta",
  "No-Show",
];

export function PerformanceTable({
  sdrs,
  destaqueSdr,
}: {
  sdrs: SdrMetrics[];
  destaqueSdr: string | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Visão detalhada por SDR"
        subtitle="Todas as métricas do mês, lado a lado"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-borda/60">
              {COLUNAS.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-texto-sec"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sdrs.map((m) => (
              <tr
                key={m.sdr}
                className={cn(
                  "border-b border-borda/30 last:border-0",
                  destaqueSdr === m.sdr && "bg-azul/10",
                )}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium text-texto">
                  {m.sdr}
                  {destaqueSdr === m.sdr && (
                    <span className="ml-2 rounded-full border border-azul/30 bg-azul/15 px-1.5 py-px text-[10px] text-azul-claro">
                      você
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">
                  {m.metas ? m.metas.join("/") : "—"}
                </td>
                <td className="px-3 py-2 text-texto-sec">{m.nivelAtual ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums text-texto">{m.callsAgendadas}</td>
                <td className="px-3 py-2 tabular-nums text-texto">{m.callsRealizadas}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.produtos.qc}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.produtos.ninja}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.produtos.black}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.produtos.prime}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.produtos.private}</td>
                <td className="px-3 py-2 tabular-nums text-texto-sec">{m.bonusQC}</td>
                <td className="px-3 py-2 font-semibold tabular-nums text-texto">
                  {m.qualificados}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 font-semibold tabular-nums",
                    m.gap !== null ? COR_STATUS[corDoGap(m.gap)] : "text-texto-sec",
                  )}
                >
                  {m.gap ?? "—"}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium tabular-nums",
                    COR_STATUS[corDoNoShow(m.noShowPct)],
                  )}
                >
                  {m.noShowCount} ({m.noShowPct.toFixed(1).replace(".", ",")}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
