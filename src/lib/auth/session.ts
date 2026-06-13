import { cookies } from "next/headers";
import { SessionUserSchema, type SessionUser } from "@/lib/api/contracts";
import { findAccountById } from "@/lib/mock/users";
import { SESSION_COOKIE } from "./constants";

// ---------------------------------------------------------------------------
// Sessão do servidor, atrás de AUTH_MODE:
//   - mock: o cookie guarda o id da conta de demonstração → lista local.
//   - supabase: o cookie guarda o SessionUser real (JSON) resolvido no login
//     via GET /api/me. O JWT em si não passa por aqui — vai direto do navegador
//     à API (anexado pelo dataClient). Server-render do menu/escopo usa só o
//     papel já resolvido, sem depender da API estar no ar a cada request.
// ---------------------------------------------------------------------------

export async function getServerSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const valor = jar.get(SESSION_COOKIE)?.value;
  if (!valor) return null;

  if (process.env.AUTH_MODE === "supabase") {
    try {
      const parsed = SessionUserSchema.safeParse(
        JSON.parse(decodeURIComponent(valor)),
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return findAccountById(valor);
}
