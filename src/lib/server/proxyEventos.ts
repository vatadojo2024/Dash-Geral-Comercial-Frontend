import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Proxy comum dos endpoints de evento (/api/eventos/oportunidades e
// /api/eventos/nao-abordados): mesmos parâmetros (de, ate), mesma env
// (LEADS_MODE), mesmos códigos de erro. Cada route handler só diz o caminho no
// backend e o mock. Status e corpo de erro do backend (400 params, 422
// { erro: "intervalo_muito_grande" }, 502 { erro: "clint_auth" | ... }) passam
// INTACTOS — a UI decide a mensagem por status + código.
//
// Em mock, `simular=<código>` devolve o erro correspondente:
//   clint_auth | clint_indisponivel | agendamentos_indisponivel |
//   leads_indisponivel → 502; intervalo_muito_grande → 422.
// Os demais valores de `simular` vão para a função de mock decidir.
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const ERROS_502 = new Set([
  "clint_auth",
  "clint_indisponivel",
  "agendamentos_indisponivel",
  "leads_indisponivel",
]);

export async function proxyEventos(
  req: NextRequest,
  opcoes: {
    // Caminho no backend, ex.: "/api/eventos/oportunidades".
    caminho: string;
    // Nome curto para as mensagens de erro do próprio proxy.
    rotulo: string;
    mock: (de: string, ate: string, simular: string | null) => unknown;
  },
): Promise<NextResponse> {
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
    if (simular && ERROS_502.has(simular)) {
      return NextResponse.json({ erro: simular }, { status: 502 });
    }
    if (simular === "intervalo_muito_grande") {
      return NextResponse.json({ erro: simular }, { status: 422 });
    }
    if (ate < de) {
      return NextResponse.json({ error: "Parâmetros inválidos: ate deve ser >= de" }, { status: 400 });
    }
    return NextResponse.json(opcoes.mock(de, ate, simular));
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
    const res = await fetch(`${base.replace(/\/$/, "")}${opcoes.caminho}?${qs}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      // Repassa o status/código do backend quando ele é um erro "de contrato"
      // (400/401/403/422/502); qualquer outro vira 502 com mensagem.
      const conhecido = [400, 401, 403, 422, 502].includes(res.status);
      return NextResponse.json(
        corpo ?? { error: `A API de ${opcoes.rotulo} respondeu ${res.status}.` },
        { status: conhecido ? res.status : 502 },
      );
    }
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar ${opcoes.rotulo}: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
