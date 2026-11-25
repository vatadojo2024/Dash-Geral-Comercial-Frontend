import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SemAcessoState } from "@/components/ui/States";
import { EventosAoVivoView } from "@/features/eventos/EventosAoVivoView";
import { getServerSession } from "@/lib/auth/session";
import { podeVerEventosAoVivo } from "@/lib/eventos/comparativo";

// Eventos ao Vivo: os webinars WG comparados evento a evento. SÓ ADMIN, por
// PAPEL (não há área na matriz: o backend checa o papel no código da rota).
// Fora do admin, a página mostra "Sem acesso" em vez de redirecionar.
export default async function EventosAoVivoPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader
        titulo="Eventos ao Vivo"
        descricao="O funil de cada webinar WG lado a lado: presença, mão levantada e agendamento, evento a evento."
      />
      {podeVerEventosAoVivo(user.role) ? (
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <EventosAoVivoView />
        </Suspense>
      ) : (
        <Card>
          <SemAcessoState />
        </Card>
      )}
    </>
  );
}
