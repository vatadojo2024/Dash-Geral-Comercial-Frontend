import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SalesOpsView } from "@/features/salesops/SalesOpsView";
import { getServerSession } from "@/lib/auth/session";

export default async function SalesOpsPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role === "sdr") redirect("/dashboard");

  return (
    <>
      <PageHeader
        titulo="Sales Ops"
        descricao="Faturamento, metas, cash collected e comissão — com projeções da carteira."
      />
      <SalesOpsView />
    </>
  );
}
