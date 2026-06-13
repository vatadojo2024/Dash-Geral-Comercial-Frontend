import { Lock } from "lucide-react";
import type { LeadDetail } from "@/lib/api/contracts";
import { BLOCO_LABEL } from "@/lib/formatters/score";
import { ScoreBadge } from "./Badges";

// Os 5 blocos REAIS do score (momento/25, fit/20, urgência/25, engajamento/20,
// timing/10) em barras, + a trava (teto) quando aplicada.
export function LeadScoreBlocks({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl bg-noite/60 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-texto-sec">
            Score final
          </p>
          {lead.trava_aplicada && (
            <p className="text-xs text-texto-sec">
              bruto {lead.score_bruto} → final {lead.score_final} (trava)
            </p>
          )}
        </div>
        <ScoreBadge final={lead.score_final} bruto={lead.score_bruto} size="lg" />
      </div>

      {lead.score_breakdown.trava && (
        <div className="flex items-start gap-2 rounded-xl border border-laranja/30 bg-laranja/10 px-4 py-3 text-sm text-laranja">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              Trava aplicada — teto {lead.score_breakdown.trava.teto}
            </p>
            <p className="text-laranja/90">{lead.score_breakdown.trava.motivo}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {lead.score_breakdown.blocos.map((bloco) => {
          const pct = bloco.teto > 0 ? (bloco.pontos / bloco.teto) * 100 : 0;
          return (
            <div key={bloco.bloco}>
              <div className="mb-1 flex items-baseline justify-between">
                <p className="text-sm font-medium text-texto">
                  {BLOCO_LABEL[bloco.bloco] ?? bloco.bloco}
                </p>
                <p className="text-sm tabular-nums text-texto-sec">
                  <span className="font-semibold text-texto">{bloco.pontos}</span> / {bloco.teto}
                </p>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-borda/40"
                role="progressbar"
                aria-valuenow={bloco.pontos}
                aria-valuemin={0}
                aria-valuemax={bloco.teto}
                aria-label={`${BLOCO_LABEL[bloco.bloco]}: ${bloco.pontos} de ${bloco.teto}`}
              >
                <div
                  className="h-full rounded-full bg-azul"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {bloco.itens.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between text-xs text-texto-sec"
                  >
                    <span>{item.label}</span>
                    <span className="tabular-nums font-medium text-texto-sec">
                      {item.pontos > 0 ? `+${item.pontos}` : item.pontos}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
