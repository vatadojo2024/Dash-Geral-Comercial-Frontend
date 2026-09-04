"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Toast enxuto e CONTROLADO: quem chama guarda a mensagem em estado e monta o
// componente. Sem provider/fila global — o app ainda tem um único ponto de uso
// (erro ao alternar o destaque) e um contexto global seria infra a mais.
// Visual 100% em tokens da paleta (painel/borda/rosa), como o ErrorState.
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
        "fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border border-rosa/40 bg-painel px-3.5 py-3 shadow-lg",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rosa" aria-hidden />
      <p className="text-sm text-texto">{mensagem}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="-mr-1 rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
