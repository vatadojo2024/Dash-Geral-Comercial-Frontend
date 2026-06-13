import type { Config } from "tailwindcss";

// Paleta unificada com o Dashboard de Produtividade SDR (DOCUMENTACAO.md §9,
// decisão Vata 6.4). Os hex moram em src/app/globals.css como variáveis CSS
// (--c-*), com modo escuro (:root) e claro (:root.light). Aqui só mapeamos os
// tokens para rgb(var(--c-x) / <alpha-value>) — assim cada classe respeita o
// tema e o modificador de opacidade (ex.: bg-rosa/15, border-borda/60).
const cor = (token: string) => `rgb(var(--c-${token}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base
        noite: cor("noite"),
        painel: { DEFAULT: cor("painel"), claro: cor("painel-claro") },
        borda: cor("borda"),
        texto: { DEFAULT: cor("texto"), sec: cor("texto-sec") },
        // Funcionais
        azul: { DEFAULT: cor("azul"), claro: cor("azul-claro") },
        teal: cor("teal"),
        laranja: cor("laranja"),
        verde: cor("verde"),
        rosa: cor("rosa"),
        amarelo: cor("amarelo"),
        cinza: cor("cinza"),
        violeta: cor("violeta"),
        // Escala térmica das 6 temperaturas
        "muito-quente": cor("muito-quente"),
        quente: cor("quente"),
        "morno-alto": cor("morno-alto"),
        "morno-baixo": cor("morno-baixo"),
        frio: cor("frio"),
        congelado: cor("congelado"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
};

export default config;
