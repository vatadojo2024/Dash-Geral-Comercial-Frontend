"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apagarConversa, criarConversa, listarConversas } from "./chatClient";
import type { Conversa } from "./tipos";

// ---------------------------------------------------------------------------
// Lista de conversas + ações de criar/apagar (T-03, T-06). React Query — mesmo
// padrão das telas do Mapa de Calor. Só busca quando `habilitado` (sessão+config).
//
// As mutações atualizam o CACHE na hora (prepend/remove) em vez de só invalidar:
// assim a conversa recém-criada já existe na lista no mesmo render, e a tela de
// chat abre imediatamente — sem depender do round-trip do refetch.
// ---------------------------------------------------------------------------

const CHAVE = ["chat", "conversas"] as const;

export function useConversas(habilitado: boolean) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: listarConversas,
    enabled: habilitado,
  });

  const criar = useMutation({
    mutationFn: criarConversa,
    onSuccess: (nova) => {
      // Prepende a nova conversa (mais recente primeiro), sem duplicar.
      qc.setQueryData<Conversa[]>(CHAVE, (old) => [
        nova,
        ...(old ?? []).filter((c) => c.id !== nova.id),
      ]);
    },
  });

  const apagar = useMutation({
    mutationFn: (conversaId: string) => apagarConversa(conversaId),
    onSuccess: (_data, conversaId) => {
      // Remove da lista na hora.
      qc.setQueryData<Conversa[]>(CHAVE, (old) =>
        (old ?? []).filter((c) => c.id !== conversaId),
      );
    },
  });

  return { query, criar, apagar };
}
