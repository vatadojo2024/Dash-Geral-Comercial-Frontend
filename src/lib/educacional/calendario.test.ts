import { beforeEach, describe, expect, it } from "vitest";
import {
  _simularGravacaoEmTeste,
  buscarAluno,
  buscarAlunos,
  buscarCalendario,
  buscarConfig,
  criarAula,
  definirUsuarioDaSessao,
  EducacionalError,
} from "./apiEducacional";
import {
  gradeDoMes,
  horaDe,
  horasDaSemana,
  lerEstadoCalendario,
  periodoVisivel,
  porDia,
  queryDoCalendario,
  somarDias,
} from "./calendario";
import { EventoCalendarioSchema, type EventoCalendario } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { hojeBR } from "./mock/motor";

// Entrega 2, M3: Calendário do Educacional (rota do plano do backend; o
// formato do item é proposta nossa, no modo demonstração).

const HOJE = hojeBR();

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

const evento = (parte: Partial<EventoCalendario>): EventoCalendario =>
  EventoCalendarioSchema.parse({ id: "e", tipo: "aula", data: "2026-11-04", titulo: "Aula 1", aluno: { id: "a", nome: "Ana" }, ...parte });

describe("datas da grade", () => {
  it("mês em semanas inteiras de domingo a sábado; semana idem", () => {
    const g = gradeDoMes("2026-11-15");
    expect([g[0][0], g.at(-1)![6]]).toEqual(["2026-11-01", "2026-12-05"]);
    expect(periodoVisivel("mes", "2026-11-15")).toEqual({ inicio: "2026-11-01", fim: "2026-12-05" });
    expect(periodoVisivel("semana", "2026-11-04")).toEqual({ inicio: "2026-11-01", fim: "2026-11-07" });
  });

  it("no dia, o que não tem hora vem antes; com hora, pela hora", () => {
    const m = porDia([evento({ id: "1", hora: "19:00" }), evento({ id: "2", tipo: "checkpoint" }), evento({ id: "3", hora: "08:30" })]);
    expect(m.get("2026-11-04")!.map((e) => e.id)).toEqual(["2", "3", "1"]);
  });

  it("linhas de hora da semana: 7h às 21h, ampliadas para caber o que vier fora", () => {
    expect(horasDaSemana([])).toEqual(Array.from({ length: 15 }, (_, i) => 7 + i));
    const h = horasDaSemana([evento({ hora: "06:15" }), evento({ hora: "22:00:00" })]);
    expect([h[0], h.at(-1)]).toEqual([6, 22]);
    expect([horaDe(evento({ hora: "9:05" })), horaDe(evento({ hora: null })), horaDe(evento({ hora: "xx" }))]).toEqual([9, null, null]);
  });

  it("estado na URL vai e volta; valor fora do esperado é ignorado", () => {
    const e = { visao: "semana" as const, dia: "2026-11-04", responsavel: "r1", programa: "p1", tipo: "aula" as const };
    expect(lerEstadoCalendario(new URLSearchParams(queryDoCalendario(e)))).toEqual(e);
    expect(lerEstadoCalendario(new URLSearchParams("visao=ano&dia=ontem&tipo=reuniao"))).toEqual({
      visao: "mes",
      dia: null,
      responsavel: null,
      programa: null,
      tipo: null,
    });
    expect(queryDoCalendario({ visao: "mes", dia: null, responsavel: null, programa: null, tipo: null })).toBe("");
  });
});

describe("rota do calendário (modo demonstração)", () => {
  const periodo = () => ({ inicio: somarDias(HOJE, -60), fim: somarDias(HOJE, 30) });

  it("os 4 tipos no período, em ordem de data; checkpoint pendente ou sem resposta vem com SLA", async () => {
    const itens = await buscarCalendario(periodo());
    const tipos = new Set(itens.map((e) => e.tipo));
    // A semente tem os quatro tipos no período.
    expect([...tipos].sort()).toEqual(["aula", "checkpoint", "intervencao", "proxima_acao"]);
    const datas = itens.map((e) => e.data);
    expect(datas).toEqual([...datas].sort());
    expect(itens.every((e) => e.data >= periodo().inicio && e.data <= periodo().fim)).toBe(true);
    for (const e of itens.filter((x) => x.tipo === "checkpoint")) expect(e.sla).toBe(e.status === "pendente" || e.status === "nao_respondeu");
    expect(itens.some((e) => e.sla)).toBe(true);
    expect(itens.filter((e) => e.tipo === "aula").every((e) => /^Aula \d+$/.test(e.titulo))).toBe(true);
  });

  it("filtros: tipo, responsável e programa", async () => {
    const todos = await buscarCalendario(periodo());
    const aulas = await buscarCalendario({ ...periodo(), tipo: "aula" });
    expect(aulas.length).toBe(todos.filter((e) => e.tipo === "aula").length);
    const r = todos.find((e) => e.responsavel)!.responsavel!;
    const doR = await buscarCalendario({ ...periodo(), responsavel_id: r.id });
    expect(doR.length).toBeGreaterThan(0);
    expect(doR.every((e) => e.responsavel?.id === r.id)).toBe(true);
    const p = todos.find((e) => e.programa)!.programa!;
    const doP = await buscarCalendario({ ...periodo(), programa_id: p.id });
    expect(doP.every((e) => e.programa?.id === p.id)).toBe(true);
  });

  it("período inválido volta em português", async () => {
    const e = await buscarCalendario({ inicio: HOJE, fim: somarDias(HOJE, -1) }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(EducacionalError);
    expect((e as EducacionalError).message).toBe("Informe o início e o fim do período (AAAA-MM-DD).");
  });

  it("aula criada na hora (Nova aula do Calendário) aparece no dia e na hora; arquivado não aparece", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    const a = await buscarAluno(itens[0].id);
    const c = await buscarConfig();
    const mentor = c.responsaveis.find((r) => r.tipo === "mentor")!;
    const dia = somarDias(HOJE, 3);
    await criarAula(a.id, a.versao, { data: dia, hora: "10:30", mentor_id: mentor.id, status: "agendada" });
    const doDia = await buscarCalendario({ inicio: dia, fim: dia, tipo: "aula" });
    const nova = doDia.find((e) => e.aluno.id === a.id && e.hora === "10:30");
    expect(nova).toMatchObject({ tipo: "aula", data: dia, responsavel: { id: mentor.id }, status: "agendada" });
  });

  it("item fora do contrato sai sozinho", () => {
    expect(EventoCalendarioSchema.safeParse({ id: "x", tipo: "reuniao", data: "2026-11-04", titulo: "x", aluno: { id: "a", nome: "A" } }).success).toBe(false);
    expect(EventoCalendarioSchema.safeParse({ id: "x", tipo: "aula", data: "04/11/2026", titulo: "x", aluno: { id: "a", nome: "A" } }).success).toBe(false);
  });
});
