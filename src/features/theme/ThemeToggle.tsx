"use client";

import { Droplet, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { proximoTema, TEMA_LABEL, TEMAS, type Tema } from "./tema";
import { cn } from "@/lib/utils/cn";

// Botão de TRÊS fases: azul (original) → escuro → claro → azul…
// Cada clique avança uma fase; o botão mostra o ícone + nome da fase atual e
// três pontos indicando a posição no ciclo.
const FASE: Record<Tema, { icon: LucideIcon; cor: string }> = {
  azul: { icon: Droplet, cor: "text-azul-claro" },
  dark: { icon: Moon, cor: "text-texto-sec" },
  light: { icon: Sun, cor: "text-laranja" },
};

export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternar } = useTheme();
  const { icon: Icon, cor } = FASE[tema];
  const proximo = proximoTema(tema);

  return (
    <button
      type="button"
      onClick={alternar}
      title={`Tema: ${TEMA_LABEL[tema]} — clique para ${TEMA_LABEL[proximo]}`}
      aria-label={`Tema atual: ${TEMA_LABEL[tema]}. Clique para mudar para ${TEMA_LABEL[proximo]}.`}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border border-borda bg-painel-claro px-2.5 transition-colors hover:border-azul/60",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4", cor)} aria-hidden />
      <span className="text-xs font-medium text-texto">{TEMA_LABEL[tema]}</span>
      <span className="flex items-center gap-1 pl-0.5" aria-hidden>
        {TEMAS.map((t) => (
          <span
            key={t}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              t === tema ? "bg-azul-claro" : "bg-borda",
            )}
          />
        ))}
      </span>
    </button>
  );
}
