import { describe, expect, it } from "vitest";
import {
  blocosPresentes,
  contarAgendaram,
  contarAteOFim,
  csvDePresentes,
  ficouAteOFim,
  filtrarPresentes,
  PresentesResponseSchema,
  type LeadPresente,
} from "./presentesSemAplicar";

function lead(extra: Partial<LeadPresente> & { nome: string }): LeadPresente {
  return {
    clint_contact_id: extra.nome,
    clint_deal_id: "d1",
    url_clint: "https://app.clint.digital/deal/d1",
    lead_id: null,
    telefone: null,
    email: null,
    tier: "MQL+",
    tier_rank: 2,
    possivel_ninja: false,
    evento_tag: "WG - 22.09.26",
    etapa: "Prospecção",
    dono: { id: "u1", nome: "Glaucio Portela", email: null },
    percentual_assistido: 50,
    minutos_assistidos: 75,
    ja_agendou: false,
    tags: ["WG - 22.09.26"],
    created_at: "2026-09-16T12:00:00Z",
    ...extra,
  };
}

const TOTAIS = { inscritos: 438, presentes: 132, aplicaram: 62, presentes_sem_aplicar: 70, qualificados_sem_aplicar: 28 };

describe("contrato de /api/eventos/presentes-sem-aplicar", () => {
  it("aceita a resposta da spec e tolera extras", () => {
    const r = PresentesResponseSchema.safeParse({
      de: "2026-09-22",
      ate: "2026-09-28",
      eventos: ["WG - 22.09.26"],
      totais: { ...TOTAIS, extra: 1 },
      por_dono: [{ dono_id: "x", dono_nome: "Benhur Ramos", pendentes: 15, alto_valor: 8 }],
      leads: [
        {
          clint_contact_id: "c1",
          clint_deal_id: "d1",
          url_clint: "https://app.clint.digital/deal/d1",
          lead_id: null,
          nome: "Ane",
          telefone: "+5548999990000",
          email: "ane@x.com",
          tier: "HMQL",
          tier_rank: 4,
          possivel_ninja: false,
          evento_tag: "WG - 22.09.26",
          etapa: "Prospecção",
          dono: { id: "u", nome: "Glaucio Portela", email: "g@x.com" },
          percentual_assistido: 90,
          minutos_assistidos: 135,
          ja_agendou: false,
          tags: ["WG - 22.09.26"],
          created_at: "2026-09-16T12:00:00Z",
        },
      ],
      gerado_em: "2026-09-22T10:00:00Z",
      cache: "miss",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.totais.qualificados_sem_aplicar).toBe(28);
      expect(r.data.leads[0].minutos_assistidos).toBe(135);
      expect(r.data.leads[0].ja_agendou).toBe(false);
    }
  });

  it("exige totais.qualificados_sem_aplicar; os outros totais são opcionais", () => {
    const base = { de: "x", ate: "x", eventos: [], leads: [], gerado_em: "x" };
    expect(PresentesResponseSchema.safeParse({ ...base, totais: {} }).success).toBe(false);
    expect(PresentesResponseSchema.safeParse({ ...base, totais: { qualificados_sem_aplicar: 0 } }).success).toBe(true);
  });
});

describe("funil, presença e filtro", () => {
  it("funil: inscritos → presentes → não aplicaram (dos presentes) → qualificados (dos que não aplicaram)", () => {
    const b = blocosPresentes(TOTAIS);
    expect(b.map((x) => [x.rotulo, x.valor])).toEqual([
      ["Inscritos", 438],
      ["Presentes ao vivo", 132],
      ["Não aplicaram", 70],
      ["Qualificados (MQL+ ou acima)", 28],
    ]);
    expect(b[1].passagem).toEqual({ tipo: "pct", texto: "30%" });
    expect(b[2]).toMatchObject({ passagem: { tipo: "pct", texto: "53%" }, baseDaPassagem: "dos presentes" });
    expect(b[3]).toMatchObject({ passagem: { tipo: "pct", texto: "40%" }, baseDaPassagem: "dos que não aplicaram" });
    // Totais ausentes: travessão, nunca NaN.
    expect(blocosPresentes({ qualificados_sem_aplicar: 3 })[1].passagem).toEqual({ tipo: "pct", texto: "—" });
  });

  it("ficou até o fim: percentual ≥ 70 manda; sem percentual, vale 90+ minutos", () => {
    expect(ficouAteOFim({ percentual_assistido: 90, minutos_assistidos: 135 })).toBe(true);
    expect(ficouAteOFim({ percentual_assistido: 50, minutos_assistidos: 200 })).toBe(false);
    expect(ficouAteOFim({ percentual_assistido: null, minutos_assistidos: 95 })).toBe(true);
    expect(ficouAteOFim({ percentual_assistido: null, minutos_assistidos: null })).toBe(false);
  });

  const leads = [
    lead({ nome: "Ane", tier: "HMQL", tier_rank: 4, percentual_assistido: 90, minutos_assistidos: 135, telefone: "+5548998350001" }),
    lead({ nome: "Bia", ja_agendou: true, dono: { id: "u2", nome: "Benhur Ramos", email: null } }),
    lead({ nome: "Cauã", percentual_assistido: 70, minutos_assistidos: 105, email: "caua@x.com" }),
    lead({ nome: "Dalila", dono: null, ja_agendou: true }),
  ];
  const nomes = (x: LeadPresente[]) => x.map((l) => l.nome);

  it("filtra por tier, dono, 'até o fim' e busca; ja_agendou NUNCA filtra, só conta", () => {
    const f = (x: Parameters<typeof filtrarPresentes>[1]) => nomes(filtrarPresentes(leads, x));
    expect(f({ tiers: [], busca: "" })).toEqual(["Ane", "Bia", "Cauã", "Dalila"]);
    expect(f({ tiers: ["HMQL"], busca: "" })).toEqual(["Ane"]);
    expect(f({ tiers: [], donos: ["u2"], busca: "" })).toEqual(["Bia"]);
    expect(f({ tiers: [], donos: ["sem"], busca: "" })).toEqual(["Dalila"]);
    expect(f({ tiers: [], soAteOFim: true, busca: "" })).toEqual(["Ane", "Cauã"]);
    expect(f({ tiers: [], busca: "48 9983" })).toEqual(["Ane"]);
    expect(f({ tiers: [], busca: "CAUA" })).toEqual(["Cauã"]);
    expect(contarAgendaram(leads)).toBe(2);
    expect(contarAteOFim(leads)).toBe(2);
  });

  it("CSV: 13 colunas fixas com presença e ja_agendou", () => {
    const linhas = csvDePresentes([leads[0], leads[1]]).split("\r\n");
    expect(linhas[0]).toBe(
      '"nome";"mql";"dono";"etapa";"percentual_assistido";"minutos_assistidos";"ja_agendou";"telefone";"email";"evento";"entrou_em";"url_clint";"tags"',
    );
    expect(linhas[1]).toBe(
      '"Ane";"HMQL";"Glaucio Portela";"Prospecção";"90";"135";"";"+5548998350001";"";"WG - 22.09.26";"2026-09-16T12:00:00Z";"https://app.clint.digital/deal/d1";"WG - 22.09.26"',
    );
    expect(linhas[2]).toContain('"Bia";"MQL+";"Benhur Ramos";"Prospecção";"50";"75";"sim"');
  });
});
