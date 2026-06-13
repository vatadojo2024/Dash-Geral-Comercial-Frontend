import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { agruparAgenda, rotuloDoDia } from "./agenda";

function lead(parcial: Partial<LeadListItem>): LeadListItem {
  return {
    lead_id: "ld_0001",
    nome_exibicao: "Lead Teste",
    score_final: 80,
    score_bruto: 80,
    temperatura: "quente",
    etapa_atual: "2a_call_agendada",
    score_momento: 20,
    score_fit: 16,
    score_urgencia: 20,
    score_engajamento: 16,
    score_timing: 8,
    trava_aplicada: null,
    motivo_curto: "Motivo",
    proxima_acao: "Preparar a 2ª call",
    alertas: [],
    tier_final: "A",
    produto_sugerido: "Black",
    closer_id: "marcio",
    sdr_id: "benhur",
    sdr_pool: false,
    next_call_at: "2026-06-11T17:00:00.000Z",
    next_call_numero: 2,
    score_calculated_at: "2026-06-11T10:00:00.000Z",
    ...parcial,
  };
}

describe("rotuloDoDia", () => {
  it("identifica hoje, amanhã e demais dias (com virada de mês)", () => {
    expect(rotuloDoDia("2026-06-11", "2026-06-11")).toBe("Hoje");
    expect(rotuloDoDia("2026-06-12", "2026-06-11")).toBe("Amanhã");
    expect(rotuloDoDia("2026-07-01", "2026-06-30")).toBe("Amanhã");
    expect(rotuloDoDia("2026-06-19", "2026-06-11")).toMatch(/·\s*19\/06/);
  });
});

describe("agruparAgenda", () => {
  it("ordena por data/hora, agrupa por dia e ignora leads sem call ou inativos", () => {
    const grupos = agruparAgenda(
      [
        lead({ lead_id: "c", next_call_at: "2026-06-12T13:00:00.000Z" }),
        lead({ lead_id: "a", next_call_at: "2026-06-11T15:00:00.000Z" }),
        lead({ lead_id: "b", next_call_at: "2026-06-11T19:30:00.000Z" }),
        lead({ lead_id: "x", next_call_at: null, next_call_numero: null }),
        lead({ lead_id: "y", etapa_atual: "blacklist" }),
      ],
      "2026-06-11",
    );
    expect(grupos).toHaveLength(2);
    expect(grupos[0].leads.map((l) => l.lead_id)).toEqual(["a", "b"]);
    expect(grupos[1].leads.map((l) => l.lead_id)).toEqual(["c"]);
  });
});
