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
    destaque: false,
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

describe("indicador de destaque na célula do mapa", () => {
  // A célula precisa saber QUANTOS dos seus leads têm estrela — é o que a grade
  // usa para marcar a coordenada. Destaque é só indicação: não entra em total,
  // score médio nem intensidade.
  it("conta só os leads com destaque da própria célula", () => {
    const comEstrela = (etapa: Etapa, score: number): LeadListItem => ({
      ...lead(etapa, score),
      destaque: true,
    });
    const hm = montarHeatmap([
      comEstrela("2a_call_agendada", 80),
      lead("2a_call_agendada", 76),
      comEstrela("no-show", 78),
    ]);

    const segundaCall = hm.celulas.find(
      (c) => c.grupo.id === "2a_call" && c.temperatura === "quente",
    );
    expect(segundaCall?.total).toBe(2);
    expect(segundaCall?.destaques).toBe(1);
    // O score médio ignora o destaque por completo.
    expect(segundaCall?.scoreMedio).toBe(78);

    const noShow = hm.celulas.find(
      (c) => c.grupo.id === "no_show" && c.temperatura === "quente",
    );
    expect(noShow?.destaques).toBe(1);
  });

  it("célula sem nenhum lead destacado tem destaques = 0", () => {
    const hm = montarHeatmap([lead("1a_call_agendada", 80)]);
    expect(hm.celulas.every((c) => c.destaques === 0)).toBe(true);
  });
});
