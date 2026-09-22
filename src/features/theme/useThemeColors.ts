"use client";

import { useEffect, useState } from "react";

// Hook para os ÚNICOS consumidores de cor em JS (gráficos recharts e células
// do heatmap, que precisam de cor bruta em inline-style). Lê as MESMAS
// variáveis CSS de globals.css (single source) via getComputedStyle, então
// nunca há divergência com as classes Tailwind. Tema escuro único: lê uma vez
// após a montagem.

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

// Fallback para o primeiro render, antes do efeito rodar — espelha o :root de
// globals.css. Os gráficos são client-only, então esse instante é invisível.
const FALLBACK: Record<CorToken, string> = {
  noite: "20 18 21",
  painel: "34 31 36",
  "painel-claro": "46 42 48",
  borda: "74 66 74",
  texto: "255 255 255",
  "texto-sec": "196 200 212",
  azul: "196 60 68",
  "azul-claro": "228 110 116",
  teal: "45 212 191",
  laranja: "245 158 11",
  verde: "52 211 153",
  rosa: "251 113 133",
  amarelo: "250 204 21",
  cinza: "148 163 184",
  violeta: "250 176 176",
  "muito-quente": "251 113 133",
  quente: "245 158 11",
  "morno-alto": "250 204 21",
  "morno-baixo": "45 212 191",
  frio: "96 165 250",
  congelado: "148 163 184",
};

// Monta uma cor CSS a partir do trio de canais ("r g b"), com alpha opcional.
export function rgb(canais: string, alpha?: number): string {
  return alpha == null ? `rgb(${canais})` : `rgb(${canais} / ${alpha})`;
}

export function useThemeColors(): Record<CorToken, string> {
  const [cores, setCores] = useState<Record<CorToken, string>>(FALLBACK);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const proximo = {} as Record<CorToken, string>;
    for (const t of TOKENS) {
      proximo[t] = cs.getPropertyValue(`--c-${t}`).trim() || FALLBACK[t];
    }
    setCores(proximo);
  }, []);

  return cores;
}
