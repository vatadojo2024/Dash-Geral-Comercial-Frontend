import { describe, expect, it } from "vitest";
import {
  descreverFiltros,
  destinoDeLinkAntigo,
  hrefDeVolta,
  hrefDoFiltro,
  hrefDoRaioX,
  lerEstado,
  queryDoEstado,
  semFiltros,
  temFiltro,
} from "./estado";

describe("estado da aba Alunos na URL", () => {
  it("lê os parâmetros válidos e ignora o resto", () => {
    const e = lerEstado(
      new URLSearchParams("etapa=etapa-1&risco=xx&checkpoint=pendente,nao_respondeu,lixo&health_max=50&ordem=-nome&pagina=2&visao=kanban"),
    );
    expect(e).toMatchObject({
      etapa: "etapa-1",
      risco: null,
      checkpoint: ["pendente", "nao_respondeu"],
      health_max: 50,
      ordem: "-nome",
      pagina: 2,
      visao: "kanban",
    });
  });

  it("ida e volta pela URL não perde nada (é o que o Raio-X usa para voltar)", () => {
    const e = lerEstado(
      new URLSearchParams("sinal=upgrade&responsavel=resp-7&risco=atencao&status_aluno=em_pausa&busca=ana&incluir_arquivados=1&visao=kanban&pagina=3"),
    );
    expect(lerEstado(new URLSearchParams(queryDoEstado(e)))).toEqual(e);
  });

  it("clique do Cockpit abre a aba Alunos só com aquele filtro", () => {
    expect(hrefDoFiltro({ checkpoint: ["pendente", "nao_respondeu"] })).toBe(
      "/educacional/alunos?checkpoint=pendente%2Cnao_respondeu",
    );
    expect(hrefDoFiltro({ etapa: "etapa-2" }, "vazio")).toBe("/educacional/alunos?etapa=etapa-2&simular=vazio");
    expect(hrefDoFiltro({})).toBe("/educacional/alunos");
  });

  it("busca: a partir de 2 letras, entra no chip e sai no limpar", () => {
    expect(lerEstado(new URLSearchParams("busca=a")).busca).toBeNull();
    const e = lerEstado(new URLSearchParams("busca=%20ana%20"));
    expect(e.busca).toBe("ana");
    expect(temFiltro(e)).toBe(true);
    expect(descreverFiltros(e)).toEqual(["Nome: “ana”"]);
    expect(semFiltros(e).busca).toBeNull();
  });

  it("responsável: “Sem responsável” na URL e no chip", () => {
    const e = lerEstado(new URLSearchParams("responsavel=sem"));
    expect(e.responsavel).toBe("sem");
    expect(descreverFiltros(e)).toEqual(["Sem responsável"]);
  });

  it("Raio-X: volta para a tela de origem, só dentro do módulo; link antigo vai para a aba Alunos", () => {
    const voltar = "/educacional/alunos?etapa=e1&visao=kanban";
    expect(hrefDoRaioX("al 1", voltar)).toBe(`/educacional/alunos/al%201?voltar=${encodeURIComponent(voltar)}`);
    expect(hrefDeVolta(voltar)).toBe(voltar);
    expect(hrefDeVolta("/educacional")).toBe("/educacional");
    expect(hrefDeVolta("etapa=e1")).toBe("/educacional/alunos?etapa=e1");
    expect(hrefDeVolta(null)).toBe("/educacional/alunos");
    expect(hrefDeVolta("//outro.site/x")).toBe("/educacional/alunos");
    expect(hrefDeVolta("/leads")).toBe("/educacional/alunos");
  });

  it("link salvo da Fase 2 com filtros leva à aba Alunos; sem filtros fica no Cockpit", () => {
    expect(destinoDeLinkAntigo(new URLSearchParams("etapa=e1&visao=kanban"))).toBe("/educacional/alunos?etapa=e1&visao=kanban");
    expect(destinoDeLinkAntigo(new URLSearchParams("ordem=nome"))).toBe("/educacional/alunos?ordem=nome");
    expect(destinoDeLinkAntigo(new URLSearchParams(""))).toBeNull();
    expect(destinoDeLinkAntigo(new URLSearchParams("simular=vazio"))).toBeNull();
  });

  it("chip de filtro ativo", () => {
    const e = lerEstado(new URLSearchParams("checkpoint=pendente,nao_respondeu&health_max=50"));
    expect(temFiltro(e)).toBe(true);
    expect(descreverFiltros(e)).toEqual(["Checkpoint: Pendente + Não respondeu", "Health Score abaixo de 50"]);
    expect(temFiltro(semFiltros(e))).toBe(false);
    const nomes = { etapa: () => "Validação", responsavel: () => "Carla Mendes" };
    expect(descreverFiltros(lerEstado(new URLSearchParams("etapa=x&responsavel=y&risco=risco")), nomes)).toEqual([
      "Etapa: Validação",
      "Faixa: Risco",
      "Responsável: Carla Mendes",
    ]);
  });

  it("id com caractere estranho na URL é ignorado", () => {
    expect(lerEstado(new URLSearchParams("etapa=../x&responsavel=a%20b")).etapa).toBeNull();
    expect(lerEstado(new URLSearchParams("responsavel=a%20b")).responsavel).toBeNull();
  });

  it("programa: vários na URL, ida e volta, chip e limpar", () => {
    const e = lerEstado(new URLSearchParams("programa=prog-a,prog-b,../x"));
    expect(e.programa).toEqual(["prog-a", "prog-b"]);
    expect(queryDoEstado(e)).toBe("programa=prog-a%2Cprog-b");
    expect(temFiltro(e)).toBe(true);
    const nomes = { programa: (id: string) => ({ "prog-a": "Blackbelt 6 meses", "prog-b": "Blackbelt 12 meses" })[id] };
    expect(descreverFiltros(e, nomes)).toEqual(["Programa: Blackbelt 6 meses + Blackbelt 12 meses"]);
    expect(semFiltros(e).programa).toEqual([]);
  });
});
