"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { GrupoDeProgramas } from "./programas";

// ---------------------------------------------------------------------------
// Filtro por programa (programas, P6): vários ao mesmo tempo (ex.: Blackbelt 6
// e 12 meses), opções agrupadas por mentoria. A caixa da mentoria marca ou
// desmarca o grupo todo. Vale para a lista, o Kanban e a aba Alunos (M2).
// ---------------------------------------------------------------------------

export function resumoDosProgramas(grupos: GrupoDeProgramas[], valor: string[]): string {
  if (!valor.length) return "Todos";
  const todos = grupos.flatMap((g) => g.programas);
  if (valor.length === 1) return todos.find((p) => p.id === valor[0])?.nome ?? "1 programa";
  const inteiro = grupos.find((g) => g.programas.length === valor.length && g.programas.every((p) => valor.includes(p.id)));
  return inteiro ? `${inteiro.mentoria} (todos)` : `${valor.length} programas`;
}

export function FiltroProgramas({
  id,
  grupos,
  valor,
  onChange,
}: {
  id: string;
  grupos: GrupoDeProgramas[];
  valor: string[];
  onChange: (v: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => raiz.current && !raiz.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const alternar = (ids: string[], marcar: boolean) =>
    onChange(marcar ? [...new Set([...valor, ...ids])] : valor.filter((v) => !ids.includes(v)));

  return (
    <div ref={raiz} className="relative flex min-w-0 flex-col gap-1 text-xs text-texto-sec">
      <span id={`${id}-rotulo`}>Programa</span>
      <button
        id={id}
        type="button"
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-labelledby={`${id}-rotulo ${id}`}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-1 rounded-lg border bg-painel-claro px-2 text-left text-sm text-texto",
          valor.length ? "border-azul/50" : "border-borda",
        )}
      >
        <span className="truncate">{resumoDosProgramas(grupos, valor)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
      {aberto && (
        <fieldset className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-white/15 bg-painel p-2 shadow-2xl">
          <legend className="sr-only">Programas</legend>
          {grupos.map((g) => {
            const ids = g.programas.map((p) => p.id);
            const marcados = ids.filter((x) => valor.includes(x)).length;
            return (
              <div key={g.mentoria} className="py-0.5">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-texto hover:bg-white/[0.06]">
                  <input
                    type="checkbox"
                    checked={marcados === ids.length}
                    ref={(el) => {
                      if (el) el.indeterminate = marcados > 0 && marcados < ids.length;
                    }}
                    onChange={(e) => alternar(ids, e.target.checked)}
                    className="accent-azul"
                  />
                  {g.mentoria}
                </label>
                {g.programas.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md py-1 pl-7 pr-2 text-sm text-texto hover:bg-white/[0.06]"
                  >
                    <input type="checkbox" checked={valor.includes(p.id)} onChange={(e) => alternar([p.id], e.target.checked)} className="accent-azul" />
                    {p.nome}
                  </label>
                ))}
              </div>
            );
          })}
          {valor.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md border-t border-white/10 px-2 pt-2 text-left text-xs font-medium text-azul-claro hover:text-texto"
            >
              Limpar programas
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
