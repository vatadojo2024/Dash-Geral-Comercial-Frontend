import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AgendamentosView } from "@/features/agendamentos/AgendamentosView";
import { Skeleton } from "@/components/ui/Skeleton";
import { getServerSession } from "@/lib/auth/session";

// Agendamentos — Primeira Call: fila + calendário das primeiras calls do closer
// (spec specs/primeiro-agendamento/). Público: closer (vê só a própria agenda),
// admin e SDR (veem a agenda de todos os closers).
export default async function AgendamentosPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <AgendamentosView />
    </Suspense>
  );
}
