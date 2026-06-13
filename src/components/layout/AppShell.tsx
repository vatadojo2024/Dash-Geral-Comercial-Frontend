"use client";

import { useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/api/contracts";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [navAberto, setNavAberto] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} mobileOpen={navAberto} onClose={() => setNavAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setNavAberto(true)} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
