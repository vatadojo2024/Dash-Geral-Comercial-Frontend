import { describe, expect, it } from "vitest";
import { conferirPorDia, primeiroNome, rotuloDaDiferenca } from "./conferencia";

const lista = [
  { dia: "2026-09-29", closer_nome: "Marcio Travassos" },
  { dia: "2026-09-29", closer_nome: "Marcio Travassos" },
  { dia: "2026-09-29", closer_nome: "Giba" },
  { dia: "2026-09-30", closer_nome: "Aurélio" },
];
const dashboard = [
  { dia: "2026-09-29", closer: "Marcio", total: 3 },
  { dia: "2026-09-29", closer: "Giba", total: 1 },
  { dia: "2026-09-30", closer: "Aurelio", total: 1 },
  { dia: "2026-10-01", closer: "Marcio", total: 2 },
];

describe("conferência com o Dashboard SDR", () => {
  it("primeiro nome sem acento e sem caixa casa os dois lados", () => {
    expect(primeiroNome("Marcio Travassos")).toBe("marcio");
    expect(primeiroNome("  Aurélio ")).toBe("aurelio");
    expect(primeiroNome(null)).toBe("");
  });

  it("dia a dia: lista × Dashboard, inclusive dia que só existe de um lado", () => {
    expect(conferirPorDia(lista, dashboard)).toEqual([
      { dia: "2026-09-29", lista: 3, dashboard: 4, diferenca: 1 },
      { dia: "2026-09-30", lista: 1, dashboard: 1, diferenca: 0 },
      { dia: "2026-10-01", lista: 0, dashboard: 2, diferenca: 2 },
    ]);
  });

  it("filtro de closer vale para os dois lados", () => {
    expect(conferirPorDia(lista, dashboard, "Marcio Travassos")).toEqual([
      { dia: "2026-09-29", lista: 2, dashboard: 3, diferenca: 1 },
      { dia: "2026-10-01", lista: 0, dashboard: 2, diferenca: 2 },
    ]);
    expect(conferirPorDia(lista, dashboard, "Giba")).toEqual([{ dia: "2026-09-29", lista: 1, dashboard: 1, diferenca: 0 }]);
  });

  it("rótulo da diferença nunca afirma 'faltando'", () => {
    expect(rotuloDaDiferenca({ diferenca: 0 })).toBe("Confere");
    expect(rotuloDaDiferenca({ diferenca: 2 })).toBe("Planilha tem 2 a mais");
    expect(rotuloDaDiferenca({ diferenca: -1 })).toBe("Clint tem 1 a mais");
  });
});
