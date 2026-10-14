import { NextResponse, type NextRequest } from "next/server";
import { exigirAreaNaApi } from "./acessoApi";

// ---------------------------------------------------------------------------
// Proxies do módulo Educacional (modo `api` do adapter — DESLIGADO enquanto
// NEXT_PUBLIC_EDU_DATA_SOURCE=mock). Trava pela área `educacional` (401/403),
// repassa o Bearer da sessão para {NEXT_PUBLIC_API_URL}/api/educacional/* e
// devolve 400/401/403/404 como vieram; o resto vira 502.
// ---------------------------------------------------------------------------

export async function proxyEducacional(
  req: NextRequest,
  caminho: string,
  init?: { method?: "GET" | "POST" },
): Promise<NextResponse> {
  const { negado } = await exigirAreaNaApi("educacional");
  if (negado) return negado;

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return NextResponse.json({ error: "Configure NEXT_PUBLIC_API_URL." }, { status: 500 });
  const token = req.headers.get("authorization");
  if (!token) return NextResponse.json({ error: "Sem token da sessão — faça login novamente." }, { status: 401 });

  const metodo = init?.method ?? "GET";
  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${caminho}${metodo === "GET" ? qs : ""}`, {
      method: metodo,
      headers: { Authorization: token, ...(metodo === "POST" ? { "Content-Type": "application/json" } : {}) },
      body: metodo === "POST" ? await req.text() : undefined,
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    const repassa = [400, 401, 403, 404].includes(res.status);
    if (!res.ok) {
      return NextResponse.json(corpo ?? { error: `O serviço educacional respondeu ${res.status}.` }, {
        status: repassa ? res.status : 502,
      });
    }
    return NextResponse.json(corpo, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar o serviço educacional: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
