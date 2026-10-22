"use client";

import { useEffect, useId, useState } from "react";
import { Archive, Flag, PencilLine, Plus, Star } from "lucide-react";
import { arquivarCheckpoint, atualizarCheckpoint, criarCheckpoint, EducacionalError } from "@/lib/educacional/apiEducacional";
import { STATUS_CHECKPOINT, type AlunoDetalhe, type Checkpoint, type StatusCheckpoint } from "@/lib/educacional/contrato";
import { dataCurta, hojeEmBrasilia, PONTO_DO_TOM, ROTULO_STATUS_CHECKPOINT, TOM_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ConfirmarAcao } from "./Blocos";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { BadgeCheckpoint } from "./partes";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Timeline de checkpoints (spec Fase 2, seção 5): editar nome, datas, status e
// observação de cada checkpoint; adicionar checkpoint avulso; arquivar (sai da
// timeline, fica no histórico). Toda escrita leva a versão do aluno.
// ---------------------------------------------------------------------------

export function Timeline({ a }: { a: AlunoDetalhe }) {
  const [editando, setEditando] = useState<Checkpoint | "novo" | null>(null);
  const ordenados = [...a.checkpoints].sort((x, y) => x.ordem - y.ordem);
  return (
    <Card>
      <CardHeader
        title="Timeline de checkpoints"
        subtitle="Clique num checkpoint para editar. O Big Win tem marca própria."
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditando("novo")}>
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
                return (
                  <li key={c.id} className="relative flex w-24 flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={() => setEditando(c)}
                      aria-label={`Editar o checkpoint ${c.nome}`}
                      className="group flex flex-col items-center gap-1.5 rounded-lg px-1 pb-1 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
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
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-texto", c.big_win && "text-amarelo")}>
                        {c.nome}
                        <PencilLine className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                      </span>
                      <span className="text-[11px] tabular-nums text-texto-sec">{dataCurta(c.data_prevista)}</span>
                      <BadgeCheckpoint status={c.status} />
                      {c.data_realizada && <span className="text-[10px] text-texto-sec">feito {dataCurta(c.data_realizada)}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardContent>
      {editando && <FormCheckpoint aluno={a} checkpoint={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} />}
    </Card>
  );
}

function FormCheckpoint({ aluno, checkpoint, onFechar }: { aluno: AlunoDetalhe; checkpoint: Checkpoint | null; onFechar: () => void }) {
  const id = useId();
  const gravar = useGravacao();
  const novo = checkpoint === null;
  const [nome, setNome] = useState(checkpoint?.nome ?? "");
  const [prevista, setPrevista] = useState(checkpoint?.data_prevista ?? "");
  const [realizada, setRealizada] = useState(checkpoint?.data_realizada ?? "");
  const [status, setStatus] = useState<StatusCheckpoint>(checkpoint?.status ?? "previsto");
  const [observacao, setObservacao] = useState(checkpoint?.observacao ?? "");
  const [bigWin, setBigWin] = useState(checkpoint?.big_win ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arquivar, setArquivar] = useState(false);

  // Ao marcar realizado sem data, sugere hoje (a API também usaria hoje).
  useEffect(() => {
    if (status === "realizado" && !realizada) setRealizada(hojeEmBrasilia());
  }, [status, realizada]);

  async function salvar() {
    if (!nome.trim()) return setErro("Informe o nome do checkpoint.");
    const campos = {
      nome: nome.trim(),
      data_prevista: prevista || null,
      data_realizada: realizada || null,
      status,
      observacao: observacao.trim() || null,
      big_win: bigWin,
    };
    setSalvando(true);
    const r = await gravar({
      alunoId: aluno.id,
      versao: aluno.versao,
      executar: (v) => (checkpoint ? atualizarCheckpoint(checkpoint.id, v, campos) : criarCheckpoint(aluno.id, v, campos)),
      noAluno: checkpoint
        ? (d) => ({ ...d, checkpoints: d.checkpoints.map((c) => (c.id === checkpoint.id ? { ...c, ...campos } : c)) })
        : undefined,
      afetaTotais: true,
    });
    setSalvando(false);
    if (r.ok) onFechar();
    else if (r.erro instanceof EducacionalError && r.erro.status === 400) setErro(r.erro.corpo.mensagem ?? r.erro.message);
    else onFechar();
  }

  async function confirmarArquivar() {
    if (!checkpoint) return;
    onFechar();
    await gravar({
      alunoId: aluno.id,
      versao: aluno.versao,
      executar: (v) => arquivarCheckpoint(checkpoint.id, v),
      noAluno: (d) => ({ ...d, checkpoints: d.checkpoints.filter((c) => c.id !== checkpoint.id) }),
      afetaTotais: true,
    });
  }

  return (
    <>
      <Dialogo
        aberto={!arquivar}
        titulo={novo ? "Checkpoint avulso" : `Editar checkpoint · ${checkpoint.nome}`}
        subtitulo={aluno.nome}
        onFechar={onFechar}
        onEnviar={salvar}
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
            <Button type="submit" loading={salvando}>
              {novo ? "Adicionar" : "Salvar"}
            </Button>
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
        texto={`“${checkpoint?.nome}” sai da timeline de ${aluno.nome}. Ele continua no banco e no histórico.`}
        confirmar="Arquivar"
        onConfirmar={() => void confirmarArquivar()}
        onFechar={() => setArquivar(false)}
      />
    </>
  );
}
