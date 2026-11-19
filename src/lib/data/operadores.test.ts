import { afterEach, describe, expect, it, vi } from "vitest";
import { operadoresDoMes } from "@/lib/mock/operadores_sdr";
import { DataError, fetchOperadoresSdr, OperadoresIndisponiveisError } from "./dataClient";

// GET /api/sdr/operadores?mes= (backend 4197783): os SDRs e as metas do mês.

describe("modo demonstração da rota de operadores", () => {
  it("metas efetivas a partir de um mês: a Fátima 20/30/40 em novembro e 30/40/50 a partir de dezembro", () => {
    const fatima = (mes: string) => operadoresDoMes(mes).operadores.find((o) => o.id === "fatima")!;
    expect([fatima("2026-10").faixas, fatima("2026-11").faixas, fatima("2026-12").faixas, fatima("2027-03").faixas]).toEqual([
      null,
      [20, 30, 40],
      [30, 40, 50],
      [30, 40, 50],
    ]);
    const nov = operadoresDoMes("2026-11");
    expect(nov.equipe.faixas).toEqual([150, 188, 225]);
    expect(nov.operadores.find((o) => o.id === "arthur")).toMatchObject({ faixas: [30, 40, 50], regra_ninja_qc: true });
    expect(nov.operadores.map((o) => o.nome)).toEqual([...nov.operadores.map((o) => o.nome)].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});

describe("fetchOperadoresSdr", () => {
  const fetchMock = vi.fn();
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

  it("pede o mês da tela e valida o contrato", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(json(operadoresDoMes("2026-11")));
    const r = await fetchOperadoresSdr("2026-11");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sdr/operadores?mes=2026-11");
    expect(r.operadores.some((o) => o.nome === "Fátima Consuelo")).toBe(true);
  });

  it("503 de_para_indisponivel vira um erro próprio (a tela avisa, não mostra equipe vazia)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(json({ erro: "de_para_indisponivel" }, 503));
    await expect(fetchOperadoresSdr("2026-11")).rejects.toBeInstanceOf(OperadoresIndisponiveisError);
  });

  it("resposta fora do contrato (faixas com dois números) é recusada", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const ruim = { ...operadoresDoMes("2026-11"), operadores: [{ id: "x", nome: "X", nomes_externos: [], faixas: [1, 2], meta_desde: null, regra_ninja_qc: false }] };
    fetchMock.mockResolvedValue(json(ruim));
    await expect(fetchOperadoresSdr("2026-11")).rejects.toBeInstanceOf(DataError);
  });
});
