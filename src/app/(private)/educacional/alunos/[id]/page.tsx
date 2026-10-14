import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { RaioXAluno } from "@/features/educacional/RaioXAluno";

// Raio-X do aluno (spec, seção 6). A guarda de acesso fica no layout do módulo.
export default async function RaioXPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <RaioXAluno id={id} />
    </Suspense>
  );
}
