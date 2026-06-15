import { NextResponse, type NextRequest } from "next/server";
import { LeadListItemSchema } from "@/lib/api/contracts";
import { getServerSession } from "@/lib/auth/session";
import { adaptApiLeads } from "@/lib/server/apiLeads";
import { leadNoEscopo, todosOsLeadsMock } from "@/lib/server/mockLeads";

// ---------------------------------------------------------------------------
// GET /api/leads — única porta de leads do app (Parte 7.5 / 8b).
// LEADS_MODE controla a fonte SEM tocar em componente:
//   - "mock" (default): data_clients.json filtrado pelo papel da sessão.
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/leads com o Bearer da
//     sessão Supabase (o token chega no header Authorization desta chamada).
// Pendência de integração: o GET /api/leads real precisa expor next_call_at
// e next_call_numero (Agenda) — registrada no PROGRESSO.md.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";

  if (modo === "mock") {
    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }
    const items = todosOsLeadsMock()
      .filter((l) => leadNoEscopo(l, user))
      .sort(
        (a, b) =>
          b.score_final - a.score_final ||
          b.score_calculated_at.localeCompare(a.score_calculated_at),
      )
      .map((l) => LeadListItemSchema.parse(l));
    return NextResponse.json({ total: items.length, items });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Configure NEXT_PUBLIC_API_URL no .env para usar LEADS_MODE=api" },
      { status: 500 },
    );
  }
  const token = req.headers.get("authorization");
  if (!token) {
    return NextResponse.json(
      { error: "Sem token da sessão Supabase — faça login novamente." },
      { status: 401 },
    );
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/leads`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      // Erro REAL (status != 2xx) — único caso que vira estado de erro na tela.
      return NextResponse.json(
        { error: `A API de leads respondeu ${res.status}.` },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 },
      );
    }

    // 200 da API real: corpo enxuto { leads: [...] }. Adaptamos ao contrato do
    // app (LeadListItemSchema) em vez de repassar cru — senão a validação no
    // client derruba a fila inteira mesmo com dados válidos. O adapter tolera
    // lead a lead e loga no servidor o motivo exato de qualquer descarte.
    const corpo = await res.json().catch(() => null);
    const adaptado = adaptApiLeads(corpo);
    if (!adaptado.ok) {
      return NextResponse.json(
        { error: `A API de leads respondeu em formato inesperado: ${adaptado.motivo}` },
        { status: 502 },
      );
    }
    const items = adaptado.items.sort(
      (a, b) =>
        b.score_final - a.score_final ||
        b.score_calculated_at.localeCompare(a.score_calculated_at),
    );
    return NextResponse.json({ total: items.length, items });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API de leads: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
