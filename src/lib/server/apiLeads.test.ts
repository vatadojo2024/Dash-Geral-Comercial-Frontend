import { describe, expect, it, vi } from "vitest";
import { LeadListItemSchema } from "@/lib/api/contracts";
import { adaptApiLeads } from "./apiLeads";

// Payload no formato REAL de GET /api/leads (mapacalor-api.infradojo.pro):
// envelope { leads: [...] }, lista enxuta, com etapa_atual e next_call_at nulos.
const RESPOSTA_REAL = {
  leads: [
    {
      id: "ld_001",
      nome_exibicao: "Fulano de Tal",
      etapa_atual: "em_atendimento",
      score_final: 88,
      temperatura: "quente",
      motivo_curto: "Engajou após a call",
      proxima_acao: "Agendar 2a call",
      alertas: ["call_proxima"],
      next_call_at: "2026-06-16T14:00:00Z",
      no_show_count: 0,
    },
    {
      // Sem nome → nome_exibicao vem como e-mail; etapa e next_call nulos.
      id: "ld_002",
      nome_exibicao: "lead.sem.nome@gmail.com",
      etapa_atual: null,
      score_final: 41,
      temperatura: "frio",
      motivo_curto: "Lead novo, sem interação",
      proxima_acao: "Primeiro contato",
      alertas: [],
      next_call_at: null,
      no_show_count: 2,
    },
  ],
};

describe("adaptApiLeads", () => {
  it("aceita o contrato real (etapa_atual/next_call_at nulos, e-mail no nome) e produz itens válidos", () => {
    const r = adaptApiLeads(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.items).toHaveLength(2);
    // Cada item respeita o contrato do app que o client revalida.
    for (const item of r.items) {
      expect(LeadListItemSchema.safeParse(item).success).toBe(true);
    }

    const [a, b] = r.items;
    expect(a.lead_id).toBe("ld_001"); // id da API vira lead_id
    expect(a.score_bruto).toBe(88); // sem bruto na lista → espelha o final
    expect(b.etapa_atual).toBeNull();
    expect(b.next_call_at).toBeNull();
    expect(b.nome_exibicao).toBe("lead.sem.nome@gmail.com");
    expect(b.sdr_pool).toBe(false);
    expect(b.closer_id).toBeNull();
  });

  it("coage etapa fora do enum para null sem derrubar o lead", () => {
    const r = adaptApiLeads({
      leads: [{ ...RESPOSTA_REAL.leads[0], etapa_atual: "etapa_que_nao_existe" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items).toHaveLength(1);
    expect(r.items[0].etapa_atual).toBeNull();
  });

  it("descarta apenas o lead inválido e mantém os demais (tolerância lead a lead)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = adaptApiLeads({
      leads: [
        RESPOSTA_REAL.leads[0],
        { id: "ld_x", nome_exibicao: "Sem score" }, // falta score_final/temperatura
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items).toHaveLength(1); // o bom sobrevive
    expect(r.items[0].lead_id).toBe("ld_001");
    expect(err).toHaveBeenCalled(); // motivo exato logado
    err.mockRestore();
  });

  it("carrega produto_sugerido e posse quando a lista real os envia (fix do filtro de produto)", () => {
    const r = adaptApiLeads({
      leads: [
        {
          ...RESPOSTA_REAL.leads[0],
          produto_sugerido: "ninja",
          closer_id: "u_giba",
          sdr_id: "u_benhur",
          sdr_pool: true,
          score_bruto: 95,
          tier_final: "A",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [item] = r.items;
    // Antes do fix estes campos eram descartados (null/0/false) e o filtro de
    // produto zerava a lista; agora vêm da API.
    expect(item.produto_sugerido).toBe("ninja");
    expect(item.closer_id).toBe("u_giba");
    expect(item.sdr_id).toBe("u_benhur");
    expect(item.sdr_pool).toBe(true);
    expect(item.score_bruto).toBe(95);
    expect(item.tier_final).toBe("A");
  });

  it("mantém defaults seguros quando a lista é enxuta (sem produto/posse)", () => {
    const r = adaptApiLeads(RESPOSTA_REAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [a] = r.items;
    expect(a.produto_sugerido).toBeNull();
    expect(a.closer_id).toBeNull();
    expect(a.sdr_pool).toBe(false);
  });

  it("rejeita envelope fora do formato { leads: [...] } como erro (não silencioso)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = adaptApiLeads({ items: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("leads");
    err.mockRestore();
  });
});
