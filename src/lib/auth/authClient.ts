"use client";

import { SessionUserSchema } from "@/lib/api/contracts";
import { DEMO_ACCOUNTS } from "@/lib/mock/users";
import { entrarComo, entrarComoUsuario } from "./clientSession";

// ---------------------------------------------------------------------------
// Login por e-mail/senha atrás de AUTH_MODE (Parte 7.1.5 + 8b):
//   - mock (default): valida o e-mail contra a lista de usuários; qualquer
//     senha entra (a tela já é a definitiva — só a validação é provisória).
//   - supabase: autentica no Supabase Auth real (signInWithPassword) e descobre
//     o papel/identidade em GET /api/me (com o Bearer da sessão). O SessionUser
//     real é gravado no cookie de sessão; o JWT segue na sessão do supabase-js
//     e é anexado às chamadas à API pelo dataClient.
// O modo chega como prop do server (page.tsx lê process.env.AUTH_MODE).
// ---------------------------------------------------------------------------

export type AuthMode = "mock" | "supabase";

export class AuthError extends Error {}

function contaPorEmail(email: string) {
  const alvo = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === alvo) ?? null;
}

async function loginSupabase(email: string, senha: string): Promise<void> {
  const { getSupabaseClient } = await import("./supabase");
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });
  if (error || !data.session) throw new AuthError("E-mail ou senha inválidos.");

  // Papel/identidade vêm da API real (não da lista local).
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AuthError(
      corpo?.error ??
        "Login feito, mas a API não retornou seu perfil (/api/me). Tente novamente.",
    );
  }
  const parsed = SessionUserSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new AuthError("A API retornou um perfil fora do contrato em /api/me.");
  }
  entrarComoUsuario(parsed.data);
}

export async function loginComEmailSenha(
  modo: AuthMode,
  email: string,
  senha: string,
): Promise<void> {
  if (modo === "supabase") {
    await loginSupabase(email, senha);
    return;
  }

  const conta = contaPorEmail(email);
  if (!conta) throw new AuthError("E-mail ou senha inválidos.");
  entrarComo(conta.id);
}
