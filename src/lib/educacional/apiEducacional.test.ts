import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _simularGravacaoEmTeste,
  ajustarCampo,
  arquivarAluno,
  arquivarCheckpoint,
  arquivarIntervencao,
  atualizarAluno,
  atualizarCheckpoint,
  atualizarIntervencao,
  atualizarItemConfig,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  buscarHistorico,
  buscarResumo,
  criarAluno,
  criarCheckpoint,
  criarIntervencao,
  criarItemConfig,
  definirUsuarioDaSessao,
  EducacionalError,
  FONTE_EDUCACIONAL,
  queryDosFiltros,
  restaurarDemonstracao,
  TAMANHO_PAGINA,
  voltarAoAutomatico,
} from "./apiEducacional";
import { AlunoLinhaSchema, validarAlunoDetalhe, validarLista } from "./contrato";
import { _zerarMemoria, CHAVE_BANCO } from "./mock/banco";
import { hojeBR } from "./mock/motor";

// Adapter no modo demonstração: as mesmas rotas do backend da Fase 2 sobre o
// banco do navegador. Cada teste começa da semente.

const HOJE = hojeBR();

async function primeiro(filtro = {}) {
  const { itens } = await buscarAlunos(filtro);
  return buscarAluno(itens[0].id);
}

async function erroDe(p: Promise<unknown>): Promise<EducacionalError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof EducacionalError) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

describe("leitura", () => {
  it("o padrão é mock", () => {
    expect(FONTE_EDUCACIONAL).toBe("mock");
  });

  it("filtros do Cockpit batem com KPIs, funil e sinais", async () => {
    const r = await buscarResumo();
    expect((await buscarAlunos({ checkpoint: ["pendente", "nao_respondeu"], status_aluno: null })).total).toBeGreaterThanOrEqual(
      r.kpis.intervencoes_sla,
    );
    expect((await buscarAlunos({ risco: "risco" })).itens.every((a) => a.faixa_saude.valor === "risco")).toBe(true);
    for (const f of r.funil) {
      const { itens } = await buscarAlunos({ etapa: f.etapa_id, por_pagina: "todos" });
      expect(itens.filter((a) => a.status_aluno === "ativo" || a.status_aluno === "em_pausa")).toHaveLength(f.alunos);
    }
    const upgrade = await buscarAlunos({ sinal: "upgrade" });
    expect(upgrade.itens.every((a) => a.sinais.upgrade.valor === true)).toBe(true);
  });

  it("ordem padrão: faixa (risco primeiro), depois dias na etapa desc", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    const peso = { risco: 0, atencao: 1, saudavel: 2 } as const;
    for (let i = 1; i < itens.length; i++) {
      const [a, b] = [itens[i - 1], itens[i]];
      const pa = peso[a.faixa_saude.valor!];
      const pb = peso[b.faixa_saude.valor!];
      expect(pa < pb || (pa === pb && a.dias_na_etapa.valor! >= b.dias_na_etapa.valor!)).toBe(true);
    }
  });

  it("ordenação por coluna e a inversa; página de 25; arquivados só com o filtro", async () => {
    const asc = (await buscarAlunos({ ordem: "dias_na_etapa" })).itens.map((a) => a.dias_na_etapa.valor!);
    const desc = (await buscarAlunos({ ordem: "-dias_na_etapa" })).itens.map((a) => a.dias_na_etapa.valor!);
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
    expect(desc).toEqual([...desc].sort((x, y) => y - x));
    expect(TAMANHO_PAGINA).toBe(25);
    expect((await buscarAlunos({ pagina: 2 })).itens).toHaveLength(0);
    const padrao = await buscarAlunos({});
    const comArquivados = await buscarAlunos({ incluir_arquivados: true });
    expect(padrao.itens.some((a) => a.arquivado)).toBe(false);
    expect(comArquivados.total).toBe(padrao.total + 1);
    expect(Object.keys(padrao.itens[0])).not.toContain("checkpoints");
  });

  it("Raio-X: 404 para aluno inexistente; config traz as 4 listas", async () => {
    expect((await erroDe(buscarAluno("nao-existe"))).status).toBe(404);
    const c = await buscarConfig();
    expect(c.etapas).toHaveLength(5);
    expect(c.tipos_intervencao.map((t) => t.nome)).toEqual(["Contato", "Reunião", "Ajuste de plano", "Outro"]);
    expect(c.responsaveis).toHaveLength(4);
  });

  it("querystring do modo api", () => {
    expect(
      queryDosFiltros({ checkpoint: ["pendente", "nao_respondeu"], health_max: 50, pagina: 2, ordem: "-nome", incluir_arquivados: true }),
    ).toBe("checkpoint=pendente%2Cnao_respondeu&health_max=50&incluir_arquivados=1&ordem=-nome&pagina=2");
    expect(queryDosFiltros({ ordem: "risco", pagina: 1 })).toBe("");
    expect(queryDosFiltros({ por_pagina: "todos" })).toBe("por_pagina=todos");
  });
});

describe("escrita em aluno — seção 5 do backend", () => {
  it("mudar etapa: versão sobe, dias na etapa zeram, histórico com os nomes das etapas", async () => {
    const a = await primeiro();
    const c = await buscarConfig();
    const destino = c.etapas.find((e) => e.id !== a.etapa.id)!;
    const depois = await atualizarAluno(a.id, a.versao, { etapa_id: destino.id });
    expect(depois.versao).toBe(a.versao + 1);
    expect(depois.etapa).toEqual({ id: destino.id, nome: destino.nome });
    expect(depois.etapa_desde).toBe(HOJE);
    expect(depois.dias_na_etapa.automatico).toBe(0);
    const h = await buscarHistorico(a.id);
    expect(h.itens[0]).toMatchObject({
      entidade: "aluno",
      campo: "etapa",
      valor_antes: a.etapa.nome,
      valor_depois: destino.nome,
      usuario: { id: "u-edu", nome: "Equipe Teste" },
    });
  });

  it("uma linha de histórico por campo alterado", async () => {
    const a = await primeiro();
    await atualizarAluno(a.id, a.versao, { proxima_acao: "Ligar amanhã", proxima_acao_prazo: "2026-12-01", nome: a.nome });
    const { itens } = await buscarHistorico(a.id, { entidade: "aluno" });
    const campos = itens.filter((h) => h.usuario.id === "u-edu").map((h) => h.campo);
    expect(campos.sort()).toEqual(["proxima_acao", "proxima_acao_prazo"]);
  });

  it("409: versão antiga não grava nada e devolve o aluno atual", async () => {
    const a = await primeiro();
    await atualizarAluno(a.id, a.versao, { objetivo: "Novo objetivo" });
    const antes = (await buscarHistorico(a.id)).total;
    const e = await erroDe(atualizarAluno(a.id, a.versao, { objetivo: "Outro" }));
    expect(e.status).toBe(409);
    expect(e.corpo.error).toBe("versao");
    expect(e.alunoAtual?.versao).toBe(a.versao + 1);
    expect(e.alunoAtual?.objetivo).toBe("Novo objetivo");
    expect((await buscarHistorico(a.id)).total).toBe(antes);
  });

  it("400: campo fora do domínio responde com o campo e a mensagem", async () => {
    const a = await primeiro();
    const e = await erroDe(atualizarAluno(a.id, a.versao, { nome: "   " }));
    expect(e.status).toBe(400);
    expect(e.corpo).toMatchObject({ error: "validacao", campo: "nome" });
    const e2 = await erroDe(atualizarAluno(a.id, a.versao, { data_entrada: "22/10/2026" }));
    expect(e2.corpo.campo).toBe("data_entrada");
  });

  it("arquivar e reativar", async () => {
    const a = await primeiro();
    const arq = await arquivarAluno(a.id, a.versao);
    expect(arq.arquivado).toBe(true);
    expect((await buscarAlunos({ por_pagina: "todos" })).itens.some((x) => x.id === a.id)).toBe(false);
    const volta = await arquivarAluno(a.id, arq.versao, false);
    expect(volta.arquivado).toBe(false);
  });

  it("aluno novo recebe os checkpoints ativos do modelo (entrada + dias, previsto)", async () => {
    const c = await buscarConfig();
    const novo = await criarAluno({
      nome: "Paula Teste",
      mentoria: "Mentoria Prime",
      data_entrada: "2026-11-02",
      nivel_inicial: "iniciante",
      etapa_id: c.etapas[0].id,
    });
    expect(novo.versao).toBe(1);
    expect(novo.status_aluno).toBe("ativo");
    expect(novo.autorizacao_prova_social).toBe("pendente");
    expect(novo.checkpoints.map((x) => [x.nome, x.data_prevista, x.status])).toEqual([
      ["Dia 0", "2026-11-02", "previsto"],
      ["Semana 1", "2026-11-09", "previsto"],
      ["Mês 1", "2026-12-02", "previsto"],
      ["Mês 2", "2027-01-01", "previsto"],
      ["Mês 3", "2027-01-31", "previsto"],
      ["Mês 4", "2027-03-02", "previsto"],
      ["Mês 5", "2027-04-01", "previsto"],
      ["Mês 6", "2027-05-01", "previsto"],
    ]);
    expect(novo.checkpoints.find((x) => x.nome === "Mês 3")?.big_win).toBe(true);
    expect((await buscarAlunos({ por_pagina: "todos" })).itens.some((x) => x.id === novo.id)).toBe(true);
    const e = await erroDe(criarAluno({ nome: "", mentoria: "X", data_entrada: "2026-11-02", nivel_inicial: "iniciante", etapa_id: c.etapas[0].id }));
    expect(e.corpo.campo).toBe("nome");
  });
});

describe("ajuste manual", () => {
  it("motivo obrigatório (≥ 5) e valor no domínio do campo", async () => {
    const a = await primeiro();
    expect((await erroDe(ajustarCampo(a.id, a.versao, "health_score", 40, "ok"))).corpo.campo).toBe("motivo");
    expect((await erroDe(ajustarCampo(a.id, a.versao, "health_score", 140, "Motivo válido"))).corpo.campo).toBe("valor");
  });

  it("Health ajustado recalcula a faixa; voltar ao automático limpa; tudo no histórico", async () => {
    const a = await primeiro({ risco: "saudavel" });
    const aj = await ajustarCampo(a.id, a.versao, "health_score", 30, "Aluno sumiu do grupo");
    expect(aj.health_score).toMatchObject({ valor: 30, ajuste: { motivo: "Aluno sumiu do grupo", ajustado_por: { id: "u-edu" } } });
    expect(aj.faixa_saude.automatico).toBe("risco");
    const volta = await voltarAoAutomatico(a.id, aj.versao, "health_score");
    expect(volta.health_score).toEqual({ valor: null, automatico: null, ajuste: null });
    const { itens } = await buscarHistorico(a.id, { entidade: "ajuste" });
    expect(itens.slice(0, 2).map((h) => [h.campo, h.valor_antes, h.valor_depois, h.motivo])).toEqual([
      ["health_score", 30, null, "Voltou ao automático"],
      ["health_score", a.health_score.valor, 30, "Aluno sumiu do grupo"],
    ]);
  });

  it("ajuste sobrevive ao recálculo (mudança de etapa)", async () => {
    const a = await primeiro();
    const aj = await ajustarCampo(a.id, a.versao, "dias_na_etapa", 5, "Contagem corrigida");
    const c = await buscarConfig();
    const depois = await atualizarAluno(a.id, aj.versao, { etapa_id: c.etapas.find((e) => e.id !== a.etapa.id)!.id });
    expect(depois.dias_na_etapa).toMatchObject({ valor: 5, automatico: 0 });
  });
});

describe("checkpoints e intervenções", () => {
  it("realizado sem data usa hoje; próximo checkpoint anda; avulso e arquivar", async () => {
    const a = await primeiro({ checkpoint: ["pendente"] });
    const cp = a.proximo_checkpoint!;
    const r = await atualizarCheckpoint(cp.id, a.versao, { status: "realizado" });
    expect(r.checkpoints.find((x) => x.id === cp.id)).toMatchObject({ status: "realizado", data_realizada: HOJE });
    expect(r.proximo_checkpoint?.id).not.toBe(cp.id);
    expect(r.ultima_atividade.automatico).toBe(HOJE);
    const avulso = await criarCheckpoint(a.id, r.versao, { nome: "Call extra", data_prevista: "2026-12-10" });
    const novo = avulso.checkpoints.find((x) => x.nome === "Call extra")!;
    expect(novo).toMatchObject({ status: "previsto", big_win: false });
    const arq = await arquivarCheckpoint(novo.id, avulso.versao);
    expect(arq.checkpoints.some((x) => x.id === novo.id)).toBe(false);
    expect(arq.versao).toBe(a.versao + 3);
  });

  it("intervenção: criar, editar, concluir, reabrir, arquivar", async () => {
    const a = await primeiro();
    const c = await buscarConfig();
    const criada = await criarIntervencao(a.versao, {
      aluno_id: a.id,
      tipo_id: c.tipos_intervencao[0].id,
      descricao: "Ligação de acompanhamento",
      responsavel_id: c.responsaveis[0].id,
      prazo: "2026-12-01",
    });
    const i = criada.intervencoes.find((x) => x.descricao === "Ligação de acompanhamento")!;
    expect(i).toMatchObject({ status: "aberta", concluida_em: null, criada_por: { id: "u-edu" } });
    const ed = await atualizarIntervencao(i.id, criada.versao, { descricao: "Ligação feita" });
    const conc = await atualizarIntervencao(i.id, ed.versao, { status: "concluida" });
    expect(conc.intervencoes.find((x) => x.id === i.id)?.concluida_em).toBeTruthy();
    expect(conc.ultima_atividade.automatico).toBe(HOJE);
    const reab = await atualizarIntervencao(i.id, conc.versao, { status: "aberta" });
    expect(reab.intervencoes.find((x) => x.id === i.id)).toMatchObject({ status: "aberta", concluida_em: null });
    const arq = await arquivarIntervencao(i.id, reab.versao);
    expect(arq.intervencoes.some((x) => x.id === i.id)).toBe(false);
    const e = await erroDe(criarIntervencao(arq.versao, { aluno_id: a.id, tipo_id: c.tipos_intervencao[0].id, descricao: " " }));
    expect(e.corpo.campo).toBe("descricao");
    const h = await buscarHistorico(a.id, { entidade: "intervencao" });
    expect(h.itens.map((x) => x.campo)).toEqual(["arquivada", "status", "status", "descricao", "criada"]);
  });

  it("histórico da intervenção traz tipo e responsável pelo nome", async () => {
    const a = await primeiro();
    const c = await buscarConfig();
    const i = a.intervencoes[0];
    const outro = c.tipos_intervencao.find((t) => t.id !== i.tipo.id)!;
    await atualizarIntervencao(i.id, a.versao, { tipo_id: outro.id });
    const { itens } = await buscarHistorico(a.id, { entidade: "intervencao" });
    expect(itens[0]).toMatchObject({ campo: "tipo", valor_antes: i.tipo.nome, valor_depois: outro.nome });
  });
});

describe("configuração", () => {
  it("inativar etapa com alunos → 409 com a contagem; etapa vazia inativa", async () => {
    const r = await buscarResumo();
    const cheia = r.funil.find((f) => f.alunos > 0)!;
    const e = await erroDe(atualizarItemConfig("etapas", cheia.etapa_id, { ativo: false }));
    expect(e.status).toBe(409);
    expect(e.corpo).toMatchObject({ error: "etapa_com_alunos", alunos: cheia.alunos });
    const c = await criarItemConfig("etapas", { nome: "Pós-mentoria" });
    const nova = c.etapas.at(-1)!;
    expect(nova).toMatchObject({ nome: "Pós-mentoria", ordem: 6, ativo: true });
    const c2 = await atualizarItemConfig("etapas", nova.id, { ativo: false });
    expect(c2.etapas.find((x) => x.id === nova.id)?.ativo).toBe(false);
  });

  it("checkpoint modelo novo vale só para alunos novos", async () => {
    const antigo = await primeiro();
    await criarItemConfig("checkpoints-modelo", { nome: "Mês 7", dias_apos_entrada: 210 });
    expect((await buscarAluno(antigo.id)).checkpoints.some((x) => x.nome === "Mês 7")).toBe(false);
    const c = await buscarConfig();
    const novo = await criarAluno({ nome: "Rita Nova", mentoria: "Mentoria Prime", data_entrada: HOJE, nivel_inicial: "avancado", etapa_id: c.etapas[0].id });
    expect(novo.checkpoints.at(-1)?.nome).toBe("Mês 7");
    expect((await erroDe(criarItemConfig("checkpoints-modelo", { nome: "X", dias_apos_entrada: -1 }))).corpo.campo).toBe(
      "dias_apos_entrada",
    );
  });
});

describe("persistência e simulação", () => {
  const guardado = new Map<string, string>();
  beforeEach(() => {
    guardado.clear();
    vi.stubGlobal("window", {
      location: { search: "" },
      localStorage: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => void guardado.set(k, v),
        removeItem: (k: string) => void guardado.delete(k),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a mudança sobrevive ao recarregar (localStorage) e 'Restaurar' volta à semente", async () => {
    const a = await primeiro();
    await atualizarAluno(a.id, a.versao, { nome: "Nome Persistido" });
    expect(guardado.get(CHAVE_BANCO)).toContain("Nome Persistido");
    _zerarMemoria(); // "recarregar a página"
    expect((await buscarAluno(a.id)).nome).toBe("Nome Persistido");
    await restaurarDemonstracao();
    _zerarMemoria();
    expect((await buscarAluno(a.id)).nome).toBe(a.nome);
  });

  it("escrita com erro não persiste nada", async () => {
    const a = await primeiro();
    await erroDe(atualizarAluno(a.id, a.versao, { nome: "Ok", data_entrada: "errada" }));
    _zerarMemoria();
    expect((await buscarAluno(a.id)).nome).toBe(a.nome);
  });

  it("localStorage quebrado: segue em memória sem derrubar a tela", async () => {
    vi.stubGlobal("window", {
      location: { search: "" },
      get localStorage(): Storage {
        throw new Error("bloqueado");
      },
    });
    const a = await primeiro();
    expect((await atualizarAluno(a.id, a.versao, { nome: "Em memória" })).nome).toBe("Em memória");
    expect((await buscarAluno(a.id)).nome).toBe("Em memória");
  });

  it("?simular_gravacao=409|400|rede", async () => {
    const a = await primeiro();
    _simularGravacaoEmTeste("409");
    const e409 = await erroDe(atualizarAluno(a.id, a.versao, { nome: "X" }));
    expect(e409.status).toBe(409);
    expect(e409.alunoAtual?.versao).toBe(a.versao + 1);
    _simularGravacaoEmTeste("400");
    expect((await erroDe(atualizarAluno(a.id, a.versao + 1, { nome: "X" }))).status).toBe(400);
    _simularGravacaoEmTeste("rede");
    const rede = await erroDe(atualizarAluno(a.id, a.versao + 1, { nome: "X" }));
    expect(rede.rede).toBe(true);
    _simularGravacaoEmTeste(null);
    expect((await buscarAluno(a.id)).nome).toBe(a.nome);
  });
});

describe("tolerância item a item", () => {
  it("registro inválido é descartado e logado; os outros ficam", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { itens } = await buscarAlunos({});
    const r = validarLista([itens[0], { id: "x", nome: "Sem o resto" }, itens[1]], AlunoLinhaSchema, "aluno");
    expect(r.validos).toHaveLength(2);
    expect(r.descartados).toBe(1);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("no Raio-X, checkpoint inválido sai e o aluno fica", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = await primeiro();
    const r = validarAlunoDetalhe({ ...a, checkpoints: [...a.checkpoints, { nome: "quebrado" }] });
    expect(r?.checkpoints).toHaveLength(a.checkpoints.length);
    aviso.mockRestore();
  });
});
