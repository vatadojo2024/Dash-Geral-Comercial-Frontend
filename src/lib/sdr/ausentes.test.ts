import { describe, expect, it } from "vitest";
import {
  AusentesResponseSchema,
  blocosAusentes,
  contarViramReplay,
  csvDeAusentes,
  filtrarAusentes,
  viuReplay,
  type LeadAusente,
} from "./ausentes";

function lead(extra: Partial<LeadAusente> & { nome: string }): LeadAusente {
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
    dono: { id: "u1", nome: "Guilherme Alves", email: null },
    ja_agendou: false,
    acessou_replay: false,
    assistiu_replay: false,
    viu_replay: false,
    aplicou_replay: false,
    convidado_resgate: false,
    tags: ["WG - 22.09.26"],
    created_at: "2026-09-16T12:00:00Z",
    ...extra,
  };
}

const TOTAIS = { inscritos: 436, presentes: 133, ausentes: 303, qualificados_ausentes: 55, viram_replay: 11, ja_agendaram: 1 };

describe("contrato de /api/eventos/ausentes", () => {
  it("aceita a resposta da spec e tolera extras", () => {
    const r = AusentesResponseSchema.safeParse({
      de: "2026-09-22",
      ate: "2026-09-28",
      eventos: ["WG - 22.09.26"],
      totais: { ...TOTAIS, extra: 1 },
      por_dono: [{ dono_id: "x", dono_nome: "Benhur Ramos", pendentes: 23, alto_valor: 15 }],
      leads: [
        {
          clint_contact_id: "c1",
          clint_deal_id: "d1",
          url_clint: "https://app.clint.digital/deal/d1",
          lead_id: null,
          nome: "Abel",
          telefone: "+5548999990000",
          email: "abel@x.com",
          tier: "HMQL",
          tier_rank: 4,
          possivel_ninja: false,
          evento_tag: "WG - 22.09.26",
          etapa: "Prospecção",
          dono: { id: "u", nome: "Glaucio Portela", email: "g@x.com" },
          ja_agendou: false,
          acessou_replay: true,
          assistiu_replay: false,
          viu_replay: true,
          aplicou_replay: false,
          convidado_resgate: true,
          tags: ["WG - 22.09.26"],
          created_at: "2026-09-16T12:00:00Z",
        },
      ],
      gerado_em: "2026-09-22T10:00:00Z",
      cache: "miss",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.totais.qualificados_ausentes).toBe(55);
      expect(r.data.leads[0].viu_replay).toBe(true);
    }
  });

  it("exige totais.qualificados_ausentes; os outros totais são opcionais", () => {
    const base = { de: "x", ate: "x", eventos: [], leads: [], gerado_em: "x" };
    expect(AusentesResponseSchema.safeParse({ ...base, totais: {} }).success).toBe(false);
    expect(AusentesResponseSchema.safeParse({ ...base, totais: { qualificados_ausentes: 0 } }).success).toBe(true);
  });
});

describe("funil, replay e filtro", () => {
  it("funil: inscritos → não participaram → qualificados → viram o replay (só com o total)", () => {
    const b = blocosAusentes(TOTAIS);
    expect(b.map((x) => [x.rotulo, x.valor])).toEqual([
      ["Inscritos", 436],
      ["Não participaram", 303],
      ["Qualificados (MQL+ ou acima)", 55],
      ["Viram o replay", 11],
    ]);
    expect(b[1].passagem).toEqual({ tipo: "pct", texto: "69%" });
    expect(b[2]).toMatchObject({ passagem: { tipo: "pct", texto: "18%" }, baseDaPassagem: "dos que não participaram" });
    expect(b[3]).toMatchObject({ passagem: { tipo: "pct", texto: "20%" }, baseDaPassagem: "dos qualificados ausentes" });
    expect(blocosAusentes({ qualificados_ausentes: 3 }).map((x) => x.chave)).toEqual(["inscritos", "ausentes", "qualificados_ausentes"]);
  });

  it("viu o replay: usa viu_replay do backend; sem ele, deriva de acessou/assistiu", () => {
    expect(viuReplay({ viu_replay: true, acessou_replay: false, assistiu_replay: false })).toBe(true);
    expect(viuReplay({ viu_replay: false, acessou_replay: true, assistiu_replay: false })).toBe(false);
    expect(viuReplay({ viu_replay: null, acessou_replay: true, assistiu_replay: false })).toBe(true);
    expect(viuReplay({ acessou_replay: undefined, assistiu_replay: undefined })).toBe(false);
  });

  const leads = [
    lead({ nome: "Abel", tier: "HMQL", tier_rank: 4, viu_replay: true, acessou_replay: true, aplicou_replay: true, telefone: "+5548998350001" }),
    lead({ nome: "Bere", ja_agendou: true, dono: { id: "u2", nome: "Benhur Ramos", email: null } }),
    lead({ nome: "Célio", viu_replay: true, assistiu_replay: true, email: "celio@x.com" }),
    lead({ nome: "Dalva", dono: null, convidado_resgate: true }),
  ];
  const nomes = (x: LeadAusente[]) => x.map((l) => l.nome);

  it("filtra por tier, dono, 'viu o replay', call agendada e busca; ordem preservada", () => {
    const f = (x: Parameters<typeof filtrarAusentes>[1]) => nomes(filtrarAusentes(leads, x));
    expect(f({ tiers: [], busca: "" })).toEqual(["Abel", "Bere", "Célio", "Dalva"]);
    expect(f({ tiers: ["HMQL"], busca: "" })).toEqual(["Abel"]);
    expect(f({ tiers: [], donos: ["u2"], busca: "" })).toEqual(["Bere"]);
    expect(f({ tiers: [], donos: ["sem"], busca: "" })).toEqual(["Dalva"]);
    expect(f({ tiers: [], soViuReplay: true, busca: "" })).toEqual(["Abel", "Célio"]);
    expect(f({ tiers: [], agendou: "sim", busca: "" })).toEqual(["Bere"]);
    expect(f({ tiers: [], agendou: "nao", soViuReplay: true, busca: "" })).toEqual(["Abel", "Célio"]);
    expect(f({ tiers: [], busca: "48 9983" })).toEqual(["Abel"]);
    expect(f({ tiers: [], busca: "CELIO" })).toEqual(["Célio"]);
    expect(contarViramReplay(leads)).toBe(2);
  });

  it("CSV: 14 colunas fixas com os sinais de recuperação", () => {
    const linhas = csvDeAusentes([leads[0], leads[3]]).split("\r\n");
    expect(linhas[0]).toBe(
      '"nome";"mql";"dono";"etapa";"viu_replay";"aplicou_replay";"resgate";"ja_agendou";"telefone";"email";"evento";"entrou_em";"url_clint";"tags"',
    );
    expect(linhas[1]).toBe(
      '"Abel";"HMQL";"Guilherme Alves";"Prospecção";"sim";"sim";"";"";"+5548998350001";"";"WG - 22.09.26";"2026-09-16T12:00:00Z";"https://app.clint.digital/deal/d1";"WG - 22.09.26"',
    );
    expect(linhas[2]).toContain('"Dalva";"MQL+";"Sem dono";"Prospecção";"";"";"sim";""');
  });
});
