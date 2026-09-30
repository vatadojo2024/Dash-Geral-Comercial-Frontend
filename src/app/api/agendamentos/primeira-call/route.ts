import { NextResponse, type NextRequest } from "next/server";
import { modoDosAgendamentos } from "@/lib/agendamentos/modo";
import { veAgendaDeTodos } from "@/lib/agendamentos/primeiraCall";
import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { closersDoMock, mockAgendamentosPrimeiraCall } from "@/lib/mock/agendamentos_primeira_call";
import { adaptApiAgendamentosPrimeiraCall } from "@/lib/server/apiAgendamentosPrimeiraCall";

// ---------------------------------------------------------------------------
// GET /api/agendamentos/primeira-call[?de&ate&closer_id] — única porta da tela
// "Agendamentos — Primeira Call" (somente leitura).
// A fonte segue LEADS_MODE (a mesma env das outras telas); para TESTE LOCAL,
// AGENDAMENTOS_MODE=mock liga o mock SÓ nesta tela (ignorado na Vercel) — ver
// lib/agendamentos/modo.ts.
//   - "mock" (default): fixture com datas relativas a hoje, já no escopo do
//     papel da sessão (closer vê só as próprias; admin e SDR veem todas).
//     `simular=vazio|invalido|erro` exercita os estados.
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/agendamentos/primeira-call
//     com o Bearer da sessão Supabase. O BACKEND filtra por closer.
// Nos dois modos o corpo passa pelo MESMO adapter (validação item a item): um
// agendamento fora do contrato é descartado e logado, nunca derruba a fila.
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const closerId = searchParams.get("closer_id");
  if ((de && !RE_DATA.test(de)) || (ate && !RE_DATA.test(ate)) || (de && ate && ate < de)) {
    return NextResponse.json(
      { error: "Parâmetros inválidos: de e ate devem ser YYYY-MM-DD, com ate >= de." },
      { status: 400 },
    );
  }

  const { modo, mockLocal } = modoDosAgendamentos({
    LEADS_MODE: process.env.LEADS_MODE,
    AGENDAMENTOS_MODE: process.env.AGENDAMENTOS_MODE,
    VERCEL: process.env.VERCEL,
  });

  if (modo === "mock") {
    // Em "api" quem trava a área é o backend (403); no mock, esta rota.
    const { user, negado } = await exigirAreaNaApi("agendamentos");
    if (negado) return negado;
    const simular = searchParams.get("simular");
    if (simular === "erro") {
      return NextResponse.json(
        { error: "A base de agendamentos está indisponível no momento.", erro: "banco_indisponivel" },
        { status: 502 },
      );
    }
    // Mesma regra do backend: closer ignora closer_id e vê só as próprias;
    // admin e SDR veem todas (e podem focar um closer com closer_id).
    const escopo = veAgendaDeTodos(user.role) ? closerId : user.id;
    const corpo = mockAgendamentosPrimeiraCall({ de, ate, closerId: escopo, simular, closers: closersDoMock(user) });
    const adaptado = adaptApiAgendamentosPrimeiraCall(corpo);
    if (!adaptado.ok) {
      return NextResponse.json({ error: `Mock fora do contrato: ${adaptado.motivo}` }, { status: 500 });
    }
    return NextResponse.json({ ...adaptado.resposta, fonte: mockLocal ? "mock_local" : null });
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
    const qs = new URLSearchParams();
    if (de) qs.set("de", de);
    if (ate) qs.set("ate", ate);
    if (closerId) qs.set("closer_id", closerId);
    const sufixo = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`${base.replace(/\/$/, "")}/api/agendamentos/primeira-call${sufixo}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      const corpoErro = (await res.json().catch(() => null)) as { erro?: string; error?: string } | null;
      const indisponivel = corpoErro?.erro === "banco_indisponivel";
      return NextResponse.json(
        {
          error: indisponivel
            ? "A base de agendamentos está indisponível no momento."
            : (corpoErro?.error ?? `A API de agendamentos respondeu ${res.status}.`),
          ...(corpoErro?.erro ? { erro: corpoErro.erro } : {}),
        },
        { status: [400, 401, 403].includes(res.status) ? res.status : 502 },
      );
    }

    const adaptado = adaptApiAgendamentosPrimeiraCall(await res.json().catch(() => null));
    if (!adaptado.ok) {
      return NextResponse.json(
        { error: `A API de agendamentos respondeu em formato inesperado: ${adaptado.motivo}` },
        { status: 502 },
      );
    }
    return NextResponse.json(adaptado.resposta);
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API de agendamentos: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
