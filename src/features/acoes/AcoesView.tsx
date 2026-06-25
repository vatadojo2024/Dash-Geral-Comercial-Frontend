"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Layers, Sparkles, X, Zap } from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { fetchLeads } from "@/lib/data/dataClient";
import { opcoesDeDono } from "@/lib/data/donos";
import { filtrarPorEscopo } from "@/lib/data/escopo";
import { useUsuariosMap } from "@/lib/data/useUsuarios";
import { TEMPERATURA_CONFIG, TEMPERATURAS_ORDENADAS } from "@/lib/formatters/score";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { AlertaBadge, ScoreBadge, TemperatureBadge } from "@/components/domain/Badges";
import { agruparPorAcao, filtrarAcoes, TIPOS_ALERTA } from "./acoes";

function ItemAcao({ lead }: { lead: LeadListItem }) {
  return (
    <Link
      href={`/leads/${lead.lead_id}`}
      className="flex items-center gap-3 rounded-lg border border-borda/60 bg-noite/40 px-3 py-2.5 transition-colors hover:border-azul/60"
    >
      <Zap className="h-4 w-4 shrink-0 text-laranja" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-texto">
          {lead.proxima_acao}
          <span className="text-texto-sec"> — {lead.nome_exibicao}</span>
        </p>
        <span className="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
          <TemperatureBadge temperatura={lead.temperatura} size="sm" />
          {lead.alertas.map((a) => (
            <AlertaBadge key={a} alerta={a} size="sm" />
          ))}
        </span>
      </div>
      <ScoreBadge final={lead.score_final} />
      <ChevronRight className="h-4 w-4 shrink-0 text-texto-sec/50" aria-hidden />
    </Link>
  );
}

function FiltroSelect({
  label,
  valor,
  opcoes,
  onChange,
}: {
  label: string;
  valor: string;
  opcoes: { valor: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      aria-label={label}
      value={valor}
      onChange={(e) => onChange(e.target.value || null)}
      className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
        valor ? "text-texto" : "text-texto-sec"
      }`}
    >
      <option value="">{label}</option>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AcoesView() {
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });

  // URL como fonte de verdade: temperatura, alerta, agrupar e (admin) closer/SDR.
  // O escopo do papel (mesmo helper da Fila/Agenda) é aplicado ANTES.
  const filtrados = useMemo(
    () =>
      data
        ? filtrarAcoes(filtrarPorEscopo(data, user), new URLSearchParams(searchParams))
        : [],
    [data, user, searchParams],
  );

  // Opções de Closer/SDR derivadas dos próprios leads (ids reais) — ver donos.ts.
  const usuarios = useUsuariosMap();
  const donos = useMemo(() => opcoesDeDono(data ?? [], usuarios), [data, usuarios]);

  const agrupar = searchParams.get("agrupar") === "1";
  const grupos = useMemo(
    () => (agrupar ? agruparPorAcao(filtrados) : null),
    [agrupar, filtrados],
  );

  function setParam(chave: string, valor: string | null) {
    const sp = new URLSearchParams(searchParams);
    if (valor) sp.set(chave, valor);
    else sp.delete(chave);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const temFiltro = ["temperatura", "alerta", "closer", "sdr"].some((k) =>
    searchParams.get(k),
  );

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Carregando ações">
        <Skeleton className="h-14 rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar as ações"
          descricao="Tente novamente; se persistir, acione o suporte interno."
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros (URL como fonte de verdade) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-painel p-3">
        <FiltroSelect
          label="Temperatura"
          valor={searchParams.get("temperatura") ?? ""}
          opcoes={TEMPERATURAS_ORDENADAS.map((t) => ({
            valor: t,
            label: TEMPERATURA_CONFIG[t].label,
          }))}
          onChange={(v) => setParam("temperatura", v)}
        />
        <FiltroSelect
          label="Tipo de alerta"
          valor={searchParams.get("alerta") ?? ""}
          opcoes={TIPOS_ALERTA.map((t) => ({ valor: t.chave, label: t.label }))}
          onChange={(v) => setParam("alerta", v)}
        />

        {/* Closer só p/ admin; SDR p/ admin e closer (não p/ o papel SDR). */}
        {user.role === "admin" && (
          <FiltroSelect
            label="Closer"
            valor={searchParams.get("closer") ?? ""}
            opcoes={donos.closers.map((c) => ({ valor: c.id, label: c.nome }))}
            onChange={(v) => setParam("closer", v)}
          />
        )}
        {(user.role === "admin" || user.role === "closer") && (
          <FiltroSelect
            label="SDR"
            valor={searchParams.get("sdr") ?? ""}
            opcoes={donos.sdrs.map((s) => ({ valor: s.id, label: s.nome }))}
            onChange={(v) => setParam("sdr", v)}
          />
        )}

        <button
          onClick={() => setParam("agrupar", agrupar ? null : "1")}
          aria-pressed={agrupar}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
            agrupar
              ? "border-azul/40 bg-azul/15 text-azul-claro"
              : "border-borda bg-painel-claro text-texto-sec hover:text-texto"
          }`}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Agrupar por tipo de ação
        </button>

        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar filtros
          </Button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={Zap}
            titulo="Nenhuma ação para este recorte"
            descricao={
              data && data.length > 0
                ? "Ajuste ou limpe os filtros para ver todas as ações dos seus leads ativos."
                : "Quando houver leads ativos no seu escopo, as ações aparecem aqui."
            }
          />
        </Card>
      ) : grupos ? (
        <div className="space-y-4">
          <p className="text-xs text-texto-sec" role="status">
            {filtrados.length} {filtrados.length === 1 ? "ação" : "ações"} em{" "}
            {grupos.length} {grupos.length === 1 ? "tipo" : "tipos"} · por score
          </p>
          {grupos.map((g) => (
            <Card key={g.acao}>
              <CardHeader
                title={g.acao}
                subtitle={`${g.leads.length} ${g.leads.length === 1 ? "lead" : "leads"}`}
              />
              <CardContent className="space-y-2">
                {g.leads.map((l) => (
                  <ItemAcao key={l.lead_id} lead={l} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader
            title="O que atacar primeiro"
            subtitle={`${filtrados.length} ${filtrados.length === 1 ? "ação" : "ações"} · leads ativos do seu escopo, por score`}
          />
          <CardContent className="space-y-2">
            {filtrados.map((l) => (
              <ItemAcao key={l.lead_id} lead={l} />
            ))}
          </CardContent>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-texto-sec/70">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Ações geradas automaticamente pelo motor de score.
      </p>
    </div>
  );
}
