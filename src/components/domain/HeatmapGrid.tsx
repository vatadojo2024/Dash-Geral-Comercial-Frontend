"use client";

import {
  GRUPOS_ETAPA_HEATMAP,
  TEMPERATURA_CONFIG,
  TEMPERATURAS_ORDENADAS,
} from "@/lib/formatters/score";
import type { Temperatura } from "@/lib/api/contracts";
import type { CelulaHeatmap, Heatmap } from "@/features/dashboard/derivacoes";
import { rgb, useThemeColors, type CorToken } from "@/features/theme/useThemeColors";

// Mapeia a temperatura (enum com "_") para o token de cor (com "-")
const TOKEN_POR_TEMPERATURA: Record<Temperatura, CorToken> = {
  muito_quente: "muito-quente",
  quente: "quente",
  morno_alto: "morno-alto",
  morno_baixo: "morno-baixo",
  frio: "frio",
  congelado: "congelado",
};

// Heatmap temperatura (linhas) × etapas AGRUPADAS (colunas) — decisão Vata 3.1.4.
// Iteração 2 (6.1): clicar numa célula NÃO navega — seleciona o recorte e o
// orquestrador abre a listagem lateral.
export function HeatmapGrid({
  heatmap,
  selecionada,
  onSelect,
}: {
  heatmap: Heatmap;
  selecionada: { temperatura: string; grupoId: string } | null;
  onSelect: (celula: CelulaHeatmap) => void;
}) {
  const cores = useThemeColors();
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[620px] gap-1.5"
        style={{ gridTemplateColumns: "110px repeat(6, 1fr)" }}
        role="grid"
        aria-label="Mapa de calor: temperatura por etapa"
      >
        <div className="flex items-end px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-texto-sec/70">
          Temp. × Etapa
        </div>
        {GRUPOS_ETAPA_HEATMAP.map((g) => (
          <div
            key={g.id}
            className="flex items-end justify-center pb-1 text-center text-[11px] font-semibold text-texto-sec"
          >
            {g.label}
          </div>
        ))}

        {TEMPERATURAS_ORDENADAS.map((temp) => {
          const cfg = TEMPERATURA_CONFIG[temp];
          const Icon = cfg.icon;
          return (
            <div key={temp} className="contents">
              <div className={`flex items-center gap-1.5 px-1 text-xs font-medium ${cfg.text}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {cfg.label}
              </div>
              {heatmap.celulas
                .filter((c) => c.temperatura === temp)
                .map((c) => {
                  const intensidade =
                    heatmap.maxTotal > 0 ? c.total / heatmap.maxTotal : 0;
                  const vazia = c.total === 0;
                  const ativa =
                    selecionada?.temperatura === temp && selecionada?.grupoId === c.grupo.id;
                  return (
                    <button
                      key={`${temp}-${c.grupo.id}`}
                      disabled={vazia}
                      onClick={() => onSelect(c)}
                      aria-pressed={ativa}
                      title={
                        vazia
                          ? `${cfg.label} · ${c.grupo.label}: sem leads`
                          : `${cfg.label} · ${c.grupo.label}: ${c.total} lead(s), score médio ${c.scoreMedio}. Clique para ver a lista ao lado.`
                      }
                      aria-label={`${cfg.label}, ${c.grupo.label}: ${c.total} leads`}
                      className={`flex h-16 flex-col items-center justify-center rounded-lg border transition-shadow ${
                        vazia
                          ? "cursor-default border-borda/30 bg-painel-claro/40 text-texto-sec/40"
                          : ativa
                            ? "border-azul-claro ring-2 ring-azul"
                            : "border-transparent hover:ring-2 hover:ring-borda"
                      }`}
                      style={
                        vazia
                          ? undefined
                          : {
                              backgroundColor: rgb(
                                cores[TOKEN_POR_TEMPERATURA[temp]],
                                0.16 + intensidade * 0.55,
                              ),
                            }
                      }
                    >
                      <span
                        className={`text-lg font-bold tabular-nums ${vazia ? "" : "text-texto"}`}
                      >
                        {c.total}
                      </span>
                      {!vazia && (
                        <span className="text-[10px] text-texto/70">média {c.scoreMedio}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-borda/60 pt-3">
        {TEMPERATURAS_ORDENADAS.map((t) => {
          const cfg = TEMPERATURA_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <span key={t} className={`inline-flex items-center gap-1 text-[11px] ${cfg.text}`}>
              <Icon className="h-3 w-3" aria-hidden />
              {cfg.label} ({cfg.faixa})
            </span>
          );
        })}
      </div>
    </div>
  );
}
