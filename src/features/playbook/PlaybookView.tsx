"use client";

import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { useSessaoChat } from "@/features/chat/useSessaoChat";
import { CHAT_CONFIGURADO, type NovoPlaybook } from "./playbookClient";
import { PlaybookForm } from "./PlaybookForm";
import { PlaybookHistory } from "./PlaybookHistory";
import {
  PlaybookErro,
  PlaybookProcessando,
  PlaybookTempoEsgotado,
} from "./PlaybookProgress";
import { PlaybookResult } from "./PlaybookResult";
import { usePlaybookJob } from "./usePlaybookJob";
import { usePlaybooks } from "./usePlaybooks";
import type { PlaybookJob } from "./tipos";

type Estado = "form" | "processando" | "resultado";

function Aviso({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Card>
      <EmptyState icon={LockKeyhole} titulo={titulo} descricao={descricao} />
    </Card>
  );
}

export function PlaybookView() {
  const sessao = useSessaoChat();
  const habilitado = sessao === "ok" && CHAT_CONFIGURADO;

  const [estado, setEstado] = useState<Estado>("form");
  const [jobIdAtivo, setJobIdAtivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<PlaybookJob | null>(null);

  const { query, criar, apagar, revalidar } = usePlaybooks(habilitado);
  const { job, tempoEsgotado } = usePlaybookJob(jobIdAtivo);
  const jobs = query.data ?? [];

  // Job ficou pronto (via polling) → vai para o resultado e atualiza o histórico.
  useEffect(() => {
    if (job?.status === "pronto") {
      setResultado(job);
      setEstado("resultado");
      setJobIdAtivo(null);
      revalidar();
    }
  }, [job, revalidar]);

  function voltarAoForm() {
    setJobIdAtivo(null);
    setResultado(null);
    setEstado("form");
  }

  async function gerar(input: NovoPlaybook) {
    try {
      const { id } = await criar.mutateAsync(input);
      setResultado(null);
      setJobIdAtivo(id);
      setEstado("processando");
      revalidar();
    } catch {
      /* a falha fica em criar.error e aparece no formulário */
    }
  }

  // Reabre qualquer job do histórico: o polling busca o detalhe e roteia sozinho
  // (pronto → resultado, erro → erro, processando → continua acompanhando).
  function abrir(j: PlaybookJob) {
    setResultado(null);
    setJobIdAtivo(j.id);
    setEstado("processando");
  }

  async function remover(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Apagar este playbook?")) return;
    try {
      await apagar.mutateAsync(id);
      if (jobIdAtivo === id || resultado?.id === id) voltarAoForm();
    } catch {
      /* mantém na lista se falhar */
    }
  }

  // --- Guardas (RF-07 + config) ----------------------------------------------
  if (!CHAT_CONFIGURADO) {
    return (
      <Aviso
        titulo="Playbook não configurado"
        descricao="Defina NEXT_PUBLIC_CHAT_API_URL (ex.: http://localhost:8000) para conectar ao serviço."
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
        titulo="Entre para usar o playbook"
        descricao="É necessário estar logado com uma sessão válida para gerar playbooks."
      />
    );
  }

  const erroCriar = criar.isError
    ? criar.error instanceof Error
      ? criar.error.message
      : "Não foi possível enviar a transcrição."
    : null;

  return (
    <div className="space-y-4">
      {estado === "form" && (
        <>
          <PlaybookForm onGerar={gerar} enviando={criar.isPending} erro={erroCriar} />
          <PlaybookHistory
            jobs={jobs}
            carregando={query.isLoading}
            erro={query.isError}
            apagandoId={apagar.isPending ? apagar.variables ?? null : null}
            onAbrir={abrir}
            onApagar={remover}
          />
        </>
      )}

      {estado === "processando" &&
        (job?.status === "erro" ? (
          <PlaybookErro mensagem={job.erro} onTentar={voltarAoForm} />
        ) : tempoEsgotado ? (
          <PlaybookTempoEsgotado onReenviar={voltarAoForm} />
        ) : (
          <PlaybookProcessando faseAtual={job?.fase_atual ?? null} />
        ))}

      {estado === "resultado" && resultado && (
        <PlaybookResult job={resultado} onGerarOutro={voltarAoForm} />
      )}
    </div>
  );
}
