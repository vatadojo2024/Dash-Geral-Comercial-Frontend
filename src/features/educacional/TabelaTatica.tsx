"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { buscarAlunos, TAMANHO_PAGINA, type ChaveOrdem, type OrdemAlunos, type Simular } from "@/lib/educacional/apiEducacional";
import { FAIXAS_SAUDE, SINAIS, STATUS_CHECKPOINT, type AlunoLinha, type Etapa } from "@/lib/educacional/contrato";
import { ROTULO_FAIXA, ROTULO_NIVEL, ROTULO_SINAL, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { descreverFiltros, queryDoEstado, semFiltros, temFiltro, type EstadoTabela, type Visao } from "./estado";
import { ativos, CHAVES, etapasAtivas, useConfig } from "./dados";
import { BadgeCheckpoint, Faixa, mensagemDoErro, NomeResponsavel, useRedirecionarSeSemPermissao } from "./partes";

// ---------------------------------------------------------------------------
// Tabela tática (spec, seção 5). A lista vem do adapter já filtrada, ordenada
// e paginada (parâmetros da seção 8.3); a tela só desenha. Clique na linha ou
// no card abre o Raio-X, que volta para esta mesma URL.
// ---------------------------------------------------------------------------

const SLA = "pendente,nao_respondeu";

const COLUNAS: { rotulo: string; campo: ChaveOrdem }[] = [
  { rotulo: "Aluno", campo: "nome" },
  { rotulo: "Nível inicial", campo: "nivel_inicial" },
  { rotulo: "Etapa atual", campo: "etapa" },
  { rotulo: "Checkpoint", campo: "checkpoint" },
  { rotulo: "Dias na etapa", campo: "dias_na_etapa" },
  { rotulo: "Faixa de saúde", campo: "faixa_saude" },
  { rotulo: "Próxima ação", campo: "proxima_acao" },
  { rotulo: "Responsável", campo: "responsavel" },
];

type Props = {
  estado: EstadoTabela;
  simular: Simular;
  onMudar: (novo: EstadoTabela) => void;
};

export function TabelaTatica({ estado, simular, onMudar }: Props) {
  const router = useRouter();
  const kanban = estado.visao === "kanban";
  // Kanban sem paginação (Q3: por_pagina=todos).
  const filtros = { ...estado, ...(kanban ? { pagina: 1, por_pagina: "todos" as const } : {}) };
  const lista = useQuery({
    queryKey: [...CHAVES.alunos, filtros, simular],
    queryFn: () => buscarAlunos(filtros, simular),
    retry: false,
  });
  const config = useConfig();
  useRedirecionarSeSemPermissao([lista.error, config.error]);
  const etapas = etapasAtivas(config.data);
  const responsaveis = ativos(config.data?.responsaveis);

  const voltar = queryDoEstado(estado, simular);
  const abrir = (a: AlunoLinha) =>
    router.push(`/educacional/alunos/${encodeURIComponent(a.id)}${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ""}`);
  const hrefDoAluno = (a: AlunoLinha) =>
    `/educacional/alunos/${encodeURIComponent(a.id)}${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ""}`;

  const mudar = (parcial: Partial<EstadoTabela>) => onMudar({ ...estado, ...parcial, pagina: parcial.pagina ?? 1 });
  const ordenar = (campo: ChaveOrdem) => {
    const atual = estado.ordem;
    const novo = atual === campo ? (`-${campo}` as OrdemAlunos) : atual === `-${campo}` ? campo : campo;
    mudar({ ordem: novo });
  };

  const descricao = descreverFiltros(estado, {
    etapa: (id) => config.data?.etapas.find((e) => e.id === id)?.nome,
    responsavel: (id) => config.data?.responsaveis.find((r) => r.id === id)?.nome,
  });
  const total = lista.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const valorCheckpoint = estado.checkpoint?.join(",") ?? "";

  return (
    <Card id="tabela-tatica" className="scroll-mt-20">
      <CardHeader
        title="Acompanhamento tático · clique em um aluno para abrir o raio-X"
        action={
          <Alternador<Visao>
            rotulo="Visualização da tabela"
            valor={estado.visao}
            onChange={(v) => onMudar({ ...estado, visao: v })}
            opcoes={[
              { valor: "lista", label: "Lista" },
              { valor: "kanban", label: "Kanban" },
            ]}
          />
        }
      />
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filtros da tabela">
          <Selecao
            id="filtro-etapa"
            rotulo="Etapa"
            valor={estado.etapa ?? ""}
            onChange={(v) => mudar({ etapa: (v || null) as EstadoTabela["etapa"] })}
            opcoes={etapas.map((e) => ({ valor: e.id, label: e.nome }))}
          />
          <Selecao
            id="filtro-risco"
            rotulo="Faixa de saúde"
            valor={estado.risco ?? ""}
            onChange={(v) => mudar({ risco: (v || null) as EstadoTabela["risco"] })}
            opcoes={FAIXAS_SAUDE.map((r) => ({ valor: r, label: ROTULO_FAIXA[r] }))}
          />
          <Selecao
            id="filtro-checkpoint"
            rotulo="Checkpoint"
            valor={valorCheckpoint}
            onChange={(v) => mudar({ checkpoint: v ? (v.split(",") as EstadoTabela["checkpoint"]) : [] })}
            opcoes={[
              ...STATUS_CHECKPOINT.map((s) => ({ valor: s, label: ROTULO_STATUS_CHECKPOINT[s] })),
              { valor: SLA, label: "Pendente + Não respondeu (SLA)" },
            ]}
          />
          <Selecao
            id="filtro-responsavel"
            rotulo="Responsável"
            valor={estado.responsavel ?? ""}
            onChange={(v) => mudar({ responsavel: v || null })}
            opcoes={responsaveis.map((r) => ({ valor: r.id, label: r.nome }))}
          />
          <Selecao
            id="filtro-sinal"
            rotulo="Sinal"
            valor={estado.sinal ?? ""}
            onChange={(v) => mudar({ sinal: (v || null) as EstadoTabela["sinal"] })}
            opcoes={SINAIS.map((s) => ({ valor: s, label: ROTULO_SINAL[s] }))}
          />
        </div>

        {descricao.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-azul/40 bg-azul/10 px-3 py-2 text-xs" role="status">
            <Filter className="h-3.5 w-3.5 text-azul-claro" aria-hidden />
            <span className="font-medium text-texto">Filtro ativo:</span>
            <span className="text-texto-sec">{descricao.join(" · ")}</span>
            <button
              type="button"
              onClick={() => onMudar(semFiltros(estado))}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-azul-claro hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Limpar filtros
            </button>
          </div>
        )}

        {lista.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando a tabela">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : lista.isError ? (
          <ErrorState
            titulo="Não foi possível carregar os alunos"
            descricao={mensagemDoErro(lista.error)}
            onRetry={() => lista.refetch()}
            retryLabel="Tentar de novo"
          />
        ) : !lista.data || lista.data.itens.length === 0 ? (
          <EmptyState
            titulo={temFiltro(estado) ? "Nenhum aluno com esses filtros" : "Nenhum aluno na jornada"}
            descricao={temFiltro(estado) ? "Limpe ou troque os filtros para ver outros alunos." : "Quando houver alunos ativos, eles aparecem aqui."}
          />
        ) : (
          <>
            {lista.data.descartados > 0 && (
              <p className="text-xs text-texto-sec" role="note">
                {lista.data.descartados} {lista.data.descartados === 1 ? "registro veio" : "registros vieram"} com dado inválido e
                {lista.data.descartados === 1 ? " ficou" : " ficaram"} de fora. O motivo está no console.
              </p>
            )}
            {!kanban ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-borda text-left text-xs text-texto-sec">
                      {COLUNAS.map((c) => {
                        const ativa = estado.ordem === c.campo || estado.ordem === `-${c.campo}`;
                        const Seta = !ativa ? ArrowUpDown : estado.ordem.startsWith("-") ? ArrowDown : ArrowUp;
                        return (
                          <th
                            key={c.campo}
                            className="px-2 py-2 font-medium"
                            aria-sort={ativa ? (estado.ordem.startsWith("-") ? "descending" : "ascending") : "none"}
                          >
                            <button
                              type="button"
                              onClick={() => ordenar(c.campo)}
                              className={cn("inline-flex items-center gap-1 text-left hover:text-texto", ativa && "text-texto")}
                            >
                              {c.rotulo}
                              <Seta className={cn("h-3 w-3", !ativa && "opacity-40")} aria-hidden />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {lista.data.itens.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => abrir(a)}
                        className="cursor-pointer border-b border-borda/40 transition-colors hover:bg-white/[0.04]"
                      >
                        <td className="whitespace-nowrap px-2 py-2.5">
                          <Link
                            href={hrefDoAluno(a)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-texto hover:text-azul-claro hover:underline"
                          >
                            {a.nome}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-texto-sec">{ROTULO_NIVEL[a.nivel_inicial]}</td>
                        <td className="max-w-[150px] px-2 py-2.5 leading-snug text-texto">{a.etapa.nome}</td>
                        <td className="px-2 py-2.5">
                          {a.proximo_checkpoint ? <BadgeCheckpoint status={a.proximo_checkpoint.status} /> : <span className="text-texto-sec/60">—</span>}
                        </td>
                        <td className="px-2 py-2.5 font-semibold tabular-nums text-texto">
                          {a.dias_na_etapa.valor != null ? `${a.dias_na_etapa.valor}d` : "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <Faixa faixa={a.faixa_saude.valor} />
                        </td>
                        <td className="max-w-[190px] px-2 py-2.5">
                          <span className="block truncate text-texto" title={a.proxima_acao?.descricao}>
                            {a.proxima_acao?.descricao ?? <span className="text-texto-sec/60">—</span>}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-sm">
                          <NomeResponsavel responsavel={a.responsavel} empilhado />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Kanban itens={lista.data.itens} etapas={etapas} hrefDoAluno={hrefDoAluno} />
            )}

            {!kanban && (
            <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-sec" aria-label="Paginação">
              <span>
                {total} {total === 1 ? "aluno" : "alunos"} · página {estado.pagina} de {totalPaginas}
              </span>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={estado.pagina <= 1}
                  onClick={() => mudar({ pagina: estado.pagina - 1 })}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={estado.pagina >= totalPaginas}
                  onClick={() => mudar({ pagina: estado.pagina + 1 })}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </nav>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Selecao({
  id,
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { valor: string; label: string }[];
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-texto-sec">
      {rotulo}
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full min-w-0 rounded-lg border bg-painel-claro px-2 text-sm text-texto",
          valor ? "border-azul/50" : "border-borda",
        )}
      >
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Kanban: uma coluna por etapa ativa, na ordem da configuração, com todos os alunos.
function Kanban({ itens, etapas, hrefDoAluno }: { itens: AlunoLinha[]; etapas: Etapa[]; hrefDoAluno: (a: AlunoLinha) => string }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-[1040px] grid-cols-5 gap-3">
        {etapas.map((etapa) => {
          const daEtapa = itens.filter((a) => a.etapa.id === etapa.id);
          return (
            <section key={etapa.id} aria-label={etapa.nome} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
                <h3 className="text-xs font-semibold text-texto">{etapa.nome}</h3>
                <span className="text-xs tabular-nums text-texto-sec">{daEtapa.length}</span>
              </header>
              {daEtapa.length === 0 ? (
                <p className="px-1 py-3 text-center text-[11px] text-texto-sec/70">Nenhum aluno</p>
              ) : (
                daEtapa.map((a) => (
                  <Link
                    key={a.id}
                    href={hrefDoAluno(a)}
                    className="card-interactive block rounded-lg p-3"
                  >
                    <span className="block truncate text-sm font-semibold text-texto">{a.nome}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Faixa faixa={a.faixa_saude.valor} className="text-xs" />
                      {a.proximo_checkpoint && <BadgeCheckpoint status={a.proximo_checkpoint.status} />}
                    </span>
                    <span className="mt-1.5 block text-xs text-texto-sec">
                      <span className="font-semibold tabular-nums text-texto">{a.dias_na_etapa.valor ?? "—"}d</span> na etapa
                    </span>
                  </Link>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
