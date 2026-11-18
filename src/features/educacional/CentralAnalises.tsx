"use client";

import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import {
  buscarAluno,
  buscarOpcoesAlunos,
  BUSCA_MINIMA,
  listarAnalises,
  TAMANHO_PAGINA_ANALISES,
} from "@/lib/educacional/apiEducacional";
import {
  SITUACOES_ANALISE,
  type AlunoDetalhe,
  type Aula,
  type FiltrosAnalises,
  type ItemAnalise,
  type OpcaoAluno,
} from "@/lib/educacional/contrato";
import { dataCurta, rotuloDaAula, ROTULO_STATUS_AULA } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { COR_SITUACAO, PainelAnaliseAula } from "./AnaliseAula";
import { CHAVES } from "./dados";
import { CAMPO, Dialogo, ErroDoEnvio } from "./Dialogo";
import { EtiquetaDemonstracao, mensagemDoErro, useRedirecionarSeSemPermissao } from "./partes";
import { podeRefazer, quemEQuando, rotuloDaAulaDaAnalise, ROTULO_SITUACAO_ANALISE, situacaoDe } from "./revisaoAnalise";

// ---------------------------------------------------------------------------
// Central de análises do Educacional (backend 40d18c8): as análises de aula com
// IA de todos os alunos, mais nova primeiro. Totais por situação (clicáveis como
// filtro; eles não mudam ao filtrar por situação, de propósito), filtro por
// aluno e por período de envio. A linha abre o mesmo painel da ficha; com
// "interrompida" ou "erro", "Refazer" pede a transcrição de novo para a mesma
// aula. "Nova análise": aluno → aula sem análise → transcrição.
// Só números de alertas e de descartes na lista; a transcrição nunca aparece.
// ---------------------------------------------------------------------------

type Aberta = { alunoId: string; aula: Pick<Aula, "id" | "numero" | "data">; analiseId?: string; refazer: boolean };

export function CentralAnalises() {
  const id = useId();
  const [filtros, setFiltros] = useState<FiltrosAnalises>({ pagina: 1 });
  const [alunoFiltro, setAlunoFiltro] = useState<OpcaoAluno | null>(null);
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const lista = useQuery({
    queryKey: [...CHAVES.central, filtros],
    queryFn: () => listarAnalises(filtros),
    retry: false,
    placeholderData: keepPreviousData,
  });
  useRedirecionarSeSemPermissao([lista.error]);
  const mudar = (parcial: Partial<FiltrosAnalises>) => setFiltros((f) => ({ ...f, ...parcial, pagina: parcial.pagina ?? 1 }));
  const total = lista.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA_ANALISES));
  const pagina = filtros.pagina ?? 1;
  const filtrado = Boolean(filtros.situacao || filtros.aluno_id || filtros.de || filtros.ate);

  const abrir = (x: ItemAnalise, refazer = false) =>
    setAberta({ alunoId: x.aluno.id, aula: { id: x.aula.id, numero: x.aula.numero, data: x.aula.data }, analiseId: refazer ? undefined : x.id, refazer });

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Análise de aula</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Análise de aula</h1>
            <EtiquetaDemonstracao />
          </div>
          <p className="mt-1 text-sm opacity-80">As análises com IA de todos os alunos. Nada entra na ficha sem alguém decidir.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={lista.isFetching && !lista.isLoading} onClick={() => void lista.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovaAberta(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova análise
          </Button>
        </div>
      </header>

      {/* Totais por situação: clicáveis como filtro (não mudam ao filtrar por situação). */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="group" aria-label="Totais por situação">
        {SITUACOES_ANALISE.map((s) => {
          const ativo = filtros.situacao === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={ativo}
              onClick={() => mudar({ situacao: ativo ? null : s })}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                ativo ? "border-azul/60 bg-azul/15" : "border-white/10 bg-white/5 hover:border-white/25",
              )}
            >
              <span className={cn("block text-xs font-medium", COR_SITUACAO[s])}>{ROTULO_SITUACAO_ANALISE[s]}</span>
              <span className="block text-lg font-semibold tabular-nums text-texto">{lista.data ? lista.data.totais[s] : "—"}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Análises" subtitle="Mais nova primeiro. Clique numa linha para abrir a revisão." />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros das análises">
            <div className="w-72">
              <p className="mb-1 text-xs font-medium text-texto-sec">Aluno</p>
              {alunoFiltro ? (
                <span className="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border border-azul/40 bg-azul/10 px-2 text-sm text-texto">
                  <span className="truncate">{alunoFiltro.nome}</span>
                  <button
                    type="button"
                    aria-label="Tirar o filtro de aluno"
                    onClick={() => {
                      setAlunoFiltro(null);
                      mudar({ aluno_id: null });
                    }}
                    className="text-texto-sec hover:text-texto"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              ) : (
                <BuscaDeAluno
                  id={`${id}-aluno`}
                  rotulo="Filtrar por aluno"
                  onEscolher={(a) => {
                    setAlunoFiltro(a);
                    mudar({ aluno_id: a.id });
                  }}
                />
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-texto-sec">
              Enviadas de
              <input type="date" value={filtros.de ?? ""} max={filtros.ate ?? undefined} onChange={(e) => mudar({ de: e.target.value || null })} className={cn(CAMPO, "w-40")} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-texto-sec">
              até
              <input type="date" value={filtros.ate ?? ""} min={filtros.de ?? undefined} onChange={(e) => mudar({ ate: e.target.value || null })} className={cn(CAMPO, "w-40")} />
            </label>
            {filtrado && (
              <button
                type="button"
                onClick={() => {
                  setAlunoFiltro(null);
                  setFiltros({ pagina: 1 });
                }}
                className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-azul-claro hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Limpar filtros
              </button>
            )}
          </div>

          {lista.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando as análises">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : lista.isError ? (
            <ErrorState titulo="Não foi possível carregar as análises" descricao={mensagemDoErro(lista.error)} onRetry={() => void lista.refetch()} retryLabel="Tentar de novo" />
          ) : !lista.data || lista.data.itens.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              titulo={filtrado ? "Nenhuma análise com esses filtros" : "Nenhuma análise ainda"}
              descricao={filtrado ? "Troque ou limpe os filtros." : "Use “Nova análise” ou o botão “Analisar com IA” numa aula da ficha do aluno."}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-texto-sec">
                    <tr>
                      <th className="px-3 py-2 font-medium">Aluno</th>
                      <th className="px-3 py-2 font-medium">Aula</th>
                      <th className="px-3 py-2 font-medium">Situação</th>
                      <th className="px-3 py-2 font-medium">Enviada</th>
                      <th className="px-3 py-2 font-medium">Decidida</th>
                      <th className="px-3 py-2 text-right font-medium">Alertas</th>
                      <th className="px-3 py-2 text-right font-medium">Descartes</th>
                      <th className="px-3 py-2">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {lista.data.itens.map((x) => (
                      <LinhaDaAnalise key={x.id} x={x} onAbrir={() => abrir(x)} onRefazer={() => abrir(x, true)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <nav className="flex items-center justify-between text-xs text-texto-sec" aria-label="Paginação">
                <span>
                  {total} {total === 1 ? "análise" : "análises"} · página {pagina} de {paginas}
                </span>
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={pagina <= 1} onClick={() => mudar({ pagina: pagina - 1 })} aria-label="Página anterior">
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pagina >= paginas} onClick={() => mudar({ pagina: pagina + 1 })} aria-label="Próxima página">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </span>
              </nav>
            </>
          )}
        </CardContent>
      </Card>

      {aberta && <AbrirAnalise aberta={aberta} onFechar={() => setAberta(null)} />}
      {novaAberta && (
        <NovaAnalise
          onFechar={() => setNovaAberta(false)}
          onEscolher={(alunoId, aula) => {
            setNovaAberta(false);
            setAberta({ alunoId, aula, refazer: true });
          }}
        />
      )}
    </>
  );
}

function LinhaDaAnalise({ x, onAbrir, onRefazer }: { x: ItemAnalise; onAbrir: () => void; onRefazer: () => void }) {
  const situacao = situacaoDe(x);
  return (
    <tr className="cursor-pointer align-middle hover:bg-white/[0.04]" onClick={onAbrir}>
      <td className="px-3 py-2">
        <button type="button" onClick={onAbrir} className="text-left font-medium text-texto hover:underline">
          {x.aluno.nome ?? "Aluno"}
        </button>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-texto">{rotuloDaAulaDaAnalise(x.aula)}</td>
      <td className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium", situacao && COR_SITUACAO[situacao])}>
        {situacao ? ROTULO_SITUACAO_ANALISE[situacao] : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-texto-sec">{quemEQuando(x.criada_por_nome, x.criada_em)}</td>
      <td className="px-3 py-2 text-xs text-texto-sec">{x.decidida ? quemEQuando(x.decidida_por_nome, x.decidida_em) : "—"}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {x.alertas > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-erro">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {x.alertas}
          </span>
        ) : (
          <span className="text-texto-sec">0</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-texto-sec">{x.descartes}</td>
      <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
        {podeRefazer(situacao) && (
          <Button variant="secondary" size="sm" onClick={onRefazer}>
            Refazer
          </Button>
        )}
      </td>
    </tr>
  );
}

// Abre o painel da ficha a partir da central: carrega o aluno (versão, nomes dos
// checkpoints) e acha a aula; aula arquivada vira uma aula só com a data.
function AbrirAnalise({ aberta, onFechar }: { aberta: Aberta; onFechar: () => void }) {
  const aluno = useQuery({ queryKey: CHAVES.aluno(aberta.alunoId), queryFn: () => buscarAluno(aberta.alunoId), retry: false });
  if (!aluno.data) {
    return (
      <Dialogo
        aberto
        titulo="Análise com IA"
        onFechar={onFechar}
        largura="max-w-md"
        rodape={
          <Button type="button" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        }
      >
        {aluno.isError ? (
          <ErroDoEnvio texto={`Não foi possível abrir a ficha do aluno. ${mensagemDoErro(aluno.error)}`} />
        ) : (
          <p className="flex items-center gap-2 py-6 text-sm text-texto-sec" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando…
          </p>
        )}
      </Dialogo>
    );
  }
  const aula: Aula = aluno.data.aulas.find((x) => x.id === aberta.aula.id) ?? {
    id: aberta.aula.id,
    numero: aberta.aula.numero,
    data: aberta.aula.data,
    hora: null,
    mentor: null,
    status: "feito",
    observacao: null,
  };
  return <PainelAnaliseAula aluno={aluno.data} aula={aula} analiseId={aberta.analiseId} refazer={aberta.refazer} onFechar={onFechar} />;
}

// ---------------------------------------------------------------------------
// Nova análise: buscar o aluno (GET /alunos/opcoes), escolher uma aula sem
// análise (GET /alunos/:id: `analise === null`) e seguir para a transcrição.
// ---------------------------------------------------------------------------

function NovaAnalise({ onFechar, onEscolher }: { onFechar: () => void; onEscolher: (alunoId: string, aula: Aula) => void }) {
  const id = useId();
  const [aluno, setAluno] = useState<OpcaoAluno | null>(null);
  return (
    <Dialogo
      aberto
      titulo="Nova análise"
      subtitulo={aluno ? `${aluno.nome} · escolha a aula` : "Passo 1 de 3 · escolha o aluno"}
      onFechar={onFechar}
      largura="max-w-2xl"
      rodape={
        <>
          {aluno && (
            <Button type="button" variant="ghost" onClick={() => setAluno(null)}>
              Trocar de aluno
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </>
      }
    >
      {aluno ? (
        <EscolherAula alunoId={aluno.id} onEscolher={(a, aula) => onEscolher(a.id, aula)} />
      ) : (
        <BuscaDeAluno id={`${id}-aluno`} rotulo="Nome do aluno" onEscolher={setAluno} lista />
      )}
    </Dialogo>
  );
}

function EscolherAula({ alunoId, onEscolher }: { alunoId: string; onEscolher: (a: AlunoDetalhe, aula: Aula) => void }) {
  const ficha = useQuery({ queryKey: CHAVES.aluno(alunoId), queryFn: () => buscarAluno(alunoId), retry: false });
  if (ficha.isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-texto-sec" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando as aulas…
      </p>
    );
  }
  if (!ficha.data) return <ErroDoEnvio texto={`Não foi possível carregar as aulas. ${mensagemDoErro(ficha.error)}`} />;
  const aulas = [...ficha.data.aulas].reverse(); // mais recente primeiro
  if (!aulas.length) return <p className="text-sm text-texto-sec">Este aluno não tem aulas registradas. Registre a aula na ficha antes de analisar.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-texto-sec">Passo 2 de 3 · aulas sem análise estão disponíveis; as outras mostram a situação da última análise.</p>
      <ul className="max-h-[24rem] divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10" aria-label="Aulas do aluno">
        {aulas.map((x) => {
          const disponivel = x.analise === null;
          const situacao = x.analise ? situacaoDe(x.analise) : null;
          return (
            <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-texto">{rotuloDaAula(x)}</span>
                <span className="text-texto-sec">
                  {" "}
                  · {dataCurta(x.data)} · {ROTULO_STATUS_AULA[x.status]}
                </span>
              </span>
              {disponivel ? (
                <Button type="button" size="sm" onClick={() => onEscolher(ficha.data!, x)}>
                  Analisar esta aula
                </Button>
              ) : (
                <span className={cn("text-xs font-medium", situacao ? COR_SITUACAO[situacao] : "text-texto-sec")}>
                  {situacao ? ROTULO_SITUACAO_ANALISE[situacao] : "Situação não carregada"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Busca de aluno por nome (GET /alunos/opcoes?busca=), com 2 letras ou mais.
function BuscaDeAluno({
  id,
  rotulo,
  onEscolher,
  lista = false,
}: {
  id: string;
  rotulo: string;
  onEscolher: (a: OpcaoAluno) => void;
  lista?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermo(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);
  const valido = termo.length >= BUSCA_MINIMA;
  const opcoes = useQuery({ queryKey: [...CHAVES.alunos, "opcoes", termo], queryFn: () => buscarOpcoesAlunos(termo), enabled: valido, retry: false });
  return (
    <div className={cn("relative", lista && "space-y-2")}>
      <label htmlFor={id} className={lista ? "text-xs font-medium text-texto-sec" : "sr-only"}>
        {rotulo}
      </label>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-texto-sec" aria-hidden />
        <input id={id} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite 2 letras ou mais" autoComplete="off" className={cn(CAMPO, "pl-7")} />
      </span>
      {valido && (
        <ul
          className={cn(
            "max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-painel text-sm",
            !lista && "absolute left-0 right-0 top-full z-30 mt-1 shadow-layered",
          )}
          aria-label="Alunos encontrados"
        >
          {opcoes.isLoading ? (
            <li className="px-3 py-2 text-texto-sec">Buscando…</li>
          ) : !opcoes.data?.length ? (
            <li className="px-3 py-2 text-texto-sec">{opcoes.isError ? "Não foi possível buscar." : "Nenhum aluno com esse nome."}</li>
          ) : (
            opcoes.data.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onEscolher(a)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
                  <span className="font-medium text-texto">{a.nome}</span>
                  <span className="text-xs text-texto-sec">
                    {" "}
                    · {[a.mentoria, a.etapa.nome].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

