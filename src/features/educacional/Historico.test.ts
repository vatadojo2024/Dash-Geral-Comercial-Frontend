import { describe, expect, it } from "vitest";
import type { ItemHistorico } from "@/lib/educacional/contrato";
import { formatarDoHistorico } from "./Historico";

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
  });
});
