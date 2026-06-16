import { NextResponse, type NextRequest } from "next/server";
import { adaptApiUsuarios } from "@/lib/server/apiUsuarios";
import { DEMO_ACCOUNTS } from "@/lib/mock/users";

// ---------------------------------------------------------------------------
// GET /api/usuarios — diretório de usuários (id→nome) para traduzir os UUIDs
// de closer_id/sdr_id em nomes nos dropdowns de filtro, no detalhe do lead e
// onde aparecer um dono. Mesmo gate da fila (LEADS_MODE), pois é onde os UUIDs
// aparecem:
//   - "mock" (default): as 9 contas do time (DEMO_ACCOUNTS).
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/usuarios com o Bearer da
//     sessão Supabase e adapta o envelope real ({ id, nome, papel }) ao
//     contrato enxuto { usuarios: [{ id, nome }] }.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";

  if (modo === "mock") {
    return NextResponse.json({
      usuarios: DEMO_ACCOUNTS.map((u) => ({ id: u.id, nome: u.nome })),
    });
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
    const res = await fetch(`${base.replace(/\/$/, "")}/api/usuarios`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `A API de usuários respondeu ${res.status}.` },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 },
      );
    }

    // Adaptamos o corpo real ao contrato do app em vez de repassar cru — assim
    // variações de envelope/campo da API não derrubam a validação no client.
    const corpo = await res.json().catch(() => null);
    const adaptado = adaptApiUsuarios(corpo);
    if (!adaptado.ok) {
      return NextResponse.json(
        { error: `A API de usuários respondeu em formato inesperado: ${adaptado.motivo}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ usuarios: adaptado.items });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API de usuários: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
