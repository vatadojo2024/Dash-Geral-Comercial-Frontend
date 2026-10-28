import { beforeEach, describe, expect, it } from "vitest";
import {
  atualizarAluno,
  atualizarItemConfig,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  buscarHistorico,
  buscarResumo,
  criarCheckpoint,
  criarItemConfig,
  definirUsuarioDaSessao,
  EducacionalError,
  previaTrocaPrograma,
  queryDaApi,
  queryDosFiltros,
  trocarPrograma,
} from "./apiEducacional";
import { CheckpointModeloSchema, CheckpointSchema, contagemDoMarco, marcoDe, validarAlunoDetalhe, type AlunoDetalhe } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { dataDoMarco, hojeBR } from "./mock/motor";

// Programas e roteiros (specs/educacional/programas), no modo demonstração.

const HOJE = hojeBR();

async function erroDe(p: Promise<unknown>): Promise<EducacionalError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof EducacionalError) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

// Um aluno com checkpoint realizado E não realizado (para a troca ter os três grupos).
async function alunoMisto(): Promise<AlunoDetalhe> {
  const { itens } = await buscarAlunos({ por_pagina: "todos", ordem: "nome" });
  for (const a of itens) {
    const d = await buscarAluno(a.id);
    if (d.checkpoints.some((c) => c.status === "realizado") && d.checkpoints.some((c) => c.status !== "realizado")) return d;
  }
  throw new Error("semente sem aluno misto");
}

beforeEach(() => {
  _zerarMemoria();
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

describe("datas do programa", () => {
  it("Dia N = início + N dias; Mês N no calendário, no último dia quando o dia não existe", () => {
    expect(dataDoMarco("2026-01-31", "Dia 3")).toBe("2026-02-03");
    expect(dataDoMarco("2026-01-31", "Mês 1")).toBe("2026-02-28");
    expect(dataDoMarco("2028-01-31", "Mês 1")).toBe("2028-02-29");
    expect(dataDoMarco("2026-08-31", "Mês 6")).toBe("2027-02-28");
    expect(dataDoMarco("2026-10-15", "Mês 12")).toBe("2027-10-15");
    expect(dataDoMarco("2026-10-15", "Semana 2")).toBeNull();
  });
});

describe("contrato", () => {
  it("filtro por programa: vários na URL e na API", () => {
    expect(queryDosFiltros({ programa: ["p1", "p2"] })).toBe("programa=p1%2Cp2");
    expect(queryDaApi({ programa: ["p1", "p2"] })).toBe("programa_id=p1%2Cp2&ordem=risco&por_pagina=25");
  });

  it("checkpoint 'substituido' que chegue na lista sai sem derrubar o aluno; campos novos têm padrão", () => {
    const base = {
      id: "a1",
      versao: 1,
      nome: "Ana",
      mentoria: "Prime",
      nivel_inicial: "iniciante",
      status_aluno: "ativo",
      etapa: { id: "e1", nome: "Etapa" },
      proximo_checkpoint: null,
      dias_na_etapa: { valor: 1, automatico: 1, ajuste: null },
      dias_sem_atividade: { valor: null, automatico: null, ajuste: null },
      health_score: { valor: null, automatico: null, ajuste: null },
      faixa_saude: { valor: null, automatico: null, ajuste: null },
      proxima_acao: null,
      responsavel: null,
      sinais: {
        upgrade: { valor: null, automatico: null, ajuste: null },
        renovacao: { valor: null, automatico: null, ajuste: null },
        prova_social: { valor: null, automatico: null, ajuste: null },
      },
      arquivado: false,
      data_entrada: "2026-10-01",
      data_termino: null,
      etapa_desde: "2026-10-01",
      objetivo: null,
      diagnostico: null,
      motivo_risco: null,
      observacoes: null,
      autorizacao_prova_social: "pendente",
      ultima_atividade: { valor: null, automatico: null, ajuste: null },
      status_financeiro: { valor: null, automatico: null, ajuste: null },
      ltv: { valor: null, automatico: null, ajuste: null },
      progresso: {
        consumiu: { valor: null, automatico: null, ajuste: null },
        entendeu: { valor: null, automatico: null, ajuste: null },
        aplicou: { valor: null, automatico: null, ajuste: null },
        validou: { valor: null, automatico: null, ajuste: null },
      },
      highlights: [],
      intervencoes: [],
      checkpoints: [
        { id: "c1", nome: "Welcome", ordem: 1, data_prevista: "2026-10-01", data_realizada: "2026-10-01", status: "realizado", big_win: false, observacao: null },
        { id: "c2", nome: "Check-in", ordem: 2, data_prevista: "2026-10-04", data_realizada: null, status: "substituido", big_win: false, observacao: null },
      ],
    };
    const a = validarAlunoDetalhe(base)!;
    expect(a).not.toBeNull();
    expect(a.checkpoints.map((c) => c.id)).toEqual(["c1"]);
    expect(a.checkpoints[0]).toMatchObject({ marco: null, roteiro: null });
    expect(a.programa_id).toBeNull();
    expect(a.data_inicio_programa).toBeNull();
  });
});

describe("leitura tolerante do roteiro e da contagem", () => {
  it("checkpoint com os 4 textos soltos e contagem vira roteiro em objeto e marco", () => {
    const modelo = CheckpointModeloSchema.parse({
      id: "m1",
      nome: "Revisão",
      ordem: 3,
      dias_apos_entrada: null,
      meses_apos_inicio: 1,
      prazo_sla_dias: 7,
      big_win: false,
      ativo: true,
      programa_id: "p1",
      objetivo_contato: "O",
      perguntas_chave: "P",
      sinais_upsell: "S",
      estrategia_monetizacao: "E",
    });
    expect(modelo.roteiro).toEqual({ objetivo_contato: "O", perguntas_chave: "P", sinais_upsell: "S", estrategia_monetizacao: "E" });
    expect(marcoDe(modelo)).toBe("Mês 1");
    const doAluno = CheckpointSchema.parse({
      id: "c1",
      nome: "Check-in",
      ordem: 2,
      data_prevista: "2026-10-04",
      data_realizada: null,
      status: "previsto",
      big_win: false,
      observacao: null,
      dias_apos_entrada: 3,
      meses_apos_inicio: null,
      objetivo_contato: "O",
    });
    expect(doAluno.marco).toBe("Dia 3");
    expect(doAluno.roteiro?.objetivo_contato).toBe("O");
    expect(contagemDoMarco("Mês 12")).toEqual({ dias_apos_entrada: null, meses_apos_inicio: 12 });
    expect(contagemDoMarco("Dia 0")).toEqual({ dias_apos_entrada: 0, meses_apos_inicio: null });
  });
});

describe("trocar programa (prévia e confirmação)", () => {
  it("prévia: ficam os realizados, saem os não realizados, criados os do novo depois do último realizado", async () => {
    const a = await alunoMisto();
    const c = await buscarConfig();
    const destino = c.programas.find((p) => p.id !== a.programa_id && p.duracao_meses === 12)!;
    const pv = await previaTrocaPrograma(a.id, a.versao, { programa_id: destino.id, data_inicio: a.data_entrada });
    const realizados = a.checkpoints.filter((x) => x.status === "realizado");
    // Formato do backend: o programa é o mesmo objeto do aluno; criados com id null.
    expect(pv.programa).toEqual({ id: destino.id, nome: destino.nome, mentoria: destino.mentoria, duracao_meses: 12 });
    expect(pv.ficam.map((x) => x.id).sort()).toEqual(realizados.map((x) => x.id).sort());
    expect(pv.saem.map((x) => x.id).sort()).toEqual(a.checkpoints.filter((x) => x.status !== "realizado").map((x) => x.id).sort());
    const ultimo = realizados.map((x) => x.data_realizada ?? x.data_prevista ?? "").sort().at(-1)!;
    expect(pv.criados.length).toBeGreaterThan(0);
    expect(pv.criados.every((x) => x.id === null && x.status === "previsto" && x.modelo_id && x.data_prevista! > ultimo)).toBe(true);
    expect(pv.saem.every((x) => x.status !== "realizado")).toBe(true); // status atual, não "substituido"
    expect(pv.data_termino_sugerida).toBe(dataDoMarco(a.data_entrada, "Mês 12"));
    // Prévia não grava nada.
    expect((await buscarAluno(a.id)).versao).toBe(a.versao);
  });

  it("checkpoint avulso fica sempre, mesmo não realizado", async () => {
    const a = await alunoMisto();
    const comAvulso = await criarCheckpoint(a.id, a.versao, { nome: "Conversa extra", data_prevista: HOJE });
    const avulso = comAvulso.checkpoints.find((x) => x.nome === "Conversa extra")!;
    expect(avulso.modelo_id).toBeNull();
    const destino = (await buscarConfig()).programas.find((p) => p.id !== a.programa_id)!;
    const pv = await previaTrocaPrograma(a.id, null, { programa_id: destino.id, data_inicio: HOJE });
    expect(pv.ficam.map((x) => x.id)).toContain(avulso.id);
    expect(pv.saem.map((x) => x.id)).not.toContain(avulso.id);
    const d = await trocarPrograma(a.id, comAvulso.versao, { programa_id: destino.id, data_inicio: HOJE, motivo: "Troca com avulso" });
    expect(d.checkpoints.map((x) => x.id)).toContain(avulso.id);
  });

  it("confirmar grava programa, início, mentoria e término; substituídos saem da timeline e do SLA e vão ao histórico", async () => {
    const a = await alunoMisto();
    const c = await buscarConfig();
    const destino = c.programas.find((p) => p.mentoria !== a.mentoria)!;
    const pv = await previaTrocaPrograma(a.id, a.versao, { programa_id: destino.id, data_inicio: HOJE });
    expect((await erroDe(trocarPrograma(a.id, a.versao, { programa_id: destino.id, data_inicio: HOJE, motivo: "ok" }))).corpo.campo).toBe("motivo");
    expect((await erroDe(trocarPrograma(a.id, a.versao - 1, { programa_id: destino.id, data_inicio: HOJE, motivo: "Novo ciclo" }))).status).toBe(409);

    const d = await trocarPrograma(a.id, a.versao, { programa_id: destino.id, data_inicio: HOJE, motivo: "Novo ciclo combinado" });
    expect(d.versao).toBe(a.versao + 1);
    expect(d.programa_id).toBe(destino.id);
    expect(d.data_inicio_programa).toBe(HOJE);
    expect(d.mentoria).toBe(destino.mentoria);
    expect(d.data_termino).toBe(pv.data_termino_sugerida);
    expect(d.checkpoints.map((x) => x.id)).toEqual(expect.arrayContaining(pv.ficam.map((x) => x.id)));
    expect(d.checkpoints.some((x) => pv.saem.some((s) => s.id === x.id))).toBe(false);
    expect(d.checkpoints.filter((x) => x.status === "previsto").map((x) => x.nome)).toEqual(pv.criados.map((x) => x.nome));
    expect(d.checkpoints.every((x) => x.status === "realizado" || x.roteiro)).toBe(true);
    // SLA: nenhum pendente/sem resposta do programa antigo conta mais.
    expect(d.proximo_checkpoint?.status === "pendente" || d.proximo_checkpoint?.status === "nao_respondeu").toBe(false);
    const h = await buscarHistorico(d.id);
    expect(h.itens.find((x) => x.campo === "programa")).toMatchObject({ valor_depois: destino.nome, motivo: "Novo ciclo combinado" });
    expect(h.itens.filter((x) => x.campo.endsWith(" · substituido"))).toHaveLength(pv.saem.length);
    expect((await buscarResumo()).kpis.alunos_ativos).toBeGreaterThan(0);
  });

  it("PATCH não troca programa nem mentoria: só pela troca com prévia", async () => {
    const a = await alunoMisto();
    const e = await erroDe(atualizarAluno(a.id, a.versao, { programa_id: "x" } as never));
    expect(e.corpo.campo).toBe("programa_id");
    const m = await erroDe(atualizarAluno(a.id, a.versao, { mentoria: "Prime" } as never));
    expect(m.corpo.campo).toBe("mentoria");
  });

  it("filtro por programa traz só os alunos dos programas escolhidos", async () => {
    const todos = (await buscarAlunos({ por_pagina: "todos" })).itens;
    const ids = [...new Set(todos.map((a) => a.programa_id!))].slice(0, 2);
    const filtrados = (await buscarAlunos({ programa: ids, por_pagina: "todos" })).itens;
    expect(filtrados.length).toBe(todos.filter((a) => ids.includes(a.programa_id!)).length);
    expect(filtrados.every((a) => ids.includes(a.programa_id!))).toBe(true);
  });
});

describe("configuração de programas", () => {
  it("criar, editar e inativar (409 com alunos, como a etapa)", async () => {
    let c = await criarItemConfig("programas", { nome: "Blackbelt 3 meses", mentoria: "Blackbelt", duracao_meses: 3, observacoes: "Teste" });
    const novo = c.programas.find((p) => p.nome === "Blackbelt 3 meses")!;
    expect(novo).toMatchObject({ mentoria: "Blackbelt", duracao_meses: 3, observacoes: "Teste", ativo: true });
    c = await atualizarItemConfig("programas", novo.id, { observacoes: null });
    expect(c.programas.find((p) => p.id === novo.id)?.observacoes).toBeNull();
    c = await atualizarItemConfig("programas", novo.id, { ativo: false });
    expect(c.programas.find((p) => p.id === novo.id)?.ativo).toBe(false);
    const emUso = (await buscarAlunos({ por_pagina: "todos" })).itens[0].programa_id!;
    const e = await erroDe(atualizarItemConfig("programas", emUso, { ativo: false }));
    expect(e.status).toBe(409);
    expect(e.corpo).toMatchObject({ error: "programa_com_alunos" });
    expect((await erroDe(criarItemConfig("programas", { nome: "X", mentoria: "Blackbelt", duracao_meses: 0 }))).corpo.campo).toBe("duracao_meses");
    // Mentoria: Blackbelt, Prime ou Private.
    expect((await erroDe(criarItemConfig("programas", { nome: "X", mentoria: "Gold", duracao_meses: 6 }))).corpo.campo).toBe("mentoria");
  });

  it("checkpoint padrão com roteiro: editar em Configurações vale para todos os alunos (referência)", async () => {
    const a = (await buscarAlunos({ por_pagina: "todos" })).itens[0];
    const d = await buscarAluno(a.id);
    const c = await buscarConfig();
    const modelo = c.checkpoints_modelo.find((m) => m.programa_id === d.programa_id && m.nome === d.checkpoints[0].nome)!;
    // A tela manda o roteiro em objeto; o adapter envia os 4 campos soltos.
    await atualizarItemConfig("checkpoints-modelo", modelo.id, {
      roteiro: { objetivo_contato: "Objetivo novo", perguntas_chave: "P?", sinais_upsell: null, estrategia_monetizacao: "M" },
    });
    expect((await buscarAluno(a.id)).checkpoints[0].roteiro).toEqual({
      objetivo_contato: "Objetivo novo",
      perguntas_chave: "P?",
      sinais_upsell: null,
      estrategia_monetizacao: "M",
    });
  });
});
