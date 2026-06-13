import { describe, expect, it } from "vitest";
import type { SdrDashboardPayload } from "@/lib/data/sdrDashboard";
import {
  agregarLideranca,
  allocateIntegersWithTarget,
  normalizarCloser,
  SEM_CLOSER,
  semanasDoMes,
  traduzirQualificacao,
  weekOfMonth,
} from "./lideranca";

describe("weekOfMonth (5.11)", () => {
  // Junho/2026 começa numa segunda (dow=1)
  it("calcula a semana de calendário dentro do mês", () => {
    expect(weekOfMonth("2026-06-01")).toBe(1);
    expect(weekOfMonth("2026-06-06")).toBe(1); // sábado fecha a 1ª semana
    expect(weekOfMonth("2026-06-07")).toBe(2); // domingo abre a 2ª
    expect(weekOfMonth("2026-06-30")).toBe(5);
  });

  it("semanasDoMes devolve a última semana do mês", () => {
    expect(semanasDoMes("2026-06")).toBe(5);
  });
});

describe("normalizarCloser (5.1)", () => {
  it("gilberto e giba viram Giba; demais mantidos", () => {
    expect(normalizarCloser("Gilberto")).toBe("Giba");
    expect(normalizarCloser("giba")).toBe("Giba");
    expect(normalizarCloser("Marcio")).toBe("Marcio");
  });
});

describe("traduzirQualificacao (5.9)", () => {
  it("traduz as categorias do marketing para produto/perfil", () => {
    expect(traduzirQualificacao("sem qualificacao")).toBe("Masterclass");
    expect(traduzirQualificacao("qualificado qc")).toBe("QC");
    expect(traduzirQualificacao("MQL+")).toBe("Black");
    expect(traduzirQualificacao("umql")).toBe("Private");
    expect(traduzirQualificacao("outro valor")).toBe("outro valor");
    expect(traduzirQualificacao("")).toBe("Nao informado");
  });
});

describe("allocateIntegersWithTarget (5.10)", () => {
  it("arredonda por maiores restos somando exatamente o alvo", () => {
    expect(allocateIntegersWithTarget([1.4, 1.4, 1.2], 4)).toEqual([2, 1, 1]);
    expect(allocateIntegersWithTarget([2.5, 2.5], 5)).toEqual([3, 2]);
    expect(allocateIntegersWithTarget([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });
});

// Payload mínimo para testar a agregação completa da liderança
function payloadBase(): SdrDashboardPayload {
  return {
    // Glaucio: 4 agendadas dia 02 (semana 1) + 3 dia 09 (semana 2); 1 futura dia 20
    agendadas: [
      { sdr: "Glaucio", data_referencia: "2026-06-02", total: 4 },
      { sdr: "Glaucio", data_referencia: "2026-06-09", total: 3 },
      { sdr: "Glaucio", data_referencia: "2026-06-20", total: 1 },
      { sdr: "Benhur", data_referencia: "2026-06-02", total: 2 },
    ],
    realizadas: [
      { sdr: "Glaucio", data_referencia: "2026-06-02", total: 3 },
      { sdr: "Glaucio", data_referencia: "2026-06-09", total: 2 },
      { sdr: "Benhur", data_referencia: "2026-06-02", total: 2 },
    ],
    no_show: [{ sdr: "Glaucio", data_referencia: "2026-06-02", total: 1 }],
    por_produto: [
      { sdr: "Glaucio", data_referencia: "2026-06-02", produto: "Ninja", total: 2 },
      { sdr: "Glaucio", data_referencia: "2026-06-02", produto: "Quebrando Código", total: 3 },
    ],
    remarcadas: [],
    marketing_leads: [
      { data_referencia: "2026-06-02", total: 10 },
      { data_referencia: "2026-06-09", total: 8 },
    ],
    marketing_qualificados: [
      { data_referencia: "2026-06-02", qualificacao: "mql", total: 3 },
      { data_referencia: "2026-06-02", qualificacao: "sem qualificacao", total: 2 },
      { data_referencia: "2026-06-09", qualificacao: "umql", total: 1 },
    ],
    closer_agendadas: [
      { closer: "Marcio", data_referencia: "2026-06-02", total: 3 },
      { closer: "Gilberto", data_referencia: "2026-06-02", total: 1 },
      // dia 09 sem closer → vai para "Sem Closer"
    ],
    closer_realizadas: [],
    closer_no_show: [],
    closer_por_produto: [],
    closer_remarcadas: [],
    lideranca_erro: null,
  };
}

describe("agregarLideranca", () => {
  const HOJE = "2026-06-11";

  it("comparecimento só conta calls até hoje (5.8)", () => {
    const l = agregarLideranca(payloadBase(), "2026-06", null, HOJE);
    const glaucio = l.comparecimentoPorSdr.find((c) => c.sdr === "Glaucio")!;
    expect(glaucio.agendadasAteHoje).toBe(7); // a futura (dia 20) fica fora
    expect(glaucio.ocorridas).toBe(5);
    expect(glaucio.noShow).toBe(1);
    expect(glaucio.taxa).toBeCloseTo(71.4);
  });

  it("funil de marketing: entraram, qualificados e desqualificados (5.9)", () => {
    const l = agregarLideranca(payloadBase(), "2026-06", null, HOJE);
    expect(l.kpis.leadsEntraram).toBe(18);
    expect(l.kpis.leadsQualificados).toBe(6);
    expect(l.kpis.leadsDesqualificados).toBe(12);
  });

  it("produtos no recorte traduzidos e em ordem decrescente", () => {
    const l = agregarLideranca(payloadBase(), "2026-06", null, HOJE);
    expect(l.produtosNoRecorte[0]).toEqual({ produto: "Ninja", total: 3 });
    expect(l.produtosNoRecorte).toContainEqual({ produto: "Masterclass", total: 2 });
    expect(l.produtosNoRecorte).toContainEqual({ produto: "Private", total: 1 });
  });

  it("filtro de semana restringe o recorte (5.11), menos as métricas da equipe", () => {
    const semana2 = agregarLideranca(payloadBase(), "2026-06", 2, HOJE);
    expect(semana2.kpis.leadsEntraram).toBe(8); // só o dia 09
    const glaucio = semana2.comparecimentoPorSdr.find((c) => c.sdr === "Glaucio")!;
    expect(glaucio.agendadasAteHoje).toBe(3);
    // Equipe ignora a semana: qualificados do mês inteiro (Ninja 2 + ⌊3 QC/3⌋ + Benhur 0)
    expect(semana2.equipe.qualificadosMes).toBe(3);
  });

  it("matriz SDR×Closer: proporcional por dia, com Sem Closer e soma exata (5.10)", () => {
    const l = agregarLideranca(payloadBase(), "2026-06", null, HOJE);
    expect(l.matriz.closers).toContain("Giba"); // Gilberto normalizado
    expect(l.matriz.closers).toContain(SEM_CLOSER);
    const glaucio = l.matriz.linhas.find((li) => li.sdr === "Glaucio")!;
    // dia 02: 4 calls → Marcio 3, Giba 1 (proporção 3:1); dia 09 e 20 sem closer
    expect(glaucio.valores["Marcio"]).toBe(3);
    expect(glaucio.valores["Giba"]).toBe(1);
    expect(glaucio.valores[SEM_CLOSER]).toBe(4);
    expect(glaucio.total).toBe(8);
    const soma = Object.values(glaucio.valores).reduce((a, b) => a + b, 0);
    expect(soma).toBe(glaucio.total);
  });

  it("métricas da equipe: meta atual 150 e progresso com faltam X (5.5)", () => {
    const l = agregarLideranca(payloadBase(), "2026-06", null, HOJE);
    expect(l.equipe.metas).toEqual([150, 188, 225]);
    expect(l.equipe.metaAtual).toBe(150);
    expect(l.equipe.metasBatidas).toBe(0);
    expect(l.equipe.progresso[0].faltam).toBe(150 - l.equipe.qualificadosMes);
  });
});
