import { describe, expect, it, vi } from "vitest";
import { LeadDetailSchema } from "@/lib/api/contracts";
import { adaptApiLeadDetail } from "./apiLeadDetail";

// Payload no contrato REAL de GET /api/leads/:id (exemplo do lead Mayron):
// link_crm/analise_call/teto_aplicado/trava_aplicada NULL, analise_sdr com os 3
// campos null (e o nome real sinais_de_risco), blocos como OBJETO, timeline com
// event_type/call_at. Nada disso pode derrubar a tela.
const RESPOSTA_REAL = {
  id: "lead_mayron",
  nome_exibicao: "Mayron",
  telefone: "+55 11 98888-7777",
  email: "mayron@example.com",
  score_final: 72,
  score_bruto: 81,
  score_momento: 18,
  score_fit: 15,
  score_urgencia: 20,
  score_engajamento: 12,
  score_timing: 7,
  trava_aplicada: null,
  score_breakdown: {
    avisos: [],
    blocos: { fit: 15, timing: 7, momento: 18, urgencia: 20, engajamento: 12 },
    alertas: [],
    financeiro: {
      nivel_usado: "renda",
      renda_nivel: 3,
      aporte_nivel: 2,
      patrimonio_nivel: 1,
    },
    teto_aplicado: null,
    travas_ativas: [],
    fonte_urgencia: "call",
  },
  temperatura: "morno_alto",
  motivo_curto: "Engajou após a 1ª call",
  proxima_acao: "Agendar 2ª call",
  alertas: ["call_proxima"],
  score_calculated_at: "2026-06-14T10:00:00Z",
  tier_final: "B",
  produto_sugerido: "ninja",
  produto_variante: "ninja_s",
  etapa_atual: "em_atendimento",
  next_call_at: "2026-06-16T14:00:00Z",
  link_crm: null,
  analise_sdr: { resumo_curto: null, sinais_positivos: null, sinais_de_risco: null },
  analise_call: null,
  timeline: [
    {
      event_type: "call_agendada",
      occurred_at: "2026-06-13T09:00:00Z",
      etapa: "1a_call_agendada",
      call_at: "2026-06-16T14:00:00Z",
    },
    {
      event_type: "entrada",
      occurred_at: "2026-06-10T08:00:00Z",
      etapa: null,
      call_at: null,
    },
  ],
};

describe("adaptApiLeadDetail", () => {
  it("aceita o contrato real (link_crm/trava/analise null, blocos objeto) e satisfaz LeadDetailSchema", () => {
    const r = adaptApiLeadDetail(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // O contrato do app (revalidado no client) tem de passar.
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);

    const d = r.lead;
    expect(d.lead_id).toBe("lead_mayron");
    expect(d.link_crm).toBeNull(); // null real → botão "Abrir na Clint" some
    expect(d.trava_aplicada).toBeNull();
    expect(d.produto_sugerido).toBe("ninja");
    expect(d.etapa_atual).toBe("em_atendimento");

    // analise_sdr com tudo null vira "sem análise" (null), não objeto vazio.
    expect(d.resumo_analises.sdr).toBeNull();
    expect(d.resumo_analises.call).toBeNull();
  });

  it("converte blocos-objeto em array dos 5 blocos com os tetos reais", () => {
    const r = adaptApiLeadDetail(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const blocos = r.lead.score_breakdown.blocos;
    expect(blocos).toHaveLength(5);
    const fit = blocos.find((b) => b.bloco === "fit");
    expect(fit).toMatchObject({ pontos: 15, teto: 20, itens: [] });
    const timing = blocos.find((b) => b.bloco === "timing");
    expect(timing).toMatchObject({ pontos: 7, teto: 10 });
    expect(r.lead.score_breakdown.trava).toBeNull(); // teto_aplicado null + sem travas
  });

  it("mapeia a timeline real (event_type/call_at) para o contrato do app", () => {
    const r = adaptApiLeadDetail(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.lead.timeline).toHaveLength(2);
    const [primeiro] = r.lead.timeline;
    expect(primeiro.tipo).toBe("call_agendada");
    expect(primeiro.occurred_at).toBe("2026-06-13T09:00:00Z");
    expect(primeiro.event_id).toBeTruthy();
    expect(primeiro.descricao).toContain("Call agendada");
  });

  it("não quebra com timeline vazia nem com analise_sdr preenchida (sinais_de_risco)", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      timeline: [],
      analise_sdr: {
        resumo_curto: "Lead qualificado, decisor confirmado.",
        sinais_positivos: ["decisor", "orçamento"],
        sinais_de_risco: ["timing"],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.timeline).toEqual([]);
    expect(r.lead.resumo_analises.sdr).not.toBeNull();
    expect(r.lead.resumo_analises.sdr?.sinais_risco).toEqual(["timing"]);
    expect(r.lead.resumo_analises.sdr?.sinais_positivos).toEqual(["decisor", "orçamento"]);
  });

  it("trata campos opcionais AUSENTES como ausentes, sem derrubar o detalhe", () => {
    // Corpo mínimo: só o obrigatório. Tudo o mais ausente.
    const r = adaptApiLeadDetail({
      id: "lead_min",
      nome_exibicao: "Mínimo",
      score_final: 30,
      temperatura: "frio",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
    expect(r.lead.score_bruto).toBe(30); // sem bruto → espelha o final
    expect(r.lead.link_crm).toBeNull();
    expect(r.lead.telefone).toBe("");
    expect(r.lead.timeline).toEqual([]);
    expect(r.lead.score_breakdown.blocos).toHaveLength(5);
  });

  it("monta a trava quando teto_aplicado/travas_ativas vêm preenchidos", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      trava_aplicada: "teto_renda",
      score_breakdown: {
        ...RESPOSTA_REAL.score_breakdown,
        teto_aplicado: 60,
        travas_ativas: ["teto_renda"],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.score_breakdown.trava).toMatchObject({ teto: 60, tipo: "teto_renda" });
  });

  it("falha (erro, não silêncio) quando o corpo não tem o obrigatório", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = adaptApiLeadDetail({ id: "x" }); // sem score_final/temperatura/nome
    expect(r.ok).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
