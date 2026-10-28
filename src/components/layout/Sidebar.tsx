"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  FileText,
  Flame,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Area, Modulo } from "@/lib/api/contracts";
import { moduloAtivo, ROTA_DA_AREA } from "@/lib/auth/areas";
import { cn } from "@/lib/utils/cn";

// Cada item pertence a uma área; aparece se `user.areas` (GET /api/me) contém
// alguma delas. A Produtividade SDR também abre para quem só tem a Liderança
// (sub-aba dela) — nesse caso o link vai direto para a sub-aba.
// `modulo`: o menu mostra só os itens do módulo em que o usuário está.
type NavItem = { href: string; label: string; icon: LucideIcon; areas: Area[]; modulo?: Modulo };

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
  { href: "/educacional", label: "Saúde da Jornada", icon: GraduationCap, areas: ["educacional"], modulo: "educacional" },
  { href: "/educacional/alunos", label: "Alunos", icon: Users, areas: ["educacional"], modulo: "educacional" },
  { href: "/educacional/analises", label: "Análise de aula", icon: FileText, areas: ["educacional"], modulo: "educacional" },
  {
    href: "/educacional/configuracoes",
    label: "Configurações",
    icon: Settings,
    areas: ["educacional"],
    modulo: "educacional",
  },
];

// Subtítulo da marca: neutro no módulo Educacional (qualquer usuário, admin
// incluso); na área comercial, o de sempre.
const SUBTITULO: Record<Modulo, string> = {
  comercial: "Mesa de decisão comercial",
  educacional: "Saúde da Jornada",
};

function NavContent({
  areas,
  modulos,
  onNavigate,
}: {
  areas: readonly Area[];
  modulos: readonly Modulo[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const modulo = moduloAtivo({ modulos: [...modulos] }, pathname);
  const itens = NAV_ITEMS.flatMap((i) => {
    if ((i.modulo ?? "comercial") !== modulo) return [];
    const area = i.areas.find((a) => areas.includes(a));
    if (!area) return [];
    return [{ ...i, href: area === i.areas[0] ? i.href : ROTA_DA_AREA[area] }];
  });

  // Item ativo: o de caminho mais específico que casa com a URL (em
  // /educacional/configuracoes, só "Configurações" acende, não "Saúde da Jornada").
  const casa = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const hrefAtivo = itens
    .filter((i) => casa(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="icon-circle shadow-lg">
          <Flame className="h-5 w-5 text-violeta" aria-hidden />
        </span>
        <div>
          <p className="font-jakarta text-base font-semibold leading-tight text-texto">Mapa de Calor</p>
          <p className="text-xs opacity-70">{SUBTITULO[modulo]}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Navegação principal">
        {itens.map((item) => {
          const Icon = item.icon;
          const ativo = item.href === hrefAtivo;
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
  modulos,
  mobileOpen,
  onClose,
}: {
  areas: readonly Area[];
  modulos: readonly Modulo[];
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <aside className="ds-nav hidden w-60 flex-col border-r border-white/10 md:flex">
        <NavContent areas={areas} modulos={modulos} />
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
            <NavContent areas={areas} modulos={modulos} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
