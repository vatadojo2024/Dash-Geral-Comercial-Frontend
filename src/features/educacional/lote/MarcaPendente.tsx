"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Alteracao } from "./pendencias";

// ---------------------------------------------------------------------------
// Marca de alteração pendente (Fase 3, 4.1): fundo amarelo claro e um ponto;
// passar o mouse mostra o valor anterior; "Desfazer" no menu de contexto
// (botão direito, tecla Menu ou Shift+F10). Erro de validação marca a célula e
// mostra a mensagem embaixo. Sem alteração e sem erro, não muda nada.
// ---------------------------------------------------------------------------

export function MarcaPendente({
  alteracao,
  erro,
  onDesfazer,
  className,
  children,
}: {
  alteracao: Alteracao | undefined;
  erro?: string | null;
  onDesfazer?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  if (!alteracao && !erro) return <>{children}</>;

  const abrir = (x: number, y: number) => onDesfazer && setMenu({ x, y });
  const aoMenu = (e: MouseEvent) => {
    if (!onDesfazer) return;
    e.preventDefault();
    abrir(e.clientX, e.clientY);
  };
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      abrir(r.left + 8, r.bottom);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-md",
        alteracao && "bg-amarelo/[0.12] ring-1 ring-amarelo/35",
        erro && "ring-1 ring-erro/70",
        className,
      )}
      title={alteracao ? `Antes: ${alteracao.antes}${onDesfazer ? " · botão direito: Desfazer" : ""}` : undefined}
      onContextMenu={aoMenu}
      onKeyDown={aoTeclar}
      data-pendente={alteracao ? "" : undefined}
    >
      {alteracao && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amarelo" aria-hidden />}
      {children}
      {alteracao && <span className="sr-only">Alteração não salva. Antes: {alteracao.antes}.</span>}
      {erro && (
        <p className="px-1.5 pb-1 text-[11px] leading-snug text-erro" role="alert">
          {erro}
        </p>
      )}
      {menu && onDesfazer && <MenuDesfazer pos={menu} onDesfazer={onDesfazer} onFechar={() => setMenu(null)} />}
    </div>
  );
}

// Menu de contexto com "Desfazer", no <body> (a tabela rola e o vidro prende o `fixed`).
export function MenuDesfazer({
  pos,
  onDesfazer,
  onFechar,
}: {
  pos: { x: number; y: number };
  onDesfazer: () => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const fora = (e: Event) => !ref.current?.contains(e.target as Node) && onFechar();
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", onFechar, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", onFechar, true);
    };
  }, [onFechar]);
  const LARGURA = 160;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Alteração não salva"
      style={{ top: Math.min(pos.y, window.innerHeight - 56), left: Math.min(pos.x, window.innerWidth - LARGURA - 8), width: LARGURA }}
      className="fixed z-[70] rounded-xl border border-white/15 bg-painel p-1 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onFechar();
          onDesfazer();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-texto hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:outline-none"
      >
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        Desfazer
      </button>
    </div>,
    document.body,
  );
}
