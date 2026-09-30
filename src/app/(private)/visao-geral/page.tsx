import { PageHeader } from "@/components/layout/PageHeader";
import { VisaoGeralView } from "@/features/visaogeral/VisaoGeralView";
import { exigirArea } from "@/lib/auth/acesso";

// Área `visao_geral` (hoje só admin) — home pós-login dele.
export default async function VisaoGeralPage() {
  await exigirArea("visao_geral");

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
