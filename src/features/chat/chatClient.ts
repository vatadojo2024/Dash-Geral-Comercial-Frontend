"use client";

import { z } from "zod";
import { RoleSchema, type Role } from "@/lib/api/contracts";
import { getSupabaseClient } from "@/lib/auth/supabase";
import type { Autor, Conversa, Mensagem, StatusMensagem } from "./tipos";

// ---------------------------------------------------------------------------
// Cliente do SERVIÇO DE CHAT real (Etapa 5). Segue o MESMO padrão do dataClient
// do Mapa de Calor: pega o access token da sessão Supabase e manda no
// Authorization. Só muda a base URL (NEXT_PUBLIC_CHAT_API_URL).
//
// É a FONTE única do chat — substitui o mock da Etapa 1 (fonteRespostas). Os
// adaptadores são TOLERANTES (campo faltando não quebra a tela): mapeiam o
// formato real do serviço (created_at/updated_at, papel "gestor", anexos jsonb)
// para o contrato que a tela espera (tipos.ts), descartando item inválido.
// ---------------------------------------------------------------------------

const BASE = (process.env.NEXT_PUBLIC_CHAT_API_URL ?? "").replace(/\/$/, "");

// A aba só chama o serviço quando há endereço configurado (T-08 + config).
export const CHAT_CONFIGURADO = Boolean(BASE);

export class ChatError extends Error {
  constructor(
    message: string,
    public readonly code: "sem_config" | "sem_sessao" | "not_found" | "request_failed",
  ) {
    super(message);
    this.name = "ChatError";
  }
}

// Token da sessão Supabase — mesma forma do dataClient. Sem as envs públicas do
// Supabase (modo mock) ou sem sessão ativa, devolve null (a aba não chama).
export async function obterTokenSessao(): Promise<string | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function chamar(caminho: string, init?: RequestInit): Promise<Response> {
  if (!BASE) {
    throw new ChatError(
      "Configure NEXT_PUBLIC_CHAT_API_URL (ex.: http://localhost:8000).",
      "sem_config",
    );
  }
  const token = await obterTokenSessao();
  if (!token) {
    throw new ChatError("Sem sessão válida — entre novamente para usar o chat.", "sem_sessao");
  }
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 404) throw new ChatError("Conversa não encontrada.", "not_found");
    throw new ChatError(`O serviço de chat respondeu ${res.status}.`, "request_failed");
  }
  return res;
}

// ----------------------------- adaptadores ----------------------------------

// id pode vir string ou número (uuid/serial) — normaliza para string.
const IdSchema = z.union([z.string(), z.number()]).transform(String);

const ApiConversaSchema = z
  .object({
    id: IdSchema,
    papel: z.string().nullish(),
    titulo: z.string().nullish(),
    resumo: z.string().nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
  })
  .passthrough();

const ApiMensagemSchema = z
  .object({
    id: IdSchema,
    conversa_id: IdSchema.nullish(),
    autor: z.string().nullish(),
    conteudo: z.string().nullish(),
    status: z.string().nullish(),
    anexos: z.unknown(),
    created_at: z.string().nullish(),
  })
  .passthrough();

// O serviço aceita papel "gestor"; o front só tem admin|closer|sdr → gestor vira
// admin (mesmo agente, ver agentes.ts). Qualquer valor estranho cai em admin.
function papelTolerante(p: unknown): Role {
  const s = typeof p === "string" ? p.trim().toLowerCase() : "";
  if (s === "gestor") return "admin";
  const r = RoleSchema.safeParse(s);
  return r.success ? r.data : "admin";
}

function autorTolerante(a: unknown): Autor {
  return a === "usuario" ? "usuario" : "ia"; // desconhecido → ia (lado da IA)
}

function statusTolerante(s: unknown): StatusMensagem {
  return s === "pendente" || s === "pronta" || s === "erro" ? s : "pronta";
}

function adaptConversa(raw: unknown): Conversa | null {
  const p = ApiConversaSchema.safeParse(raw);
  if (!p.success) {
    console.warn("[chat] conversa malformada descartada:", p.error.issues);
    return null;
  }
  const d = p.data;
  const criada = d.created_at ?? d.updated_at ?? "";
  return {
    id: d.id,
    papel: papelTolerante(d.papel),
    titulo: d.titulo?.trim() || undefined,
    resumo: d.resumo?.trim() || undefined,
    criada_em: criada,
    atualizada_em: d.updated_at ?? criada,
  };
}

function adaptMensagem(raw: unknown, conversaIdFallback: string): Mensagem | null {
  const p = ApiMensagemSchema.safeParse(raw);
  if (!p.success) {
    console.warn("[chat] mensagem malformada descartada:", p.error.issues);
    return null;
  }
  const d = p.data;
  return {
    id: d.id,
    conversa_id: d.conversa_id ?? conversaIdFallback,
    autor: autorTolerante(d.autor),
    conteudo: d.conteudo ?? "",
    status: statusTolerante(d.status),
    criada_em: d.created_at ?? "",
    // anexos do serviço são jsonb de forma ainda indefinida e a tela não os
    // renderiza nesta etapa → sempre [] (contrato preservado, sem quebrar).
    anexos: [],
  };
}

// ------------------------------- endpoints ----------------------------------

export async function listarConversas(): Promise<Conversa[]> {
  const res = await chamar("/conversas");
  const json: unknown = await res.json();
  const arr = Array.isArray(json) ? json : [];
  // GET /conversas já vem recente-primeiro (order updated_at.desc no serviço).
  return arr.map(adaptConversa).filter((c): c is Conversa => c !== null);
}

export async function criarConversa(): Promise<Conversa> {
  const res = await chamar("/conversas", { method: "POST" });
  const json: unknown = await res.json();
  const c = adaptConversa(json);
  if (!c) throw new ChatError("Resposta inesperada ao criar a conversa.", "request_failed");
  return c;
}

export async function apagarConversa(conversaId: string): Promise<void> {
  await chamar(`/conversas/${encodeURIComponent(conversaId)}`, { method: "DELETE" });
}

export async function listarMensagens(conversaId: string): Promise<Mensagem[]> {
  const res = await chamar(`/conversas/${encodeURIComponent(conversaId)}/mensagens`);
  const json: unknown = await res.json();
  const arr = Array.isArray(json) ? json : [];
  return arr
    .map((m) => adaptMensagem(m, conversaId))
    .filter((m): m is Mensagem => m !== null);
}

// POST devolve { mensagem_usuario, mensagem_ia } (a IA nasce "pendente").
export async function enviarMensagem(
  conversaId: string,
  conteudo: string,
): Promise<{ usuario: Mensagem | null; ia: Mensagem | null }> {
  const res = await chamar(`/conversas/${encodeURIComponent(conversaId)}/mensagens`, {
    method: "POST",
    body: JSON.stringify({ conteudo }),
  });
  const json = (await res.json()) as {
    mensagem_usuario?: unknown;
    mensagem_ia?: unknown;
  };
  return {
    usuario: adaptMensagem(json?.mensagem_usuario, conversaId),
    ia: adaptMensagem(json?.mensagem_ia, conversaId),
  };
}
