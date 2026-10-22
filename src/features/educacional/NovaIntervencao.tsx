"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  atualizarIntervencao,
  buscarNomesDeAlunos,
  criarIntervencao,
  EducacionalError,
} from "@/lib/educacional/apiEducacional";
import type { AlunoDetalhe, Intervencao } from "@/lib/educacional/contrato";
import { ROTULO_TIPO_RESPONSAVEL } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { ativos, CHAVES, useConfig } from "./dados";
import { CAMPO, Campo, Dialogo, ErroDoEnvio } from "./Dialogo";
import { useGravacao } from "./useGravacao";

// ---------------------------------------------------------------------------
// Nova intervenção / editar intervenção. Obrigatórios: aluno, tipo,
// responsável e descrição. Tipos e responsáveis vêm da configuração (ativos;
// na edição, o atual aparece mesmo se inativo). Grava com a versão do aluno.
// ---------------------------------------------------------------------------

type Erros = Partial<Record<"aluno" | "tipo" | "responsavel" | "descricao" | "envio", string>>;
type AlunoEscolhido = { id: string; nome: string; versao: number };

export function NovaIntervencao({
  aberto,
  onFechar,
  onCriada,
  alunoInicial,
  intervencao,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada?: (aluno: AlunoDetalhe) => void;
  alunoInicial?: AlunoEscolhido | null;
  intervencao?: Intervencao | null; // edição
}) {
  const id = useId();
  const gravar = useGravacao();
  const editando = Boolean(intervencao);
  const alunos = useQuery({
    queryKey: [...CHAVES.alunos, "nomes"],
    queryFn: buscarNomesDeAlunos,
    enabled: aberto && !alunoInicial,
    retry: false,
  });
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
    setPrazo(intervencao?.prazo ?? "");
    setDescricao(intervencao?.descricao ?? "");
    setErros({});
    // Só ao abrir (ou trocar de aluno/intervenção): recargas em segundo plano não apagam o que se digita.
  }, [aberto, alunoInicial?.id, intervencao?.id]);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!termo || aluno?.nome === busca) return [];
    return (alunos.data ?? [])
      .filter((a) => a.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo))
      .slice(0, 6);
  }, [busca, aluno, alunos.data]);

  async function enviar() {
    const novos: Erros = {};
    if (!aluno) novos.aluno = "Escolha um aluno da lista.";
    if (!tipo) novos.tipo = "Escolha o tipo.";
    if (!responsavel) novos.responsavel = "Escolha o responsável.";
    if (!descricao.trim()) novos.descricao = "Descreva a intervenção.";
    setErros(novos);
    if (Object.keys(novos).length > 0 || !aluno) return;

    const campos = { tipo_id: tipo, descricao: descricao.trim(), responsavel_id: responsavel, prazo: prazo || null };
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
            {editando ? "Salvar" : "Registrar intervenção"}
          </Button>
        </>
      }
    >
      {!alunoInicial && (
        <Campo id={`${id}-aluno`} rotulo="Aluno" obrigatorio erro={erros.aluno}>
          <div className="relative">
            <input
              id={`${id}-aluno`}
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                if (aluno && e.target.value !== aluno.nome) setAluno(null);
              }}
              placeholder={alunos.isLoading ? "Carregando alunos…" : "Buscar pelo nome"}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={`${id}-sugestoes`}
              className={CAMPO}
            />
            {sugestoes.length > 0 && (
              <ul
                id={`${id}-sugestoes`}
                role="listbox"
                className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-white/15 bg-painel shadow-2xl"
              >
                {sugestoes.map((s) => (
                  <li key={s.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setAluno(s);
                        setBusca(s.nome);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-texto hover:bg-white/10"
                    >
                      {s.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Campo>
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
