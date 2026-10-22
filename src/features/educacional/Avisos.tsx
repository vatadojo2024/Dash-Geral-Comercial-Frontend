"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CircleCheck, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Avisos do módulo Educacional (spec Fase 2, seção 7.1): "Salvo" discreto no
// sucesso, aviso de erro com o motivo e, no erro de rede, "Tentar de novo".
// Mesmo visual do Notice Card do Toast do design system, mas em pilha e com
// ação — por isso fica dentro do módulo, sem mexer no componente compartilhado.
// ---------------------------------------------------------------------------

export type Aviso = {
  tipo: "sucesso" | "erro";
  texto: string;
  acao?: { rotulo: string; onClick: () => void };
};
type AvisoNaTela = Aviso & { id: number };

const DURACAO = { sucesso: 2000, erro: 8000 } as const;
const MAXIMO = 3;

const Contexto = createContext<((a: Aviso) => void) | null>(null);

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoNaTela[]>([]);
  const proximo = useRef(1);

  const fechar = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback((a: Aviso) => {
    const id = proximo.current++;
    // Um "Salvo" novo substitui o anterior; erros se acumulam (até 3).
    setAvisos((l) => [...l.filter((x) => !(a.tipo === "sucesso" && x.tipo === "sucesso")), { ...a, id }].slice(-MAXIMO));
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-4"
        aria-live="polite"
      >
        {avisos.map((a) => (
          <CartaoAviso key={a.id} aviso={a} onFechar={() => fechar(a.id)} />
        ))}
      </div>
    </Contexto.Provider>
  );
}

function CartaoAviso({ aviso, onFechar }: { aviso: AvisoNaTela; onFechar: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFechar, aviso.acao ? DURACAO.erro * 2 : DURACAO[aviso.tipo]);
    return () => clearTimeout(t);
  }, [aviso, onFechar]);

  if (aviso.tipo === "sucesso") {
    return (
      <p
        role="status"
        className="glass-effect pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-painel/90 px-3.5 py-1.5 text-sm text-texto shadow-layered"
      >
        <CircleCheck className="h-3.5 w-3.5 text-sucesso" aria-hidden />
        {aviso.texto}
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="glass-effect pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-painel/90 p-4 shadow-layered"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-erro-forte/20">
        <AlertTriangle className="h-3.5 w-3.5 text-erro" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-texto">{aviso.texto}</p>
        {aviso.acao && (
          <button
            type="button"
            onClick={() => {
              onFechar();
              aviso.acao?.onClick();
            }}
            className={cn("mt-2 rounded-md text-sm font-semibold text-azul-claro hover:underline")}
          >
            {aviso.acao.rotulo}
          </button>
        )}
      </div>
      <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="icon-button -mr-1 -mt-1">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function useAvisos() {
  const avisar = useContext(Contexto);
  // Fora do provedor (teste de componente isolado): não quebra, só não mostra.
  return useMemo(() => avisar ?? (() => {}), [avisar]);
}
