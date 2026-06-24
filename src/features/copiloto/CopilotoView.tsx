"use client";

import { useState } from "react";
import { Bot, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ChatView } from "@/features/chat/ChatView";
import { PlaybookView } from "@/features/playbook/PlaybookView";

// Seletor da área do copiloto (T-02 / RF-01): alterna Copiloto (chat) ↔ Playbook
// sem recarregar a página. AMBOS ficam montados (toggle por `hidden`): o estado e
// o polling em andamento de cada aba sobrevivem à troca.
type Aba = "copiloto" | "playbook";

const ABAS: { id: Aba; label: string; icon: typeof Bot }[] = [
  { id: "copiloto", label: "Copiloto", icon: Bot },
  { id: "playbook", label: "Playbook", icon: FileText },
];

export function CopilotoView() {
  const [aba, setAba] = useState<Aba>("copiloto");

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Alternar entre Copiloto e Playbook"
        className="inline-flex items-center gap-1 rounded-lg border border-borda bg-painel p-0.5"
      >
        {ABAS.map(({ id, label, icon: Icon }) => {
          const ativa = aba === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ativa
                  ? "bg-azul/15 text-azul-claro"
                  : "text-texto-sec hover:bg-painel-claro hover:text-texto",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Ambos montados; só o ativo é exibido (estado/polling preservados). */}
      <div className={cn(aba !== "copiloto" && "hidden")}>
        <ChatView />
      </div>
      <div className={cn(aba !== "playbook" && "hidden")}>
        <PlaybookView />
      </div>
    </div>
  );
}
