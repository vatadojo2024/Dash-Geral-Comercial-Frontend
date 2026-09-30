"use client";

import { cn } from "@/lib/utils/cn";

// Controle segmentado de duas ou mais opções (Ciclo | Intervalo, Lista | Por SDR,
// Fila | Calendário). Padrão do design system: trilho white/5 com borda white/10,
// opção ativa em azul/15 com borda azul/50, inativa a 70% (.nav-link).
export function Alternador<T extends string>({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "nav-link whitespace-nowrap rounded-lg border px-3 py-1 text-xs font-medium transition-all",
            valor === o.valor ? "border-azul/50 bg-azul/15 text-texto" : "border-transparent text-texto",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
