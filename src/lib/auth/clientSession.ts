"use client";

import type { SessionUser } from "@/lib/api/contracts";
import { SESSION_COOKIE } from "./constants";

const OITO_HORAS = 8 * 60 * 60;

// ---------------------------------------------------------------------------
// Cookie de sessão (mdc_user). O conteúdo depende do AUTH_MODE:
//   - mock: o id da conta de demonstração (entrarComo).
//   - supabase: o SessionUser real (id/nome/email/role) vindo do GET /api/me,
//     serializado em JSON (entrarComoUsuario) — o JWT em si fica na sessão do
//     supabase-js (localStorage) e é anexado às chamadas pelo dataClient.
// O middleware e o getServerSession leem ESTE mesmo cookie.
// ---------------------------------------------------------------------------

function gravar(valor: string) {
  document.cookie = `${SESSION_COOKIE}=${valor}; path=/; max-age=${OITO_HORAS}; samesite=lax`;
}

export function entrarComo(accountId: string) {
  gravar(accountId);
}

export function entrarComoUsuario(user: SessionUser) {
  gravar(encodeURIComponent(JSON.stringify(user)));
}

// Limpa só o cookie (síncrono) — usado no caminho de 401 para evitar loop de
// redirecionamento (cookie presente faria o middleware bater de volta no app).
export function limparCookieSessao() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

// Logout completo: encerra a sessão do Supabase (quando há envs) e limpa o
// cookie. Best-effort no signOut — o que realmente derruba a sessão do app é
// o cookie sumir.
export async function sair() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    try {
      const { getSupabaseClient } = await import("./supabase");
      await getSupabaseClient().auth.signOut();
    } catch {
      /* sessão já inválida — segue limpando o cookie */
    }
  }
  limparCookieSessao();
}
