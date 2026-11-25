import { NextResponse, type NextRequest } from "next/server";
import { podeVerEventosAoVivo } from "@/lib/eventos/comparativo";
import { MENSAGEM_SEM_PERMISSAO } from "@/lib/auth/semPermissao";
import { getServerSession } from "@/lib/auth/session";
import { mockComparativo } from "@/lib/mock/eventos_comparativo";

// ---------------------------------------------------------------------------
// GET /api/eventos/comparativo?de&ate — proxy da aba "Eventos ao Vivo".
// Fonte por LEADS_MODE (api | mock), como as demais rotas de evento. Difere do
// proxyEventos em dois pontos: `de` e `ate` são OPCIONAIS (ausente = a série
// inteira) e o acesso é por PAPEL (só admin), não por área: é a mesma regra
// que o backend aplica no código da rota.
//
// Em mock, `simular=` exercita os estados: nao_autenticado (401),
// sem_permissao (403), comparativo_indisponivel (502); sem_exato, vazio e
// evento_invalido vão para o mock.
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const de = searchParams.get("de") || null;
  const ate = searchParams.get("ate") || null;
  if ((de && !RE_DATA.test(de)) || (ate && !RE_DATA.test(ate))) {
    return NextResponse.json({ error: "Parâmetros inválidos: use o formato AAAA-MM-DD" }, { status: 400 });
  }
  if (de && ate && de > ate) {
    return NextResponse.json({ error: "Parâmetros inválidos: de não pode ser depois de ate" }, { status: 400 });
  }

  if (process.env.LEADS_MODE !== "api") {
    const simular = searchParams.get("simular");
    const user = await getServerSession();
    if (!user || simular === "nao_autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (!podeVerEventosAoVivo(user.role) || simular === "sem_permissao") {
      return NextResponse.json({ error: MENSAGEM_SEM_PERMISSAO }, { status: 403 });
    }
    if (simular === "comparativo_indisponivel") {
      return NextResponse.json({ erro: "comparativo_indisponivel" }, { status: 502 });
    }
    return NextResponse.json(mockComparativo(de, ate, simular));
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
    return NextResponse.json({ error: "Sem token da sessão Supabase — faça login novamente." }, { status: 401 });
  }

  try {
    const qs = new URLSearchParams();
    if (de) qs.set("de", de);
    if (ate) qs.set("ate", ate);
    const sufixo = qs.size ? `?${qs}` : "";
    const res = await fetch(`${base.replace(/\/$/, "")}/api/eventos/comparativo${sufixo}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const conhecido = [400, 401, 403, 502].includes(res.status);
      return NextResponse.json(corpo ?? { error: `A API do comparativo respondeu ${res.status}.` }, {
        status: conhecido ? res.status : 502,
      });
    }
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar o comparativo: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
