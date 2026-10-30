import { describe, expect, it } from "vitest";
import semente from "@/lib/mock/data_educacional.json";
import { AlunoDetalheSchema, ConfigSchema, FAIXAS_SAUDE, marcoDe, STATUS_CHECKPOINT } from "./contrato";
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

  it("programas (28/10): as 6 listas, Big Win marcado, observação só no Blackbelt, roteiro em todos", () => {
    const lista = (nome: string) => {
      const p = banco.config.programas.find((x) => x.nome === nome)!;
      return banco.config.checkpoints_modelo
        .filter((m) => m.programa_id === p.id)
        .sort((x, y) => x.ordem - y.ordem)
        .map((m) => `${marcoDe(m)} (${m.nome})`)
        .join(", ");
    };
    expect(banco.config.programas.map((p) => p.nome)).toEqual([
      "Blackbelt 6 meses",
      "Blackbelt 12 meses",
      "Prime 6 meses",
      "Prime 12 meses",
      "Private 6 meses",
      "Private 12 meses",
      "Ninja 6 meses",
      "Ninja 12 meses",
    ]);
    // Ninja (Entrega 1): sem acompanhamento individual e sem checkpoints padrão.
    expect(banco.config.programas.filter((p) => !p.acompanhamento_individual).map((p) => p.nome)).toEqual(["Ninja 6 meses", "Ninja 12 meses"]);
    expect(lista("Ninja 6 meses")).toBe("");
    expect(lista("Blackbelt 6 meses")).toBe("Dia 0 (Boas-vindas), Dia 3 (Sprint), Mês 1 (Revisão), Mês 3 (Big Win), Mês 5 (Reta Final), Mês 6 (Fim)");
    expect(lista("Blackbelt 12 meses")).toBe("Dia 0 (Boas-vindas), Dia 3 (Onboarding), Mês 1 (Revisão), Mês 4 (Big Win), Mês 6 (Metade), Mês 12 (Fim)");
    expect(lista("Prime 6 meses")).toBe("Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Revisão), Mês 3 (Big Win), Mês 5 (Pré-fim), Mês 6 (Fim)");
    expect(lista("Prime 12 meses")).toBe("Dia 0 (Welcome), Dia 3 (Check-in), Mês 1 (Avaliação), Mês 6 (Metade), Mês 9 (Big Win), Mês 12 (Decisão)");
    expect(lista("Private 6 meses")).toBe(lista("Prime 6 meses"));
    expect(lista("Private 12 meses")).toBe(lista("Prime 12 meses"));
    expect(banco.config.checkpoints_modelo.filter((m) => m.big_win).every((m) => m.nome === "Big Win")).toBe(true);
    expect(banco.config.checkpoints_modelo.filter((m) => m.big_win)).toHaveLength(6);
    expect(banco.config.programas.filter((p) => p.observacoes).map((p) => p.mentoria)).toEqual(["Blackbelt", "Blackbelt"]);
    expect(banco.config.checkpoints_modelo.every((m) => m.roteiro?.objetivo_contato && m.roteiro.estrategia_monetizacao)).toBe(true);
    // Contagem: exatamente uma preenchida, a outra null (nunca 0 no lugar de null).
    expect(banco.config.checkpoints_modelo.every((m) => (m.dias_apos_entrada === null) !== (m.meses_apos_inicio === null))).toBe(true);
  });

  it("todo aluno tem programa, a mentoria dele e os checkpoints da lista do programa", () => {
    for (const a of alunos) {
      const programa = banco.config.programas.find((p) => p.id === a.programa_id);
      expect(programa).toBeTruthy();
      expect(a.mentoria).toBe(programa!.mentoria);
      expect(a.checkpoints.map((c) => c.marco)).toEqual(
        banco.config.checkpoints_modelo.filter((m) => m.programa_id === a.programa_id).sort((x, y) => x.ordem - y.ordem).map((m) => marcoDe(m)),
      );
      expect(a.checkpoints.every((c) => c.roteiro?.objetivo_contato)).toBe(true);
    }
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
