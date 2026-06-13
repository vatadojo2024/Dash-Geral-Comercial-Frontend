import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AcoesView } from "@/features/acoes/AcoesView";

export default function AcoesPage() {
  return (
    <>
      <PageHeader
        titulo="Ações"
        descricao="Tudo o que o motor recomenda fazer agora, priorizado por score."
      />
      <Suspense>
        <AcoesView />
      </Suspense>
    </>
  );
}
