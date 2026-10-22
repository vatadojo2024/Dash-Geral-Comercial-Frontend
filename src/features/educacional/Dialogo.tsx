"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Diálogo do módulo (mesmo visual do modal "Nova intervenção" da Fase 1):
// fundo escuro, Esc e clique fora fecham, foco no primeiro campo. No celular
// ocupa a largura toda e rola. Vai para o <body> (portal): dentro de um Card com
// vidro (backdrop-filter), `fixed` ficaria preso ao card.
// ---------------------------------------------------------------------------

export const CAMPO =
  "h-9 w-full rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto focus:border-azul/50";

export function Dialogo({
  aberto,
  titulo,
  subtitulo,
  onFechar,
  onEnviar,
  children,
  rodape,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  onFechar: () => void;
  onEnviar?: () => void;
  children: ReactNode;
  rodape: ReactNode;
  largura?: string;
}) {
  const id = useId();
  const caixa = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    const t = setTimeout(() => {
      caixa.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", esc);
      clearTimeout(t);
    };
  }, [aberto, onFechar]);

  if (!aberto || typeof document === "undefined") return null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation(); // no portal, o evento ainda sobe pela árvore do React
    onEnviar?.();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-titulo`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} aria-hidden />
      <form
        ref={caixa}
        onSubmit={enviar}
        noValidate
        className={cn("modal-surface modal-border relative w-full rounded-modal p-6 shadow-layered", largura)}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={`${id}-titulo`} className="font-jakarta text-xl font-semibold tracking-tight text-texto">
              {titulo}
            </h2>
            {subtitulo && <div className="mt-0.5 text-xs text-texto-sec">{subtitulo}</div>}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="icon-button">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">{rodape}</div>
      </form>
    </div>,
    document.body,
  );
}

export function Campo({
  id,
  rotulo,
  obrigatorio = false,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  dica?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-texto-sec">
        {rotulo}
        {obrigatorio && <span className="text-erro"> *</span>}
      </label>
      {children}
      {dica && !erro && <p className="text-xs text-texto-sec">{dica}</p>}
      {erro && (
        <p className="text-xs text-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

export function ErroDoEnvio({ texto }: { texto?: string | null }) {
  if (!texto) return null;
  return (
    <p className="rounded-lg border border-erro-forte/30 bg-erro-forte/10 px-3 py-2 text-sm text-erro" role="alert">
      {texto}
    </p>
  );
}
