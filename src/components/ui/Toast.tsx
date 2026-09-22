"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Toast enxuto e CONTROLADO: quem chama guarda a mensagem em estado e monta o
// componente. Visual = "Notice Card" do DS (ícone em círculo colorido à
// esquerda, texto à direita, sombra em camadas) + Icon Button para fechar.
// ---------------------------------------------------------------------------

export function Toast({
  mensagem,
  onClose,
  duracaoMs = 5000,
  className,
}: {
  mensagem: string;
  onClose: () => void;
  duracaoMs?: number;
  className?: string;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, duracaoMs);
    return () => clearTimeout(t);
  }, [onClose, duracaoMs, mensagem]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "glass-effect fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-painel/90 p-4 shadow-layered",
        className,
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-erro-forte/20">
        <AlertTriangle className="h-3.5 w-3.5 text-erro" aria-hidden />
      </span>
      <p className="text-sm text-texto">{mensagem}</p>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="icon-button -mr-1 -mt-1">
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
