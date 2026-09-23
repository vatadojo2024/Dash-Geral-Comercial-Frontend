import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Card de KPI: "Notice Card" do design system — ícone num círculo colorido
// (w-8 h-8) à esquerda, rótulo e valor à direita, sombra em camadas.
// `detalhe` é a linha secundária; `destaque` realça o card que gera ação;
// `tom="neutro"` é número de conferência; `filtro` é a etiqueta que diz QUAL
// recorte o número carrega ("sem filtro", "MQL+ ou acima"); `href` torna o
// card um link (abre a lista por trás do número).
// ---------------------------------------------------------------------------

export function KpiChip({
  icon: Icon,
  rotulo,
  valor,
  detalhe,
  destaque = false,
  tom = "padrao",
  filtro,
  href,
  className,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  tom?: "padrao" | "neutro";
  filtro?: string;
  href?: string;
  className?: string;
}) {
  const neutro = tom === "neutro" && !destaque;
  const classes = cn(
    "relative flex items-start gap-3 rounded-2xl border p-4 shadow-layered transition-all",
    destaque ? "border-laranja/50 bg-laranja/10" : "border-white/10 bg-white/5",
    neutro && "border-dashed",
    href && "cursor-pointer pr-8 hover:-translate-y-px hover:border-white/25 hover:bg-white/10",
    className,
  );
  const conteudo = (
    <>
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
        {filtro && (
          <span
            className={cn(
              "tag mt-1.5 px-1.5 py-px normal-case tracking-normal",
              destaque ? "border-laranja/40 bg-laranja/15 text-laranja" : "opacity-70",
            )}
          >
            {filtro}
          </span>
        )}
      </div>
      {href && (
        <ChevronRight className="absolute right-3 top-4 h-4 w-4 opacity-50" aria-hidden />
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes} title="Abrir a lista">
        {conteudo}
      </Link>
    );
  }
  return <div className={classes}>{conteudo}</div>;
}
