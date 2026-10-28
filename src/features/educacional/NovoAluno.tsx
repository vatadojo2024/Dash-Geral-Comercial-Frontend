"use client";

import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { criarAluno, EducacionalError } from "@/lib/educacional/apiEducacional";
import {
  AUTORIZACOES_PROVA_SOCIAL,
  NIVEIS_INICIAIS,
  STATUS_ALUNO,
  type AlunoDetalhe,
  type AutorizacaoProvaSocial,
  type NivelInicial,
  type StatusAluno,
} from "@/lib/educacional/contrato";
import {
  hojeEmBrasilia,
  ROTULO_AUTORIZACAO,
  ROTULO_NIVEL,
  ROTULO_STATUS_ALUNO,
  ROTULO_TIPO_RESPONSAVEL,
} from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ativos, CHAVES, etapasAtivas, useConfig } from "./dados";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { programasPorMentoria, sugerirTermino } from "./programas";
import { useAcaoComAviso } from "./useGravacao";

// ---------------------------------------------------------------------------
// Novo aluno (spec Fase 2, 6.1). Obrigatórios: nome, programa, data de
// entrada, nível inicial e etapa (padrão: a primeira ativa). Os checkpoints
// vêm do backend, gerados pela lista do programa. Depois de criar, abre o Raio-X.
// Programas (P2): o programa substitui o texto livre de mentoria (a mentoria
// vem dele; o backend recusa `mentoria` no POST) e sugere o término (início +
// duração), que continua editável. Só programas ativos (inativo dá 400).
// ---------------------------------------------------------------------------

type Erros = Partial<Record<"nome" | "programa_id" | "data_entrada" | "nivel_inicial" | "etapa_id" | "envio", string>>;

export function NovoAluno({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (aluno: AlunoDetalhe) => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const executar = useAcaoComAviso();
  const config = useConfig();
  const etapas = etapasAtivas(config.data);
  const responsaveis = ativos(config.data?.responsaveis);
  const grupos = programasPorMentoria(config.data);
  const semProgramas = config.isSuccess && grupos.length === 0;

  const [nome, setNome] = useState("");
  const [programaId, setProgramaId] = useState("");
  // Término mexido à mão: a sugestão não sobrescreve mais.
  const [terminoManual, setTerminoManual] = useState(false);
  const [entrada, setEntrada] = useState("");
  const [termino, setTermino] = useState("");
  const [nivel, setNivel] = useState<NivelInicial | "">("");
  const [etapa, setEtapa] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [status, setStatus] = useState<StatusAluno>("ativo");
  const [autorizacao, setAutorizacao] = useState<AutorizacaoProvaSocial>("pendente");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome("");
    setProgramaId("");
    setTerminoManual(false);
    setEntrada(hojeEmBrasilia());
    setTermino("");
    setNivel("");
    setEtapa("");
    setObjetivo("");
    setResponsavel("");
    setStatus("ativo");
    setAutorizacao("pendente");
    setObservacoes("");
    setErros({});
  }, [aberto]);

  const etapaEscolhida = etapa || etapas[0]?.id || "";
  const programa = config.data?.programas.find((p) => p.id === programaId) ?? null;

  // Sugere o término ao escolher o programa ou mudar a entrada.
  function sugerir(proximoPrograma: string, proximaEntrada: string) {
    if (terminoManual) return;
    const p = config.data?.programas.find((x) => x.id === proximoPrograma);
    setTermino(p && proximaEntrada ? sugerirTermino(proximaEntrada, p.duracao_meses) : "");
  }

  async function enviar() {
    const novos: Erros = {};
    if (!nome.trim()) novos.nome = "Informe o nome.";
    if (!programaId) novos.programa_id = semProgramas ? "Nenhum programa ativo." : "Escolha o programa.";
    if (!entrada) novos.data_entrada = "Informe a data de entrada.";
    if (!nivel) novos.nivel_inicial = "Escolha o nível inicial.";
    if (!etapaEscolhida) novos.etapa_id = "Escolha a etapa.";
    setErros(novos);
    if (Object.keys(novos).length > 0 || !nivel) return;
    setEnviando(true);
    const r = await executar(
      () =>
        criarAluno({
          nome: nome.trim(),
          programa_id: programaId,
          data_entrada: entrada,
          nivel_inicial: nivel,
          etapa_id: etapaEscolhida,
          data_termino: termino || null,
          objetivo: objetivo.trim() || null,
          responsavel_id: responsavel || null,
          status_aluno: status,
          autorizacao_prova_social: autorizacao,
          observacoes: observacoes.trim() || null,
        }),
      "Aluno criado",
    );
    setEnviando(false);
    if (r.ok) {
      queryClient.setQueryData([...CHAVES.aluno(r.valor.id), null], r.valor);
      void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
      void queryClient.invalidateQueries({ queryKey: CHAVES.resumo });
      onFechar();
      onCriado(r.valor);
    } else if (r.erro instanceof EducacionalError && r.erro.status === 400) {
      const campo = r.erro.corpo.campo as keyof Erros | undefined;
      const msg = r.erro.corpo.mensagem ?? r.erro.message;
      setErros(campo && campo in rotulosDosCampos ? { [campo]: msg } : { envio: msg });
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo="Novo aluno"
      subtitulo="Os checkpoints são criados a partir do programa e da data de entrada."
      onFechar={onFechar}
      onEnviar={enviar}
      largura="max-w-2xl"
      rodape={
        <>
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            Criar aluno
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-nome`} rotulo="Nome" obrigatorio erro={erros.nome}>
          <input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} autoComplete="off" />
        </Campo>
        <Campo
          id={`${id}-programa`}
          rotulo="Programa"
          obrigatorio
          erro={erros.programa_id}
          dica={
            programa
              ? `Mentoria ${programa.mentoria} · ${programa.duracao_meses} meses`
              : semProgramas
                ? "Nenhum programa ativo. Cadastre um em Configurações → Programas."
                : undefined
          }
        >
          <select
            id={`${id}-programa`}
            value={programaId}
            onChange={(e) => {
              setProgramaId(e.target.value);
              sugerir(e.target.value, entrada);
              setErros(({ programa_id: _, ...resto }) => resto);
            }}
            className={CAMPO}
          >
            <option value="">Escolha…</option>
            {grupos.map((g) => (
              <optgroup key={g.mentoria} label={g.mentoria}>
                {g.programas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-entrada`} rotulo="Data de entrada" obrigatorio erro={erros.data_entrada}>
          <input
            id={`${id}-entrada`}
            type="date"
            value={entrada}
            onChange={(e) => {
              setEntrada(e.target.value);
              sugerir(programaId, e.target.value);
            }}
            className={CAMPO}
          />
        </Campo>
        <Campo
          id={`${id}-termino`}
          rotulo="Data de término"
          dica={programa && !terminoManual ? "Sugerida: entrada + duração do programa. Pode mudar." : undefined}
        >
          <input
            id={`${id}-termino`}
            type="date"
            value={termino}
            onChange={(e) => {
              setTermino(e.target.value);
              setTerminoManual(true);
            }}
            className={CAMPO}
          />
        </Campo>
        <Campo id={`${id}-nivel`} rotulo="Nível inicial" obrigatorio erro={erros.nivel_inicial}>
          <select id={`${id}-nivel`} value={nivel} onChange={(e) => setNivel(e.target.value as NivelInicial)} className={CAMPO}>
            <option value="">Escolha…</option>
            {NIVEIS_INICIAIS.map((n) => (
              <option key={n} value={n}>
                {ROTULO_NIVEL[n]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-etapa`} rotulo="Etapa" obrigatorio erro={erros.etapa_id}>
          <select id={`${id}-etapa`} value={etapaEscolhida} onChange={(e) => setEtapa(e.target.value)} className={CAMPO}>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-resp`} rotulo="Responsável">
          <select id={`${id}-resp`} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={CAMPO}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome} · {ROTULO_TIPO_RESPONSAVEL[r.tipo]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-status`} rotulo="Status do aluno">
          <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value as StatusAluno)} className={CAMPO}>
            {STATUS_ALUNO.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_ALUNO[s]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id={`${id}-autorizacao`} rotulo="Autorização de prova social">
          <select
            id={`${id}-autorizacao`}
            value={autorizacao}
            onChange={(e) => setAutorizacao(e.target.value as AutorizacaoProvaSocial)}
            className={CAMPO}
          >
            {AUTORIZACOES_PROVA_SOCIAL.map((s) => (
              <option key={s} value={s}>
                {ROTULO_AUTORIZACAO[s]}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo id={`${id}-objetivo`} rotulo="Objetivo">
        <input id={`${id}-objetivo`} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={CAMPO} />
      </Campo>
      <Campo id={`${id}-obs`} rotulo="Observações">
        <textarea id={`${id}-obs`} rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={cn(CAMPO, "h-auto py-2")} />
      </Campo>
      <ErroDoEnvio texto={erros.envio} />
    </Dialogo>
  );
}

const rotulosDosCampos = { nome: 1, programa_id: 1, data_entrada: 1, nivel_inicial: 1, etapa_id: 1 } as const;
