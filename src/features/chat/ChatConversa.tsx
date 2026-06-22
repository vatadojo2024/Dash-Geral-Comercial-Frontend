"use client";

import type { Role } from "@/lib/api/contracts";
import { agenteDoPapel } from "./agentes";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { useConversa } from "./useConversa";

// Junta cabeçalho + lista + input em torno do estado da conversa (useConversa).
// É remontado por papel (key no ChatView), então cada agente começa do zero.
export function ChatConversa({ papel }: { papel: Role }) {
  const agente = agenteDoPapel(papel);
  const { mensagens, enviar, tentarNovamente } = useConversa(papel);

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-xl border border-borda bg-painel shadow-sm">
      <ChatHeader agente={agente} />
      <MessageList
        mensagens={mensagens}
        agente={agente}
        onTentarNovamente={tentarNovamente}
      />
      <ChatInput onEnviar={enviar} />
    </div>
  );
}
