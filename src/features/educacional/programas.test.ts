import { describe, expect, it } from "vitest";
import type { Config } from "@/lib/educacional/contrato";
import { normalizarMarco } from "./Configuracoes";
import { resumoDosProgramas } from "./FiltroProgramas";
import { marcoENome, marcoVisivel, programasPorMentoria, sugerirTermino, temProgramas } from "./programas";

const programa = (id: string, mentoria: string, meses: number, ativo = true) => ({
  id,
  nome: `${mentoria} ${meses} meses`,
  mentoria,
  duracao_meses: meses,
  observacao: null,
  ordem: 0,
  ativo,
});

describe("apoio de programas na tela", () => {
  it("término sugerido: início + duração em meses de calendário, no fim do mês quando o dia não existe", () => {
    expect(sugerirTermino("2026-01-31", 6)).toBe("2026-07-31");
    expect(sugerirTermino("2026-08-31", 6)).toBe("2027-02-28");
    expect(sugerirTermino("2026-10-28", 12)).toBe("2027-10-28");
    expect(sugerirTermino("", 6)).toBe("");
  });

  it("programas ativos agrupados por mentoria, na ordem da configuração", () => {
    const config = {
      programas: [programa("b6", "Blackbelt", 6), programa("p6", "Prime", 6), programa("b12", "Blackbelt", 12), programa("x", "Prime", 3, false)],
    } as unknown as Config;
    expect(programasPorMentoria(config).map((g) => [g.mentoria, g.programas.map((p) => p.id)])).toEqual([
      ["Blackbelt", ["b6", "b12"]],
      ["Prime", ["p6"]],
    ]);
    expect(programasPorMentoria(config, true)[1].programas.map((p) => p.id)).toEqual(["p6", "x"]);
    expect(temProgramas(config)).toBe(true);
    expect(temProgramas({ programas: [] } as unknown as Config)).toBe(false);
  });

  it("marco digitado solto vira Dia N / Mês N; o resto é recusado", () => {
    expect(normalizarMarco("mes 3")).toBe("Mês 3");
    expect(normalizarMarco(" MÊS 12 ")).toBe("Mês 12");
    expect(normalizarMarco("dia 0")).toBe("Dia 0");
    expect(normalizarMarco("Dia 03")).toBe("Dia 3");
    expect(normalizarMarco("Semana 2")).toBeNull();
    expect(normalizarMarco("Mês")).toBeNull();
  });

  it("resumo do filtro: Todos, um nome, a mentoria inteira ou a contagem", () => {
    const config = { programas: [programa("b6", "Blackbelt", 6), programa("b12", "Blackbelt", 12), programa("p6", "Prime", 6)] } as unknown as Config;
    const grupos = programasPorMentoria(config);
    expect(resumoDosProgramas(grupos, [])).toBe("Todos");
    expect(resumoDosProgramas(grupos, ["b12"])).toBe("Blackbelt 12 meses");
    expect(resumoDosProgramas(grupos, ["b6", "b12"])).toBe("Blackbelt (todos)");
    expect(resumoDosProgramas(grupos, ["b6", "p6"])).toBe("2 programas");
  });
});

describe("marco ao lado do nome", () => {
  it("some quando o nome já começa por ele (nomes de produção)", () => {
    expect(marcoVisivel("Dia 0", "Dia 0 (Boas-vindas)")).toBeNull();
    expect(marcoVisivel("Mês 1", "mes 1 (Revisão)")).toBeNull();
    expect(marcoVisivel("Dia 3", "Sprint")).toBe("Dia 3");
    expect(marcoVisivel(null, "Avulso")).toBeNull();
    expect(marcoENome("Mês 3", "Mês 3 (Big Win)")).toBe("Mês 3 (Big Win)");
    expect(marcoENome("Mês 3", "Big Win")).toBe("Mês 3 · Big Win");
  });
});
