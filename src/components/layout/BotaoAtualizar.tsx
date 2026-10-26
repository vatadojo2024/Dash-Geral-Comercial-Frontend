"use client";

import { useIsFetching, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// "Atualizar" das telas comerciais: busca de novo só as consultas da tela
// (pelas chaves, como prefixo) e mostra carregando enquanto elas buscam. Mesmo
// visual do "Atualizar" que Oportunidades e Retenção já tinham.
// ---------------------------------------------------------------------------

function casa(chave: QueryKey, prefixo: QueryKey) {
  return prefixo.every((parte, i) => JSON.stringify(chave[i]) === JSON.stringify(parte));
}

export function BotaoAtualizar({ chaves }: { chaves: QueryKey[] }) {
  const queryClient = useQueryClient();
  const buscando = useIsFetching({ predicate: (q) => chaves.some((k) => casa(q.queryKey, k)) }) > 0;
  return (
    <Button
      variant="outline"
      size="sm"
      loading={buscando}
      onClick={() => void Promise.all(chaves.map((k) => queryClient.invalidateQueries({ queryKey: k })))}
    >
      {!buscando && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
      Atualizar
    </Button>
  );
}
