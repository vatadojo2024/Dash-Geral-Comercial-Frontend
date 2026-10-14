import { describe, expect, it } from "vitest";
import {
  AREAS_DO_PAPEL,
  homeDoModulo,
  homeDoUsuario,
  moduloAtivo,
  modulosDeAreas,
  normalizarModulos,
} from "./areas";

const admin = { areas: AREAS_DO_PAPEL.admin, modulos: modulosDeAreas(AREAS_DO_PAPEL.admin) };
const educacional = { areas: AREAS_DO_PAPEL.educacional, modulos: modulosDeAreas(AREAS_DO_PAPEL.educacional) };
const closer = { areas: AREAS_DO_PAPEL.closer, modulos: modulosDeAreas(AREAS_DO_PAPEL.closer) };

describe("módulos Comercial | Educacional", () => {
  it("vêm da API como estão (ordem fixa, sem repetidos, desconhecidos ignorados)", () => {
    expect(normalizarModulos(["educacional", "comercial", "educacional", "rh"], [])).toEqual(["comercial", "educacional"]);
    expect(normalizarModulos([], AREAS_DO_PAPEL.admin)).toEqual([]);
  });

  it("sem o campo, são deduzidos das áreas do servidor — nunca do papel", () => {
    expect(normalizarModulos(undefined, AREAS_DO_PAPEL.admin)).toEqual(["comercial", "educacional"]);
    expect(normalizarModulos(undefined, AREAS_DO_PAPEL.closer)).toEqual(["comercial"]);
    expect(normalizarModulos(undefined, ["educacional"])).toEqual(["educacional"]);
    // Educacional sem a área no servidor (backend ainda antigo): sem módulo nenhum.
    expect(normalizarModulos(undefined, [])).toEqual([]);
  });

  it("home: educacional vai para /educacional; admin e closer seguem a home atual", () => {
    expect(homeDoUsuario(educacional)).toBe("/educacional");
    expect(homeDoUsuario(admin)).toBe("/visao-geral");
    expect(homeDoUsuario(closer)).toBe("/dashboard");
    expect(homeDoModulo(admin, "educacional")).toBe("/educacional");
    expect(homeDoModulo(admin, "comercial")).toBe("/visao-geral");
  });

  it("módulo ativo: com um módulo só, é ele; com dois, decide o caminho", () => {
    expect(moduloAtivo(educacional, "/sem-area")).toBe("educacional");
    expect(moduloAtivo(closer, "/educacional")).toBe("comercial");
    expect(moduloAtivo(admin, "/educacional/alunos/1")).toBe("educacional");
    expect(moduloAtivo(admin, "/educacionalx")).toBe("comercial");
    expect(moduloAtivo(admin, "/leads")).toBe("comercial");
  });
});
