import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Client do Supabase Auth (AUTH_MODE=supabase). Criado sob demanda para o
// app não exigir as envs enquanto AUTH_MODE=mock.
// ---------------------------------------------------------------------------

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env para usar AUTH_MODE=supabase.",
    );
  }
  client = createClient(url, anonKey);
  return client;
}
