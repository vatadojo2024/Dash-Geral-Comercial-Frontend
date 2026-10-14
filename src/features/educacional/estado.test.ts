import { describe, expect, it } from "vitest";
import { descreverFiltros, hrefDoFiltro, lerEstado, queryDoEstado, semFiltros, temFiltro } from "./estado";

describe("estado da Tabela tática na URL", () => {
  it("lê os parâmetros válidos e ignora o resto", () => {
    const e = lerEstado(
      new URLSearchParams("etapa=validacao&risco=xx&checkpoint=pendente,nao_respondeu,lixo&health_max=50&ordem=-nome&pagina=2&visao=kanban"),
    );
    expect(e).toMatchObject({
      etapa: "validacao",
      risco: null,
      checkpoint: ["pendente", "nao_respondeu"],
      health_max: 50,
      ordem: "-nome",
      pagina: 2,
      visao: "kanban",
    });
  });

  it("ida e volta pela URL não perde nada (é o que o Raio-X usa para voltar)", () => {
    const e = lerEstado(new URLSearchParams("sinal=upgrade&responsavel=Carla%20Mendes&visao=kanban&pagina=3"));
    expect(lerEstado(new URLSearchParams(queryDoEstado(e)))).toEqual(e);
  });

  it("clique do Cockpit troca os filtros, mantém a visão e desce até a tabela", () => {
    const atual = lerEstado(new URLSearchParams("etapa=validacao&visao=kanban&pagina=2"));
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
  });
});
