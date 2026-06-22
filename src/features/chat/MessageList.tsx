"use client";

import { useEffect, useMemo, useRef } from "react";
import { Bot } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { mensagensValidas, ordenarCronologico } from "./conversa";
import { MessageBubble } from "./MessageBubble";
import type { Agente } from "./agentes";
import type { Mensagem } from "./tipos";

// Estado vazio (RF-05/T-08): identidade do agente + convite curto.
function EstadoVazio({ agente }: { agente: Agente }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-azul/15 text-azul-claro">
        <Bot className="h-7 w-7" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-texto">{agente.nome_exibicao}</p>
        <p className="mt-0.5 text-xs text-texto-sec">{agente.subtitulo}</p>
      </div>
      <p className="max-w-sm text-sm text-texto-sec">Como posso te ajudar?</p>
    </div>
  );
}

export function MessageList({
  mensagens,
  agente,
  onTentarNovamente,
}: {
  mensagens: Mensagem[];
  agente: Agente;
  onTentarNovamente: (idIa: string) => void;
}) {
  // Tolerância item-a-item (RF-08) + ordem cronológica (RF-04).
  const visiveis = useMemo(
    () => ordenarCronologico(mensagensValidas(mensagens)),
    [mensagens],
  );

  // Auto-scroll para a mensagem mais recente (RF-04).
  const fimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visiveis]);

  if (visiveis.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EstadoVazio agente={agente} />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-1 py-4">
      {visiveis.map((m) => (
        // Cada bolha isolada: se a renderização de uma estourar, só ela cai num
        // fallback — a lista inteira continua de pé (mesma filosofia do RF-08).
        <ErrorBoundary key={m.id} rotulo={`bolha ${m.id}`}>
          <MessageBubble
            mensagem={m}
            agente={agente}
            onTentarNovamente={onTentarNovamente}
          />
        </ErrorBoundary>
      ))}
      <div ref={fimRef} />
    </div>
  );
}
