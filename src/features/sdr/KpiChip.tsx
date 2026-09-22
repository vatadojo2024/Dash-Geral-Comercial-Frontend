import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Card de KPI: "Notice Card" do design system — ícone num círculo colorido
// (w-8 h-8) à esquerda, rótulo e valor à direita, sombra em camadas.
// `detalhe` é a linha secundária; `destaque` realça o card que gera ação;
// `tom="neutro"` é número de conferência.
// ---------------------------------------------------------------------------

export function KpiChip({
  icon: Icon,
  rotulo,
  valor,
  detalhe,
  destaque = false,
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
        "flex items-start gap-3 rounded-2xl border p-4 shadow-layered transition-all",
        destaque ? "border-laranja/50 bg-laranja/10" : "border-white/10 bg-white/5",
        neutro && "border-dashed",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          destaque ? "bg-laranja/20 text-laranja" : neutro ? "bg-white/10 text-cinza" : "bg-info-forte/20 text-info",
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-xs opacity-70">{rotulo}</p>
        <p className={cn("text-lg font-semibold tabular-nums", destaque ? "text-laranja" : neutro ? "text-cinza" : "text-texto")}>
          {valor}
        </p>
        {detalhe && <p className="text-xs opacity-70">{detalhe}</p>}
      </div>
    </div>
  );
}
