import { describe, expect, it } from "vitest";
import { classeDaGrade, classeDoCard, linhasDosCards } from "./gradeDosCards";

// Cards de SDR: linhas equilibradas, nunca um card sozinho na última linha.

describe("grade dos cards de SDR", () => {
  it("até 4, uma linha; 5 → 2 e 3; 6 → 3 e 3; 7 → 3 e 4; 8 → 4 e 4", () => {
    expect([1, 2, 3, 4].map(linhasDosCards)).toEqual([[1], [2], [3], [4]]);
    expect([5, 6, 7, 8].map(linhasDosCards)).toEqual([
      [2, 3],
      [3, 3],
      [3, 4],
      [4, 4],
    ]);
    // Time maior: no máximo 4 por linha, e nunca uma linha de 1.
    for (let n = 2; n <= 20; n += 1) {
      const linhas = linhasDosCards(n);
      expect(linhas.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.max(...linhas)).toBeLessThanOrEqual(4);
      expect(Math.min(...linhas)).toBeGreaterThan(1);
    }
  });

  it("cada linha ocupa a largura toda (12 colunas), com cards de larguras iguais e na ordem", () => {
    const spans = (n: number) => Array.from({ length: n }, (_, i) => classeDoCard(i, n));
    expect(spans(5)).toEqual(["xl:col-span-6", "xl:col-span-6", "xl:col-span-4", "xl:col-span-4", "xl:col-span-4"]);
    expect(spans(6)).toEqual(Array(6).fill("xl:col-span-4"));
    expect(spans(7)).toEqual([...Array(3).fill("xl:col-span-4"), ...Array(4).fill("xl:col-span-3")]);
    expect(spans(4)).toEqual(["", "", "", ""]);
    expect(classeDaGrade(5)).toContain("xl:grid-cols-12");
    expect(classeDaGrade(5)).toContain("auto-rows-fr");
  });
});
