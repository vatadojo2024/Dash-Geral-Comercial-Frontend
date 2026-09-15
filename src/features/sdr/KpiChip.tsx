import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Card de KPI da Produtividade SDR (ícone + rótulo + valor), compartilhado
// pelas abas. `detalhe` é a linha secundária (ex.: "% do no evento");
// `destaque` realça o card que gera ação (ex.: Pendentes).
// ---------------------------------------------------------------------------

export function KpiChip({
  icon: Icon,
  rotulo,
  valor,
  detalhe,
  destaque = false,
  className,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        destaque ? "border-laranja/50 bg-laranja/10" : "border-borda bg-painel",
        className,
      )}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", destaque ? "text-laranja" : "text-azul-claro")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-texto-sec">{rotulo}</p>
        <p className={cn("text-lg font-bold tabular-nums", destaque ? "text-laranja" : "text-texto")}>
          {valor}
        </p>
        {detalhe && <p className="text-[11px] text-texto-sec">{detalhe}</p>}
      </div>
    </div>
  );
}
