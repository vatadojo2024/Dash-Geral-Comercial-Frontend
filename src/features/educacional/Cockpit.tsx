"use client";

import Link from "next/link";
import { AlarmClock, HeartPulse, Megaphone, RefreshCw, ShieldAlert, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { Simular } from "@/lib/educacional/apiEducacional";
import type { ResumoEducacional, Sinal } from "@/lib/educacional/contrato";
import { TITULO_SINAL } from "@/lib/educacional/rotulos";
import { KpiChip } from "@/features/sdr/KpiChip";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { hrefDoFiltro, type EstadoTabela } from "./estado";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Cockpit (spec, seção 4): 4 KPIs, Funil da Jornada e Sinais para o Comercial,
// todos lidos do ResumoEducacional. Cliques abrem a aba Alunos já filtrada
// (Fase 3, 3.2). Nada aqui é calculado: contagens e score vêm prontos; só a
// LARGURA das barras é proporcional à maior etapa.
// ---------------------------------------------------------------------------

const ICONE_SINAL: Record<Sinal, LucideIcon> = { upgrade: TrendingUp, renovacao: RefreshCw, prova_social: Megaphone };

type Props = {
  resumo: ResumoEducacional | undefined;
  carregando: boolean;
  erro: unknown;
  onTentarDeNovo: () => void;
  simular: Simular;
};

// Enquanto carrega, o Cockpit aparece com a MESMA estrutura (cards, títulos,
// 5 etapas e 3 sinais) e os valores em branco pulsando: a altura é a mesma da
// tela carregada, em qualquer largura, e nada abaixo dele se desloca (CLS).
const VAZIO = "\u00a0";
const ETAPAS_CARREGANDO = Array.from({ length: 5 }, (_, i) => ({ etapa_id: `carregando-${i}`, nome: VAZIO, alunos: 0 }));

export function Cockpit({ resumo, carregando, erro, onTentarDeNovo, simular }: Props) {
  if (!carregando && (erro || !resumo)) {
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

  const r = carregando ? null : resumo!;
  const k = r?.kpis;
  const link = (filtro: Partial<EstadoTabela>) => hrefDoFiltro(filtro, simular);
  const limpar = link({}); // sem filtros
  const funil = r ? r.funil : ETAPAS_CARREGANDO;
  const maiorEtapa = Math.max(1, ...funil.map((f) => f.alunos));
  const semAlunos = !!k && k.alunos_ativos === 0;
  const pulsando = carregando ? "animate-pulse" : undefined;
  const numero = (n: number | undefined) => (n == null ? VAZIO : String(n));

  return (
    <div className="space-y-4" aria-busy={carregando || undefined} aria-label={carregando ? "Carregando o cockpit" : undefined}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiChip
          icon={HeartPulse}
          rotulo="Health Score médio"
          valor={!k ? VAZIO : semAlunos || k.health_score_medio == null ? "—" : String(k.health_score_medio)}
          detalhe="Saúde geral da turma"
          className={pulsando}
        />
        <KpiChip icon={Users} rotulo="Alunos ativos" valor={numero(k?.alunos_ativos)} detalhe="Na jornada atual" href={limpar} className={pulsando} />
        <KpiChip
          icon={AlarmClock}
          rotulo="Intervenções SLA"
          valor={numero(k?.intervencoes_sla)}
          detalhe="Checkpoint pendente ou sem resposta"
          href={link({ checkpoint: ["pendente", "nao_respondeu"] })}
          destaque={!!k && k.intervencoes_sla > 0}
          className={pulsando}
        />
        <KpiChip
          icon={ShieldAlert}
          rotulo="Em risco"
          valor={numero(k?.em_risco)}
          detalhe="Faixa de saúde Risco"
          href={link({ risco: "risco" })}
          className={pulsando}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Funil da Jornada Educacional"
            subtitle="Alunos atualmente em cada etapa. Clique numa etapa para ver os alunos."
          />
          <CardContent>
            {semAlunos ? (
              <EmptyState titulo="Nenhum aluno na jornada" descricao="Quando houver alunos ativos, eles aparecem por etapa aqui." />
            ) : (
              <ol className={cn("space-y-3", pulsando)}>
                {funil.map((f, i) => (
                  <li key={f.etapa_id}>
                    <Link
                      href={link({ etapa: f.etapa_id })}
                      tabIndex={carregando ? -1 : undefined}
                      className={cn(
                        "group block rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]",
                        carregando && "pointer-events-none",
                      )}
                    >
                      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-texto">
                          <span className="mr-2 text-xs tabular-nums text-texto-sec">{i + 1}</span>
                          {f.nome}
                        </span>
                        <span className="font-semibold tabular-nums text-texto">
                          {carregando ? (
                            VAZIO
                          ) : (
                            <>
                              {f.alunos} <span className="text-xs font-normal text-texto-sec">{f.alunos === 1 ? "aluno" : "alunos"}</span>
                            </>
                          )}
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
          <CardHeader title="Sinais para o Comercial" subtitle="Clique num sinal para ver os alunos." />
          <CardContent className={cn("flex flex-1 flex-col gap-3", pulsando)}>
            {(["upgrade", "renovacao", "prova_social"] as const).map((s) => {
              const Icone = ICONE_SINAL[s];
              return (
                <Link
                  key={s}
                  href={link({ sinal: s })}
                  tabIndex={carregando ? -1 : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:border-white/25 hover:bg-white/10",
                    carregando && "pointer-events-none",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-forte/20 text-info">
                    <Icone className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-texto">{TITULO_SINAL[s]}</span>
                  <span className="text-lg font-semibold tabular-nums text-texto">{r ? r.sinais[s] : VAZIO}</span>
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
