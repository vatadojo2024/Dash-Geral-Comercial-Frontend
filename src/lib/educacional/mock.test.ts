import { describe, expect, it } from "vitest";
import semente from "@/lib/mock/data_educacional.json";
import { AlunoDetalheSchema, ConfigSchema, FAIXAS_SAUDE, STATUS_CHECKPOINT } from "./contrato";
import { bancoDaSemente } from "./mock/banco";
import { diasEntre, faixaDoHealth, hojeBR, montarAluno, montarResumo, naJornada } from "./mock/motor";

// O banco do modo demonstração (data_educacional.json) e o motor que monta as
// respostas como o backend da Fase 2 (seção 3). O front fora do mock não
// calcula nada disso — aqui só se garante que a demonstração não mente.

const HOJE = hojeBR();
const banco = bancoDaSemente(HOJE);
const alunos = banco.alunos.map((a) => montarAluno(banco, a, HOJE));
const naJornadaIds = new Set(banco.alunos.filter(naJornada).map((a) => a.id));
const ativos = alunos.filter((a) => naJornadaIds.has(a.id));
const resumo = montarResumo(banco, HOJE, `${HOJE}T09:00:00-03:00`);

describe("semente — contrato da Fase 2", () => {
  it("config válida; todo aluno montado passa no schema; ids únicos", () => {
    expect(ConfigSchema.parse(banco.config)).toBeTruthy();
    expect(alunos.every((a) => AlunoDetalheSchema.safeParse(a).success)).toBe(true);
    expect(new Set(alunos.map((a) => a.id)).size).toBe(alunos.length);
  });

  it("modelo de checkpoints aprovado: Dia 0 … Mês 6, Big Win no Mês 3, SLA vazio", () => {
    expect(banco.config.checkpoints_modelo.map((m) => [m.nome, m.dias_apos_entrada, m.big_win])).toEqual([
      ["Dia 0", 0, false],
      ["Semana 1", 7, false],
      ["Mês 1", 30, false],
      ["Mês 2", 60, false],
      ["Mês 3", 90, true],
      ["Mês 4", 120, false],
      ["Mês 5", 150, false],
      ["Mês 6", 180, false],
    ]);
    expect(banco.config.checkpoints_modelo.every((m) => m.prazo_sla_dias === null)).toBe(true);
  });

  it("cobre etapas, status de checkpoint, faixas e um arquivado", () => {
    expect(new Set(ativos.map((a) => a.etapa.id))).toEqual(new Set(banco.config.etapas.map((e) => e.id)));
    const statusProximos = new Set(ativos.map((a) => a.proximo_checkpoint?.status));
    for (const s of STATUS_CHECKPOINT.filter((s) => s !== "realizado")) expect(statusProximos).toContain(s);
    expect(new Set(ativos.map((a) => a.faixa_saude.valor))).toEqual(new Set(FAIXAS_SAUDE));
    expect(alunos.filter((a) => a.arquivado)).toHaveLength(1);
  });

  it("Q1: o que não tem cálculo entra como ajuste 'Valor importado da Fase 1'", () => {
    for (const a of alunos) {
      expect(a.health_score.automatico).toBeNull();
      expect(a.health_score.ajuste?.motivo).toBe("Valor importado da Fase 1");
      expect(a.ltv.ajuste).not.toBeNull();
      expect(a.status_financeiro.ajuste).not.toBeNull();
    }
    // Faixa só é ajustada onde a Fase 1 divergia do cálculo pelo Health.
    expect(alunos.some((a) => a.faixa_saude.ajuste)).toBe(true);
    expect(alunos.filter((a) => a.faixa_saude.ajuste).every((a) => a.faixa_saude.ajuste!.valor !== a.faixa_saude.automatico)).toBe(true);
  });

  it("as datas andam até hoje ao semear", () => {
    const n = diasEntre(semente.data_referencia, HOJE);
    expect(banco.alunos[0].data_entrada).toBe(
      new Date(Date.parse(`${semente.alunos[0].data_entrada}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10),
    );
  });
});

describe("motor — regras da seção 3 do backend", () => {
  it("faixa pelo Health efetivo: ≥ 70 saudável, 50–69 atenção, < 50 risco", () => {
    expect([faixaDoHealth(70), faixaDoHealth(69), faixaDoHealth(50), faixaDoHealth(49), faixaDoHealth(null)]).toEqual([
      "saudavel",
      "atencao",
      "atencao",
      "risco",
      null,
    ]);
    for (const a of alunos) expect(a.faixa_saude.automatico).toBe(faixaDoHealth(a.health_score.valor));
  });

  it("dias na etapa = desde etapa_desde; valor efetivo = ajuste ?? automático", () => {
    for (const a of alunos) {
      expect(a.dias_na_etapa.automatico).toBe(diasEntre(a.etapa_desde, HOJE));
      for (const c of [a.health_score, a.faixa_saude, a.dias_na_etapa, a.ltv, a.sinais.prova_social]) {
        expect(c.valor).toEqual(c.ajuste ? c.ajuste.valor : c.automatico);
      }
    }
  });

  it("Prova Social automática = Big Win realizado e aluno na última etapa ativa", () => {
    const ultima = [...banco.config.etapas].sort((a, b) => a.ordem - b.ordem).at(-1)!.id;
    for (const a of alunos) {
      const bigWin = a.checkpoints.some((c) => c.big_win && c.status === "realizado");
      expect(a.sinais.prova_social.automatico).toBe(bigWin && a.etapa.id === ultima);
    }
  });

  it("próximo checkpoint = primeiro não realizado da timeline", () => {
    for (const a of alunos) {
      const c = a.checkpoints.find((x) => x.status !== "realizado");
      expect(a.proximo_checkpoint?.id ?? null).toBe(c?.id ?? null);
    }
  });

  it("resumo: funil pelas etapas ativas, KPIs e sinais batem com os alunos da jornada", () => {
    expect(resumo.funil.map((f) => f.etapa_id)).toEqual(
      [...banco.config.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => e.id),
    );
    expect(resumo.funil.reduce((s, f) => s + f.alunos, 0)).toBe(resumo.kpis.alunos_ativos);
    expect(resumo.kpis.alunos_ativos).toBe(ativos.length);
    expect(resumo.kpis.em_risco).toBe(ativos.filter((a) => a.faixa_saude.valor === "risco").length);
    expect(resumo.kpis.intervencoes_sla).toBe(
      ativos.filter((a) => a.proximo_checkpoint && ["pendente", "nao_respondeu"].includes(a.proximo_checkpoint.status)).length,
    );
    const healths = ativos.map((a) => a.health_score.valor!).filter((h) => h != null);
    expect(resumo.kpis.health_score_medio).toBe(Math.round(healths.reduce((s, h) => s + h, 0) / healths.length));
    for (const s of ["upgrade", "renovacao", "prova_social"] as const) {
      expect(resumo.sinais[s]).toBe(ativos.filter((a) => a.sinais[s].valor === true).length);
    }
  });
});
