import { beforeEach, describe, expect, it } from "vitest";
import { COLUNAS_DA_TABELA, colunasDaEscolha } from "@/features/educacional/SeletorColunas";
import { _simularGravacaoEmTeste, buscarAlunos, buscarCalendario, definirUsuarioDaSessao } from "./apiEducacional";
import { somarDias } from "./calendario";
import { _zerarMemoria } from "./mock/banco";
import { hojeBR } from "./mock/motor";

// Vencimento do contrato: ordem=vencimento na lista (sem data no fim, nas duas
// direções), coluna ligada por padrão e tipo=vencimento no calendário. Modo
// demonstração até o backend.

const HOJE = hojeBR();

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

const datas = (itens: { data_termino: string | null }[]) => itens.map((a) => a.data_termino);

describe("ordem por vencimento", () => {
  it("o que vence primeiro em cima; invertida, o mais distante em cima; sem data sempre no fim", async () => {
    const asc = datas((await buscarAlunos({ ordem: "vencimento", por_pagina: "todos" })).itens);
    const desc = datas((await buscarAlunos({ ordem: "-vencimento", por_pagina: "todos" })).itens);
    const com = asc.filter((d): d is string => d !== null);
    expect(com.length).toBeGreaterThan(1);
    expect(asc.slice(0, com.length)).toEqual([...com].sort());
    expect(desc.slice(0, com.length)).toEqual([...com].sort().reverse());
    expect(asc.slice(com.length).every((d) => d === null)).toBe(true);
    expect(desc.slice(com.length).every((d) => d === null)).toBe(true);
  });

  it("a linha da lista traz a data de término", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    expect(itens.some((a) => a.data_termino)).toBe(true);
  });
});

describe("coluna Vencimento", () => {
  it("ligada por padrão, também para quem já tinha escolhido as colunas", () => {
    expect(colunasDaEscolha(null)).toContain("vencimento");
    // Escolha antiga (só a lista): a coluna nova entra; as desligadas continuam desligadas.
    const antiga = colunasDaEscolha(["nome", "etapa"]);
    expect(antiga).toEqual(["nome", "etapa", "vencimento"]);
    // Escolha nova: quem desligou o Vencimento continua sem ele.
    expect(colunasDaEscolha({ visiveis: ["nome", "etapa"], conhecidas: COLUNAS_DA_TABELA.map((c) => c.id) })).toEqual(["nome", "etapa"]);
  });
});

describe("calendário: vencimento do contrato", () => {
  it("um item por aluno ativo com término no período, filtrável por tipo", async () => {
    const periodo = { inicio: somarDias(HOJE, -45), fim: somarDias(HOJE, 45) };
    const venc = await buscarCalendario({ ...periodo, tipo: "vencimento" });
    expect(venc.length).toBeGreaterThan(0);
    expect(venc.every((e) => e.tipo === "vencimento" && e.id === `vencimento:${e.aluno.id}` && e.hora === null)).toBe(true);
    const ativos = (await buscarAlunos({ por_pagina: "todos", status_aluno: ["ativo", "em_pausa"] })).itens.filter(
      (a) => a.data_termino && a.data_termino >= periodo.inicio && a.data_termino <= periodo.fim,
    );
    expect(venc.map((e) => e.aluno.id).sort()).toEqual(ativos.map((a) => a.id).sort());
    const todos = await buscarCalendario(periodo);
    expect(todos.filter((e) => e.tipo === "vencimento")).toHaveLength(venc.length);
    // A semente tem contrato ativo já vencido (a tela destaca em vermelho).
    expect(venc.filter((e) => e.data < HOJE)).toHaveLength(2);
  });
});
