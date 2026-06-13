import Link from "next/link";
import { ArrowRight, Lightbulb, MessageSquareText } from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { tempoRelativo } from "@/lib/formatters/date";
import { nomeDoUsuario } from "@/lib/mock/users";
import {
  AlertaBadge,
  EtapaBadge,
  HanaBadge,
  ScoreBadge,
  TemperatureBadge,
  TravaBadge,
} from "./Badges";

export function LeadPriorityCard({
  item,
  rank,
  mostrarDonos,
}: {
  item: LeadListItem;
  rank: number;
  mostrarDonos: boolean;
}) {
  return (
    <Link
      href={`/leads/${item.lead_id}`}
      className="block rounded-xl border border-borda bg-painel p-4 shadow-sm transition-colors hover:border-azul/60"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-painel-claro text-xs font-semibold text-texto-sec">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-texto">
                {item.nome_exibicao}
              </p>
              <p className="text-xs text-texto-sec/80">
                {item.lead_id} · score calculado {tempoRelativo(item.score_calculated_at)}
                {mostrarDonos && item.closer_id && <> · closer {nomeDoUsuario(item.closer_id)}</>}
                {mostrarDonos && item.sdr_id && <> · SDR {nomeDoUsuario(item.sdr_id)}</>}
              </p>
            </div>
            <ScoreBadge final={item.score_final} bruto={item.score_bruto} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TemperatureBadge temperatura={item.temperatura} size="sm" />
            <EtapaBadge etapa={item.etapa_atual} size="sm" />
            {item.sdr_pool && <HanaBadge size="sm" />}
            {item.trava_aplicada && <TravaBadge trava={item.trava_aplicada} size="sm" />}
          </div>

          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-start gap-2 text-texto">
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-texto-sec" aria-hidden />
              <span>
                <span className="font-medium text-texto-sec">Motivo: </span>
                {item.motivo_curto}
              </span>
            </p>
            <p className="flex items-start gap-2 text-texto">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-laranja" aria-hidden />
              <span>
                <span className="font-medium text-texto-sec">Próxima ação: </span>
                {item.proxima_acao}
              </span>
            </p>
          </div>

          {item.alertas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.alertas.map((a) => (
                <AlertaBadge key={a} alerta={a} size="sm" />
              ))}
            </div>
          )}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-texto-sec/40" aria-hidden />
      </div>
    </Link>
  );
}
