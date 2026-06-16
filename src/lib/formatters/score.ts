import {
  Flame,
  ThermometerSun,
  Sun,
  SunDim,
  Snowflake,
  ThermometerSnowflake,
  type LucideIcon,
} from "lucide-react";
import type { Etapa, Temperatura } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// As 6 temperaturas reais (roadmap 1.2) — sempre cor + ícone + texto.
// Escala térmica dentro da paleta unificada (6.4): rosa/laranja → amarelo/teal
// → azul/cinza. Badges no tema dark: fundo translúcido da própria cor.
// ---------------------------------------------------------------------------

type TemperaturaConfig = {
  label: string;
  faixa: string;
  ordem: number;
  icon: LucideIcon;
  hex: string;
  text: string;
  badge: string;
  dot: string;
};

export const TEMPERATURA_CONFIG: Record<Temperatura, TemperaturaConfig> = {
  muito_quente: {
    label: "Muito quente",
    faixa: "90–100",
    ordem: 0,
    icon: Flame,
    hex: "#fb7185",
    text: "text-muito-quente",
    badge: "bg-muito-quente/15 text-muito-quente border border-muito-quente/30",
    dot: "bg-muito-quente",
  },
  quente: {
    label: "Quente",
    faixa: "75–89",
    ordem: 1,
    icon: ThermometerSun,
    hex: "#f59e0b",
    text: "text-quente",
    badge: "bg-quente/15 text-quente border border-quente/30",
    dot: "bg-quente",
  },
  morno_alto: {
    label: "Morno alto",
    faixa: "60–74",
    ordem: 2,
    icon: Sun,
    hex: "#facc15",
    text: "text-morno-alto",
    badge: "bg-morno-alto/15 text-morno-alto border border-morno-alto/30",
    dot: "bg-morno-alto",
  },
  morno_baixo: {
    label: "Morno baixo",
    faixa: "45–59",
    ordem: 3,
    icon: SunDim,
    hex: "#2dd4bf",
    text: "text-morno-baixo",
    badge: "bg-morno-baixo/15 text-morno-baixo border border-morno-baixo/30",
    dot: "bg-morno-baixo",
  },
  frio: {
    label: "Frio",
    faixa: "30–44",
    ordem: 4,
    icon: Snowflake,
    hex: "#5691ff",
    text: "text-frio",
    badge: "bg-frio/15 text-frio border border-frio/30",
    dot: "bg-frio",
  },
  congelado: {
    label: "Congelado",
    faixa: "0–29",
    ordem: 5,
    icon: ThermometerSnowflake,
    hex: "#94a3b8",
    text: "text-congelado",
    badge: "bg-congelado/15 text-congelado border border-congelado/30",
    dot: "bg-congelado",
  },
};

export const TEMPERATURAS_ORDENADAS: Temperatura[] = [
  "muito_quente",
  "quente",
  "morno_alto",
  "morno_baixo",
  "frio",
  "congelado",
];

// ---------------------------------------------------------------------------
// As 12 etapas reais do funil (enum do backend). etapa_atual pode ser nula.
// ---------------------------------------------------------------------------

export const ETAPA_LABEL: Record<Etapa, string> = {
  "1a_call_agendada": "1ª call agendada",
  no_show_1a: "No-show 1ª call",
  em_atendimento: "Em atendimento",
  "2a_call_agendada": "2ª call agendada",
  "3a_call_agendada": "3ª call agendada",
  "4a_call_agendada": "4ª call agendada",
  "5a_mais_call_agendada": "5ª+ call agendada",
  "no-show": "No-show",
  fup_pos_pitch: "FUP pós-pitch",
  fup_infinito_perdido: "FUP infinito / perdido",
  blacklist: "Blacklist",
  fechado: "Fechado",
};

export const ETAPA_NULA_LABEL = "Sem etapa";

export function etapaLabel(etapa: Etapa | null): string {
  return etapa ? ETAPA_LABEL[etapa] : ETAPA_NULA_LABEL;
}

// Agrupamento do heatmap (decisão Vata 3.1.4): etapas agrupadas na grade,
// filtro fino fora dela. blacklist/fechado/sem etapa ficam fora da grade.
export type GrupoEtapa = {
  id: string;
  label: string;
  etapas: Etapa[];
};

export const GRUPOS_ETAPA_HEATMAP: GrupoEtapa[] = [
  { id: "1a_call", label: "1ª call", etapas: ["1a_call_agendada"] },
  { id: "em_atendimento", label: "Em atendimento", etapas: ["em_atendimento"] },
  { id: "2a_call", label: "2ª call", etapas: ["2a_call_agendada"] },
  {
    id: "3a_mais",
    label: "3ª+ call",
    etapas: ["3a_call_agendada", "4a_call_agendada", "5a_mais_call_agendada"],
  },
  { id: "no_show", label: "No-show", etapas: ["no_show_1a", "no-show"] },
  { id: "fup", label: "FUP", etapas: ["fup_pos_pitch", "fup_infinito_perdido"] },
];

export const ETAPAS_FORA_DO_HEATMAP: Etapa[] = ["blacklist", "fechado"];

// Produtos oficiais (sem variante S/A — como o backend guarda em
// produto_sugerido). chave = produto_sugerido normalizado (trim+lowercase).
export const PRODUTOS_OFICIAIS = [
  { chave: "qc", label: "QC" },
  { chave: "ninja", label: "Ninja" },
  { chave: "black", label: "Black" },
  { chave: "prime", label: "Prime" },
  { chave: "private", label: "Private" },
] as const;

export function chaveDoProduto(produtoSugerido: string | null): string | null {
  if (!produtoSugerido) return null;
  const norm = produtoSugerido.trim().toLowerCase();
  // Reduz à base canônica: ignora variante S/A e separadores ("ninja_s",
  // "Black A", "prime-anual" → "ninja"/"black"/"prime"). Se não bater nenhuma
  // base oficial, devolve o valor normalizado (ainda filtrável, sem casar as
  // opções oficiais). "private" não colide com "prime" (prefixo difere).
  const base = PRODUTOS_OFICIAIS.find((p) => norm.startsWith(p.chave));
  return base ? base.chave : norm;
}

// Rótulos dos 5 blocos reais do score (tetos 25/20/25/20/10)
export const BLOCO_LABEL: Record<string, string> = {
  momento: "Momento",
  fit: "Fit",
  urgencia: "Urgência",
  engajamento: "Engajamento",
  timing: "Timing",
};
