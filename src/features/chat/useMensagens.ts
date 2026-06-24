"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aplicarStatus, novaMensagem } from "./conversa";
import { enviarMensagem, listarMensagens } from "./chatClient";
import type { Mensagem } from "./tipos";

// ---------------------------------------------------------------------------
// Mensagens de UMA conversa (T-04, T-05): carrega ao abrir, envia e faz POLLING
// até a resposta da IA virar "pronta"/"erro" — ou parar por tempo esgotado
// (~30 tentativas, ~2s cada). Sem laço infinito: todo caminho encerra o timer.
// ---------------------------------------------------------------------------

const POLL_MS = 2000;
const MAX_TENTATIVAS = 30;

let seq = 0;
function idTemporario(prefixo: string): string {
  seq += 1;
  return `${prefixo}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function useMensagens(conversaId: string | null) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Carrega as mensagens ao abrir/trocar de conversa. `ativo` isola cada execução
  // (troca de conversa cancela a anterior, sem setState órfão).
  useEffect(() => {
    pararPolling();
    setMensagens([]);
    setErroCarregar(false);
    if (!conversaId) return;

    let ativo = true;
    setCarregando(true);
    listarMensagens(conversaId)
      .then((ms) => ativo && setMensagens(ms))
      .catch(() => ativo && setErroCarregar(true))
      .finally(() => ativo && setCarregando(false));

    return () => {
      ativo = false;
      pararPolling();
    };
  }, [conversaId, pararPolling]);

  // Polling: relê as mensagens até a IA (idIa) ficar pronta/erro ou esgotar.
  const iniciarPolling = useCallback(
    (cid: string, idIa: string) => {
      pararPolling();
      let tentativas = 0;

      const tick = async () => {
        tentativas += 1;
        try {
          const ms = await listarMensagens(cid);
          setMensagens(ms);
          const ia = ms.find((m) => m.id === idIa);
          if (ia && (ia.status === "pronta" || ia.status === "erro")) {
            pararPolling();
            return;
          }
        } catch {
          // Falha transitória de rede: não derruba, tenta de novo até o teto.
        }
        if (tentativas >= MAX_TENTATIVAS) {
          // Tempo esgotado: marca a IA como erro localmente (RF — sem laço infinito).
          setMensagens((m) => aplicarStatus(m, idIa, "erro"));
          pararPolling();
          return;
        }
        pollTimer.current = setTimeout(tick, POLL_MS);
      };

      pollTimer.current = setTimeout(tick, POLL_MS);
    },
    [pararPolling],
  );

  const enviar = useCallback(
    async (texto: string) => {
      const conteudo = texto.trim();
      if (!conteudo || !conversaId || enviando) return;
      setEnviando(true);

      // Eco otimista: a mensagem do usuário aparece NA HORA + "pensando…".
      const agora = new Date().toISOString();
      const tempIa = idTemporario("tmp_ia");
      setMensagens((m) => [
        ...m,
        novaMensagem({
          id: idTemporario("tmp_user"),
          conversa_id: conversaId,
          autor: "usuario",
          conteudo,
          status: "pronta",
          criada_em: agora,
        }),
        novaMensagem({
          id: tempIa,
          conversa_id: conversaId,
          autor: "ia",
          conteudo: "",
          status: "pendente",
          criada_em: agora,
        }),
      ]);

      try {
        const { ia } = await enviarMensagem(conversaId, conteudo);
        // Sincroniza com o servidor (ids reais) e faz polling até a IA terminar.
        const ms = await listarMensagens(conversaId);
        setMensagens(ms);
        if (ia?.id) iniciarPolling(conversaId, ia.id);
      } catch {
        // Falha no envio: marca a bolha otimista da IA como erro (mostra aviso).
        setMensagens((m) => aplicarStatus(m, tempIa, "erro"));
      } finally {
        setEnviando(false);
      }
    },
    [conversaId, enviando, iniciarPolling],
  );

  // "Tentar novamente" reenvia a pergunta que precede a bolha da IA com erro.
  const tentarNovamente = useCallback(
    (idIa: string) => {
      const idx = mensagens.findIndex((m) => m.id === idIa);
      const pergunta = idx > 0 ? mensagens[idx - 1]?.conteudo ?? "" : "";
      if (pergunta) void enviar(pergunta);
    },
    [mensagens, enviar],
  );

  return { mensagens, carregando, erroCarregar, enviando, enviar, tentarNovamente };
}
