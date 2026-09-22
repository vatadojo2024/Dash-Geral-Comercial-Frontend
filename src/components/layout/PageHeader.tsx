import type { ReactNode } from "react";

// Cabeçalho de página no padrão do DS: Heading 1 (text-2xl, semibold, Plus
// Jakarta Sans, tracking-tight) e subtítulo "Regular M" (text-sm, 80%).
export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-jakarta text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm opacity-80">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-3">{acoes}</div>}
    </div>
  );
}
