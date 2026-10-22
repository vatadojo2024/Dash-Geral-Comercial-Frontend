"use client";

import { useQuery } from "@tanstack/react-query";
import { buscarConfig } from "@/lib/educacional/apiEducacional";
import type { Config } from "@/lib/educacional/contrato";

// ---------------------------------------------------------------------------
// Chaves do React Query do módulo (tudo sob "edu", para "Atualizar" invalidar
// de uma vez) e a configuração (etapas, tipos, responsáveis), lida uma vez.
// ---------------------------------------------------------------------------

export const CHAVES = {
  tudo: ["edu"] as const,
  resumo: ["edu", "resumo"] as const,
  alunos: ["edu", "alunos"] as const,
  aluno: (id: string) => ["edu", "aluno", id] as const,
  historico: (id: string) => ["edu", "historico", id] as const,
  config: ["edu", "config"] as const,
};

export function useConfig() {
  return useQuery({ queryKey: CHAVES.config, queryFn: buscarConfig, staleTime: 60_000, retry: false });
}

// Só os itens ativos (listas de escolha). Inativos aparecem só nas Configurações.
export function ativos<T extends { ativo: boolean }>(itens: readonly T[] | undefined): T[] {
  return (itens ?? []).filter((i) => i.ativo);
}

export function etapasAtivas(config: Config | undefined) {
  return ativos(config?.etapas).sort((a, b) => a.ordem - b.ordem);
}
