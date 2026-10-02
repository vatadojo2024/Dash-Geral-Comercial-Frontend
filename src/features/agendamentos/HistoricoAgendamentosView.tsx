"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarX, ChevronDown, Flame, Mail, Package, Phone, UserRound } from "lucide-react";
import {
  agruparPorDiaDoAgendamento,
  contarNovos,
  idsRemarcados,
  inicioDoPeriodo,
  juntarPaginas,
  OPCOES_PERIODO,
  type ItemHistorico,
  type PeriodoHistorico,
} from "@/lib/agendamentos/historico";
import {
  diaMes,
  hojeBR,
  nomeDoLead,
  partesDaUrgencia,
  produtoDoAgendamento,
  rotuloDoDia,
} from "@/lib/agendamentos/primeiraCall";
import { fetchHistoricoAgendamentos } from "@/lib/data/dataClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { AbasAgendamentos } from "./AbasAgendamentos";
import { AcoesDoAgendamento } from "./partes";

// ---------------------------------------------------------------------------
// Sub-aba "Histórico" de Agendamentos (/agendamentos/historico; só admin — área
// `historico_agendamentos`): o feed
// de TODAS as primeiras calls agendadas (2ª call em diante não entra), de todos
// os closers, na ordem em que foram marcadas.
// Substitui o canal único do Discord: quando um agendamento cai, aparece no topo.
//
// - Ordem e datas são as da API (já em Brasília): nada é reordenado nem
//   reconvertido aqui.
// - "Carregar mais" por cursor (proximo_cursor → antes_de), nunca offset.
// - Novidades: a cada minuto pergunta o que caiu DEPOIS do item do topo. Com
//   uma página só na tela, atualiza sozinho; com mais páginas carregadas,
//   mostra o aviso "N novos" (recarregar tudo com o cursor antigo pularia o
//   item que escorregou de uma página para a outra).
// ---------------------------------------------------------------------------

const POR_PAGINA = 100;

export function HistoricoAgendamentosView() {
  const queryClient = useQueryClient();

  // "Hoje" só existe depois de montar (servidor e navegador nunca discordam do dia).
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hoje = agora ? hojeBR(agora) : null;

  const [periodo, setPeriodo] = useState<PeriodoHistorico>("tudo");
  const [incluirSemData, setIncluirSemData] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  const de = hoje ? inicioDoPeriodo(periodo, hoje) : null;
  const chave = ["agendamentos-historico", de, incluirSemData] as const;

  const lista = useInfiniteQuery({
    queryKey: chave,
    queryFn: ({ pageParam }) =>
      fetchHistoricoAgendamentos({ de, incluirSemData, limite: POR_PAGINA, antesDe: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximo_cursor ?? undefined,
    enabled: !!hoje,
    retry: false,
  });

  const paginas = lista.data?.pages ?? [];
  const itens = useMemo(() => juntarPaginas(paginas), [paginas]);
  const grupos = useMemo(() => agruparPorDiaDoAgendamento(itens), [itens]);
  const remarcados = useMemo(() => idsRemarcados(itens), [itens]);
  // `total` conta a partir do cursor pedido: o da janela inteira é o da 1ª página.
  const total = paginas[0]?.total ?? 0;
  const semData = itens.filter((a) => !a.call_at).length;
  const descartados = paginas.reduce((s, p) => s + p.descartados, 0);
  const mockLocal = paginas[0]?.fonte === "mock_local";

  // Novidades acima do topo (a janela é inclusiva: o próprio topo volta e não conta).
  const topo = itens[0]?.agendado_em ?? null;
  const novidades = useQuery({
    queryKey: ["agendamentos-historico-novos", topo, incluirSemData],
    queryFn: () => fetchHistoricoAgendamentos({ de: topo, incluirSemData, limite: 50 }),
    enabled: !!topo,
    refetchInterval: 60_000,
    retry: false,
  });
  const novos = contarNovos(novidades.data?.agendamentos ?? [], topo);
  const umaPagina = paginas.length === 1;
  const { refetch } = lista;
  useEffect(() => {
    if (novos > 0 && umaPagina) refetch();
  }, [novos, umaPagina, refetch]);

  return (
    <>
      <PageHeader
        titulo="Agendamentos"
        descricao="Histórico: todas as primeiras calls agendadas, de todos os closers, na ordem em que foram marcadas — a mais recente no topo."
      />

      <div className="space-y-4">
        <AbasAgendamentos />
        <div className="ds-card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <Filtro rotulo="Marcados em">
            <Alternador rotulo="Período do agendamento" valor={periodo} onChange={setPeriodo} opcoes={OPCOES_PERIODO} />
          </Filtro>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-texto-sec">
            <button
              type="button"
              role="switch"
              aria-checked={incluirSemData}
              onClick={() => setIncluirSemData((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                incluirSemData ? "border-azul bg-azul" : "border-borda bg-painel-claro",
              )}
            >
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  incluirSemData ? "translate-x-[1.1rem]" : "translate-x-0.5",
                )}
              />
            </button>
            Mostrar os sem data da call
          </label>
        </div>

        {mockLocal && (
          <p className="ds-card flex flex-wrap items-center gap-2 px-6 py-3 text-xs text-texto-sec" role="note">
            <span className="tag tag-warning">Dados de demonstração</span>
            Esta tela está em modo de teste local (AGENDAMENTOS_MODE=mock). Os agendamentos abaixo são fictícios.
          </p>
        )}
        {descartados > 0 && (
          <p className="ds-card px-6 py-3 text-xs text-texto-sec" role="note">
            {descartados} {descartados === 1 ? "agendamento veio" : "agendamentos vieram"} com dado inválido e{" "}
            {descartados === 1 ? "foi ignorado" : "foram ignorados"}. O motivo está no log do servidor.
          </p>
        )}

        {novos > 0 && !umaPagina && (
          <button
            type="button"
            onClick={() => queryClient.resetQueries({ queryKey: chave, exact: true })}
            className="ds-card flex w-full items-center justify-center gap-2 border-azul/40 bg-azul/10 px-4 py-2.5 text-sm font-medium text-texto transition-colors hover:bg-azul/15"
          >
            <BellRing className="h-4 w-4 text-azul" aria-hidden />
            {novos === 1 ? "1 novo agendamento" : `${novos} novos agendamentos`} — mostrar no topo
          </button>
        )}

        {!hoje || lista.isLoading ? (
          <Carregando />
        ) : lista.isError ? (
          <Card>
            <ErrorState
              titulo="Não foi possível carregar o histórico"
              error={lista.error}
              descricao={lista.error instanceof Error ? lista.error.message : "Tente novamente."}
              onRetry={() => lista.refetch()}
            />
          </Card>
        ) : itens.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarX}
              titulo="Nenhuma primeira call agendada"
              descricao={
                periodo === "tudo" && incluirSemData
                  ? "Ainda não há primeiras calls registradas. Quando um card entrar em “Primeira Call Agendada” na Clint, ele aparece aqui."
                  : "Nenhuma primeira call com esses filtros. Amplie o período ou mostre também as sem data."
              }
            />
          </Card>
        ) : (
          <>
            <p className="text-xs text-texto-sec" role="status">
              <span className="font-semibold tabular-nums text-texto">{total}</span>{" "}
              {total === 1 ? "primeira call agendada" : "primeiras calls agendadas"}
              {itens.length < total && <> · mostrando os {itens.length} mais recentes</>}
              {incluirSemData && semData > 0 && (
                <>
                  {" "}
                  · <span className="tabular-nums">{semData}</span> {semData === 1 ? "está" : "estão"} sem data da call
                </>
              )}
            </p>

            {grupos.map((g) => (
              <Card key={g.dia} className="overflow-hidden">
                <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-texto">
                    {rotuloDoDia(g.dia, hoje)}
                    {!rotuloDoDia(g.dia, hoje).includes("/") && (
                      <span className="font-normal text-texto-sec"> · {diaMes(g.dia)}</span>
                    )}
                  </h2>
                  <span className="text-xs tabular-nums text-texto-sec">
                    {g.itens.length} {g.itens.length === 1 ? "agendamento" : "agendamentos"}
                  </span>
                </div>
                <ul className="divide-y divide-white/[0.06]">
                  {g.itens.map((a) => (
                    <LinhaHistorico
                      key={a.id}
                      item={a}
                      hoje={hoje}
                      remarcou={remarcados.has(a.id)}
                      aberto={aberto === a.id}
                      onAlternar={() => setAberto((v) => (v === a.id ? null : a.id))}
                    />
                  ))}
                </ul>
              </Card>
            ))}

            {lista.hasNextPage && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={lista.isFetchingNextPage}
                  onClick={() => lista.fetchNextPage()}
                >
                  Carregar mais ({total - itens.length} {total - itens.length === 1 ? "restante" : "restantes"})
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="whitespace-nowrap text-xs text-texto-sec">{rotulo}</span>
      {children}
    </div>
  );
}

// Data/hora da call: à direita da linha (tela larga) ou embaixo do nome
// (celular). Sem data = cinza, à vista (é o sinal de agendamento que ninguém
// completou na Clint).
function CallDaLinha({ item, hoje, compacta }: { item: ItemHistorico; hoje: string; compacta?: boolean }) {
  if (!item.dia_call || !item.call_hora) {
    return (
      <span
        className="tag text-texto-sec/80 opacity-80"
        title="O card foi movido na Clint sem a data da call preenchida."
      >
        sem data
      </span>
    );
  }
  if (compacta) {
    return (
      <span className="text-xs tabular-nums text-texto">
        <span className="text-texto-sec">call </span>
        {rotuloDoDia(item.dia_call, hoje)} · {item.call_hora}
      </span>
    );
  }
  return (
    <span className="text-right">
      <span className="block text-[11px] text-texto-sec">call</span>
      <span className="block text-sm tabular-nums text-texto">
        {rotuloDoDia(item.dia_call, hoje)} · {item.call_hora}
      </span>
    </span>
  );
}

function LinhaHistorico({
  item,
  hoje,
  remarcou,
  aberto,
  onAlternar,
}: {
  item: ItemHistorico;
  hoje: string;
  remarcou: boolean;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const nome = nomeDoLead(item);
  const idDetalhe = `historico-${item.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        aria-controls={idDetalhe}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]",
          aberto && "bg-white/[0.04]",
        )}
      >
        <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-texto" title="Hora do agendamento">
          {item.agendado_hora}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-texto sm:truncate">{nome}</span>
            {remarcou && (
              <span className="tag tag-warning" title="Este lead já tinha a primeira call marcada para outra data">
                remarcou
              </span>
            )}
          </span>
          <span className="block text-xs text-texto-sec/80 sm:truncate">
            closer {item.closer_nome ?? "não identificado"}
            {item.sdr_nome && <> · SDR {item.sdr_nome}</>}
          </span>
          <span className="mt-1 block sm:hidden">
            <CallDaLinha item={item} hoje={hoje} compacta />
          </span>
        </span>
        <span className="hidden shrink-0 sm:block">
          <CallDaLinha item={item} hoje={hoje} />
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-texto-sec/50 transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>
      {aberto && <DetalheDaLinha id={idDetalhe} item={item} />}
    </li>
  );
}

function DetalheDaLinha({ id, item }: { id: string; item: ItemHistorico }) {
  const urgencia = partesDaUrgencia(item.urgencia);
  const produto = produtoDoAgendamento({ produto_indicado: item.produto_indicado, produto_variante: null });

  return (
    <div id={id} className="space-y-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm sm:pl-[4.25rem]">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Campo rotulo="Agendado em">
          {item.agendado_data} às {item.agendado_hora}
        </Campo>
        <Campo rotulo="Data da call">
          {item.call_data ? (
            <>
              {item.call_data} às {item.call_hora}
            </>
          ) : (
            <span className="text-texto-sec">Sem data — o card foi movido na Clint sem a data preenchida.</span>
          )}
        </Campo>
        <Campo rotulo="Produto indicado" icone={Package}>
          {produto ?? item.produto_indicado ?? <span className="text-texto-sec">—</span>}
        </Campo>
        <Campo rotulo="Contato" icone={Phone}>
          {item.lead_telefone || item.lead_email ? (
            <span className="flex flex-col">
              {item.lead_telefone && <span className="tabular-nums">{item.lead_telefone}</span>}
              {item.lead_email && (
                <span className="flex items-center gap-1 break-all text-texto-sec">
                  <Mail className="h-3 w-3 shrink-0" aria-hidden />
                  {item.lead_email}
                </span>
              )}
            </span>
          ) : (
            <span className="text-texto-sec">—</span>
          )}
        </Campo>
      </dl>

      <p className="flex items-start gap-2">
        <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-laranja" aria-hidden />
        <span>
          <span className="font-medium text-texto-sec">Urgência: </span>
          {urgencia ? (
            <>
              {urgencia.nota != null && <span className="font-semibold tabular-nums">{urgencia.nota}/10 </span>}
              {urgencia.nota != null && urgencia.texto && "— "}
              {urgencia.texto}
            </>
          ) : (
            <span className="text-texto-sec">não informada</span>
          )}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <AcoesDoAgendamento ag={item} />
        {item.lead_id && (
          <Link
            href={`/leads/${encodeURIComponent(item.lead_id)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-azul hover:underline"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Ver ficha do lead
          </Link>
        )}
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  icone: Icone,
  children,
}: {
  rotulo: string;
  icone?: typeof Package;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-texto-sec">
        {Icone && <Icone className="h-3 w-3" aria-hidden />}
        {rotulo}
      </dt>
      <dd className="text-texto">{children}</dd>
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando o histórico">
      <Skeleton className="h-4 w-56 rounded" />
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  );
}
