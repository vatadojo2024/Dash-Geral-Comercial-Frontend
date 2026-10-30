import { describe, expect, it } from "vitest";
import { mensagemDoCorpo, textoDoErro, traduzirCorpo, traduzirMensagem } from "./erros";

describe("traduzirMensagem — validação do backend em inglês", () => {
  it("campo vazio vira 'X é obrigatório' com o que fazer", () => {
    expect(traduzirMensagem("Invalid input: expected string, received undefined", "programa_id")).toBe(
      "Programa é obrigatório. Escolha uma opção da lista.",
    );
    expect(traduzirMensagem("Required", "data_entrada")).toBe("Data de entrada é obrigatória. Informe a data.");
    expect(traduzirMensagem("Too small: expected string to have >=1 characters", "nome")).toBe("Nome é obrigatório. Preencha o campo.");
    expect(traduzirMensagem("String must contain at least 1 character(s)", "observacoes")).toBe(
      "Observações são obrigatórias. Preencha o campo.",
    );
  });

  it("formato, opções, números e tamanho", () => {
    expect(traduzirMensagem("Invalid UUID", "responsavel_id")).toBe("Responsável: escolha uma opção da lista.");
    expect(traduzirMensagem('Invalid option: expected one of "ativo"|"pausado"', "status_aluno")).toBe(
      "Status do aluno: escolha uma das opções da lista.",
    );
    expect(traduzirMensagem("Invalid enum value. Expected 'a' | 'b', received 'c'", "nivel_inicial")).toBe(
      "Nível inicial: escolha uma das opções da lista.",
    );
    expect(traduzirMensagem("Too small: expected number to be >=1", "duracao_meses")).toBe("Duração (meses): use 1 ou mais.");
    expect(traduzirMensagem("Invalid input: expected int, received number", "dias_apos_entrada")).toBe(
      "Dia N ou Mês N: use um número inteiro.",
    );
    expect(traduzirMensagem("Expected number, received string", "prazo_sla_dias")).toBe("Prazo de SLA: use um número.");
    expect(traduzirMensagem("Too big: expected string to have <=200 characters", "descricao")).toBe(
      "Descrição pode ter no máximo 200 caracteres.",
    );
    expect(traduzirMensagem("Invalid date", "data_prevista")).toBe("Data prevista: informe uma data válida.");
    expect(traduzirMensagem("Invalid string: must match pattern /^\\d{4}-\\d{2}-\\d{2}$/", "prazo")).toBe(
      "Prazo: informe uma data válida.",
    );
    expect(traduzirMensagem('Unrecognized key: "mentoria"', "")).toBe("Não é possível alterar Mentoria por aqui.");
  });

  it("caminho do lote: usa o campo mais específico", () => {
    expect(traduzirMensagem("Invalid input: expected string, received null", "alunos.0.checkpoints.abc.data_prevista")).toBe(
      "Data prevista é obrigatória. Informe a data.",
    );
    expect(traduzirMensagem("Required", "intervencoes[novo:1].tipo_id")).toBe("Tipo de intervenção é obrigatório. Escolha uma opção da lista.");
  });

  it("várias falhas (JSON do zod ou separadas por ;) viram frases em português", () => {
    const json = JSON.stringify([
      { code: "invalid_type", path: ["nome"], message: "Invalid input: expected string, received undefined" },
      { code: "invalid_type", path: ["programa_id"], message: "Required" },
    ]);
    expect(traduzirMensagem(json, null)).toBe("Nome é obrigatório. Preencha o campo. Programa é obrigatório. Escolha uma opção da lista.");
    expect(traduzirMensagem("nome: Required; etapa_id: Invalid uuid", null)).toBe(
      "Nome é obrigatório. Preencha o campo. Etapa: escolha uma opção da lista.",
    );
  });

  it("inglês sem campo conhecido: frase genérica em português, nunca o texto cru", () => {
    expect(traduzirMensagem("Invalid input", null)).toBe("Algum dado está inválido. Confira o formulário e tente de novo.");
    expect(traduzirMensagem("Required", "xyz")).toBe("Falta preencher um campo obrigatório. Confira o formulário.");
  });
});

describe("traduzirMensagem — mensagens já em português", () => {
  it("mantém as que dizem o campo e o que fazer", () => {
    expect(traduzirMensagem("busca precisa de ao menos 2 caracteres", "busca")).toBe("Busca precisa de ao menos 2 caracteres.");
    expect(traduzirMensagem("O motivo precisa ter pelo menos 5 caracteres.", "motivo")).toBe("O motivo precisa ter pelo menos 5 caracteres.");
  });

  it("completa o campo e o que fazer quando faltam", () => {
    expect(traduzirMensagem("Campo obrigatório.", "nome")).toBe("Nome é obrigatório. Preencha o campo.");
    expect(traduzirMensagem("Data obrigatória.", "data_entrada")).toBe("Data de entrada é obrigatória. Informe a data.");
    expect(traduzirMensagem("programa inativo", "programa_id")).toBe(
      "Programa: a opção escolhida não existe mais ou foi inativada. Escolha outra na lista.",
    );
    expect(traduzirMensagem("Use um número inteiro de meses, 1 ou mais.", "duracao_meses")).toBe(
      "Duração (meses): use um número inteiro de meses, 1 ou mais.",
    );
    expect(traduzirMensagem("Etapa inexistente.", null)).toBe("A opção escolhida não existe mais ou foi inativada. Escolha outra na lista.");
    expect(traduzirMensagem("Valor fora do domínio do campo.", "valor")).toBe(
      "Valor fora do permitido. Escolha ou digite um valor válido e tente de novo.",
    );
    expect(traduzirMensagem("Valor fora da lista permitida.", "status_aluno")).toBe(
      "Status do aluno: valor fora do permitido. Escolha ou digite um valor válido e tente de novo.",
    );
    expect(traduzirMensagem("Envie a versão do aluno.", "versao")).toBe("Não foi possível salvar: atualize a página e tente de novo.");
  });
});

describe("mensagemDoCorpo / traduzirCorpo / textoDoErro", () => {
  it("sem mensagem, ou em inglês fora da validação: texto pelo status", () => {
    expect(mensagemDoCorpo(404, { error: "nao_encontrado" })).toBe(
      "Registro não encontrado. Ele pode ter sido arquivado ou removido; atualize a página.",
    );
    expect(mensagemDoCorpo(500, { error: "Internal Server Error" })).toBe(
      "O serviço educacional está com problema (erro 500). Tente de novo em instantes.",
    );
    expect(mensagemDoCorpo(403, { error: "Forbidden", mensagem: "Forbidden" })).toBe("Você não tem permissão para esta ação.");
  });

  it("400 de validação: a mensagem do corpo já sai traduzida", () => {
    const { texto, corpo } = traduzirCorpo(400, {
      error: "validacao",
      campo: "programa_id",
      mensagem: "Invalid input: expected string, received undefined",
    });
    expect(texto).toBe("Programa é obrigatório. Escolha uma opção da lista.");
    expect(corpo).toEqual({ error: "validacao", campo: "programa_id", mensagem: texto });
  });

  it("409 de etapa com alunos em inglês: tira a mensagem para a tela usar o texto dela", () => {
    const { corpo } = traduzirCorpo(409, { error: "etapa_com_alunos", alunos: 3, mensagem: "Stage has active students" });
    expect(corpo).toEqual({ error: "etapa_com_alunos", alunos: 3 });
    const pt = traduzirCorpo(409, { error: "etapa_com_alunos", alunos: 3, mensagem: "Esta etapa ainda tem 3 alunos." });
    expect(pt.corpo?.mensagem).toBe("Esta etapa ainda tem 3 alunos.");
  });

  it("erros fora da API", () => {
    expect(textoDoErro(new TypeError("Failed to fetch"))).toBe("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    expect(textoDoErro(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(
      "Algo deu errado. Tente de novo em instantes.",
    );
    expect(textoDoErro(new Error("Gravado, mas a resposta veio fora do contrato."))).toBe("Gravado, mas a resposta veio fora do contrato.");
  });
});
