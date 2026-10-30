"use client";

import { useEffect, useId, useState } from "react";
import { atualizarIntervencao, criarIntervencao, EducacionalError } from "@/lib/educacional/apiEducacional";
import type { AlunoDetalhe, CamposIntervencao, Intervencao } from "@/lib/educacional/contrato";
import { ROTULO_TIPO_RESPONSAVEL } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ativos, useConfig } from "./dados";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { EscolherAluno, type AlunoEscolhido } from "./EscolherAluno";
import type { IntervencaoNaTela } from "./lote/alteracoes";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Nova intervenção / editar intervenção. Obrigatórios: aluno, tipo,
// responsável e descrição. Tipos e responsáveis vêm da configuração (ativos;
// na edição, o atual aparece mesmo se inativo). Grava com a versão do aluno.
// Com `aoAplicar` (ficha do Raio-X, Fase 3): não grava; devolve os campos e o
// que a tela mostra, e a intervenção vira alteração pendente.
// `prazoInicial` (Calendário, Entrega 2): o dia clicado já vem no prazo.
// ---------------------------------------------------------------------------

type Erros = Partial<Record<"aluno" | "tipo" | "responsavel" | "descricao" | "envio", string>>;

export function NovaIntervencao({
  aberto,
  onFechar,
  onCriada,
  alunoInicial,
  intervencao,
  aoAplicar,
  prazoInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada?: (aluno: AlunoDetalhe) => void;
  alunoInicial?: AlunoEscolhido | null;
  intervencao?: Intervencao | null; // edição
  aoAplicar?: (campos: CamposIntervencao, tela: IntervencaoNaTela) => void;
  prazoInicial?: string;
}) {
  const id = useId();
  const gravar = useGravacao();
  const editando = Boolean(intervencao);
  const config = useConfig();
  const tipos = ativos(config.data?.tipos_intervencao);
  const responsaveis = ativos(config.data?.responsaveis);
  if (intervencao && !tipos.some((t) => t.id === intervencao.tipo.id)) tipos.push({ ...intervencao.tipo, ativo: false });
  if (intervencao?.responsavel && !responsaveis.some((r) => r.id === intervencao.responsavel?.id)) {
    responsaveis.push({ ...intervencao.responsavel, ativo: false });
  }

  const [busca, setBusca] = useState("");
  const [aluno, setAluno] = useState<AlunoEscolhido | null>(null);
  const [tipo, setTipo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  // Abre limpo (ou com o aluno do Raio-X / a intervenção em edição).
  useEffect(() => {
    if (!aberto) return;
    setAluno(alunoInicial ?? null);
    setBusca(alunoInicial?.nome ?? "");
    setTipo(intervencao?.tipo.id ?? "");
    setResponsavel(intervencao?.responsavel?.id ?? "");
    setPrazo(intervencao?.prazo ?? prazoInicial ?? "");
    setDescricao(intervencao?.descricao ?? "");
    setErros({});
    // Só ao abrir (ou trocar de aluno/intervenção): recargas em segundo plano não apagam o que se digita.
  }, [aberto, alunoInicial?.id, intervencao?.id, prazoInicial]);

  async function enviar() {
    const novos: Erros = {};
    if (!aluno) novos.aluno = "Escolha um aluno da lista.";
    if (!tipo) novos.tipo = "Escolha o tipo.";
    if (!responsavel) novos.responsavel = "Escolha o responsável.";
    if (!descricao.trim()) novos.descricao = "Descreva a intervenção.";
    setErros(novos);
    if (Object.keys(novos).length > 0 || !aluno) return;

    const campos = { tipo_id: tipo, descricao: descricao.trim(), responsavel_id: responsavel, prazo: prazo || null };
    if (aoAplicar) {
      const t = tipos.find((x) => x.id === tipo);
      const r = responsaveis.find((x) => x.id === responsavel);
      aoAplicar(campos, {
        descricao: campos.descricao,
        prazo: campos.prazo,
        ...(t ? { tipo: { id: t.id, nome: t.nome } } : {}),
        responsavel: r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null,
      });
      return onFechar();
    }
    setEnviando(true);
    const r = await gravar({
      alunoId: aluno.id,
      versao: aluno.versao,
      executar: (v) =>
        intervencao ? atualizarIntervencao(intervencao.id, v, campos) : criarIntervencao(v, { aluno_id: aluno.id, ...campos }),
      noAluno: intervencao
        ? (d) => ({
            ...d,
            intervencoes: d.intervencoes.map((i) =>
              i.id === intervencao.id
                ? {
                    ...i,
                    descricao: campos.descricao,
                    prazo: campos.prazo,
                    tipo: tipos.find((t) => t.id === tipo) ?? i.tipo,
                    responsavel: responsaveis.find((x) => x.id === responsavel) ?? i.responsavel,
                  }
                : i,
            ),
          })
        : undefined,
    });
    setEnviando(false);
    if (r.ok) {
      onCriada?.(r.aluno);
      onFechar();
    } else if (r.erro instanceof EducacionalError && r.erro.status === 400) {
      setErros({ envio: r.erro.corpo.mensagem ?? r.erro.message });
    } else onFechar();
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo={editando ? "Editar intervenção" : "Nova intervenção"}
      subtitulo={alunoInicial?.nome}
      onFechar={onFechar}
      onEnviar={enviar}
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            {aoAplicar ? (editando ? "Aplicar" : "Adicionar") : editando ? "Salvar" : "Registrar intervenção"}
          </Button>
        </>
      }
    >
      {!alunoInicial && (
        <EscolherAluno id={id} aberto={aberto} busca={busca} onBusca={setBusca} aluno={aluno} onAluno={setAluno} erro={erros.aluno} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-tipo`} rotulo="Tipo" obrigatorio erro={erros.tipo}>
          <select id={`${id}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>
            <option value="">Escolha…</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-resp`} rotulo="Responsável" obrigatorio erro={erros.responsavel}>
          <select id={`${id}-resp`} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={CAMPO}>
            <option value="">Escolha…</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} · {ROTULO_TIPO_RESPONSAVEL[r.tipo]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo id={`${id}-prazo`} rotulo="Prazo">
        <input id={`${id}-prazo`} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={CAMPO} />
      </Campo>

      <Campo id={`${id}-descricao`} rotulo="Descrição" obrigatorio erro={erros.descricao}>
        <textarea
          id={`${id}-descricao`}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className={cn(CAMPO, "h-auto py-2")}
          placeholder="O que vai ser feito e por quê"
        />
      </Campo>
      <ErroDoEnvio texto={erros.envio} />
    </Dialogo>
  );
}
