import { NextResponse } from "next/server";
import type { Area, SessionUser } from "@/lib/api/contracts";
import { temArea } from "@/lib/auth/areas";
import { MENSAGEM_SEM_PERMISSAO } from "@/lib/auth/semPermissao";
import { getServerSession } from "@/lib/auth/session";

// Trava por área nas rotas do front que NÃO passam pela API do Mapa de Calor
// (Dashboard SDR, conferência dos Agendamentos) — lá quem responde 403 é a
// API. Mesma lista `areas` da sessão e o mesmo 403 { error: "Sem permissão" }.
// Devolve o usuário, ou a resposta pronta (401/403) para a rota retornar.
export async function exigirAreaNaApi(
  ...areas: Area[]
): Promise<{ user: SessionUser; negado?: undefined } | { user?: undefined; negado: NextResponse }> {
  const user = await getServerSession();
  if (!user) return { negado: NextResponse.json({ error: "Sessão expirada." }, { status: 401 }) };
  if (!areas.some((a) => temArea(user, a))) {
    return { negado: NextResponse.json({ error: MENSAGEM_SEM_PERMISSAO }, { status: 403 }) };
  }
  return { user };
}
