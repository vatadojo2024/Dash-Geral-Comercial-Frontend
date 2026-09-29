"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

// Icon Button do design system que copia um valor (telefone, e-mail, link) e
// confirma com um check por 1,5 s. O rótulo entra no aria-label e no title.
export function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1500);
    return () => clearTimeout(t);
  }, [copiado]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(valor).then(() => setCopiado(true)).catch(() => {});
      }}
      aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
      title={copiado ? "Copiado!" : `Copiar ${rotulo}`}
      className="icon-button h-7 w-7"
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-verde" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
