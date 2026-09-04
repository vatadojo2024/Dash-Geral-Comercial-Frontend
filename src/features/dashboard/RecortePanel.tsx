"use client";

import Link from "next/link";
import { Package, SearchX, X } from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import {
  AlertaBadge,
  EstrelaDestaque,
  HanaBadge,
  ScoreBadge,
  TemperatureBadge,
  TravaBadge,
} from "@/components/domain/Badges";

// Listagem lateral do heatmap (6.1.2): leads do recorte selecionado
// (célula ou card de resumo), com link para o detalhe.
export function RecortePanel({
  titulo,
  leads,
  onClose,
}: {
  titulo: string;
  leads: LeadListItem[];
  onClose: () => void;
}) {
  return (
    <Card className="flex max-h-[640px] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-borda/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
          <p className="mt-0.5 text-xs text-texto-sec">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} · por score
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar listagem do recorte"
          className="rounded-md p-1.5 text-texto-sec hover:bg-painel-claro hover:text-texto"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={SearchX}
          titulo="Nenhum lead neste recorte"
          descricao="Ajuste os filtros ou selecione outra célula do mapa."
        />
      ) : (
        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {leads.map((l) => (
            <Link
              key={l.lead_id}
              href={`/leads/${l.lead_id}`}
              className="block rounded-lg border border-borda/60 bg-noite/40 px-3 py-2.5 transition-colors hover:border-azul/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-texto">
                    {l.destaque && <EstrelaDestaque size="sm" />}
                    <span className="truncate">{l.nome_exibicao}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-texto-sec">
                    <Package className="h-3 w-3 shrink-0" aria-hidden />
                    {l.produto_sugerido ?? "Sem produto sugerido"}
                  </p>
                </div>
                <ScoreBadge final={l.score_final} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <TemperatureBadge temperatura={l.temperatura} size="sm" />
                {l.sdr_pool && <HanaBadge size="sm" />}
                {l.trava_aplicada && <TravaBadge trava={l.trava_aplicada} size="sm" />}
                {l.alertas.map((a) => (
                  <AlertaBadge key={a} alerta={a} size="sm" />
                ))}
              </div>
            </Link>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
