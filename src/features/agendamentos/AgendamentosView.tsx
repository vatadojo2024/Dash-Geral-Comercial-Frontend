"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarX } from "lucide-react";
import {
  agruparPorDia,
  chaveDoCloser,
  closersPresentes,
  diaMes,
  filtrarPorEscopo,
  hojeBR,
  intervaloVisivel,
  nomeDoLead,
  ordenarPorCall,
  proximaCall,
  soQueAindaVaoAcontecer,
  rotuloDoDia,
  veAgendaDeTodos,
  type AgendamentoPrimeiraCall,
  type VisaoCalendario,
} from "@/lib/agendamentos/primeiraCall";
import type { SessionUser } from "@/lib/api/contracts";
import { fetchAgendamentosPrimeiraCall } from "@/lib/data/dataClient";
import { useSession } from "@/features/session/SessionProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alternador } from "@/components/ui/Alternador";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { AgendamentoCard } from "./AgendamentoCard";
import { CalendarioAgendamentos } from "./CalendarioAgendamentos";
import { ConferenciaDashboard, useConferencia } from "./ConferenciaDashboard";
import { DetalheAgendamento } from "./DetalheAgendamento";

// ---------------------------------------------------------------------------
// Tela "Agendamentos — Primeira Call" (somente leitura). Duas visões pelo mesmo
// toggle: FILA (lista por data/hora, próxima call no topo) e CALENDÁRIO
// (semana/mês). A API já filtra por closer; o escopo é reaplicado aqui de forma
// defensiva, como na fila de leads. A URL é a fonte de verdade das escolhas
// (?visao, ?cal, ?dia, ?closer), também como na fila de leads.
//
// Janela da API: sem de/ate ela devolve de HOJE (00:00 de Brasília) em diante —
// é a fila; o calendário pede a janela que está na tela.
// ---------------------------------------------------------------------------

type Visao = "fila" | "calendario";
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

// Escopo do papel (defensivo) → ordem por call → filtro de closer do admin.
function prepararLista(
  lista: AgendamentoPrimeiraCall[] | undefined,
  user: SessionUser,
  closer: string | null,
): AgendamentoPrimeiraCall[] {
  const noEscopo = ordenarPorCall(filtrarPorEscopo(lista ?? [], user));
  return closer ? noEscopo.filter((a) => chaveDoCloser(a) === closer) : noEscopo;
}

export function AgendamentosView() {
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Relógio da tela: "hoje" e "já passou" acompanham o tempo (1 min). Só existe
  // depois de montar, para o servidor e o navegador nunca discordarem do dia.
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hoje = agora ? hojeBR(agora) : null;

  const visao: Visao = searchParams.get("visao") === "calendario" ? "calendario" : "fila";
  const visaoCal: VisaoCalendario = searchParams.get("cal") === "semana" ? "semana" : "mes";
  const diaParam = searchParams.get("dia");
  const ancora = diaParam && RE_DIA.test(diaParam) ? diaParam : hoje;
  const closerSel = searchParams.get("closer");

  function setParams(mudancas: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) sp.set(chave, valor);
      else sp.delete(chave);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const fila = useQuery({
    queryKey: ["agendamentos-primeira-call", "fila", user.id],
    queryFn: () => fetchAgendamentosPrimeiraCall(),
  });

  const janela = ancora ? intervaloVisivel(visaoCal, ancora) : null;
  const calendario = useQuery({
    queryKey: ["agendamentos-primeira-call", "calendario", user.id, janela?.de, janela?.ate],
    queryFn: () => fetchAgendamentosPrimeiraCall({ de: janela!.de, ate: janela!.ate }),
    enabled: visao === "calendario" && janela != null,
    placeholderData: keepPreviousData,
  });

  const veTodos = veAgendaDeTodos(user.role);
  // O filtro de closer só existe para quem vê a agenda de todos (admin e SDR);
  // o closer já vê só as próprias.
  const closerDoFiltro = veTodos ? closerSel : null;
  // Conferência com o Dashboard SDR: a lista INTEIRA do escopo (inclusive as
  // calls de hoje que já passaram — o Dashboard conta o dia todo), no filtro
  // de closer do admin (pelo nome, que é o que o Dashboard tem).
  const listaDaConferencia = useMemo(
    () => prepararLista(fila.data?.agendamentos, user, closerDoFiltro),
    [fila.data, user, closerDoFiltro],
  );
  const nomeDoCloserFiltrado = closerDoFiltro
    ? (listaDaConferencia[0]?.closer_nome ??
      fila.data?.agendamentos.find((a) => chaveDoCloser(a) === closerDoFiltro)?.closer_nome ??
      null)
    : null;
  const conferencia = useConferencia(
    listaDaConferencia,
    hoje ?? "2000-01-01",
    nomeDoCloserFiltrado,
    visao === "fila" && !!hoje && fila.isSuccess,
  );

  // Fila: só o que ainda vai acontecer (recalcula a cada minuto com `agora`).
  const itensDaFila = useMemo(
    () => soQueAindaVaoAcontecer(prepararLista(fila.data?.agendamentos, user, closerDoFiltro), agora ?? new Date()),
    [fila.data, user, closerDoFiltro, agora],
  );
  const itensDoCalendario = useMemo(
    () => prepararLista(calendario.data?.agendamentos, user, closerDoFiltro),
    [calendario.data, user, closerDoFiltro],
  );

  // Filtro de closer (só admin): nomes presentes no que está carregado.
  const opcoesCloser = useMemo(
    () =>
      veTodos
        ? closersPresentes(
            filtrarPorEscopo(
              [...(fila.data?.agendamentos ?? []), ...(calendario.data?.agendamentos ?? [])].filter(
                (a, i, todos) => todos.findIndex((b) => b.evento_id === a.evento_id) === i,
              ),
              user,
            ),
          )
        : [],
    [veTodos, fila.data, calendario.data, user],
  );

  // Detalhe: o mesmo painel para a fila e para o calendário.
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const selecionado = useMemo(
    () => [...itensDaFila, ...itensDoCalendario].find((a) => a.evento_id === selecionadoId) ?? null,
    [itensDaFila, itensDoCalendario, selecionadoId],
  );

  const descartados = (visao === "fila" ? fila.data?.descartados : calendario.data?.descartados) ?? 0;
  // Só esta tela em mock (teste local): avisa, para ninguém ler como dado real.
  const mockLocal = (visao === "fila" ? fila.data?.fonte : calendario.data?.fonte) === "mock_local";

  return (
    <>
      <PageHeader
        titulo="Agendamentos — Primeira Call"
        descricao={
          veTodos
            ? "Fila e calendário das primeiras calls de todos os closers. Cada closer vê só a própria agenda."
            : "Fila e calendário das suas primeiras calls agendadas."
        }
        acoes={
          <>
            {veTodos && opcoesCloser.length > 0 && (
              <select
                aria-label="Filtrar por closer"
                value={closerSel ?? ""}
                onChange={(e) => setParams({ closer: e.target.value || null })}
                className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
                  closerSel ? "text-texto" : "text-texto-sec"
                }`}
              >
                <option value="">Todos os closers</option>
                {opcoesCloser.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
            <Alternador<Visao>
              rotulo="Visão dos agendamentos"
              valor={visao}
              onChange={(v) => setParams({ visao: v === "calendario" ? v : null })}
              opcoes={[
                { valor: "fila", label: "Fila" },
                { valor: "calendario", label: "Calendário" },
              ]}
            />
          </>
        }
      />

      <div className="space-y-4">
        {mockLocal && (
          <p className="ds-card flex flex-wrap items-center gap-2 px-6 py-3 text-xs text-texto-sec" role="note">
            <span className="tag tag-warning">Dados de demonstração</span>
            Esta tela está em modo de teste local (AGENDAMENTOS_MODE=mock). Os agendamentos abaixo são fictícios; as
            outras telas seguem na API real.
          </p>
        )}
        {descartados > 0 && (
          <p className="ds-card px-6 py-3 text-xs text-texto-sec" role="note">
            {descartados} {descartados === 1 ? "agendamento veio" : "agendamentos vieram"} com dado inválido e{" "}
            {descartados === 1 ? "foi ignorado" : "foram ignorados"}. O motivo está no log do servidor.
          </p>
        )}

        {!agora || !hoje || !ancora ? (
          <Carregando />
        ) : visao === "fila" ? (
          fila.isLoading ? (
            <Carregando />
          ) : fila.isError ? (
            <Card>
              <ErrorState
                titulo="Não foi possível carregar os agendamentos"
                error={fila.error}
                descricao={fila.error instanceof Error ? fila.error.message : "Tente novamente; se persistir, acione o suporte interno."}
                onRetry={() => fila.refetch()}
              />
            </Card>
          ) : (
            <>
              <ConferenciaDashboard
                dias={conferencia.dias}
                carregando={conferencia.isLoading}
                erro={conferencia.isError ? (conferencia.error instanceof Error ? conferencia.error.message : "erro") : null}
                hoje={hoje}
                fonte={conferencia.data?.fonte ?? null}
              />
              {itensDaFila.length === 0 ? (
            <Card>
              <EmptyState
                icon={CalendarX}
                titulo="Nenhuma primeira call agendada"
                descricao={
                  veTodos && closerSel
                    ? "Este closer não tem primeiras calls daqui para a frente. Troque o filtro para ver os demais."
                    : "Não há primeiras calls daqui para a frente. Quando um lead entrar em “Primeira Call Agendada”, ele aparece aqui."
                }
              />
            </Card>
              ) : (
                <Fila itens={itensDaFila} agora={agora} hoje={hoje} onAbrir={setSelecionadoId} />
              )}
            </>
          )
        ) : calendario.isError ? (
          <Card>
            <ErrorState
              titulo="Não foi possível carregar o calendário"
              error={calendario.error}
              descricao={calendario.error instanceof Error ? calendario.error.message : "Tente novamente; se persistir, acione o suporte interno."}
              onRetry={() => calendario.refetch()}
            />
          </Card>
        ) : (
          <CalendarioAgendamentos
            itens={itensDoCalendario}
            carregando={calendario.isLoading}
            visao={visaoCal}
            onVisao={(v) => setParams({ cal: v === "semana" ? v : null })}
            ancora={ancora}
            onAncora={(dia) => setParams({ dia: dia === hoje ? null : dia })}
            hoje={hoje}
            agora={agora}
            onAbrir={setSelecionadoId}
          />
        )}
      </div>

      {selecionado && agora && hoje && (
        <DetalheAgendamento ag={selecionado} agora={agora} hoje={hoje} onClose={() => setSelecionadoId(null)} />
      )}
    </>
  );
}

function Carregando() {
  return (
    <div className="space-y-3" aria-label="Carregando agendamentos" aria-busy>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

// Fila: próxima call no topo, separada por dia (Hoje, Amanhã, seg 29/09…).
function Fila({
  itens,
  agora,
  hoje,
  onAbrir,
}: {
  itens: AgendamentoPrimeiraCall[];
  agora: Date;
  hoje: string;
  onAbrir: (id: string) => void;
}) {
  const grupos = useMemo(() => agruparPorDia(itens), [itens]);
  const proxima = proximaCall(itens, agora);
  const deHoje = itens.filter((a) => a.dia === hoje).length;

  return (
    <>
      <p className="text-xs text-texto-sec" role="status">
        {itens.length} {itens.length === 1 ? "primeira call" : "primeiras calls"} na fila · {deHoje} hoje
        {proxima && (
          <>
            {" "}
            · próxima: {rotuloDoDia(proxima.dia, hoje).toLowerCase()} às {proxima.hora_br} com {nomeDoLead(proxima)}
          </>
        )}
      </p>
      <div className="space-y-5">
        {grupos.map((g) => (
          <section key={g.dia} aria-label={`Calls de ${rotuloDoDia(g.dia, hoje)}`}>
            <h2 className="mb-2 flex items-baseline gap-2 border-b border-borda/60 pb-1.5 text-sm font-semibold text-texto">
              {rotuloDoDia(g.dia, hoje)}
              <span className="text-xs font-normal text-texto-sec">
                {/* "Hoje"/"Amanhã" ganham a data ao lado; "seg, 29/09" já a traz. */}
                {!rotuloDoDia(g.dia, hoje).includes("/") && <>{diaMes(g.dia)} · </>}
                {g.itens.length} {g.itens.length === 1 ? "call" : "calls"}
              </span>
            </h2>
            <div className="space-y-3">
              {g.itens.map((ag) => (
                <AgendamentoCard key={ag.evento_id} ag={ag} agora={agora} hoje={hoje} onAbrir={onAbrir} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
