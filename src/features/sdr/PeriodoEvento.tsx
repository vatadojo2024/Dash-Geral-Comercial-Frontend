"use client";

import { useEffect, useMemo, useState } from "react";
import { rotuloCicloEvento, ultimosCiclos, type Ciclo } from "@/lib/sdr/ciclo";
import { MAX_DIAS_INTERVALO, validarIntervalo, type ErroIntervalo } from "@/lib/sdr/oportunidades";
import { cn } from "@/lib/utils/cn";
import { Alternador } from "./EventosComuns";
import { CicloSelect } from "./CicloSelect";

// ---------------------------------------------------------------------------
// Período das abas de evento (Oportunidades, Retenção): Ciclo (terça → segunda)
// ou Intervalo livre (≤ 90 dias). UM estado para todas: trocar de aba ou de
// recorte remonta a página, então a escolha fica em `memoriaPeriodo` (módulo)
// e sobrevive à navegação — some no reload, de propósito.
// ---------------------------------------------------------------------------

export type ModoPeriodo = "ciclo" | "intervalo";

const memoriaPeriodo: {
  periodo: { modo: ModoPeriodo; inicioSel: string; de: string; ate: string } | null;
} = { periodo: null };

export type PeriodoEvento = {
  modo: ModoPeriodo;
  setModo: (m: ModoPeriodo) => void;
  ciclos: Ciclo[];
  inicioSel: string;
  setInicioSel: (inicio: string) => void;
  de: string;
  setDe: (v: string) => void;
  ate: string;
  setAte: (v: string) => void;
  // Validação do modo intervalo (null = ok). No modo ciclo é sempre null.
  erroIntervalo: ErroIntervalo;
  // O que vai para o backend.
  periodo: { de: string; ate: string };
};

export function usePeriodoEvento(): PeriodoEvento {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ciclos = useMemo(() => ultimosCiclos(hojeISO, 12), [hojeISO]);
  const cicloAtual = ciclos[0];

  const salvo = memoriaPeriodo.periodo;
  const [modo, setModo] = useState<ModoPeriodo>(salvo?.modo ?? "ciclo");
  const [inicioSel, setInicioSel] = useState(
    salvo && ciclos.some((c) => c.inicio === salvo.inicioSel) ? salvo.inicioSel : cicloAtual.inicio,
  );
  // Intervalo padrão: os 4 últimos ciclos (consolidar semanas é o uso do modo).
  const [de, setDe] = useState(salvo?.de ?? ciclos[3]?.inicio ?? cicloAtual.inicio);
  const [ate, setAte] = useState(salvo?.ate ?? cicloAtual.fim);
  useEffect(() => {
    memoriaPeriodo.periodo = { modo, inicioSel, de, ate };
  }, [modo, inicioSel, de, ate]);

  const cicloSel = ciclos.find((c) => c.inicio === inicioSel) ?? cicloAtual;
  const erroIntervalo = modo === "intervalo" ? validarIntervalo(de, ate) : null;
  const periodo = modo === "ciclo" ? { de: cicloSel.inicio, ate: cicloSel.fim } : { de, ate };

  return { modo, setModo, ciclos, inicioSel, setInicioSel, de, setDe, ate, setAte, erroIntervalo, periodo };
}

const CLASSE_INPUT = "h-9 rounded-xl border bg-white/5 px-2 text-sm text-texto";

// Controles do período: Ciclo | Intervalo + seletor de ciclo ou par de datas.
// `campoInvalido` destaca as datas (validação local ou 400 do backend).
export function SeletorPeriodo({
  id,
  periodo: p,
  campoInvalido,
}: {
  id: string;
  periodo: PeriodoEvento;
  campoInvalido: "de" | "ate" | "ambos" | null;
}) {
  const invalidoDe = campoInvalido === "de" || campoInvalido === "ambos";
  const invalidoAte = campoInvalido === "ate" || campoInvalido === "ambos";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Alternador<ModoPeriodo>
        rotulo="Modo do período"
        valor={p.modo}
        onChange={p.setModo}
        opcoes={[
          { valor: "ciclo", label: "Ciclo" },
          { valor: "intervalo", label: "Intervalo" },
        ]}
      />

      {p.modo === "ciclo" ? (
        <CicloSelect
          id={id}
          ciclos={p.ciclos}
          value={p.inicioSel}
          onChange={p.setInicioSel}
          rotulo={rotuloCicloEvento}
          label={null}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Data inicial"
              aria-invalid={invalidoDe}
              value={p.de}
              max={p.ate || undefined}
              onChange={(e) => p.setDe(e.target.value)}
              className={cn(CLASSE_INPUT, invalidoDe ? "border-erro ring-1 ring-erro/40" : "border-white/20")}
            />
            <span className="text-xs text-texto-sec">até</span>
            <input
              type="date"
              aria-label="Data final"
              aria-invalid={invalidoAte}
              value={p.ate}
              min={p.de || undefined}
              onChange={(e) => p.setAte(e.target.value)}
              className={cn(CLASSE_INPUT, invalidoAte ? "border-erro ring-1 ring-erro/40" : "border-white/20")}
            />
          </div>
          <p className={cn("text-[11px]", p.erroIntervalo ? "text-rosa" : "text-texto-sec")} role="status">
            {p.erroIntervalo?.mensagem ?? `Máximo de ${MAX_DIAS_INTERVALO} dias.`}
          </p>
        </div>
      )}
    </div>
  );
}
