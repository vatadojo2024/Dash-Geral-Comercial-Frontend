"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { agenteDoPapel } from "./agentes";
import type { Conversa } from "./tipos";

// Título de exibição: usa o título do serviço; sem ele, cai no nome do agente do
// papel (tolerância — titulo pode vir nulo até o serviço derivá-lo).
function tituloConversa(c: Conversa): string {
  return c.titulo ?? agenteDoPapel(c.papel).nome_exibicao;
}

// Barra lateral (T-03/T-06): lista as conversas (recente primeiro), botão "nova"
// e apagar por item.
export function ConversaList({
  conversas,
  selecionadaId,
  carregando,
  erro,
  criando,
  apagandoId,
  onSelecionar,
  onNova,
  onApagar,
}: {
  conversas: Conversa[];
  selecionadaId: string | null;
  carregando: boolean;
  erro: boolean;
  criando: boolean;
  apagandoId: string | null;
  onSelecionar: (id: string) => void;
  onNova: () => void;
  onApagar: (id: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-painel">
      <div className="flex items-center justify-between gap-2 border-b border-borda/60 px-3 py-2.5">
        <p className="text-sm font-semibold text-texto">Conversas</p>
        <button
          type="button"
          onClick={onNova}
          disabled={criando}
          className="inline-flex items-center gap-1 rounded-lg bg-azul px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-azul-claro disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {carregando ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))
        ) : erro ? (
          <p className="px-2 py-4 text-center text-xs text-texto-sec">
            Não foi possível carregar as conversas.
          </p>
        ) : conversas.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-texto-sec">
            Nenhuma conversa ainda. Crie uma para começar.
          </p>
        ) : (
          conversas.map((c) => {
            const ativa = c.id === selecionadaId;
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg border transition-colors",
                  ativa
                    ? "border-azul/40 bg-azul/15"
                    : "border-transparent hover:bg-painel-claro",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelecionar(c.id)}
                  aria-current={ativa ? "true" : undefined}
                  className="min-w-0 flex-1 px-2.5 py-2 text-left"
                >
                  <p className="truncate text-sm font-medium text-texto">
                    {tituloConversa(c)}
                  </p>
                  {c.resumo && (
                    <p className="truncate text-xs text-texto-sec">{c.resumo}</p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onApagar(c.id)}
                  disabled={apagandoId === c.id}
                  aria-label="Apagar conversa"
                  className="mr-1 rounded-md p-1.5 text-texto-sec/60 opacity-0 transition-opacity hover:bg-rosa/15 hover:text-rosa focus:opacity-100 group-hover:opacity-100 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
