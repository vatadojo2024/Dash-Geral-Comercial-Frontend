"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apagarPlaybook, criarPlaybook, listarPlaybooks } from "./playbookClient";
import type { PlaybookJob } from "./tipos";

// ---------------------------------------------------------------------------
// Histórico de playbooks + criar/apagar (T-06, T-03). React Query, mesmo padrão
// do chat (useConversas). Só busca quando `habilitado` (sessão + config).
// ---------------------------------------------------------------------------

const CHAVE = ["playbook", "jobs"] as const;

export function usePlaybooks(habilitado: boolean) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: listarPlaybooks,
    enabled: habilitado,
  });

  const criar = useMutation({
    mutationFn: criarPlaybook,
    // O POST devolve só { id, status }; refetch traz o job já na lista.
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });

  const apagar = useMutation({
    mutationFn: (jobId: string) => apagarPlaybook(jobId),
    onSuccess: (_data, jobId) => {
      qc.setQueryData<PlaybookJob[]>(CHAVE, (old) =>
        (old ?? []).filter((j) => j.id !== jobId),
      );
    },
  });

  // Revalida a lista (ex.: quando um job termina, para refletir o novo status).
  const revalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: CHAVE });
  }, [qc]);

  return { query, criar, apagar, revalidar };
}
