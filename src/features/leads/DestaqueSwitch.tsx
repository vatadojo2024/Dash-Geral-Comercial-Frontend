"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { LeadDetail, LeadListItem } from "@/lib/api/contracts";
import { patchDestaque } from "@/lib/data/dataClient";
import { useSession } from "@/features/session/SessionProvider";
import { EstrelaDestaque } from "@/components/domain/Badges";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Switch "Destaque" do detalhe do lead — SOMENTE admin (quem renderiza decide;
// ver LeadDetailView). Destaque é exibição/priorização: não mexe em score.
//
// Update OTIMISTA: o cache do detalhe e o da fila mudam na hora (a estrela
// acende/apaga imediatamente) e o PATCH segue em paralelo. Se falhar, os dois
// caches voltam ao estado anterior e um toast explica o motivo (inclusive o 403
// de não-admin, que não deveria acontecer com a UI escondendo o switch).
// A ORDEM da fila não é mexida aqui: no onSettled invalidamos ["leads"] e o
// servidor devolve a lista já ordenada (destaque desc, score desc).
// ---------------------------------------------------------------------------

type Contexto = {
  detalheAnterior?: LeadDetail;
  listaAnterior?: LeadListItem[];
};

export function DestaqueSwitch({ lead }: { lead: LeadDetail }) {
  const user = useSession();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const chaveDetalhe = ["lead", user.id, lead.lead_id];
  const chaveLista = ["leads", user.id];

  const { mutate, isPending } = useMutation({
    mutationFn: (destaque: boolean) => patchDestaque(lead.lead_id, destaque),

    onMutate: async (destaque): Promise<Contexto> => {
      setErro(null);
      // Cancela refetches em voo para que uma resposta antiga não sobrescreva
      // o valor otimista logo depois de o usuário clicar.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: chaveDetalhe }),
        queryClient.cancelQueries({ queryKey: chaveLista }),
      ]);

      const detalheAnterior = queryClient.getQueryData<LeadDetail>(chaveDetalhe);
      const listaAnterior = queryClient.getQueryData<LeadListItem[]>(chaveLista);

      queryClient.setQueryData<LeadDetail>(chaveDetalhe, (atual) =>
        atual ? { ...atual, destaque } : atual,
      );
      queryClient.setQueryData<LeadListItem[]>(chaveLista, (atual) =>
        atual?.map((l) => (l.lead_id === lead.lead_id ? { ...l, destaque } : l)),
      );

      return { detalheAnterior, listaAnterior };
    },

    onError: (e, _destaque, ctx) => {
      // Reverte os DOIS caches ao snapshot e explica o motivo.
      if (ctx?.detalheAnterior) {
        queryClient.setQueryData(chaveDetalhe, ctx.detalheAnterior);
      }
      if (ctx?.listaAnterior) {
        queryClient.setQueryData(chaveLista, ctx.listaAnterior);
      }
      setErro(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível atualizar o destaque. Tente novamente.",
      );
    },

    onSuccess: (confirmado) => {
      // Fecha o ciclo com o que o servidor de fato gravou (inclui a auditoria).
      queryClient.setQueryData<LeadDetail>(chaveDetalhe, (atual) =>
        atual
          ? {
              ...atual,
              destaque: confirmado.destaque,
              destaque_por: confirmado.destaque_por ?? null,
              destaque_em: confirmado.destaque_em ?? null,
            }
          : atual,
      );
    },

    onSettled: () => {
      // A fila reordena pelo servidor (destaque no topo), nunca no front.
      queryClient.invalidateQueries({ queryKey: chaveLista });
    },
  });

  const ligado = lead.destaque;

  return (
    <>
      <div className="flex items-center gap-2.5">
        <span
          id="rotulo-destaque"
          className="flex items-center gap-1.5 text-xs font-medium text-texto-sec"
        >
          <EstrelaDestaque size="sm" ligada={ligado} />
          Destaque
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          aria-labelledby="rotulo-destaque"
          disabled={isPending}
          onClick={() => mutate(!ligado)}
          title={
            ligado
              ? "Remover o destaque deste lead"
              : "Destacar este lead no topo da fila"
          }
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            ligado ? "border-azul bg-azul" : "border-borda bg-painel-claro",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform",
              ligado ? "translate-x-6" : "translate-x-1",
            )}
          >
            {isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-texto-sec" aria-hidden />
            )}
          </span>
        </button>
      </div>

      {erro && <Toast mensagem={erro} onClose={() => setErro(null)} />}
    </>
  );
}
