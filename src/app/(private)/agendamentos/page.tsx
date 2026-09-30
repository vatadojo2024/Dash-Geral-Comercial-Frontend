import { Suspense } from "react";
import { AgendamentosView } from "@/features/agendamentos/AgendamentosView";
import { Skeleton } from "@/components/ui/Skeleton";
import { exigirArea } from "@/lib/auth/acesso";

// Agendamentos — Primeira Call: fila + calendário das primeiras calls do closer
// (spec specs/primeiro-agendamento/). Público: closer (vê só a própria agenda),
// admin e SDR (veem a agenda de todos os closers). Área `agendamentos`.
export default async function AgendamentosPage() {
  await exigirArea("agendamentos");

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <AgendamentosView />
    </Suspense>
  );
}
