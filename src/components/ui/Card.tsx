import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// Info Card do design system: bg-white/5, borda white/10, raio 1rem, shadow-lg.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ds-card", className)} {...props} />;
}

// Cabeçalho no padrão do modal do DS (pt-6 pr-6 pb-0 pl-6): título h4
// font-medium e subtítulo "Regular S" (text-xs, 70%). Sem borda inferior.
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
      <div>
        <h4 className="font-medium text-texto">{title}</h4>
        {subtitle && <p className="mt-0.5 text-xs opacity-70">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Área de conteúdo (pt-6 pr-6 pb-6 pl-6 no DS).
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
