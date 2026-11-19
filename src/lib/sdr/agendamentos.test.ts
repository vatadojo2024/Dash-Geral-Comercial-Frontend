import { describe, expect, it } from "vitest";
import {
  agregarAgendamentos,
  chaveProduto,
  labelProdutoCompleto,
  nomeCloser,
  nomeSdr,
  SEM_CLOSER,
  SEM_PRODUTO,
  SEM_SDR,
  type Agendamento,
} from "./agendamentos";

// Factory de agendamento (shape do endpoint) com defaults neutros.
function ag(p: Partial<Agendamento>): Agendamento {
  return {
    lead_id: "l1",
    nome_exibicao: "Lead",
    sdr_id: null,
    sdr_nome: null,
    closer_id: null,
    closer_nome: null,
    produto: null,
    produto_variante: null,
    agendado_em: "2026-07-22T13:00:00-03:00",
    data_call: null,
    resolvido: true,
    ...p,
  };
}

describe("helpers de nome/produto", () => {
  it("nomeSdr: nome → id → Sem SDR (Hana já vem como nome)", () => {
    expect(nomeSdr(ag({ sdr_nome: "Glaucio" }))).toBe("Glaucio");
    expect(nomeSdr(ag({ sdr_nome: "Hana" }))).toBe("Hana");
    expect(nomeSdr(ag({ sdr_nome: null, sdr_id: "uuid-x" }))).toBe("uuid-x");
    expect(nomeSdr(ag({ sdr_nome: null, sdr_id: null }))).toBe(SEM_SDR);
  });

  it("nomeCloser: nome → id → Sem closer", () => {
    expect(nomeCloser(ag({ closer_nome: "Marcio" }))).toBe("Marcio");
    expect(nomeCloser(ag({ closer_nome: null, closer_id: "uuid-c" }))).toBe("uuid-c");
    expect(nomeCloser(ag({ closer_nome: null, closer_id: null }))).toBe(SEM_CLOSER);
  });

  it("chaveProduto: normaliza e cai em Sem produto", () => {
    expect(chaveProduto(ag({ produto: "Black" }))).toBe("black");
    expect(chaveProduto(ag({ produto: "Private" }))).toBe("private");
    expect(chaveProduto(ag({ produto: null }))).toBe(SEM_PRODUTO);
    expect(chaveProduto(ag({ produto: "Desconhecido" }))).toBe(SEM_PRODUTO);
  });

  it("labelProdutoCompleto: junta base + variante", () => {
    expect(labelProdutoCompleto(ag({ produto: "Black", produto_variante: "Anual" }))).toBe("Black Anual");
    expect(labelProdutoCompleto(ag({ produto: "QC", produto_variante: null }))).toBe("QC");
    expect(labelProdutoCompleto(ag({ produto: null }))).toBe(SEM_PRODUTO);
  });
});

describe("agregarAgendamentos — matrizes e totais", () => {
  const itens = [
    ag({ lead_id: "1", sdr_nome: "Glaucio", closer_nome: "Marcio", produto: "Private" }),
    ag({ lead_id: "2", sdr_nome: "Glaucio", closer_nome: "Marcio", produto: "Ninja" }),
    ag({ lead_id: "3", sdr_nome: "Glaucio", closer_nome: "Giba", produto: "Prime" }),
    ag({ lead_id: "4", sdr_nome: "Benhur", closer_nome: "Marcio", produto: null }),
  ];
  const agg = agregarAgendamentos(itens);

  it("SDRs e closers em ordem alfabética", () => {
    expect(agg.sdrs).toEqual(["Benhur", "Glaucio"]);
    expect(agg.closers).toEqual(["Giba", "Marcio"]);
  });

  it("matriz SDR × Closer com totais de borda", () => {
    expect(agg.matrizCloser["Glaucio"]).toEqual({ Marcio: 2, Giba: 1 });
    expect(agg.totalPorSdr["Glaucio"]).toBe(3);
    expect(agg.totalPorSdr["Benhur"]).toBe(1);
    expect(agg.totalPorCloser["Marcio"]).toBe(3);
    expect(agg.totalPorCloser["Giba"]).toBe(1);
    expect(agg.total).toBe(4);
  });

  it("matriz SDR × Produto (com Sem produto)", () => {
    expect(agg.matrizProduto["Glaucio"]).toEqual({ private: 1, ninja: 1, prime: 1 });
    expect(agg.matrizProduto["Benhur"]).toEqual({ [SEM_PRODUTO]: 1 });
    expect(agg.totalPorProduto["private"]).toBe(1);
    expect(agg.totalPorProduto[SEM_PRODUTO]).toBe(1);
  });

  it("resumo por closer com quebra de produto", () => {
    const marcio = agg.resumoPorCloser.find((c) => c.closer === "Marcio")!;
    expect(marcio.total).toBe(3);
    expect(marcio.porProduto).toEqual({ private: 1, ninja: 1, [SEM_PRODUTO]: 1 });
  });
});

describe("agregarAgendamentos — placeholders e vazio", () => {
  it("sdr/closer nulos viram placeholders e vão para o fim", () => {
    const itens = [
      ag({ lead_id: "1", sdr_nome: "Ana", closer_nome: "Zeca" }),
      ag({ lead_id: "2", sdr_nome: null, sdr_id: null, closer_nome: null, closer_id: null }),
    ];
    const agg = agregarAgendamentos(itens);
    expect(agg.sdrs).toEqual(["Ana", SEM_SDR]);
    expect(agg.closers).toEqual(["Zeca", SEM_CLOSER]);
    expect(agg.matrizCloser[SEM_SDR][SEM_CLOSER]).toBe(1);
  });

  it("lista vazia devolve agregado vazio", () => {
    const agg = agregarAgendamentos([]);
    expect(agg.total).toBe(0);
    expect(agg.sdrs).toEqual([]);
    expect(agg.closers).toEqual([]);
    expect(agg.resumoPorCloser).toEqual([]);
  });
});
