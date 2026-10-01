"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
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
import type { Area } from "@/lib/api/contracts";
import { ROTA_DA_AREA } from "@/lib/auth/areas";
import { cn } from "@/lib/utils/cn";

// Cada item pertence a uma área; aparece se `user.areas` (GET /api/me) contém
// alguma delas. A Produtividade SDR também abre para quem só tem a Liderança
// (sub-aba dela) — nesse caso o link vai direto para a sub-aba.
type NavItem = { href: string; label: string; icon: LucideIcon; areas: Area[] };

// Visão Geral é a home do admin. Ações, Agenda e Gestão foram REMOVIDAS do menu
// (spec set/2026, Parte 2.1) — não existe backend para elas.
const NAV_ITEMS: NavItem[] = [
  { href: "/visao-geral", label: "Visão Geral", icon: Gauge, areas: ["visao_geral"] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, areas: ["dashboard"] },
  { href: "/leads", label: "Leads", icon: Users, areas: ["leads"] },
  // Primeiras calls (closer vê a própria agenda; admin e SDR, a de todos) e a
  // sub-aba Histórico (só admin) — quem só tiver o Histórico cai direto nela.
  {
    href: "/agendamentos",
    label: "Agendamentos",
    icon: CalendarClock,
    areas: ["agendamentos", "historico_agendamentos"],
  },
  { href: "/chat", label: "Chat IA", icon: MessageSquare, areas: ["chat"] },
  { href: "/salesops", label: "Sales Ops", icon: Wallet, areas: ["salesops"] },
  {
    href: "/produtividade-sdr",
    label: "Produtividade SDR",
    icon: PhoneCall,
    areas: ["produtividade_sdr", "lideranca_pre_venda"],
  },
  { href: "/retencao", label: "Retenção da audiência", icon: Activity, areas: ["retencao"] },
];

function NavContent({ areas, onNavigate }: { areas: readonly Area[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const itens = NAV_ITEMS.flatMap((i) => {
    const area = i.areas.find((a) => areas.includes(a));
    if (!area) return [];
    return [{ ...i, href: area === i.areas[0] ? i.href : ROTA_DA_AREA[area] }];
  });

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
  areas,
  mobileOpen,
  onClose,
}: {
  areas: readonly Area[];
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="ds-nav hidden w-60 flex-col border-r border-white/10 md:flex">
        <NavContent areas={areas} />
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
            <NavContent areas={areas} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
