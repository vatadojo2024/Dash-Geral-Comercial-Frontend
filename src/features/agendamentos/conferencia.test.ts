import { describe, expect, it } from "vitest";
import { janelaDaConferencia } from "./ConferenciaDashboard";

// Correção 6: a conferência sai antes de a fila chegar, com a janela calculada
// sobre a lista vazia. Esta é a garantia de que a janela final (e, portanto, a
// chave da consulta e os dados exibidos) é exatamente a de antes.

const HOJE = "2026-10-26";
const fila = (...dias: string[]) => dias.map((dia) => ({ dia }));

describe("janelaDaConferencia", () => {
  const antesDaFila = janelaDaConferencia([], HOJE);

  it("antes da fila: hoje até hoje+13", () => {
    expect(antesDaFila).toEqual({ de: "2026-10-26", ate: "2026-11-08" });
  });

  it("fila vazia ou até hoje+13: a janela final é idêntica à inicial (mesma consulta, reaproveitada)", () => {
    for (const lista of [fila(), fila("2026-10-26"), fila("2026-10-27", "2026-11-08"), fila("2026-10-20", "2026-11-01")]) {
      expect(janelaDaConferencia(lista, HOJE)).toEqual(antesDaFila);
    }
  });

  it("fila com call depois de hoje+13: a janela cresce até o último dia (nova consulta, como antes)", () => {
    expect(janelaDaConferencia(fila("2026-10-30", "2026-11-09", "2026-11-20"), HOJE)).toEqual({ de: "2026-10-26", ate: "2026-11-20" });
  });

  it("virada de mês e de ano", () => {
    expect(janelaDaConferencia([], "2026-12-25")).toEqual({ de: "2026-12-25", ate: "2027-01-07" });
  });
});
