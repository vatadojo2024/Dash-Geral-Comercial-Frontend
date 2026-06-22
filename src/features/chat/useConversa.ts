"use client";

import { useCallback, useRef, useState } from "react";
import type { Role } from "@/lib/api/contracts";
import { aplicarConteudo, aplicarStatus, novaMensagem } from "./conversa";
import { obterResposta } from "./fonteRespostas";
import type { Conversa, Mensagem } from "./tipos";

// ---------------------------------------------------------------------------
// Estado da conversa, EM MEMÓRIA (RNF-01/02): sem localStorage/sessionStorage;
// recarregar zera (esperado). Expõe as ações do fluxo da seção 5 do design:
// enviar → (usuário pronta + IA pendente) → fonte → pronta | erro; e tentar
// novamente (→ pendente e rechama a fonte).
// ---------------------------------------------------------------------------

let seq = 0;
function novoId(prefixo: string): string {
  seq += 1;
  return `${prefixo}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function useConversa(papel: Role) {
  const [conversa] = useState<Conversa>(() => {
    const agora = new Date().toISOString();
    return {
      id: novoId("cv"),
      papel,
      criada_em: agora,
      atualizada_em: agora,
    };
  });

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);

  // Guarda a pergunta de cada mensagem da IA para o "tentar novamente" rechamar
  // a fonte com o mesmo texto (a bolha da IA nasce com conteúdo vazio).
  const perguntas = useRef<Record<string, string>>({});

  // Chama a fonte (mock hoje, serviço real na Etapa 5) e reage ao resultado.
  // A tela/hook NÃO sabem que é falso — só tratam sucesso vs. erro.
  const responder = useCallback(
    (idIa: string, pergunta: string, forcarErro?: boolean) => {
      obterResposta({ pergunta, papel: conversa.papel, forcarErro })
        .then((conteudo) => {
          setMensagens((m) => aplicarConteudo(m, idIa, conteudo));
        })
        .catch(() => {
          setMensagens((m) => aplicarStatus(m, idIa, "erro"));
        });
    },
    [conversa.papel],
  );

  const enviar = useCallback(
    (texto: string, opts?: { forcarErro?: boolean }) => {
      const conteudo = texto.trim();
      if (!conteudo) return;

      const msgUsuario = novaMensagem({
        id: novoId("ms"),
        conversa_id: conversa.id,
        autor: "usuario",
        conteudo,
        status: "pronta", // usuário nasce sempre pronta
        criada_em: new Date().toISOString(),
      });
      const msgIa = novaMensagem({
        id: novoId("ms"),
        conversa_id: conversa.id,
        autor: "ia",
        conteudo: "",
        status: "pendente", // dispara o "pensando…"
        criada_em: new Date().toISOString(),
      });

      perguntas.current[msgIa.id] = conteudo;
      setMensagens((m) => [...m, msgUsuario, msgIa]);
      responder(msgIa.id, conteudo, opts?.forcarErro);
    },
    [conversa.id, responder],
  );

  const tentarNovamente = useCallback(
    (idIa: string) => {
      setMensagens((m) => aplicarStatus(m, idIa, "pendente"));
      responder(idIa, perguntas.current[idIa] ?? "", false);
    },
    [responder],
  );

  return { conversa, mensagens, enviar, tentarNovamente };
}
