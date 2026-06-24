"use client";

import { AlertTriangle, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { FASES, type FasePlaybook } from "./tipos";

// Indicador das 3 fases (T-04). A fase atual vem do job (polling). Sem fase ainda
// (job recém-criado/pendente) tratamos como fase 1 em andamento.
function Fases({ faseAtual }: { faseAtual: FasePlaybook | null }) {
  const atual = faseAtual ?? 1;
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
      {FASES.map((f) => {
        const concluida = f.numero < atual;
        const ativa = f.numero === atual;
        return (
          <li
            key={f.numero}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
              concluida
                ? "border-verde/40 bg-verde/10"
                : ativa
                  ? "border-azul/50 bg-azul/10"
                  : "border-borda bg-painel-claro",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                concluida
                  ? "bg-verde/20 text-verde"
                  : ativa
                    ? "bg-azul/20 text-azul-claro"
                    : "bg-borda/50 text-texto-sec",
              )}
            >
              {concluida ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : ativa ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                f.numero
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-texto-sec/70">
                Fase {f.numero}
              </p>
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  ativa || concluida ? "text-texto" : "text-texto-sec",
                )}
              >
                {f.titulo}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PlaybookProcessando({ faseAtual }: { faseAtual: FasePlaybook | null }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-texto">
          <Loader2 className="h-4 w-4 animate-spin text-azul-claro" aria-hidden />
          Gerando o playbook…
        </div>
        <Fases faseAtual={faseAtual} />
        <p className="text-xs text-texto-sec">
          Isso leva alguns minutos — pode acompanhar por aqui ou voltar depois (a geração continua).
        </p>
      </CardContent>
    </Card>
  );
}

export function PlaybookErro({
  mensagem,
  onTentar,
}: {
  mensagem?: string | null;
  onTentar: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rosa/15">
          <AlertTriangle className="h-6 w-6 text-rosa" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-texto">Não foi possível gerar o playbook</p>
        {mensagem && <p className="max-w-md text-sm text-texto-sec">{mensagem}</p>}
        <Button variant="outline" size="sm" onClick={onTentar}>
          Tentar de novo
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlaybookTempoEsgotado({ onReenviar }: { onReenviar: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amarelo/15">
          <Clock className="h-6 w-6 text-amarelo" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-texto">Tempo esgotado</p>
        <p className="max-w-md text-sm text-texto-sec">
          A geração demorou mais que o esperado (o serviço pode ter reiniciado). Você pode reenviar.
        </p>
        <Button variant="outline" size="sm" onClick={onReenviar}>
          Reenviar
        </Button>
      </CardContent>
    </Card>
  );
}
