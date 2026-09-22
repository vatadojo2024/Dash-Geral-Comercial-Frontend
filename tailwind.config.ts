import type { Config } from "tailwindcss";

// Paleta do design system "Glass UI" (referencia_temporaria/design-system.html).
// Os canais RGB moram em src/app/globals.css (--c-*) — tema escuro único. Aqui
// só mapeamos os tokens para rgb(var(--c-x) / <alpha-value>), assim cada classe
// respeita o modificador de opacidade (ex.: bg-azul/30, border-white/20).
const cor = (token: string) => `rgb(var(--c-${token}) / <alpha-value>)`;

// Sombra em camadas do DS (modal, ícone em círculo do cabeçalho, notice card).
const SOMBRA_CAMADAS =
  "0 2.8px 2.2px rgba(0,0,0,0.034), 0 6.7px 5.3px rgba(0,0,0,0.048), 0 12.5px 10px rgba(0,0,0,0.06), 0 22.3px 17.9px rgba(0,0,0,0.072), 0 41.8px 33.4px rgba(0,0,0,0.086), 0 100px 80px rgba(0,0,0,0.12)";

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
        // Funcionais (azul = primary-500, azul-claro = primary-700, violeta = secondary)
        azul: { DEFAULT: cor("azul"), claro: cor("azul-claro") },
        teal: cor("teal"),
        laranja: cor("laranja"),
        verde: cor("verde"),
        rosa: cor("rosa"),
        amarelo: cor("amarelo"),
        cinza: cor("cinza"),
        violeta: cor("violeta"),
        // Tags do DS: texto (300) e forte (500) para fundo/borda
        sucesso: { DEFAULT: cor("sucesso"), forte: cor("sucesso-forte") },
        info: { DEFAULT: cor("info"), forte: cor("info-forte") },
        aviso: { DEFAULT: cor("aviso"), forte: cor("aviso-forte") },
        erro: { DEFAULT: cor("erro"), forte: cor("erro-forte") },
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
        jakarta: ["var(--font-heading)"],
      },
      boxShadow: {
        glow: "0 0 30px rgb(var(--c-glow) / 0.4)",
        "glow-sm": "0 0 16px rgb(var(--c-glow) / 0.3)",
        layered: SOMBRA_CAMADAS,
      },
      borderRadius: {
        modal: "1.5em",
      },
      transitionDuration: {
        DEFAULT: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
