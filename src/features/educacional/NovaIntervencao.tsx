"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { buscarNomesDeAlunos, criarIntervencao, FONTE_EDUCACIONAL } from "@/lib/educacional/apiEducacional";
import {
  TIPOS_INTERVENCAO,
  TIPOS_RESPONSAVEL,
  type Intervencao,
  type TipoIntervencao,
  type TipoResponsavel,
} from "@/lib/educacional/contrato";
import { ROTULO_TIPO_INTERVENCAO, ROTULO_TIPO_RESPONSAVEL } from "@/lib/educacional/rotulos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { mensagemDoErro } from "./partes";

// ---------------------------------------------------------------------------
// Modal "Nova intervenção" (spec, seção 7). Obrigatórios: aluno, tipo,
// responsável e descrição. Modo mock: fica em memória e aparece no Raio-X do
// aluno até recarregar a página. Modo api: POST /api/educacional/intervencoes.
// ---------------------------------------------------------------------------

type Erros = Partial<Record<"aluno" | "tipo" | "responsavel" | "descricao" | "envio", string>>;

const CAMPO =
  "h-9 w-full rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto focus:border-azul/50";

export function NovaIntervencao({
  aberto,
  onFechar,
  onCriada,
  alunoInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (aluno: { id: string; nome: string }, intervencao: Intervencao) => void;
  alunoInicial?: { id: string; nome: string } | null;
}) {
  const queryClient = useQueryClient();
  const id = useId();
  const primeiro = useRef<HTMLInputElement>(null);
  const alunos = useQuery({ queryKey: ["edu", "nomes"], queryFn: buscarNomesDeAlunos, enabled: aberto, retry: false });

  const [busca, setBusca] = useState("");
  const [aluno, setAluno] = useState<{ id: string; nome: string } | null>(null);
  const [tipo, setTipo] = useState<TipoIntervencao | "">("");
  const [tipoResp, setTipoResp] = useState<TipoResponsavel | "">("");
  const [nomeResp, setNomeResp] = useState("");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);

  // Abre limpo (ou com o aluno do Raio-X) e põe o foco no primeiro campo.
  useEffect(() => {
    if (!aberto) return;
    setAluno(alunoInicial ?? null);
    setBusca(alunoInicial?.nome ?? "");
    setTipo("");
    setTipoResp("");
    setNomeResp("");
    setPrazo("");
    setDescricao("");
    setErros({});
    setTimeout(() => primeiro.current?.focus(), 0);
  }, [aberto, alunoInicial]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!termo || aluno?.nome === busca) return [];
    return (alunos.data ?? [])
      .filter((a) => a.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo))
      .slice(0, 6);
  }, [busca, aluno, alunos.data]);

  if (!aberto) return null;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const novos: Erros = {};
    if (!aluno) novos.aluno = "Escolha um aluno da lista.";
    if (!tipo) novos.tipo = "Escolha o tipo.";
    if (!tipoResp || !nomeResp.trim()) novos.responsavel = "Informe o tipo e o nome do responsável.";
    if (!descricao.trim()) novos.descricao = "Descreva a intervenção.";
    setErros(novos);
    if (Object.keys(novos).length > 0 || !aluno || !tipo || !tipoResp) return;

    setEnviando(true);
    try {
      const criada = await criarIntervencao({
        aluno_id: aluno.id,
        tipo,
        descricao: descricao.trim(),
        responsavel: { tipo: tipoResp, nome: nomeResp.trim() },
        prazo: prazo || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["edu", "aluno", aluno.id] });
      onCriada(aluno, criada);
      onFechar();
    } catch (err) {
      setErros({ envio: mensagemDoErro(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} aria-hidden />
      <form
        onSubmit={enviar}
        noValidate
        className="modal-surface modal-border relative w-full max-w-lg rounded-modal p-6 shadow-layered"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={`${id}-titulo`} className="font-jakarta text-xl font-semibold tracking-tight text-texto">
              Nova intervenção
            </h2>
            {FONTE_EDUCACIONAL === "mock" && (
              <p className="mt-0.5 text-xs text-texto-sec">Demonstração: a intervenção fica só nesta sessão e some ao recarregar.</p>
            )}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="icon-button">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <Campo id={`${id}-aluno`} rotulo="Aluno" obrigatorio erro={erros.aluno}>
            <div className="relative">
              <input
                ref={primeiro}
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

          <Campo id={`${id}-tipo`} rotulo="Tipo" obrigatorio erro={erros.tipo}>
            <select id={`${id}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoIntervencao)} className={CAMPO}>
              <option value="">Escolha…</option>
              {TIPOS_INTERVENCAO.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_INTERVENCAO[t]}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id={`${id}-resp-tipo`} rotulo="Responsável" obrigatorio erro={erros.responsavel}>
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <select
                id={`${id}-resp-tipo`}
                aria-label="Tipo do responsável"
                value={tipoResp}
                onChange={(e) => setTipoResp(e.target.value as TipoResponsavel)}
                className={CAMPO}
              >
                <option value="">Tipo…</option>
                {TIPOS_RESPONSAVEL.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_RESPONSAVEL[t]}
                  </option>
                ))}
              </select>
              <input
                id={`${id}-resp-nome`}
                aria-label="Nome do responsável"
                value={nomeResp}
                onChange={(e) => setNomeResp(e.target.value)}
                placeholder="Nome"
                className={CAMPO}
              />
            </div>
          </Campo>

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

          {erros.envio && (
            <p className="rounded-lg border border-erro-forte/30 bg-erro-forte/10 px-3 py-2 text-sm text-erro" role="alert">
              {erros.envio}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={enviando}>
            Registrar intervenção
          </Button>
        </div>
      </form>
    </div>
  );
}

function Campo({
  id,
  rotulo,
  obrigatorio = false,
  erro,
  children,
}: {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-texto-sec">
        {rotulo}
        {obrigatorio && <span className="text-erro"> *</span>}
      </label>
      {children}
      {erro && (
        <p className="text-xs text-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
