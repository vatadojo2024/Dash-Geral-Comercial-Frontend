import { describe, expect, it } from "vitest";
import {
  alcancaramNoDegrau,
  curvaInconsistente,
  filtrarMedidos,
  pontosDaCurva,
  RetencaoResponseSchema,
  rotuloMinutos,
  type LeadRetencao,
} from "./retencao";

const CURVA = [
  { percentual: 3, minutos: 5, tag: "Assistiu 3%", alcancaram: 1, com_a_tag: 0 },
  { percentual: 10, minutos: 15, tag: "Assistiu 10%", alcancaram: 1, com_a_tag: 1 },
  { percentual: 20, minutos: 30, tag: "Assistiu 20%", alcancaram: 0, com_a_tag: 0 },
  { percentual: 30, minutos: 45, tag: "Assistiu 30%", alcancaram: 0, com_a_tag: 0 },
  { percentual: 50, minutos: 75, tag: "Assistiu 50%", alcancaram: 0, com_a_tag: 0 },
  { percentual: 70, minutos: 105, tag: "Assistiu 70%", alcancaram: 0, com_a_tag: 0 },
  { percentual: 90, minutos: 135, tag: "Assistiu 90%", alcancaram: 0, com_a_tag: 0 },
];

describe("contrato de /api/eventos/retencao", () => {
  it("aceita a resposta da spec (dado real de 22/09) e tolera extras", () => {
    const r = RetencaoResponseSchema.safeParse({
      de: "2026-09-22",
      ate: "2026-09-28",
      eventos: ["WG - 22.09.26"],
      totais: { inscritos: 467, assistiram: 1, sem_medicao: 466 },
      curva: CURVA,
      avisos: ["sem_medicao_alta"],
      leads: [
        {
          clint_contact_id: "c1",
          lead_id: null,
          nome: "Jonas",
          telefone: "+5548999990000",
          email: "j@x.com",
          tier: "UMQL+",
          tier_rank: 6,
          possivel_ninja: false,
          evento_tag: "WG - 22.09.26",
          percentual_maximo: 10,
          minutos: 15,
          tags: ["WG - 22.09.26", "Assistiu 10%"],
          created_at: "2026-09-16T12:00:00Z",
          extra: true,
        },
      ],
      gerado_em: "2026-09-22T10:00:00Z",
      cache: "miss",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.totais.assistiram).toBe(1);
      expect(r.data.curva).toHaveLength(7);
      expect(r.data.leads?.[0].percentual_maximo).toBe(10);
    }
  });

  it("exige totais.assistiram e curva; leads, avisos e sem_medicao são opcionais", () => {
    const base = { de: "x", ate: "x", eventos: [], gerado_em: "x" };
    expect(RetencaoResponseSchema.safeParse({ ...base, totais: { assistiram: 0 }, curva: [] }).success).toBe(true);
    expect(RetencaoResponseSchema.safeParse({ ...base, totais: {}, curva: [] }).success).toBe(false);
    expect(RetencaoResponseSchema.safeParse({ ...base, totais: { assistiram: 0 } }).success).toBe(false);
  });
});

describe("curva de retenção", () => {
  it("pontos: ordena por percentual, calcula % dos inscritos e retenção relativa ao 1º degrau", () => {
    const curva = [
      { percentual: 90, alcancaram: 38 },
      { percentual: 3, alcancaram: 312 },
      { percentual: 50, alcancaram: 129 },
    ];
    const p = pontosDaCurva(curva, 467);
    expect(p.map((x) => x.percentual)).toEqual([3, 50, 90]);
    expect(p[0]).toMatchObject({ rotulo: "3%", rotuloMinutos: "—", doPrimeiro: 100 });
    expect(p[0].dosInscritos).toBeCloseTo(66.8, 1);
    expect(p[2].doPrimeiro).toBeCloseTo(12.18, 1);
  });

  it("sem inscritos ou com 1º degrau zerado, as leituras relativas viram null (nunca NaN)", () => {
    const p = pontosDaCurva(CURVA.map((d) => ({ ...d, alcancaram: 0 })), 0);
    expect(p.every((x) => x.dosInscritos === null && x.doPrimeiro === null)).toBe(true);
  });

  it("rótulo de minutos: min abaixo de uma hora, h em horas cheias, travessão sem dado", () => {
    expect(rotuloMinutos(5)).toBe("5 min");
    expect(rotuloMinutos(135)).toBe("135 min");
    expect(rotuloMinutos(120)).toBe("2 h");
    expect(rotuloMinutos(null)).toBe("—");
  });

  it("degrau maior que o anterior é inconsistência; decrescente ou estável não é", () => {
    expect(curvaInconsistente(CURVA)).toBe(false);
    expect(curvaInconsistente([{ percentual: 3, alcancaram: 5 }, { percentual: 10, alcancaram: 9 }])).toBe(true);
    expect(alcancaramNoDegrau(CURVA, 10)).toBe(1);
    expect(alcancaramNoDegrau(CURVA, 55)).toBeNull();
  });
});

describe("lista de medidos", () => {
  const l = (nome: string, percentual_maximo: number, extra: Partial<LeadRetencao> = {}): LeadRetencao => ({
    clint_contact_id: nome,
    nome,
    percentual_maximo,
    ...extra,
  });
  const leads = [l("Ana", 90, { telefone: "+5548998350001" }), l("Bia", 50, { email: "bia@x.com" }), l("Caio", 3)];

  it("filtra por percentual mínimo e busca, mantendo a ordem do backend", () => {
    const nomes = (x: LeadRetencao[]) => x.map((y) => y.nome);
    expect(nomes(filtrarMedidos(leads, { busca: "" }))).toEqual(["Ana", "Bia", "Caio"]);
    expect(nomes(filtrarMedidos(leads, { busca: "", percentualMinimo: 50 }))).toEqual(["Ana", "Bia"]);
    expect(nomes(filtrarMedidos(leads, { busca: "bia@" }))).toEqual(["Bia"]);
    expect(nomes(filtrarMedidos(leads, { busca: "48 9983" }))).toEqual(["Ana"]);
  });
});
