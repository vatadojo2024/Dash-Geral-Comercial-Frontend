"use client";

import { useRef, useState, type FormEvent } from "react";
import { FileText, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { NovoPlaybook } from "./playbookClient";

// Formulário de geração (T-03): anexo (.txt/.docx) + e-mail e/ou telefone (pelo
// menos um) + "Gerar playbook". A validação trava o botão até o mínimo estar ok.
export function PlaybookForm({
  onGerar,
  enviando,
  erro,
}: {
  onGerar: (input: NovoPlaybook) => void;
  enviando: boolean;
  erro?: string | null;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const temContato = email.trim().length > 0 || telefone.trim().length > 0;
  const podeGerar = Boolean(arquivo) && temContato && !enviando;

  function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    if (!arquivo || !temContato || enviando) return;
    onGerar({ arquivo, email: email.trim() || undefined, telefone: telefone.trim() || undefined });
  }

  return (
    <Card>
      <CardHeader
        title="Gerar playbook"
        subtitle="Anexe a transcrição e identifique o lead (e-mail e/ou telefone)."
      />
      <CardContent>
        <form onSubmit={aoSubmeter} className="space-y-4">
          {/* Anexo (.txt/.docx) */}
          <div>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
              Transcrição (.txt ou .docx)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.docx"
              className="sr-only"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo ? (
              <div className="flex items-center gap-2 rounded-lg border border-borda bg-noite/40 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-azul-claro" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-texto">{arquivo.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setArquivo(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  aria-label="Remover arquivo"
                  className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-borda bg-painel-claro px-3 py-4 text-sm text-texto-sec transition-colors hover:border-azul/60 hover:text-texto"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Selecionar arquivo
              </button>
            )}
          </div>

          {/* E-mail / telefone (pelo menos um) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
                E-mail do lead
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lead@exemplo.com"
                className="h-10 w-full rounded-lg border border-borda bg-painel-claro px-3 text-sm text-texto outline-none placeholder:text-texto-sec/60 focus:border-azul"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-texto-sec/80">
                Telefone do lead
              </span>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="+55 11 99999-9999"
                className="h-10 w-full rounded-lg border border-borda bg-painel-claro px-3 text-sm text-texto outline-none placeholder:text-texto-sec/60 focus:border-azul"
              />
            </label>
          </div>

          <p className="text-xs text-texto-sec">
            Informe <strong className="font-medium text-texto">pelo menos um</strong> entre e-mail e
            telefone — usado para buscar o lead no Clint.
          </p>

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-rosa/30 bg-rosa/10 px-3 py-2 text-sm text-rosa"
            >
              {erro}
            </p>
          )}

          <Button type="submit" disabled={!podeGerar} loading={enviando}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Gerar playbook
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
