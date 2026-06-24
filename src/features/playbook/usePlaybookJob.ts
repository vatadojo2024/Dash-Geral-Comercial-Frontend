"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lerPlaybook } from "./playbookClient";
import type { PlaybookJob } from "./tipos";

// ---------------------------------------------------------------------------
// Polling de UM job ativo (T-04): GET /playbooks/{id} a cada ~3s até `pronto`/
// `erro` — ou parar por tempo esgotado (~7 min). Sem laço infinito: todo caminho
// encerra o timer; trocar de job/desmontar cancela o anterior.
// ---------------------------------------------------------------------------

const POLL_MS = 3000;
// ~7 min de teto (RNF-03): cobre o processo longo antes de "tempo esgotado".
const MAX_TENTATIVAS = 140;

export function usePlaybookJob(jobId: string | null) {
  const [job, setJob] = useState<PlaybookJob | null>(null);
  const [tempoEsgotado, setTempoEsgotado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    parar();
    setJob(null);
    setTempoEsgotado(false);
    if (!jobId) return;

    let ativo = true;
    let tentativas = 0;

    const tick = async () => {
      tentativas += 1;
      try {
        const j = await lerPlaybook(jobId);
        if (!ativo) return;
        setJob(j);
        if (j.status === "pronto" || j.status === "erro") {
          parar();
          return;
        }
      } catch {
        // Falha transitória (serviço reiniciando/rede): tenta de novo até o teto.
      }
      if (!ativo) return;
      if (tentativas >= MAX_TENTATIVAS) {
        setTempoEsgotado(true);
        parar();
        return;
      }
      timer.current = setTimeout(tick, POLL_MS);
    };

    // Primeira consulta imediata (a fase aparece logo); depois a cada ~3s.
    void tick();

    return () => {
      ativo = false;
      parar();
    };
  }, [jobId, parar]);

  return { job, tempoEsgotado };
}
