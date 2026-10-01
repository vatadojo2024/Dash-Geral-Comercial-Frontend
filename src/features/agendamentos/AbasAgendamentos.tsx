"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Area } from "@/lib/api/contracts";
import { useSession } from "@/features/session/SessionProvider";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Sub-abas de Agendamentos (mesmo visual das sub-abas da Produtividade SDR),
// uma rota por aba. Cada aba pertence a uma área (GET /api/me → areas): a
// "Histórico" só aparece para quem tem `historico_agendamentos` (hoje, admin).
// Com uma aba só (closer e SDR), a barra nem aparece.
// ---------------------------------------------------------------------------

export const ABAS_AGENDAMENTOS: { href: string; label: string; area: Area }[] = [
  { href: "/agendamentos", label: "Primeira call", area: "agendamentos" },
  { href: "/agendamentos/historico", label: "Histórico", area: "historico_agendamentos" },
];

export function AbasAgendamentos() {
  const user = useSession();
  const pathname = usePathname();
  const abas = ABAS_AGENDAMENTOS.filter((a) => user.areas.includes(a.area));
  if (abas.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Abas de agendamentos"
      className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1 sm:w-fit"
    >
      {abas.map((a) => {
        const ativa = pathname === a.href;
        return (
          <Link
            key={a.href}
            role="tab"
            href={a.href}
            aria-selected={ativa}
            className={cn(
              "nav-link whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition-all",
              ativa ? "border-azul/50 bg-azul/15 text-texto" : "border-transparent text-texto",
            )}
          >
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
