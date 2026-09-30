import { PageHeader } from "@/components/layout/PageHeader";
import { exigirArea } from "@/lib/auth/acesso";
import { DashboardView } from "@/features/dashboard/DashboardView";

export default async function DashboardPage() {
  await exigirArea("dashboard");
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
