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
  // HIDRATAÇÃO: o primeiro render do CLIENT precisa bater com o SERVIDOR, que
  // renderiza sempre com TEMA_PADRAO. Por isso NÃO lemos o DOM/localStorage no
  // inicializador — senão componentes que dependem do tema (ex.: ThemeToggle,
  // ícone+label+dots) renderizariam "azul" no servidor e "dark/light" no
  // cliente → React #418 (mismatch de texto/atributo). As CORES não dependem
  // disso: o script anti-flash já gravou data-theme no <html> antes da pintura.
  const [tema, setTema] = useState<Tema>(TEMA_PADRAO);

  // Pós-montagem (depois da hidratação): alinha o estado do React ao tema que o
  // anti-flash já aplicou (data-theme, vindo do localStorage). É uma atualização
  // normal de estado — não uma divergência de hidratação. Sem flash de cor (o
  // <html> já estava no tema certo); no máximo o rótulo do botão acerta em 1
  // frame.
  useEffect(() => {
    setTema(temaValido(document.documentElement.dataset.theme));
  }, []);

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
    setTema((atual) => {
      const prox = proximoTema(atual);
      aplicar(prox);
      try {
        localStorage.setItem(TEMA_STORAGE_KEY, prox);
      } catch {
        /* localStorage indisponível — segue só em memória */
      }
      return prox;
    });
  }, []);

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
