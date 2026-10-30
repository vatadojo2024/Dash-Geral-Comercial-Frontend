"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buscarNomesDeAlunos } from "@/lib/educacional/apiEducacional";
import { CHAVES } from "./dados";
import { CAMPO, Campo } from "./Dialogo";

// ---------------------------------------------------------------------------
// Busca de aluno pelo nome (lista enxuta, com a versão para gravar), usada no
// "Nova intervenção" e no "Nova aula" do Calendário. O texto e o aluno
// escolhido ficam com quem usa (para limpar ao abrir).
// ---------------------------------------------------------------------------

export type AlunoEscolhido = { id: string; nome: string; versao: number };

const semAcento = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function EscolherAluno({
  id,
  aberto,
  busca,
  onBusca,
  aluno,
  onAluno,
  erro,
}: {
  id: string;
  aberto: boolean;
  busca: string;
  onBusca: (t: string) => void;
  aluno: AlunoEscolhido | null;
  onAluno: (a: AlunoEscolhido | null) => void;
  erro?: string;
}) {
  const alunos = useQuery({
    queryKey: [...CHAVES.alunos, "nomes"],
    queryFn: buscarNomesDeAlunos,
    enabled: aberto,
    retry: false,
  });
  const sugestoes = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo || aluno?.nome === busca) return [];
    return (alunos.data ?? []).filter((a) => semAcento(a.nome).includes(termo)).slice(0, 6);
  }, [busca, aluno, alunos.data]);

  return (
    <Campo id={`${id}-aluno`} rotulo="Aluno" obrigatorio erro={erro}>
      <div className="relative">
        <input
          id={`${id}-aluno`}
          value={busca}
          onChange={(e) => {
            onBusca(e.target.value);
            if (aluno && e.target.value !== aluno.nome) onAluno(null);
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
                    onAluno(s);
                    onBusca(s.nome);
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
  );
}
