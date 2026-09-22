import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

// Estados vazios/erro no padrão do DS: ícone em círculo (.icon-circle) com o
// ícone em text-lg, título "Bold M" e descrição "Regular S".
export function EmptyState({
  titulo,
  descricao,
  icon: Icon = Inbox,
  // "positivo": estado vazio que é boa notícia (ex.: "todos já agendaram").
  tom = "neutro",
}: {
  titulo: string;
  descricao?: string;
  icon?: LucideIcon;
  tom?: "neutro" | "positivo";
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="status">
      <span className={cn("icon-circle", tom === "positivo" && "border-sucesso-forte/30 bg-sucesso-forte/20")}>
        <Icon className={cn("h-5 w-5", tom === "positivo" ? "text-sucesso" : "text-violeta")} aria-hidden />
      </span>
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {descricao && <p className="max-w-sm text-xs opacity-70">{descricao}</p>}
    </div>
  );
}

export function ErrorState({
  titulo,
  descricao,
  onRetry,
  retryLabel = "Tentar novamente",
}: {
  titulo: string;
  descricao?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
      <span className="icon-circle border-erro-forte/30 bg-erro-forte/20">
        <AlertTriangle className="h-5 w-5 text-erro" aria-hidden />
      </span>
      <p className="text-sm font-medium text-texto">{titulo}</p>
      {descricao && <p className="max-w-sm text-xs opacity-70">{descricao}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
