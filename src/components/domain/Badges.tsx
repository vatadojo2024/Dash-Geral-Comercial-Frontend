import { AlertTriangle, Bot, Lock, Star } from "lucide-react";
import type { Etapa, Temperatura } from "@/lib/api/contracts";
import { etapaLabel, TEMPERATURA_CONFIG } from "@/lib/formatters/score";
import { labelTrava } from "@/lib/formatters/labels";
import {
  mostraSeloNinja,
  nomeDono,
  origemDoLead,
  tierDoLead,
  type LeadPendente,
} from "@/lib/sdr/oportunidades";
import { cn } from "@/lib/utils/cn";

// Origem do lead no ciclo: "Ao vivo" ou "Replay" (não existe terceiro valor).
// Cor por token (config em lib/sdr/oportunidades). Valor não reconhecido
// (backend antigo) não renderiza nada.
export function OrigemBadge({
  lead,
  size = "md",
}: {
  lead: Pick<LeadPendente, "origem">;
  size?: "sm" | "md";
}) {
  const cfg = origemDoLead(lead);
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-medium",
        cfg.badge,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {cfg.label}
    </span>
  );
}

// Dono do negócio na Clint (SDR responsável). null → "Sem dono", neutro e
// tracejado, no mesmo estilo da etapa nula (EtapaBadge).
export function DonoBadge({
  dono,
  size = "md",
}: {
  dono: LeadPendente["dono"];
  size?: "sm" | "md";
}) {
  return (
    <span
      title={dono?.email ?? undefined}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border font-medium",
        dono
          ? "border-borda bg-painel-claro text-texto-sec"
          : "border-dashed border-borda bg-transparent text-texto-sec/80",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {nomeDono(dono)}
    </span>
  );
}

// Selo discreto "Ninja": o lead tem a marcação "Possível Ninja" mas o tier é da
// escala MQL (precedência). Não renderiza quando o próprio tier já é Ninja.
export function SeloNinja({ lead }: { lead: Pick<LeadPendente, "tier" | "tier_rank" | "possivel_ninja"> }) {
  if (!mostraSeloNinja(lead)) return null;
  return (
    <span
      title="Também tem a marcação Possível Ninja na Clint — classificado pela escala MQL, que tem precedência"
      className="inline-flex items-center whitespace-nowrap rounded-full border border-verde/40 px-1.5 py-px text-[10px] font-medium text-verde"
    >
      Ninja
    </span>
  );
}

// Classificação (escala MQL, Ninja ou sem classificação). Cor
// pela escala de temperatura do tema (config em lib/sdr/oportunidades) — o
// texto do tier sempre acompanha a cor.
export function MqlBadge({
  lead,
  size = "md",
}: {
  lead: Pick<LeadPendente, "tier" | "tier_rank">;
  size?: "sm" | "md";
}) {
  const cfg = tierDoLead(lead);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-medium",
        cfg.badge,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {cfg.label}
    </span>
  );
}

// Acessibilidade: temperatura/alerta nunca dependem só de cor — sempre
// cor + ícone + texto. Cores exclusivamente via tokens da paleta unificada.

// Estrela dourada do lead em destaque (marcação manual do admin). É SÓ um
// marcador visual de prioridade — não representa score nem etapa. Fica ao lado
// do nome, no card da fila e no cabeçalho do detalhe; leads sem destaque não
// renderizam ícone nenhum. Cor via token amarelo da paleta unificada.
export function EstrelaDestaque({
  size = "md",
  // ligada=false = contorno apagado, usado como ícone do rótulo do switch. Nesse
  // estado a estrela é DECORATIVA: quem anuncia é o próprio switch ("Destaque",
  // aria-checked). Só a estrela acesa se apresenta como "Lead em destaque".
  ligada = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  ligada?: boolean;
  className?: string;
}) {
  const icone = (
    <Star
      aria-hidden
      className={cn(
        "shrink-0",
        ligada ? "fill-amarelo text-amarelo" : "fill-none text-texto-sec",
        size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4",
        className,
      )}
    />
  );

  if (!ligada) return icone;

  return (
    <span
      role="img"
      aria-label="Lead em destaque"
      title="Lead em destaque — priorizado manualmente pelo admin"
      className="inline-flex shrink-0"
    >
      {icone}
    </span>
  );
}

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
