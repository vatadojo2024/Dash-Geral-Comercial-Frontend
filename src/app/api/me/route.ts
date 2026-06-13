import { NextResponse, type NextRequest } from "next/server";
import { SessionUserSchema, type Role } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// GET /api/me — proxy server-side para {NEXT_PUBLIC_API_URL}/api/me.
// Descobre o papel/identidade do usuário logado a partir do JWT do Supabase
// (header Authorization: Bearer, anexado pelo client). A chamada à API real é
// server-to-server (sem CORS no navegador). O resultado é normalizado para o
// contrato SessionUser e gravado no cookie de sessão pelo client (login).
//
// Tolerância de campo: a API real pode nomear os campos de formas diferentes
// (name/full_name, papel/tipo, role em pt/en) — normalizamos aqui, num único
// ponto, sem espalhar suposições pelo app.
// ---------------------------------------------------------------------------

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function normalizarRole(raw: unknown): Role | null {
  const v = texto(raw)?.toLowerCase();
  if (!v) return null;
  if (["admin", "administrador", "administrator", "gestor"].includes(v)) return "admin";
  if (["closer", "vendedor", "comercial"].includes(v)) return "closer";
  if (["sdr", "pre-venda", "pré-venda", "pre_venda", "prevenda"].includes(v)) return "sdr";
  return null;
}

function normalizarMe(raw: Record<string, unknown>) {
  const email = texto(raw.email) ?? texto(raw.mail);
  const id =
    texto(raw.id) ?? texto(raw.user_id) ?? texto(raw.uid) ?? texto(raw.sub) ?? email;
  const nome =
    texto(raw.nome) ??
    texto(raw.name) ??
    texto(raw.full_name) ??
    texto(raw.display_name) ??
    (email ? email.split("@")[0] : null);
  const role = normalizarRole(raw.role ?? raw.papel ?? raw.tipo ?? raw.cargo);

  if (!email || !id || !nome || !role) return null;
  return SessionUserSchema.safeParse({ id, nome, email, role });
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Configure NEXT_PUBLIC_API_URL no .env para usar AUTH_MODE=supabase." },
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

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/api/me`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API (/api/me): ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `A API respondeu ${res.status} em /api/me.` },
      { status: res.status === 401 || res.status === 403 ? res.status : 502 },
    );
  }

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = raw && normalizarMe(raw);
  if (!parsed || !parsed.success) {
    return NextResponse.json(
      {
        error:
          "Resposta de /api/me fora do contrato (não foi possível identificar id/nome/email/role).",
      },
      { status: 502 },
    );
  }
  return NextResponse.json(parsed.data);
}
