import { NextResponse, type NextRequest } from "next/server";
import { mockOportunidades } from "@/lib/mock/eventos_oportunidades";

// ---------------------------------------------------------------------------
// GET /api/eventos/oportunidades?de&ate — proxy da aba "Levantou a Mão".
// LEADS_MODE (mesma env dos leads; mesmo backend mapacalor-api) decide a fonte:
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/eventos/oportunidades com o
//     Bearer da sessão Supabase. Status e corpo de erro do backend (400 params,
//     422 { erro: "intervalo_muito_grande" }, 502 { erro: "clint_auth" | ... })
//     passam INTACTOS — a UI decide a mensagem por status + código.
//   - "mock" (default): fixture determinístico (src/lib/mock/eventos_oportunidades)
//     com ~40 pendentes; aceita `simular=vazio|sem_contatos|desqualificados|sem_replay|sem_resgate|base_inflada|clint_auth|
//     clint_indisponivel|intervalo_muito_grande` para exercitar os estados.
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  if (!de || !ate || !RE_DATA.test(de) || !RE_DATA.test(ate)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos: de e ate devem ser YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";
  if (modo === "mock") {
    const simular = searchParams.get("simular");
    if (simular === "clint_auth" || simular === "clint_indisponivel") {
      return NextResponse.json({ erro: simular }, { status: 502 });
    }
    if (simular === "intervalo_muito_grande") {
      return NextResponse.json({ erro: simular }, { status: 422 });
    }
    if (ate < de) {
      return NextResponse.json({ error: "Parâmetros inválidos: ate deve ser >= de" }, { status: 400 });
    }
    return NextResponse.json(mockOportunidades(de, ate, simular));
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
    const qs = `de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`;
    const res = await fetch(`${base.replace(/\/$/, "")}/api/eventos/oportunidades?${qs}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      // Repassa o status/código do backend quando ele é um erro "de contrato"
      // (400/401/403/422/502); qualquer outro vira 502 com mensagem.
      const conhecido = [400, 401, 403, 422, 502].includes(res.status);
      return NextResponse.json(
        corpo ?? { error: `A API de oportunidades respondeu ${res.status}.` },
        { status: conhecido ? res.status : 502 },
      );
    }
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar oportunidades: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
