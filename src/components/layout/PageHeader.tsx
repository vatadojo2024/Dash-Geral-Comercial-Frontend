import type { ReactNode } from "react";

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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-texto-sec">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-3">{acoes}</div>}
    </div>
  );
}
