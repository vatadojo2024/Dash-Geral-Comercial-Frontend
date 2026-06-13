import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { rotuloProduto } from "@/lib/config/salesops";
import { potencialPorProduto } from "./potencial";

function lead(produto: string | null): LeadListItem {
  return {
    lead_id: "ld_0001",
    nome_exibicao: "Lead Teste",
    score_final: 80,
    score_bruto: 80,
    temperatura: "quente",
    etapa_atual: "em_atendimento",
    score_momento: 20,
    score_fit: 16,
    score_urgencia: 20,
    score_engajamento: 16,
    score_timing: 8,
    trava_aplicada: null,
    motivo_curto: "Motivo",
    proxima_acao: "Ação",
    alertas: [],
    tier_final: "A",
    produto_sugerido: produto,
    closer_id: "marcio",
    sdr_id: "benhur",
    sdr_pool: false,
    next_call_at: null,
    next_call_numero: null,
    score_calculated_at: "2026-06-11T10:00:00.000Z",
  };
}

describe("potencialPorProduto", () => {
  it("agrega por produto com o valor de tabela da projeção (à vista, variante S)", () => {
    const r = potencialPorProduto([
      lead("Black"),
      lead("Black"),
      lead("Ninja"),
      lead(null),
    ]);
    expect(r.itens).toHaveLength(2);
    const black = r.itens.find((i) => i.chave === "black")!;
    expect(black.leads).toBe(2);
    expect(black.valorUnitario).toBe(25_000);
    expect(black.faturamentoPotencial).toBe(50_000);
    expect(r.totalLeads).toBe(3);
    expect(r.totalFaturamento).toBe(50_000 + 7_000);
    expect(r.semProduto).toBe(1);
  });

  it("ordena por faturamento potencial desc", () => {
    const r = potencialPorProduto([lead("QC"), lead("Private"), lead("Ninja")]);
    expect(r.itens.map((i) => i.chave)).toEqual(["private", "ninja", "qc"]);
  });
});

describe("rotuloProduto (nomenclatura 7.1.3)", () => {
  it("exibe Semestral/Anual no lugar de S/A", () => {
    expect(rotuloProduto("Black A")).toBe("Black Anual");
    expect(rotuloProduto("Ninja S")).toBe("Ninja Semestral");
    expect(rotuloProduto("QC")).toBe("QC");
    expect(rotuloProduto("Private")).toBe("Private");
  });
});
