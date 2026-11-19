"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { VALIDADE } from "@/lib/data/validade";
import { fetchOperadoresSdr, OperadoresIndisponiveisError } from "@/lib/data/dataClient";
import { montarTime } from "@/lib/data/sdrDashboard";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";

// ---------------------------------------------------------------------------
// O time de SDRs do mês que a tela mostra (GET /api/sdr/operadores?mes=): a
// lista, o reconhecimento dos nomes da API externa e as metas daquele mês.
// ---------------------------------------------------------------------------

export function useTimeSdr(mes: string | null) {
  const consulta = useQuery({
    queryKey: ["sdr-operadores", mes],
    queryFn: () => fetchOperadoresSdr(mes!),
    enabled: Boolean(mes),
    staleTime: VALIDADE.pacoteSdr,
    retry: (tentativas, erro) => !(erro instanceof OperadoresIndisponiveisError) && tentativas < 1,
  });
  const time = useMemo(() => (consulta.data ? montarTime(consulta.data) : null), [consulta.data]);
  return { ...consulta, time };
}

// Sem a lista de SDRs não há números: com o de-para fora do ar (503), avisa em
// vez de mostrar uma equipe vazia como se fosse a verdade.
export function TimeIndisponivel({ erro, onRetry }: { erro: unknown; onRetry: () => void }) {
  const deParaFora = erro instanceof OperadoresIndisponiveisError;
  return (
    <Card>
      <ErrorState
        error={erro}
        titulo={deParaFora ? "Lista de SDRs indisponível" : "Não foi possível carregar a lista de SDRs"}
        descricao={
          deParaFora
            ? "O cadastro dos SDRs não carregou no backend. Os números ficam de fora até ele voltar, para não mostrar uma equipe vazia. Tente de novo em alguns minutos."
            : erro instanceof Error
              ? erro.message
              : "Tente novamente."
        }
        onRetry={onRetry}
        retryLabel="Tentar de novo"
      />
    </Card>
  );
}
