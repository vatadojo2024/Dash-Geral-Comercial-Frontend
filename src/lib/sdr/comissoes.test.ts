import { describe, expect, it } from "vitest";
import { calcularComissaoSdr, type EntradaComissaoSdr } from "@/lib/salesops/comissaoSdr";
import {
  comissoesPorSdr,
  ComissoesResponseSchema,
  numerosDoCard,
  totalDoTime,
} from "./comissoes";

const RESPOSTA = {
  mes: "2026-10",
  atualizado_em: "2026-10-26T09:55:00-03:00",
  comissoes: [
    { mes: "2026-10", sdr: "Delrue", comissao: 5640 },
    { mes: "2026-10", sdr: "Glaucio", comissao: 3023 },
    { mes: "2026-10", sdr: "Benhur", comissao: 4392 },
  ],
};

function resultado(parcial: Partial<EntradaComissaoSdr> = {}) {
  return calcularComissaoSdr({
    reunioesQualificadas: 30,
    qualificadosParaMeta: 30,
    callsQC: 6,
    volumeVendas: 0,
    metas: [40, 50, 60],
    ...parcial,
  });
}

describe("ComissoesResponseSchema — contrato de /api/sdr/comissoes", () => {
  it("aceita a resposta documentada", () => {
    const r = ComissoesResponseSchema.safeParse(RESPOSTA);
    expect(r.success).toBe(true);
    expect(r.success && r.data.comissoes).toHaveLength(3);
  });

  it("tolera atualizado_em nulo/ausente e campos a mais", () => {
    expect(ComissoesResponseSchema.safeParse({ mes: "2026-10", atualizado_em: null, comissoes: [] }).success).toBe(true);
    expect(
      ComissoesResponseSchema.safeParse({
        mes: "2026-10",
        comissoes: [{ sdr: "Delrue", comissao: 1, extra: "x" }],
      }).success,
    ).toBe(true);
  });

  it("recusa comissão ausente ou em texto, e lista ausente", () => {
    expect(ComissoesResponseSchema.safeParse({ mes: "2026-10", comissoes: [{ sdr: "Delrue" }] }).success).toBe(false);
    expect(
      ComissoesResponseSchema.safeParse({ mes: "2026-10", comissoes: [{ sdr: "Delrue", comissao: "5640" }] }).success,
    ).toBe(false);
    expect(ComissoesResponseSchema.safeParse({ mes: "2026-10" }).success).toBe(false);
  });
});

describe("comissoesPorSdr", () => {
  it("casa o nome do Financeiro com o SDR do dashboard (normalizarSdr)", () => {
    const mapa = comissoesPorSdr({
      ...RESPOSTA,
      comissoes: [
        { sdr: "Guilherme Delrue", comissao: 100 },
        { sdr: "GLÁUCIO Portela", comissao: 200 },
        { sdr: "Fulano", comissao: 999 },
      ],
    });
    expect(mapa.get("Delrue")).toBe(100);
    expect(mapa.get("Glaucio")).toBe(200);
    expect(mapa.size).toBe(2);
  });

  it("SDR sem linha não entra no mapa (não vira zero)", () => {
    const mapa = comissoesPorSdr(RESPOSTA);
    expect(mapa.has("Arthur")).toBe(false);
  });

  it("ignora linha de outro mês", () => {
    const mapa = comissoesPorSdr({ ...RESPOSTA, comissoes: [{ mes: "2026-09", sdr: "Delrue", comissao: 1 }] });
    expect(mapa.size).toBe(0);
  });
});

describe("numerosDoCard", () => {
  it("total vem do backend; vendas = total − reuniões − QC", () => {
    // Abaixo da M1: 30 × R$ 40 = 1200; 6 QC → 2 × 20 = 40.
    const n = numerosDoCard(resultado(), 30, 1940);
    expect(n.total).toBe(1940);
    expect(n.comissaoVendas).toBe(700);
  });

  it("projeção: caixa estimado (diferença ÷ taxa atual) na taxa e valor/reunião do próximo patamar", () => {
    // caixa = 700 / 0,7% = 100.000 → M1: 30 × 60 + 40 + 1,2% × 100.000 = 3040.
    const n = numerosDoCard(resultado(), 30, 1940);
    expect(n.projecao).toEqual({ meta: 40, valorPorReuniao: 60, taxaVenda: 0.012, total: 3040 });
  });

  it("SDR sem linha no backend: sem total, sem vendas, sem projeção", () => {
    const n = numerosDoCard(resultado(), 30, undefined);
    expect(n).toEqual({ total: null, comissaoVendas: null, projecao: null });
  });

  it("diferença negativa: vendas '—' (null) e projeção escondida, total mantido", () => {
    const n = numerosDoCard(resultado(), 30, 1000);
    expect(n.total).toBe(1000);
    expect(n.comissaoVendas).toBeNull();
    expect(n.projecao).toBeNull();
  });

  it("diferença zero: vendas R$ 0 e projeção só com reuniões/QC", () => {
    const n = numerosDoCard(resultado(), 30, 1240);
    expect(n.comissaoVendas).toBe(0);
    expect(n.projecao?.total).toBe(1840);
  });

  it("patamar máximo: sem projeção", () => {
    const n = numerosDoCard(resultado({ qualificadosParaMeta: 60 }), 30, 5000);
    expect(n.comissaoVendas).toBe(5000 - 3000 - 40);
    expect(n.projecao).toBeNull();
  });

  it("SDR sem comissão (Hana) ignora qualquer total", () => {
    const n = numerosDoCard(resultado({ metas: null }), 30, 500);
    expect(n.total).toBeNull();
  });
});

describe("totalDoTime", () => {
  it("soma só o que veio do backend", () => {
    const comLinha = numerosDoCard(resultado(), 30, 1940);
    const negativa = numerosDoCard(resultado(), 30, 1000);
    const semLinha = numerosDoCard(resultado(), 30, undefined);
    expect(totalDoTime([comLinha, negativa, semLinha])).toBe(2940);
    expect(totalDoTime([semLinha])).toBe(0);
  });
});
