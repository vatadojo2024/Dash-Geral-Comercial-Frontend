import { describe, expect, it, vi } from "vitest";
import { mapVendasComercial } from "./apiVendas";

// Linha real da Dashboard Comercial (formato confirmado via API em jun/2026).
function linha(over: Record<string, unknown> = {}) {
  return {
    id: 520,
    data_referencia: "2026-06-04",
    closer: "Marcio",
    produto: "Black Belt Semestral",
    total_vendas: 1,
    total_faturado: 23000.0,
    total_entrada: 2300.0,
    created_at: "2026-06-16T14:54:16.940124",
    ...over,
  };
}

describe("mapVendasComercial", () => {
  it("mapeia os campos reais (faturado/entrada/quantidade/data/nome/produto)", () => {
    const [v] = mapVendasComercial([linha()], "closer", "t");
    expect(v).toEqual({
      nome: "Marcio",
      data: "2026-06-04",
      produto: "Black Belt Semestral",
      faturado: 23000,
      entrada: 2300,
      quantidade: 1,
    });
  });

  it("lê o nome do campo certo (sdr) quando pedido", () => {
    const [v] = mapVendasComercial(
      [linha({ closer: undefined, sdr: "Glaucio" })],
      "sdr",
      "t",
    );
    expect(v.nome).toBe("Glaucio");
  });

  it("descarta linha sem valor/data e NÃO zera silenciosamente (loga)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const linhas = mapVendasComercial(
      [
        linha(),
        linha({ total_faturado: null }), // sem valor → descartada
        linha({ data_referencia: null }), // sem data → descartada
      ],
      "closer",
      "t",
    );
    expect(linhas).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("resposta fora de lista não derruba (retorna vazio + loga)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapVendasComercial({ erro: "x" }, "closer", "t")).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("entrada/quantidade caem em default seguro quando ausentes", () => {
    const [v] = mapVendasComercial(
      [linha({ total_entrada: undefined, total_vendas: undefined })],
      "closer",
      "t",
    );
    expect(v.entrada).toBe(0);
    expect(v.quantidade).toBe(1);
  });
});
