"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

// Hook para os ÚNICOS consumidores de cor em JS (gráficos recharts e células
// do heatmap, que precisam de cor bruta em inline-style). Lê as MESMAS
// variáveis CSS de globals.css (single source) via getComputedStyle, então
// nunca há divergência com as classes Tailwind. Re-lê quando o tema muda.

const TOKENS = [
  "noite",
  "painel",
  "painel-claro",
  "borda",
  "texto",
  "texto-sec",
  "azul",
  "azul-claro",
  "teal",
  "laranja",
  "verde",
  "rosa",
  "amarelo",
  "cinza",
  "violeta",
  "muito-quente",
  "quente",
  "morno-alto",
  "morno-baixo",
  "frio",
  "congelado",
] as const;

export type CorToken = (typeof TOKENS)[number];

// Fallback (canais do modo escuro) para o primeiro render antes do efeito
// rodar — espelha o :root de globals.css. Os gráficos são client-only, então
// esse instante é praticamente invisível.
const FALLBACK_DARK: Record<CorToken, string> = {
  noite: "11 19 34",
  painel: "19 29 48",
  "painel-claro": "25 39 63",
  borda: "48 65 95",
  texto: "229 238 252",
  "texto-sec": "147 164 195",
  azul: "59 130 246",
  "azul-claro": "86 145 255",
  teal: "45 212 191",
  laranja: "245 158 11",
  verde: "34 197 94",
  rosa: "251 113 133",
  amarelo: "250 204 21",
  cinza: "148 163 184",
  violeta: "167 139 250",
  "muito-quente": "251 113 133",
  quente: "245 158 11",
  "morno-alto": "250 204 21",
  "morno-baixo": "45 212 191",
  frio: "86 145 255",
  congelado: "148 163 184",
};

// Monta uma cor CSS a partir do trio de canais ("r g b"), com alpha opcional.
export function rgb(canais: string, alpha?: number): string {
  return alpha == null ? `rgb(${canais})` : `rgb(${canais} / ${alpha})`;
}

export function useThemeColors(): Record<CorToken, string> {
  const { tema } = useTheme();
  const [cores, setCores] = useState<Record<CorToken, string>>(FALLBACK_DARK);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const proximo = {} as Record<CorToken, string>;
    for (const t of TOKENS) {
      proximo[t] = cs.getPropertyValue(`--c-${t}`).trim() || FALLBACK_DARK[t];
    }
    setCores(proximo);
  }, [tema]);

  return cores;
}
