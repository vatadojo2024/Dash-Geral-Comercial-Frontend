import { NextResponse, type NextRequest } from "next/server";
import {
  NUMERO_DA_PRIMEIRA_CALL,
  queryDoHistorico,
  soPrimeiraCall,
  type FiltrosHistorico,
} from "@/lib/agendamentos/historico";
import { modoDosAgendamentos } from "@/lib/agendamentos/modo";
import { MENSAGEM_SEM_PERMISSAO } from "@/lib/auth/semPermissao";
import { mockAgendamentosHistorico } from "@/lib/mock/agendamentos_historico";
import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { adaptApiAgendamentosHistorico } from "@/lib/server/apiAgendamentosHistorico";

// ---------------------------------------------------------------------------
// GET /api/agendamentos/historico[?de&ate&antes_de&limite&numero_call&incluir_sem_data]
// — única porta da tela "Histórico de agendamentos" (só admin: área
// `historico_agendamentos`). Somente leitura. SÓ PRIMEIRA CALL: a rota pede
// numero_call=1 à API e ainda filtra a resposta (2ª call em diante nunca passa).
// A fonte segue a da tela de Agendamentos (lib/agendamentos/modo):
//   - "mock": fixture com datas relativas a agora, mesmas regras do backend
//     (ordem, cursor, total). `simular=vazio|erro` exercita os estados.
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/agendamentos/historico com
//     o Bearer da sessão. O BACKEND trava a área (403).
// Nos dois modos o corpo passa pelo MESMO adapter (validação item a item).
// ---------------------------------------------------------------------------

function iso(v: string | null): boolean {
  return v == null || !Number.isNaN(Date.parse(v));
}

function lerFiltros(sp: URLSearchParams): FiltrosHistorico | string {
  const de = sp.get("de");
  const ate = sp.get("ate");
  const antesDe = sp.get("antes_de");
  if (!iso(de) || !iso(ate) || !iso(antesDe)) return "de, ate e antes_de devem ser datas ISO 8601.";
  const limiteTxt = sp.get("limite");
  const limite = limiteTxt == null ? undefined : Number(limiteTxt);
  if (limite !== undefined && (!Number.isInteger(limite) || limite < 1 || limite > 500)) {
    return "limite deve ser um inteiro de 1 a 500.";
  }
  const semData = sp.get("incluir_sem_data");
  if (semData != null && semData !== "true" && semData !== "false") return "incluir_sem_data deve ser true ou false.";
  // Só primeira call, sempre: o `numero_call` da URL é ignorado de propósito.
  return { de, ate, antesDe, limite, numeroCall: NUMERO_DA_PRIMEIRA_CALL, incluirSemData: semData !== "false" };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filtros = lerFiltros(searchParams);
  if (typeof filtros === "string") {
    return NextResponse.json({ error: `Parâmetros inválidos: ${filtros}` }, { status: 400 });
  }

  const { modo, mockLocal } = modoDosAgendamentos({
    LEADS_MODE: process.env.LEADS_MODE,
    AGENDAMENTOS_MODE: process.env.AGENDAMENTOS_MODE,
    VERCEL: process.env.VERCEL,
  });

  if (modo === "mock") {
    // Em "api" quem trava a área é o backend (403); no mock, esta rota.
    const { negado } = await exigirAreaNaApi("historico_agendamentos");
    if (negado) return negado;
    const simular = searchParams.get("simular");
    if (simular === "erro") {
      return NextResponse.json(
        { error: "O histórico de agendamentos está indisponível no momento.", erro: "historico_indisponivel" },
        { status: 502 },
      );
    }
    const adaptado = adaptApiAgendamentosHistorico(mockAgendamentosHistorico({ ...filtros, simular }));
    if (!adaptado.ok) {
      return NextResponse.json({ error: `Mock fora do contrato: ${adaptado.motivo}` }, { status: 500 });
    }
    return NextResponse.json({ ...soPrimeiraCall(adaptado.resposta), fonte: mockLocal ? "mock_local" : null });
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
    const qs = queryDoHistorico(filtros);
    const res = await fetch(`${base.replace(/\/$/, "")}/api/agendamentos/historico${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    if (!res.ok) {
      const corpoErro = (await res.json().catch(() => null)) as { erro?: string; error?: string } | null;
      const mensagem =
        corpoErro?.erro === "historico_indisponivel"
          ? "O histórico de agendamentos está indisponível no momento."
          : res.status === 403
            ? (corpoErro?.error ?? MENSAGEM_SEM_PERMISSAO)
            : (corpoErro?.error ?? `A API do histórico respondeu ${res.status}.`);
      return NextResponse.json(
        { error: mensagem, ...(corpoErro?.erro ? { erro: corpoErro.erro } : {}) },
        { status: [400, 401, 403].includes(res.status) ? res.status : 502 },
      );
    }

    const adaptado = adaptApiAgendamentosHistorico(await res.json().catch(() => null));
    if (!adaptado.ok) {
      return NextResponse.json(
        { error: `A API do histórico respondeu em formato inesperado: ${adaptado.motivo}` },
        { status: 502 },
      );
    }
    return NextResponse.json(soPrimeiraCall(adaptado.resposta));
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API do histórico: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
