"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Search } from "lucide-react";
import type { SessionUser } from "@/lib/api/contracts";
import { ROLE_LABEL } from "@/lib/mock/users";
import { sair } from "@/lib/auth/clientSession";

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
    <header className="ds-nav sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 px-6">
      <button
        onClick={onMenu}
        aria-label="Abrir menu"
        className="icon-button md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <form onSubmit={buscar} className="relative mr-auto max-w-xs flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
          aria-hidden
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar lead..."
          aria-label="Buscar lead"
          className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto transition-colors placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
        />
      </form>


      <div ref={dropdownRef}>
        <button
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="nav-link flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/10"
        >
          <span className="icon-circle h-8 w-8 text-xs font-semibold text-violeta">
            {iniciais(user.nome)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-texto">{user.nome}</span>
            <span className="block text-xs text-texto-sec">{ROLE_LABEL[user.role]}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-texto-sec" aria-hidden />
        </button>

        {aberto && (
          <div className="modal-surface modal-border absolute right-6 top-16 w-56 rounded-2xl p-2 shadow-layered">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-texto">{user.nome}</p>
              <p className="text-xs opacity-70">{user.email}</p>
            </div>
            <div className="card-divider my-1 w-full" aria-hidden />
            <button
              onClick={fazerLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-texto transition-colors hover:bg-white/10"
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
