import { NextResponse, type NextRequest } from "next/server";
import { modoDosAgendamentos } from "@/lib/agendamentos/modo";
import { primeiroNome } from "@/lib/agendamentos/conferencia";
import { veAgendaDeTodos } from "@/lib/agendamentos/primeiraCall";
import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { closersDoMock, mockAgendamentosPrimeiraCall } from "@/lib/mock/agendamentos_primeira_call";

// ---------------------------------------------------------------------------
// GET /api/agendamentos/conferencia?de&ate — total de agendamentos por dia e
// por closer na MESMA API do Dashboard SDR (Dashboard Comercial,
// /api/closer/agendadas), para conferir a fila de Agendamentos. A chave da API
// fica só no servidor (SDR_DASHBOARD_API_URL / SDR_DASHBOARD_API_KEY, as mesmas
// do Dashboard SDR).
// Escopo: closer vê só as próprias linhas (pelo primeiro nome da sessão);
// admin e SDR veem todas. Acesso: área `agendamentos` (esta rota não passa pela
// API do Mapa de Calor, então a trava por área é daqui).
// Modo: segue o da tela de Agendamentos (lib/agendamentos/modo). Em mock, os
// totais saem do próprio mock da fila, com uma divergência de propósito para a
// tela ter o que mostrar.
// ---------------------------------------------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { user, negado } = await exigirAreaNaApi("agendamentos");
  if (negado) return negado;

  const { searchParams } = new URL(req.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  if (!de || !ate || !RE_DATA.test(de) || !RE_DATA.test(ate) || ate < de) {
    return NextResponse.json({ error: "Parâmetros inválidos: de e ate (YYYY-MM-DD), com ate >= de." }, { status: 400 });
  }

  const doUsuario = (closer: string) => veAgendaDeTodos(user.role) || primeiroNome(closer) === primeiroNome(user.nome);
  const { modo } = modoDosAgendamentos({
    LEADS_MODE: process.env.LEADS_MODE,
    AGENDAMENTOS_MODE: process.env.AGENDAMENTOS_MODE,
    VERCEL: process.env.VERCEL,
  });

  if (modo === "mock") {
    const corpo = mockAgendamentosPrimeiraCall({ de, ate, closers: closersDoMock(user) });
    const contagem = new Map<string, { dia: string; closer: string; total: number }>();
    for (const a of corpo.agendamentos as { call_at: string; closer_nome: string | null }[]) {
      const dia = a.call_at.slice(0, 10);
      const closer = primeiroNome(a.closer_nome) || "sem closer";
      const chave = `${dia}|${closer}`;
      const atual = contagem.get(chave) ?? { dia, closer: a.closer_nome?.split(" ")[0] ?? "Sem closer", total: 0 };
      atual.total += 1;
      contagem.set(chave, atual);
    }
    const linhas = [...contagem.values()].sort((a, b) => a.dia.localeCompare(b.dia));
    // Divergência de demonstração: o 2º dia com calls tem 1 a mais no "Dashboard".
    if (linhas[1]) linhas[1] = { ...linhas[1], total: linhas[1].total + 1 };
    return NextResponse.json({
      de,
      ate,
      linhas: linhas.filter((l) => doUsuario(l.closer)),
      fonte: "mock",
      gerado_em: new Date().toISOString(),
    });
  }

  const base = process.env.SDR_DASHBOARD_API_URL;
  const chave = process.env.SDR_DASHBOARD_API_KEY;
  if (!base || !chave) {
    return NextResponse.json(
      { error: "Configure SDR_DASHBOARD_API_URL e SDR_DASHBOARD_API_KEY (as mesmas do Dashboard SDR)." },
      { status: 500 },
    );
  }
  try {
    const qs = `data_inicio=${encodeURIComponent(de)}&data_fim=${encodeURIComponent(ate)}`;
    const res = await fetch(`${base.replace(/\/$/, "")}/api/closer/agendadas?${qs}`, {
      headers: { "X-API-Key": chave, Authorization: `Bearer ${chave}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `A API do Dashboard SDR respondeu ${res.status}.` }, { status: 502 });
    }
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!Array.isArray(corpo)) {
      return NextResponse.json({ error: "A API do Dashboard SDR respondeu fora do formato esperado." }, { status: 502 });
    }
    // Tolerância linha a linha: linha sem data/closer/total válidos é ignorada.
    const linhas = corpo.flatMap((x) => {
      const l = x as { data_referencia?: unknown; closer?: unknown; total_agendadas?: unknown };
      const dia = typeof l.data_referencia === "string" ? l.data_referencia.slice(0, 10) : "";
      if (!RE_DATA.test(dia) || typeof l.closer !== "string" || typeof l.total_agendadas !== "number") return [];
      if (dia < de || dia > ate || !doUsuario(l.closer)) return [];
      return [{ dia, closer: l.closer, total: Math.max(0, Math.round(l.total_agendadas)) }];
    });
    return NextResponse.json({ de, ate, linhas, fonte: "dashboard_sdr", gerado_em: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API do Dashboard SDR: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
