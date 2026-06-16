import { AlertTriangle, Bot, Lock } from "lucide-react";
import type { Etapa, Temperatura } from "@/lib/api/contracts";
import { etapaLabel, TEMPERATURA_CONFIG } from "@/lib/formatters/score";
import { labelTrava } from "@/lib/formatters/labels";
import { cn } from "@/lib/utils/cn";

// Acessibilidade: temperatura/alerta nunca dependem só de cor — sempre
// cor + ícone + texto. Cores exclusivamente via tokens da paleta unificada.

export function TemperatureBadge({
  temperatura,
  size = "md",
}: {
  temperatura: Temperatura;
  size?: "sm" | "md";
}) {
  const cfg = TEMPERATURA_CONFIG[temperatura];
  const Icon = cfg.icon;
  return (
    <span
      title={`Score ${cfg.faixa}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        cfg.badge,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function ScoreBadge({
  final,
  bruto,
  size = "md",
}: {
  final: number;
  bruto?: number;
  size?: "md" | "lg";
}) {
  const cfg = TEMPERATURA_CONFIG[temperaturaDoScore(final)];
  return (
    <span className="inline-flex flex-col items-end">
      <span
        className={cn(
          "font-bold tabular-nums leading-none",
          cfg.text,
          size === "lg" ? "text-3xl" : "text-xl",
        )}
      >
        {final}
      </span>
      {bruto !== undefined && bruto !== final && (
        <span className="mt-0.5 text-[11px] text-texto-sec" title="Score antes da trava">
          bruto {bruto}
        </span>
      )}
    </span>
  );
}

function temperaturaDoScore(score: number): Temperatura {
  if (score >= 90) return "muito_quente";
  if (score >= 75) return "quente";
  if (score >= 60) return "morno_alto";
  if (score >= 45) return "morno_baixo";
  if (score >= 30) return "frio";
  return "congelado";
}

export function EtapaBadge({ etapa, size = "md" }: { etapa: Etapa | null; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        etapa
          ? "border-borda bg-painel-claro text-texto-sec"
          : "border-dashed border-borda bg-transparent text-texto-sec/80",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {etapaLabel(etapa)}
    </span>
  );
}

export function AlertaBadge({ alerta, size = "md" }: { alerta: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-rosa/30 bg-rosa/15 font-medium text-rosa",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <AlertTriangle className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {alerta}
    </span>
  );
}

// Origem Hana (sdr_pool=true): lead da IA agendadora, visível a todos os SDRs.
export function HanaBadge({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      title="Lead do pool da Hana (IA agendadora) — visível a todos os SDRs"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-violeta/30 bg-violeta/15 font-medium text-violeta",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Bot className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Pool da Hana
    </span>
  );
}

export function TravaBadge({ trava, size = "md" }: { trava: string; size?: "sm" | "md" }) {
  const texto = labelTrava(trava) ?? trava;
  return (
    <span
      title={texto}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-laranja/30 bg-laranja/15 font-medium text-laranja",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Lock className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      Trava: {texto}
    </span>
  );
}
