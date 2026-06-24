"use client";

import { useEffect, useState } from "react";
import { Loader2, LockKeyhole, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { CHAT_CONFIGURADO } from "./chatClient";
import { ChatConversa } from "./ChatConversa";
import { ConversaList } from "./ConversaList";
import { useConversas } from "./useConversas";
import { useSessaoChat } from "./useSessaoChat";

function Aviso({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Card>
      <EmptyState icon={LockKeyhole} titulo={titulo} descricao={descricao} />
    </Card>
  );
}

export function ChatView() {
  const sessao = useSessaoChat();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const habilitado = sessao === "ok" && CHAT_CONFIGURADO;
  const { query, criar, apagar } = useConversas(habilitado);
  const conversas = query.data ?? [];

  // Seleciona a conversa mais recente quando a lista chega e nada está aberto.
  useEffect(() => {
    if (!selecionadaId && conversas.length > 0) {
      setSelecionadaId(conversas[0].id);
    }
  }, [conversas, selecionadaId]);

  async function nova() {
    try {
      const c = await criar.mutateAsync();
      setSelecionadaId(c.id);
    } catch {
      /* erro de criação é tratado visualmente pelo estado da mutação */
    }
  }

  async function remover(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Apagar esta conversa?")) return;
    try {
      await apagar.mutateAsync(id);
      if (selecionadaId === id) setSelecionadaId(null);
    } catch {
      /* mantém a conversa na lista se a remoção falhar */
    }
  }

  // --- Guardas (T-08 + config) -------------------------------------------------
  if (!CHAT_CONFIGURADO) {
    return (
      <Aviso
        titulo="Chat não configurado"
        descricao="Defina NEXT_PUBLIC_CHAT_API_URL (ex.: http://localhost:8000) para conectar ao serviço de chat."
      />
    );
  }
  if (sessao === "verificando") {
    return (
      <div className="flex h-40 items-center justify-center text-texto-sec">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Verificando sessão" />
      </div>
    );
  }
  if (sessao === "sem") {
    return (
      <Aviso
        titulo="Entre para usar o chat"
        descricao="É necessário estar logado com uma sessão válida para conversar com a IA-guia."
      />
    );
  }

  const conversaSel = conversas.find((c) => c.id === selecionadaId) ?? null;

  return (
    <div className="space-y-3">
      {criar.isError && (
        <p
          role="alert"
          className="rounded-lg border border-rosa/30 bg-rosa/10 px-3 py-2 text-sm text-rosa"
        >
          Não foi possível criar a conversa
          {criar.error instanceof Error ? `: ${criar.error.message}` : "."}
        </p>
      )}

      <div className="flex gap-4">
        <ConversaList
          conversas={conversas}
          selecionadaId={selecionadaId}
          carregando={query.isLoading}
          erro={query.isError}
          criando={criar.isPending}
          apagandoId={apagar.isPending ? apagar.variables ?? null : null}
          onSelecionar={setSelecionadaId}
          onNova={nova}
          onApagar={remover}
        />

        <div className="min-w-0 flex-1">
          {conversaSel ? (
            <ChatConversa key={conversaSel.id} conversa={conversaSel} />
          ) : (
            <Card className="flex h-[calc(100vh-13rem)] min-h-[26rem] flex-col items-center justify-center gap-4">
              <EmptyState
                icon={MessageSquarePlus}
                titulo="Nenhuma conversa aberta"
                descricao="Crie uma nova conversa para começar a falar com a IA-guia do seu papel."
              />
              <Button onClick={nova} loading={criar.isPending}>
                Nova conversa
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
