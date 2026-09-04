import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  leadNoEscopo,
  marcarDestaqueMock,
  todosOsLeadsMock,
} from "@/lib/server/mockLeads";

// ---------------------------------------------------------------------------
// PATCH /api/leads/:id/destaque — liga/desliga o destaque manual do lead.
// Mesma arquitetura das demais rotas de lead: LEADS_MODE decide a fonte.
//   - "mock": grava no cache em memória (sobrevive enquanto o dev server vive).
//   - "api": repassa para {NEXT_PUBLIC_API_URL}/api/leads/:id/destaque com o
//     Bearer da sessão Supabase.
//
// Só ADMIN pode marcar. A trava real vive na API (que responde 403); aqui a
// regra é ESPELHADA no ramo mock e o 403 da API é repassado tal e qual no ramo
// api — a UI esconde o switch para closer/SDR, mas nunca confiamos só nisso.
// Destaque é exibição/priorização: não toca em score, não recalcula nada.
// ---------------------------------------------------------------------------

const CorpoSchema = z.object({ destaque: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  try {
    const { leadId } = await params;

    const corpoBruto = await req.json().catch(() => null);
    const corpo = CorpoSchema.safeParse(corpoBruto);
    if (!corpo.success) {
      return NextResponse.json(
        { error: 'Corpo inválido — esperado { "destaque": boolean }.' },
        { status: 400 },
      );
    }

    const modo = process.env.LEADS_MODE === "api" ? "api" : "mock";

    if (modo === "mock") {
      const user = await getServerSession();
      if (!user) {
        return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
      }
      if (user.role !== "admin") {
        return NextResponse.json(
          { error: "Apenas o admin pode destacar leads." },
          { status: 403 },
        );
      }
      const alvo = todosOsLeadsMock().find((l) => l.lead_id === leadId);
      if (!alvo || !leadNoEscopo(alvo, user)) {
        return NextResponse.json(
          { error: "Lead não encontrado ou fora do seu escopo." },
          { status: 404 },
        );
      }
      const lead = marcarDestaqueMock(leadId, corpo.data.destaque, user.id);
      if (!lead) {
        return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
      }
      return NextResponse.json({
        lead: {
          id: lead.lead_id,
          nome_exibicao: lead.nome_exibicao,
          destaque: lead.destaque,
          destaque_por: lead.destaque_por,
          destaque_em: lead.destaque_em,
        },
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

    // Mesma blindagem do GET do detalhe: monta a URL ANTES do fetch para que uma
    // NEXT_PUBLIC_API_URL sem protocolo vire um 500 diagnosticável, não um 502
    // opaco ("no outgoing request").
    let url: string;
    try {
      url = new URL(
        `/api/leads/${encodeURIComponent(leadId)}/destaque`,
        base,
      ).toString();
    } catch {
      console.error(
        `[/api/leads/:id/destaque] NEXT_PUBLIC_API_URL inválida (precisa de protocolo absoluto): ${JSON.stringify(base)}`,
      );
      return NextResponse.json(
        {
          error: `NEXT_PUBLIC_API_URL inválida — use uma URL absoluta com protocolo (ex.: https://host). Valor atual: ${base}`,
        },
        { status: 500 },
      );
    }

    const res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ destaque: corpo.data.destaque }),
      cache: "no-store",
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      // 403 (não-admin) e 404 seguem íntegros até a UI, que reverte o otimista
      // e mostra a mensagem certa. O resto vira 502 com o motivo da API.
      const mensagem =
        (payload as { error?: string } | null)?.error ??
        (res.status === 403
          ? "Apenas o admin pode destacar leads."
          : `A API respondeu ${res.status}.`);
      return NextResponse.json(
        { error: mensagem },
        {
          status:
            res.status === 401 || res.status === 403 || res.status === 404
              ? res.status
              : 502,
        },
      );
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[/api/leads/:id/destaque] erro inesperado no handler:", e);
    return NextResponse.json(
      {
        error: `Falha ao atualizar o destaque: ${e instanceof Error ? e.message : "erro"}`,
      },
      { status: 502 },
    );
  }
}
