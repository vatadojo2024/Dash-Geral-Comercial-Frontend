"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Colunas visíveis da Tabela tática (spec Fase 2, seção 4), lembradas no
// navegador. As 8 colunas da spec vêm ligadas; Health Score, Dias sem
// atividade, Status do aluno e Mentoria ficam disponíveis.
// ---------------------------------------------------------------------------

export const COLUNAS_DA_TABELA = [
  { id: "nome", rotulo: "Aluno", padrao: true, fixa: true },
  { id: "nivel_inicial", rotulo: "Nível inicial", padrao: true },
  { id: "etapa", rotulo: "Etapa atual", padrao: true },
  { id: "checkpoint", rotulo: "Checkpoint", padrao: true },
  { id: "dias_na_etapa", rotulo: "Dias na etapa", padrao: true },
  { id: "faixa_saude", rotulo: "Faixa de saúde", padrao: true },
  { id: "proxima_acao", rotulo: "Próxima ação", padrao: true },
  { id: "responsavel", rotulo: "Responsável", padrao: true },
  { id: "health_score", rotulo: "Health Score", padrao: false },
  { id: "dias_sem_atividade", rotulo: "Dias sem atividade", padrao: false },
  { id: "status_aluno", rotulo: "Status do aluno", padrao: false },
  { id: "mentoria", rotulo: "Mentoria", padrao: false },
] as const;
export type IdColuna = (typeof COLUNAS_DA_TABELA)[number]["id"];

const CHAVE = "mdc_edu_colunas";
const PADRAO = COLUNAS_DA_TABELA.filter((c) => c.padrao).map((c) => c.id) as IdColuna[];

function ler(): IdColuna[] {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? "null") as unknown;
    if (!Array.isArray(bruto)) return PADRAO;
    const validos = COLUNAS_DA_TABELA.map((c) => c.id).filter((id) => bruto.includes(id));
    return validos.includes("nome") ? validos : ["nome", ...validos];
  } catch {
    return PADRAO;
  }
}

export function useColunasVisiveis() {
  // Padrão no servidor e no 1º render (sem divergir na hidratação); depois, a escolha salva.
  const [visiveis, setVisiveis] = useState<IdColuna[]>(PADRAO);
  useEffect(() => setVisiveis(ler()), []);
  const alternar = (id: IdColuna) =>
    setVisiveis((atual) => {
      const novo = COLUNAS_DA_TABELA.map((c) => c.id).filter((c) => (c === id ? !atual.includes(c) : atual.includes(c)));
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        // Sem armazenamento: vale só nesta aba.
      }
      return novo;
    });
  return { visiveis, alternar };
}

export function SeletorColunas({ visiveis, onAlternar }: { visiveis: IdColuna[]; onAlternar: (id: IdColuna) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => raiz.current && !raiz.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <Button variant="secondary" size="sm" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <Columns3 className="h-3.5 w-3.5" aria-hidden />
        Colunas
      </Button>
      {aberto && (
        <fieldset className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-white/15 bg-painel p-2 shadow-2xl">
          <legend className="sr-only">Colunas visíveis</legend>
          {COLUNAS_DA_TABELA.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-texto hover:bg-white/[0.06]"
            >
              <input
                type="checkbox"
                checked={visiveis.includes(c.id)}
                disabled={"fixa" in c && c.fixa}
                onChange={() => onAlternar(c.id)}
                className="accent-azul"
              />
              {c.rotulo}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
