"use client";

import { z } from "zod";
import { CHAT_CONFIGURADO, ChatError, obterTokenSessao } from "@/features/chat/chatClient";
import type { FasePlaybook, PlaybookJob, PlaybookStatus } from "./tipos";
import { PLAYBOOK_STATUS } from "./tipos";

// ---------------------------------------------------------------------------
// Cliente do gerador de playbook (P2/T-01). MESMO padrão e MESMO serviço do
// chat: base NEXT_PUBLIC_CHAT_API_URL + Bearer da sessão Supabase (reaproveita
// obterTokenSessao/ChatError do chatClient). NADA de token de Clint/Supabase/
// Anthropic no front — só o token de sessão do usuário (RNF-04).
//
// Adaptadores TOLERANTES: o serviço usa created_at/updated_at, status/fase em
// formatos do banco — mapeia para o contrato da tela; campo faltando → null.
// ---------------------------------------------------------------------------

const BASE = (process.env.NEXT_PUBLIC_CHAT_API_URL ?? "").replace(/\/$/, "");

// Mesma flag do chat — a aba só chama o serviço quando há endereço configurado.
export { CHAT_CONFIGURADO };

// Helper de request. NÃO força Content-Type: em multipart o navegador define o
// boundary sozinho; em JSON o caller adiciona o header.
async function chamar(caminho: string, init?: RequestInit): Promise<Response> {
  if (!BASE) {
    throw new ChatError(
      "Configure NEXT_PUBLIC_CHAT_API_URL (ex.: http://localhost:8000).",
      "sem_config",
    );
  }
  const token = await obterTokenSessao();
  if (!token) {
    throw new ChatError("Sem sessão válida — entre novamente para usar o playbook.", "sem_sessao");
  }
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Tenta extrair o "detail" do FastAPI para uma mensagem clara (ex.: 400 de
    // formato não suportado / faltou e-mail-telefone).
    let detalhe = "";
    try {
      const corpo = (await res.json()) as { detail?: string } | null;
      detalhe = corpo?.detail ?? "";
    } catch {
      /* corpo não-JSON */
    }
    if (res.status === 404) throw new ChatError("Playbook não encontrado.", "not_found");
    throw new ChatError(detalhe || `O serviço respondeu ${res.status}.`, "request_failed");
  }
  return res;
}

// ----------------------------- adaptadores ----------------------------------

const IdSchema = z.union([z.string(), z.number()]).transform(String);

function statusTolerante(s: unknown): PlaybookStatus {
  return typeof s === "string" && (PLAYBOOK_STATUS as string[]).includes(s)
    ? (s as PlaybookStatus)
    : "pendente";
}

function faseTolerante(f: unknown): FasePlaybook | null {
  const n = typeof f === "number" ? f : typeof f === "string" ? Number(f) : NaN;
  return n === 1 || n === 2 || n === 3 ? (n as FasePlaybook) : null;
}

const ApiJobSchema = z
  .object({
    id: IdSchema,
    status: z.string().nullish(),
    fase_atual: z.union([z.number(), z.string()]).nullish(),
    origem_arquivo: z.string().nullish(),
    lead_email: z.string().nullish(),
    lead_telefone: z.string().nullish(),
    resultado: z.string().nullish(),
    erro: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
  })
  .passthrough();

function adaptJob(raw: unknown): PlaybookJob | null {
  const p = ApiJobSchema.safeParse(raw);
  if (!p.success) {
    console.warn("[playbook] job malformado descartado:", p.error.issues);
    return null;
  }
  const d = p.data;
  const criado = d.created_at ?? d.updated_at ?? "";
  return {
    id: d.id,
    status: statusTolerante(d.status),
    fase_atual: faseTolerante(d.fase_atual),
    origem_arquivo: d.origem_arquivo?.trim() || null,
    lead_email: d.lead_email?.trim() || null,
    lead_telefone: d.lead_telefone?.trim() || null,
    resultado: d.resultado ?? null,
    erro: d.erro?.trim() || null,
    criado_em: criado,
    atualizado_em: d.updated_at ?? criado,
  };
}

// ------------------------------- endpoints ----------------------------------

export type NovoPlaybook = {
  arquivo: File;
  email?: string;
  telefone?: string;
};

// POST /playbooks (multipart): transcrição + e-mail e/ou telefone. → { id, status }.
export async function criarPlaybook(
  input: NovoPlaybook,
): Promise<{ id: string; status: PlaybookStatus }> {
  const fd = new FormData();
  fd.append("file", input.arquivo);
  const email = input.email?.trim();
  const telefone = input.telefone?.trim();
  if (email) fd.append("lead_email", email);
  if (telefone) fd.append("lead_telefone", telefone);

  const res = await chamar("/playbooks", { method: "POST", body: fd });
  const json = (await res.json()) as { id?: unknown; status?: unknown };
  return { id: String(json?.id ?? ""), status: statusTolerante(json?.status) };
}

// GET /playbooks — histórico do usuário (mais recente primeiro no serviço).
export async function listarPlaybooks(): Promise<PlaybookJob[]> {
  const res = await chamar("/playbooks");
  const json: unknown = await res.json();
  const arr = Array.isArray(json) ? json : [];
  return arr.map(adaptJob).filter((j): j is PlaybookJob => j !== null);
}

// GET /playbooks/{id} — status + fase + resultado (polling e reabrir do histórico).
export async function lerPlaybook(jobId: string): Promise<PlaybookJob> {
  const res = await chamar(`/playbooks/${encodeURIComponent(jobId)}`);
  const json: unknown = await res.json();
  const job = adaptJob(json);
  if (!job) throw new ChatError("Resposta inesperada ao ler o playbook.", "request_failed");
  return job;
}

// DELETE /playbooks/{id}.
export async function apagarPlaybook(jobId: string): Promise<void> {
  await chamar(`/playbooks/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}
