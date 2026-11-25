"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarX2, RefreshCw } from "lucide-react";
import { ComparativoError, fetchComparativo } from "@/lib/data/dataClient";
import { VALIDADE } from "@/lib/data/validade";
import { EVENTOS_VISIVEIS, eventoPadrao, type Comparativo } from "@/lib/eventos/comparativo";
import { dataHora } from "@/lib/formatters/date";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, SemAcessoState } from "@/components/ui/States";
import { CardsDoEvento } from "./CardsDoEvento";
import { RetencaoEventos } from "./RetencaoEventos";
import { TabelaComparativa } from "./TabelaComparativa";
import { TendenciaChart } from "./TendenciaChart";
import { TiersDoEvento } from "./TiersDoEvento";

// ---------------------------------------------------------------------------
// Aba "Eventos ao Vivo" (só admin): os webinars WG comparados evento a evento.
// Período opcional (sem datas = a série inteira). Tabela, gráfico e MÉDIA usam
// os eventos na tela: os 12 mais recentes, ou todos em "ver todos". O "evento
// anterior" sai da série inteira buscada.
// Em mock, `?simular=` na URL exercita os estados (ver o route handler).
// ---------------------------------------------------------------------------

export function EventosAoVivoView() {
  const simular = useSearchParams().get("simular");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const invertido = Boolean(de && ate && de > ate);

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["eventos-comparativo", de || null, ate || null, simular],
    queryFn: () => fetchComparativo(de || null, ate || null, simular),
    staleTime: VALIDADE.eventos,
    enabled: !invertido,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <CampoData id="eventos-de" rotulo="De" valor={de} onChange={setDe} invalido={invertido} />
        <CampoData id="eventos-ate" rotulo="Até" valor={ate} onChange={setAte} invalido={invertido} />
        {(de || ate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDe("");
              setAte("");
            }}
          >
            Todo o histórico
          </Button>
        )}
        {invertido && (
          <p className="text-xs text-erro" role="alert">
            A data inicial não pode ser depois da final.
          </p>
        )}
        {data && (
          <div className="ml-auto flex items-center gap-3 text-xs opacity-80">
            {data.gerado_em && <span>Gerado em {dataHora(data.gerado_em)}</span>}
            <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Atualizar
            </Button>
          </div>
        )}
      </div>

      {invertido ? null : isLoading ? (
        <Carregando />
      ) : error || !data ? (
        <ErroComparativo error={error} onRetry={() => refetch()} />
      ) : data.eventos.length === 0 ? (
        <>
          <AvisoDescartados n={data.descartados} />
          <Card>
            <EmptyState
              icon={CalendarX2}
              titulo="Nenhum evento no período"
              descricao={
                de || ate
                  ? "Nenhum webinar WG foi capturado entre essas datas. Amplie o período ou volte para todo o histórico."
                  : "Ainda não há webinar WG capturado."
              }
            />
          </Card>
        </>
      ) : (
        <Conteudo data={data} />
      )}
    </div>
  );
}

function Conteudo({ data }: { data: Comparativo }) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const todos = data.eventos;
  // Seleção que saiu do período (troca de filtro) volta para o padrão.
  const evento = useMemo(
    () => todos.find((e) => e.data_evento === escolhido) ?? eventoPadrao(todos),
    [todos, escolhido],
  );
  const visiveis = verTodos ? todos : todos.slice(0, EVENTOS_VISIVEIS);
  if (!evento) return null;

  return (
    <>
      <AvisoDescartados n={data.descartados} />
      <CardsDoEvento eventos={todos} visiveis={visiveis} evento={evento} />
      <TendenciaChart eventos={visiveis} modoReferencia={evento.modo_presenca} />
      <TabelaComparativa
        eventos={visiveis}
        modoReferencia={evento.modo_presenca}
        selecionado={evento.data_evento}
        onSelecionar={setEscolhido}
        total={todos.length}
        verTodos={verTodos}
        onVerTodos={setVerTodos}
      />
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <RetencaoEventos eventos={todos} />
        </div>
        <TiersDoEvento evento={evento} />
      </div>
    </>
  );
}

function CampoData({
  id,
  rotulo,
  valor,
  onChange,
  invalido,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  invalido: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs">
      <span className="opacity-70">{rotulo}</span>
      <input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalido || undefined}
        className={
          invalido
            ? "rounded-lg border border-erro/60 bg-noite px-2 py-1.5 text-sm text-texto [color-scheme:dark]"
            : "rounded-lg border border-white/10 bg-noite px-2 py-1.5 text-sm text-texto [color-scheme:dark]"
        }
      />
    </label>
  );
}

function AvisoDescartados({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <p className="flex items-center gap-2 rounded-xl border border-aviso/40 bg-aviso/10 px-3 py-2 text-xs text-texto" role="status">
      <AlertTriangle className="h-3.5 w-3.5 text-aviso" aria-hidden />
      {n === 1
        ? "1 evento veio fora do formato esperado e ficou fora da tela (detalhe no console do navegador)."
        : `${n} eventos vieram fora do formato esperado e ficaram fora da tela (detalhe no console do navegador).`}
    </p>
  );
}

function Carregando() {
  return (
    <div className="space-y-4" aria-label="Carregando os eventos" aria-busy>
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function ErroComparativo({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ComparativoError ? error.status : null;
  if (status === 403) {
    return (
      <Card>
        <SemAcessoState />
      </Card>
    );
  }
  const [titulo, descricao] =
    status === 502
      ? ["Comparativo indisponível", "O backend não conseguiu ler os eventos no banco. Tente de novo em instantes; se continuar, avise o time técnico."]
      : status === 400
        ? ["Período inválido", "Confira as datas do filtro."]
        : status === 0
          ? ["A resposta veio num formato inesperado", "A API respondeu, mas fora do formato combinado. Avise o time técnico."]
          : ["Não foi possível carregar os eventos", error instanceof Error ? error.message : undefined];
  return (
    <Card>
      <ErrorState titulo={titulo} descricao={descricao} onRetry={status === 400 || status === 0 ? undefined : onRetry} retryLabel="Tentar de novo" />
    </Card>
  );
}
