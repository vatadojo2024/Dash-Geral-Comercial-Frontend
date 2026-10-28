"use client";

import { MessageSquareText, PencilLine } from "lucide-react";
import { CAMPOS_ROTEIRO, type Checkpoint, type Roteiro } from "@/lib/educacional/contrato";
import { dataCurta } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { BadgeCheckpoint } from "./partes";

// ---------------------------------------------------------------------------
// Roteiro do contato de um checkpoint (programas, P3): objetivo, perguntas-
// chave, sinais de upsell/renovação e estratégia de monetização. Só leitura:
// o roteiro é do checkpoint padrão e se edita em Configurações.
// ---------------------------------------------------------------------------

export const ROTULO_ROTEIRO: Record<keyof Roteiro, string> = {
  objetivo: "Objetivo",
  perguntas_chave: "Perguntas-chave",
  sinais_upsell_renovacao: "Sinais de upsell e renovação",
  estrategia_monetizacao: "Estratégia de monetização",
};

export function RoteiroDoContato({ checkpoint: c, proximo, onEditar }: { checkpoint: Checkpoint; proximo: boolean; onEditar: () => void }) {
  return (
    <section aria-label={`Roteiro do contato: ${c.nome}`} className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-texto-sec">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            Roteiro do contato{proximo && " · próximo checkpoint"}
          </p>
          <h3 className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-texto">
            {c.marco ? `${c.marco} · ${c.nome}` : c.nome}
            <BadgeCheckpoint status={c.status} />
            <span className="text-xs font-normal tabular-nums text-texto-sec">
              {dataCurta(c.data_prevista)}
              {c.data_realizada && ` · feito ${dataCurta(c.data_realizada)}`}
            </span>
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={onEditar} aria-label={`Editar o checkpoint ${c.nome}`}>
          <PencilLine className="h-3.5 w-3.5" aria-hidden />
          Editar checkpoint
        </Button>
      </div>
      {c.roteiro ? (
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          {CAMPOS_ROTEIRO.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs font-medium text-texto-sec">{ROTULO_ROTEIRO[k]}</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-texto">
                {c.roteiro?.[k] || <span className="text-texto-sec">Não definido.</span>}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-texto-sec">
          {c.marco ? "Sem roteiro para este checkpoint." : "Checkpoint avulso: sem roteiro de contato."}
        </p>
      )}
      {c.observacao && (
        <p className="mt-4 border-t border-white/10 pt-3 text-sm">
          <span className="text-texto-sec">Observação: </span>
          <span className="text-texto">{c.observacao}</span>
        </p>
      )}
    </section>
  );
}
