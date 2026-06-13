import { describe, expect, it } from "vitest";
import type { SdrMetrics } from "@/lib/data/sdrDashboard";
import { getInsights } from "./insights";

function sdr(parcial: Partial<SdrMetrics> & { sdr: SdrMetrics["sdr"] }): SdrMetrics {
  const produtos = { qc: 0, ninja: 0, black: 0, prime: 0, private: 0, ...parcial.produtos };
  const base: SdrMetrics = {
    sdr: parcial.sdr,
    callsAgendadas: 40,
    callsRealizadas: 32,
    callsRemarcadas: 0,
    noShowCount: 4,
    noShowPct: 10,
    produtos,
    qualificadosBase: 20,
    bonusQC: 0,
    qualificados: 20,
    metas: [40, 50, 60],
    metaAtual: 40,
    nivelAtual: "M1",
    metasBatidas: 0,
    gap: 20,
  };
  return { ...base, ...parcial, produtos };
}

describe("getInsights — regras do original (6.4c)", () => {
  it("risco: SDR com no-show ≥ 20%", () => {
    const r = getInsights([sdr({ sdr: "Glaucio", noShowPct: 22.5 })]);
    const risco = r.filter((i) => i.tipo === "risco");
    expect(risco).toHaveLength(1);
    expect(risco[0].texto).toContain("Glaucio");
    expect(risco[0].texto).toContain("22,5%");
  });

  it("sem risco quando no-show < 20%", () => {
    const r = getInsights([sdr({ sdr: "Glaucio", noShowPct: 19.9 })]);
    expect(r.filter((i) => i.tipo === "risco")).toHaveLength(0);
  });

  it("destaque: SDR mais próximo da meta (menor gap, só quem tem meta)", () => {
    const r = getInsights([
      sdr({ sdr: "Glaucio", gap: 11 }),
      sdr({ sdr: "Delrue", gap: 1 }),
      sdr({ sdr: "Hana", metas: null, metaAtual: null, nivelAtual: null, gap: null }),
    ]);
    const destaque = r.find((i) => i.texto.includes("mais perto da meta"));
    expect(destaque?.texto).toContain("Delrue");
    expect(destaque?.texto).toContain("faltam 1");
  });

  it("destaque: líder em leads qualificados (se > 0)", () => {
    const r = getInsights([
      sdr({ sdr: "Glaucio", qualificados: 29 }),
      sdr({ sdr: "Benhur", qualificados: 42 }),
    ]);
    const lider = r.find((i) => i.texto.includes("lidera em leads qualificados"));
    expect(lider?.texto).toContain("Benhur");
    expect(lider?.texto).toContain("42");
  });

  it("não aponta líder quando ninguém qualificou", () => {
    const r = getInsights([sdr({ sdr: "Glaucio", qualificados: 0 })]);
    expect(r.find((i) => i.texto.includes("lidera"))).toBeUndefined();
  });

  it("destaque: melhor eficiência exige mínimo de 5 realizadas", () => {
    const r = getInsights([
      // 100% de eficiência mas só 2 realizadas → fora
      sdr({ sdr: "Hana", callsRealizadas: 2, qualificados: 2, metas: null, gap: null }),
      sdr({ sdr: "Delrue", callsRealizadas: 40, qualificados: 30 }),
    ]);
    const ef = r.find((i) => i.texto.includes("eficiência"));
    expect(ef?.texto).toContain("Delrue");
    expect(ef?.texto).toContain("75,0%");
  });

  it("ação: taxa de realização < 70% com mínimo de 5 agendadas", () => {
    const r = getInsights([
      sdr({ sdr: "Glaucio", callsAgendadas: 40, callsRealizadas: 20 }), // 50%
      sdr({ sdr: "Delrue", callsAgendadas: 4, callsRealizadas: 1 }), // < 5 agendadas → fora
    ]);
    const acoes = r.filter((i) => i.texto.includes("pré-call"));
    expect(acoes).toHaveLength(1);
    expect(acoes[0].texto).toContain("Glaucio");
  });

  it("ação: SDR a 1 ou 2 QC do próximo bônus", () => {
    const r = getInsights([
      sdr({ sdr: "Glaucio", produtos: { qc: 8, ninja: 0, black: 0, prime: 0, private: 0 } }), // 8 % 3 = 2 → falta 1
      sdr({ sdr: "Delrue", produtos: { qc: 6, ninja: 0, black: 0, prime: 0, private: 0 } }), // múltiplo de 3 → fora
    ]);
    const bonus = r.filter((i) => i.texto.includes("próximo bônus"));
    expect(bonus).toHaveLength(1);
    expect(bonus[0].texto).toContain("Glaucio");
    expect(bonus[0].texto).toContain("a 1 QC");
  });

  it("geral: < 80% vira ação de alerta; ≥ 80% vira destaque de operação saudável", () => {
    const alerta = getInsights([sdr({ sdr: "Glaucio", callsAgendadas: 100, callsRealizadas: 75 })]);
    expect(alerta.find((i) => i.texto.includes("abaixo dos 80%"))?.tipo).toBe("acao");

    const saudavel = getInsights([sdr({ sdr: "Glaucio", callsAgendadas: 100, callsRealizadas: 85 })]);
    expect(saudavel.find((i) => i.texto.includes("Operação saudável"))?.tipo).toBe("destaque");
  });
});
