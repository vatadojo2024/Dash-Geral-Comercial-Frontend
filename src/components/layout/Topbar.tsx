"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Search } from "lucide-react";
import type { SessionUser } from "@/lib/api/contracts";
import { ROLE_LABEL } from "@/lib/mock/users";
import { sair } from "@/lib/auth/clientSession";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Topbar({ user, onMenu }: { user: SessionUser; onMenu: () => void }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  function buscar(e: FormEvent) {
    e.preventDefault();
    const v = busca.trim();
    router.push(v ? `/leads?busca=${encodeURIComponent(v)}` : "/leads");
  }

  async function fazerLogout() {
    await sair();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-borda/60 bg-painel px-4">
      <button
        onClick={onMenu}
        aria-label="Abrir menu"
        className="rounded-md p-1.5 text-texto-sec hover:bg-painel-claro md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <form onSubmit={buscar} className="relative max-w-xs flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
          aria-hidden
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar lead..."
          aria-label="Buscar lead"
          className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
        />
      </form>

      <ThemeToggle className="ml-auto" />

      <div ref={dropdownRef}>
        <button
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-painel-claro"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-azul text-xs font-semibold text-white">
            {iniciais(user.nome)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-texto">{user.nome}</span>
            <span className="block text-xs text-texto-sec">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-texto-sec" aria-hidden />
        </button>

        {aberto && (
          <div className="absolute right-4 top-14 w-56 rounded-xl border border-borda bg-painel p-2 shadow-lg">
            <div className="border-b border-borda/60 px-3 py-2">
              <p className="text-sm font-medium text-texto">{user.nome}</p>
              <p className="text-xs text-texto-sec">{user.email}</p>
            </div>
            <button
              onClick={fazerLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-texto hover:bg-painel-claro"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
