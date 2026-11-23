"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Usuario } from "@/lib/api/contracts";
import { fetchUsuarios } from "./dataClient";

// ---------------------------------------------------------------------------
// Diretório id→nome dos usuários, buscado UMA vez e compartilhado por todas as
// telas (React Query dedupe pela queryKey ["usuarios"]). Usado para traduzir
// closer_id/sdr_id (UUID) em nomes — passe o mapa a nomeDoUsuario/opcoesDeDono.
//
// Tolerante a falha: sem dados (carregando ou erro), devolve um mapa vazio e o
// front cai no fallback de nomeDoUsuario (conta conhecida do mock, senão o id).
// Em LEADS_MODE=mock a rota devolve as contas do time, então o comportamento
// atual é preservado.
// ---------------------------------------------------------------------------

const usuariosQueryOptions = {
  queryKey: ["usuarios"] as const,
  queryFn: fetchUsuarios,
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
};

export function useUsuariosMap(): ReadonlyMap<string, string> {
  const { data } = useQuery(usuariosQueryOptions);

  return useMemo(
    () => new Map((data ?? []).map((u) => [u.id, u.nome] as const)),
    [data],
  );
}

// Ids de quem saiu (ativo: false): continuam com nome no histórico e viram
// "(desligado)" nos filtros.
export function useDesligados(): ReadonlySet<string> {
  const { data } = useQuery(usuariosQueryOptions);
  return useMemo(() => new Set((data ?? []).filter((u) => !u.ativo).map((u) => u.id)), [data]);
}

// Os closers do diretório: os ativos primeiro (por nome), depois os desligados.
export function useClosers(): Usuario[] {
  const { data } = useQuery(usuariosQueryOptions);
  return useMemo(() => ordenarClosers(data ?? []), [data]);
}

export function ordenarClosers(usuarios: readonly Usuario[]): Usuario[] {
  return usuarios
    .filter((u) => u.papel === "closer")
    .sort((a, b) => Number(!a.ativo) - Number(!b.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
}

// isLoading do diretório (mesma queryKey → o React Query dedupe a busca). Para
// telas que precisam DISTINGUIR "ainda carregando" de "carregou e não achou":
// ex. resolver UUID→slug no Sales Ops antes de declarar "closer sem meta".
export function useUsuariosCarregando(): boolean {
  return useQuery(usuariosQueryOptions).isLoading;
}
