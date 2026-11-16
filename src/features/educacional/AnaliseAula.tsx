"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, Loader2, PencilLine, Sparkles, X } from "lucide-react";
import {
  ANALISE_NAO_CONFIGURADA,
  buscarAnaliseAula,
  configAusente,
  criarAnaliseAula,
  decidirAnalise,
  EducacionalError,
  FORMATOS_ANALISE,
  listarAnalisesDaAula,
} from "@/lib/educacional/apiEducacional";
import type { AlunoDetalhe, AnaliseAula, Aula, CheckpointSugerido, Evidencia, PropostaAnalise } from "@/lib/educacional/contrato";
import { dataCurta, rotuloDaAula, ROTULO_PASSO } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/features/session/SessionProvider";
import {
  checkpointsInformativos,
  checkpointsParaDecidir,
  corpoDaDecisao,
  decidida,
  notaValida,
  pilaresDaProposta,
  podeAplicar,
  rotuloDaSituacao,
  rotuloDoAlerta,
  ROTULO_CONFIANCA,
  SEM_DECISOES,
  situacaoDaAnalise,
  temAlgoParaDecidir,
  type Decisoes,
  type EscolhaPilar,
} from "./revisaoAnalise";
import { useAvisos } from "./Avisos";
import { CHAVES } from "./dados";
import { CAMPO, Dialogo, ErroDoEnvio } from "./Dialogo";
import { avisarGravacao } from "./lote/eventos";
import { trocarAlunoNoCache } from "./useGravacao";

// ---------------------------------------------------------------------------
// Análise de aula com IA (16/11/2026): a transcrição de uma aula vai para a IA,
// que PROPÕE as notas de Entendeu, Aplicou e Validou e os checkpoints que
// parecem cumpridos. Nada entra na ficha sem a pessoa decidir pilar a pilar
// ("Aplicar decisões" manda tudo de uma vez, pela versão do aluno). Enquanto
// processa, consulta a cada 5 s. A transcrição nunca volta da API.
// ---------------------------------------------------------------------------

const CONSULTA_MS = 5000;

// Situação da análise mais recente da aula, na linha da tabela. Lê o que já foi
// buscado (ao abrir o painel ou ao aplicar): não pede uma lista por aula.
export function SituacaoDaAnalise({ aulaId }: { aulaId: string }) {
  const user = useSession();
  const lista = useQuery({
    queryKey: CHAVES.analisesDaAula(aulaId),
    queryFn: () => listarAnalisesDaAula(aulaId),
    enabled: false,
  });
  const texto = situacaoDaAnalise(lista.data?.[0], user);
  if (!texto) return null;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-azul-claro">
      <Sparkles className="h-3 w-3" aria-hidden />
      {texto}
    </span>
  );
}

export function BotaoAnalisarAula({ aluno, aula }: { aluno: AlunoDetalhe; aula: Aula }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setAberto(true)} aria-label={`Analisar a ${rotuloDaAula(aula)} com IA`} title="Analisar com IA">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden xl:inline">Analisar com IA</span>
      </Button>
      {aberto && <PainelAnaliseAula aluno={aluno} aula={aula} onFechar={() => setAberto(false)} />}
    </>
  );
}

function PainelAnaliseAula({ aluno, aula, onFechar }: { aluno: AlunoDetalhe; aula: Aula; onFechar: () => void }) {
  const qc = useQueryClient();
  const lista = useQuery({
    queryKey: CHAVES.analisesDaAula(aula.id),
    queryFn: () => listarAnalisesDaAula(aula.id),
    retry: false,
  });
  // A que acabou de ser criada aqui, ou a mais recente da aula.
  const [criada, setCriada] = useState<string | null>(null);
  const [novaAnalise, setNovaAnalise] = useState(false);
  const atualId = criada ?? lista.data?.[0]?.id ?? null;
  const analise = useQuery({
    queryKey: CHAVES.analise(atualId ?? ""),
    queryFn: () => buscarAnaliseAula(atualId!),
    enabled: Boolean(atualId) && !novaAnalise,
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === "processando" ? CONSULTA_MS : false),
  });
  const status = analise.data?.status;
  // Terminou de processar: a lista (e a linha da aula) passa a mostrar o estado novo.
  useEffect(() => {
    if (status && status !== "processando") void qc.invalidateQueries({ queryKey: CHAVES.analisesDaAula(aula.id) });
  }, [status, qc, aula.id]);

  const titulo = `Análise com IA · ${rotuloDaAula(aula)}`;
  const subtitulo = `${aluno.nome} · aula de ${dataCurta(aula.data)}`;
  const fechar = <Button type="button" variant="ghost" onClick={onFechar}>Fechar</Button>;

  let corpo: ReactNode;
  let rodape: ReactNode = fechar;
  if (lista.isLoading || (atualId && !novaAnalise && analise.isLoading)) {
    corpo = <Espera texto="Carregando…" />;
  } else if (lista.isError || (!novaAnalise && analise.isError)) {
    corpo = <ErroDoEnvio texto="Não foi possível carregar a análise desta aula. Tente de novo." />;
    rodape = (
      <>
        {fechar}
        <Button type="button" onClick={() => void (lista.isError ? lista.refetch() : analise.refetch())}>
          Tentar de novo
        </Button>
      </>
    );
  } else if (novaAnalise || !atualId || !analise.data) {
    return (
      <EnvioDaTranscricao
        aula={aula}
        titulo={titulo}
        subtitulo={subtitulo}
        onFechar={onFechar}
        onVoltar={atualId ? () => setNovaAnalise(false) : undefined}
        onCriada={(id) => {
          setCriada(id);
          setNovaAnalise(false);
          void qc.invalidateQueries({ queryKey: CHAVES.analisesDaAula(aula.id) });
        }}
      />
    );
  } else if (analise.data.status === "processando") {
    corpo = (
      <Espera texto="Analisando a aula…">
        Pode levar alguns minutos. Pode fechar: a análise continua e aparece aqui quando ficar pronta.
      </Espera>
    );
  } else if (analise.data.status === "erro") {
    corpo = <ErroDoEnvio texto={`A análise não terminou. ${analise.data.erro ?? "Motivo não informado."}`} />;
    rodape = (
      <>
        {fechar}
        <Button type="button" onClick={() => setNovaAnalise(true)}>
          Tentar de novo
        </Button>
      </>
    );
  } else if (decidida(analise.data) || !analise.data.analise) {
    corpo = <AnaliseDecidida analise={analise.data} />;
    rodape = (
      <>
        {fechar}
        <Button type="button" variant="secondary" onClick={() => setNovaAnalise(true)}>
          Nova análise desta aula
        </Button>
      </>
    );
  } else {
    return (
      <Revisao
        aluno={aluno}
        analise={analise.data}
        proposta={analise.data.analise}
        titulo={titulo}
        subtitulo={subtitulo}
        onFechar={onFechar}
      />
    );
  }
  return (
    <Dialogo aberto titulo={titulo} subtitulo={subtitulo} onFechar={onFechar} rodape={rodape} largura="max-w-3xl">
      {corpo}
    </Dialogo>
  );
}

function Espera({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-azul-claro" aria-hidden />
      <p className="text-sm font-medium text-texto">{texto}</p>
      {children && <p className="max-w-sm text-xs text-texto-sec">{children}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Envio: colar o texto ou mandar o arquivo (.txt ou .docx; o backend lê o .docx).
// ---------------------------------------------------------------------------

function EnvioDaTranscricao({
  aula,
  titulo,
  subtitulo,
  onFechar,
  onVoltar,
  onCriada,
}: {
  aula: Aula;
  titulo: string;
  subtitulo: string;
  onFechar: () => void;
  onVoltar?: () => void;
  onCriada: (id: string) => void;
}) {
  const id = useId();
  const [modo, setModo] = useState<"texto" | "arquivo">("texto");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (modo === "texto" ? !texto.trim() : !arquivo) {
      setErro(modo === "texto" ? "Cole o texto da transcrição." : "Escolha o arquivo da transcrição.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await criarAnaliseAula(aula.id, modo === "texto" ? { transcricao: texto } : { arquivo: arquivo! });
      onCriada(r.id);
    } catch (e) {
      setErro(mensagemDoEnvio(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      aberto
      titulo={titulo}
      subtitulo={subtitulo}
      onFechar={onFechar}
      onEnviar={() => void enviar()}
      largura="max-w-3xl"
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onVoltar ?? onFechar}>
            {onVoltar ? "Voltar" : "Cancelar"}
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {enviando ? "Enviando…" : "Analisar"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-texto-sec">
        A IA lê a transcrição e propõe as notas de Entendeu, Aplicou e Validou. Nada entra na ficha sem você aprovar.
      </p>
      <div role="radiogroup" aria-label="Como enviar a transcrição" className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["texto", "arquivo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            onClick={() => setModo(m)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", modo === m ? "bg-azul/20 text-texto" : "text-texto-sec hover:text-texto")}
          >
            {m === "texto" ? "Colar o texto" : "Enviar arquivo"}
          </button>
        ))}
      </div>
      {modo === "texto" ? (
        <div className="space-y-1">
          <label htmlFor={`${id}-texto`} className="text-xs font-medium text-texto-sec">
            Transcrição da aula
          </label>
          <textarea
            id={`${id}-texto`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={12}
            placeholder="00:01 Mentor: ..."
            className={cn(CAMPO, "h-auto py-2 font-mono text-xs leading-relaxed")}
          />
          <p className="text-xs text-texto-sec">{texto.trim().length.toLocaleString("pt-BR")} caracteres · mínimo de 200</p>
        </div>
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${id}-arquivo`} className="text-xs font-medium text-texto-sec">
            Arquivo da transcrição (.txt ou .docx, até 4 MB)
          </label>
          <input
            id={`${id}-arquivo`}
            type="file"
            accept={FORMATOS_ANALISE.join(",")}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-texto-sec file:mr-3 file:rounded-lg file:border-0 file:bg-azul/20 file:px-3 file:py-1.5 file:text-sm file:text-texto"
          />
        </div>
      )}
      <ErroDoEnvio texto={erro} />
    </Dialogo>
  );
}

export function mensagemDoEnvio(e: unknown): string {
  if (configAusente(e)) return ANALISE_NAO_CONFIGURADA;
  if (!(e instanceof EducacionalError)) return "Não foi possível enviar. Tente de novo.";
  if (e.rede) return "Sem conexão com o servidor. Tente de novo.";
  if (e.status === 413) return "O arquivo passa do limite. Envie um arquivo menor ou cole o texto.";
  if (e.status === 404) return "Esta aula não foi encontrada. Ela pode ter sido arquivada; recarregue a ficha.";
  if (e.status === 403) return "Sem permissão para analisar aulas.";
  return e.corpo.mensagem ?? e.message;
}

// ---------------------------------------------------------------------------
// Revisão: aviso de qualidade, alertas, resumo, destaques, pilares, checkpoints
// e pontos a reforçar, nesta ordem. "Aplicar decisões" manda tudo de uma vez.
// ---------------------------------------------------------------------------

function Revisao({
  aluno,
  analise,
  proposta: p,
  titulo,
  subtitulo,
  onFechar,
}: {
  aluno: AlunoDetalhe;
  analise: AnaliseAula;
  proposta: PropostaAnalise;
  titulo: string;
  subtitulo: string;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const avisar = useAvisos();
  const [d, setD] = useState<Decisoes>(SEM_DECISOES);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeDoCheckpoint = (cpId: string) => aluno.checkpoints.find((c) => c.id === cpId)?.nome ?? "Checkpoint do aluno";
  const descartes = p.descartes.length ? p.descartes : analise.descartes;
  const algo = temAlgoParaDecidir(p);
  const pronto = podeAplicar(p, d);

  async function aplicar() {
    if (!pronto) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await decidirAnalise(analise.id, corpoDaDecisao(p, d, aluno.versao, motivo));
      trocarAlunoNoCache(qc, r.aluno);
      avisarGravacao({ aluno: r.aluno, versaoEnviada: aluno.versao });
      qc.setQueryData(CHAVES.analise(analise.id), r.analise);
      void qc.invalidateQueries({ queryKey: CHAVES.analisesDaAula(analise.aula_id) });
      void qc.invalidateQueries({ queryKey: CHAVES.alunos });
      void qc.invalidateQueries({ queryKey: CHAVES.historico(aluno.id) });
      void qc.invalidateQueries({ queryKey: CHAVES.resumo });
      avisar({ tipo: "sucesso", texto: "Decisões aplicadas na ficha" });
    } catch (e) {
      if (e instanceof EducacionalError && e.status === 409 && e.corpo.error === "ja_decidida") {
        void qc.invalidateQueries({ queryKey: CHAVES.analise(analise.id) });
        void qc.invalidateQueries({ queryKey: CHAVES.analisesDaAula(analise.aula_id) });
        setErro("Esta análise já foi decidida por outra pessoa.");
      } else if (e instanceof EducacionalError && e.status === 409) {
        const atual = e.alunoAtual;
        if (atual) trocarAlunoNoCache(qc, atual);
        void qc.invalidateQueries({ queryKey: CHAVES.aluno(aluno.id) });
        setErro("A ficha deste aluno mudou enquanto você revisava e foi recarregada. Confira e aplique de novo.");
      } else if (e instanceof EducacionalError && e.rede) setErro("Sem conexão com o servidor. Tente de novo.");
      else if (e instanceof EducacionalError && e.status === 403) setErro("Sem permissão para decidir análises.");
      else setErro(e instanceof EducacionalError ? (e.corpo.mensagem ?? e.message) : "Não foi possível aplicar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const escolherPilar = (k: keyof Decisoes["pilares"], e: EscolhaPilar) => setD((x) => ({ ...x, pilares: { ...x.pilares, [k]: e } }));
  const escolherCheckpoint = (cpId: string, v: "aprovar" | "rejeitar") => setD((x) => ({ ...x, checkpoints: { ...x.checkpoints, [cpId]: v } }));

  return (
    <Dialogo
      aberto
      titulo={titulo}
      subtitulo={subtitulo}
      onFechar={onFechar}
      onEnviar={() => void aplicar()}
      largura="max-w-3xl"
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          <Button type="submit" disabled={!pronto || enviando} title={!algo ? "Nada a aplicar nesta análise" : undefined}>
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            {enviando ? "Aplicando…" : "Aplicar decisões"}
          </Button>
        </>
      }
    >
      {(p.aviso || (p.qualidade && p.qualidade !== "boa")) && (
        <Faixa tom="aviso" titulo={`Transcrição ${p.qualidade ? `com qualidade ${p.qualidade}` : "com aviso"}`}>
          {p.aviso}
        </Faixa>
      )}
      {p.alertas.length > 0 && (
        <section aria-label="Alertas" className="space-y-2">
          {p.alertas.map((a, i) => (
            <Faixa key={i} tom="alerta" titulo={rotuloDoAlerta(a.tipo)}>
              {a.descricao}
              {a.evidencia && <Trechos evidencias={[a.evidencia]} />}
            </Faixa>
          ))}
        </section>
      )}
      {p.resumo && (
        <Secao titulo="Resumo">
          <p className="text-sm leading-relaxed text-texto">{p.resumo}</p>
        </Secao>
      )}
      {p.highlights.length > 0 && (
        <Secao titulo="Destaques">
          <Lista itens={p.highlights} />
        </Secao>
      )}
      <Secao titulo="Pilares">
        <div className="space-y-3">
          {pilaresDaProposta(p).map((x) => (
            <CartaoPilar key={x.pilar} pilar={x} escolha={d.pilares[x.pilar]} onEscolher={(e) => escolherPilar(x.pilar, e)} />
          ))}
        </div>
      </Secao>
      {p.checkpoints.length > 0 && (
        <Secao titulo="Checkpoints sugeridos">
          <div className="space-y-2">
            {checkpointsParaDecidir(p).map((c) => (
              <CartaoCheckpoint key={c.id} c={c} nome={nomeDoCheckpoint(c.id)} escolha={d.checkpoints[c.id]} onEscolher={(v) => escolherCheckpoint(c.id, v)} />
            ))}
            {checkpointsInformativos(p).map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <span className="font-medium text-texto">{nomeDoCheckpoint(c.id)}</span>
                <span className="text-texto-sec"> · {rotuloDaSituacao(c.situacao)}</span>
                {c.justificativa && <p className="mt-0.5 text-xs text-texto-sec">{c.justificativa}</p>}
              </div>
            ))}
          </div>
        </Secao>
      )}
      {p.reforcar.length > 0 && (
        <Secao titulo="Pontos a reforçar na próxima aula">
          <Lista itens={p.reforcar} />
        </Secao>
      )}
      {descartes.length > 0 && (
        <p className="text-[11px] text-texto-sec" role="note">
          {descartes.length} {descartes.length === 1 ? "item foi descartado" : "itens foram descartados"} pela checagem do servidor:{" "}
          {descartes.join("; ")}.
        </p>
      )}
      {algo ? (
        <div className="space-y-1">
          <label htmlFor={`motivo-${analise.id}`} className="text-xs font-medium text-texto-sec">
            Observação para o histórico (opcional)
          </label>
          <input id={`motivo-${analise.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={CAMPO} />
        </div>
      ) : (
        <p className="text-sm text-texto-sec">Nada a aplicar: a IA não sugeriu nota nem checkpoint cumprido nesta aula.</p>
      )}
      <ErroDoEnvio texto={erro} />
    </Dialogo>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-texto-sec">{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-texto">
      {itens.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Faixa({ tom, titulo, children }: { tom: "aviso" | "alerta"; titulo: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        tom === "alerta" ? "border-erro-forte/40 bg-erro-forte/10" : "border-amarelo/40 bg-amarelo/10",
      )}
      role={tom === "alerta" ? "alert" : "note"}
    >
      <p className={cn("flex items-center gap-1.5 font-semibold", tom === "alerta" ? "text-erro" : "text-amarelo")}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        {titulo}
      </p>
      {children && <div className="mt-0.5 text-texto">{children}</div>}
    </div>
  );
}

function Trechos({ evidencias }: { evidencias: Evidencia[] }) {
  if (!evidencias.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {evidencias.map((e, i) => (
        <li key={i} className="text-xs text-texto-sec">
          {e.momento && <span className="mr-1.5 font-mono tabular-nums text-azul-claro">{e.momento}</span>}
          <q className="italic">{e.trecho}</q>
        </li>
      ))}
    </ul>
  );
}

const nota = (n: number | null) => (n == null ? "—" : String(Math.round(n)));

function CartaoPilar({
  pilar: x,
  escolha,
  onEscolher,
}: {
  pilar: ReturnType<typeof pilaresDaProposta>[number];
  escolha?: EscolhaPilar;
  onEscolher: (e: EscolhaPilar) => void;
}) {
  const id = useId();
  const rotulo = ROTULO_PASSO[x.pilar];
  const semEvidencia = x.notaSugerida == null;
  const notaInvalida = escolha?.decisao === "editar" && notaValida(escolha.nota) == null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" data-pilar={x.pilar}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-texto">{rotulo}</p>
        <p className="flex items-center gap-1.5 text-sm tabular-nums">
          <span className="text-texto-sec">Atual {nota(x.notaAtual)}</span>
          {!semEvidencia && (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-texto-sec" aria-hidden />
              <span className="font-semibold text-texto">Sugerida {x.notaSugerida}</span>
            </>
          )}
        </p>
      </div>
      {semEvidencia ? (
        <p className="mt-1 text-sm text-texto-sec">Sem evidência nesta aula</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-texto-sec">
            {x.faixa && <>Faixa {x.faixa.replace("-", "–")}</>}
            {x.faixa && x.confianca && " · "}
            {x.confianca && <>Confiança {ROTULO_CONFIANCA[x.confianca].toLowerCase()}</>}
          </p>
          {x.justificativa && <p className="mt-1.5 text-sm text-texto">{x.justificativa}</p>}
          <Trechos evidencias={x.evidencias} />
          {x.avisos.map((a, i) => (
            <p key={i} className="mt-1 text-[11px] text-amarelo">
              {a}
            </p>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Decisão sobre ${rotulo}`}>
            <Escolha marcada={escolha?.decisao === "aprovar"} onClick={() => onEscolher({ decisao: "aprovar" })} icone={<Check className="h-3.5 w-3.5" />}>
              Aprovar {x.notaSugerida}
            </Escolha>
            <Escolha
              marcada={escolha?.decisao === "editar"}
              onClick={() => onEscolher({ decisao: "editar", nota: escolha?.nota ?? String(x.notaSugerida) })}
              icone={<PencilLine className="h-3.5 w-3.5" />}
            >
              Editar a nota
            </Escolha>
            <Escolha marcada={escolha?.decisao === "rejeitar"} onClick={() => onEscolher({ decisao: "rejeitar" })} icone={<X className="h-3.5 w-3.5" />}>
              Rejeitar
            </Escolha>
            {escolha?.decisao === "editar" && (
              <span className="inline-flex items-center gap-1.5">
                <label htmlFor={`${id}-nota`} className="text-xs text-texto-sec">
                  Nota
                </label>
                <input
                  id={`${id}-nota`}
                  inputMode="numeric"
                  value={escolha.nota ?? ""}
                  onChange={(e) => onEscolher({ decisao: "editar", nota: e.target.value })}
                  aria-invalid={notaInvalida}
                  className={cn(CAMPO, "h-8 w-20 tabular-nums", notaInvalida && "border-erro/70")}
                />
              </span>
            )}
          </div>
          {notaInvalida && <p className="mt-1 text-[11px] text-erro">Informe a nota: um número inteiro de 0 a 100.</p>}
        </>
      )}
    </div>
  );
}

function CartaoCheckpoint({
  c,
  nome,
  escolha,
  onEscolher,
}: {
  c: CheckpointSugerido;
  nome: string;
  escolha?: "aprovar" | "rejeitar";
  onEscolher: (v: "aprovar" | "rejeitar") => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-sm">
        <span className="font-medium text-texto">{nome}</span>
        <span className="text-texto-sec"> · {rotuloDaSituacao(c.situacao)}</span>
      </p>
      {c.justificativa && <p className="mt-1 text-sm text-texto">{c.justificativa}</p>}
      <Trechos evidencias={c.evidencias} />
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Decisão sobre ${nome}`}>
        <Escolha marcada={escolha === "aprovar"} onClick={() => onEscolher("aprovar")} icone={<Check className="h-3.5 w-3.5" />}>
          Aprovar (marca como realizado)
        </Escolha>
        <Escolha marcada={escolha === "rejeitar"} onClick={() => onEscolher("rejeitar")} icone={<X className="h-3.5 w-3.5" />}>
          Rejeitar
        </Escolha>
      </div>
    </div>
  );
}

function Escolha({ marcada, onClick, icone, children }: { marcada: boolean; onClick: () => void; icone: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
        marcada ? "border-azul/60 bg-azul/20 text-texto" : "border-white/10 text-texto-sec hover:border-white/25 hover:text-texto",
      )}
    >
      <span aria-hidden>{icone}</span>
      {children}
    </button>
  );
}

function AnaliseDecidida({ analise: a }: { analise: AnaliseAula }) {
  const user = useSession();
  return (
    <div className="space-y-3">
      {decidida(a) ? (
        <p className="rounded-xl border border-verde/40 bg-verde/10 px-3 py-2 text-sm text-texto" role="status">
          {situacaoDaAnalise(a, user)}.
        </p>
      ) : (
        <p className="text-sm text-texto-sec">Esta análise não tem proposta para revisar.</p>
      )}
      {a.analise?.resumo && (
        <Secao titulo="Resumo">
          <p className="text-sm leading-relaxed text-texto">{a.analise.resumo}</p>
        </Secao>
      )}
    </div>
  );
}
