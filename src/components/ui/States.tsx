import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  titulo,
  descricao,
  icon: Icon = Inbox,
}: {
  titulo: string;
  descricao?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-painel-claro">
        <Icon className="h-6 w-6 text-texto-sec" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-texto-sec">{descricao}</p>}
    </div>
  );
}

export function ErrorState({
  titulo,
  descricao,
  onRetry,
}: {
  titulo: string;
  descricao?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rosa/15">
        <AlertTriangle className="h-6 w-6 text-rosa" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-texto-sec">{descricao}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
