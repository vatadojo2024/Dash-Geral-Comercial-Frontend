import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { CalendarioView } from "@/features/educacional/CalendarioView";

// Calendário do Educacional (Entrega 2, M3). A guarda de acesso fica no layout do módulo.
export default function CalendarioPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <CalendarioView />
    </Suspense>
  );
}
