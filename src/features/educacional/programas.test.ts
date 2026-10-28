import { describe, expect, it } from "vitest";
import type { Config } from "@/lib/educacional/contrato";
import { programasPorMentoria, sugerirTermino, temProgramas } from "./programas";

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
});
