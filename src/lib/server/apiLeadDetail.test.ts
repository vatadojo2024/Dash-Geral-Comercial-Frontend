import { describe, expect, it, vi } from "vitest";
import { LeadDetailSchema } from "@/lib/api/contracts";
import { adaptApiLeadDetail, parseCorpoLead } from "./apiLeadDetail";

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

  it("aceita o score_breakdown REAL inteiro (travas_ativas = array de objeto {nome,teto}) — a causa do 502", () => {
    // Payload colado do banco: jsonb com avisos/blocos/alertas/financeiro/
    // teto_aplicado/travas_ativas(objeto)/fonte_urgencia. Antes derrubava o lead.
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      trava_aplicada: "urgencia_muito_baixa",
      score_breakdown: {
        avisos: [],
        blocos: { fit: 7, timing: 3, momento: 16, urgencia: 0, engajamento: 0 },
        alertas: ["urgência muito baixa"],
        financeiro: {
          nivel_usado: 3.3000000000000003,
          renda_nivel: 2,
          aporte_nivel: 6,
          patrimonio_nivel: 3,
        },
        teto_aplicado: 65,
        travas_ativas: [{ nome: "urgencia_muito_baixa", teto: 65 }],
        fonte_urgencia: "sdr",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);

    const trava = r.lead.score_breakdown.trava;
    expect(trava).not.toBeNull();
    expect(trava?.teto).toBe(65);
    expect(trava?.tipo).toBe("urgencia_muito_baixa");
    // motivo humanizado para exibição (snake_case → "Urgencia muito baixa"; o
    // acento não vem da chave, e o front só usa travas_ativas, não `alertas`).
    expect(trava?.motivo).toBe("Travas ativas: Urgencia muito baixa.");

    // os 5 blocos seguem corretos
    const fit = r.lead.score_breakdown.blocos.find((b) => b.bloco === "fit");
    expect(fit).toMatchObject({ pontos: 7, teto: 20 });
    const urgencia = r.lead.score_breakdown.blocos.find((b) => b.bloco === "urgencia");
    expect(urgencia).toMatchObject({ pontos: 0, teto: 25 });
  });

  it("trava sem teto_aplicado usa o teto embutido no objeto da trava", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      score_breakdown: {
        ...RESPOSTA_REAL.score_breakdown,
        teto_aplicado: null,
        travas_ativas: [{ nome: "no_show_2x", teto: 60 }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.score_breakdown.trava).toMatchObject({ teto: 60, tipo: "no_show_2x" });
  });

  it("lead QC (produto sem variante) abre: produto efetivo 'qc', sem '- null'", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      id: "lead_qc",
      produto_sugerido: "qc",
      produto_variante: null,
      produto_recomendado: "qc",
      produto_recomendado_variante: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.produto_sugerido).toBe("qc"); // labelProduto traduz p/ "QC" na UI
  });

  it("lê produto_recomendado quando produto_sugerido ausente", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      produto_sugerido: undefined,
      produto_recomendado: "black",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.produto_sugerido).toBe("black");
  });

  it("link_crm não-URL NÃO derruba o lead (vira null, botão some) — a causa do bug QC", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const linkRuim of ["", "/clients/123", "clint.com/x", "nao-url"]) {
      const r = adaptApiLeadDetail({ ...RESPOSTA_REAL, link_crm: linkRuim });
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
      expect(r.lead.link_crm).toBeNull();
    }
    err.mockRestore();
  });

  it("link_crm URL válida é preservada", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      link_crm: "https://app.clint.com/leads/123",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.link_crm).toBe("https://app.clint.com/leads/123");
  });

  it("mapeia a ficha do Clint (texto) e o briefing quando vêm preenchidos", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      renda_faixa: "Entre R$ 11 mil e R$ 25 mil",
      patrimonio_faixa: "Acima de R$ 500 mil",
      profissao: "Médico",
      objetivo_mercado: "Renda passiva",
      desafio_resolver: "Falta de tempo para estudar o mercado",
      briefing: "Resumo:<br/>Decisor confirmado.<br>Evidências: orçamento aprovado.",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
    // Faixa é TEXTO de exibição — não tem relação com o nível numérico do score.
    expect(r.lead.ficha.renda_faixa).toBe("Entre R$ 11 mil e R$ 25 mil");
    expect(r.lead.ficha.patrimonio_faixa).toBe("Acima de R$ 500 mil");
    expect(r.lead.ficha.profissao).toBe("Médico");
    expect(r.lead.ficha.desafio_resolver).toBe("Falta de tempo para estudar o mercado");
    // O adapter guarda o briefing CRU (com <br/>); a conversão é só na UI.
    expect(r.lead.briefing).toContain("<br/>");
  });

  it("ficha tolerante campo-a-campo: nulo/vazio/tipo errado viram null, lead preservado", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      renda_faixa: "Até R$ 5 mil", // ok
      patrimonio_faixa: null, // null → null
      profissao: "   ", // só brancos → null
      investimento_mensal: 1500, // tipo errado (número) → null, NÃO derruba
      momento_atual: "",
      briefing: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
    expect(r.lead.ficha.renda_faixa).toBe("Até R$ 5 mil");
    expect(r.lead.ficha.patrimonio_faixa).toBeNull();
    expect(r.lead.ficha.profissao).toBeNull();
    expect(r.lead.ficha.investimento_mensal).toBeNull();
    expect(r.lead.ficha.momento_atual).toBeNull();
    expect(r.lead.briefing).toBeNull();
  });

  it("ficha toda ausente → todos os campos null e briefing null (ficha vazia)", () => {
    const r = adaptApiLeadDetail(RESPOSTA_REAL); // sem nenhum campo de ficha
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.briefing).toBeNull();
    expect(Object.values(r.lead.ficha).every((v) => v === null)).toBe(true);
  });

  it("conducao_da_call/guia_sdr ausentes (backend ainda não captura) → null, lead preservado", () => {
    const r = adaptApiLeadDetail(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
    expect(r.lead.conducao_da_call).toBeNull();
    expect(r.lead.guia_sdr).toBeNull();
  });

  it("conducao_da_call/guia_sdr presentes são preservados (texto cru com <br/>)", () => {
    const r = adaptApiLeadDetail({
      ...RESPOSTA_REAL,
      conducao_da_call: "Abra com a dor.<br/>Confirme orçamento.",
      guia_sdr: "Qualifique fit antes de agendar.",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.conducao_da_call).toBe("Abra com a dor.<br/>Confirme orçamento.");
    expect(r.lead.guia_sdr).toBe("Qualifique fit antes de agendar.");
  });

  it("falha (erro, não silêncio) quando o corpo não tem o obrigatório", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = adaptApiLeadDetail({ id: "x" }); // sem score_final/temperatura/nome
    expect(r.ok).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("parseCorpoLead (parse tolerante do corpo da API)", () => {
  it("faz o parse normal de um JSON válido", () => {
    expect(parseCorpoLead('{"id":"a","n":1}')).toEqual({ id: "a", n: 1 });
  });

  it("corpo vazio → null", () => {
    expect(parseCorpoLead("")).toBeNull();
  });

  it("REPARA quebras de linha/tab CRUS dentro de strings (a causa do 502)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // JSON com newline e tab REAIS dentro das strings (não-escapados), mas com
    // as aspas internas corretamente escapadas — o que o res.json() rejeitava.
    const corpoQuebrado =
      '{"id":"lead_br","nome_exibicao":"Com BR","score_final":70,"temperatura":"quente",' +
      '"briefing":"Resumo:\nEvidências: ele disse \\"ótimo\\". <br/>",' +
      '"conducao_da_call":"Passo 1\tabrir\nPasso 2"}';

    // res.json() puro falharia aqui:
    expect(() => JSON.parse(corpoQuebrado)).toThrow();

    const corpo = parseCorpoLead(corpoQuebrado) as Record<string, unknown>;
    expect(corpo).not.toBeNull();
    expect(corpo.briefing).toBe('Resumo:\nEvidências: ele disse "ótimo". <br/>');
    expect(corpo.conducao_da_call).toBe("Passo 1\tabrir\nPasso 2");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("o lead reparado passa pelo adaptador e abre (briefing/condução preservados)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const corpoQuebrado =
      '{"id":"lead_br","nome_exibicao":"Com BR","score_final":70,"temperatura":"quente",' +
      '"briefing":"Linha 1\nLinha 2 com \\"aspas\\" <br/>",' +
      '"conducao_da_call":"Conduza\nassim"}';

    const r = adaptApiLeadDetail(parseCorpoLead(corpoQuebrado));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(LeadDetailSchema.safeParse(r.lead).success).toBe(true);
    expect(r.lead.briefing).toContain("<br/>");
    expect(r.lead.briefing).toContain('"aspas"');
    expect(r.lead.conducao_da_call).toContain("Conduza");
    warn.mockRestore();
  });

  it("irrecuperável (aspas de fato não-escapadas) → null, sem lançar", () => {
    // Aspas não-escapadas dentro do valor: ambíguo, não dá para reparar — vira
    // null (a rota então responde com diagnóstico, sem derrubar o processo).
    expect(parseCorpoLead('{"x": "a"b"}')).toBeNull();
  });
});
