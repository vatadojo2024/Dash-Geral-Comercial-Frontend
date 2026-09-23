"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Flame,
  Gauge,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/contracts";
import { cn } from "@/lib/utils/cn";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };

const TODOS: Role[] = ["admin", "closer", "sdr"];

// Visão Geral é a home do admin. Ações, Agenda e Gestão foram REMOVIDAS do menu
// (spec set/2026, Parte 2.1) — não existe backend para elas.
const NAV_ITEMS: NavItem[] = [
  { href: "/visao-geral", label: "Visão Geral", icon: Gauge, roles: ["admin"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: TODOS },
  { href: "/leads", label: "Leads", icon: Users, roles: TODOS },
  { href: "/chat", label: "Chat IA", icon: MessageSquare, roles: TODOS },
  { href: "/salesops", label: "Sales Ops", icon: Wallet, roles: ["closer", "admin"] },
  { href: "/produtividade-sdr", label: "Produtividade SDR", icon: PhoneCall, roles: ["sdr", "admin"] },
  { href: "/retencao", label: "Retenção da audiência", icon: Activity, roles: ["sdr", "admin"] },
];

function NavContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const itens = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="icon-circle shadow-lg">
          <Flame className="h-5 w-5 text-violeta" aria-hidden />
        </span>
        <div>
          <p className="font-jakarta text-base font-semibold leading-tight text-texto">Mapa de Calor</p>
          <p className="text-xs opacity-70">Mesa de decisão comercial</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Navegação principal">
        {itens.map((item) => {
          const Icon = item.icon;
          const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "nav-link flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                ativo
                  ? "border-azul/50 bg-azul/15 text-texto"
                  : "border-transparent text-texto hover:bg-white/[0.08]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({
  role,
  mobileOpen,
  onClose,
}: {
  role: Role;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="ds-nav hidden w-60 flex-col border-r border-white/10 md:flex">
        <NavContent role={role} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <aside className="ds-nav absolute inset-y-0 left-0 flex w-64 flex-col border-r border-white/10">
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="icon-button absolute right-3 top-3"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <NavContent role={role} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
