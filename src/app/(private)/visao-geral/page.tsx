import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { VisaoGeralView } from "@/features/visaogeral/VisaoGeralView";
import { getServerSession } from "@/lib/auth/session";

// Rota exclusiva do admin (Parte 7, decisão 2) — home pós-login do papel.
export default async function VisaoGeralPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <>
      <PageHeader
        titulo="Visão Geral"
        descricao="A operação inteira num painel: funil, faturamento dos closers e metas da pré-venda."
      />
      <VisaoGeralView />
    </>
  );
}
