"use client";

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  EducacionalError,
  exportarAlunos,
  idsDosAlunos,
  LIMITE_EXPORTACAO,
  type FiltrosAlunos,
} from "@/lib/educacional/apiEducacional";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// "Exportar CSV" da aba Alunos (16/11/2026): o arquivo sai igual à tela. Junta
// os ids de todos os alunos filtrados (não só a página), na ordem da tela, e
// baixa o arquivo que o backend monta. Acima de 2000 alunos, pede para refinar
// o filtro sem chamar a rota. 401 segue o fluxo de sessão expirada do adapter.
// ---------------------------------------------------------------------------

export const AVISO_LIMITE = (total: number) =>
  `São ${total} alunos com esses filtros, e o limite é ${LIMITE_EXPORTACAO}. Refine o filtro para exportar.`;
export const ERRO_EXPORTAR = "Não foi possível exportar. Tente de novo.";
export const SEM_PERMISSAO_EXPORTAR = "Sem permissão para exportar";

// O que a tela diz quando a exportação falha (null = sessão expirada: o adapter já levou ao login).
export function mensagemDaFalha(e: unknown): string | null {
  if (e instanceof EducacionalError && e.status === 401) return null;
  if (e instanceof EducacionalError && e.status === 403) return SEM_PERMISSAO_EXPORTAR;
  return ERRO_EXPORTAR;
}

function baixar({ blob, nome }: { blob: Blob; nome: string }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportarCsv({ filtros, total, desabilitado }: { filtros: FiltrosAlunos; total: number; desabilitado: boolean }) {
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fechar = useCallback(() => setAviso(null), []);

  async function exportar() {
    setAviso(null);
    if (total > LIMITE_EXPORTACAO) {
      setAviso(AVISO_LIMITE(total));
      return;
    }
    setCarregando(true);
    try {
      const ids = await idsDosAlunos(filtros);
      // A lista pode ter mudado desde a última leitura da tela.
      if (ids.length > LIMITE_EXPORTACAO) {
        setAviso(AVISO_LIMITE(ids.length));
        return;
      }
      if (ids.length === 0) {
        setAviso("Nenhum aluno com esses filtros para exportar.");
        return;
      }
      baixar(await exportarAlunos(ids));
    } catch (e) {
      setAviso(mensagemDaFalha(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={exportar} disabled={desabilitado || carregando} aria-busy={carregando}>
        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
        {carregando ? "Exportando…" : "Exportar CSV"}
      </Button>
      {aviso && <Toast mensagem={aviso} onClose={fechar} />}
    </>
  );
}
