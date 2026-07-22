import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/sdr/agendamentos?inicio&fim — proxy da aba "Calls por Ciclo".
// LEADS_MODE (mesma env dos leads; mesmo backend mapacalor-api) controla a fonte:
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/sdr/agendamentos com o Bearer
//     da sessão Supabase (o backend agrega SEM escopo e SEM dado sensível).
//   - "mock" (default): fixture sintético dentro da janela, para a aba renderizar
//     em dev sem depender do backend.
// ---------------------------------------------------------------------------

// Fixture determinístico: espelha a forma da resposta real (SDR×closer×produto),
// com agendado_em dentro do ciclo selecionado. Serve só para demo em modo mock.
function mockAgendamentos(inicio: string, fim: string) {
  const base = [
    { sdr: "Benhur", closer: "Marcio Travassos", produto: "Black", variante: "Anual" },
    { sdr: "Benhur", closer: "Marcio Travassos", produto: "Ninja", variante: "Semestral" },
    { sdr: "Benhur", closer: "Aurelio Mesquita", produto: "Prime", variante: "Anual" },
    { sdr: "Guilherme Delrue", closer: "Marcio Travassos", produto: "Private", variante: "Anual" },
    { sdr: "Guilherme Delrue", closer: "Gilberto", produto: "QC", variante: null },
    { sdr: "Guilherme Delrue", closer: "Aurelio Mesquita", produto: "Black", variante: "Semestral" },
    { sdr: "Glaucio Portela", closer: "Aurelio Mesquita", produto: "Ninja", variante: "Anual" },
    { sdr: "Hana", closer: "Gilberto", produto: null, variante: null },
  ];
  const agendamentos = base.map((b, i) => ({
    lead_id: `mock-${i}`,
    nome_exibicao: `Lead Mock ${i + 1}`,
    sdr_id: b.sdr === "Hana" ? null : `sdr-${i}`,
    sdr_nome: b.sdr,
    closer_id: `clo-${i}`,
    closer_nome: b.closer,
    produto: b.produto,
    produto_variante: b.variante,
    agendado_em: `${inicio}T13:00:00-03:00`,
    data_call: `${fim}T18:00:00-03:00`,
    resolvido: true,
  }));
  return { periodo: { inicio, fim }, total: agendamentos.length, agendamentos };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  if (!inicio || !fim) {
    return NextResponse.json(
      { error: "Parâmetros obrigatórios: inicio e fim (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";
  if (modo === "mock") {
    return NextResponse.json(mockAgendamentos(inicio, fim));
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
    const qs = `inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
    const res = await fetch(`${base.replace(/\/$/, "")}/api/sdr/agendamentos?${qs}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `A API de agendamentos respondeu ${res.status}.` },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 },
      );
    }
    const corpo = await res.json().catch(() => null);
    return NextResponse.json(corpo);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar agendamentos: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
