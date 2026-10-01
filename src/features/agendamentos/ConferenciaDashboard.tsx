"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

  return (
    // Camada acima da fila: o vidro de cada card cria um contexto de
    // empilhamento, e sem isso o balão "Como funciona" ficaria por baixo dela.
    <Card className="relative z-20">
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
        action={<ComoFunciona />}
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

// Balão "Como funciona": abre ao passar o mouse, ao focar (teclado) ou ao tocar
// (celular); fecha com Esc, clique fora ou tirando o mouse. Texto do Vata (30/09).
function ComoFunciona() {
  const [aberto, setAberto] = useState(false);
  const [fixo, setFixo] = useState(false); // aberto por clique/toque: não fecha ao tirar o mouse
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();
  const visivel = aberto || fixo;

  useEffect(() => {
    if (!visivel) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setFixo(false);
        setAberto(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFixo(false);
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [visivel]);

  return (
    <div
      ref={raiz}
      className="relative"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        aria-expanded={visivel}
        aria-controls={id}
        onClick={() => setFixo((v) => !v)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md text-xs text-texto-sec transition-colors hover:text-texto"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        Como funciona
      </button>
      {visivel && (
        <div
          id={id}
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-4rem))] space-y-2.5 rounded-xl border border-white/15 bg-painel p-4 text-xs leading-relaxed text-texto shadow-2xl"
        >
          <p>
            Compara quantas primeiras calls estão nesta tela com quantas a planilha do comercial registra para o
            mesmo dia.
          </p>
          <p>Quando bate, está tudo certo. Quando não bate, há três causas possíveis:</p>
          <ul className="list-disc space-y-1.5 pl-4 marker:text-texto-sec">
            <li>
              <span className="font-medium">A tela está atrasada</span> — a call existe na Clint e ainda não foi
              lida. Se resolve sozinho em até 15 minutos.
            </li>
            <li>
              <span className="font-medium">A planilha tem uma linha sem par na Clint</span> — alguém lançou na
              planilha e não criou o card, ou lançou no dia errado.
            </li>
            <li>
              <span className="font-medium">A call foi remarcada</span> e um dos dois lados ainda tem a data
              antiga.
            </li>
          </ul>
          <p>
            <span className="font-medium">Como descobrir qual é:</span> compare com a aba Dashboard SDR, que sai da
            mesma planilha mas pelo lado de quem agendou. Se os dois lados da planilha discordarem entre si, o erro é
            de lançamento na planilha. Se concordarem e a diferença for com esta tela, confira os nomes direto na
            Clint.
          </p>
          <p className="text-texto-sec">A contagem usa a data DA CALL, não a data em que foi agendada.</p>
        </div>
      )}
    </div>
  );
}
