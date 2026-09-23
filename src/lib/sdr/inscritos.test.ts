import { describe, expect, it } from "vitest";
import {
  contarSinais,
  csvDeInscritos,
  filtrarInscritos,
  InscritosResponseSchema,
  SINAIS,
  sinaisDoInscrito,
  type LeadInscrito,
} from "./inscritos";

function lead(extra: Partial<LeadInscrito> & { nome: string }): LeadInscrito {
  return { clint_contact_id: extra.nome, tier: null, tier_rank: 0, evento_tag: "WG - 22.09.26", ...extra };
}

describe("contrato provisório de /api/eventos/inscritos", () => {
  it("exige totais.inscritos e leads; sinais e demais totais são opcionais", () => {
    const base = { de: "x", ate: "x", eventos: [], gerado_em: "x" };
    expect(InscritosResponseSchema.safeParse({ ...base, totais: { inscritos: 0 }, leads: [] }).success).toBe(true);
    expect(InscritosResponseSchema.safeParse({ ...base, totais: {}, leads: [] }).success).toBe(false);
    const r = InscritosResponseSchema.safeParse({
      ...base,
      totais: { inscritos: 1, presentes: 1 },
      leads: [{ clint_contact_id: "c", nome: "Ana", assistiu_ao_vivo: true, levantou_mao: true, extra: 1 }],
    });
    expect(r.success && r.data.leads[0].levantou_mao).toBe(true);
  });
});

describe("sinais do inscrito", () => {
  const leads = [
    lead({ nome: "Ana", tier: "HMQL", tier_rank: 4, assistiu_ao_vivo: true, aplicou_ao_vivo: true, levantou_mao: true, ja_agendou: true, etapa: "Qualificação" }),
    lead({ nome: "Bia", assistiu_ao_vivo: true, etapa: "Sem atendimento", dono: { id: "u2", nome: "Benhur Ramos", email: null } }),
    lead({ nome: "Caio", acessou_replay: true, convidado_resgate: true, etapa: "sem Atendimento " }),
    lead({ nome: "Dudu", telefone: "+5548998350001" }),
  ];
  const nomes = (x: LeadInscrito[]) => x.map((l) => l.nome);

  it("lê cada sinal do campo certo; 'Sem atendimento' ignora caixa e espaços", () => {
    expect(sinaisDoInscrito(leads[0]).map((s) => s.chave)).toEqual(["presente", "aplicou", "levantou", "agendou"]);
    expect(sinaisDoInscrito(leads[1]).map((s) => s.chave)).toEqual(["presente", "sem_atendimento"]);
    expect(sinaisDoInscrito(leads[2]).map((s) => s.chave)).toEqual(["replay", "resgate", "sem_atendimento"]);
    expect(sinaisDoInscrito(leads[3])).toEqual([]);
    expect(contarSinais(leads)).toMatchObject({ presente: 2, aplicou: 1, levantou: 1, agendou: 1, replay: 1, resgate: 1, sem_atendimento: 2 });
    expect(SINAIS.map((s) => s.chave)).toEqual(["presente", "aplicou", "levantou", "agendou", "replay", "resgate", "sem_atendimento"]);
  });

  it("filtra por tier, dono, sinais (todos exigidos) e busca, mantendo a ordem", () => {
    const f = (x: Parameters<typeof filtrarInscritos>[1]) => nomes(filtrarInscritos(leads, x));
    expect(f({ tiers: [], busca: "" })).toEqual(["Ana", "Bia", "Caio", "Dudu"]);
    expect(f({ tiers: ["sem"], busca: "" })).toEqual(["Bia", "Caio", "Dudu"]);
    expect(f({ tiers: [], donos: ["u2"], busca: "" })).toEqual(["Bia"]);
    expect(f({ tiers: [], sinais: ["presente"], busca: "" })).toEqual(["Ana", "Bia"]);
    expect(f({ tiers: [], sinais: ["presente", "sem_atendimento"], busca: "" })).toEqual(["Bia"]);
    expect(f({ tiers: [], busca: "48 9983" })).toEqual(["Dudu"]);
  });

  it("CSV: 17 colunas com um 'sim' por sinal", () => {
    const linhas = csvDeInscritos([leads[0]]).split("\r\n");
    expect(linhas[0].split(";")).toHaveLength(17);
    expect(linhas[1]).toBe(
      '"Ana";"HMQL";"Sem dono";"Qualificação";"sim";"sim";"sim";"sim";"";"";"";"";"";"WG - 22.09.26";"";"";""',
    );
  });
});
