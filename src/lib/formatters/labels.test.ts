import { describe, expect, it } from "vitest";
import { labelProduto, labelTier, labelTrava } from "./labels";

describe("labelTier", () => {
  it("traduz os tiers conhecidos (mock A/B/C e real sem_qualificacao)", () => {
    expect(labelTier("A")).toBe("Tier A");
    expect(labelTier("sem_qualificacao")).toBe("Sem qualificação");
  });
  it("humaniza desconhecido e trata vazio", () => {
    expect(labelTier("tier_ouro")).toBe("Tier ouro");
    expect(labelTier(null)).toBe("Sem tier");
  });
});

describe("labelProduto", () => {
  it("resolve bare e verboso para a marca capitalizada", () => {
    expect(labelProduto("private")).toBe("Private");
    expect(labelProduto("Black Belt Semestral")).toBe("Black");
    expect(labelProduto(null)).toBeNull();
  });
});

describe("labelTrava", () => {
  it("passa frase legível e humaniza código", () => {
    expect(labelTrava("2 no-shows — teto de 60 aplicado")).toBe(
      "2 no-shows — teto de 60 aplicado",
    );
    expect(labelTrava("teto_60")).toBe("Teto 60");
    expect(labelTrava(null)).toBeNull();
  });
});
