import { describe, expect, it } from "vitest";
import type { Etapa, LeadListItem } from "@/lib/api/contracts";
import { GRUPOS_ETAPA_HEATMAP } from "@/lib/formatters/score";
import { montarHeatmap } from "./derivacoes";

// Lead mínimo para o heatmap: só temperatura/etapa/score importam aqui.
function lead(etapa: Etapa | null, score = 50): LeadListItem {
  return {
    lead_id: `ld_${etapa ?? "nula"}_${score}`,
    nome_exibicao: "Lead",
    score_final: score,
    score_bruto: score,
    temperatura: "quente",
    etapa_atual: etapa,
    score_momento: 0,
    score_fit: 0,
    score_urgencia: 0,
    score_engajamento: 0,
    score_timing: 0,
    trava_aplicada: null,
    motivo_curto: "",
    proxima_acao: "",
    alertas: [],
    tier_final: "A",
    produto_sugerido: null,
    closer_id: null,
    sdr_id: null,
    sdr_pool: false,
    next_call_at: null,
    next_call_numero: null,
    score_calculated_at: "2026-06-20T10:00:00.000Z",
  };
}

function totalDoGrupo(heatmap: ReturnType<typeof montarHeatmap>, grupoId: string): number {
  return heatmap.celulas
    .filter((c) => c.grupo.id === grupoId)
    .reduce((soma, c) => soma + c.total, 0);
}

describe("buckets do mapa de calor (re-bucketing)", () => {
  it("colunas na ordem do funil, sem FUP, com 3ª call e 4ª+ call", () => {
    expect(GRUPOS_ETAPA_HEATMAP.map((g) => g.label)).toEqual([
      "1ª call",
      "Em atendimento",
      "2ª call",
      "3ª call",
      "4ª+ call",
      "No-show",
    ]);
    // FUP não é mais coluna.
    expect(GRUPOS_ETAPA_HEATMAP.some((g) => g.id === "fup")).toBe(false);
  });

  it("'3ª call' pega SÓ a 3ª; '4ª+ call' pega 4ª e 5ª+ — nenhum lead órfão", () => {
    const leads = [
      lead("3a_call_agendada"),
      lead("3a_call_agendada"),
      lead("4a_call_agendada"),
      lead("5a_mais_call_agendada"),
    ];
    const hm = montarHeatmap(leads);

    expect(totalDoGrupo(hm, "3a_call")).toBe(2); // só as 3ª
    expect(totalDoGrupo(hm, "4a_mais")).toBe(2); // 4ª + 5ª+

    // Todos os 4 leads que caíam em "3ª+ call" continuam na grade (nada some).
    expect(hm.foraDaGrade).toBe(0);
  });

  it("leads em FUP saem da grade (coluna repurposada), sem quebrar nada", () => {
    const hm = montarHeatmap([
      lead("fup_pos_pitch"),
      lead("fup_infinito_perdido"),
      lead("3a_call_agendada"),
    ]);
    // Sem coluna FUP: os 2 FUP contam como "fora da grade"; a 3ª call fica.
    expect(totalDoGrupo(hm, "3a_call")).toBe(1);
    expect(hm.foraDaGrade).toBe(2);
  });
});
