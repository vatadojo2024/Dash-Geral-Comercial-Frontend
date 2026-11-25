import { UserX } from "lucide-react";
import { rotuloData, taxa, tiersDoEvento, type Evento } from "@/lib/eventos/comparativo";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { TextoTaxa } from "./Pecas";

// ---------------------------------------------------------------------------
// Presentes por tier do evento selecionado, com o destaque "SMQL ou acima"
// (SMQL + HMQL + UMQL + UMQL+). Presença não medida → aviso, nunca zeros.
// ---------------------------------------------------------------------------

export function TiersDoEvento({ evento }: { evento: Evento }) {
  const t = tiersDoEvento(evento);
  const aprox = evento.modo_presenca === "aproximado";
  const titulo = `Presentes por tier · ${rotuloData(evento.data_evento)}`;

  if (!t) {
    return (
      <Card>
        <CardHeader title={titulo} />
        <EmptyState icon={UserX} titulo="Presença não medida neste evento" descricao="Sem a presença, não há como dividir os presentes por tier." />
      </Card>
    );
  }

  const maior = Math.max(1, ...t.linhas.map((l) => l.n));
  return (
    <Card>
      <CardHeader title={titulo} subtitle={aprox ? "Presença aproximada neste evento." : undefined} />
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-xl border border-violeta/40 bg-violeta/10 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">SMQL ou acima</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-texto">
              {aprox ? "≈ " : ""}
              {t.smqlOuAcima.toLocaleString("pt-BR")}
            </span>
            <span className="text-sm">
              <TextoTaxa taxa={t.taxaSmqlOuAcima} aproximado={aprox} className="font-medium text-texto" />{" "}
              <span className="opacity-70">dos presentes</span>
            </span>
          </p>
        </div>
        <ul className="space-y-1.5">
          {t.linhas.map((l) => (
            <li key={l.tier} className="grid grid-cols-[72px_1fr_88px] items-center gap-2 text-xs">
              <span className={cn("font-medium", l.smqlOuAcima ? "text-violeta" : "text-texto-sec")}>{l.rotulo}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/5">
                <span
                  className={cn("block h-full rounded-full", l.smqlOuAcima ? "bg-violeta/70" : "bg-white/25")}
                  style={{ width: `${(l.n / maior) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-texto">
                {l.n.toLocaleString("pt-BR")} <span className="opacity-60"><TextoTaxa taxa={taxa(l.n, t.total)} /></span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
