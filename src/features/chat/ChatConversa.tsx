"use client";

import { Loader2 } from "lucide-react";
import { ErrorState } from "@/components/ui/States";
import { agenteDoPapel } from "./agentes";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { useMensagens } from "./useMensagens";
import type { Conversa } from "./tipos";

// Cabeçalho + lista + input de UMA conversa real. O agente vem do papel da
// própria conversa (definido na criação, pela sessão). Remontado por conversa
// (key no ChatView), então abrir outra recarrega as mensagens do zero.
export function ChatConversa({ conversa }: { conversa: Conversa }) {
  const agente = agenteDoPapel(conversa.papel);
  const { mensagens, carregando, erroCarregar, enviando, enviar, tentarNovamente } =
    useMensagens(conversa.id);

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-xl border border-borda bg-painel shadow-sm">
      <ChatHeader agente={agente} />

      {erroCarregar ? (
        <div className="flex-1 overflow-y-auto">
          <ErrorState
            titulo="Não foi possível carregar as mensagens"
            descricao="Verifique sua conexão e tente reabrir a conversa."
          />
        </div>
      ) : carregando ? (
        <div className="flex flex-1 items-center justify-center text-texto-sec">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando mensagens" />
        </div>
      ) : (
        <MessageList
          mensagens={mensagens}
          agente={agente}
          onTentarNovamente={tentarNovamente}
        />
      )}

      <ChatInput onEnviar={enviar} disabled={enviando} />
    </div>
  );
}
