"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Paperclip, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Barra de input (T-09): caixa de texto + enviar + placeholder de anexo (NÃO
// funcional). `disabled` trava o envio enquanto a anterior está em andamento.
export function ChatInput({
  onEnviar,
  disabled = false,
}: {
  onEnviar: (texto: string) => void;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState("");

  function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || disabled) return;
    onEnviar(conteudo);
    setTexto("");
  }

  function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    enviar();
  }

  // Enter envia; Shift+Enter quebra linha.
  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <form onSubmit={aoSubmeter} className="border-t border-borda/60 px-3 py-3">
      <div className="flex items-end gap-2">
        {/* Placeholder visual de anexo — não funcional nesta etapa. */}
        <button
          type="button"
          disabled
          aria-label="Anexar arquivo (em breve)"
          title="Anexos chegam em uma etapa futura"
          className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg text-texto-sec/50"
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </button>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          rows={1}
          placeholder="Escreva sua mensagem…"
          aria-label="Mensagem"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-borda bg-painel-claro px-3 py-2 text-sm text-texto outline-none placeholder:text-texto-sec/70 focus:border-azul"
        />

        <button
          type="submit"
          disabled={!texto.trim() || disabled}
          aria-label="Enviar"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
            texto.trim() && !disabled
              ? "bg-azul text-white hover:bg-azul-claro"
              : "cursor-not-allowed bg-borda/50 text-texto-sec",
          )}
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
