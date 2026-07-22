import { describe, expect, it } from "vitest";
import {
  cicloDe,
  dentroDoCiclo,
  inicioDoCiclo,
  rotuloCiclo,
  ultimosCiclos,
} from "./ciclo";

// Âncora oficial: 21/07/2026 é uma TERÇA (dia do evento).
describe("inicioDoCiclo / cicloDe", () => {
  it("na própria terça, o ciclo começa nela", () => {
    expect(inicioDoCiclo("2026-07-21")).toBe("2026-07-21");
    expect(cicloDe("2026-07-21")).toEqual({ inicio: "2026-07-21", fim: "2026-07-27" });
  });

  it("qualquer dia entre terça e segunda cai no mesmo ciclo", () => {
    for (const d of ["2026-07-21", "2026-07-23", "2026-07-27"]) {
      expect(cicloDe(d)).toEqual({ inicio: "2026-07-21", fim: "2026-07-27" });
    }
  });

  it("a terça seguinte abre o próximo ciclo", () => {
    expect(cicloDe("2026-07-28")).toEqual({ inicio: "2026-07-28", fim: "2026-08-03" });
  });

  it("ignora hora/offset de um ISO completo (só a porção civil importa)", () => {
    expect(inicioDoCiclo("2026-07-23T14:30:00-03:00")).toBe("2026-07-21");
  });
});

describe("virada de mês e de ano", () => {
  it("ciclo que atravessa a virada de mês (jul→ago)", () => {
    // 30/07/2026 é quinta → ciclo 28/07 a 03/08 (cruza o mês).
    expect(cicloDe("2026-07-30")).toEqual({ inicio: "2026-07-28", fim: "2026-08-03" });
  });

  it("ciclo que atravessa a virada de ANO (01/01/2026 = quinta)", () => {
    // A terça anterior é 30/12/2025; o ciclo vai até 05/01/2026.
    expect(cicloDe("2026-01-01")).toEqual({ inicio: "2025-12-30", fim: "2026-01-05" });
  });

  it("último dia do ano cai no ciclo iniciado em 29/12", () => {
    // 31/12/2026 é quinta → terça anterior 29/12/2026.
    expect(cicloDe("2026-12-31")).toEqual({ inicio: "2026-12-29", fim: "2027-01-04" });
  });
});

describe("dentroDoCiclo", () => {
  const ciclo = { inicio: "2026-07-21", fim: "2026-07-27" };
  it("inclui as bordas e exclui fora", () => {
    expect(dentroDoCiclo("2026-07-21", ciclo)).toBe(true);
    expect(dentroDoCiclo("2026-07-27", ciclo)).toBe(true);
    expect(dentroDoCiclo("2026-07-20", ciclo)).toBe(false);
    expect(dentroDoCiclo("2026-07-28", ciclo)).toBe(false);
  });
  it("aceita ISO completo (usa só o dia)", () => {
    expect(dentroDoCiclo("2026-07-27T23:59:00Z", ciclo)).toBe(true);
  });
});

describe("ultimosCiclos", () => {
  it("retorna n ciclos, o atual primeiro, retrocedendo 7 dias", () => {
    const ciclos = ultimosCiclos("2026-07-23", 3);
    expect(ciclos).toEqual([
      { inicio: "2026-07-21", fim: "2026-07-27" },
      { inicio: "2026-07-14", fim: "2026-07-20" },
      { inicio: "2026-07-07", fim: "2026-07-13" },
    ]);
  });

  it("padrão são 12 ciclos", () => {
    expect(ultimosCiclos("2026-07-23")).toHaveLength(12);
  });
});

describe("rotuloCiclo", () => {
  it("formata dd/MM a dd/MM", () => {
    expect(rotuloCiclo({ inicio: "2026-07-21", fim: "2026-07-27" })).toBe("21/07 a 27/07");
  });
});
