"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Flame,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PhoneCall,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/contracts";
import { cn } from "@/lib/utils/cn";

type NavItem =
  | { tipo: "link"; href: string; label: string; icon: LucideIcon; roles: Role[] }
  | { tipo: "em_breve"; label: string; icon: LucideIcon; roles: Role[] };

const TODOS: Role[] = ["admin", "closer", "sdr"];

// Iteração 3 (Parte 7): Ações e Agenda entram ATIVAS; Visão Geral é a home
// do admin; Gestão é a única que permanece "Em breve" (decisão Vata 7.4).
const NAV_ITEMS: NavItem[] = [
  { tipo: "link", href: "/visao-geral", label: "Visão Geral", icon: Gauge, roles: ["admin"] },
  { tipo: "link", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: TODOS },
  { tipo: "link", href: "/leads", label: "Leads", icon: Users, roles: TODOS },
  { tipo: "link", href: "/acoes", label: "Ações", icon: ListChecks, roles: TODOS },
  { tipo: "link", href: "/agenda", label: "Agenda", icon: CalendarDays, roles: TODOS },
  { tipo: "link", href: "/chat", label: "Chat IA", icon: MessageSquare, roles: TODOS },
  { tipo: "link", href: "/salesops", label: "Sales Ops", icon: Wallet, roles: ["closer", "admin"] },
  { tipo: "link", href: "/sdr", label: "Produtividade SDR", icon: PhoneCall, roles: ["sdr", "admin"] },
  { tipo: "em_breve", label: "Gestão", icon: BarChart3, roles: TODOS },
];

function NavContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const itens = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rosa/90">
          <Flame className="h-5 w-5 text-noite" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-texto">Mapa de Calor</p>
          <p className="text-xs text-texto-sec">Mesa de decisão comercial</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Navegação principal">
        {itens.map((item) => {
          const Icon = item.icon;
          if (item.tipo === "em_breve") {
            return (
              <div
                key={item.label}
                aria-disabled="true"
                title="Disponível em breve"
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-texto-sec/60"
              >
                <Icon className="h-4 w-4 opacity-60" aria-hidden />
                <span className="opacity-60">{item.label}</span>
                <span className="ml-auto rounded-full border border-borda px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-texto-sec">
                  Em breve
                </span>
              </div>
            );
          }
          const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "bg-azul/20 text-azul-claro"
                  : "text-texto-sec hover:bg-painel-claro hover:text-texto",
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
      <aside className="hidden w-60 flex-col border-r border-borda/60 bg-painel md:flex">
        <NavContent role={role} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-borda bg-painel">
            <button
              onClick={onClose}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 rounded-md p-1 text-texto-sec hover:text-texto"
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
