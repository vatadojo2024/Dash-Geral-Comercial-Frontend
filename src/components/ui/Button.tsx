import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

// Botões do design system (.glass-button: blur 8px, 0.3s ease, sobe 1px no hover;
// desabilitado = opacity-40; sem estilos próprios de foco/ativo na referência):
//   primary   → bg-primary-500/30, borda primary-500/50, hover bg-primary-500/40
//   secondary → bg-white/5, borda white/20, hover bg-white/10
//   outline   → mesma família do secondary
//   ghost     → só texto; Icon Button do DS (fundo white/10 no hover)
const VARIANTES = {
  primary: "glass-button border border-azul/50 bg-azul/30 text-texto hover:bg-azul/40",
  secondary: "glass-button border border-white/20 bg-white/5 text-texto hover:bg-white/10",
  outline: "glass-button border border-white/20 bg-white/5 text-texto hover:bg-white/10",
  ghost: "text-texto opacity-70 transition-colors hover:bg-white/10 hover:opacity-100",
};

// md = px-6 py-3 (referência); sm = versão compacta para barras e tabelas.
const TAMANHOS = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
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
