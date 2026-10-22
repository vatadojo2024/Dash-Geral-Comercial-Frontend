"use client";

import Link from "next/link";
import type { AlunoLinha, Etapa } from "@/lib/educacional/contrato";
import { BadgeCheckpoint, Faixa } from "./partes";

// Kanban: uma coluna por etapa ativa, na ordem da configuração, com todos os alunos.
export function Kanban({
  itens,
  etapas,
  hrefDoAluno,
}: {
  itens: AlunoLinha[];
  etapas: Etapa[];
  hrefDoAluno: (a: AlunoLinha) => string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-[1040px] grid-cols-5 gap-3">
        {etapas.map((etapa) => {
          const daEtapa = itens.filter((a) => a.etapa.id === etapa.id);
          return (
            <section
              key={etapa.id}
              aria-label={etapa.nome}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"
            >
              <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
                <h3 className="text-xs font-semibold text-texto">{etapa.nome}</h3>
                <span className="text-xs tabular-nums text-texto-sec">{daEtapa.length}</span>
              </header>
              {daEtapa.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11px] text-texto-sec/70">Nenhum aluno</p>
              ) : (
                daEtapa.map((a) => (
                  <Link key={a.id} href={hrefDoAluno(a)} className="card-interactive block rounded-lg p-3">
                    <span className="block truncate text-sm font-semibold text-texto">{a.nome}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Faixa faixa={a.faixa_saude.valor} className="text-xs" />
                      {a.proximo_checkpoint && <BadgeCheckpoint status={a.proximo_checkpoint.status} />}
                    </span>
                    <span className="mt-1.5 block text-xs text-texto-sec">
                      <span className="font-semibold tabular-nums text-texto">{a.dias_na_etapa.valor ?? "—"}d</span> na etapa
                    </span>
                  </Link>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
