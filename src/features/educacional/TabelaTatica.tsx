"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Filter, Loader2, Plus, RotateCcw, Search, X } from "lucide-react";
import {
  arquivarAluno,
  buscaValida,
  buscarAlunos,
  RESPONSAVEL_NENHUM,
  TAMANHO_PAGINA,
  type ChaveOrdem,
  type OrdemAlunos,
  type Simular,
} from "@/lib/educacional/apiEducacional";
import {
  FAIXAS_SAUDE,
  NIVEIS_INICIAIS,
  SINAIS,
  STATUS_ALUNO,
  STATUS_CHECKPOINT,
  type AlunoLinha,
  type CampoAjustavel,
  type Etapa,
  type NivelInicial,
  type Responsavel,
  type StatusAluno,
} from "@/lib/educacional/contrato";
import {
  dataCurta,
  ROTULO_FAIXA,
  ROTULO_NIVEL,
  ROTULO_SINAL,
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_TIPO_RESPONSAVEL,
} from "@/lib/educacional/rotulos";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { formatarValor } from "./campos";
import { ativos, CHAVES, etapasAtivas, useConfig } from "./dados";
import { CelulaEditavel, EditorAcao, EditorCheckpoint, EditorLista, EditorTexto, MarcaAjuste } from "./Edicao";
import {
  descreverFiltros,
  hrefDoRaioX,
  queryDoEstado,
  ROTA_ALUNOS,
  semFiltros,
  temFiltro,
  type EstadoTabela,
  type Visao,
} from "./estado";
import { FiltroProgramas } from "./FiltroProgramas";
import { programasPorMentoria, temProgramas } from "./programas";
import { FormAjuste } from "./FormAjuste";
import { Kanban } from "./Kanban";
import { NovoAluno } from "./NovoAluno";
import { BadgeCheckpoint, Faixa, mensagemDoErro, NomeResponsavel, useRedirecionarSeSemPermissao } from "./partes";
import { COLUNAS_DA_TABELA, SeletorColunas, useColunasVisiveis, type IdColuna } from "./SeletorColunas";
import { useGravacao } from "./useGravacao";
import { useSession } from "@/features/session/SessionProvider";
import {
  alteracaoDaAcao,
  alteracaoDaEtapa,
  alteracaoDoAjuste,
  alteracaoDoCheckpoint,
  alteracaoDoNivel,
  alteracaoDoNome,
  alteracaoDoResponsavel,
  alteracaoDoStatus,
} from "./lote/alteracoes";
import { MarcaPendente } from "./lote/MarcaPendente";
import { comPendencias, type Alteracao, type Entrada } from "./lote/pendencias";
import { useAcoesDoLote, usePendencias, type AcoesDoLote } from "./lote/ProvedorLote";

// ---------------------------------------------------------------------------
// Tabela tática (spec Fase 2, seção 4), na aba Alunos desde a Fase 3 (3.3):
// busca por nome, filtros, contador, Lista | Kanban. A lista vem do adapter já
// filtrada, ordenada e paginada; toda célula edita na linha (Enter/clique fora
// confirma, Esc cancela) e a edição vira ALTERAÇÃO PENDENTE (salvar em lote,
// seção 4): nada vai para a API até "Salvar" na barra. Campo calculado abre o
// formulário de ajuste (o motivo vai junto). Arquivar e reativar seguem
// imediatos. O nome do aluno abre o Raio-X, que volta para esta URL.
// ---------------------------------------------------------------------------

const SLA = "pendente,nao_respondeu";

type Props = {
  estado: EstadoTabela;
  simular: Simular;
  onMudar: (novo: EstadoTabela) => void;
};

export function TabelaTatica({ estado, simular, onMudar }: Props) {
  const router = useRouter();
  const kanban = estado.visao === "kanban";
  // Kanban: sem paginação (Q3: por_pagina=todos), sem arquivados e na ordem da
  // spec (faixa de saúde, risco primeiro, depois dias na etapa desc).
  const filtros = kanban
    ? { ...estado, pagina: 1, por_pagina: "todos" as const, incluir_arquivados: false, ordem: "risco" as const }
    : estado;
  const lista = useQuery({
    queryKey: [...CHAVES.alunos, filtros, simular],
    queryFn: () => buscarAlunos(filtros, simular),
    retry: false,
  });
  const config = useConfig();
  useRedirecionarSeSemPermissao([lista.error, config.error]);
  // O que a pessoa editou e ainda não salvou aparece por cima do servidor.
  const pendencias = usePendencias();
  const itens = useMemo(() => lista.data?.itens.map((l) => comPendencias(l, pendencias[l.id])) ?? [], [lista.data, pendencias]);
  const etapas = useMemo(() => etapasAtivas(config.data), [config.data]);
  const responsaveis = ativos(config.data?.responsaveis);
  const { visiveis, alternar } = useColunasVisiveis();
  const [novoAberto, setNovoAberto] = useState(false);

  const q = queryDoEstado(estado, simular);
  const voltar = `${ROTA_ALUNOS}${q ? `?${q}` : ""}`;
  const hrefDoAluno = useCallback((a: { id: string }) => hrefDoRaioX(a.id, voltar), [voltar]);

  const mudar = (parcial: Partial<EstadoTabela>) => onMudar({ ...estado, ...parcial, pagina: parcial.pagina ?? 1 });

  const descricao = descreverFiltros(estado, {
    etapa: (id) => config.data?.etapas.find((e) => e.id === id)?.nome,
    responsavel: (id) => config.data?.responsaveis.find((r) => r.id === id)?.nome,
    programa: (id) => config.data?.programas.find((p) => p.id === id)?.nome,
  });
  const comProgramas = temProgramas(config.data);
  const total = lista.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const valorCheckpoint = estado.checkpoint?.join(",") ?? "";
  const filtrado = temFiltro(estado);

  return (
    <Card id="tabela-tatica" className="scroll-mt-20">
      <CardHeader
        title="Acompanhamento tático"
        subtitle="Clique numa célula para editar · clique no nome para abrir o raio-X"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!kanban && <SeletorColunas visiveis={visiveis} onAlternar={alternar} />}
            <Button size="sm" onClick={() => setNovoAberto(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Novo aluno
            </Button>
            <Alternador<Visao>
              rotulo="Visualização da tabela"
              valor={estado.visao}
              onChange={(v) => onMudar({ ...estado, visao: v })}
              opcoes={[
                { valor: "lista", label: "Lista" },
                { valor: "kanban", label: "Kanban" },
              ]}
            />
          </div>
        }
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <BuscaPorNome valor={estado.busca ?? null} onBuscar={(busca) => mudar({ busca })} />
          {!kanban && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-texto-sec">
              <input
                type="checkbox"
                checked={Boolean(estado.incluir_arquivados)}
                onChange={(e) => mudar({ incluir_arquivados: e.target.checked })}
                className="accent-azul"
              />
              Mostrar arquivados
            </label>
          )}
        </div>
        <div
          className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", comProgramas ? "xl:grid-cols-7" : "xl:grid-cols-6")}
          role="group"
          aria-label="Filtros da tabela"
        >
          {comProgramas && (
            <FiltroProgramas
              id="filtro-programa"
              grupos={programasPorMentoria(config.data, true)}
              valor={estado.programa ?? []}
              onChange={(v) => mudar({ programa: v })}
            />
          )}
          <Selecao
            id="filtro-etapa"
            rotulo="Etapa"
            valor={estado.etapa ?? ""}
            onChange={(v) => mudar({ etapa: v || null })}
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
            id="filtro-status-aluno"
            rotulo="Status do aluno"
            valor={typeof estado.status_aluno === "string" ? estado.status_aluno : ""}
            onChange={(v) => mudar({ status_aluno: (v || null) as StatusAluno | null })}
            opcoes={STATUS_ALUNO.map((s) => ({ valor: s, label: ROTULO_STATUS_ALUNO[s] }))}
          />
          <Selecao
            id="filtro-responsavel"
            rotulo="Responsável"
            valor={estado.responsavel ?? ""}
            onChange={(v) => mudar({ responsavel: v || null })}
            opcoes={[
              { valor: RESPONSAVEL_NENHUM, label: "Sem responsável" },
              ...responsaveis.map((r) => ({ valor: r.id, label: r.nome })),
            ]}
          />
          <Selecao
            id="filtro-sinal"
            rotulo="Sinal"
            valor={estado.sinal ?? ""}
            onChange={(v) => mudar({ sinal: (v || null) as EstadoTabela["sinal"] })}
            opcoes={SINAIS.map((s) => ({ valor: s, label: ROTULO_SINAL[s] }))}
          />
        </div>

        {/* Contador: a linha existe desde o início (vazia enquanto carrega). */}
        <div
          className={cn(
            "flex min-h-[2.25rem] flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs",
            filtrado ? "border-azul/40 bg-azul/10" : "border-transparent",
          )}
          role="status"
        >
          {filtrado && <Filter className="h-3.5 w-3.5 text-azul-claro" aria-hidden />}
          <span className="font-semibold tabular-nums text-texto">
            {lista.data ? `${total} ${total === 1 ? "aluno" : "alunos"}` : "\u00a0"}
          </span>
          {descricao.length > 0 && <span className="text-texto-sec">· {descricao.join(" · ")}</span>}
          {filtrado && (
            <button
              type="button"
              onClick={() => onMudar(semFiltros(estado))}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-azul-claro hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Limpar filtros
            </button>
          )}
        </div>

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
        ) : !lista.data || itens.length === 0 ? (
          <EmptyState
            titulo={filtrado ? "Nenhum aluno com esses filtros" : "Nenhum aluno na jornada"}
            descricao={filtrado ? "Limpe ou troque os filtros para ver outros alunos." : "Use “Novo aluno” para cadastrar o primeiro."}
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
              <Lista
                itens={itens}
                pendencias={pendencias}
                estado={estado}
                visiveis={visiveis}
                hrefDoAluno={hrefDoAluno}
                onOrdenar={(o) => mudar({ ordem: o })}
              />
            ) : (
              <Kanban itens={itens} pendencias={pendencias} etapas={etapas} hrefDoAluno={hrefDoAluno} />
            )}

            {!kanban && (
              <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-sec" aria-label="Paginação">
                <span>
                  Página {estado.pagina} de {totalPaginas}
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

      <NovoAluno aberto={novoAberto} onFechar={() => setNovoAberto(false)} onCriado={(a) => router.push(hrefDoAluno(a))} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lista editável
// ---------------------------------------------------------------------------

function Lista({
  itens,
  pendencias,
  estado,
  visiveis,
  hrefDoAluno,
  onOrdenar,
}: {
  itens: AlunoLinha[];
  pendencias: Readonly<Record<string, Entrada>>;
  estado: EstadoTabela;
  visiveis: IdColuna[];
  hrefDoAluno: (a: AlunoLinha) => string;
  onOrdenar: (o: OrdemAlunos) => void;
}) {
  const config = useConfig();
  const user = useSession();
  const acoes = useAcoesDoLote();
  const [ajuste, setAjuste] = useState<{ aluno: AlunoLinha; campo: CampoAjustavel } | null>(null);
  // Props estáveis para as linhas memorizadas.
  const etapas = useMemo(() => etapasAtivas(config.data), [config.data]);
  const responsaveis = useMemo(() => ativos(config.data?.responsaveis), [config.data]);
  const colunas = useMemo(() => COLUNAS_DA_TABELA.filter((c) => visiveis.includes(c.id)), [visiveis]);
  const abrirAjuste = useCallback((aluno: AlunoLinha, campo: CampoAjustavel) => setAjuste({ aluno, campo }), []);

  const ordenar = (campo: ChaveOrdem) => {
    const atual = estado.ordem;
    onOrdenar(atual === campo ? (`-${campo}` as OrdemAlunos) : campo);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: Math.max(640, colunas.length * 125) }}>
        <thead>
          <tr className="border-b border-borda text-left text-xs text-texto-sec">
            {colunas.map((c) => {
              const ativa = estado.ordem === c.id || estado.ordem === `-${c.id}`;
              const Seta = !ativa ? ArrowUpDown : estado.ordem.startsWith("-") ? ArrowDown : ArrowUp;
              return (
                <th
                  key={c.id}
                  className="px-2 py-2 font-medium"
                  aria-sort={ativa ? (estado.ordem.startsWith("-") ? "descending" : "ascending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => ordenar(c.id)}
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
          {itens.map((a) => (
            <LinhaAluno
              key={a.id}
              a={a}
              entrada={pendencias[a.id]}
              acoes={acoes}
              colunas={colunas}
              etapas={etapas}
              responsaveis={responsaveis}
              hrefDoAluno={hrefDoAluno}
              onAjuste={abrirAjuste}
            />
          ))}
        </tbody>
      </table>
      {ajuste && (
        <FormAjuste
          aluno={itens.find((x) => x.id === ajuste.aluno.id) ?? ajuste.aluno}
          campo={ajuste.campo}
          onFechar={() => setAjuste(null)}
          // Pendente: valor e motivo vão para o lote, nada é gravado agora.
          aoConfirmar={(r) => {
            const a = itens.find((x) => x.id === ajuste.aluno.id) ?? ajuste.aluno;
            acoes.registrar(a, alteracaoDoAjuste(a, ajuste.campo, r, { id: user.id, nome: user.nome }));
          }}
        />
      )}
    </div>
  );
}

// Uma linha da tabela, memorizada: só redesenha quando o aluno DELA muda (o
// cache troca só o objeto do aluno gravado e o React Query mantém os demais).
type ColunaVisivel = (typeof COLUNAS_DA_TABELA)[number];
type PropsLinha = {
  a: AlunoLinha;
  entrada: Entrada | undefined;
  acoes: AcoesDoLote;
  colunas: ColunaVisivel[];
  etapas: Etapa[];
  responsaveis: Responsavel[];
  hrefDoAluno: (a: AlunoLinha) => string;
  onAjuste: (a: AlunoLinha, campo: CampoAjustavel) => void;
};

// Célula de cada coluna nas pendências (null = coluna sem edição).
function chaveDaColuna(a: AlunoLinha, coluna: IdColuna): string | null {
  switch (coluna) {
    case "nome":
      return "campo:nome";
    case "nivel_inicial":
      return "campo:nivel_inicial";
    case "etapa":
      return "campo:etapa_id";
    case "checkpoint":
      return a.proximo_checkpoint ? `checkpoint:${a.proximo_checkpoint.id}` : null;
    case "dias_na_etapa":
    case "faixa_saude":
    case "health_score":
    case "dias_sem_atividade":
      return `ajuste:${coluna}`;
    case "proxima_acao":
      return "campo:proxima_acao";
    case "responsavel":
      return "campo:responsavel_id";
    case "status_aluno":
      return "campo:status_aluno";
    default:
      return null;
  }
}

const LinhaAluno = memo(function LinhaAluno({ a, entrada, acoes, colunas, etapas, responsaveis, hrefDoAluno, onAjuste }: PropsLinha) {
  const gravar = useGravacao();
  const salvando = entrada?.estado === "salvando";

  // Edição na linha = alteração pendente (vai no próximo "Salvar").
  const pendente = (alt: Alteracao | null) => acoes.registrar(a, alt);

  const reativar = (a: AlunoLinha) =>
    gravar({
      alunoId: a.id,
      versao: a.versao,
      executar: (v) => arquivarAluno(a.id, v, false),
      naLinha: (l) => ({ ...l, arquivado: false }),
      afetaTotais: true,
    });

  function celula(a: AlunoLinha, coluna: IdColuna): ReactNode {
    const bloqueada = a.arquivado || salvando;
    const ajustavel = (campo: CampoAjustavel, exibir: ReactNode, rotulo: string) => (
      <CelulaEditavel rotulo={`Ajustar ${rotulo} de ${a.nome}`} bloqueada={bloqueada} onAbrir={() => onAjuste(a, campo)} exibir={exibir} />
    );
    switch (coluna) {
      case "nome":
        return (
          <CelulaEditavel
            rotulo={`Editar o nome de ${a.nome}`}
            bloqueada={bloqueada}
            exibir={
              <span className="flex flex-wrap items-center gap-2">
                <Link
                  href={hrefDoAluno(a)}
                  onClick={(e) => e.stopPropagation()}
                  className="whitespace-nowrap font-semibold text-texto hover:text-azul-claro hover:underline"
                >
                  {a.nome}
                </Link>
                {a.arquivado && <span className="tag">Arquivado</span>}
              </span>
            }
            editor={({ concluir, cancelar }) => (
              <EditorTexto
                rotulo="Nome do aluno"
                valor={a.nome}
                obrigatorio
                onCancelar={cancelar}
                onSalvar={(nome) => {
                  concluir();
                  if (nome) pendente(alteracaoDoNome(a, nome));
                }}
              />
            )}
          />
        );
      case "nivel_inicial":
        return (
          <CelulaEditavel
            rotulo={`Editar o nível inicial de ${a.nome}`}
            bloqueada={bloqueada}
            exibir={<span className="text-texto-sec">{ROTULO_NIVEL[a.nivel_inicial]}</span>}
            editor={({ concluir, cancelar }) => (
              <EditorLista
                rotulo="Nível inicial"
                valor={a.nivel_inicial}
                opcoes={NIVEIS_INICIAIS.map((n) => ({ valor: n, rotulo: ROTULO_NIVEL[n] }))}
                onCancelar={cancelar}
                onSalvar={(v) => {
                  concluir();
                  pendente(alteracaoDoNivel(a, v as NivelInicial));
                }}
              />
            )}
          />
        );
      case "etapa":
        return (
          <CelulaEditavel
            rotulo={`Mudar a etapa de ${a.nome}`}
            bloqueada={bloqueada}
            className="max-w-[170px]"
            exibir={<span className="leading-snug text-texto">{a.etapa.nome}</span>}
            editor={({ concluir, cancelar }) => (
              <EditorLista
                rotulo="Etapa"
                valor={a.etapa.id}
                opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))}
                onCancelar={cancelar}
                onSalvar={(id) => {
                  const e = etapas.find((x) => x.id === id);
                  if (!e) return cancelar();
                  concluir();
                  pendente(alteracaoDaEtapa(a, e));
                }}
              />
            )}
          />
        );
      case "checkpoint": {
        const cp = a.proximo_checkpoint;
        if (!cp) return <span className="text-texto-sec/60">—</span>;
        return (
          <CelulaEditavel
            rotulo={`Mudar o status do checkpoint ${cp.nome} de ${a.nome}`}
            bloqueada={bloqueada}
            exibir={
              <span className="flex flex-col items-start gap-0.5">
                <BadgeCheckpoint status={cp.status} />
                <span className="text-[11px] text-texto-sec">
                  {cp.nome} · {dataCurta(cp.data_prevista)}
                </span>
              </span>
            }
            editor={({ concluir, cancelar }) => (
              <EditorCheckpoint
                status={cp.status}
                onCancelar={cancelar}
                onSalvar={(campos) => {
                  concluir();
                  pendente(alteracaoDoCheckpoint(a, campos));
                }}
              />
            )}
          />
        );
      }
      case "dias_na_etapa":
        return ajustavel(
          "dias_na_etapa",
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-texto">
            {a.dias_na_etapa.valor != null ? `${a.dias_na_etapa.valor}d` : "—"}
            <MarcaAjuste ajuste={a.dias_na_etapa.ajuste} automatico={formatarValor("dias_na_etapa", a.dias_na_etapa.automatico)} />
          </span>,
          "dias na etapa",
        );
      case "faixa_saude":
        return ajustavel(
          "faixa_saude",
          <span className="inline-flex items-center gap-1">
            <Faixa faixa={a.faixa_saude.valor} />
            <MarcaAjuste ajuste={a.faixa_saude.ajuste} automatico={formatarValor("faixa_saude", a.faixa_saude.automatico)} />
          </span>,
          "faixa de saúde",
        );
      case "health_score":
        return ajustavel(
          "health_score",
          <span className="inline-flex items-center gap-1 tabular-nums text-texto">
            {a.health_score.valor ?? "—"}
            <MarcaAjuste ajuste={a.health_score.ajuste} automatico={formatarValor("health_score", a.health_score.automatico)} />
          </span>,
          "Health Score",
        );
      case "dias_sem_atividade":
        return ajustavel(
          "dias_sem_atividade",
          <span className="inline-flex items-center gap-1 tabular-nums text-texto">
            {a.dias_sem_atividade.valor != null ? `${a.dias_sem_atividade.valor}d` : "—"}
            <MarcaAjuste
              ajuste={a.dias_sem_atividade.ajuste}
              automatico={formatarValor("dias_sem_atividade", a.dias_sem_atividade.automatico)}
            />
          </span>,
          "dias sem atividade",
        );
      case "proxima_acao":
        return (
          <CelulaEditavel
            rotulo={`Editar a próxima ação de ${a.nome}`}
            bloqueada={bloqueada}
            className="max-w-[220px]"
            exibir={
              a.proxima_acao ? (
                <span className="block min-w-0">
                  <span className="block truncate text-texto" title={a.proxima_acao.descricao}>
                    {a.proxima_acao.descricao}
                  </span>
                  {a.proxima_acao.prazo && <span className="text-[11px] text-texto-sec">até {dataCurta(a.proxima_acao.prazo)}</span>}
                </span>
              ) : (
                <span className="text-texto-sec/60">—</span>
              )
            }
            editor={({ concluir, cancelar }) => (
              <EditorAcao
                descricao={a.proxima_acao?.descricao ?? ""}
                prazo={a.proxima_acao?.prazo ?? ""}
                onCancelar={cancelar}
                onSalvar={({ descricao, prazo }) => {
                  concluir();
                  pendente(alteracaoDaAcao(a, descricao, prazo));
                }}
              />
            )}
          />
        );
      case "responsavel":
        return (
          <CelulaEditavel
            rotulo={`Mudar o responsável de ${a.nome}`}
            bloqueada={bloqueada}
            exibir={<NomeResponsavel responsavel={a.responsavel} empilhado />}
            editor={({ concluir, cancelar }) => (
              <EditorLista
                rotulo="Responsável"
                valor={a.responsavel?.id ?? ""}
                vazio="Sem responsável"
                opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${ROTULO_TIPO_RESPONSAVEL[r.tipo]}` }))}
                onCancelar={cancelar}
                onSalvar={(id) => {
                  concluir();
                  pendente(alteracaoDoResponsavel(a, responsaveis.find((x) => x.id === id) ?? null));
                }}
              />
            )}
          />
        );
      case "status_aluno":
        return (
          <CelulaEditavel
            rotulo={`Mudar o status de ${a.nome}`}
            bloqueada={bloqueada}
            exibir={<span className="whitespace-nowrap text-texto-sec">{ROTULO_STATUS_ALUNO[a.status_aluno]}</span>}
            editor={({ concluir, cancelar }) => (
              <EditorLista
                rotulo="Status do aluno"
                valor={a.status_aluno}
                opcoes={STATUS_ALUNO.map((s) => ({ valor: s, rotulo: ROTULO_STATUS_ALUNO[s] }))}
                onCancelar={cancelar}
                onSalvar={(v) => {
                  concluir();
                  pendente(alteracaoDoStatus(a, v as StatusAluno));
                }}
              />
            )}
          />
        );
      case "mentoria":
        // Vem do programa: só leitura (troca por "Trocar programa", no Raio-X).
        return <span className="whitespace-nowrap text-texto-sec">{a.mentoria}</span>;
    }
  }

  const erro = entrada?.erro;
  const revisar = entrada?.estado === "revisar";
  return (
    <tr
      className={cn("border-b border-borda/40 align-top", a.arquivado && "opacity-60", revisar && "outline outline-1 -outline-offset-1 outline-aviso/70")}
      aria-busy={salvando || undefined}
    >
      {colunas.map((c) => {
        const chave = chaveDaColuna(a, c.id);
        const alteracao = chave ? entrada?.alteracoes[chave] : undefined;
        // Erro de validação vai para a célula dele; sem célula conhecida, para o nome.
        const erroDaCelula =
          erro?.tipo === "validacao" && (erro.chave === chave || (erro.chave === null && c.id === "nome")) ? erro.mensagem : null;
        return (
          <td key={c.id} className="px-2 py-1.5">
            <MarcaPendente
              alteracao={alteracao}
              erro={erroDaCelula}
              onDesfazer={chave && alteracao && !salvando ? () => acoes.desfazer(a.id, chave) : undefined}
            >
              {celula(a, c.id)}
            </MarcaPendente>
            {c.id === "nome" && <SituacaoDoAluno entrada={entrada} />}
            {c.id === "nome" && a.arquivado && (
              <Button variant="outline" size="sm" className="mt-1" onClick={() => void reativar(a)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reativar
              </Button>
            )}
          </td>
        );
      })}
    </tr>
  );
});

// Situação do aluno no lote, embaixo do nome: salvando, 409, revisar.
function SituacaoDoAluno({ entrada }: { entrada: Entrada | undefined }) {
  if (!entrada) return null;
  if (entrada.estado === "salvando") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-texto-sec">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }
  if (entrada.erro?.tipo === "versao") return <span className="mt-0.5 block text-[11px] text-aviso">Alterado por outra pessoa · veja na barra</span>;
  if (entrada.erro?.tipo === "rede") return <span className="mt-0.5 block text-[11px] text-erro">Não salvo (sem conexão)</span>;
  if (entrada.estado === "revisar") return <span className="mt-0.5 block text-[11px] text-aviso">Reaplicado · revise e salve de novo</span>;
  return null;
}

// Busca por nome (padrão da aba Leads, com espera): vai para a URL 300 ms
// depois da última tecla, a partir de 2 letras. Menos que isso = sem busca.
const ESPERA_BUSCA_MS = 300;

function BuscaPorNome({ valor, onBuscar }: { valor: string | null; onBuscar: (busca: string | null) => void }) {
  const [texto, setTexto] = useState(valor ?? "");
  const aoBuscar = useRef(onBuscar);
  aoBuscar.current = onBuscar;

  // A URL mudou por fora (Limpar filtros, voltar do navegador): acompanha, sem
  // apagar o que a pessoa ainda está digitando (espaço no fim, 1 letra).
  useEffect(() => {
    setTexto((t) => (buscaValida(t) === valor ? t : (valor ?? "")));
  }, [valor]);

  useEffect(() => {
    const alvo = buscaValida(texto);
    if (alvo === valor) return;
    const espera = setTimeout(() => aoBuscar.current(alvo), ESPERA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [texto, valor]);

  return (
    <div role="search" className="relative min-w-[220px] max-w-md flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec" aria-hidden />
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por nome…"
        aria-label="Buscar aluno por nome"
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
      />
    </div>
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
