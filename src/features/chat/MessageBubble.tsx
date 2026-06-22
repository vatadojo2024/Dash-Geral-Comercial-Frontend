"use client";

import { AlertTriangle, Bot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Agente } from "./agentes";
import type { Mensagem } from "./tipos";

// Indicador "pensando…" enquanto a mensagem da IA está `pendente` (RF-03).
function Pensando() {
  return (
    <span className="flex items-center gap-1.5 text-texto-sec" aria-label="Pensando…">
      <span className="text-sm">pensando</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-texto-sec/70"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

export function MessageBubble({
  mensagem,
  agente,
  onTentarNovamente,
}: {
  mensagem: Mensagem;
  agente: Agente;
  onTentarNovamente: (idIa: string) => void;
}) {
  const ehUsuario = mensagem.autor === "usuario";

  return (
    <div className={cn("flex gap-2.5", ehUsuario ? "justify-end" : "justify-start")}>
      {!ehUsuario && (
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul/15 text-azul-claro"
          aria-hidden
        >
          <Bot className="h-4 w-4" />
        </span>
      )}

      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm",
          ehUsuario
            ? "rounded-br-sm bg-azul text-white"
            : "rounded-bl-sm border border-borda bg-painel-claro text-texto",
        )}
      >
        {mensagem.status === "pendente" ? (
          <Pensando />
        ) : mensagem.status === "erro" ? (
          <div className="flex flex-col gap-2" role="alert">
            <span className="flex items-center gap-2 text-sm text-rosa">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Não foi possível gerar a resposta.
            </span>
            <button
              type="button"
              onClick={() => onTentarNovamente(mensagem.id)}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-borda px-2.5 py-1 text-xs font-medium text-texto-sec transition-colors hover:bg-painel hover:text-texto"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Tentar novamente
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
        )}

        {!ehUsuario && mensagem.status !== "pendente" && mensagem.status !== "erro" && (
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-texto-sec/60">
            {agente.nome_exibicao}
          </span>
        )}
      </div>
    </div>
  );
}
