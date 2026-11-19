import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { operadoresDoMes } from "@/lib/mock/operadores_sdr";
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/sdr/operadores?mes=AAAA-MM — os SDRs e as metas do mês (backend
// 4197783, docs/comercial-operadores.md). LEADS_MODE controla a fonte:
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/sdr/operadores com o Bearer.
//     O 503 { erro: "de_para_indisponivel" } segue como veio (a tela avisa, em
//     vez de mostrar uma equipe vazia).
//   - "mock" (default): src/lib/mock/operadores_sdr.ts;
//     `simular=de_para_indisponivel` devolve o 503.
// ---------------------------------------------------------------------------

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const REPASSA = [400, 401, 403, 503];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  if (mes !== null && !RE_MES.test(mes)) {
    return NextResponse.json({ error: "Parâmetro inválido: mes deve ser AAAA-MM." }, { status: 400 });
  }

  if (process.env.LEADS_MODE !== "api") {
    // Mesma trava do backend (área produtividade_sdr), com o mesmo 403.
    const { negado } = await exigirAreaNaApi("produtividade_sdr");
    if (negado) return negado;
    if (searchParams.get("simular") === "de_para_indisponivel") {
      return NextResponse.json({ erro: "de_para_indisponivel" }, { status: 503 });
    }
    const corrente = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
    return NextResponse.json(operadoresDoMes(mes ?? corrente));
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return NextResponse.json({ error: "Configure NEXT_PUBLIC_API_URL no .env para usar LEADS_MODE=api" }, { status: 500 });
  }
  const token = req.headers.get("authorization");
  if (!token) {
    return NextResponse.json({ error: "Sem token da sessão Supabase — faça login novamente." }, { status: 401 });
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/sdr/operadores${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      return NextResponse.json(corpo ?? { error: `A API de operadores respondeu ${res.status}.` }, {
        status: REPASSA.includes(res.status) ? res.status : 502,
      });
    }
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json({ error: `Falha ao consultar operadores: ${e instanceof Error ? e.message : "erro"}` }, { status: 502 });
  }
}
