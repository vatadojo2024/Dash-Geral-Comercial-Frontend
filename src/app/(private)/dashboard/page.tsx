import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardView } from "@/features/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Visão geral do funil: onde os leads estão concentrados e o que merece atenção."
      />
      <DashboardView />
    </>
  );
}
