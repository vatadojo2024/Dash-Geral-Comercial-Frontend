import { describe, expect, it } from "vitest";
import type { ItemHistorico } from "@/lib/educacional/contrato";
import { formatarDoHistorico, rotuloDaMudanca } from "./Historico";

// Valores como o backend da Fase 2 grava no histórico (teste de integração de 27/10).
const item = (entidade: ItemHistorico["entidade"], campo: string): ItemHistorico => ({
  id: "h1",
  em: "2026-10-27T18:03:00Z",
  usuario: { id: "u1", nome: "Equipe" },
  entidade,
  campo,
  valor_antes: null,
  valor_depois: null,
  motivo: null,
});

describe("mural: rótulo e nomes", () => {
  it("usa o nome da coluna da planilha; campo sem coluna (cru) ganha o nosso nome", () => {
    expect(rotuloDaMudanca({ entidade: "aluno", campo: "proxima_acao", rotulo: "Próxima Ação" })).toBe("Próxima Ação");
    expect(rotuloDaMudanca({ entidade: "aula", campo: "status", rotulo: "Aula 3 · Status" })).toBe("Aula 3 · Status");
    expect(rotuloDaMudanca({ entidade: "aluno", campo: "programa_id", rotulo: "programa_id" })).toBe("Programa");
    expect(rotuloDaMudanca({ entidade: "aula", campo: "mentor_id", rotulo: "Aula 3 · mentor_id" })).toBe("Aula 3 · Mentor");
    expect(rotuloDaMudanca({ entidade: "ajuste", campo: "health_score", rotulo: "health_score" })).not.toBe("health_score");
  });

  it("mentor e os ids do objeto de criação viram nome; nunca um id cru", () => {
    const id = "6f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
    const nomes = { responsavel: () => "Di Pauli", etapa: () => "Onboarding", tipo: () => "Contato" };
    expect(formatarDoHistorico({ entidade: "aula", campo: "mentor_id" }, id, nomes)).toBe("Di Pauli");
    expect(formatarDoHistorico({ entidade: "aula", campo: "criada" }, { mentor_id: id, status: "noshow" }, nomes)).toBe("Di Pauli · NoShow");
    expect(formatarDoHistorico({ entidade: "aluno", campo: "criado" }, { etapa_id: id, responsavel_id: id }, nomes)).toBe("Onboarding · Di Pauli");
    expect(formatarDoHistorico({ entidade: "aula", campo: "mentor_id" }, id)).toBe("Registro não encontrado");
    expect(formatarDoHistorico({ entidade: "aula", campo: "hora" }, "08:30:00")).toBe("08:30");
  });
});

describe("formatarDoHistorico", () => {
  it("cadastro em objeto vira texto, cada campo formatado e sem os vazios", () => {
    expect(formatarDoHistorico(item("intervencao", "criada"), { prazo: null, descricao: "Ligar" })).toBe("Ligar");
    expect(formatarDoHistorico(item("aluno", "criado"), { nome: "Ana", data_entrada: "2026-10-27" })).toBe("Ana · 27/10/2026");
    expect(
      formatarDoHistorico(item("checkpoint", "Call extra · criado"), { nome: "Call extra", status: "previsto", data_prevista: "2026-12-10" }),
    ).toBe("Call extra · Previsto · 10/12/2026");
    expect(formatarDoHistorico(item("aluno", "criado"), { observacoes: null })).toBe("—");
  });

  it("texto do modo demonstração continua igual", () => {
    expect(formatarDoHistorico(item("aluno", "criado"), "Ana")).toBe("Ana");
    expect(formatarDoHistorico(item("aluno", "status_aluno"), "em_pausa")).toBe("Em pausa");
    // Troca de programa: o status de quem saiu da jornada aparece com rótulo.
    expect(formatarDoHistorico(item("checkpoint", "Fim · substituido"), "pendente")).toBe("Pendente");
    // Como a produção manda (29/10): status virando "substituido" e o programa por id.
    expect(formatarDoHistorico(item("checkpoint", "Mês 1 · status"), "substituido")).toBe("Substituído (troca de programa)");
    const uuid = "96fad286-ece7-40d6-809c-f504683fdb12";
    expect(formatarDoHistorico(item("aluno", "programa_id"), uuid, { programa: (id) => (id === uuid ? "Blackbelt 6 meses" : undefined) })).toBe(
      "Blackbelt 6 meses",
    );
    expect(formatarDoHistorico(item("aluno", "programa_id"), uuid)).toBe("Programa não encontrado");
    expect(formatarDoHistorico(item("aluno", "etapa_id"), uuid)).toBe("Registro não encontrado");
  });
});
