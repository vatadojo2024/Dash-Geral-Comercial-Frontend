import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

const VARIANTES = {
  primary: "bg-azul text-white hover:bg-azul-claro",
  secondary: "bg-borda/50 text-texto hover:bg-borda/80",
  outline: "border border-borda bg-transparent text-texto hover:bg-painel-claro",
  ghost: "text-texto-sec hover:bg-painel-claro hover:text-texto",
};

const TAMANHOS = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTES[variant],
        TAMANHOS[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
