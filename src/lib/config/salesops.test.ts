import { describe, expect, it } from "vitest";
import { valorDeProjecao } from "./salesops";

// O produto_sugerido real vem verboso (mesma nomenclatura da API de vendas).
// valorDeProjecao deve resolver por substring (como a fila), não lookup exato —
// senão o painel "Potencial da carteira" zera tudo mesmo com produto preenchido.
describe("valorDeProjecao", () => {
  it("resolve nomes verbosos por substring (regressão do painel de carteira)", () => {
    expect(valorDeProjecao("Black Belt Semestral")).toBe(25_000);
    expect(valorDeProjecao("Ninja Anual")).toBe(7_000);
    expect(valorDeProjecao("Prime Semestral")).toBe(68_000);
    expect(valorDeProjecao("Private Anual")).toBe(120_000);
  });

  it("continua resolvendo os nomes bare do mock", () => {
    expect(valorDeProjecao("Black")).toBe(25_000);
    expect(valorDeProjecao("QC")).toBe(1_997);
  });

  it("null/sem produto → null (não soma na projeção)", () => {
    expect(valorDeProjecao(null)).toBeNull();
    expect(valorDeProjecao("")).toBeNull();
  });
});
