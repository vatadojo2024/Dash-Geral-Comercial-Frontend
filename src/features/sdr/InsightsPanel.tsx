import { Lightbulb } from "lucide-react";
import type { Insight } from "@/lib/sdr/insights";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";

// 6.4c — lista de insights automáticos com marcador colorido por tipo.
const TIPO_CONFIG: Record<Insight["tipo"], { rotulo: string; dot: string; chip: string }> = {
  risco: { rotulo: "Risco", dot: "bg-rosa", chip: "bg-rosa/15 text-rosa border-rosa/30" },
  destaque: { rotulo: "Destaque", dot: "bg-verde", chip: "bg-verde/15 text-verde border-verde/30" },
  acao: { rotulo: "Ação", dot: "bg-laranja", chip: "bg-laranja/15 text-laranja border-laranja/30" },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader
        title="Insights do mês"
        subtitle="Gerados automaticamente a partir das métricas dos SDRs"
      />
      {insights.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          titulo="Nenhum insight para este mês"
          descricao="Quando houver dados suficientes, os destaques, riscos e ações aparecem aqui."
        />
      ) : (
        <CardContent className="space-y-2">
          {insights.map((insight, i) => {
            const cfg = TIPO_CONFIG[insight.tipo];
            return (
              <div
                key={`${insight.tipo}-${i}`}
                className="flex items-start gap-3 rounded-lg border border-borda/60 bg-noite/40 px-3 py-2.5"
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", cfg.dot)} aria-hidden />
                <p className="flex-1 text-sm text-texto">{insight.texto}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    cfg.chip,
                  )}
                >
                  {cfg.rotulo}
                </span>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
