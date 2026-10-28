"use client";

import { useEffect, useId, useState } from "react";
import { Archive, Flag, Plus, Star } from "lucide-react";
import { STATUS_CHECKPOINT, type AlunoDetalhe, type CamposCheckpoint, type Checkpoint, type StatusCheckpoint } from "@/lib/educacional/contrato";
import { dataCurta, hojeEmBrasilia, PONTO_DO_TOM, ROTULO_STATUS_CHECKPOINT, TOM_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ConfirmarAcao } from "./Blocos";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { useFicha, useMarca } from "./Ficha";
import { alteracaoDoCheckpoint, checkpointArquivado, checkpointNovo, ID_NOVO } from "./lote/alteracoes";
import { MarcaPendente } from "./lote/MarcaPendente";
import { BadgeCheckpoint } from "./partes";
import { RoteiroDoContato } from "./Roteiro";

// ---------------------------------------------------------------------------
// Timeline de checkpoints (spec Fase 2, seção 5): editar nome, datas, status e
// observação de cada checkpoint; adicionar checkpoint avulso; arquivar (sai da
// timeline, fica no histórico). Desde a Fase 3 (6.1), tudo isso faz parte da
// ficha: vira alteração pendente do aluno e vai no "Salvar ficha".
// Programas (P3): clicar num checkpoint mostra o roteiro do contato abaixo da
// timeline (só leitura; edita-se em Configurações). O do próximo checkpoint já
// vem aberto. "Editar checkpoint" fica no painel.
// ---------------------------------------------------------------------------

export function Timeline({ a }: { a: AlunoDetalhe }) {
  const [editando, setEditando] = useState<Checkpoint | "novo" | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ordenados = [...a.checkpoints].sort((x, y) => x.ordem - y.ordem);
  // Sem escolha (ou se o escolhido saiu da timeline): o próximo checkpoint.
  const padrao = a.proximo_checkpoint?.id ?? ordenados.find((c) => c.status !== "realizado")?.id ?? ordenados.at(-1)?.id ?? null;
  const selecionado = ordenados.find((c) => c.id === escolhido) ?? ordenados.find((c) => c.id === padrao) ?? null;
  const bloqueada = useFicha().bloqueada;
  return (
    <Card>
      <CardHeader
        title="Timeline de checkpoints"
        subtitle="Clique num checkpoint para ver o roteiro do contato. O Big Win tem marca própria."
        action={
          <Button variant="secondary" size="sm" disabled={bloqueada} onClick={() => setEditando("novo")}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Checkpoint avulso
          </Button>
        }
      />
      <CardContent>
        {ordenados.length === 0 ? (
          <p className="text-sm text-texto-sec">Nenhum checkpoint registrado.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <ol className="relative flex justify-between gap-1" style={{ minWidth: Math.max(320, ordenados.length * 96) }}>
              <span className="absolute left-4 right-4 top-4 h-px bg-white/15" aria-hidden />
              {ordenados.map((c) => {
                const tom = TOM_STATUS_CHECKPOINT[c.status];
                const previsto = c.status === "previsto";
                const ativo = selecionado?.id === c.id;
                return (
                  <li key={c.id} className="relative flex w-24 flex-col items-center text-center">
                    <MarcaDoCheckpoint id={c.id}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(c.id)}
                      aria-label={`Ver o roteiro do checkpoint ${c.nome}`}
                      aria-pressed={ativo}
                      className={cn(
                        "group flex flex-col items-center gap-1.5 rounded-lg px-1 pb-1 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none",
                        ativo && "bg-white/[0.07] ring-1 ring-white/20",
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2",
                          previsto ? "border-dashed border-cinza-claro bg-painel" : ["border-painel", PONTO_DO_TOM[tom]],
                          c.big_win && "h-9 w-9 ring-2 ring-amarelo/70 ring-offset-2 ring-offset-painel",
                        )}
                        title={ROTULO_STATUS_CHECKPOINT[c.status]}
                      >
                        {c.big_win ? (
                          <Star className={cn("h-4 w-4", previsto ? "text-cinza-claro" : "text-noite")} aria-hidden />
                        ) : (
                          <Flag className={cn("h-3.5 w-3.5", previsto ? "text-cinza-claro" : "text-noite/80")} aria-hidden />
                        )}
                      </span>
                      <span className={cn("inline-flex flex-col items-center text-xs font-medium text-texto", c.big_win && "text-amarelo")}>
                        {c.marco && <span className="text-[10px] font-normal uppercase tracking-wide text-texto-sec">{c.marco}</span>}
                        {c.nome}
                      </span>
                      <span className="text-[11px] tabular-nums text-texto-sec">{dataCurta(c.data_prevista)}</span>
                      <BadgeCheckpoint status={c.status} />
                      {c.data_realizada && <span className="text-[10px] text-texto-sec">feito {dataCurta(c.data_realizada)}</span>}
                    </button>
                    </MarcaDoCheckpoint>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {selecionado && (
          <RoteiroDoContato
            checkpoint={selecionado}
            proximo={selecionado.id === padrao}
            onEditar={bloqueada ? undefined : () => setEditando(selecionado)}
          />
        )}
      </CardContent>
      {editando && <FormCheckpoint aluno={a} checkpoint={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} />}
    </Card>
  );
}

// Marca de checkpoint alterado (com "Desfazer" no menu de contexto).
function MarcaDoCheckpoint({ id, children }: { id: string; children: React.ReactNode }) {
  const m = useMarca(`checkpoint:${id}`);
  return <MarcaPendente {...m}>{children}</MarcaPendente>;
}

const tempNovo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Formulário do checkpoint: na ficha, "Aplicar" registra só os campos que
// mudaram; "Arquivar" vira alteração (ou desfaz o avulso ainda não salvo).
function FormCheckpoint({ aluno, checkpoint, onFechar }: { aluno: AlunoDetalhe; checkpoint: Checkpoint | null; onFechar: () => void }) {
  const id = useId();
  const f = useFicha();
  const novo = checkpoint === null;
  const pendenteNovo = checkpoint?.id.startsWith(ID_NOVO) ? checkpoint.id.slice(ID_NOVO.length) : null;
  const [nome, setNome] = useState(checkpoint?.nome ?? "");
  const [prevista, setPrevista] = useState(checkpoint?.data_prevista ?? "");
  const [realizada, setRealizada] = useState(checkpoint?.data_realizada ?? "");
  const [status, setStatus] = useState<StatusCheckpoint>(checkpoint?.status ?? "previsto");
  const [observacao, setObservacao] = useState(checkpoint?.observacao ?? "");
  const [bigWin, setBigWin] = useState(checkpoint?.big_win ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivar, setArquivar] = useState(false);

  // Ao marcar realizado sem data, sugere hoje (a API também usaria hoje).
  useEffect(() => {
    if (status === "realizado" && !realizada) setRealizada(hojeEmBrasilia());
  }, [status, realizada]);

  function aplicar() {
    if (!nome.trim()) return setErro("Informe o nome do checkpoint.");
    const todos: CamposCheckpoint = {
      nome: nome.trim(),
      data_prevista: prevista || null,
      data_realizada: realizada || null,
      status,
      observacao: observacao.trim() || null,
      big_win: bigWin,
    };
    if (novo || pendenteNovo) {
      const temp = pendenteNovo ?? tempNovo();
      const chave = `checkpoint:${ID_NOVO}${temp}`;
      f.registrar(checkpointNovo(temp, todos, f.entrada?.alteracoes[chave]));
    } else {
      // Só o que mudou em relação ao que aparece (servidor + pendências).
      const atual = checkpoint as unknown as Record<string, unknown>;
      const campos = Object.fromEntries(Object.entries(todos).filter(([k, v]) => (atual[k] ?? null) !== v)) as CamposCheckpoint;
      if (Object.keys(campos).length) f.registrar(alteracaoDoCheckpoint(checkpoint, campos, f.entrada?.alteracoes[`checkpoint:${checkpoint.id}`]));
    }
    onFechar();
  }

  function confirmarArquivar() {
    if (!checkpoint) return;
    onFechar();
    if (pendenteNovo) f.desfazer(`checkpoint:${checkpoint.id}`);
    else f.registrar(checkpointArquivado(checkpoint));
  }

  return (
    <>
      <Dialogo
        aberto={!arquivar}
        titulo={novo ? "Checkpoint avulso" : `Editar checkpoint · ${checkpoint.nome}`}
        subtitulo={`${aluno.nome} · vai no “Salvar ficha”`}
        onFechar={onFechar}
        onEnviar={aplicar}
        rodape={
          <>
            {!novo && (
              <Button type="button" variant="outline" className="mr-auto" onClick={() => setArquivar(true)}>
                <Archive className="h-3.5 w-3.5" aria-hidden />
                Arquivar
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit">{novo ? "Adicionar" : "Aplicar"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`${id}-nome`} rotulo="Nome" obrigatorio>
            <input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
          </Campo>
          <Campo id={`${id}-status`} rotulo="Status">
            <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as StatusCheckpoint)} className={CAMPO}>
              {STATUS_CHECKPOINT.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS_CHECKPOINT[s]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id={`${id}-prevista`} rotulo="Data prevista">
            <input id={`${id}-prevista`} type="date" value={prevista} onChange={(e) => setPrevista(e.target.value)} className={CAMPO} />
          </Campo>
          <Campo id={`${id}-realizada`} rotulo="Data realizada">
            <input id={`${id}-realizada`} type="date" value={realizada} onChange={(e) => setRealizada(e.target.value)} className={CAMPO} />
          </Campo>
        </div>
        <Campo id={`${id}-obs`} rotulo="Observação">
          <textarea id={`${id}-obs`} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={cn(CAMPO, "h-auto py-2")} />
        </Campo>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-texto">
          <input type="checkbox" checked={bigWin} onChange={(e) => setBigWin(e.target.checked)} className="accent-azul" />
          Marca de Big Win
        </label>
        <ErroDoEnvio texto={erro} />
      </Dialogo>
      <ConfirmarAcao
        aberto={arquivar}
        titulo="Arquivar checkpoint?"
        texto={`“${checkpoint?.nome}” sai da timeline de ${aluno.nome} quando você salvar a ficha. Ele continua no banco e no histórico.`}
        confirmar="Arquivar"
        onConfirmar={confirmarArquivar}
        onFechar={() => setArquivar(false)}
      />
    </>
  );
}
