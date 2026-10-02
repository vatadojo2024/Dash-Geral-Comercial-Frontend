import { describe, expect, it } from "vitest";
import { mockIncognitas } from "@/lib/mock/eventos_incognitas";
import {
  csvDeIncognitas,
  ehSemAtendimento,
  esteveAoVivo,
  filtrarIncognitas,
  IncognitasResponseSchema,
  leituraDasEtapas,
  proporcaoDaAudiencia,
  respondeuPesquisa,
  rotuloDaEtapa,
  separarPorPesquisa,
  type LeadIncognito,
} from "./incognitas";

// Ciclo de 29/09 (uma terça no intervalo).
const resp = IncognitasResponseSchema.parse(mockIncognitas("2026-09-29", "2026-10-05"));

describe("contrato e mock das incógnitas", () => {
  it("bate com o ciclo real de 29/09", () => {
    const t = resp.totais;
    expect(t.inscritos).toBe(312);
    expect(t.incognitas).toBe(152);
    expect(resp.leads).toHaveLength(152);
    expect(t.responderam_pesquisa).toBe(9);
    expect(t.presentes_ao_vivo).toBe(21);
    expect(t.sem_atendimento).toBe(33);
    expect((t.classificados ?? 0) + (t.qc ?? 0) + t.incognitas).toBe(t.inscritos);
  });

  it("tier sempre null; ordem do backend: pesquisa → ao vivo → % assistido", () => {
    expect(resp.leads.every((l) => l.tier == null)).toBe(true);
    const primeiros = resp.leads.slice(0, 9);
    expect(primeiros.every(respondeuPesquisa)).toBe(true);
    const semPesquisa = resp.leads.filter((l) => !respondeuPesquisa(l));
    expect(semPesquisa.slice(0, 3).map((l) => l.percentual_assistido)).toEqual([90, 90, 90]);
  });

  it("por_etapa: maior primeiro, sem negócio sempre por último", () => {
    const etapas = resp.por_etapa ?? [];
    expect(etapas[0]).toEqual({ etapa: "Prospecção", total: 106 });
    expect(etapas[etapas.length - 1].etapa).toBeNull();
  });
});

describe("regras da tela", () => {
  it("proporção: três fatias que somam os inscritos", () => {
    const { fatias, fechaConta } = proporcaoDaAudiencia(resp.totais);
    expect(fatias.map((f) => f.valor)).toEqual([130, 30, 152]);
    expect(fatias.reduce((s, f) => s + f.pct, 0)).toBeCloseTo(100);
    expect(fechaConta).toBe(true);
    expect(proporcaoDaAudiencia({ ...resp.totais, inscritos: 300 }).fechaConta).toBe(false);
  });

  it("leitura das etapas: o gargalo (Prospecção) × Sem atendimento", () => {
    const { maior, semAtendimento } = leituraDasEtapas(resp.por_etapa ?? []);
    expect(maior?.etapa).toBe("Prospecção");
    expect(semAtendimento).toBe(33);
    expect(rotuloDaEtapa(null)).toBe("Sem negócio na Clint");
    expect(ehSemAtendimento(" sem atendimento ")).toBe(true);
  });

  it("filtros: pesquisa, ao vivo, call agendada e busca — sem reordenar", () => {
    const leads = resp.leads as LeadIncognito[];
    const responderam = filtrarIncognitas(leads, { pesquisa: "respondeu", busca: "" });
    expect(responderam).toHaveLength(9);
    expect(filtrarIncognitas(leads, { pesquisa: "nao_respondeu", busca: "" })).toHaveLength(143);
    const aoVivo = filtrarIncognitas(leads, { soAoVivo: true, busca: "" });
    expect(aoVivo).toHaveLength(21);
    expect(aoVivo.every(esteveAoVivo)).toBe(true);
    const ordem = leads.filter(esteveAoVivo).map((l) => l.clint_contact_id);
    expect(aoVivo.map((l) => l.clint_contact_id)).toEqual(ordem);
    const agendaram = filtrarIncognitas(leads, { agendou: "sim", busca: "" });
    expect(agendaram.every((l) => l.ja_agendou)).toBe(true);
    const alvo = leads[20];
    expect(filtrarIncognitas(leads, { busca: alvo.nome.toUpperCase() }).some((l) => l.clint_contact_id === alvo.clint_contact_id)).toBe(true);
  });

  it("dois grupos de ação, cada um na ordem recebida", () => {
    const { responderam, nunca } = separarPorPesquisa(resp.leads as LeadIncognito[]);
    expect(responderam).toHaveLength(9);
    expect(nunca).toHaveLength(143);
    expect(respondeuPesquisa({})).toBe(false);
  });

  it("CSV com cabeçalho fixo e uma linha por lead", () => {
    const csv = csvDeIncognitas((resp.leads as LeadIncognito[]).slice(0, 2)).split("\r\n");
    expect(csv[0]).toContain('"respondeu_pesquisa"');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('"sim"');
  });
});

describe("estados do mock", () => {
  it("vazio = todos classificados; sem_contatos = nada", () => {
    const vazio = mockIncognitas("2026-09-29", "2026-10-05", "vazio");
    expect(vazio.leads).toHaveLength(0);
    expect(vazio.totais.inscritos).toBe(312);
    expect(mockIncognitas("2026-09-29", "2026-10-05", "sem_contatos").totais.inscritos).toBe(0);
  });
});
