"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Render de markdown GFM (RNF-02): títulos, listas, TABELAS e BLOCOS DE CÓDIGO.
// react-markdown NÃO injeta HTML cru (sem rehype-raw) — seguro por padrão. Os
// estilos vêm de um mapa de componentes com os tokens do app (sem depender do
// plugin de typography, que não está no Tailwind do projeto).
// ---------------------------------------------------------------------------

const COMPONENTES: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-semibold text-texto first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 border-b border-borda/60 pb-1 text-lg font-semibold text-texto first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-texto">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 text-sm font-semibold text-texto">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2 text-sm leading-relaxed text-texto">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-azul-claro underline underline-offset-2 hover:text-azul"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-texto">{children}</strong>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-sm text-texto">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-sm text-texto">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-azul/50 pl-3 text-sm italic text-texto-sec">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-borda/60" />,
  // Bloco de código: o <pre> dá o contêiner (fundo/scroll); o <code> interno
  // fica sem fundo. Code inline (sem language-) ganha destaque leve.
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-borda bg-noite/60 p-3 text-xs leading-relaxed text-texto">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const ehBloco = /language-/.test(className ?? "");
    if (ehBloco) {
      return <code className={`${className ?? ""} font-mono`}>{children}</code>;
    }
    return (
      <code className="rounded bg-painel-claro px-1 py-0.5 font-mono text-[0.85em] text-texto">
        {children}
      </code>
    );
  },
  // Tabelas (GFM) — scroll horizontal e bordas com os tokens do app.
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-painel-claro">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-borda px-3 py-1.5 text-left font-semibold text-texto">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-borda px-3 py-1.5 align-top text-texto">{children}</td>
  ),
};

export function MarkdownView({ texto }: { texto: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES}>
        {texto}
      </ReactMarkdown>
    </div>
  );
}
