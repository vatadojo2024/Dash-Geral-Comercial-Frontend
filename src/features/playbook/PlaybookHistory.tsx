"use client";

import { FileText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { tempoRelativo } from "@/lib/formatters/date";
import { cn } from "@/lib/utils/cn";
import type { PlaybookJob, PlaybookStatus } from "./tipos";

const STATUS_BADGE: Record<PlaybookStatus, { label: string; classe: string }> = {
  pendente: { label: "Na fila", classe: "border-borda bg-painel-claro text-texto-sec" },
  processando: { label: "Processando", classe: "border-azul/30 bg-azul/15 text-azul-claro" },
  pronto: { label: "Pronto", classe: "border-verde/30 bg-verde/15 text-verde" },
  erro: { label: "Erro", classe: "border-rosa/30 bg-rosa/15 text-rosa" },
};

function rotuloJob(job: PlaybookJob): string {
  return job.lead_email || job.lead_telefone || job.origem_arquivo || "Playbook";
}

// Histórico (T-06): lista os playbooks do usuário (mais recente primeiro vindo do
// serviço); clicar reabre; apagar remove.
export function PlaybookHistory({
  jobs,
  carregando,
  erro,
  apagandoId,
  onAbrir,
  onApagar,
}: {
  jobs: PlaybookJob[];
  carregando: boolean;
  erro: boolean;
  apagandoId: string | null;
  onAbrir: (job: PlaybookJob) => void;
  onApagar: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader title="Histórico" subtitle="Seus playbooks anteriores." />
      <CardContent className="space-y-2">
        {carregando ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
        ) : erro ? (
          <p className="py-4 text-center text-sm text-texto-sec">
            Não foi possível carregar o histórico.
          </p>
        ) : jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-texto-sec">
            Nenhum playbook ainda. Gere o primeiro acima.
          </p>
        ) : (
          jobs.map((job) => {
            const badge = STATUS_BADGE[job.status];
            return (
              <div
                key={job.id}
                className="group flex items-center gap-2 rounded-lg border border-borda/60 bg-noite/30 transition-colors hover:border-azul/50"
              >
                <button
                  type="button"
                  onClick={() => onAbrir(job)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                >
                  <FileText className="h-4 w-4 shrink-0 text-texto-sec" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto">{rotuloJob(job)}</p>
                    {job.atualizado_em && (
                      <p className="text-xs text-texto-sec">{tempoRelativo(job.atualizado_em)}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      badge.classe,
                    )}
                  >
                    {badge.label}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onApagar(job.id)}
                  disabled={apagandoId === job.id}
                  aria-label="Apagar playbook"
                  className="mr-1 rounded-md p-1.5 text-texto-sec/60 opacity-0 transition-opacity hover:bg-rosa/15 hover:text-rosa focus:opacity-100 group-hover:opacity-100 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
