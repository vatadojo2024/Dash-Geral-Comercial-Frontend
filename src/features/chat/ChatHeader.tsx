"use client";

import { Bot } from "lucide-react";
import type { Agente } from "./agentes";

// Cabeçalho com a identidade do agente conforme o papel do usuário (RF-02/T-06).
// O `agente` é derivado do papel obtido em useSession — mesma fonte do painel.
export function ChatHeader({ agente }: { agente: Agente }) {
  return (
    <div className="flex items-center gap-3 border-b border-borda/60 px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-azul/15 text-azul-claro">
        <Bot className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-texto">{agente.nome_exibicao}</p>
        <p className="text-xs text-texto-sec">{agente.subtitulo}</p>
      </div>
    </div>
  );
}
