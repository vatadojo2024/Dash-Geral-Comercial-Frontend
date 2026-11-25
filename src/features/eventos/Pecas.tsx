import { AlertTriangle } from "lucide-react";
import {
  DICA_NAO_MEDIDO,
  sentidoDaVariacao,
  textoDaTaxa,
  textoDaVariacao,
  TRAVESSAO,
  type Evento,
  type Taxa,
  type Variacao,
} from "@/lib/eventos/comparativo";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Peças pequenas da aba Eventos ao Vivo: taxa (com travessão e alerta), contagem
// (com travessão), variação colorida e os selos de cada evento.
// ---------------------------------------------------------------------------

export const DICA_APROXIMADO =
  "Presença aproximada: a tag de tempo assistido já tinha sido apagada, e a presença saiu das tags que sobraram.";
export const DICA_EM_ANDAMENTO = "Janela aberta: ainda entra agendamento novo, e o número pode subir.";

/** Uma taxa: % | travessão com dica | alerta (acima de 100%). */
export function TextoTaxa({ taxa, aproximado = false, className }: { taxa: Taxa; aproximado?: boolean; className?: string }) {
  const t = textoDaTaxa(taxa);
  if (t.alerta) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-aviso", className)} title={t.dica ?? undefined}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{t.dica}</span>
      </span>
    );
  }
  const dica = t.dica ?? (aproximado ? DICA_APROXIMADO : undefined);
  return (
    <span className={cn("tabular-nums", className)} title={dica} aria-label={dica ? `${t.texto} (${dica})` : undefined}>
      {aproximado && taxa.tipo === "pct" ? "≈ " : ""}
      {t.texto}
    </span>
  );
}

/** Uma contagem: o número, ou travessão com a dica do porquê. */
export function TextoContagem({ n, dica = DICA_NAO_MEDIDO, className }: { n: number | null; dica?: string; className?: string }) {
  if (n == null) {
    return (
      <span className={cn("tabular-nums", className)} title={dica} aria-label={`${TRAVESSAO} (${dica})`}>
        {TRAVESSAO}
      </span>
    );
  }
  return <span className={cn("tabular-nums", className)}>{n.toLocaleString("pt-BR")}</span>;
}

/**
 * Variação: verde para alta, rosa para queda. Sem cor quando não é colorível
 * (agendamento com a janela aberta: o número ainda sobe, então "queda" seria falso).
 */
export function TextoVariacao({ v, colorir, dica }: { v: Variacao; colorir: boolean; dica?: string }) {
  if (v.tipo === "indisponivel") {
    return (
      <span className="tabular-nums text-texto-sec" title={v.motivo} aria-label={`${TRAVESSAO} (${v.motivo})`}>
        {TRAVESSAO}
      </span>
    );
  }
  const sentido = sentidoDaVariacao(v);
  const cor = !colorir || !sentido ? "text-texto-sec" : sentido > 0 ? "text-sucesso" : "text-erro";
  return (
    <span className={cn("tabular-nums font-medium", cor)} title={dica}>
      {textoDaVariacao(v)}
    </span>
  );
}

const SELO = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-medium";

export function SeloModo({ modo }: { modo: Evento["modo_presenca"] }) {
  return modo === "exato" ? (
    <span className={cn(SELO, "border-teal/40 bg-teal/10 text-teal")} title="Presença exata: medida pelo tempo assistido de cada contato.">
      exato
    </span>
  ) : (
    <span className={cn(SELO, "border-white/15 bg-white/5 text-texto-sec")} title={DICA_APROXIMADO}>
      aproximado
    </span>
  );
}

export function SeloJanelaAberta() {
  return (
    <span className={cn(SELO, "border-info/40 bg-info/10 text-info")} title={DICA_EM_ANDAMENTO}>
      em andamento
    </span>
  );
}

export function SeloBaseInsuficiente() {
  return (
    <span
      className={cn(SELO, "border-laranja/40 bg-laranja/10 text-laranja")}
      title="Menos de 50 inscritos: a tag existe, mas não houve webinar de verdade. Fica fora das médias e do gráfico de tendência."
    >
      base insuficiente
    </span>
  );
}

/** Ícone de aviso com as incoerências que o backend detectou na linha. */
export function IconeAvisos({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null;
  const texto = `Contagens incoerentes: ${avisos.map(traduzirAviso).join("; ")}`;
  return (
    <span className="inline-flex text-aviso" title={texto} aria-label={texto} role="img">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

// "ao_vivo_aplicaram_acima_de_assistiram" → "ao vivo: aplicaram acima de assistiram".
export function traduzirAviso(aviso: string): string {
  if (aviso === "assistiram_acima_da_base") return "assistiram acima da base (inscritos + convidados)";
  if (aviso === "tiers_nao_somam") return "a soma dos tiers não fecha com os presentes";
  if (aviso === "matriz_incoerente") return "aplicações ao vivo + replay não fecham com o total";
  const m = aviso.match(/^(ao_vivo|replay|total|resgate)_(.+)$/);
  if (!m) return aviso.replace(/_/g, " ");
  const bloco = m[1] === "ao_vivo" ? "ao vivo" : m[1];
  return `${bloco}: ${m[2].replace(/_/g, " ")}`;
}
