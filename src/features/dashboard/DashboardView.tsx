"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Inbox, Search, Star, X } from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { fetchLeads } from "@/lib/data/dataClient";
import { tempoRelativo } from "@/lib/formatters/date";
import { chaveDoProduto, PRODUTOS_OFICIAIS } from "@/lib/formatters/score";
import { leadDoSdr, opcoesDeDono } from "@/lib/data/donos";
import { useUsuariosMap } from "@/lib/data/useUsuarios";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { HeatmapGrid } from "@/components/domain/HeatmapGrid";
import { Button } from "@/components/ui/Button";
import {
  acoesRecomendadas,
  cardsResumo,
  montarHeatmap,
  recorteDaCelula,
  recorteForaDaGrade,
  type CardResumo,
  type Recorte,
} from "./derivacoes";
import { RecortePanel } from "./RecortePanel";
import { AcoesRecomendadas } from "./AcoesRecomendadas";

const ACENTO: Record<CardResumo["destaque"], string> = {
  rosa: "bg-rosa",
  laranja: "bg-laranja",
  azul: "bg-azul",
  teal: "bg-teal",
  cinza: "bg-cinza",
  violeta: "bg-violeta",
};

type Filtros = {
  busca: string;
  closer: string;
  sdr: string;
  produto: string;
  pool: boolean;
  // Filtro pronto "só os destacados" — o atalho para achar os leads com estrela
  // sem digitar nada. Como os demais, redesenha mapa, cards e ações.
  destaque: boolean;
};
const SEM_FILTROS: Filtros = {
  busca: "",
  closer: "",
  sdr: "",
  produto: "",
  pool: false,
  destaque: false,
};

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function DashboardView() {
  const user = useSession();
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [recorte, setRecorte] = useState<Recorte | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });

  // 6.1.1: os filtros acima do mapa filtram o PRÓPRIO mapa (e os cards e as
  // ações), redesenhando a grade na hora — sem navegar para a fila.
  const leadsFiltrados = useMemo(() => {
    if (!data) return [];
    return data.filter((l) => {
      if (filtros.busca) {
        const alvo = normalizar(`${l.nome_exibicao ?? ""} ${l.lead_id ?? ""}`);
        if (!alvo.includes(normalizar(filtros.busca))) return false;
      }
      if (filtros.closer && l.closer_id !== filtros.closer) return false;
      if (!leadDoSdr(l, filtros.sdr)) return false; // inclui a sentinela "sem SDR"
      if (filtros.produto && chaveDoProduto(l.produto_sugerido) !== filtros.produto)
        return false;
      if (filtros.pool && !l.sdr_pool) return false;
      if (filtros.destaque && !l.destaque) return false;
      return true;
    });
  }, [data, filtros]);

  // Opções de Closer/SDR derivadas dos próprios leads (ids reais: slug no mock,
  // UUID na API) — usar a lista fixa do mock fazia o filtro nunca casar.
  const usuarios = useUsuariosMap();
  const donos = useMemo(() => opcoesDeDono(data ?? [], usuarios), [data, usuarios]);

  const cards = useMemo(() => cardsResumo(leadsFiltrados), [leadsFiltrados]);
  const heatmap = useMemo(() => montarHeatmap(leadsFiltrados), [leadsFiltrados]);

  const leadsDoRecorte = useMemo(
    () =>
      recorte
        ? leadsFiltrados
            .filter(recorte.predicado)
            .sort((a, b) => b.score_final - a.score_final)
        : null,
    [leadsFiltrados, recorte],
  );

  const acoes = useMemo(
    () => acoesRecomendadas(leadsDoRecorte ?? leadsFiltrados, 6),
    [leadsDoRecorte, leadsFiltrados],
  );

  const ultimoCalculo = useMemo(() => {
    if (!data?.length) return null;
    return data.reduce(
      (max, l) => (l.score_calculated_at > max ? l.score_calculated_at : max),
      data[0].score_calculated_at,
    );
  }, [data]);

  const desatualizado =
    ultimoCalculo !== null &&
    Date.now() - new Date(ultimoCalculo).getTime() > 6 * 3600_000;

  const temFiltro =
    filtros.busca !== "" ||
    filtros.closer !== "" ||
    filtros.sdr !== "" ||
    filtros.produto !== "" ||
    filtros.pool ||
    filtros.destaque;

  function alternarRecorte(novo: Recorte) {
    setRecorte((atual) => (atual?.id === novo.id ? null : novo));
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Carregando dashboard">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar o dashboard"
          descricao="Tente novamente; se persistir, acione o suporte interno."
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          titulo="Nenhum lead visível para o seu papel"
          descricao="Quando houver leads no seu escopo, o resumo e o mapa de calor aparecem aqui."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {ultimoCalculo && (
        <p className="text-xs text-texto-sec" role="status">
          Score mais recente calculado {tempoRelativo(ultimoCalculo)}.
        </p>
      )}

      {desatualizado && (
        <div className="flex items-center gap-2 rounded-xl border border-laranja/30 bg-laranja/10 px-4 py-3 text-sm text-laranja">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Os scores não são recalculados há mais de 6 horas — alguns podem estar
          desatualizados.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const ativo = recorte?.id === card.recorte.id;
          return (
            <button
              key={card.id}
              onClick={() => alternarRecorte(card.recorte)}
              aria-pressed={ativo}
              title="Clique para ver a lista deste recorte"
              className={`flex overflow-hidden rounded-xl border bg-painel text-left shadow-sm transition-colors ${
                ativo ? "border-azul-claro ring-1 ring-azul" : "border-borda hover:border-azul/50"
              }`}
            >
              <span className={`w-1 shrink-0 ${ACENTO[card.destaque]}`} aria-hidden />
              <span className="flex flex-col gap-1 p-3">
                <span className="text-xs text-texto-sec">{card.label}</span>
                <span className="text-2xl font-bold tabular-nums text-texto">
                  {card.valor}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros do mapa (6.1.1) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-painel p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
            aria-hidden
          />
          <input
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            placeholder="Filtrar o mapa por nome ou ID..."
            aria-label="Filtrar o mapa por nome ou ID"
            className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
          />
        </div>

        {/* Closer só p/ admin; SDR p/ admin e closer (não p/ o papel SDR). */}
        {user.role === "admin" && (
          <select
            aria-label="Filtrar por closer"
            value={filtros.closer}
            onChange={(e) => setFiltros((f) => ({ ...f, closer: e.target.value }))}
            className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
              filtros.closer ? "text-texto" : "text-texto-sec"
            }`}
          >
            <option value="">Closer</option>
            {donos.closers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        {(user.role === "admin" || user.role === "closer") && (
          <select
            aria-label="Filtrar por SDR"
            value={filtros.sdr}
            onChange={(e) => setFiltros((f) => ({ ...f, sdr: e.target.value }))}
            className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
              filtros.sdr ? "text-texto" : "text-texto-sec"
            }`}
          >
            <option value="">SDR</option>
            {donos.sdrs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filtrar por produto sugerido"
          value={filtros.produto}
          onChange={(e) => setFiltros((f) => ({ ...f, produto: e.target.value }))}
          className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
            filtros.produto ? "text-texto" : "text-texto-sec"
          }`}
        >
          <option value="">Produto</option>
          {PRODUTOS_OFICIAIS.map((p) => (
            <option key={p.chave} value={p.chave}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Filtro pronto de destaque: visível para TODOS os papéis — só o admin
            MARCA a estrela, mas closer e SDR também precisam achar os leads
            que o admin priorizou. */}
        <button
          onClick={() => setFiltros((f) => ({ ...f, destaque: !f.destaque }))}
          aria-pressed={filtros.destaque}
          title="Mostrar apenas os leads marcados com estrela pelo admin"
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
            filtros.destaque
              ? "border-amarelo/50 bg-amarelo/15 text-amarelo"
              : "border-borda bg-painel-claro text-texto-sec hover:text-texto"
          }`}
        >
          <Star
            className={`h-3.5 w-3.5 ${filtros.destaque ? "fill-amarelo" : "fill-none"}`}
            aria-hidden
          />
          Destaques
        </button>

        {user.role !== "closer" && (
          <button
            onClick={() => setFiltros((f) => ({ ...f, pool: !f.pool }))}
            aria-pressed={filtros.pool}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
              filtros.pool
                ? "border-violeta/40 bg-violeta/15 text-violeta"
                : "border-borda bg-painel-claro text-texto-sec hover:text-texto"
            }`}
          >
            Pool da Hana
          </button>
        )}

        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => setFiltros(SEM_FILTROS)}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Mapa + listagem lateral do recorte (6.1.2) */}
      <div className={recorte ? "grid gap-4 lg:grid-cols-[1.7fr_1fr]" : ""}>
        <Card>
          <CardHeader
            title="Mapa de calor"
            subtitle="Concentração por temperatura e etapa (agrupada). Clique numa célula para listar os leads ao lado."
          />
          <CardContent>
            <HeatmapGrid
              heatmap={heatmap}
              selecionada={
                recorte?.id.startsWith("celula:")
                  ? {
                      temperatura: recorte.id.split(":")[1],
                      grupoId: recorte.id.split(":")[2],
                    }
                  : null
              }
              onSelect={(c) => alternarRecorte(recorteDaCelula(c))}
            />
            {heatmap.foraDaGrade > 0 && (
              <p className="mt-3 text-xs text-texto-sec">
                Fora da grade:{" "}
                <button
                  onClick={() => alternarRecorte(recorteForaDaGrade())}
                  className="font-medium text-texto underline underline-offset-2 hover:text-azul-claro"
                >
                  {heatmap.foraDaGrade} lead(s)
                </button>{" "}
                em blacklist, fechado ou sem etapa definida
                {heatmap.destaquesForaDaGrade > 0 && (
                  <>
                    {" — "}
                    <span className="inline-flex items-center gap-1 align-[-2px] font-medium text-amarelo">
                      <Star className="h-3 w-3 fill-amarelo" aria-hidden />
                      {heatmap.destaquesForaDaGrade} em destaque
                    </span>
                  </>
                )}
                .
              </p>
            )}
          </CardContent>
        </Card>

        {recorte && leadsDoRecorte && (
          <RecortePanel
            titulo={recorte.label}
            leads={leadsDoRecorte}
            onClose={() => setRecorte(null)}
          />
        )}
      </div>

      {/* Ações recomendadas (6.1.3) */}
      <AcoesRecomendadas
        leads={acoes}
        contexto={recorte ? `recorte: ${recorte.label}` : "todos os leads visíveis"}
      />
    </div>
  );
}
