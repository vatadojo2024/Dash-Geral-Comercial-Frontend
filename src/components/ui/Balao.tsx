"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Balão de explicação (texto longo demais para o `title` nativo). Abre ao
// passar o mouse, ao focar pelo teclado ou ao tocar (celular); fecha com Esc,
// clique fora ou tirando o mouse. O pai que tiver vizinhos com vidro
// (backdrop-filter) precisa de `relative z-20`, senão o balão fica por baixo.
// A posição é medida ao abrir: o balão nunca sai da tela, nem no celular.
// ---------------------------------------------------------------------------

export function Balao({
  rotulo,
  gatilho,
  children,
  lado = "direita",
  className,
}: {
  // Nome acessível do botão (o gatilho costuma ser só um ícone).
  rotulo: string;
  gatilho: ReactNode;
  children: ReactNode;
  // Para que lado o balão cresce a partir do gatilho.
  lado?: "direita" | "esquerda";
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [fixo, setFixo] = useState(false); // aberto por clique/toque
  const raiz = useRef<HTMLSpanElement>(null);
  const id = useId();
  const visivel = aberto || fixo;
  const [caixa, setCaixa] = useState<{ left: number; width: number } | null>(null);

  // Encaixa na tela: parte do lado pedido e desliza até caber (margem de 16px).
  useLayoutEffect(() => {
    if (!visivel || !raiz.current) return;
    const r = raiz.current.getBoundingClientRect();
    const largura = Math.min(352, window.innerWidth - 32);
    const desejado = lado === "direita" ? r.left : r.right - largura;
    const left = Math.max(16, Math.min(desejado, window.innerWidth - largura - 16));
    setCaixa({ left: left - r.left, width: largura });
  }, [visivel, lado]);

  useEffect(() => {
    if (!visivel) return;
    const fechar = () => {
      setFixo(false);
      setAberto(false);
    };
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) fechar();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [visivel]);

  return (
    <span
      ref={raiz}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        aria-label={rotulo}
        aria-expanded={visivel}
        aria-controls={id}
        onClick={() => setFixo((v) => !v)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        className="inline-flex items-center rounded-md text-texto-sec transition-colors hover:text-texto"
      >
        {gatilho}
      </button>
      {visivel && (
        <span
          id={id}
          role="tooltip"
          style={caixa ? { left: caixa.left, width: caixa.width } : undefined}
          className={cn(
            "absolute top-full z-30 mt-2 block rounded-xl border border-white/15 bg-painel p-4 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-texto shadow-2xl",
            !caixa && "invisible",
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
