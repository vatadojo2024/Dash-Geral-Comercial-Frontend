"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Info } from "lucide-react";
import {
  ConferenciaResponseSchema,
  conferirPorDia,
  rotuloDaDiferenca,
  type ConferenciaResponse,
} from "@/lib/agendamentos/conferencia";
import { diaMes, rotuloDoDia, somarDias, type AgendamentoPrimeiraCall } from "@/lib/agendamentos/primeiraCall";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Card "Conferência com o Dashboard SDR" (topo da fila): por dia, quantas
// calls a lista tem × o total do Dashboard SDR (mesma API da aba Produtividade
// SDR → Dashboard SDR). A lista é do Mapa de Calor, com os detalhes de cada
// call; o Dashboard só tem o total. Falha da conferência NÃO derruba a fila.
// ---------------------------------------------------------------------------

const DIAS_A_FRENTE = 14;

async function buscarConferencia(de: string, ate: string): Promise<ConferenciaResponse> {
  const res = await fetch(`/api/agendamentos/conferencia?de=${de}&ate=${ate}`);
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error((corpo as { error?: string } | null)?.error ?? `A conferência respondeu ${res.status}.`);
  return ConferenciaResponseSchema.parse(corpo);
}

// Janela: de hoje até o último dia com call na lista (mínimo 14 dias).
export function janelaDaConferencia(lista: readonly Pick<AgendamentoPrimeiraCall, "dia">[], hoje: string) {
  const ultimo = lista.reduce((m, a) => (a.dia > m ? a.dia : m), somarDias(hoje, DIAS_A_FRENTE - 1));
  return { de: hoje, ate: ultimo };
}

export function useConferencia(
  lista: readonly Pick<AgendamentoPrimeiraCall, "dia" | "closer_nome">[],
  hoje: string,
  closer: string | null,
  habilitada: boolean,
) {
  const janela = janelaDaConferencia(lista, hoje);
  const consulta = useQuery({
    queryKey: ["agendamentos-conferencia", janela.de, janela.ate],
    queryFn: () => buscarConferencia(janela.de, janela.ate),
    enabled: habilitada,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const dias = useMemo(
    () =>
      consulta.data
        ? conferirPorDia(
            lista.filter((a) => a.dia >= janela.de && a.dia <= janela.ate),
            consulta.data.linhas,
            closer,
          )
        : [],
    [consulta.data, lista, janela.de, janela.ate, closer],
  );
  return { ...consulta, dias };
}

export function ConferenciaDashboard({
  dias,
  carregando,
  erro,
  hoje,
  fonte,
}: {
  dias: ReturnType<typeof conferirPorDia>;
  carregando: boolean;
  erro: string | null;
  hoje: string;
  fonte: ConferenciaResponse["fonte"] | null;
}) {
  const divergentes = dias.filter((d) => d.diferenca !== 0);
  const explicacao =
    "Clint = as primeiras calls que chegaram da Clint (pelo n8n) e estão na lista abaixo, com lead, horário, link e urgência. " +
    "Planilha = o total de agendamentos por dia e por closer da planilha do Dashboard SDR (mesma fonte da aba Produtividade SDR), contado pela data da call. " +
    "Diferença = um lado tem calls que o outro não tem; a planilha pode incluir calls que não são de primeira call.";

  return (
    <Card>
      <CardHeader
        title="Conferência Clint × Planilha"
        subtitle={
          carregando
            ? "Buscando os totais da planilha…"
            : erro
              ? "Não foi possível buscar os totais da planilha agora. A lista abaixo segue normal."
              : divergentes.length === 0
                ? "Os totais por dia da Clint e da planilha batem."
                : `${divergentes.length} ${divergentes.length === 1 ? "dia com diferença" : "dias com diferença"} entre a Clint e a planilha.`
        }
        action={
          <span
            className="inline-flex cursor-help items-center gap-1 text-xs text-texto-sec"
            title={explicacao}
            tabIndex={0}
            aria-label={`Como funciona: ${explicacao}`}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
            Como funciona
          </span>
        }
      />
      {carregando ? (
        <div className="px-6 pb-6">
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : erro || dias.length === 0 ? null : (
        <div className="px-6 pb-6">
          <div className="flex flex-wrap gap-2" role="list" aria-label="Conferência por dia">
            {dias.map((d) => {
              const ok = d.diferenca === 0;
              return (
                <div
                  key={d.dia}
                  role="listitem"
                  className={cn(
                    "min-w-[9.5rem] rounded-xl border px-3 py-2",
                    ok ? "border-white/10 bg-white/5" : "border-aviso-forte/40 bg-aviso-forte/10",
                  )}
                >
                  <p className="text-xs font-medium text-texto">
                    {rotuloDoDia(d.dia, hoje)}
                    {!rotuloDoDia(d.dia, hoje).includes("/") && (
                      <span className="font-normal text-texto-sec"> · {diaMes(d.dia)}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-texto-sec">
                    Clint <span className="font-semibold text-texto">{d.lista}</span> · Planilha{" "}
                    <span className="font-semibold text-texto">{d.dashboard}</span>
                  </p>
                  {d.dia === hoje && (
                    <p className="text-[10px] text-texto-sec/80">dia inteiro, com as que já passaram</p>
                  )}
                  <p className={cn("mt-1 inline-flex items-center gap-1 text-[11px]", ok ? "text-sucesso" : "text-aviso")}>
                    {ok ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
                    {rotuloDaDiferenca(d)}
                  </p>
                </div>
              );
            })}
          </div>
          {fonte === "mock" && (
            <p className="mt-2 text-[11px] text-texto-sec/80">Totais de demonstração (modo de teste local).</p>
          )}
        </div>
      )}
    </Card>
  );
}
