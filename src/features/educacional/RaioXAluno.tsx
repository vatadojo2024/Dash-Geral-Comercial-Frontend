"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeft, CheckCircle2, PencilLine, Plus, RotateCcw, Undo2 } from "lucide-react";
import {
  ajustarCampo,
  arquivarAluno,
  arquivarIntervencao,
  atualizarAluno,
  atualizarIntervencao,
  buscarAluno,
  EducacionalError,
} from "@/lib/educacional/apiEducacional";
import {
  AUTORIZACOES_PROVA_SOCIAL,
  FAIXAS_SAUDE,
  MOTIVO_MINIMO,
  NIVEIS_INICIAIS,
  SINAIS,
  STATUS_ALUNO,
  type AlunoDetalhe,
  type CampoAjustavel,
  type CamposDiretosAluno,
  type Config,
  type Intervencao,
} from "@/lib/educacional/contrato";
import {
  dataCurta,
  dataHoraBr,
  PASSOS,
  PONTO_DO_TOM,
  reais,
  ROTULO_AUTORIZACAO,
  ROTULO_FAIXA,
  ROTULO_FINANCEIRO,
  ROTULO_NIVEL,
  ROTULO_PASSO,
  ROTULO_SINAL,
  ROTULO_STATUS_ALUNO,
  ROTULO_STATUS_INTERVENCAO,
  ROTULO_TIPO_RESPONSAVEL,
  TOM_FAIXA,
} from "@/lib/educacional/rotulos";
import { Alternador } from "@/components/ui/Alternador";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSession } from "@/features/session/SessionProvider";
import { cn } from "@/lib/utils/cn";
import { BlocoEditavel, CampoCalculadoView, ConfirmarAcao } from "./Blocos";
import { AJUSTE_AFETA_TOTAIS, campoDe, comCampo, EDITOR_DO_CAMPO, rotuloDoCampo } from "./campos";
import { Timeline } from "./Checkpoints";
import { ativos, CHAVES, etapasAtivas, useConfig } from "./dados";
import { CAMPO } from "./Dialogo";
import { Sugestoes } from "./Edicao";
import { lerSimular } from "./estado";
import { HistoricoDoAluno } from "./Historico";
import { NovaIntervencao } from "./NovaIntervencao";
import { EtiquetaDemonstracao, Faixa, mensagemDoErro, NomeResponsavel, useRedirecionarSeSemPermissao } from "./partes";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Raio-X do aluno (spec Fase 2, seção 5) — /educacional/alunos/[id]. Todos os
// blocos têm "Editar"; campos diretos gravam com PATCH, campos calculados
// viram ajuste manual (motivo obrigatório). Aba Histórico. "Voltar" devolve a
// Tabela tática exatamente como estava (`?voltar=`).
// ---------------------------------------------------------------------------

type Aba = "raiox" | "historico";

export function RaioXAluno({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const simular = lerSimular(searchParams);
  const voltar = searchParams.get("voltar");
  const hrefVoltar = `/educacional${voltar ? `?${voltar}` : ""}#tabela-tatica`;
  const [aba, setAba] = useState<Aba>("raiox");
  const [intervencao, setIntervencao] = useState<Intervencao | "nova" | null>(null);
  const [arquivar, setArquivar] = useState(false);
  const gravar = useGravacao();
  const config = useConfig();

  const consulta = useQuery({
    queryKey: [...CHAVES.aluno(id), simular],
    queryFn: () => buscarAluno(id, simular),
    retry: false,
  });
  const semPermissao = useRedirecionarSeSemPermissao([consulta.error]);
  if (semPermissao) return null;

  const a = consulta.data;
  const naoEncontrado = consulta.error instanceof EducacionalError && consulta.error.status === 404;

  const alternarArquivo = (alvo: AlunoDetalhe, arquivado: boolean) =>
    void gravar({
      alunoId: alvo.id,
      versao: alvo.versao,
      executar: (v) => arquivarAluno(alvo.id, v, arquivado),
      noAluno: (d) => ({ ...d, arquivado }),
      naLinha: (l) => ({ ...l, arquivado }),
      afetaTotais: true,
    });

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
          {a.arquivado && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-texto" role="status">
              <Archive className="h-4 w-4 text-texto-sec" aria-hidden />
              Aluno arquivado: não aparece no Cockpit, no Kanban nem na tabela padrão.
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => alternarArquivo(a, false)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reativar
              </Button>
            </div>
          )}
          <Cabecalho
            a={a}
            config={config.data}
            acoes={
              <>
                <Button size="sm" onClick={() => setIntervencao("nova")}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Nova intervenção
                </Button>
                {!a.arquivado && (
                  <Button size="sm" variant="outline" onClick={() => setArquivar(true)}>
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                    Arquivar aluno
                  </Button>
                )}
              </>
            }
          />
          <Alternador<Aba>
            rotulo="Seção do raio-X"
            valor={aba}
            onChange={setAba}
            opcoes={[
              { valor: "raiox", label: "Raio-X" },
              { valor: "historico", label: "Histórico" },
            ]}
          />
          {aba === "historico" ? (
            <HistoricoDoAluno alunoId={a.id} />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Indicadores a={a} />
                <Contrato a={a} />
                <Sinais a={a} />
              </div>
              <Timeline a={a} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Progresso a={a} />
                <Diagnostico a={a} config={config.data} />
              </div>
              <Intervencoes a={a} onEditar={(i) => setIntervencao(i)} onNova={() => setIntervencao("nova")} />
            </>
          )}
        </div>
      )}

      {a && (
        <>
          <NovaIntervencao
            aberto={intervencao !== null}
            alunoInicial={{ id: a.id, nome: a.nome, versao: a.versao }}
            intervencao={intervencao === "nova" ? null : intervencao}
            onFechar={() => setIntervencao(null)}
          />
          <ConfirmarAcao
            aberto={arquivar}
            titulo="Arquivar aluno?"
            texto={`${a.nome} sai do Cockpit, do Kanban e da tabela padrão. Nada é apagado: dá para reativar pelo filtro “Mostrar arquivados”.`}
            confirmar="Arquivar"
            perigo
            onConfirmar={() => alternarArquivo(a, true)}
            onFechar={() => setArquivar(false)}
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Edição de bloco: campos diretos (PATCH) + campos calculados (um ajuste por
// campo alterado, com o mesmo motivo). Grava em sequência, cada escrita com a
// versão devolvida pela anterior.
// ---------------------------------------------------------------------------

type Valores = Record<string, string>;

function texto(v: unknown): string {
  return v == null ? "" : String(v);
}

function lerAjuste(campo: CampoAjustavel, bruto: string): { ok: true; v: unknown } | { ok: false; erro: string } {
  const ed = EDITOR_DO_CAMPO[campo];
  if (ed.tipo === "numero") {
    const n = Number(bruto.replace(",", "."));
    if (!Number.isFinite(n) || n < ed.min || (ed.max != null && n > ed.max)) {
      return { ok: false, erro: `${rotuloDoCampo(campo)}: use ${ed.max != null ? `de ${ed.min} a ${ed.max}` : `${ed.min} ou mais`}.` };
    }
    return { ok: true, v: n };
  }
  if (ed.tipo === "booleano") return { ok: true, v: bruto === "true" };
  return { ok: true, v: bruto };
}

// Otimista dos campos diretos (só o que foi digitado; o resto vem da API).
function comDiretos(d: AlunoDetalhe, c: CamposDiretosAluno, config: Config | undefined): AlunoDetalhe {
  const n: AlunoDetalhe = { ...d };
  for (const [k, v] of Object.entries(c)) {
    if (k === "etapa_id") {
      const e = config?.etapas.find((x) => x.id === v);
      if (e) n.etapa = { id: e.id, nome: e.nome };
    } else if (k === "responsavel_id") {
      const r = config?.responsaveis.find((x) => x.id === v);
      n.responsavel = r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null;
    } else if (k === "proxima_acao" || k === "proxima_acao_prazo") {
      const descricao = (c.proxima_acao !== undefined ? c.proxima_acao : d.proxima_acao?.descricao) ?? null;
      const prazo = (c.proxima_acao_prazo !== undefined ? c.proxima_acao_prazo : d.proxima_acao?.prazo) ?? null;
      n.proxima_acao = descricao ? { descricao, prazo } : null;
    } else (n as Record<string, unknown>)[k] = v;
  }
  return n;
}

function useBloco(
  a: AlunoDetalhe,
  diretos: (keyof CamposDiretosAluno)[],
  ajustes: CampoAjustavel[],
  config?: Config,
  obrigatorios: (keyof CamposDiretosAluno)[] = [],
) {
  const gravar = useGravacao();
  const user = useSession();
  const [valores, setValores] = useState<Valores | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const atuais = (): Valores => {
    const v: Valores = {};
    const direto = a as unknown as Record<string, unknown>;
    for (const k of diretos) {
      if (k === "etapa_id") v[k] = a.etapa.id;
      else if (k === "responsavel_id") v[k] = a.responsavel?.id ?? "";
      else if (k === "proxima_acao") v[k] = a.proxima_acao?.descricao ?? "";
      else if (k === "proxima_acao_prazo") v[k] = a.proxima_acao?.prazo ?? "";
      else v[k] = texto(direto[k]);
    }
    for (const c of ajustes) v[c] = texto(campoDe(a, c)?.valor);
    return v;
  };

  const editar = () => {
    setValores(atuais());
    setMotivo("");
    setErro(null);
  };
  const cancelar = () => setValores(null);
  const set = (k: string, v: string) => setValores((x) => (x ? { ...x, [k]: v } : x));

  async function salvar() {
    if (!valores) return;
    const antes = atuais();
    const campos: CamposDiretosAluno = {};
    for (const k of diretos) {
      if (valores[k] === antes[k]) continue;
      if (obrigatorios.includes(k) && !valores[k].trim()) return setErro("Preencha os campos obrigatórios.");
      (campos as Record<string, unknown>)[k] = valores[k].trim() === "" ? null : valores[k].trim();
    }
    const mudados: { campo: CampoAjustavel; v: unknown }[] = [];
    for (const c of ajustes) {
      if (valores[c] === antes[c] || valores[c] === "") continue;
      const lido = lerAjuste(c, valores[c]);
      if (!lido.ok) return setErro(lido.erro);
      mudados.push({ campo: c, v: lido.v });
    }
    if (mudados.length && motivo.trim().length < MOTIVO_MINIMO) {
      return setErro(`Explique o motivo do ajuste (pelo menos ${MOTIVO_MINIMO} caracteres).`);
    }
    if (!Object.keys(campos).length && !mudados.length) return cancelar();

    setSalvando(true);
    setErro(null);
    let versao = a.versao;
    let ok = true;
    const falhou = (e: unknown) => {
      ok = false;
      if (e instanceof EducacionalError && e.status === 400) setErro(e.corpo.mensagem ?? e.message);
      else setValores(null); // 409/rede: o aviso já explica; o aluno foi recarregado
    };
    if (Object.keys(campos).length) {
      const r = await gravar({
        alunoId: a.id,
        versao,
        executar: (v) => atualizarAluno(a.id, v, campos),
        noAluno: (d) => comDiretos(d, campos, config),
        naLinha: (l) => ({ ...l, ...comDiretos(l as AlunoDetalhe, campos, config) }),
        afetaTotais: "etapa_id" in campos || "status_aluno" in campos,
      });
      if (r.ok) versao = r.aluno.versao;
      else falhou(r.erro);
    }
    for (const m of mudados) {
      if (!ok) break;
      const automatico = campoDe(a, m.campo)?.automatico ?? null;
      const ajuste = { valor: m.v, motivo: motivo.trim(), ajustado_por: { id: user.id, nome: user.nome }, ajustado_em: new Date().toISOString() };
      const novo = { valor: m.v, automatico, ajuste };
      const r = await gravar({
        alunoId: a.id,
        versao,
        executar: (v) => ajustarCampo(a.id, v, m.campo, m.v, motivo.trim()),
        noAluno: (d) => comCampo(d, m.campo, novo),
        naLinha: (l) => comCampo(l, m.campo, novo),
        afetaTotais: AJUSTE_AFETA_TOTAIS.has(m.campo),
      });
      if (r.ok) versao = r.aluno.versao;
      else falhou(r.erro);
    }
    setSalvando(false);
    if (ok) setValores(null);
  }

  return {
    editando: valores !== null,
    valores: valores ?? {},
    set,
    motivo,
    setMotivo,
    erro,
    salvando,
    editar,
    cancelar,
    salvar,
  };
}

type Bloco = ReturnType<typeof useBloco>;

function props(b: Bloco) {
  return {
    editando: b.editando,
    salvando: b.salvando,
    erro: b.erro,
    onEditar: b.editar,
    onCancelar: b.cancelar,
    onSalvar: () => void b.salvar(),
  };
}

// ---------- entradas ----------

// Nome acessível explícito: o <label> em volta de um <select> somaria o texto das opções.
const nomeAcessivel = (rotulo: string) => rotulo.replace(/\s*\*$/, "");

function Entrada({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-texto-sec", className)}>
      {rotulo}
      {children}
    </label>
  );
}

function Texto({
  b,
  k,
  rotulo,
  area = false,
  tipo = "text",
  className,
  sugestoes,
}: {
  b: Bloco;
  k: string;
  rotulo: string;
  area?: boolean;
  tipo?: string;
  className?: string;
  sugestoes?: readonly string[];
}) {
  const lista = useId();
  return (
    <Entrada rotulo={rotulo} className={className}>
      {area ? (
        <textarea
          aria-label={nomeAcessivel(rotulo)}
          rows={3}
          value={b.valores[k] ?? ""}
          onChange={(e) => b.set(k, e.target.value)}
          className={cn(CAMPO, "h-auto py-2")}
        />
      ) : (
        <>
          <input
            aria-label={nomeAcessivel(rotulo)}
            type={tipo}
            value={b.valores[k] ?? ""}
            onChange={(e) => b.set(k, e.target.value)}
            list={sugestoes?.length ? lista : undefined}
            autoComplete={sugestoes?.length ? "off" : undefined}
            className={CAMPO}
          />
          <Sugestoes id={lista} opcoes={sugestoes} />
        </>
      )}
    </Entrada>
  );
}

function Lista({
  b,
  k,
  rotulo,
  opcoes,
  vazio,
}: {
  b: Bloco;
  k: string;
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  vazio?: string;
}) {
  return (
    <Entrada rotulo={rotulo}>
      <select aria-label={nomeAcessivel(rotulo)} value={b.valores[k] ?? ""} onChange={(e) => b.set(k, e.target.value)} className={CAMPO}>
        {vazio != null && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Entrada>
  );
}

function Ajustavel({ b, campo, rotulo }: { b: Bloco; campo: CampoAjustavel; rotulo?: string }) {
  const ed = EDITOR_DO_CAMPO[campo];
  const nome = rotulo ?? rotuloDoCampo(campo);
  if (ed.tipo === "lista" || ed.tipo === "booleano") {
    const opcoes =
      ed.tipo === "lista"
        ? ed.opcoes
        : [
            { valor: "true", rotulo: "Sim" },
            { valor: "false", rotulo: "Não" },
          ];
    return <Lista b={b} k={campo} rotulo={nome} opcoes={opcoes} vazio="Sem cálculo" />;
  }
  return (
    <Entrada rotulo={nome}>
      <input
        aria-label={nome}
        type={ed.tipo === "data" ? "date" : "number"}
        inputMode={ed.tipo === "numero" ? "decimal" : undefined}
        min={ed.tipo === "numero" ? ed.min : undefined}
        max={ed.tipo === "numero" ? ed.max : undefined}
        step={ed.tipo === "numero" ? (ed.passo ?? 1) : undefined}
        value={b.valores[campo] ?? ""}
        onChange={(e) => b.set(campo, e.target.value)}
        className={CAMPO}
      />
    </Entrada>
  );
}

function MotivoDoAjuste({ b }: { b: Bloco }) {
  return (
    <Entrada rotulo="Motivo do ajuste (obrigatório se mudar um valor calculado)">
      <textarea aria-label="Motivo do ajuste" rows={2} value={b.motivo} onChange={(e) => b.setMotivo(e.target.value)} className={cn(CAMPO, "h-auto py-2")} />
    </Entrada>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-texto-sec">{rotulo}</dt>
      <dd className="text-texto">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------

const CABECALHO: (keyof CamposDiretosAluno)[] = [
  "nome",
  "mentoria",
  "data_entrada",
  "data_termino",
  "objetivo",
  "status_aluno",
  "nivel_inicial",
  "etapa_id",
];

function Cabecalho({ a, config, acoes }: { a: AlunoDetalhe; config?: Config; acoes: ReactNode }) {
  const b = useBloco(a, CABECALHO, [], config, ["nome", "mentoria", "data_entrada"]);
  const etapas = etapasAtivas(config);
  if (!etapas.some((e) => e.id === a.etapa.id)) etapas.push({ id: a.etapa.id, nome: a.etapa.nome, ordem: 999, ativo: false });
  return (
    <BlocoEditavel
      titulo="Raio-X do aluno"
      {...props(b)}
      acoes={acoes}
      leitura={
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">{a.nome}</h1>
            <span className="tag">{ROTULO_STATUS_ALUNO[a.status_aluno]}</span>
            <EtiquetaDemonstracao />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <Dado rotulo="Mentoria">{a.mentoria}</Dado>
            <Dado rotulo="Entrada">{dataCurta(a.data_entrada)}</Dado>
            <Dado rotulo="Término">{dataCurta(a.data_termino)}</Dado>
            <Dado rotulo="Nível inicial">{ROTULO_NIVEL[a.nivel_inicial]}</Dado>
            <Dado rotulo="Etapa">{a.etapa.nome}</Dado>
          </dl>
          <p className="mt-3 text-sm">
            <span className="text-texto-sec">Objetivo: </span>
            <span className="text-texto">{a.objetivo ?? "Não informado"}</span>
          </p>
        </div>
      }
      edicao={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Texto b={b} k="nome" rotulo="Nome *" className="sm:col-span-2" />
          <Texto b={b} k="mentoria" rotulo="Mentoria *" sugestoes={config?.mentorias} />
          <Lista b={b} k="status_aluno" rotulo="Status do aluno" opcoes={STATUS_ALUNO.map((s) => ({ valor: s, rotulo: ROTULO_STATUS_ALUNO[s] }))} />
          <Texto b={b} k="data_entrada" rotulo="Data de entrada *" tipo="date" />
          <Texto b={b} k="data_termino" rotulo="Data de término" tipo="date" />
          <Lista b={b} k="nivel_inicial" rotulo="Nível inicial" opcoes={NIVEIS_INICIAIS.map((n) => ({ valor: n, rotulo: ROTULO_NIVEL[n] }))} />
          <Lista b={b} k="etapa_id" rotulo="Etapa" opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
          <Texto b={b} k="objetivo" rotulo="Objetivo" className="sm:col-span-2 lg:col-span-4" />
        </div>
      }
    />
  );
}

const INDICADORES: CampoAjustavel[] = ["health_score", "faixa_saude", "dias_na_etapa", "ultima_atividade", "dias_sem_atividade"];

function Indicadores({ a }: { a: AlunoDetalhe }) {
  const b = useBloco(a, ["motivo_risco"], INDICADORES);
  const faixa = a.faixa_saude.valor;
  return (
    <BlocoEditavel
      titulo="Indicadores"
      {...props(b)}
      leitura={
        <div className="space-y-4">
          <CampoCalculadoView
            aluno={a}
            campo="health_score"
            rotulo="Health Score"
            exibir={
              <p className={cn("text-4xl font-semibold tabular-nums", faixa === "risco" ? "text-erro" : "text-texto")}>
                {a.health_score.valor ?? "—"}
                <span className="text-base font-normal text-texto-sec">/100</span>
              </p>
            }
          />
          <CampoCalculadoView
            aluno={a}
            campo="faixa_saude"
            rotulo="Faixa de saúde"
            exibir={
              <>
                <div className="grid grid-cols-3 gap-1" role="img" aria-label={`Faixa de saúde: ${faixa ? ROTULO_FAIXA[faixa] : "sem cálculo"}`}>
                  {[...FAIXAS_SAUDE].reverse().map((n) => (
                    <span
                      key={n}
                      className={cn("h-2.5 rounded-full", PONTO_DO_TOM[TOM_FAIXA[n]], faixa === n ? "opacity-100 ring-2 ring-white/40" : "opacity-25")}
                    />
                  ))}
                </div>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Faixa faixa={faixa} />
                  {faixa === "risco" && <span className="tag tag-error">Risco de Evasão/Reembolso</span>}
                </span>
              </>
            }
          />
          <div className="grid grid-cols-2 gap-4">
            <CampoCalculadoView aluno={a} campo="dias_na_etapa" rotulo={`Dias em ${a.etapa.nome}`} />
            <CampoCalculadoView aluno={a} campo="dias_sem_atividade" rotulo="Dias sem atividade" />
            <CampoCalculadoView aluno={a} campo="ultima_atividade" rotulo="Última atividade" />
          </div>
          <div>
            <p className="text-xs text-texto-sec">Motivo do risco</p>
            <p className="mt-0.5 text-sm text-texto">{a.motivo_risco ?? <span className="text-texto-sec">Não informado.</span>}</p>
          </div>
        </div>
      }
      edicao={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Ajustavel b={b} campo="health_score" />
            <Ajustavel b={b} campo="faixa_saude" />
            <Ajustavel b={b} campo="dias_na_etapa" />
            <Ajustavel b={b} campo="dias_sem_atividade" />
            <Ajustavel b={b} campo="ultima_atividade" />
          </div>
          <MotivoDoAjuste b={b} />
          <Texto b={b} k="motivo_risco" rotulo="Motivo do risco" area />
        </div>
      }
    />
  );
}

function Contrato({ a }: { a: AlunoDetalhe }) {
  const b = useBloco(a, [], ["status_financeiro", "ltv"]);
  const financeiro = a.status_financeiro.valor;
  return (
    <BlocoEditavel
      titulo="Contrato"
      {...props(b)}
      leitura={
        <div className="space-y-4">
          <CampoCalculadoView
            aluno={a}
            campo="status_financeiro"
            rotulo="Status financeiro"
            exibir={
              financeiro ? (
                <span className={cn("tag", financeiro === "inadimplente" ? "tag-error" : "tag-success")}>{ROTULO_FINANCEIRO[financeiro]}</span>
              ) : (
                <span className="text-sm text-texto-sec">Sem informação</span>
              )
            }
          />
          <CampoCalculadoView
            aluno={a}
            campo="ltv"
            rotulo="LTV"
            exibir={<p className="text-2xl font-semibold tabular-nums text-texto">{a.ltv.valor != null ? reais(a.ltv.valor) : "—"}</p>}
          />
        </div>
      }
      edicao={
        <div className="space-y-3">
          <Ajustavel b={b} campo="status_financeiro" />
          <Ajustavel b={b} campo="ltv" rotulo="LTV (R$)" />
          <MotivoDoAjuste b={b} />
        </div>
      }
    />
  );
}

const CAMPO_DO_SINAL = { upgrade: "sinal_upgrade", renovacao: "sinal_renovacao", prova_social: "sinal_prova_social" } as const;

function Sinais({ a }: { a: AlunoDetalhe }) {
  const b = useBloco(a, ["autorizacao_prova_social", "observacoes"], Object.values(CAMPO_DO_SINAL));
  return (
    <BlocoEditavel
      titulo="Sinais e prova social"
      subtitulo="Sinais para o Comercial."
      {...props(b)}
      leitura={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {SINAIS.map((s) => (
              <CampoCalculadoView
                key={s}
                aluno={a}
                campo={CAMPO_DO_SINAL[s]}
                rotulo={ROTULO_SINAL[s]}
                exibir={
                  a.sinais[s].valor ? (
                    <span className="tag tag-info">Sim</span>
                  ) : (
                    <span className="text-sm text-texto-sec">{a.sinais[s].valor === false ? "Não" : "Sem cálculo"}</span>
                  )
                }
              />
            ))}
          </div>
          <dl className="grid gap-2 text-sm">
            <Dado rotulo="Autorização de prova social">{ROTULO_AUTORIZACAO[a.autorizacao_prova_social]}</Dado>
            <Dado rotulo="Observações">{a.observacoes ?? <span className="text-texto-sec">—</span>}</Dado>
          </dl>
        </div>
      }
      edicao={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Ajustavel b={b} campo="sinal_upgrade" />
            <Ajustavel b={b} campo="sinal_renovacao" />
            <Ajustavel b={b} campo="sinal_prova_social" />
          </div>
          <MotivoDoAjuste b={b} />
          <Lista
            b={b}
            k="autorizacao_prova_social"
            rotulo="Autorização de prova social"
            opcoes={AUTORIZACOES_PROVA_SOCIAL.map((s) => ({ valor: s, rotulo: ROTULO_AUTORIZACAO[s] }))}
          />
          <Texto b={b} k="observacoes" rotulo="Observações" area />
        </div>
      }
    />
  );
}

const CAMPO_DO_PASSO = {
  consumiu: "progresso_consumiu",
  entendeu: "progresso_entendeu",
  aplicou: "progresso_aplicou",
  validou: "progresso_validou",
} as const;

function Progresso({ a }: { a: AlunoDetalhe }) {
  const b = useBloco(a, [], Object.values(CAMPO_DO_PASSO));
  return (
    <BlocoEditavel
      titulo="Progresso metodológico"
      subtitulo={`Na etapa atual: ${a.etapa.nome}. Notas de 0 a 100.`}
      {...props(b)}
      leitura={
        <div className="space-y-5">
          <ul className="space-y-3" aria-label="Notas do progresso">
            {PASSOS.map((p) => {
              const c = a.progresso[p];
              return (
                <li key={p} className="grid grid-cols-[1fr_auto] items-start gap-x-3">
                  <CampoCalculadoView
                    aluno={a}
                    campo={CAMPO_DO_PASSO[p]}
                    rotulo={ROTULO_PASSO[p]}
                    exibir={
                      <span className="block h-2 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-sucesso" style={{ width: `${c.valor ?? 0}%` }} />
                      </span>
                    }
                  />
                  <span className="pt-4 text-right text-sm tabular-nums text-texto">{c.valor ?? "—"}</span>
                </li>
              );
            })}
          </ul>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-sec">Highlights das aulas</p>
            {a.highlights.length === 0 ? (
              <p className="text-sm text-texto-sec">Sem análises de aula disponíveis</p>
            ) : (
              <ul className="space-y-2">
                {a.highlights.map((h, i) => (
                  <li key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="mr-2 text-xs tabular-nums text-texto-sec">{dataCurta(h.data_aula)}</span>
                    <span className="text-texto">{h.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      }
      edicao={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {PASSOS.map((p) => (
              <Ajustavel key={p} b={b} campo={CAMPO_DO_PASSO[p]} rotulo={`${ROTULO_PASSO[p]} (0–100)`} />
            ))}
          </div>
          <MotivoDoAjuste b={b} />
        </div>
      }
    />
  );
}

function Diagnostico({ a, config }: { a: AlunoDetalhe; config?: Config }) {
  const b = useBloco(a, ["diagnostico", "proxima_acao", "proxima_acao_prazo", "responsavel_id"], [], config);
  const responsaveis = ativos(config?.responsaveis);
  if (a.responsavel && !responsaveis.some((r) => r.id === a.responsavel?.id)) responsaveis.push({ ...a.responsavel, ativo: false });
  return (
    <BlocoEditavel
      titulo="Diagnóstico e próxima ação"
      {...props(b)}
      leitura={
        <div className="space-y-4 text-sm">
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
        </div>
      }
      edicao={
        <div className="space-y-3">
          <Texto b={b} k="diagnostico" rotulo="Diagnóstico" area />
          <Texto b={b} k="proxima_acao" rotulo="Próxima ação" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Texto b={b} k="proxima_acao_prazo" rotulo="Prazo" tipo="date" />
            <Lista
              b={b}
              k="responsavel_id"
              rotulo="Responsável"
              vazio="Sem responsável"
              opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${ROTULO_TIPO_RESPONSAVEL[r.tipo]}` }))}
            />
          </div>
        </div>
      }
    />
  );
}

// Intervenções: criar, editar, concluir, reabrir, arquivar (mais recente primeiro — ordem da API).
function Intervencoes({ a, onEditar, onNova }: { a: AlunoDetalhe; onEditar: (i: Intervencao) => void; onNova: () => void }) {
  const gravar = useGravacao();
  const [arquivar, setArquivar] = useState<Intervencao | null>(null);

  const mudarStatus = (i: Intervencao, status: "aberta" | "concluida") =>
    void gravar({
      alunoId: a.id,
      versao: a.versao,
      executar: (v) => atualizarIntervencao(i.id, v, { status }),
      noAluno: (d) => ({
        ...d,
        intervencoes: d.intervencoes.map((x) =>
          x.id === i.id ? { ...x, status, concluida_em: status === "concluida" ? new Date().toISOString() : null } : x,
        ),
      }),
    });

  const confirmarArquivar = (i: Intervencao) =>
    void gravar({
      alunoId: a.id,
      versao: a.versao,
      executar: (v) => arquivarIntervencao(i.id, v),
      noAluno: (d) => ({ ...d, intervencoes: d.intervencoes.filter((x) => x.id !== i.id) }),
    });

  return (
    <Card>
      <CardHeader
        title="Intervenções"
        subtitle="Mais recente primeiro."
        action={
          <Button variant="secondary" size="sm" onClick={onNova}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova intervenção
          </Button>
        }
      />
      <CardContent>
        {a.intervencoes.length === 0 ? (
          <p className="text-sm text-texto-sec">Nenhuma intervenção registrada.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {a.intervencoes.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:gap-4">
                <span className="flex shrink-0 gap-1.5 self-start">
                  <span className="tag">{i.tipo.nome}</span>
                  <span className={cn("tag", i.status === "concluida" ? "tag-success" : "tag-info")}>{ROTULO_STATUS_INTERVENCAO[i.status]}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm text-texto", i.status === "concluida" && "text-texto-sec")}>{i.descricao}</p>
                  <p className="mt-0.5 text-xs text-texto-sec">
                    <NomeResponsavel responsavel={i.responsavel} /> · prazo {dataCurta(i.prazo)} · criada por {i.criada_por.nome} em{" "}
                    {dataHoraBr(i.criada_em)}
                    {i.concluida_em && <> · concluída em {dataHoraBr(i.concluida_em)}</>}
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap gap-1">
                  {i.status === "aberta" ? (
                    <Button variant="ghost" size="sm" onClick={() => mudarStatus(i, "concluida")}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Concluir
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => mudarStatus(i, "aberta")}>
                      <Undo2 className="h-3.5 w-3.5" aria-hidden />
                      Reabrir
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onEditar(i)} aria-label={`Editar intervenção: ${i.descricao}`}>
                    <PencilLine className="h-3.5 w-3.5" aria-hidden />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setArquivar(i)} aria-label={`Arquivar intervenção: ${i.descricao}`}>
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                    Arquivar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmarAcao
        aberto={arquivar !== null}
        titulo="Arquivar intervenção?"
        texto="Ela sai da lista do aluno. Continua no banco e no histórico."
        confirmar="Arquivar"
        onConfirmar={() => arquivar && confirmarArquivar(arquivar)}
        onFechar={() => setArquivar(null)}
      />
    </Card>
  );
}
