"use client";

import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { AlertaBadge, ScoreBadge } from "@/components/domain/Badges";

// Ações recomendadas (6.1.3): lista curta derivada dos leads visíveis no
// recorte atual — proxima_acao + nome + score + alerta, por score desc.
export function AcoesRecomendadas({
  leads,
  contexto,
}: {
  leads: LeadListItem[];
  contexto: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Ações recomendadas"
        subtitle={`O que atacar primeiro — ${contexto}`}
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={Zap}
          titulo="Nenhuma ação recomendada"
          descricao="Não há leads ativos no recorte atual."
        />
      ) : (
        <CardContent className="space-y-2">
          {leads.map((l) => (
            <Link
              key={l.lead_id}
              href={`/leads/${l.lead_id}`}
              className="flex items-center gap-3 rounded-lg border border-borda/60 bg-noite/40 px-3 py-2.5 transition-colors hover:border-azul/60"
            >
              <Zap className="h-4 w-4 shrink-0 text-laranja" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-texto">
                  {l.proxima_acao}
                  <span className="text-texto-sec"> — {l.nome_exibicao}</span>
                </p>
                {l.alertas.length > 0 && (
                  <span className="mt-1 inline-flex flex-wrap gap-1">
                    {l.alertas.slice(0, 2).map((a) => (
                      <AlertaBadge key={a} alerta={a} size="sm" />
                    ))}
                  </span>
                )}
              </div>
              <ScoreBadge final={l.score_final} />
              <ChevronRight className="h-4 w-4 shrink-0 text-texto-sec/50" aria-hidden />
            </Link>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
