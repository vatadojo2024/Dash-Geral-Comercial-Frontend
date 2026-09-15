"use client";

import { rotuloCiclo, type Ciclo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Seletor de ciclo de evento (terça → segunda) — COMPARTILHADO pelas abas
// "Calls por Ciclo" e "Levantou a Mão". Recebe a lista de ciclos (o primeiro é
// o atual) e o `inicio` selecionado; o rótulo de cada opção é injetável
// ("21/07 a 27/07" por padrão; a aba de eventos usa "WG - 21.07.26 (…)").
// ---------------------------------------------------------------------------

export function CicloSelect({
  id,
  ciclos,
  value,
  onChange,
  rotulo = rotuloCiclo,
  label = "Ciclo do evento:",
  className,
}: {
  id: string;
  ciclos: Ciclo[];
  value: string;
  onChange: (inicio: string) => void;
  rotulo?: (ciclo: Ciclo) => string;
  label?: string | null;
  className?: string;
}) {
  return (
    <div className={className ?? "flex items-center gap-2"}>
      {label && (
        <label htmlFor={id} className="text-xs text-texto-sec">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-full rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto"
      >
        {ciclos.map((c, i) => (
          <option key={c.inicio} value={c.inicio}>
            {rotulo(c)}
            {i === 0 ? " (atual)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
