"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Inbox, X } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAgendamentos } from "@/lib/data/dataClient";
import { rgb, useThemeColors, type CorToken } from "@/features/theme/useThemeColors";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { rotuloCiclo, ultimosCiclos, type Ciclo } from "@/lib/sdr/ciclo";
import {
  agregarAgendamentos,
  COLUNAS_PRODUTO,
  SEM_PRODUTO,
  type Agregado,
} from "@/lib/sdr/agendamentos";

// Cor de cada produto (ticket crescente) para a barra empilhada e a legenda.
const COR_PRODUTO: Record<string, CorToken> = {
  qc: "cinza",
  ninja: "azul-claro",
  black: "violeta",
  prime: "teal",
  private: "verde",
  [SEM_PRODUTO]: "borda",
};

function Numero({ valor }: { valor: number }) {
  return (
    <span className={cn("tabular-nums", valor === 0 && "text-texto-sec/30")}>{valor}</span>
  );
}

export function AgendamentosPanel() {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ciclos = useMemo(() => ultimosCiclos(hojeISO, 12), [hojeISO]);
  const cicloAtual = ciclos[0];
  const [inicioSel, setInicioSel] = useState(cicloAtual.inicio);
  const cicloSel: Ciclo = ciclos.find((c) => c.inicio === inicioSel) ?? cicloAtual;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["agendamentos", cicloSel.inicio, cicloSel.fim],
    queryFn: () => fetchAgendamentos(cicloSel.inicio, cicloSel.fim),
  });

  const ag = useMemo<Agregado | null>(
    () => (data ? agregarAgendamentos(data) : null),
    [data],
  );

  const [celula, setCelula] = useState<{ sdr: string; closer: string } | null>(null);

  return (
    <div className="space-y-4">
      {/* Cabeçalho: título honesto + dropdown de ciclo (12 ciclos) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-texto">
            <CalendarClock className="h-4 w-4 text-azul-claro" aria-hidden />
            Calls agendadas para o ciclo
          </h2>
          <p className="mt-0.5 text-xs text-texto-sec">
            Contabilizado pela data de agendamento (evento no Clint), ciclo do evento — terça
            a segunda. Métrica de time: mostra todos os SDRs e closers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ciclo-sdr" className="text-xs text-texto-sec">
            Ciclo do evento:
          </label>
          <select
            id="ciclo-sdr"
            value={inicioSel}
            onChange={(e) => {
              setInicioSel(e.target.value);
              setCelula(null);
            }}
            className="h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto"
          >
            {ciclos.map((c, i) => (
              <option key={c.inicio} value={c.inicio}>
                {rotuloCiclo(c)}
                {i === 0 ? " (atual)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : isError || !ag ? (
        <Card>
          <ErrorState
            titulo="Não foi possível carregar os agendamentos"
            descricao={error instanceof Error ? error.message : "Tente novamente."}
            onRetry={() => refetch()}
          />
        </Card>
      ) : ag.total === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            titulo="Nenhum agendamento neste ciclo"
            descricao={`Nenhuma call agendada entre ${rotuloCiclo(cicloSel)}.`}
          />
        </Card>
      ) : (
        <>
          <MatrizCloser ag={ag} onCelula={setCelula} celula={celula} />
          {celula && (
            <DrillDown
              ag={ag}
              sdr={celula.sdr}
              closer={celula.closer}
              onClose={() => setCelula(null)}
            />
          )}
          <MatrizProduto ag={ag} />
          <ResumoPorCloser ag={ag} />
        </>
      )}
    </div>
  );
}

// --- Bloco 1: Matriz SDR × Closer -------------------------------------------

function MatrizCloser({
  ag,
  onCelula,
  celula,
}: {
  ag: Agregado;
  onCelula: (c: { sdr: string; closer: string }) => void;
  celula: { sdr: string; closer: string } | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Calls por SDR × Closer"
        subtitle="Quantas calls cada SDR marcou para cada closer. Clique numa célula para ver os leads."
      />
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda text-xs text-texto-sec">
              <th className="sticky left-0 z-10 bg-painel px-4 py-2 text-left font-medium">SDR</th>
              {ag.closers.map((c) => (
                <th key={c} className="px-3 py-2 text-right font-medium">{c}</th>
              ))}
              <th className="px-4 py-2 text-right font-semibold text-texto">Total</th>
            </tr>
          </thead>
          <tbody>
            {ag.sdrs.map((sdr) => (
              <tr key={sdr} className="border-b border-borda/40">
                <td className="sticky left-0 z-10 bg-painel px-4 py-2 font-medium text-texto">{sdr}</td>
                {ag.closers.map((closer) => {
                  const v = ag.matrizCloser[sdr]?.[closer] ?? 0;
                  const ativa = celula?.sdr === sdr && celula?.closer === closer;
                  return (
                    <td key={closer} className="px-1 py-1 text-right">
                      <button
                        type="button"
                        disabled={v === 0}
                        onClick={() => onCelula({ sdr, closer })}
                        className={cn(
                          "w-full rounded-md px-2 py-1 text-right transition-colors",
                          v > 0 && "hover:bg-azul/15",
                          ativa && "bg-azul/20 ring-1 ring-azul/40",
                          v === 0 && "cursor-default",
                        )}
                      >
                        <Numero valor={v} />
                      </button>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-semibold text-texto">
                  <Numero valor={ag.totalPorSdr[sdr] ?? 0} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-borda bg-painel-claro/40 text-texto">
              <td className="sticky left-0 z-10 bg-painel-claro/40 px-4 py-2 font-semibold">Total</td>
              {ag.closers.map((c) => (
                <td key={c} className="px-3 py-2 text-right font-semibold">
                  <Numero valor={ag.totalPorCloser[c] ?? 0} />
                </td>
              ))}
              <td className="px-4 py-2 text-right font-bold">
                <Numero valor={ag.total} />
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// --- Painel lateral: leads de um cruzamento SDR × Closer --------------------

function DrillDown({
  ag,
  sdr,
  closer,
  onClose,
}: {
  ag: Agregado;
  sdr: string;
  closer: string;
  onClose: () => void;
}) {
  const itens = ag.itens.filter((l) => l.sdr === sdr && l.closer === closer);
  return (
    <Card className="border-azul/40">
      <CardHeader
        title={`${sdr} → ${closer}`}
        subtitle={`${itens.length} ${itens.length === 1 ? "lead agendado" : "leads agendados"} neste ciclo`}
        action={
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        }
      />
      <CardContent className="space-y-1">
        {itens.map((l) => (
          <Link
            key={l.leadId}
            href={`/leads/${encodeURIComponent(l.leadId)}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-borda/40 px-3 py-2 text-sm transition-colors hover:border-azul/40 hover:bg-azul/5"
          >
            <span className="truncate font-medium text-texto">{l.nome}</span>
            <span className="shrink-0 rounded-full border border-borda bg-painel-claro px-2 py-0.5 text-xs text-texto-sec">
              {l.produtoLabel}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Bloco 2: Matriz SDR × Produto ------------------------------------------

function MatrizProduto({ ag }: { ag: Agregado }) {
  return (
    <Card>
      <CardHeader
        title="Calls por SDR × Produto sugerido"
        subtitle="Distribuição por produto (do menor para o maior ticket)."
      />
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda text-xs text-texto-sec">
              <th className="sticky left-0 z-10 bg-painel px-4 py-2 text-left font-medium">SDR</th>
              {COLUNAS_PRODUTO.map((p) => (
                <th key={p.chave} className="px-3 py-2 text-right font-medium">{p.label}</th>
              ))}
              <th className="px-4 py-2 text-right font-semibold text-texto">Total</th>
            </tr>
          </thead>
          <tbody>
            {ag.sdrs.map((sdr) => (
              <tr key={sdr} className="border-b border-borda/40">
                <td className="sticky left-0 z-10 bg-painel px-4 py-2 font-medium text-texto">{sdr}</td>
                {COLUNAS_PRODUTO.map((p) => (
                  <td key={p.chave} className="px-3 py-2 text-right">
                    <Numero valor={ag.matrizProduto[sdr]?.[p.chave] ?? 0} />
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-semibold text-texto">
                  <Numero valor={ag.totalProdutoPorSdr[sdr] ?? 0} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-borda bg-painel-claro/40 text-texto">
              <td className="sticky left-0 z-10 bg-painel-claro/40 px-4 py-2 font-semibold">Total</td>
              {COLUNAS_PRODUTO.map((p) => (
                <td key={p.chave} className="px-3 py-2 text-right font-semibold">
                  <Numero valor={ag.totalPorProduto[p.chave] ?? 0} />
                </td>
              ))}
              <td className="px-4 py-2 text-right font-bold">
                <Numero valor={ag.total} />
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// --- Bloco 3: Resumo por closer (barra empilhada por produto) ---------------

function ResumoPorCloser({ ag }: { ag: Agregado }) {
  const cores = useThemeColors();
  return (
    <Card>
      <CardHeader
        title="Resumo por closer"
        subtitle="Total recebido no ciclo e a quebra por produto — quem está recebendo lead bom."
      />
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ag.resumoPorCloser.map((c) => {
          const linha: Record<string, number | string> = { closer: c.closer };
          for (const p of COLUNAS_PRODUTO) linha[p.label] = c.porProduto[p.chave] ?? 0;
          return (
            <div key={c.closer} className="rounded-xl border border-borda bg-painel-claro/40 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-texto">{c.closer}</p>
                <p className="text-lg font-bold tabular-nums text-texto">{c.total}</p>
              </div>
              <ResponsiveContainer width="100%" height={40}>
                <BarChart layout="vertical" data={[linha]} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="closer" hide />
                  <Tooltip
                    cursor={{ fill: rgb(cores.borda, 0.2) }}
                    contentStyle={{
                      background: rgb(cores.noite),
                      border: `1px solid ${rgb(cores.borda)}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ display: "none" }}
                  />
                  {COLUNAS_PRODUTO.map((p, i) => (
                    <Bar
                      key={p.chave}
                      dataKey={p.label}
                      stackId="s"
                      fill={rgb(cores[COR_PRODUTO[p.chave]])}
                      radius={
                        i === 0
                          ? [4, 0, 0, 4]
                          : i === COLUNAS_PRODUTO.length - 1
                            ? [0, 4, 4, 0]
                            : 0
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-sec">
                {COLUNAS_PRODUTO.filter((p) => (c.porProduto[p.chave] ?? 0) > 0).map((p) => (
                  <span key={p.chave} className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: rgb(cores[COR_PRODUTO[p.chave]]) }}
                    />
                    {p.label} {c.porProduto[p.chave]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
