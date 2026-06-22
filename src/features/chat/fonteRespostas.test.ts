import { afterEach, describe, expect, it, vi } from "vitest";
import { obterResposta } from "./fonteRespostas";

afterEach(() => {
  vi.useRealTimers();
});

describe("fonteRespostas (mock)", () => {
  it("devolve um texto fictício não-vazio após o atraso, conforme o papel", async () => {
    vi.useFakeTimers();
    const promessa = obterResposta({ pergunta: "oi", papel: "closer" });
    await vi.runAllTimersAsync();
    const texto = await promessa;
    expect(typeof texto).toBe("string");
    expect(texto.length).toBeGreaterThan(0);
  });

  it("rejeita (erro simulado) quando forcarErro é pedido", async () => {
    vi.useFakeTimers();
    const promessa = obterResposta({ pergunta: "oi", papel: "sdr", forcarErro: true });
    // Liga o catch antes de avançar o relógio para não vazar unhandled rejection.
    const resultado = expect(promessa).rejects.toThrow(/Falha simulada/);
    await vi.runAllTimersAsync();
    await resultado;
  });

  it("responde para os três papéis", async () => {
    vi.useFakeTimers();
    for (const papel of ["admin", "closer", "sdr"] as const) {
      const promessa = obterResposta({ pergunta: "teste", papel });
      await vi.runAllTimersAsync();
      await expect(promessa).resolves.toBeTypeOf("string");
    }
  });
});
