"use client";

import { useEffect, useId, useState } from "react";
import { previaTrocaPrograma, trocarPrograma, EducacionalError } from "@/lib/educacional/apiEducacional";
import { MOTIVO_MINIMO, type AlunoDetalhe, type PreviaTroca } from "@/lib/educacional/contrato";
import { dataCurta, hojeEmBrasilia, ROTULO_STATUS_CHECKPOINT } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { useConfig } from "./dados";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { programaDoAluno, programasPorMentoria } from "./programas";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Trocar programa (programas, P4). Ação própria, fora do "Salvar" em lote.
//   1. Programa novo e início (padrão: data de entrada; "começa hoje" para um
//      novo ciclo; ou outra data).
//   2. Prévia do backend: o que fica, o que sai e o que é criado. Só grava ao
//      confirmar, com motivo. A regra é do backend; a tela só mostra.
// ---------------------------------------------------------------------------

type Inicio = "entrada" | "hoje" | "outra";

export function TrocarPrograma({ aluno: a, aberto, onFechar }: { aluno: AlunoDetalhe; aberto: boolean; onFechar: () => void }) {
  const id = useId();
  const config = useConfig();
  const gravar = useGravacao();
  const grupos = programasPorMentoria(config.data);
  const [programaId, setProgramaId] = useState("");
  const [inicio, setInicio] = useState<Inicio>("entrada");
  const [outraData, setOutraData] = useState("");
  const [previa, setPrevia] = useState<PreviaTroca | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ programa?: string; inicio?: string; motivo?: string; envio?: string }>({});
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setProgramaId("");
    setInicio("entrada");
    setOutraData("");
    setPrevia(null);
    setMotivo("");
    setErros({});
  }, [aberto]);

  const dataDeInicio = inicio === "entrada" ? a.data_entrada.slice(0, 10) : inicio === "hoje" ? hojeEmBrasilia() : outraData;
  const atual = programaDoAluno(a, config.data);
  const definir = !a.programa_id;

  async function verPrevia() {
    const novos: typeof erros = {};
    if (!programaId) novos.programa = "Escolha o programa.";
    if (!dataDeInicio) novos.inicio = "Informe a data de início.";
    setErros(novos);
    if (Object.keys(novos).length) return;
    setCarregando(true);
    try {
      setPrevia(await previaTrocaPrograma(a.id, a.versao, { programa_id: programaId, data_inicio: dataDeInicio }));
    } catch (e) {
      const campo = e instanceof EducacionalError ? e.corpo.campo : undefined;
      const msg = e instanceof EducacionalError ? (e.corpo.mensagem ?? e.message) : "Não foi possível montar a prévia.";
      setErros(campo === "programa_id" ? { programa: msg } : campo === "data_inicio" ? { inicio: msg } : { envio: msg });
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!previa) return;
    if (motivo.trim().length < MOTIVO_MINIMO) {
      setErros({ motivo: `Explique o motivo (pelo menos ${MOTIVO_MINIMO} caracteres).` });
      return;
    }
    setCarregando(true);
    const r = await gravar({
      alunoId: a.id,
      versao: a.versao,
      executar: (v) => trocarPrograma(a.id, v, { programa_id: previa.programa.id, data_inicio: previa.data_inicio, motivo: motivo.trim() }),
      afetaTotais: true,
    });
    setCarregando(false);
    // Sucesso ou 409 (o aluno mudou: a prévia não vale mais) fecham; o aviso já foi dado.
    if (r.ok || (r.erro instanceof EducacionalError && (r.erro.status === 409 || r.erro.rede))) onFechar();
    else if (r.erro instanceof EducacionalError && r.erro.status === 400) {
      const msg = r.erro.corpo.mensagem ?? r.erro.message;
      setErros(r.erro.corpo.campo === "motivo" ? { motivo: msg } : { envio: msg });
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo={definir ? "Definir programa" : "Trocar programa"}
      subtitulo={
        previa
          ? "Confira o que muda na jornada. Nada é gravado antes de confirmar."
          : atual
            ? `Programa atual: ${atual.nome}${a.data_inicio_programa ? `, desde ${dataCurta(a.data_inicio_programa)}` : ""}.`
            : "Este aluno ainda não tem programa."
      }
      onFechar={onFechar}
      onEnviar={previa ? confirmar : verPrevia}
      largura="max-w-3xl"
      rodape={
        <>
          {previa ? (
            <Button type="button" variant="ghost" className="mr-auto" onClick={() => setPrevia(null)}>
              Voltar
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={carregando}>
            {previa ? "Confirmar troca" : "Ver prévia"}
          </Button>
        </>
      }
    >
      {!previa ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`${id}-programa`} rotulo="Programa novo" obrigatorio erro={erros.programa}>
            <select id={`${id}-programa`} value={programaId} onChange={(e) => setProgramaId(e.target.value)} className={CAMPO}>
              <option value="">Escolha…</option>
              {grupos.map((g) => (
                <optgroup key={g.mentoria} label={g.mentoria}>
                  {g.programas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.id === a.programa_id ? " (atual: novo ciclo)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Campo>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-texto-sec">
              Início do programa<span className="text-erro"> *</span>
            </legend>
            {(
              [
                ["entrada", `Data de entrada (${dataCurta(a.data_entrada)})`],
                ["hoje", "Começa hoje (novo ciclo)"],
                ["outra", "Outra data"],
              ] as [Inicio, string][]
            ).map(([valor, rotulo]) => (
              <label key={valor} className="flex items-center gap-2 text-sm text-texto">
                <input type="radio" name={`${id}-inicio`} value={valor} checked={inicio === valor} onChange={() => setInicio(valor)} />
                {rotulo}
              </label>
            ))}
            {inicio === "outra" && (
              <input
                type="date"
                aria-label="Data de início"
                value={outraData}
                onChange={(e) => setOutraData(e.target.value)}
                className={CAMPO}
              />
            )}
            {erros.inicio && (
              <p className="text-xs text-erro" role="alert">
                {erros.inicio}
              </p>
            )}
          </fieldset>
          <div className="sm:col-span-2">
            <ErroDoEnvio texto={erros.envio} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-texto">
            <span className="font-semibold">{previa.programa.nome}</span> a partir de {dataCurta(previa.data_inicio)} · término{" "}
            {dataCurta(previa.data_termino_sugerida)}
            <span className="block text-xs text-texto-sec">A troca grava o início, a mentoria e o término do programa.</span>
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <ListaDaPrevia
              titulo="Ficam"
              nota="Já realizados."
              itens={previa.ficam.map((c) => ({ chave: c.id, texto: rotulo(c.marco, c.nome), data: c.data_prevista, status: ROTULO_STATUS_CHECKPOINT[c.status] }))}
            />
            <ListaDaPrevia
              titulo="Saem da jornada"
              nota="Não aparecem na timeline nem contam no SLA; ficam no histórico."
              tom="saem"
              itens={previa.saem.map((c) => ({ chave: c.id, texto: rotulo(c.marco, c.nome), data: c.data_prevista, status: ROTULO_STATUS_CHECKPOINT[c.status] }))}
            />
            <ListaDaPrevia
              titulo="Criados"
              nota="Do programa novo, a partir do início."
              tom="criados"
              itens={previa.criados.map((c, i) => ({ chave: `${i}-${c.nome}`, texto: rotulo(c.marco, c.nome), data: c.data_prevista }))}
            />
          </div>
          <Campo id={`${id}-motivo`} rotulo="Motivo da troca" obrigatorio erro={erros.motivo}>
            <textarea
              id={`${id}-motivo`}
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className={cn(CAMPO, "h-auto py-2")}
              placeholder="Ex.: renovou para o Blackbelt 12 meses"
            />
          </Campo>
          <ErroDoEnvio texto={erros.envio} />
        </div>
      )}
    </Dialogo>
  );
}

const rotulo = (marco: string | null, nome: string) => (marco ? `${marco} · ${nome}` : nome);

function ListaDaPrevia({
  titulo,
  nota,
  itens,
  tom,
}: {
  titulo: string;
  nota: string;
  itens: { chave: string; texto: string; data: string | null; status?: string }[];
  tom?: "saem" | "criados";
}) {
  return (
    <section
      aria-label={titulo}
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tom === "saem" ? "border-erro-forte/30 bg-erro-forte/[0.06]" : tom === "criados" ? "border-sucesso-forte/30 bg-sucesso-forte/[0.06]" : "border-white/10 bg-white/[0.03]",
      )}
    >
      <h3 className="text-sm font-semibold text-texto">
        {titulo} <span className="font-normal tabular-nums text-texto-sec">({itens.length})</span>
      </h3>
      <p className="text-[11px] leading-snug text-texto-sec">{nota}</p>
      {itens.length === 0 ? (
        <p className="mt-2 text-xs text-texto-sec">Nenhum.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {itens.map((x) => (
            <li key={x.chave} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 text-texto">{x.texto}</span>
              <span className="shrink-0 tabular-nums text-texto-sec">
                {dataCurta(x.data)}
                {x.status ? ` · ${x.status}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
