import { describe, expect, it } from "vitest";
import { calcularComissaoSdr, type EntradaComissaoSdr } from "./comissaoSdr";

const METAS = [40, 50, 60];

function entrada(parcial: Partial<EntradaComissaoSdr>): EntradaComissaoSdr {
  return {
    reunioesQualificadas: 30,
    qualificadosParaMeta: 30,
    callsQC: 0,
    volumeVendas: 100_000,
    metas: METAS,
    ...parcial,
  };
}

describe("calcularComissaoSdr — os 4 patamares", () => {
  it("abaixo da M1: R$ 40/reunião + 0,7% por venda", () => {
    const r = calcularComissaoSdr(entrada({ qualificadosParaMeta: 39 }));
    expect(r.patamar).toBe(0);
    expect(r.valorPorReuniao).toBe(40);
    expect(r.comissaoReunioes).toBe(30 * 40);
    expect(r.comissaoVendas).toBeCloseTo(700);
    expect(r.total).toBeCloseTo(1200 + 700);
  });

  it("M1 atingida (40): R$ 60/reunião + 1,2%", () => {
    const r = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 40, qualificadosParaMeta: 40 }),
    );
    expect(r.patamar).toBe(1);
    expect(r.valorPorReuniao).toBe(60);
    expect(r.comissaoReunioes).toBe(40 * 60);
    expect(r.comissaoVendas).toBeCloseTo(1200);
  });

  it("M2 atingida (50): R$ 80/reunião + 1,8%", () => {
    const r = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 50, qualificadosParaMeta: 52 }),
    );
    expect(r.patamar).toBe(2);
    expect(r.valorPorReuniao).toBe(80);
    expect(r.taxaVenda).toBeCloseTo(0.018);
  });

  it("M3 atingida (60): R$ 100/reunião + 2,5%", () => {
    const r = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 58, qualificadosParaMeta: 61 }),
    );
    expect(r.patamar).toBe(3);
    expect(r.valorPorReuniao).toBe(100);
    expect(r.taxaVenda).toBeCloseTo(0.025);
    expect(r.proximaMeta).toBeNull();
  });
});

describe("retroatividade", () => {
  it("cruzar a M1 recalcula TODAS as reuniões e vendas do mês na taxa nova", () => {
    const antes = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 39, qualificadosParaMeta: 39 }),
    );
    const depois = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 40, qualificadosParaMeta: 40 }),
    );
    // 39ª reunião: 39×40 = 1560; 40ª: 40×60 = 2400 — salto retroativo > R$ 800
    expect(antes.comissaoReunioes).toBe(1560);
    expect(depois.comissaoReunioes).toBe(2400);
    expect(depois.comissaoVendas).toBeCloseTo(100_000 * 0.012);
  });

  it("o bônus de meta (+1 a cada 3 QC) conta para o PATAMAR, não para o nº de reuniões pagas", () => {
    // 38 reuniões Ninja+ e 6 QC → bônus 2 → 40 para a meta (M1). As reuniões
    // pagas continuam 38, na taxa retroativa de R$ 60.
    const r = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 38, qualificadosParaMeta: 40, callsQC: 6 }),
    );
    expect(r.patamar).toBe(1);
    expect(r.comissaoReunioes).toBe(38 * 60);
  });

  it("projeção 'se bater a próxima meta' usa as mesmas quantidades na taxa do próximo patamar", () => {
    const r = calcularComissaoSdr(
      entrada({ reunioesQualificadas: 45, qualificadosParaMeta: 45, callsQC: 3 }),
    );
    expect(r.patamar).toBe(1);
    expect(r.proximaMeta?.meta).toBe(50);
    expect(r.proximaMeta?.comissaoReunioes).toBe(45 * 80);
    expect(r.proximaMeta?.comissaoVendas).toBeCloseTo(100_000 * 0.018);
    expect(r.proximaMeta?.bonusQC).toBe(20);
  });
});

describe("bônus QC", () => {
  it("R$ 20 a cada 3 calls QC (floor)", () => {
    expect(calcularComissaoSdr(entrada({ callsQC: 0 })).bonusQC).toBe(0);
    expect(calcularComissaoSdr(entrada({ callsQC: 2 })).bonusQC).toBe(0);
    expect(calcularComissaoSdr(entrada({ callsQC: 3 })).bonusQC).toBe(20);
    expect(calcularComissaoSdr(entrada({ callsQC: 8 })).bonusQC).toBe(40);
    expect(calcularComissaoSdr(entrada({ callsQC: 9 })).bonusQC).toBe(60);
  });

  it("o bônus QC não muda com o patamar", () => {
    const p0 = calcularComissaoSdr(entrada({ callsQC: 9, qualificadosParaMeta: 10 }));
    const p3 = calcularComissaoSdr(entrada({ callsQC: 9, qualificadosParaMeta: 70 }));
    expect(p0.bonusQC).toBe(60);
    expect(p3.bonusQC).toBe(60);
  });
});

// Validação oficial (It3 item 5) — junho/2026, números do mock engenheirado:
// a comissão de reuniões paga as qualificadas BASE; o patamar vem dos
// qualificados COM bônus de meta; bônus QC usa o QC real de cada SDR.
describe("validação junho/2026 (exemplos oficiais)", () => {
  it("Glaucio: 25 base, 29 p/ meta (<M1), QC 14 → R$ 1.080 + 0,7% das vendas (R$ 51.000)", () => {
    const r = calcularComissaoSdr({
      reunioesQualificadas: 25,
      qualificadosParaMeta: 29,
      callsQC: 14,
      volumeVendas: 51_000,
      metas: METAS,
    });
    expect(r.patamar).toBe(0);
    expect(r.comissaoReunioes).toBe(25 * 40); // 1.000
    expect(r.bonusQC).toBe(80); // ⌊14/3⌋ = 4 × 20
    expect(r.comissaoReunioes + r.bonusQC).toBe(1_080);
    expect(r.comissaoVendas).toBeCloseTo(357); // 0,7% de 51.000
    expect(r.total).toBeCloseTo(1_437);
  });

  it("Delrue: 36 base, 39 p/ meta (<M1), QC 9 → R$ 1.500 + 0,7% das vendas (R$ 68.000)", () => {
    const r = calcularComissaoSdr({
      reunioesQualificadas: 36,
      qualificadosParaMeta: 39,
      callsQC: 9,
      volumeVendas: 68_000,
      metas: METAS,
    });
    expect(r.patamar).toBe(0);
    expect(r.comissaoReunioes).toBe(36 * 40); // 1.440
    expect(r.bonusQC).toBe(60); // ⌊9/3⌋ = 3 × 20
    expect(r.comissaoReunioes + r.bonusQC).toBe(1_500);
    expect(r.comissaoVendas).toBeCloseTo(476);
    expect(r.total).toBeCloseTo(1_976);
  });

  it("Benhur: 38 base, 42 p/ meta (≥M1 RETROATIVO), QC 12 → R$ 2.360 + 1,2% das vendas (R$ 37.000)", () => {
    const r = calcularComissaoSdr({
      reunioesQualificadas: 38,
      qualificadosParaMeta: 42,
      callsQC: 12,
      volumeVendas: 37_000,
      metas: METAS,
    });
    expect(r.patamar).toBe(1);
    expect(r.valorPorReuniao).toBe(60); // retroativo sobre TODAS as 38
    expect(r.comissaoReunioes).toBe(38 * 60); // 2.280
    expect(r.bonusQC).toBe(80); // ⌊12/3⌋ = 4 × 20
    expect(r.comissaoReunioes + r.bonusQC).toBe(2_360);
    expect(r.comissaoVendas).toBeCloseTo(444); // 1,2% de 37.000
    expect(r.total).toBeCloseTo(2_804);
  });

  it("projeção do Glaucio 'se bater a M1': mesmas 25 reuniões base a R$ 60 + 1,2%", () => {
    const r = calcularComissaoSdr({
      reunioesQualificadas: 25,
      qualificadosParaMeta: 29,
      callsQC: 14,
      volumeVendas: 51_000,
      metas: METAS,
    });
    expect(r.proximaMeta?.meta).toBe(40);
    expect(r.proximaMeta?.comissaoReunioes).toBe(25 * 60); // 1.500
    expect(r.proximaMeta?.bonusQC).toBe(80);
    expect(r.proximaMeta?.comissaoVendas).toBeCloseTo(612); // 1,2% de 51.000
    expect(r.proximaMeta?.total).toBeCloseTo(2_192);
  });
});

describe("Hana — sem comissão", () => {
  it("metas null zera tudo e marca semComissao", () => {
    const r = calcularComissaoSdr(
      entrada({ metas: null, reunioesQualificadas: 20, volumeVendas: 50_000 }),
    );
    expect(r.semComissao).toBe(true);
    expect(r.total).toBe(0);
    expect(r.proximaMeta).toBeNull();
  });
});
