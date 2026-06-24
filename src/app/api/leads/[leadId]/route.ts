import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { adaptApiLeadDetail, parseCorpoLead } from "@/lib/server/apiLeadDetail";
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
  // Cinto de segurança: QUALQUER exceção (antes ou depois do fetch) vira uma
  // resposta clara e logada, nunca um 502 opaco por crash não-tratado. Antes,
  // um erro no ramo mock (sem try/catch) ou um fetch com URL inválida derrubava
  // a função "sem outgoing request" e a Vercel respondia 502 sem diagnóstico.
  try {
    const { leadId } = await params;
    const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";

    if (modo === "mock") {
      const user = await getServerSession();
      if (!user) {
        return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
      }
      let lista;
      try {
        lista = todosOsLeadsMock();
      } catch (e) {
        console.error("[/api/leads/:id] mock (data_clients.json) fora do contrato:", e);
        return NextResponse.json(
          { error: "Mock de leads inválido (LEADS_MODE=mock)." },
          { status: 500 },
        );
      }
      const lead = lista.find((l) => l.lead_id === leadId);
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

    // Monta a URL com new URL() ANTES do fetch. Se NEXT_PUBLIC_API_URL vier sem
    // protocolo (ex.: "mapacalor-api.infradojo.pro" em vez de "https://..."), o
    // fetch lançaria "Invalid URL" e a função cairia em 502 SEM nem chamar a API
    // ("No outgoing requests"). Aqui isso vira um 500 explícito e diagnosticável.
    let url: string;
    try {
      url = new URL(`/api/leads/${encodeURIComponent(leadId)}`, base).toString();
    } catch {
      console.error(
        `[/api/leads/:id] NEXT_PUBLIC_API_URL inválida (precisa de protocolo absoluto): ${JSON.stringify(base)}`,
      );
      return NextResponse.json(
        {
          error: `NEXT_PUBLIC_API_URL inválida — use uma URL absoluta com protocolo (ex.: https://host). Valor atual: ${base}`,
        },
        { status: 500 },
      );
    }

    const res = await fetch(url, {
      headers: { Authorization: token },
      cache: "no-store",
    });
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

    // 200 da API real: corpo no contrato real (campos null, blocos como objeto,
    // analise_sdr/call com nomes próprios, timeline com event_type). Adaptamos
    // ao LeadDetailSchema em vez de repassar cru — senão o Zod do client derruba
    // a tela ("Não foi possível carregar o lead") mesmo com 200 válido.
    //
    // Lemos como TEXTO e fazemos um parse tolerante: campos de texto do CRM
    // (briefing/condução) chegam com <br/> e quebras de linha REAIS não-escapadas,
    // que o res.json() estrito rejeita ("Bad control character") e derrubava o
    // lead em 502. parseCorpoLead repara controles crus dentro de strings.
    const texto = await res.text().catch(() => "");
    const corpo = parseCorpoLead(texto);
    const adaptado = adaptApiLeadDetail(corpo);
    if (!adaptado.ok) {
      return NextResponse.json(
        { error: `A API de leads respondeu em formato inesperado: ${adaptado.motivo}` },
        { status: 502 },
      );
    }
    return NextResponse.json(adaptado.lead);
  } catch (e) {
    console.error("[/api/leads/:id] erro inesperado no handler:", e);
    return NextResponse.json(
      { error: `Falha ao consultar a API de leads: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
