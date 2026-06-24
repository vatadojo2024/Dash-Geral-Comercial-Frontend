"use client";

import { useState } from "react";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { MarkdownView } from "./MarkdownView";
import type { PlaybookJob } from "./tipos";

// Nome do arquivo .md: usa o lead (e-mail/telefone) ou a data; sempre seguro.
function nomeArquivo(job: PlaybookJob): string {
  const base =
    job.lead_email ||
    job.lead_telefone ||
    (job.criado_em ? job.criado_em.slice(0, 10) : "playbook");
  const slug = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "playbook";
  return `playbook_${slug}.md`;
}

// Resultado (T-05): markdown GFM + baixar (.md, no cliente) + copiar + gerar outro.
export function PlaybookResult({
  job,
  onGerarOutro,
}: {
  job: PlaybookJob;
  onGerarOutro: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = job.resultado ?? "";

  function baixar() {
    const blob = new Blob([texto], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo(job);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* navegador sem permissão de clipboard — silencioso */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Playbook gerado"
        subtitle={job.origem_arquivo ? `A partir de ${job.origem_arquivo}` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={baixar}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Baixar (.md)
            </Button>
            <Button variant="outline" size="sm" onClick={copiar}>
              {copiado ? (
                <Check className="h-3.5 w-3.5 text-verde" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onGerarOutro}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Gerar outro
            </Button>
          </div>
        }
      />
      <CardContent>
        {texto.trim() ? (
          <MarkdownView texto={texto} />
        ) : (
          <p className="text-sm text-texto-sec">O playbook veio vazio.</p>
        )}
      </CardContent>
    </Card>
  );
}
