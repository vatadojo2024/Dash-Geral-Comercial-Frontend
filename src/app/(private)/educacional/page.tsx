import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EducacionalView } from "@/features/educacional/EducacionalView";

// Módulo Educacional — Cockpit + Tabela tática (spec specs/educacional_frontend.md).
// A guarda de acesso fica no layout do módulo.
export default function EducacionalPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <EducacionalView />
    </Suspense>
  );
}
