import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { leadNoEscopo, todosOsLeadsMock } from "@/lib/server/mockLeads";

// ---------------------------------------------------------------------------
// GET /api/leads/:id — detalhe do lead atrás de LEADS_MODE (8b).
// No modo api o endpoint real é o GET /api/leads/:id da F5 (expansão da API);
// enquanto não existir, a chamada devolve o erro da API externa.
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";

  if (modo === "mock") {
    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }
    const lead = todosOsLeadsMock().find((l) => l.lead_id === leadId);
    if (!lead || !leadNoEscopo(lead, user)) {
      return NextResponse.json(
        { error: "Lead não encontrado ou fora do seu escopo." },
        { status: 404 },
      );
    }
    return NextResponse.json(lead);
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
    const res = await fetch(
      `${base.replace(/\/$/, "")}/api/leads/${encodeURIComponent(leadId)}`,
      { headers: { Authorization: token }, cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `A API de leads respondeu ${res.status}.` },
        {
          status:
            res.status === 401 || res.status === 403 || res.status === 404
              ? res.status
              : 502,
        },
      );
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API de leads: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
