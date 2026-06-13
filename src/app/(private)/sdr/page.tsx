import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SdrView } from "@/features/sdr/SdrView";
import { getServerSession } from "@/lib/auth/session";

export default async function SdrPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role === "closer") redirect("/dashboard");

  return (
    <>
      <PageHeader
        titulo="Produtividade SDR"
        descricao="Calls, qualificados, produtos e metas escalonadas — espelho do Dashboard SDR."
      />
      <SdrView />
    </>
  );
}
