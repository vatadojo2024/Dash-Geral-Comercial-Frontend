"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { proximoTema, TEMA_PADRAO, TEMA_STORAGE_KEY, temaValido, type Tema } from "./tema";

// Preferência de TEMA (azul/escuro/claro). Não é "dado" do negócio — é
// preferência de UI — então é legítimo persistir em localStorage (a regra de
// não usar localStorage vale para dados de leads, não para preferências
// visuais). A lógica pura vive em ./tema (testada); aqui só o estado + DOM.
export { TEMA_STORAGE_KEY, type Tema } from "./tema";

type ThemeContextValue = {
  tema: Tema;
  alternar: () => void;
  definir: (t: Tema) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Escreve a escolha no <html data-theme>: o bloco :root[data-theme="…"] de
// globals.css sobrescreve TODAS as variáveis de cor. Atributo sempre-presente
// (sem classe toggleável) → o tema é exatamente o que data-theme disser.
function aplicar(t: Tema) {
  document.documentElement.dataset.theme = t;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // O script anti-flash (layout.tsx) já gravou data-theme antes da hidratação;
  // lemos dele para o primeiro render do client bater com o DOM.
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof document !== "undefined") {
      return temaValido(document.documentElement.dataset.theme);
    }
    return TEMA_PADRAO;
  });

  const definir = useCallback((t: Tema) => {
    setTema(t);
    aplicar(t);
    try {
      localStorage.setItem(TEMA_STORAGE_KEY, t);
    } catch {
      /* localStorage indisponível — segue só em memória */
    }
  }, []);

  const alternar = useCallback(() => {
    definir(proximoTema(tema));
  }, [tema, definir]);

  // Garante sincronia caso o estado inicial divirja do DOM.
  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  return (
    <ThemeContext.Provider value={{ tema, alternar, definir }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme fora do ThemeProvider");
  return ctx;
}
