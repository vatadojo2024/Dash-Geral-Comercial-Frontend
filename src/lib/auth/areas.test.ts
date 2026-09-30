import { describe, expect, it } from "vitest";
import { DataError, OportunidadesError } from "@/lib/data/dataClient";
import { AREAS_DO_PAPEL, homeDoUsuario, normalizarAreas, ROTA_SEM_AREA, temArea } from "./areas";
import { ehSemPermissao, SemPermissaoError } from "./semPermissao";

describe("áreas da sessão (GET /api/me → areas)", () => {
  it("usa a lista da API como veio, ignorando valor desconhecido e repetido", () => {
    expect(normalizarAreas(["retencao", "area_nova", " Dashboard ", "retencao"], "marketing")).toEqual([
      "retencao",
      "dashboard",
    ]);
  });

  it("lista vazia é respeitada (educacional loga sem área)", () => {
    expect(normalizarAreas([], "admin")).toEqual([]);
  });

  it("sem o campo (API antiga ou cookie de antes de 30/09) → reserva do papel", () => {
    expect(normalizarAreas(undefined, "closer")).toEqual(AREAS_DO_PAPEL.closer);
    expect(normalizarAreas(null, "sdr")).toEqual(AREAS_DO_PAPEL.sdr);
  });

  it("reserva espelha a tabela do backend (DOCUMENTACAO-FRONT, seção 6)", () => {
    expect(AREAS_DO_PAPEL.admin).toHaveLength(10);
    expect(AREAS_DO_PAPEL.admin).toContain("historico_agendamentos");
    expect(AREAS_DO_PAPEL.closer).toEqual(["dashboard", "leads", "agendamentos", "chat", "salesops"]);
    expect(AREAS_DO_PAPEL.sdr).toEqual(["dashboard", "leads", "agendamentos", "chat", "produtividade_sdr", "retencao"]);
    expect(AREAS_DO_PAPEL.marketing).toEqual(["retencao"]);
    expect(AREAS_DO_PAPEL.educacional).toEqual([]);
  });

  it("home = primeira área da lista; sem área → tela própria, nunca a home de novo", () => {
    expect(homeDoUsuario({ areas: AREAS_DO_PAPEL.admin })).toBe("/visao-geral");
    expect(homeDoUsuario({ areas: AREAS_DO_PAPEL.closer })).toBe("/dashboard");
    expect(homeDoUsuario({ areas: AREAS_DO_PAPEL.marketing })).toBe("/retencao");
    expect(homeDoUsuario({ areas: ["lideranca_pre_venda"] })).toBe("/produtividade-sdr/lideranca");
    expect(homeDoUsuario({ areas: [] })).toBe(ROTA_SEM_AREA);
  });

  it("temArea lê só a lista, não o papel", () => {
    expect(temArea({ areas: ["retencao"] }, "retencao")).toBe(true);
    expect(temArea({ areas: ["retencao"] }, "leads")).toBe(false);
  });
});

describe("403 = sem acesso, não erro de sistema", () => {
  it("reconhece o 403 de todas as portas de dados", () => {
    expect(ehSemPermissao(new DataError("Sem permissão", "sem_permissao"))).toBe(true);
    expect(ehSemPermissao(new OportunidadesError("Sem permissão", 403, "desconhecido"))).toBe(true);
    expect(ehSemPermissao(new SemPermissaoError())).toBe(true);
  });

  it("outros erros seguem como erro", () => {
    expect(ehSemPermissao(new DataError("falhou", "request_failed"))).toBe(false);
    expect(ehSemPermissao(new OportunidadesError("Clint fora", 502, "clint_indisponivel"))).toBe(false);
    expect(ehSemPermissao(new Error("Sem permissão"))).toBe(false);
    expect(ehSemPermissao(null)).toBe(false);
  });
});
