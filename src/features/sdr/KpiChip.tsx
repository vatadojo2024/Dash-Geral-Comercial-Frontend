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
  // "neutro": número de conferência (cinza), não de ação.
  tom = "padrao",
  className,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  tom?: "padrao" | "neutro";
  className?: string;
}) {
  const neutro = tom === "neutro" && !destaque;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        destaque ? "border-laranja/50 bg-laranja/10" : "border-borda bg-painel",
        neutro && "border-dashed",
        className,
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          destaque ? "text-laranja" : neutro ? "text-cinza" : "text-azul-claro",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-texto-sec">{rotulo}</p>
        <p
          className={cn(
            "text-lg font-bold tabular-nums",
            destaque ? "text-laranja" : neutro ? "text-cinza" : "text-texto",
          )}
        >
          {valor}
        </p>
        {detalhe && <p className="text-[11px] text-texto-sec">{detalhe}</p>}
      </div>
    </div>
  );
}
