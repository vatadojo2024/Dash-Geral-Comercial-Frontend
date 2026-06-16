"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Headset,
  Lightbulb,
  UserX,
} from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { fetchLeads } from "@/lib/data/dataClient";
import { filtrarPorEscopo } from "@/lib/data/escopo";
import { useUsuariosMap } from "@/lib/data/useUsuarios";
import { nomeDoUsuario } from "@/lib/mock/users";
import { useSession } from "@/features/session/SessionProvider";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { EtapaBadge, ScoreBadge, TemperatureBadge } from "@/components/domain/Badges";
import { agruparAgenda, horaDaCall } from "./agenda";

// Badge "quem faz a call" (item 2): nas visões de admin e SDR, mostra o closer
// responsável pelo lead; sem closer atribuído → estado de atenção.
function CloserDaCall({
  closerId,
  usuarios,
}: {
  closerId: string | null;
  usuarios?: ReadonlyMap<string, string>;
}) {
  if (!closerId) {
    return (
      <span
        title="Lead com call agendada mas sem closer atribuído — definir responsável"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-laranja/40 bg-laranja/15 px-1.5 py-px text-[10px] font-medium text-laranja"
      >
        <UserX className="h-3 w-3" aria-hidden />
        Sem closer definido
      </span>
    );
  }
  return (
    <span
      title={`Closer responsável pela call: ${nomeDoUsuario(closerId, usuarios)}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-borda bg-painel-claro px-1.5 py-px text-[10px] font-medium text-texto-sec"
    >
      <Headset className="h-3 w-3" aria-hidden />
      Call com: {nomeDoUsuario(closerId, usuarios)}
    </span>
  );
}

function ItemCall({
  lead,
  mostrarCloser,
  usuarios,
}: {
  lead: LeadListItem;
  mostrarCloser: boolean;
  usuarios?: ReadonlyMap<string, string>;
}) {
  const temAlerta = lead.alertas.length > 0;
  return (
    <Link
      href={`/leads/${lead.lead_id}`}
      className="flex items-center gap-3 rounded-lg border border-borda/60 bg-noite/40 px-3 py-2.5 transition-colors hover:border-azul/60"
    >
      <span className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-borda bg-painel-claro py-1.5">
        <span className="text-sm font-bold tabular-nums text-texto">
          {horaDaCall(lead.next_call_at!)}
        </span>
        <span className="text-[10px] text-texto-sec">{lead.next_call_numero}ª call</span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-texto">
          <span className="truncate">{lead.nome_exibicao}</span>
          {temAlerta && (
            <span
              title={`Lead com alerta: ${lead.alertas.join("; ")}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rosa/30 bg-rosa/15 px-1.5 py-px text-[10px] font-medium text-rosa"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              alerta
            </span>
          )}
        </p>
        <p className="mt-0.5 flex items-start gap-1.5 text-xs text-texto-sec">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-laranja" aria-hidden />
          <span className="truncate">{lead.proxima_acao}</span>
        </p>
        <span className="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
          <TemperatureBadge temperatura={lead.temperatura} size="sm" />
          <EtapaBadge etapa={lead.etapa_atual} size="sm" />
          {mostrarCloser && <CloserDaCall closerId={lead.closer_id} usuarios={usuarios} />}
        </span>
      </div>

      <ScoreBadge final={lead.score_final} />
      <ChevronRight className="h-4 w-4 shrink-0 text-texto-sec/50" aria-hidden />
    </Link>
  );
}

export function AgendaView() {
  const user = useSession();
  const usuarios = useUsuariosMap();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });

  const dias = useMemo(() => {
    if (!data) return [];
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    // Escopo defensivo (mesmo helper da Fila/Ações): nunca mostrar call de lead
    // fora do papel, mesmo que a fonte mude.
    return agruparAgenda(filtrarPorEscopo(data, user), hojeISO);
  }, [data, user]);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Carregando agenda">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar a agenda"
          descricao="Tente novamente; se persistir, acione o suporte interno."
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  if (dias.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarDays}
          titulo="Nenhuma call agendada"
          descricao="Quando seus leads tiverem calls marcadas, elas aparecem aqui agrupadas por dia."
        />
      </Card>
    );
  }

  const total = dias.reduce((a, d) => a + d.leads.length, 0);
  // Closer vê só as próprias calls — não precisa do "quem faz". Admin e SDR sim.
  const mostrarCloser = user.role !== "closer";

  return (
    <div className="space-y-4">
      <p className="text-xs text-texto-sec" role="status">
        {total} {total === 1 ? "call agendada" : "calls agendadas"} nos próximos dias ·
        derivadas dos leads do seu escopo
      </p>

      {dias.map((d) => (
        <Card key={d.dia}>
          <CardHeader
            title={d.label}
            subtitle={`${d.leads.length} ${d.leads.length === 1 ? "call" : "calls"}`}
          />
          <CardContent className="space-y-2">
            {d.leads.map((l) => (
              <ItemCall key={l.lead_id} lead={l} mostrarCloser={mostrarCloser} usuarios={usuarios} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
