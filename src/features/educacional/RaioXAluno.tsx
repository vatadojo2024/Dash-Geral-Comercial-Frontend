"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, Flag, Plus, Star } from "lucide-react";
import { buscarAluno, EducacionalError } from "@/lib/educacional/apiEducacional";
import { NIVEIS_RISCO, PASSOS, type AlunoDetalhe, type Checkpoint } from "@/lib/educacional/contrato";
import {
  dataCurta,
  dataHoraBr,
  reais,
  ROTULO_ETAPA,
  ROTULO_FINANCEIRO,
  ROTULO_NIVEL,
  ROTULO_PASSO,
  ROTULO_RISCO,
  ROTULO_SINAL,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_TIPO_INTERVENCAO,
  PONTO_DO_TOM,
  TOM_RISCO,
  TOM_STATUS_CHECKPOINT,
} from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { lerSimular } from "./estado";
import { NovaIntervencao } from "./NovaIntervencao";
import { BadgeCheckpoint, EtiquetaDemonstracao, mensagemDoErro, NomeResponsavel, Risco, useRedirecionarSeSemPermissao } from "./partes";

// ---------------------------------------------------------------------------
// Raio-X do aluno (spec, seção 6) — página /educacional/alunos/[id]. Blocos na
// ordem da spec. "Voltar" devolve a Tabela tática exatamente como estava
// (filtros, ordem, página e visão vêm em `?voltar=`).
// ---------------------------------------------------------------------------

const BIG_WIN = "Mês 3 — Big Win";

export function RaioXAluno({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const simular = lerSimular(searchParams);
  const voltar = searchParams.get("voltar");
  const hrefVoltar = `/educacional${voltar ? `?${voltar}` : ""}#tabela-tatica`;
  const [modalAberto, setModalAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey: ["edu", "aluno", id, simular],
    queryFn: () => buscarAluno(id, simular),
    retry: false,
  });
  const semPermissao = useRedirecionarSeSemPermissao([consulta.error]);
  if (semPermissao) return null;

  const a = consulta.data;
  const naoEncontrado = consulta.error instanceof EducacionalError && consulta.error.status === 404;

  return (
    <>
      <Link href={hrefVoltar} className="mb-4 inline-flex items-center gap-1.5 text-sm text-texto-sec hover:text-texto">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para a tabela
      </Link>

      {consulta.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando o raio-X">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : naoEncontrado ? (
        <Card>
          <EmptyState titulo="Aluno não encontrado" descricao="Ele pode ter saído da jornada. Volte para a tabela e escolha outro aluno." />
        </Card>
      ) : consulta.isError || !a ? (
        <Card>
          <ErrorState
            titulo="Não foi possível carregar o raio-X"
            descricao={mensagemDoErro(consulta.error)}
            onRetry={() => consulta.refetch()}
            retryLabel="Tentar de novo"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {aviso && (
            <p className="flex items-center gap-2 rounded-xl border border-sucesso-forte/30 bg-sucesso-forte/10 px-4 py-2.5 text-sm text-texto" role="status">
              <CircleCheck className="h-4 w-4 text-sucesso" aria-hidden />
              {aviso}
            </p>
          )}
          <Cabecalho a={a} onNovaIntervencao={() => setModalAberto(true)} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Indicadores a={a} />
            <Contrato a={a} />
            <SinaisAtivos a={a} />
          </div>
          <Timeline checkpoints={a.checkpoints} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Progresso a={a} />
            <Diagnostico a={a} />
          </div>
          <Intervencoes a={a} />
        </div>
      )}

      <NovaIntervencao
        aberto={modalAberto}
        alunoInicial={a ? { id: a.id, nome: a.nome } : null}
        onFechar={() => setModalAberto(false)}
        onCriada={() => setAviso("Intervenção registrada. Ela já aparece na lista abaixo.")}
      />
    </>
  );
}

// 1. Cabeçalho
function Cabecalho({ a, onNovaIntervencao }: { a: AlunoDetalhe; onNovaIntervencao: () => void }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Raio-X do aluno</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">{a.nome}</h1>
            <span className="tag">{a.status_geral}</span>
            <EtiquetaDemonstracao />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <Dado rotulo="Mentoria">{a.mentoria}</Dado>
            <Dado rotulo="Entrada">{dataCurta(a.data_entrada)}</Dado>
            <Dado rotulo="Término">{dataCurta(a.data_termino)}</Dado>
            <Dado rotulo="Nível inicial">{ROTULO_NIVEL[a.nivel_inicial]}</Dado>
          </dl>
          <p className="mt-3 text-sm">
            <span className="text-texto-sec">Objetivo: </span>
            <span className="text-texto">{a.objetivo ?? "Não informado"}</span>
          </p>
        </div>
        <Button size="sm" onClick={onNovaIntervencao} className="shrink-0">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova intervenção
        </Button>
      </div>
    </Card>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-texto-sec">{rotulo}</dt>
      <dd className="text-texto">{children}</dd>
    </div>
  );
}

// 2. Indicadores: Health Score, termômetro de risco, dias estagnados.
function Indicadores({ a }: { a: AlunoDetalhe }) {
  const emRisco = a.health_score < 50;
  return (
    <Card>
      <CardHeader title="Indicadores" />
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs text-texto-sec">Health Score</p>
          <p className={cn("text-4xl font-semibold tabular-nums", emRisco ? "text-erro" : "text-texto")}>
            {a.health_score}
            <span className="text-base font-normal text-texto-sec">/100</span>
          </p>
          {emRisco && <span className="tag tag-error mt-1">Risco de Evasão/Reembolso</span>}
        </div>
        <div>
          <p className="mb-1.5 text-xs text-texto-sec">Termômetro de risco</p>
          <div className="grid grid-cols-3 gap-1" role="img" aria-label={`Risco: ${ROTULO_RISCO[a.risco]}`}>
            {NIVEIS_RISCO.map((n) => (
              <span
                key={n}
                className={cn("h-2.5 rounded-full", PONTO_DO_TOM[TOM_RISCO[n]], a.risco === n ? "opacity-100 ring-2 ring-white/40" : "opacity-25")}
              />
            ))}
          </div>
          <Risco risco={a.risco} className="mt-1.5" />
        </div>
        <p className="text-sm text-texto">
          Há <span className="font-semibold tabular-nums">{a.dias_estagnados} {a.dias_estagnados === 1 ? "dia" : "dias"}</span> em{" "}
          {ROTULO_ETAPA[a.etapa_atual]}
        </p>
      </CardContent>
    </Card>
  );
}

// 3. Contrato
function Contrato({ a }: { a: AlunoDetalhe }) {
  const inadimplente = a.status_financeiro === "inadimplente";
  return (
    <Card>
      <CardHeader title="Contrato" />
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-texto-sec">Status financeiro</p>
          <span className={cn("tag mt-1", inadimplente ? "tag-error" : "tag-success")}>{ROTULO_FINANCEIRO[a.status_financeiro]}</span>
        </div>
        <div>
          <p className="text-xs text-texto-sec">LTV</p>
          <p className="text-2xl font-semibold tabular-nums text-texto">{reais(a.ltv)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// 8. Sinais ativos (fica ao lado dos indicadores no desktop)
function SinaisAtivos({ a }: { a: AlunoDetalhe }) {
  return (
    <Card>
      <CardHeader title="Sinais ativos" subtitle="Sinais para o Comercial em que o aluno está." />
      <CardContent>
        {a.sinais.length === 0 ? (
          <p className="text-sm text-texto-sec">Nenhum sinal ativo.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {a.sinais.map((s) => (
              <span key={s} className="tag tag-info">
                {ROTULO_SINAL[s]}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 4. Timeline de checkpoints (Dia 0 → Mês 6), Big Win com marca própria.
function Timeline({ checkpoints }: { checkpoints: Checkpoint[] }) {
  const ordenados = [...checkpoints].sort((x, y) => x.ordem - y.ordem);
  return (
    <Card>
      <CardHeader title="Timeline de checkpoints" subtitle="Do Dia 0 ao Mês 6, com a data prevista e o status de cada um." />
      <CardContent>
        {ordenados.length === 0 ? (
          <p className="text-sm text-texto-sec">Nenhum checkpoint registrado.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <ol className="relative flex min-w-[760px] justify-between">
              <span className="absolute left-4 right-4 top-4 h-px bg-white/15" aria-hidden />
              {ordenados.map((c) => {
                const bigWin = c.nome === BIG_WIN;
                const tom = TOM_STATUS_CHECKPOINT[c.status];
                const previsto = c.status === "previsto";
                return (
                  <li key={c.id} className="relative flex w-24 flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2",
                        previsto ? "border-dashed border-cinza-claro bg-painel" : ["border-painel", PONTO_DO_TOM[tom]],
                        bigWin && "h-9 w-9 ring-2 ring-amarelo/70 ring-offset-2 ring-offset-painel",
                      )}
                      title={ROTULO_STATUS_CHECKPOINT[c.status]}
                    >
                      {bigWin ? (
                        <Star className={cn("h-4 w-4", previsto ? "text-cinza-claro" : "text-noite")} aria-hidden />
                      ) : (
                        <Flag className={cn("h-3.5 w-3.5", previsto ? "text-cinza-claro" : "text-noite/80")} aria-hidden />
                      )}
                    </span>
                    <span className={cn("text-xs font-medium text-texto", bigWin && "text-amarelo")}>{c.nome}</span>
                    <span className="text-[11px] tabular-nums text-texto-sec">{dataCurta(c.data_prevista)}</span>
                    <BadgeCheckpoint status={c.status} />
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 5. Progresso metodológico + highlights das aulas.
function Progresso({ a }: { a: AlunoDetalhe }) {
  const atual = a.progresso_metodologico.passo_atual;
  const alcancado = atual ? PASSOS.indexOf(atual) : -1;
  return (
    <Card>
      <CardHeader title="Progresso metodológico" subtitle={`Na etapa atual: ${ROTULO_ETAPA[a.etapa_atual]}`} />
      <CardContent className="space-y-5">
        <ol className="grid grid-cols-4 gap-1.5" aria-label="Passos da etapa">
          {PASSOS.map((p, i) => (
            <li key={p} className="space-y-1.5">
              <span className={cn("block h-2 rounded-full", i <= alcancado ? "bg-sucesso" : "bg-white/10")} />
              <span className={cn("block text-center text-xs", i === alcancado ? "font-semibold text-texto" : i < alcancado ? "text-texto" : "text-texto-sec")}>
                {ROTULO_PASSO[p]}
              </span>
            </li>
          ))}
        </ol>
        {alcancado < 0 && <p className="text-xs text-texto-sec">Ainda sem passo registrado nesta etapa.</p>}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-sec">Highlights das aulas</p>
          {a.progresso_metodologico.highlights.length === 0 ? (
            <p className="text-sm text-texto-sec">Sem análises de aula disponíveis</p>
          ) : (
            <ul className="space-y-2">
              {a.progresso_metodologico.highlights.map((h, i) => (
                <li key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="mr-2 text-xs tabular-nums text-texto-sec">{dataCurta(h.data_aula)}</span>
                  <span className="text-texto">{h.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 6. Diagnóstico e próxima ação
function Diagnostico({ a }: { a: AlunoDetalhe }) {
  return (
    <Card>
      <CardHeader title="Diagnóstico e próxima ação" />
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-texto-sec">Diagnóstico</p>
          <p className="mt-0.5 text-texto">{a.diagnostico ?? <span className="text-texto-sec">Sem diagnóstico registrado.</span>}</p>
        </div>
        <div>
          <p className="text-xs text-texto-sec">Próxima ação</p>
          <p className="mt-0.5 text-texto">{a.proxima_acao?.descricao ?? <span className="text-texto-sec">Nenhuma ação definida.</span>}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Dado rotulo="Responsável">
            <NomeResponsavel responsavel={a.responsavel} />
          </Dado>
          <Dado rotulo="Prazo">{dataCurta(a.proxima_acao?.prazo)}</Dado>
        </dl>
      </CardContent>
    </Card>
  );
}

// 7. Intervenções (mais recente primeiro — a ordem vem do adapter).
function Intervencoes({ a }: { a: AlunoDetalhe }) {
  return (
    <Card>
      <CardHeader title="Intervenções" subtitle="Mais recente primeiro." />
      <CardContent>
        {a.intervencoes.length === 0 ? (
          <p className="text-sm text-texto-sec">Nenhuma intervenção registrada.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {a.intervencoes.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                <span className="tag shrink-0 self-start">{ROTULO_TIPO_INTERVENCAO[i.tipo]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-texto">{i.descricao}</p>
                  <p className="mt-0.5 text-xs text-texto-sec">
                    <NomeResponsavel responsavel={i.responsavel} /> · prazo {dataCurta(i.prazo)}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-texto-sec">{dataHoraBr(i.criada_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
