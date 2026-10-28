import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlunosView } from "@/features/educacional/AlunosView";

// Aba Alunos (Fase 3, 3.3). A guarda de acesso fica no layout do módulo.
export default function AlunosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <AlunosView />
    </Suspense>
  );
}
