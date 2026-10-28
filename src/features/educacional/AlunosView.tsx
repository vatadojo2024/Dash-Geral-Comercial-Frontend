"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CHAVES } from "./dados";
import { lerEstado, lerSimular, queryDoEstado, type EstadoTabela } from "./estado";
import { EtiquetaDemonstracao } from "./partes";
import { TabelaTatica } from "./TabelaTatica";

// ---------------------------------------------------------------------------
// Aba Alunos (/educacional/alunos, Fase 3, 3.3): a lista completa, que saiu do
// Cockpit. Funciona como a aba Leads: busca, filtros, ordem, página e Lista |
// Kanban na URL; o Raio-X volta para a mesma URL.
// ---------------------------------------------------------------------------

export function AlunosView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const estado = lerEstado(searchParams);
  const simular = lerSimular(searchParams);
  const atualizando = useIsFetching({ queryKey: CHAVES.alunos }) > 0;

  function mudarEstado(novo: EstadoTabela) {
    const q = queryDoEstado(novo, simular);
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Alunos</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">Alunos</h1>
            <EtiquetaDemonstracao />
          </div>
          <p className="mt-1 text-sm opacity-80">Todos os alunos da jornada, com busca, filtros e Kanban</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={atualizando}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: CHAVES.alunos });
            void queryClient.invalidateQueries({ queryKey: CHAVES.config });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Atualizar
        </Button>
      </header>

      <TabelaTatica estado={estado} simular={simular} onMudar={mudarEstado} />
    </>
  );
}
