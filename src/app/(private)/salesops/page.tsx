import { PageHeader } from "@/components/layout/PageHeader";
import { SalesOpsView } from "@/features/salesops/SalesOpsView";
import { exigirArea } from "@/lib/auth/acesso";

export default async function SalesOpsPage() {
  await exigirArea("salesops");

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
