import { describe, expect, it } from "vitest";
import { proximoTema, TEMA_PADRAO, temaValido } from "./tema";

describe("proximoTema — ciclo de 3 fases", () => {
  it("azul → dark → light → azul", () => {
    expect(proximoTema("azul")).toBe("dark");
    expect(proximoTema("dark")).toBe("light");
    expect(proximoTema("light")).toBe("azul");
  });

  it("três toques voltam ao ponto de partida", () => {
    expect(proximoTema(proximoTema(proximoTema("azul")))).toBe("azul");
  });
});

describe("temaValido — default azul", () => {
  it("aceita os três temas válidos", () => {
    expect(temaValido("azul")).toBe("azul");
    expect(temaValido("dark")).toBe("dark");
    expect(temaValido("light")).toBe("light");
  });

  it("valor desconhecido cai no default azul", () => {
    expect(TEMA_PADRAO).toBe("azul");
    expect(temaValido(null)).toBe("azul");
    expect(temaValido("qualquer")).toBe("azul");
    expect(temaValido(undefined)).toBe("azul");
    expect(temaValido("escuro")).toBe("azul"); // só "dark" vale, não pt-BR
  });
});
