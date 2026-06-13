import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeadsView } from "@/features/leads/LeadsView";

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        titulo="Fila de prioridade"
        descricao="Quem atacar agora: leads ativos ordenados por score, com motivo e próxima ação."
      />
      <Suspense>
        <LeadsView />
      </Suspense>
    </>
  );
}
