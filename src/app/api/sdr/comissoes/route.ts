import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { mensagemErroFinanceiro } from "@/lib/sdr/comissoes";
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/sdr/comissoes?mes=AAAA-MM — proxy da aba "Comissões". O total do mês
// de cada SDR vem pronto do Financeiro (backend mapacalor-api).
// LEADS_MODE (mesma env dos leads; mesmo backend) controla a fonte:
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/sdr/comissoes com o Bearer.
//     O 502 { erro: "financeiro_*" } segue com o código e ganha `error` legível.
//   - "mock" (default): fixture com Delrue/Glaucio/Benhur (Arthur sem linha).
//     `simular=vazio|financeiro_sem_token|financeiro_auth|financeiro_indisponivel`.
// ---------------------------------------------------------------------------

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function mockComissoes(mes: string, simular: string | null) {
  const comissoes =
    simular === "vazio"
      ? []
      : [
          { mes, sdr: "Delrue", comissao: 5640 },
          { mes, sdr: "Glaucio", comissao: 3023 },
          { mes, sdr: "Benhur", comissao: 4392 },
        ];
  return { mes, atualizado_em: new Date().toISOString(), comissoes };
}

function erroFinanceiro(corpo: unknown, status: number) {
  const erro = (corpo as { erro?: unknown } | null)?.erro;
  return NextResponse.json(
    {
      ...(typeof erro === "string" ? { erro } : {}),
      error: mensagemErroFinanceiro(erro) ?? `A API de comissões respondeu ${status}.`,
    },
    { status: 502 },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  if (!mes || !RE_MES.test(mes)) {
    return NextResponse.json(
      { error: "Parâmetro inválido: mes deve ser AAAA-MM." },
      { status: 400 },
    );
  }

  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";
  if (modo === "mock") {
    // Mesma trava do backend (área produtividade_sdr), com o mesmo 403.
    const { negado } = await exigirAreaNaApi("produtividade_sdr");
    if (negado) return negado;
    const simular = searchParams.get("simular");
    if (mensagemErroFinanceiro(simular)) {
      return erroFinanceiro({ erro: simular }, 502);
    }
    return NextResponse.json(mockComissoes(mes, simular));
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
      `${base.replace(/\/$/, "")}/api/sdr/comissoes?mes=${encodeURIComponent(mes)}`,
      { headers: { Authorization: token }, cache: "no-store" },
    );
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        return NextResponse.json(
          corpo ?? { error: `A API de comissões respondeu ${res.status}.` },
          { status: res.status },
        );
      }
      return erroFinanceiro(corpo, res.status);
    }
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar comissões: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
