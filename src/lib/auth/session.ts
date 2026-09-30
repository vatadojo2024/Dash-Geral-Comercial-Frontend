import { cookies } from "next/headers";
import { SessionUserSchema, type SessionUser } from "@/lib/api/contracts";
import { normalizarAreas } from "./areas";
import { findAccountById } from "@/lib/mock/users";
import { SESSION_COOKIE } from "./constants";

// ---------------------------------------------------------------------------
// Sessão do servidor, atrás de AUTH_MODE:
//   - mock: o cookie guarda o id da conta de demonstração → lista local.
//   - supabase: o cookie guarda o SessionUser real (JSON) resolvido no login
//     via GET /api/me. O JWT em si não passa por aqui — vai direto do navegador
//     à API (anexado pelo dataClient). Server-render do menu/escopo usa só o
//     papel já resolvido, sem depender da API estar no ar a cada request.
//     Cookie gravado antes de 30/09 não tem `areas`: completa pela reserva do
//     papel em vez de derrubar a sessão (derrubar daria loop com o middleware,
//     que vê o cookie e manda de volta para o app).
// ---------------------------------------------------------------------------

export async function getServerSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const valor = jar.get(SESSION_COOKIE)?.value;
  if (!valor) return null;

  if (process.env.AUTH_MODE === "supabase") {
    try {
      const raw = JSON.parse(decodeURIComponent(valor)) as Record<string, unknown> | null;
      const papel = SessionUserSchema.shape.role.safeParse(raw?.role);
      if (!raw || !papel.success) return null;
      const parsed = SessionUserSchema.safeParse({ ...raw, areas: normalizarAreas(raw.areas, papel.data) });
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return findAccountById(valor);
}
