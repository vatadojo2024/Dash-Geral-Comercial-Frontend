import { describe, expect, it } from "vitest";
import mock from "@/lib/mock/data_educacional.json";
import {
  AlunoDetalheSchema,
  ETAPAS,
  NIVEIS_RISCO,
  ResumoEducacionalSchema,
  STATUS_CHECKPOINT,
} from "./contrato";

// O data_educacional.json segue EXATAMENTE o contrato da seção 8 e é coerente
// com as regras da seção 9 (spec specs/educacional_frontend.md). O front não
// calcula essas regras — este teste só garante que o mock não mente.

const resumo = ResumoEducacionalSchema.parse(mock.resumo);
const alunos = mock.alunos.map((a) => AlunoDetalheSchema.parse(a));
const hoje = Date.parse(resumo.atualizado_em.slice(0, 10));
const DIA = 86_400_000;

describe("data_educacional.json — contrato", () => {
  it("só tem as chaves do contrato e todo aluno passa no schema", () => {
    expect(Object.keys(mock).sort()).toEqual(["alunos", "resumo"]);
    expect(alunos).toHaveLength(mock.alunos.length);
    expect(new Set(alunos.map((a) => a.id)).size).toBe(alunos.length);
  });

  it("cobre o que a spec pede (seção 3)", () => {
    expect(alunos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(alunos.map((a) => a.etapa_atual))).toEqual(new Set(ETAPAS));
    expect(new Set(alunos.map((a) => a.proximo_checkpoint.status))).toEqual(new Set(STATUS_CHECKPOINT));
    expect(new Set(alunos.map((a) => a.risco))).toEqual(new Set(NIVEIS_RISCO));
    expect(new Set(alunos.map((a) => a.status_financeiro))).toEqual(new Set(["adimplente", "inadimplente"]));
    expect(alunos.some((a) => a.sinais.length > 0)).toBe(true);
    expect(alunos.some((a) => a.sinais.length === 0)).toBe(true);
  });
});

describe("data_educacional.json — regras da seção 9", () => {
  it("funil: sempre as 5 etapas, na ordem; contagem = alunos na etapa; soma = ativos", () => {
    expect(resumo.funil.map((f) => f.etapa)).toEqual([...ETAPAS]);
    for (const f of resumo.funil) {
      expect(f.alunos).toBe(alunos.filter((a) => a.etapa_atual === f.etapa).length);
    }
    expect(resumo.funil.reduce((s, f) => s + f.alunos, 0)).toBe(resumo.kpis.alunos_ativos);
    expect(resumo.kpis.alunos_ativos).toBe(alunos.length);
  });

  it("KPIs batem com a lista", () => {
    const media = alunos.reduce((s, a) => s + a.health_score, 0) / alunos.length;
    expect(resumo.kpis.health_score_medio).toBe(Math.round(media));
    expect(resumo.kpis.em_risco).toBe(alunos.filter((a) => a.health_score < 50).length);
    expect(resumo.kpis.intervencoes_sla).toBe(
      alunos.filter((a) => ["pendente", "nao_respondeu"].includes(a.proximo_checkpoint.status)).length,
    );
  });

  it("sinais: contagens batem; Upgrade só para adimplente", () => {
    for (const s of ["upgrade", "renovacao", "prova_social"] as const) {
      expect(resumo.sinais[s]).toBe(alunos.filter((a) => a.sinais.includes(s)).length);
    }
    expect(alunos.filter((a) => a.sinais.includes("upgrade")).every((a) => a.status_financeiro === "adimplente")).toBe(true);
  });

  it("Big Win realizado + etapa Validação → aluno com sinal para o Comercial", () => {
    const bigWin = alunos.filter(
      (a) =>
        a.etapa_atual === "validacao" &&
        a.checkpoints.some((c) => c.nome === "Mês 3 — Big Win" && c.status === "realizado"),
    );
    expect(bigWin.length).toBeGreaterThan(0);
    expect(bigWin.every((a) => a.sinais.length > 0)).toBe(true);
  });

  it("dias estagnados = dias corridos desde etapa_desde até a data do resumo", () => {
    for (const a of alunos) {
      expect(a.dias_estagnados).toBe(Math.round((hoje - Date.parse(a.etapa_desde)) / DIA));
    }
  });

  it("próximo checkpoint existe na timeline do aluno, com o mesmo status", () => {
    for (const a of alunos) {
      const cp = a.checkpoints.find((c) => c.nome === a.proximo_checkpoint.nome);
      expect(cp?.status).toBe(a.proximo_checkpoint.status);
    }
  });
});
