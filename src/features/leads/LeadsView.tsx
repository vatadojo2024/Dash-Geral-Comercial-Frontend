"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { fetchLeads } from "@/lib/data/dataClient";
import { opcoesDeDono } from "@/lib/data/donos";
import { filtrarPorEscopo } from "@/lib/data/escopo";
import { useUsuariosMap } from "@/lib/data/useUsuarios";
import { useSession } from "@/features/session/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { LeadPriorityCard } from "@/components/domain/LeadPriorityCard";
import { LeadFilters } from "./LeadFilters";
import { filtrarLeads } from "./filtros";

export function LeadsView() {
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });

  // URL como fonte de verdade: todo filtro deriva da query string. O escopo do
  // papel (mesmo helper da Ações/Agenda) é aplicado ANTES, defensivamente.
  const filtrados = useMemo(
    () =>
      data
        ? filtrarLeads(filtrarPorEscopo(data, user), new URLSearchParams(searchParams))
        : [],
    [data, user, searchParams],
  );

  // Diretório id→nome (traduz os UUIDs de closer_id/sdr_id).
  const usuarios = useUsuariosMap();

  // Opções de Closer/SDR derivadas dos próprios leads (ids reais) — ver donos.ts.
  const donos = useMemo(() => opcoesDeDono(data ?? [], usuarios), [data, usuarios]);

  function setParam(chave: string, valor: string | null) {
    const sp = new URLSearchParams(searchParams);
    if (valor) sp.set(chave, valor);
    else sp.delete(chave);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <LeadFilters
        params={new URLSearchParams(searchParams)}
        onChange={setParam}
        onLimpar={() => router.replace(pathname, { scroll: false })}
        closers={donos.closers}
        sdrs={donos.sdrs}
      />

      {isLoading ? (
        <div className="space-y-3" aria-label="Carregando fila de prioridade">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-borda bg-painel">
          <ErrorState
            titulo="Não foi possível carregar a fila"
            descricao="Tente novamente; se persistir, acione o suporte interno."
            onRetry={() => refetch()}
          />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-borda bg-painel">
          <EmptyState
            icon={SearchX}
            titulo="Nenhum lead para este filtro"
            descricao={
              data && data.length > 0
                ? "Ajuste ou limpe os filtros para ver a fila completa."
                : "Não há leads visíveis para o seu papel neste momento."
            }
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-texto-sec" role="status">
            {filtrados.length} {filtrados.length === 1 ? "lead" : "leads"} · destaques no
            topo, depois por score (prioridade recomendada)
          </p>
          <div className="space-y-3">
            {filtrados.map((item, i) => (
              <LeadPriorityCard
                key={item.lead_id}
                item={item}
                rank={i + 1}
                mostrarDonos={user.role === "admin"}
                usuarios={usuarios}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
