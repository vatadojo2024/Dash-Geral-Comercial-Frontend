"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { EducacionalError, FONTE_EDUCACIONAL } from "@/lib/educacional/apiEducacional";
import type { AlunoLinha, FaixaSaude, StatusCheckpoint } from "@/lib/educacional/contrato";
import { textoDoErro } from "@/lib/educacional/erros";
import {
  AVISOS_CONHECIDOS,
  PONTO_DO_TOM,
  ROTULO_FAIXA,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_TIPO_RESPONSAVEL,
  TAG_DO_TOM,
  TEXTO_DO_TOM,
  TOM_FAIXA,
  TOM_STATUS_CHECKPOINT,
} from "@/lib/educacional/rotulos";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Peças pequenas do módulo Educacional. Status é SEMPRE cor + texto (nunca só
// cor), nas cores semânticas fixas da spec.
// ---------------------------------------------------------------------------

export function BadgeCheckpoint({ status }: { status: StatusCheckpoint }) {
  return <span className={cn("tag", TAG_DO_TOM[TOM_STATUS_CHECKPOINT[status]])}>{ROTULO_STATUS_CHECKPOINT[status]}</span>;
}

// Faixa de saúde (valor efetivo). Sem Health Score ainda → "Sem cálculo".
export function Faixa({ faixa, className }: { faixa: FaixaSaude | null; className?: string }) {
  if (!faixa) return <span className={cn("whitespace-nowrap text-sm text-texto-sec/70", className)}>Sem cálculo</span>;
  const tom = TOM_FAIXA[faixa];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", TEXTO_DO_TOM[tom], className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", PONTO_DO_TOM[tom])} aria-hidden />
      {ROTULO_FAIXA[faixa]}
    </span>
  );
}

// `empilhado`: nome e tipo em duas linhas (cabe na coluna da tabela).
export function NomeResponsavel({
  responsavel,
  empilhado = false,
}: {
  responsavel: AlunoLinha["responsavel"];
  empilhado?: boolean;
}) {
  if (!responsavel) return <span className="text-texto-sec/60">Sem responsável</span>;
  if (empilhado) {
    return (
      <span className="block whitespace-nowrap leading-tight">
        <span className="block text-texto">{responsavel.nome}</span>
        <span className="block text-xs text-texto-sec">{ROTULO_TIPO_RESPONSAVEL[responsavel.tipo]}</span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap">
      <span className="text-texto">{responsavel.nome}</span>
      <span className="text-texto-sec"> · {ROTULO_TIPO_RESPONSAVEL[responsavel.tipo]}</span>
    </span>
  );
}

// Avisos do backend ao lado do nome (Raio-X, tabela e Kanban). Só informam.
export function AvisosDoAluno({ avisos, compacto = false }: { avisos: string[]; compacto?: boolean }) {
  const conhecidos = avisos.filter((c, i) => AVISOS_CONHECIDOS[c] && avisos.indexOf(c) === i);
  if (!conhecidos.length) return null;
  return (
    <>
      {conhecidos.map((c) => (
        <span
          key={c}
          className={cn("tag tag-warning shrink-0 whitespace-nowrap", compacto && "px-1.5 py-0 text-[10px]")}
          title={AVISOS_CONHECIDOS[c].dica}
        >
          {AVISOS_CONHECIDOS[c].rotulo}
        </span>
      ))}
    </>
  );
}

// "Dados de demonstração": só no modo mock (some no modo api).
export function EtiquetaDemonstracao() {
  if (FONTE_EDUCACIONAL !== "mock") return null;
  return (
    <span className="tag tag-warning" title="O módulo está usando dados fictícios, salvos só neste navegador — não são alunos reais.">
      <FlaskConical className="h-3 w-3" aria-hidden />
      Dados de demonstração
    </span>
  );
}

// Regra do módulo (spec, seção 2): 403 leva à home do módulo permitido, sem
// exibir conteúdo. (401 já leva ao login no adapter.)
export function useRedirecionarSeSemPermissao(erros: unknown[]): boolean {
  const router = useRouter();
  const semPermissao = erros.some((e) => e instanceof EducacionalError && e.status === 403);
  useEffect(() => {
    if (semPermissao) router.replace("/");
  }, [semPermissao, router]);
  return semPermissao;
}

// Sempre em português: erro que não veio da API (ex.: "Failed to fetch") vira texto da tela.
export function mensagemDoErro(e: unknown): string {
  return textoDoErro(e);
}
