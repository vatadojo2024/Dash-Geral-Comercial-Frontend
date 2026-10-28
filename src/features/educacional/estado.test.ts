import { describe, expect, it } from "vitest";
import { descreverFiltros, hrefDoFiltro, lerEstado, queryDoEstado, semFiltros, temFiltro } from "./estado";

describe("estado da Tabela tática na URL", () => {
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
    const e = lerEstado(new URLSearchParams("sinal=upgrade&responsavel=resp-7&risco=atencao&incluir_arquivados=1&visao=kanban&pagina=3"));
    expect(lerEstado(new URLSearchParams(queryDoEstado(e)))).toEqual(e);
  });

  it("clique do Cockpit troca os filtros, mantém a visão e desce até a tabela", () => {
    const atual = lerEstado(new URLSearchParams("etapa=etapa-1&visao=kanban&pagina=2"));
    expect(hrefDoFiltro(atual, { checkpoint: ["pendente", "nao_respondeu"] })).toBe(
      "/educacional?checkpoint=pendente%2Cnao_respondeu&visao=kanban#tabela-tatica",
    );
    expect(hrefDoFiltro(atual, {})).toBe("/educacional?visao=kanban#tabela-tatica");
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
