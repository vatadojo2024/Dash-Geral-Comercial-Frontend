import { describe, expect, it } from "vitest";
import { modoDosAgendamentos } from "./modo";

describe("modo da tela de Agendamentos", () => {
  it("sem variável própria, segue LEADS_MODE como as outras telas", () => {
    expect(modoDosAgendamentos({})).toEqual({ modo: "mock", mockLocal: false });
    expect(modoDosAgendamentos({ LEADS_MODE: "mock" })).toEqual({ modo: "mock", mockLocal: false });
    expect(modoDosAgendamentos({ LEADS_MODE: "api" })).toEqual({ modo: "api", mockLocal: false });
  });

  it("AGENDAMENTOS_MODE=mock liga o mock SÓ nesta tela, mesmo com LEADS_MODE=api", () => {
    expect(modoDosAgendamentos({ LEADS_MODE: "api", AGENDAMENTOS_MODE: "mock" })).toEqual({ modo: "mock", mockLocal: true });
    expect(modoDosAgendamentos({ LEADS_MODE: "api", AGENDAMENTOS_MODE: " MOCK " })).toEqual({ modo: "mock", mockLocal: true });
    // Com o app inteiro em mock, não é "exceção local": é o modo normal.
    expect(modoDosAgendamentos({ LEADS_MODE: "mock", AGENDAMENTOS_MODE: "mock" })).toEqual({ modo: "mock", mockLocal: false });
  });

  it("no deploy (VERCEL=1) o mock próprio é ignorado: produção nunca mostra dado de demonstração", () => {
    expect(modoDosAgendamentos({ LEADS_MODE: "api", AGENDAMENTOS_MODE: "mock", VERCEL: "1" })).toEqual({ modo: "api", mockLocal: false });
  });

  it("AGENDAMENTOS_MODE=api força a API real; valor desconhecido é ignorado", () => {
    expect(modoDosAgendamentos({ LEADS_MODE: "mock", AGENDAMENTOS_MODE: "api" })).toEqual({ modo: "api", mockLocal: false });
    expect(modoDosAgendamentos({ LEADS_MODE: "api", AGENDAMENTOS_MODE: "qualquer" })).toEqual({ modo: "api", mockLocal: false });
    expect(modoDosAgendamentos({ LEADS_MODE: "api", AGENDAMENTOS_MODE: "" })).toEqual({ modo: "api", mockLocal: false });
  });
});
