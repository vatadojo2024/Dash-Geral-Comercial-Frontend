// Lógica PURA do tema (sem React, sem DOM) — testável isoladamente.
//
// TRÊS fases, cicladas pelo botão nesta ordem:
//   azul  → tema original (fundo azul-marinho, default da paleta)
//   dark  → tema escuro de verdade (fundo quase preto)
//   light → tema claro (fundo BRANCO)
// O default é SEMPRE "azul" (a paleta original).

export const TEMAS = ["azul", "dark", "light"] as const;
export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = "azul";
export const TEMA_STORAGE_KEY = "mdc-theme";

export const TEMA_LABEL: Record<Tema, string> = {
  azul: "Azul",
  dark: "Escuro",
  light: "Claro",
};

// Avança para a próxima fase do ciclo (azul → dark → light → azul …).
export function proximoTema(atual: Tema): Tema {
  const i = TEMAS.indexOf(atual);
  return TEMAS[(i + 1) % TEMAS.length];
}

// Qualquer valor desconhecido cai no default ("azul").
export function temaValido(valor: unknown): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : TEMA_PADRAO;
}
