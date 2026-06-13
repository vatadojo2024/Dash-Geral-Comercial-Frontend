import { describe, expect, it } from "vitest";
import { calcularComissao, projetarComissao } from "./comissao";

// Metas de exemplo do doc oficial (jun/2026)
const METAS_HIGH = { meta1: 260_000, meta2: 320_000 };
const METAS_LOW = { meta1: 75_000, meta2: 85_000 };

describe("calcularComissao — patamares", () => {
  it("abaixo da Meta 1 aplica 3% base", () => {
    const r = calcularComissao({
      volumeVendido: 100_000,
      cashCollected: 100_000,
      ...METAS_HIGH,
    });
    expect(r.patamar).toBe(0);
    expect(r.taxaVigente).toBe(0.03);
    expect(r.comissao).toBe(3_000);
    expect(r.travaDoCaixa).toBe(false);
  });

  it("Meta 1 atingida aplica 5% RETROATIVO sobre todo o volume (ex. do Giba: 80k → 5% dos 80k, não 3% até 75k + 5% do resto)", () => {
    const r = calcularComissao({
      volumeVendido: 80_000,
      cashCollected: 56_000, // 70% ≥ 65%
      ...METAS_LOW,
    });
    expect(r.patamar).toBe(1);
    expect(r.taxaVigente).toBe(0.05);
    expect(r.comissao).toBe(4_000); // 5% × 80k — e NÃO 2.250 + 250 = 2.500 da regra escalonada
    expect(r.travaDoCaixa).toBe(false);
  });

  it("Meta 2 atingida aplica 7% retroativo sobre todo o volume", () => {
    const r = calcularComissao({
      volumeVendido: 330_000,
      cashCollected: 300_000,
      ...METAS_HIGH,
    });
    expect(r.patamar).toBe(2);
    expect(r.taxaVigente).toBe(0.07);
    expect(r.comissao).toBeCloseTo(23_100);
  });

  it("volume exatamente na meta conta como meta atingida", () => {
    const r = calcularComissao({
      volumeVendido: 75_000,
      cashCollected: 75_000,
      ...METAS_LOW,
    });
    expect(r.patamar).toBe(1);
    expect(r.taxaVigente).toBe(0.05);
  });
});

describe("calcularComissao — trava do caixa", () => {
  it("taxa acima de 3% só vale com cash ≥ 65% do volume; senão volta a 3% com aviso", () => {
    const r = calcularComissao({
      volumeVendido: 330_000,
      cashCollected: 190_000, // 57,6% < 65%
      ...METAS_HIGH,
    });
    expect(r.patamar).toBe(2);
    expect(r.taxaPorVolume).toBe(0.07);
    expect(r.travaDoCaixa).toBe(true);
    expect(r.taxaVigente).toBe(0.03);
    expect(r.comissao).toBeCloseTo(9_900);
    expect(r.motivo).toContain("Trava do caixa");
    expect(r.motivo).toContain("65%");
  });

  it("cash exatamente em 65% NÃO aciona a trava", () => {
    const r = calcularComissao({
      volumeVendido: 100_000,
      cashCollected: 65_000,
      ...METAS_LOW,
    });
    expect(r.travaDoCaixa).toBe(false);
    expect(r.taxaVigente).toBe(0.07); // 100k ≥ 85k = Meta 2
  });

  it("a trava nunca afeta quem já está na taxa base", () => {
    const r = calcularComissao({
      volumeVendido: 50_000,
      cashCollected: 0,
      ...METAS_LOW,
    });
    expect(r.travaDoCaixa).toBe(false);
    expect(r.taxaVigente).toBe(0.03);
  });

  it("sem volume vendido, comissão é zero", () => {
    const r = calcularComissao({ volumeVendido: 0, cashCollected: 0, ...METAS_LOW });
    expect(r.comissao).toBe(0);
    expect(r.patamar).toBe(0);
  });
});

describe("projetarComissao — cenários com a carteira", () => {
  it("assume cash proporcional ao percentual atual e recalcula o patamar retroativo", () => {
    // Atual: 60k vendidos com 42k coletados (70%)
    const p = projetarComissao(
      { volumeVendido: 60_000, cashCollected: 42_000, ...METAS_LOW },
      30_000, // fecharia +30k
    );
    expect(p.volumeProjetado).toBe(90_000); // ≥ 85k → Meta 2
    expect(p.cashProjetadoEstimado).toBeCloseTo(63_000); // mantém 70%
    expect(p.resultado.taxaVigente).toBe(0.07);
    expect(p.resultado.comissao).toBeCloseTo(6_300);
  });

  it("projeção herda a trava quando o cash atual está abaixo de 65%", () => {
    const p = projetarComissao(
      { volumeVendido: 100_000, cashCollected: 50_000, ...METAS_LOW }, // 50%
      20_000,
    );
    expect(p.resultado.travaDoCaixa).toBe(true);
    expect(p.resultado.taxaVigente).toBe(0.03);
  });

  it("sem vendas no mês, assume 100% de cash na projeção", () => {
    const p = projetarComissao(
      { volumeVendido: 0, cashCollected: 0, ...METAS_LOW },
      90_000,
    );
    expect(p.resultado.patamar).toBe(2);
    expect(p.resultado.travaDoCaixa).toBe(false);
    expect(p.resultado.comissao).toBeCloseTo(6_300);
  });
});
