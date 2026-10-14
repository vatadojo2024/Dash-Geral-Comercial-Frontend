"use client";

import Link from "next/link";
import { AlarmClock, HeartPulse, Megaphone, RefreshCw, ShieldAlert, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { Simular } from "@/lib/educacional/apiEducacional";
import type { ResumoEducacional, Sinal } from "@/lib/educacional/contrato";
import { ROTULO_ETAPA, TITULO_SINAL } from "@/lib/educacional/rotulos";
import { KpiChip } from "@/features/sdr/KpiChip";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { hrefDoFiltro, type EstadoTabela } from "./estado";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Cockpit (spec, seção 4): 4 KPIs, Funil da Jornada e Sinais para o Comercial,
// todos lidos do ResumoEducacional. Cliques preenchem os filtros da Tabela
// tática (via URL) e descem até ela. Nada aqui é calculado: contagens e score
// vêm prontos; só a LARGURA das barras é proporcional à maior etapa.
// ---------------------------------------------------------------------------

const ICONE_SINAL: Record<Sinal, LucideIcon> = { upgrade: TrendingUp, renovacao: RefreshCw, prova_social: Megaphone };

type Props = {
  resumo: ResumoEducacional | undefined;
  carregando: boolean;
  erro: unknown;
  onTentarDeNovo: () => void;
  estado: EstadoTabela;
  simular: Simular;
};

export function Cockpit({ resumo, carregando, erro, onTentarDeNovo, estado, simular }: Props) {
  if (carregando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando o cockpit">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (erro || !resumo) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar o cockpit"
          descricao={mensagemDoErro(erro)}
          onRetry={onTentarDeNovo}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }

  const k = resumo.kpis;
  const link = (filtro: Partial<EstadoTabela>) => hrefDoFiltro(estado, filtro, simular);
  const limpar = link({}); // sem filtros, mantendo a visão
  const maiorEtapa = Math.max(1, ...resumo.funil.map((f) => f.alunos));
  const semAlunos = k.alunos_ativos === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiChip
          icon={HeartPulse}
          rotulo="Health Score médio"
          valor={semAlunos ? "—" : String(k.health_score_medio)}
          detalhe="Saúde geral da turma"
        />
        <KpiChip icon={Users} rotulo="Alunos ativos" valor={String(k.alunos_ativos)} detalhe="Na jornada atual" href={limpar} />
        <KpiChip
          icon={AlarmClock}
          rotulo="Intervenções SLA"
          valor={String(k.intervencoes_sla)}
          detalhe="Checkpoint pendente ou sem resposta"
          href={link({ checkpoint: ["pendente", "nao_respondeu"] })}
          destaque={k.intervencoes_sla > 0}
        />
        <KpiChip
          icon={ShieldAlert}
          rotulo="Em risco"
          valor={String(k.em_risco)}
          detalhe="Health Score abaixo de 50"
          href={link({ health_max: 50 })}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Funil da Jornada Educacional"
            subtitle="Alunos atualmente em cada etapa. Clique numa etapa para ver os alunos na tabela."
          />
          <CardContent>
            {semAlunos ? (
              <EmptyState titulo="Nenhum aluno na jornada" descricao="Quando houver alunos ativos, eles aparecem por etapa aqui." />
            ) : (
              <ol className="space-y-3">
                {resumo.funil.map((f, i) => (
                  <li key={f.etapa}>
                    <Link
                      href={link({ etapa: f.etapa })}
                      className={cn(
                        "group block rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]",
                        estado.etapa === f.etapa && "bg-azul/10 ring-1 ring-azul/40",
                      )}
                    >
                      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-texto">
                          <span className="mr-2 text-xs tabular-nums text-texto-sec">{i + 1}</span>
                          {ROTULO_ETAPA[f.etapa]}
                        </span>
                        <span className="font-semibold tabular-nums text-texto">
                          {f.alunos} <span className="text-xs font-normal text-texto-sec">{f.alunos === 1 ? "aluno" : "alunos"}</span>
                        </span>
                      </span>
                      <span className="block h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                        <span
                          className="block h-full rounded-full bg-azul/70 transition-[width] group-hover:bg-azul"
                          style={{ width: `${(f.alunos / maiorEtapa) * 100}%` }}
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Sinais para o Comercial" subtitle="Clique num sinal para ver os alunos na tabela." />
          <CardContent className="flex flex-1 flex-col gap-3">
            {(["upgrade", "renovacao", "prova_social"] as const).map((s) => {
              const Icone = ICONE_SINAL[s];
              return (
                <Link
                  key={s}
                  href={link({ sinal: s })}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:border-white/25 hover:bg-white/10",
                    estado.sinal === s && "border-azul/50 bg-azul/10",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-forte/20 text-info">
                    <Icone className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-texto">{TITULO_SINAL[s]}</span>
                  <span className="text-lg font-semibold tabular-nums text-texto">{resumo.sinais[s]}</span>
                </Link>
              );
            })}
            <p className="mt-auto border-t border-white/10 pt-3 text-[11px] leading-snug text-texto-sec">
              Exemplo de regra: Big Win realizado + etapa Validação → card automático para Closers
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
