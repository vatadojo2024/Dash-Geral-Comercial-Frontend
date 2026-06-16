"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function useUsuariosMap(): ReadonlyMap<string, string> {
  const { data } = useQuery({
    queryKey: ["usuarios"],
    queryFn: fetchUsuarios,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

  return useMemo(
    () => new Map((data ?? []).map((u) => [u.id, u.nome] as const)),
    [data],
  );
}
