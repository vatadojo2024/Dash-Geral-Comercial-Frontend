import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { tipoDoAlerta, tiposDoLead } from "./alertas";

function lead(parcial: Partial<LeadListItem>): LeadListItem {
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
    proxima_acao: "Enviar follow-up retomando o último ponto da conversa",
    alertas: [],
    tier_final: "A",
    produto_sugerido: "Black",
    closer_id: "marcio",
    sdr_id: "benhur",
    sdr_pool: false,
    next_call_at: null,
    next_call_numero: null,
    score_calculated_at: "2026-06-11T10:00:00.000Z",
    destaque: false,
    ...parcial,
  };
}

describe("tipoDoAlerta", () => {
  it("categoriza os alertas reais do motor", () => {
    expect(tipoDoAlerta("2 no-shows")).toBe("no_show");
    expect(tipoDoAlerta("Parado há 14 dias")).toBe("parado");
    expect(tipoDoAlerta("Cônjuge/sócio no processo de decisão")).toBe("conjuge_socio");
    expect(tipoDoAlerta("Call em menos de 24h")).toBe("call_proxima");
    expect(tipoDoAlerta("Ciclo longo: 5+ calls")).toBe("ciclo_longo");
    expect(tipoDoAlerta("Urgência baixa declarada")).toBe("urgencia_baixa");
  });

  it("alerta desconhecido não vira categoria", () => {
    expect(tipoDoAlerta("Algo novo do motor")).toBeNull();
  });

  it("tiposDoLead deduplica categorias", () => {
    const l = lead({ alertas: ["2 no-shows", "3 no-shows", "Parado há 7 dias"] });
    expect(tiposDoLead(l)).toEqual(["no_show", "parado"]);
  });
});
