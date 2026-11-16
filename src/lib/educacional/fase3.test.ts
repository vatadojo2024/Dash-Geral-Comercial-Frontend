import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ajustarCampo,
  arquivarAluno,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  buscarHistorico,
  buscarOpcoesAlunos,
  criarItemConfig,
  definirUsuarioDaSessao,
  EducacionalError,
  LIMITE_ARQUIVO_ANALISE,
  queryDaApi,
  RESPONSAVEL_NENHUM,
  salvarLote,
} from "./apiEducacional";
import { LIMITE_LOTE, type AlunoLinha } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { normalizar } from "./mock/servidor";

// Fase 3 no modo demonstração: lote, opções, filtros da aba Alunos, ordem de
// atenção, mentorias, análise de aula e semente D4 (contrato da seção 7).

async function erroDe(p: Promise<unknown>): Promise<EducacionalError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof EducacionalError) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

const todos = async () => (await buscarAlunos({ por_pagina: "todos", ordem: "nome" })).itens;
let relogio = Date.parse("2026-10-27T15:00:00Z");
const andar = (ms: number) => {
  relogio += ms;
  vi.setSystemTime(relogio);
};

beforeEach(() => {
  _zerarMemoria();
  vi.useFakeTimers({ toFake: ["Date"] });
  relogio = Date.parse("2026-10-27T15:00:00Z");
  vi.setSystemTime(relogio);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});
afterEach(() => vi.useRealTimers());

describe("config, filtros e ordem", () => {
  it("D2: /config traz as mentorias distintas e em ordem (também depois de gravar config)", async () => {
    const c = await buscarConfig();
    const esperado = [...new Set((await todos()).map((a) => a.mentoria))].sort((x, y) => x.localeCompare(y, "pt-BR"));
    expect(c.mentorias.length).toBeGreaterThan(0);
    expect(c.mentorias).toEqual(expect.arrayContaining(esperado));
    const depois = await criarItemConfig("tipos-intervencao", { nome: "Visita" });
    expect(depois.mentorias).toEqual(c.mentorias);
  });

  it("query da aba Alunos: busca (2+ letras), listas por vírgula e responsável 'sem'", () => {
    expect(
      queryDaApi({
        busca: "  jo ",
        mentoria: ["Prime", "Black"],
        faixa_saude: ["risco", "atencao"],
        status_aluno: ["ativo", "em_pausa"],
        responsavel: RESPONSAVEL_NENHUM,
      }),
    ).toBe(
      "responsavel_id=sem&status_aluno=ativo%2Cem_pausa&busca=jo&mentoria=Prime%2CBlack&faixa_saude=risco%2Catencao&ordem=risco&por_pagina=25",
    );
    expect(queryDaApi({ busca: "a" })).toBe("ordem=risco&por_pagina=25");
  });

  it("filtros novos no mock: busca sem acento, mentoria, faixa, sem responsável, vários status", async () => {
    const lista = await todos();
    const alvo = lista[0];
    const pedaco = normalizar(alvo.nome.split(" ")[0]).slice(1, 4).toUpperCase(); // sem espaço: a busca apara
    const porBusca = (await buscarAlunos({ busca: pedaco, por_pagina: "todos" })).itens;
    expect(porBusca.map((a) => a.id)).toContain(alvo.id);
    expect(porBusca.every((a) => normalizar(a.nome).includes(normalizar(pedaco)))).toBe(true);

    const m = alvo.mentoria;
    const porMentoria = (await buscarAlunos({ mentoria: [m], por_pagina: "todos" })).itens;
    expect(porMentoria.length).toBe(lista.filter((a) => a.mentoria === m).length);

    const faixas = (await buscarAlunos({ faixa_saude: ["risco", "atencao"], por_pagina: "todos" })).itens;
    expect(faixas.every((a) => a.faixa_saude.valor === "risco" || a.faixa_saude.valor === "atencao")).toBe(true);
    expect(faixas.length).toBe(lista.filter((a) => a.faixa_saude.valor === "risco" || a.faixa_saude.valor === "atencao").length);

    const semResp = (await buscarAlunos({ responsavel: RESPONSAVEL_NENHUM, por_pagina: "todos" })).itens;
    expect(semResp.every((a) => a.responsavel === null)).toBe(true);
    expect(semResp.length).toBe(lista.filter((a) => a.responsavel === null).length);

    const status = (await buscarAlunos({ status_aluno: ["ativo", "em_pausa"], por_pagina: "todos" })).itens;
    expect(status.length).toBe(lista.filter((a) => a.status_aluno === "ativo" || a.status_aluno === "em_pausa").length);
  });

  it("D3: ordem=atencao = faixa efetiva (risco, atenção, saudável), depois dias sem atividade desc, nulos no fim", async () => {
    const itens = (await buscarAlunos({ ordem: "atencao", por_pagina: "todos" })).itens;
    const peso = (a: AlunoLinha) => (a.faixa_saude.valor ? { risco: 0, atencao: 1, saudavel: 2 }[a.faixa_saude.valor] : 3);
    for (let i = 1; i < itens.length; i++) {
      const [a, b] = [itens[i - 1], itens[i]];
      expect(peso(a)).toBeLessThanOrEqual(peso(b));
      if (peso(a) === peso(b) && b.dias_sem_atividade.valor != null) {
        expect(a.dias_sem_atividade.valor).not.toBeNull();
        expect(a.dias_sem_atividade.valor!).toBeGreaterThanOrEqual(b.dias_sem_atividade.valor);
      }
    }
  });

  it("opções de aluno: até 20, sem arquivados, com busca", async () => {
    const lista = await todos();
    await arquivarAluno(lista[0].id, lista[0].versao);
    const ops = await buscarOpcoesAlunos();
    expect(ops.length).toBeLessThanOrEqual(20);
    expect(ops.map((o) => o.id)).not.toContain(lista[0].id);
    expect(ops[0]).toEqual({ id: expect.any(String), nome: expect.any(String), mentoria: expect.any(String), etapa: expect.any(Object) });
    const alvo = lista[1];
    const achados = await buscarOpcoesAlunos(alvo.nome.slice(0, 4));
    expect(achados.map((o) => o.id)).toContain(alvo.id);
  });
});

describe("salvar em lote (seção 3 do backend)", () => {
  it("um aluno: campos, ajuste, checkpoint e intervenção numa versão só, histórico com o mesmo lote_id", async () => {
    const [a] = await todos();
    const d = await buscarAluno(a.id);
    const c = await buscarConfig();
    const tipo = c.tipos_intervencao.find((t) => t.ativo)!;
    const cp = d.checkpoints.find((x) => x.status !== "realizado")!;
    const r = await salvarLote({
      motivo_padrao: "Revisão semanal da turma",
      alunos: [
        {
          aluno_id: a.id,
          versao: d.versao,
          campos: { proxima_acao: "Ligar na segunda", diagnostico: "Precisa de rotina" },
          ajustes: [{ campo: "health_score", valor: 42 }],
          checkpoints: [{ id: cp.id, status: "realizado", data_realizada: "2026-10-27" }, { novo: true, nome: "Revisão extra", data_prevista: "2026-11-05" }],
          intervencoes: [{ novo: true, tipo_id: tipo.id, descricao: "Contato pelo grupo" }],
        },
      ],
    });
    expect(r.lote_id).toBeTruthy();
    expect(r.resultados).toHaveLength(1);
    const res = r.resultados[0];
    if (!res.ok) throw new Error("esperava ok");
    expect(res.aluno.versao).toBe(d.versao + 1);
    expect(res.aluno.proxima_acao?.descricao).toBe("Ligar na segunda");
    expect(res.aluno.health_score).toMatchObject({ valor: 42, ajuste: { motivo: "Revisão semanal da turma" } });
    expect(res.aluno.checkpoints.find((x) => x.id === cp.id)?.status).toBe("realizado");
    expect(res.aluno.checkpoints.some((x) => x.nome === "Revisão extra")).toBe(true);
    expect(res.aluno.intervencoes.some((i) => i.descricao === "Contato pelo grupo")).toBe(true);
    const h = await buscarHistorico(a.id);
    expect(h.itens.slice(0, 6).every((x) => x.em === h.itens[0].em)).toBe(true);
  });

  it("erro parcial: o aluno com erro não grava nada e não impede os outros; 409 devolve o aluno atual", async () => {
    const [a, b, c] = await todos();
    const [da, db, dc] = await Promise.all([buscarAluno(a.id), buscarAluno(b.id), buscarAluno(c.id)]);
    const r = await salvarLote({
      alunos: [
        { aluno_id: a.id, versao: da.versao, campos: { objetivo: "Dobrar o faturamento" } },
        // ajuste sem motivo e sem motivo padrão → validação; o campo junto NÃO grava
        { aluno_id: b.id, versao: db.versao, campos: { objetivo: "NÃO DEVE GRAVAR" }, ajustes: [{ campo: "ltv", valor: 100 }] },
        { aluno_id: c.id, versao: dc.versao - 1, campos: { objetivo: "Versão velha" } },
      ],
    });
    expect(r.resultados.map((x) => [x.aluno_id, x.ok, x.ok ? null : x.error])).toEqual([
      [a.id, true, null],
      [b.id, false, "validacao"],
      [c.id, false, "versao"],
    ]);
    const erroB = r.resultados[1];
    if (erroB.ok || erroB.error !== "validacao") throw new Error("esperava validação");
    expect(erroB.campo).toBe("motivo");
    const conflito = r.resultados[2];
    if (conflito.ok || conflito.error !== "versao") throw new Error("esperava versão");
    expect(conflito.aluno.versao).toBe(dc.versao);
    expect((await buscarAluno(a.id)).objetivo).toBe("Dobrar o faturamento");
    const bDepois = await buscarAluno(b.id);
    expect(bDepois.objetivo).toBe(db.objetivo);
    expect(bDepois.versao).toBe(db.versao);
  });

  it("corpo inválido no geral: vazio ou mais de 100 alunos", async () => {
    expect((await erroDe(salvarLote({ alunos: [] }))).status).toBe(400);
    const muitos = Array.from({ length: LIMITE_LOTE + 1 }, (_, i) => ({ aluno_id: `x${i}`, versao: 1, campos: { objetivo: "x" } }));
    const e = await erroDe(salvarLote({ alunos: muitos }));
    expect(e.status).toBe(400);
    expect(e.corpo.campo).toBe("alunos");
  });
});

describe("semente D4 (só demonstração)", () => {
  it("o progresso da Fase 1 vira uma análise confirmada importada; os ajustes de progresso saem", async () => {
    const lista = await todos();
    const detalhes = await Promise.all(lista.map((a) => buscarAluno(a.id)));
    const importados = detalhes.filter((d) => d.analises.length > 0);
    expect(importados.length).toBeGreaterThan(0);
    for (const d of importados) {
      expect(d.progresso.consumiu.ajuste).toBeNull();
      expect(d.progresso.consumiu.automatico).toBe(d.analises[0].notas.consumiu);
      expect(d.progresso_origem.consumiu).toMatchObject({ tipo: "analise", analise_id: d.analises[0].id });
    }
    // A importação não inventa atividade: sem highlight, a aula fica na data de entrada.
    for (const d of importados) {
      if (!d.highlights.length) expect(d.analises[0].data_aula).toBe(d.data_entrada);
    }
  });
});
