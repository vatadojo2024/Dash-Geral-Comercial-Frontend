import { describe, expect, it } from "vitest";
import {
  blocosNaoAbordados,
  contarParados,
  csvDeNaoAbordados,
  DIAS_PARADO_ALERTA,
  diasParado,
  filtrarNaoAbordados,
  NaoAbordadosResponseSchema,
  paradoHaMais,
  type LeadNaoAbordado,
} from "./naoAbordados";

const AGORA = new Date("2026-09-22T12:00:00Z");

function lead(extra: Partial<LeadNaoAbordado> & { nome: string }): LeadNaoAbordado {
  return {
    clint_contact_id: extra.nome,
    clint_deal_id: "d1",
    url_clint: "https://app.clint.digital/deal/d1",
    lead_id: null,
    telefone: null,
    email: null,
    tier: null,
    tier_rank: 0,
    possivel_ninja: false,
    evento_tag: "WG - 22.09.26",
    etapa: "Sem atendimento",
    dono: { id: "u1", nome: "Guilherme Alves", email: null },
    tags: ["WG - 22.09.26"],
    created_at: "2026-09-16T12:00:00Z",
    ...extra,
  };
}

const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

describe("contrato de /api/eventos/nao-abordados", () => {
  it("aceita a resposta do backend (exemplo da spec) e tolera campos extras", () => {
    const r = NaoAbordadosResponseSchema.safeParse({
      de: "2026-09-22",
      ate: "2026-09-28",
      eventos: ["WG - 22.09.26"],
      totais: { inscritos: 427, nao_abordados: 89, qc: 30, extra: 1 },
      por_dono: [{ dono_id: "54934df3", dono_nome: "Guilherme Alves", pendentes: 62, alto_valor: 0 }],
      leads: [
        {
          clint_contact_id: "c1",
          clint_deal_id: "d1",
          url_clint: "https://app.clint.digital/deal/d1",
          lead_id: null,
          nome: "Lúcio Cleber",
          telefone: "+5548998358677",
          email: "lucio@exemplo.com",
          tier: "MQL",
          tier_rank: 1,
          possivel_ninja: false,
          evento_tag: "WG - 22.09.26",
          etapa: "Sem atendimento",
          stage_desde: "2026-09-18T01:31:56.884Z",
          dono: { id: "x", nome: "Benhur Ramos", email: "b@x.com" },
          tags: ["WG - 22.09.26"],
          created_at: "2026-09-16T12:00:00Z",
        },
      ],
      gerado_em: "2026-09-22T10:00:00Z",
      cache: "miss",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.totais.nao_abordados).toBe(89);
      expect(r.data.leads[0].stage_desde).toBe("2026-09-18T01:31:56.884Z");
      expect(r.data.por_dono?.[0].pendentes).toBe(62);
    }
  });

  it("exige totais.nao_abordados; inscritos, qc, por_dono e stage_desde são opcionais", () => {
    const base = { de: "x", ate: "x", eventos: [], leads: [], gerado_em: "x" };
    expect(NaoAbordadosResponseSchema.safeParse({ ...base, totais: {} }).success).toBe(false);
    expect(NaoAbordadosResponseSchema.safeParse({ ...base, totais: { nao_abordados: 0 } }).success).toBe(true);
  });
});

describe("tempo parado em 'Sem atendimento'", () => {
  it("conta dias inteiros; sem campo ou inválido é null; futuro vira zero", () => {
    expect(diasParado({ stage_desde: diasAtras(4.9) }, AGORA)).toBe(4);
    expect(diasParado({ stage_desde: diasAtras(0.2) }, AGORA)).toBe(0);
    expect(diasParado({ stage_desde: diasAtras(-1) }, AGORA)).toBe(0);
    expect(diasParado({ stage_desde: null }, AGORA)).toBeNull();
    expect(diasParado({ stage_desde: "ontem" }, AGORA)).toBeNull();
  });

  it(`alerta a partir de ${DIAS_PARADO_ALERTA} dias, e sem o campo nunca alerta`, () => {
    expect(paradoHaMais({ stage_desde: diasAtras(DIAS_PARADO_ALERTA) }, DIAS_PARADO_ALERTA, AGORA)).toBe(true);
    expect(paradoHaMais({ stage_desde: diasAtras(DIAS_PARADO_ALERTA - 0.5) }, DIAS_PARADO_ALERTA, AGORA)).toBe(false);
    expect(paradoHaMais({ stage_desde: undefined }, DIAS_PARADO_ALERTA, AGORA)).toBe(false);
    const leads = [
      lead({ nome: "a", stage_desde: diasAtras(10) }),
      lead({ nome: "b", stage_desde: diasAtras(1) }),
      lead({ nome: "c" }),
    ];
    expect(contarParados(leads, DIAS_PARADO_ALERTA, AGORA)).toBe(1);
  });
});

describe("funil, filtro e CSV do recorte", () => {
  it("funil: inscritos → não abordados, passagem lida como % dos inscritos", () => {
    const b = blocosNaoAbordados({ inscritos: 427, nao_abordados: 89, qc: 30 });
    expect(b.map((x) => [x.rotulo, x.valor])).toEqual([
      ["Inscritos", 427],
      ["Não abordados", 89],
    ]);
    expect(b[1]).toMatchObject({ passagem: { tipo: "pct", texto: "21%" }, baseDaPassagem: "dos inscritos" });
    // Inscritos ausente: travessão, nunca divisão por zero.
    expect(blocosNaoAbordados({ nao_abordados: 3 })[1].passagem).toEqual({ tipo: "pct", texto: "—" });
  });

  const leads = [
    lead({ nome: "Ana", tier: "MQL", tier_rank: 1, stage_desde: diasAtras(5), telefone: "+5548998358677" }),
    lead({ nome: "Bia", stage_desde: diasAtras(1), dono: { id: "u2", nome: "Benhur Ramos", email: null } }),
    lead({ nome: "Caio", stage_desde: diasAtras(9), email: "caio@x.com" }),
    lead({ nome: "Dudu", dono: null }),
  ];
  const nomes = (ls: LeadNaoAbordado[]) => ls.map((l) => l.nome);

  it("filtra por tier, dono, tempo parado e busca, mantendo a ordem do backend", () => {
    const f = (x: Parameters<typeof filtrarNaoAbordados>[1]) => nomes(filtrarNaoAbordados(leads, x, AGORA));
    expect(f({ tiers: [], busca: "" })).toEqual(["Ana", "Bia", "Caio", "Dudu"]);
    expect(f({ tiers: ["MQL"], busca: "" })).toEqual(["Ana"]);
    expect(f({ tiers: ["sem"], busca: "" })).toEqual(["Bia", "Caio", "Dudu"]);
    expect(f({ tiers: [], donos: ["u2"], busca: "" })).toEqual(["Bia"]);
    expect(f({ tiers: [], donos: ["sem"], busca: "" })).toEqual(["Dudu"]);
    expect(f({ tiers: [], soParados: true, busca: "" })).toEqual(["Ana", "Caio"]);
    expect(f({ tiers: ["sem"], soParados: true, busca: "" })).toEqual(["Caio"]);
    expect(f({ tiers: [], busca: "48 9983" })).toEqual(["Ana"]);
    expect(f({ tiers: [], busca: "CAIO@" })).toEqual(["Caio"]);
  });

  it("CSV: 12 colunas fixas com parado_desde cru e dias_parado calculado", () => {
    const csv = csvDeNaoAbordados([leads[0], leads[3]], AGORA);
    const linhas = csv.split("\r\n");
    expect(linhas[0]).toBe(
      '"nome";"mql";"dono";"etapa";"parado_desde";"dias_parado";"telefone";"email";"evento";"entrou_em";"url_clint";"tags"',
    );
    expect(linhas[1]).toBe(
      `"Ana";"MQL";"Guilherme Alves";"Sem atendimento";"${diasAtras(5)}";"5";"+5548998358677";"";"WG - 22.09.26";"2026-09-16T12:00:00Z";"https://app.clint.digital/deal/d1";"WG - 22.09.26"`,
    );
    expect(linhas[2]).toContain('"Dudu";"Sem classificação";"Sem dono";"Sem atendimento";"";""');
  });
});
