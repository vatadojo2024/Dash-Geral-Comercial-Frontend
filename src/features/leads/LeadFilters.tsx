"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { ETAPAS } from "@/lib/api/contracts";
import {
  ETAPA_LABEL,
  ETAPA_NULA_LABEL,
  PRODUTOS_OFICIAIS,
  TEMPERATURA_CONFIG,
  TEMPERATURAS_ORDENADAS,
} from "@/lib/formatters/score";
import type { OpcaoDono } from "@/lib/data/donos";
import { useSession } from "@/features/session/SessionProvider";
import { Button } from "@/components/ui/Button";
import { SEM_ETAPA, contarFiltrosAtivos } from "./filtros";

type Props = {
  params: URLSearchParams;
  onChange: (chave: string, valor: string | null) => void;
  onLimpar: () => void;
  // Opções derivadas dos leads (ids reais) — ver lib/data/donos.ts.
  closers: OpcaoDono[];
  sdrs: OpcaoDono[];
};

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
  // Valor com vírgula = filtro múltiplo vindo do dashboard; o select mostra
  // o placeholder e o detalhe aparece no contador/limpar.
  const multiplo = valor.includes(",");
  return (
    <select
      aria-label={label}
      value={multiplo ? "" : valor}
      onChange={(e) => onChange(e.target.value || null)}
      className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
        valor ? "text-texto" : "text-texto-sec"
      }`}
    >
      <option value="">{multiplo ? `${label} (múltiplos)` : label}</option>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LeadFilters({ params, onChange, onLimpar, closers, sdrs }: Props) {
  const user = useSession();
  const ativos = contarFiltrosAtivos(params);

  // Busca digitada fica em estado LOCAL e só vai pra URL no Enter (submit). Cada
  // escrita na URL re-renderiza /leads (rota dinâmica) e dispara um fetch do RSC
  // ao servidor — comitar por tecla fazia uma requisição por letra.
  const buscaUrl = params.get("busca") ?? "";
  const [busca, setBusca] = useState(buscaUrl);
  // Sincroniza quando a URL muda por fora (botão Limpar, voltar do navegador).
  useEffect(() => setBusca(buscaUrl), [buscaUrl]);

  return (
    <div className="rounded-xl border border-borda bg-painel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onChange("busca", busca.trim() || null);
          }}
          className="relative min-w-[200px] flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
            aria-hidden
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou ID... (Enter)"
            aria-label="Buscar lead por nome ou ID"
            className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
          />
        </form>

        <FiltroSelect
          label="Temperatura"
          valor={params.get("temperatura") ?? ""}
          opcoes={TEMPERATURAS_ORDENADAS.map((t) => ({
            valor: t,
            label: TEMPERATURA_CONFIG[t].label,
          }))}
          onChange={(v) => onChange("temperatura", v)}
        />

        <FiltroSelect
          label="Etapa"
          valor={params.get("etapa") ?? ""}
          opcoes={[
            ...ETAPAS.map((e) => ({ valor: e, label: ETAPA_LABEL[e] })),
            { valor: SEM_ETAPA, label: ETAPA_NULA_LABEL },
          ]}
          onChange={(v) => onChange("etapa", v)}
        />

        <FiltroSelect
          label="Produto"
          valor={params.get("produto") ?? ""}
          opcoes={PRODUTOS_OFICIAIS.map((p) => ({ valor: p.chave, label: p.label }))}
          onChange={(v) => onChange("produto", v)}
        />

        {user.role === "admin" && (
          <>
            <FiltroSelect
              label="Closer"
              valor={params.get("closer") ?? ""}
              opcoes={closers.map((c) => ({ valor: c.id, label: c.nome }))}
              onChange={(v) => onChange("closer", v)}
            />
            <FiltroSelect
              label="SDR"
              valor={params.get("sdr") ?? ""}
              opcoes={sdrs.map((s) => ({ valor: s.id, label: s.nome }))}
              onChange={(v) => onChange("sdr", v)}
            />
          </>
        )}

        <div className="flex items-center gap-1.5" title="Intervalo por última atividade">
          <input
            type="date"
            aria-label="Data inicial (última atividade)"
            value={params.get("de") ?? ""}
            max={params.get("ate") || undefined}
            onChange={(e) => onChange("de", e.target.value || null)}
            className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
              params.get("de") ? "text-texto" : "text-texto-sec"
            }`}
          />
          <span className="text-xs text-texto-sec">até</span>
          <input
            type="date"
            aria-label="Data final (última atividade)"
            value={params.get("ate") ?? ""}
            min={params.get("de") || undefined}
            onChange={(e) => onChange("ate", e.target.value || null)}
            className={`h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm ${
              params.get("ate") ? "text-texto" : "text-texto-sec"
            }`}
          />
        </div>

        {user.role !== "closer" && (
          <button
            onClick={() => onChange("pool", params.get("pool") === "1" ? null : "1")}
            aria-pressed={params.get("pool") === "1"}
            className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
              params.get("pool") === "1"
                ? "border-violeta/40 bg-violeta/15 text-violeta"
                : "border-borda bg-painel-claro text-texto-sec hover:text-texto"
            }`}
          >
            Pool da Hana
          </button>
        )}

        {ativos > 0 && (
          <Button variant="ghost" size="sm" onClick={onLimpar}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar ({ativos})
          </Button>
        )}
      </div>
    </div>
  );
}
