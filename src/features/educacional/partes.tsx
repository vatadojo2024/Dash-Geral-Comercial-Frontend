"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { EducacionalError, FONTE_EDUCACIONAL } from "@/lib/educacional/apiEducacional";
import type { NivelRisco, Responsavel, StatusCheckpoint } from "@/lib/educacional/contrato";
import {
  PONTO_DO_TOM,
  ROTULO_RISCO,
  ROTULO_STATUS_CHECKPOINT,
  ROTULO_TIPO_RESPONSAVEL,
  TAG_DO_TOM,
  TEXTO_DO_TOM,
  TOM_RISCO,
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

export function Risco({ risco, className }: { risco: NivelRisco; className?: string }) {
  const tom = TOM_RISCO[risco];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm", TEXTO_DO_TOM[tom], className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", PONTO_DO_TOM[tom])} aria-hidden />
      {ROTULO_RISCO[risco]}
    </span>
  );
}

// `empilhado`: nome e tipo em duas linhas (cabe na coluna da tabela).
export function NomeResponsavel({ responsavel, empilhado = false }: { responsavel: Responsavel | null; empilhado?: boolean }) {
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

// "Dados de demonstração": só no modo mock (some no modo api).
export function EtiquetaDemonstracao() {
  if (FONTE_EDUCACIONAL !== "mock") return null;
  return (
    <span className="tag tag-warning" title="O módulo está lendo dados fictícios (data_educacional.json), não alunos reais.">
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

export function mensagemDoErro(e: unknown): string {
  return e instanceof Error ? e.message : "Tente novamente em instantes.";
}
