"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, Lightbulb, PencilLine, Plus, Repeat, RotateCcw, Save, Undo2, WifiOff } from "lucide-react";
import { arquivarAluno, buscarAluno, EducacionalError } from "@/lib/educacional/apiEducacional";
import {
  AUTORIZACOES_PROVA_SOCIAL,
  FAIXAS_SAUDE,
  NIVEIS_INICIAIS,
  SINAIS,
  STATUS_ALUNO,
  type AlunoDetalhe,
  type AutorizacaoProvaSocial,
  type CamposIntervencao,
  type Config,
  type Intervencao,
  type NivelInicial,
  type StatusAluno,
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
import { Bloco, CampoCalculadoView, ConfirmarAcao } from "./Blocos";
import { Timeline } from "./Checkpoints";
import { ativos, CHAVES, etapasAtivas, useConfig } from "./dados";
import { hrefDeVolta, lerSimular, ROTA_ALUNOS } from "./estado";
import { CAMPOS_CONTATO, ROTULO_CONTATO, type CampoContato } from "./contato";
import { CampoLista, CampoTexto, Marcado, ProvedorFicha, useFicha, type Ficha } from "./Ficha";
import { HistoricoDoAluno } from "./Historico";
import {
  alteracaoDaAcao,
  alteracaoDaEtapa,
  alteracaoDaIntervencao,
  alteracaoDeCampo,
  alteracaoDoNivel,
  alteracaoDoNome,
  alteracaoDoResponsavel,
  alteracaoDoStatus,
  ID_NOVO,
  intervencaoArquivada,
  intervencaoNova,
} from "./lote/alteracoes";
import { comPendencias, contar } from "./lote/pendencias";
import { useAcoesDoLote, usePendencias } from "./lote/ProvedorLote";
import { NovaIntervencao } from "./NovaIntervencao";
import { AvisosDoAluno, EtiquetaDemonstracao, Faixa, mensagemDoErro, NomeResponsavel, useRedirecionarSeSemPermissao } from "./partes";
import { programaDoAluno, semAcompanhamentoIndividual, temProgramas } from "./programas";
import { TrocarPrograma } from "./TrocarPrograma";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Raio-X do aluno — /educacional/alunos/[id]. Fase 3 (6.1): um modo de edição
// para a ficha inteira. "Editar ficha" deixa todos os blocos editáveis; cada
// mudança vira alteração pendente (mesma marca da aba Alunos, mesmo armazém:
// o que foi editado na tabela aparece aqui) e "Salvar ficha" manda um POST
// /lote com este aluno. Com alteração pendente, a ficha já abre em edição.
// Imediatos: "Ajustar"/"Voltar ao automático" fora da edição, arquivar,
// reativar e trocar programa. Aba Histórico. "Voltar" devolve a tela de
// origem (aba Alunos com os filtros, ou o Cockpit) como estava (`?voltar=`).
// ---------------------------------------------------------------------------

type Aba = "raiox" | "historico";

const tempNovo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function RaioXAluno({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const simular = lerSimular(searchParams);
  const hrefVoltar = hrefDeVolta(searchParams.get("voltar"));
  const [aba, setAba] = useState<Aba>("raiox");
  const [intervencao, setIntervencao] = useState<Intervencao | "nova" | null>(null);
  const [arquivar, setArquivar] = useState(false);
  const [trocar, setTrocar] = useState(false);
  const [modoFicha, setModoFicha] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const gravar = useGravacao();
  const config = useConfig();
  const user = useSession();
  const acoes = useAcoesDoLote();
  const entrada = usePendencias()[id];

  const consulta = useQuery({
    queryKey: [...CHAVES.aluno(id), simular],
    queryFn: () => buscarAluno(id, simular),
    retry: false,
  });
  // O aluno do servidor com as alterações pendentes por cima.
  const a = useMemo(() => consulta.data && comPendencias(consulta.data, entrada), [consulta.data, entrada]);
  const semPermissao = useRedirecionarSeSemPermissao([consulta.error]);
  if (semPermissao) return null;

  const naoEncontrado = consulta.error instanceof EducacionalError && consulta.error.status === 404;
  const editando = modoFicha || Boolean(entrada);
  const salvando = entrada?.estado === "salvando";
  const ficha: Ficha | null = a
    ? {
        editando,
        aluno: a,
        entrada,
        bloqueada: salvando,
        registrar: (alt) => acoes.registrar(a, alt),
        desfazer: (chave) => acoes.desfazer(a.id, chave),
      }
    : null;

  const alternarArquivo = (alvo: AlunoDetalhe, arquivado: boolean) =>
    void gravar({
      alunoId: alvo.id,
      versao: alvo.versao,
      executar: (v) => arquivarAluno(alvo.id, v, arquivado),
      noAluno: (d) => ({ ...d, arquivado }),
      naLinha: (l) => ({ ...l, arquivado }),
      afetaTotais: true,
    });

  async function salvarFicha() {
    const r = await acoes.salvar([id]);
    if (r && "salvas" in r && r.comErro === 0) setModoFicha(false);
  }

  // Intervenção do diálogo (nova ou editada) vira alteração pendente da ficha.
  function aplicarIntervencao(campos: CamposIntervencao, tela: Parameters<typeof intervencaoNova>[2]) {
    if (!ficha || !a) return;
    if (intervencao === "nova" || intervencao?.id.startsWith(ID_NOVO)) {
      const temp = intervencao === "nova" ? tempNovo() : intervencao!.id.slice(ID_NOVO.length);
      const chave = `intervencao:${ID_NOVO}${temp}`;
      ficha.registrar(intervencaoNova(temp, campos, tela, { id: user.id, nome: user.nome }, entrada?.alteracoes[chave]));
    } else if (intervencao) {
      const i = intervencao;
      const atual: Record<string, unknown> = { tipo_id: i.tipo.id, descricao: i.descricao, responsavel_id: i.responsavel?.id ?? null, prazo: i.prazo };
      const mudou = Object.fromEntries(Object.entries(campos).filter(([k, v]) => (atual[k] ?? null) !== (v ?? null))) as CamposIntervencao;
      if (Object.keys(mudou).length) ficha.registrar(alteracaoDaIntervencao(i, mudou, tela, entrada?.alteracoes[`intervencao:${i.id}`]));
    }
  }

  const n = entrada ? contar({ [id]: entrada }).alteracoes : 0;

  return (
    <>
      <Link href={hrefVoltar} className="mb-4 inline-flex items-center gap-1.5 text-sm text-texto-sec hover:text-texto">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {hrefVoltar.startsWith(ROTA_ALUNOS) ? "Voltar para os alunos" : "Voltar para a Saúde da Jornada"}
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
      ) : consulta.isError || !a || !ficha ? (
        <Card>
          <ErrorState
            titulo="Não foi possível carregar o raio-X"
            descricao={mensagemDoErro(consulta.error)}
            onRetry={() => consulta.refetch()}
            retryLabel="Tentar de novo"
          />
        </Card>
      ) : (
        <ProvedorFicha value={ficha}>
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
                editando ? (
                  <>
                    <span className="self-center text-xs text-texto-sec" role="status">
                      {n ? `${n} ${n === 1 ? "alteração não salva" : "alterações não salvas"}` : "Editando a ficha"}
                    </span>
                    <Button size="sm" variant="ghost" disabled={salvando} onClick={() => (entrada ? setCancelar(true) : setModoFicha(false))}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={salvando} disabled={!entrada || entrada.erro?.tipo === "versao"} onClick={() => void salvarFicha()}>
                      <Save className="h-3.5 w-3.5" aria-hidden />
                      Salvar ficha
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => setModoFicha(true)}>
                      <PencilLine className="h-3.5 w-3.5" aria-hidden />
                      Editar ficha
                    </Button>
                    {!a.arquivado && temProgramas(config.data) && (
                      <Button size="sm" variant="outline" onClick={() => setTrocar(true)}>
                        <Repeat className="h-3.5 w-3.5" aria-hidden />
                        {a.programa_id ? "Trocar programa" : "Definir programa"}
                      </Button>
                    )}
                    {!a.arquivado && (
                      <Button size="sm" variant="outline" onClick={() => setArquivar(true)}>
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Arquivar aluno
                      </Button>
                    )}
                  </>
                )
              }
            />
            <SituacaoDaFicha onTentarDeNovo={() => void salvarFicha()} />
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
                <Timeline a={a} individual={!semAcompanhamentoIndividual(programaDoAluno(a, config.data))} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Progresso a={a} />
                  <Diagnostico a={a} config={config.data} />
                </div>
                <Intervencoes a={a} onEditar={(i) => setIntervencao(i)} onNova={() => setIntervencao("nova")} />
              </>
            )}
          </div>
        </ProvedorFicha>
      )}

      {a && (
        <>
          <NovaIntervencao
            aberto={intervencao !== null}
            alunoInicial={{ id: a.id, nome: a.nome, versao: a.versao }}
            intervencao={intervencao === "nova" ? null : intervencao}
            onFechar={() => setIntervencao(null)}
            aoAplicar={aplicarIntervencao}
          />
          <TrocarPrograma aluno={a} aberto={trocar} onFechar={() => setTrocar(false)} />
          <ConfirmarAcao
            aberto={arquivar}
            titulo="Arquivar aluno?"
            texto={`${a.nome} sai do Cockpit, do Kanban e da tabela padrão. Nada é apagado: dá para reativar pelo filtro “Mostrar arquivados”.`}
            confirmar="Arquivar"
            perigo
            onConfirmar={() => alternarArquivo(a, true)}
            onFechar={() => setArquivar(false)}
          />
          <ConfirmarAcao
            aberto={cancelar}
            titulo="Descartar as alterações da ficha?"
            texto={`${n} ${n === 1 ? "alteração" : "alterações"} de ${a.nome} ${n === 1 ? "será apagada" : "serão apagadas"} sem salvar.`}
            confirmar="Descartar"
            perigo
            onConfirmar={() => {
              acoes.descartarAluno(a.id);
              setModoFicha(false);
            }}
            onFechar={() => setCancelar(false)}
          />
        </>
      )}
    </>
  );
}

// Erro do último "Salvar ficha" (mesmo tratamento da barra): 409 com as duas
// escolhas, validação (a célula também fica marcada), rede com "Tentar de novo".
function SituacaoDaFicha({ onTentarDeNovo }: { onTentarDeNovo: () => void }) {
  const { entrada } = useFicha();
  const acoes = useAcoesDoLote();
  if (!entrada) return null;
  const erro = entrada.erro;
  if (erro?.tipo === "versao") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-aviso/40 bg-aviso/[0.06] px-4 py-2.5 text-sm text-texto" role="alert">
        <AlertTriangle className="h-4 w-4 text-aviso" aria-hidden />
        Este aluno foi alterado por outra pessoa.
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => acoes.verVersaoAtual(entrada.aluno_id)}>
            Ver versão atual
          </Button>
          <Button size="sm" onClick={() => acoes.reaplicar(entrada.aluno_id)}>
            Reaplicar minhas alterações
          </Button>
        </span>
      </div>
    );
  }
  if (erro?.tipo === "rede") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-erro/30 bg-erro/[0.06] px-4 py-2.5 text-sm text-texto" role="alert">
        <WifiOff className="h-4 w-4 text-erro" aria-hidden />
        {erro.mensagem}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onTentarDeNovo}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (erro?.tipo === "validacao") {
    return (
      <p className="rounded-xl border border-erro/30 bg-erro/[0.06] px-4 py-2.5 text-sm text-erro" role="alert">
        Não foi possível salvar: {erro.mensagem}
      </p>
    );
  }
  if (entrada.estado === "revisar") {
    return (
      <p className="rounded-xl border border-aviso/40 bg-aviso/[0.06] px-4 py-2.5 text-sm text-texto" role="status">
        Suas alterações foram reaplicadas sobre a versão atual. Revise e salve de novo.
      </p>
    );
  }
  return null;
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
// Blocos (leitura; em edição, os campos da ficha)
// ---------------------------------------------------------------------------

const TIPO_DO_CONTATO: Record<CampoContato, "email" | "tel" | "text"> = { email: "email", telefone: "tel", discord: "text" };

function Cabecalho({ a, config, acoes }: { a: AlunoDetalhe; config?: Config; acoes: ReactNode }) {
  const f = useFicha();
  const programa = programaDoAluno(a, config);
  const etapas = etapasAtivas(config);
  if (!etapas.some((e) => e.id === a.etapa.id)) etapas.push({ id: a.etapa.id, nome: a.etapa.nome, ordem: 999, ativo: false });
  return (
    <Card>
      <CardHeader title="Raio-X do aluno" action={<div className="flex flex-wrap items-center justify-end gap-2">{acoes}</div>} />
      <CardContent>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">{a.nome}</h1>
            <span className="tag">{ROTULO_STATUS_ALUNO[a.status_aluno]}</span>
            <AvisosDoAluno avisos={a.avisos} />
            <EtiquetaDemonstracao />
          </div>
          {f.editando ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoTexto
                chave="campo:nome"
                rotulo="Nome *"
                valor={a.nome}
                obrigatorio
                className="sm:col-span-2"
                onConfirmar={(v) => v && f.registrar(alteracaoDoNome(a, v))}
              />
              <CampoLista
                chave="campo:status_aluno"
                rotulo="Status do aluno"
                valor={a.status_aluno}
                opcoes={STATUS_ALUNO.map((s) => ({ valor: s, rotulo: ROTULO_STATUS_ALUNO[s] }))}
                onConfirmar={(v) => f.registrar(alteracaoDoStatus(a, v as StatusAluno))}
              />
              <CampoTexto
                chave="campo:data_entrada"
                rotulo="Data de entrada *"
                tipo="date"
                obrigatorio
                valor={a.data_entrada.slice(0, 10)}
                onConfirmar={(v) => v && f.registrar(alteracaoDeCampo(a, "data_entrada", v))}
              />
              <CampoTexto
                chave="campo:data_termino"
                rotulo="Data de término"
                tipo="date"
                valor={a.data_termino?.slice(0, 10) ?? null}
                onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "data_termino", v))}
              />
              <CampoLista
                chave="campo:nivel_inicial"
                rotulo="Nível inicial"
                valor={a.nivel_inicial}
                opcoes={NIVEIS_INICIAIS.map((n) => ({ valor: n, rotulo: ROTULO_NIVEL[n] }))}
                onConfirmar={(v) => f.registrar(alteracaoDoNivel(a, v as NivelInicial))}
              />
              <CampoLista
                chave="campo:etapa_id"
                rotulo="Etapa"
                valor={a.etapa.id}
                opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))}
                onConfirmar={(v) => {
                  const e = etapas.find((x) => x.id === v);
                  if (e) f.registrar(alteracaoDaEtapa(a, e));
                }}
              />
              <div className="min-w-0 text-xs text-texto-sec sm:col-span-2">
                Programa: <span className="text-texto">{programa?.nome ?? "Sem programa"}</span> · Mentoria:{" "}
                <span className="text-texto">{a.mentoria}</span>
                <span className="block">Programa e mentoria mudam por “Trocar programa”.</span>
              </div>
              {CAMPOS_CONTATO.map((c) => (
                <CampoTexto
                  key={c}
                  chave={`campo:${c}`}
                  rotulo={`${ROTULO_CONTATO[c]} *`}
                  tipo={TIPO_DO_CONTATO[c]}
                  obrigatorio
                  valor={a[c]}
                  className={c === "email" ? "sm:col-span-2" : undefined}
                  onConfirmar={(v) => v && f.registrar(alteracaoDeCampo(a, c, v))}
                />
              ))}
              <CampoTexto
                chave="campo:objetivo"
                rotulo="Objetivo"
                valor={a.objetivo}
                className="sm:col-span-2 lg:col-span-4"
                onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "objetivo", v))}
              />
            </div>
          ) : (
            <>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-6">
                <Dado rotulo="Programa">{programa?.nome ?? "Sem programa"}</Dado>
                <Dado rotulo="Mentoria">{a.mentoria}</Dado>
                <Dado rotulo="Entrada">{dataCurta(a.data_entrada)}</Dado>
                <Dado rotulo="Término">{dataCurta(a.data_termino)}</Dado>
                <Dado rotulo="Nível inicial">{ROTULO_NIVEL[a.nivel_inicial]}</Dado>
                <Dado rotulo="Etapa">{a.etapa.nome}</Dado>
              </dl>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                {CAMPOS_CONTATO.map((c) => (
                  <Dado key={c} rotulo={ROTULO_CONTATO[c]}>
                    {a[c] ? <span className="break-all">{a[c]}</span> : <span className="text-aviso">Não informado</span>}
                  </Dado>
                ))}
              </dl>
              <p className="mt-3 text-sm">
                <span className="text-texto-sec">Objetivo: </span>
                <span className="text-texto">{a.objetivo ?? "Não informado"}</span>
              </p>
            </>
          )}
          {programa?.observacoes && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amarelo/25 bg-amarelo/[0.06] px-3 py-2 text-sm text-texto">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amarelo" aria-hidden />
              <span>
                <span className="text-texto-sec">{programa.nome}: </span>
                {programa.observacoes}
              </span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Indicadores({ a }: { a: AlunoDetalhe }) {
  const f = useFicha();
  const faixa = a.faixa_saude.valor;
  return (
    <Bloco titulo="Indicadores">
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
        {f.editando ? (
          <CampoTexto
            chave="campo:motivo_risco"
            rotulo="Motivo do risco"
            area
            valor={a.motivo_risco}
            onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "motivo_risco", v))}
          />
        ) : (
          <div>
            <p className="text-xs text-texto-sec">Motivo do risco</p>
            <p className="mt-0.5 text-sm text-texto">{a.motivo_risco ?? <span className="text-texto-sec">Não informado.</span>}</p>
          </div>
        )}
      </div>
    </Bloco>
  );
}

function Contrato({ a }: { a: AlunoDetalhe }) {
  const financeiro = a.status_financeiro.valor;
  return (
    <Bloco titulo="Contrato">
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
    </Bloco>
  );
}

const CAMPO_DO_SINAL = { upgrade: "sinal_upgrade", renovacao: "sinal_renovacao", prova_social: "sinal_prova_social" } as const;

function Sinais({ a }: { a: AlunoDetalhe }) {
  const f = useFicha();
  return (
    <Bloco titulo="Sinais e prova social" subtitulo="Sinais para o Comercial.">
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
        {f.editando ? (
          <div className="space-y-3">
            <CampoLista
              chave="campo:autorizacao_prova_social"
              rotulo="Autorização de prova social"
              valor={a.autorizacao_prova_social}
              opcoes={AUTORIZACOES_PROVA_SOCIAL.map((s) => ({ valor: s, rotulo: ROTULO_AUTORIZACAO[s] }))}
              onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "autorizacao_prova_social", v as AutorizacaoProvaSocial))}
            />
            <CampoTexto
              chave="campo:observacoes"
              rotulo="Observações"
              area
              valor={a.observacoes}
              onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "observacoes", v))}
            />
          </div>
        ) : (
          <dl className="grid gap-2 text-sm">
            <Dado rotulo="Autorização de prova social">{ROTULO_AUTORIZACAO[a.autorizacao_prova_social]}</Dado>
            <Dado rotulo="Observações">{a.observacoes ?? <span className="text-texto-sec">—</span>}</Dado>
          </dl>
        )}
      </div>
    </Bloco>
  );
}

const CAMPO_DO_PASSO = {
  consumiu: "progresso_consumiu",
  entendeu: "progresso_entendeu",
  aplicou: "progresso_aplicou",
  validou: "progresso_validou",
} as const;

function Progresso({ a }: { a: AlunoDetalhe }) {
  return (
    <Bloco titulo="Progresso metodológico" subtitulo={`Na etapa atual: ${a.etapa.nome}. Notas de 0 a 100.`}>
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
    </Bloco>
  );
}

function Diagnostico({ a, config }: { a: AlunoDetalhe; config?: Config }) {
  const f = useFicha();
  const responsaveis = ativos(config?.responsaveis);
  if (a.responsavel && !responsaveis.some((r) => r.id === a.responsavel?.id)) responsaveis.push({ ...a.responsavel, ativo: false });
  return (
    <Bloco titulo="Diagnóstico e próxima ação">
      {f.editando ? (
        <div className="space-y-3">
          <CampoTexto
            chave="campo:diagnostico"
            rotulo="Diagnóstico"
            area
            valor={a.diagnostico}
            onConfirmar={(v) => f.registrar(alteracaoDeCampo(a, "diagnostico", v))}
          />
          <Marcado chave="campo:proxima_acao">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTexto
                chave="campo:proxima_acao:descricao"
                rotulo="Próxima ação"
                className="sm:col-span-2"
                valor={a.proxima_acao?.descricao ?? null}
                onConfirmar={(v) => f.registrar(alteracaoDaAcao(a, v, a.proxima_acao?.prazo ?? null))}
              />
              <CampoTexto
                chave="campo:proxima_acao:prazo"
                rotulo="Prazo"
                tipo="date"
                valor={a.proxima_acao?.prazo ?? null}
                onConfirmar={(v) => f.registrar(alteracaoDaAcao(a, a.proxima_acao?.descricao ?? null, v))}
              />
            </div>
          </Marcado>
          <CampoLista
            chave="campo:responsavel_id"
            rotulo="Responsável"
            vazio="Sem responsável"
            valor={a.responsavel?.id ?? ""}
            opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${ROTULO_TIPO_RESPONSAVEL[r.tipo]}` }))}
            onConfirmar={(v) => f.registrar(alteracaoDoResponsavel(a, responsaveis.find((r) => r.id === v) ?? null))}
          />
        </div>
      ) : (
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
      )}
    </Bloco>
  );
}

// Intervenções: criar, editar, concluir, reabrir e arquivar fazem parte da
// ficha (alteração pendente). Mais recente primeiro — ordem da API; as novas,
// ainda não salvas, no fim.
function Intervencoes({ a, onEditar, onNova }: { a: AlunoDetalhe; onEditar: (i: Intervencao) => void; onNova: () => void }) {
  const f = useFicha();
  const [arquivar, setArquivar] = useState<Intervencao | null>(null);
  const chave = (i: Intervencao) => `intervencao:${i.id}`;
  const novaPendente = (i: Intervencao) => i.id.startsWith(ID_NOVO);

  const mudarStatus = (i: Intervencao, status: "aberta" | "concluida") =>
    f.registrar(
      novaPendente(i)
        ? intervencaoNova(i.id.slice(ID_NOVO.length), { status }, {}, i.criada_por, f.entrada?.alteracoes[chave(i)])
        : alteracaoDaIntervencao(i, { status }, {}, f.entrada?.alteracoes[chave(i)]),
    );
  const confirmarArquivar = (i: Intervencao) => (novaPendente(i) ? f.desfazer(chave(i)) : f.registrar(intervencaoArquivada(i)));

  return (
    <Card>
      <CardHeader
        title="Intervenções"
        subtitle="Mais recente primeiro. Mudanças aqui vão no “Salvar ficha”."
        action={
          <Button variant="secondary" size="sm" disabled={f.bloqueada} onClick={onNova}>
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
              <li key={i.id} className="py-2 first:pt-0 last:pb-0">
                <Marcado chave={chave(i)}>
                  <div className="flex flex-col gap-2 py-1 lg:flex-row lg:items-start lg:gap-4">
                    <span className="flex shrink-0 gap-1.5 self-start">
                      <span className="tag">{i.tipo?.nome ?? "—"}</span>
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
                        <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={() => mudarStatus(i, "concluida")}>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          Concluir
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={() => mudarStatus(i, "aberta")}>
                          <Undo2 className="h-3.5 w-3.5" aria-hidden />
                          Reabrir
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={() => onEditar(i)} aria-label={`Editar intervenção: ${i.descricao}`}>
                        <PencilLine className="h-3.5 w-3.5" aria-hidden />
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" disabled={f.bloqueada} onClick={() => setArquivar(i)} aria-label={`Arquivar intervenção: ${i.descricao}`}>
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Arquivar
                      </Button>
                    </span>
                  </div>
                </Marcado>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmarAcao
        aberto={arquivar !== null}
        titulo="Arquivar intervenção?"
        texto="Ela sai da lista do aluno quando você salvar a ficha. Continua no banco e no histórico."
        confirmar="Arquivar"
        onConfirmar={() => arquivar && confirmarArquivar(arquivar)}
        onFechar={() => setArquivar(null)}
      />
    </Card>
  );
}
