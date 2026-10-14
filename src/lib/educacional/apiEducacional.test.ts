import { describe, expect, it, vi } from "vitest";
import {
  buscarAluno,
  buscarAlunos,
  buscarResumo,
  criarIntervencao,
  EducacionalError,
  FONTE_EDUCACIONAL,
  queryDosFiltros,
  TAMANHO_PAGINA,
} from "./apiEducacional";
import { AlunoLinhaSchema, validarAlunoDetalhe, validarLista } from "./contrato";

describe("adapter educacional — modo mock (padrão)", () => {
  it("o padrão é mock", () => {
    expect(FONTE_EDUCACIONAL).toBe("mock");
  });

  it("filtros do Cockpit batem com os KPIs, o funil e os sinais", async () => {
    const r = await buscarResumo();
    const sla = await buscarAlunos({ checkpoint: ["pendente", "nao_respondeu"] });
    expect(sla.total).toBe(r.kpis.intervencoes_sla);
    expect((await buscarAlunos({ health_max: 50 })).total).toBe(r.kpis.em_risco);
    for (const f of r.funil) expect((await buscarAlunos({ etapa: f.etapa })).total).toBe(f.alunos);
    expect((await buscarAlunos({ sinal: "upgrade" })).total).toBe(r.sinais.upgrade);
    expect((await buscarAlunos({})).total).toBe(r.kpis.alunos_ativos);
  });

  it("ordem padrão: Risco → Atenção → Saudável, depois dias estagnados desc", async () => {
    const { itens } = await buscarAlunos({});
    const peso = { risco: 0, atencao: 1, saudavel: 2 } as const;
    for (let i = 1; i < itens.length; i++) {
      const a = itens[i - 1];
      const b = itens[i];
      expect(peso[a.risco] < peso[b.risco] || (peso[a.risco] === peso[b.risco] && a.dias_estagnados >= b.dias_estagnados)).toBe(true);
    }
  });

  it("ordenação por coluna e a inversa", async () => {
    const asc = (await buscarAlunos({ ordem: "dias_estagnados" })).itens.map((a) => a.dias_estagnados);
    const desc = (await buscarAlunos({ ordem: "-dias_estagnados" })).itens.map((a) => a.dias_estagnados);
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
    expect(desc).toEqual([...desc].sort((x, y) => y - x));
  });

  it("página de 25 e só campos de AlunoLinha na lista", async () => {
    expect(TAMANHO_PAGINA).toBe(25);
    const p2 = await buscarAlunos({ pagina: 2 });
    expect(p2.itens).toHaveLength(0);
    const { itens } = await buscarAlunos({});
    expect(Object.keys(itens[0])).not.toContain("checkpoints");
  });

  it("estados simulados: erro, vazio e sem permissão", async () => {
    await expect(buscarResumo("erro")).rejects.toBeInstanceOf(EducacionalError);
    await expect(buscarAlunos({}, "sem_permissao")).rejects.toMatchObject({ status: 403 });
    expect((await buscarAlunos({}, "vazio")).total).toBe(0);
  });

  it("Raio-X: 404 para aluno inexistente; intervenção nova aparece no topo até recarregar", async () => {
    await expect(buscarAluno("nao-existe")).rejects.toMatchObject({ status: 404 });
    const { itens } = await buscarAlunos({});
    const id = itens[0].id;
    const antes = await buscarAluno(id);
    const nova = await criarIntervencao({
      aluno_id: id,
      tipo: "contato",
      descricao: "Ligação de acompanhamento",
      responsavel: { tipo: "mentor", nome: "Carla Mendes" },
      prazo: "2026-10-20",
    });
    const depois = await buscarAluno(id);
    expect(depois.intervencoes).toHaveLength(antes.intervencoes.length + 1);
    expect(depois.intervencoes[0].id).toBe(nova.id);
  });

  it("intervenção sem descrição é recusada antes de gravar", async () => {
    const { itens } = await buscarAlunos({});
    await expect(
      criarIntervencao({ aluno_id: itens[0].id, tipo: "outro", descricao: "  ", responsavel: { tipo: "suporte", nome: "X" }, prazo: null }),
    ).rejects.toThrow();
  });

  it("querystring do modo api segue a seção 8.3", () => {
    expect(queryDosFiltros({ checkpoint: ["pendente", "nao_respondeu"], health_max: 50, pagina: 2, ordem: "-nome" })).toBe(
      "checkpoint=pendente%2Cnao_respondeu&health_max=50&ordem=-nome&pagina=2",
    );
    expect(queryDosFiltros({ ordem: "risco", pagina: 1 })).toBe("");
  });
});

describe("tolerância aluno a aluno", () => {
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
    const { itens } = await buscarAlunos({});
    const a = await buscarAluno(itens[0].id);
    const r = validarAlunoDetalhe({ ...a, checkpoints: [...a.checkpoints, { nome: "quebrado" }] });
    expect(r?.checkpoints).toHaveLength(a.checkpoints.length);
    aviso.mockRestore();
  });
});
