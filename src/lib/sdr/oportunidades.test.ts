import { describe, expect, it } from "vitest";
import {
  agruparPorDono,
  altoValorPendente,
  chaveDono,
  opcoesDeDono,
  todosDesqualificados,
  baseDeLevantaram,
  etapasDoFunil,
  OportunidadesResponseSchema,
  contarPorTier,
  csvDePendentes,
  distribuicaoPorTier,
  filtrarPendentes,
  formatarPct,
  linkWhatsApp,
  ordenarPendentes,
  pct,
  tierDoLead,
  validarIntervalo,
  type LeadPendente,
} from "./oportunidades";

function lead(p: Partial<LeadPendente>): LeadPendente {
  return {
    clint_contact_id: "c1",
    nome: "Ana",
    telefone: "+5511999990001",
    email: "ana@ex.com",
    tier: "MQL",
    tier_rank: 1,
    evento_tag: "WG - 08.09.26",
    tags: ["Levantou a Mão", "MQL"],
    created_at: "2026-09-08T12:00:00Z",
    ...p,
  };
}

describe("tierDoLead", () => {
  it("resolve pelo nome canônico (case-insensitive) e nunca por substring", () => {
    expect(tierDoLead({ tier: "MQL+", tier_rank: 2 }).chave).toBe("MQL+");
    expect(tierDoLead({ tier: "umql", tier_rank: 5 }).chave).toBe("UMQL");
    expect(tierDoLead({ tier: "MQL", tier_rank: 1 }).chave).toBe("MQL");
  });
  it("cai no rank quando o nome não casa, e em 'sem' quando não há nada", () => {
    expect(tierDoLead({ tier: "XYZ", tier_rank: 4 }).chave).toBe("HMQL");
    expect(tierDoLead({ tier: null, tier_rank: 0 }).chave).toBe("sem");
    expect(tierDoLead({ tier: null, tier_rank: null }).chave).toBe("sem");
  });
});

describe("contagens", () => {
  const leads = [
    lead({ clint_contact_id: "1", tier: "UMQL+", tier_rank: 6 }),
    lead({ clint_contact_id: "2", tier: "HMQL", tier_rank: 4 }),
    lead({ clint_contact_id: "3", tier: "HMQL", tier_rank: 4 }),
    lead({ clint_contact_id: "4", tier: "MQL", tier_rank: 1 }),
    lead({ clint_contact_id: "5", tier: null, tier_rank: 0 }),
  ];
  it("conta por tier com todas as chaves presentes", () => {
    expect(contarPorTier(leads)).toEqual({
      "UMQL+": 1,
      UMQL: 0,
      HMQL: 2,
      SMQL: 0,
      "MQL+": 0,
      MQL: 1,
      sem: 1,
    });
  });
  it("alto valor = UMQL+/UMQL/HMQL", () => {
    expect(altoValorPendente(leads)).toBe(3);
  });
  it("distribuição só com tiers presentes, maior → menor (empate pelo rank)", () => {
    expect(distribuicaoPorTier(leads).map((d) => [d.tier.chave, d.total])).toEqual([
      ["HMQL", 2],
      ["UMQL+", 1],
      ["MQL", 1],
      ["sem", 1],
    ]);
  });
});

describe("filtrarPendentes", () => {
  const leads = [
    lead({
      clint_contact_id: "1",
      nome: "José Antônio",
      email: "jose@ex.com",
      tier: "UMQL",
      tier_rank: 5,
      telefone: "+5511987654321",
    }),
    lead({
      clint_contact_id: "2",
      nome: "Maria",
      email: "maria@ex.com",
      tier: "MQL",
      tier_rank: 1,
      telefone: "+5521912345678",
    }),
    lead({ clint_contact_id: "3", nome: "Pedro", email: null, tier: null, tier_rank: 0, telefone: null }),
  ];
  it("nenhum tier selecionado = todos", () => {
    expect(filtrarPendentes(leads, { tiers: [], busca: "" })).toHaveLength(3);
  });
  it("filtra por tiers (multi) incluindo 'sem'", () => {
    expect(
      filtrarPendentes(leads, { tiers: ["UMQL", "sem"], busca: "" }).map((l) => l.clint_contact_id),
    ).toEqual(["1", "3"]);
  });
  it("busca por nome sem acento, e-mail e dígitos do telefone", () => {
    expect(filtrarPendentes(leads, { tiers: [], busca: "jose antonio" })).toHaveLength(1);
    expect(filtrarPendentes(leads, { tiers: [], busca: "MARIA@" })).toHaveLength(1);
    expect(filtrarPendentes(leads, { tiers: [], busca: "21 9123" }).map((l) => l.nome)).toEqual([
      "Maria",
    ]);
    expect(filtrarPendentes(leads, { tiers: [], busca: "zzz" })).toHaveLength(0);
  });
});

describe("ordenarPendentes", () => {
  const leads = [
    lead({ clint_contact_id: "1", nome: "Bruno", tier: "HMQL", tier_rank: 4 }),
    lead({ clint_contact_id: "2", nome: "ana", tier: "MQL", tier_rank: 1 }),
    lead({ clint_contact_id: "3", nome: "Carla", tier: "HMQL", tier_rank: 4 }),
  ];
  it("null mantém a ordem do backend", () => {
    expect(ordenarPendentes(leads, null).map((l) => l.clint_contact_id)).toEqual(["1", "2", "3"]);
  });
  it("por nome asc (sem diferenciar caixa) e por tier desc (estável no empate)", () => {
    expect(ordenarPendentes(leads, { campo: "nome", direcao: "asc" }).map((l) => l.nome)).toEqual([
      "ana",
      "Bruno",
      "Carla",
    ]);
    expect(
      ordenarPendentes(leads, { campo: "tier", direcao: "desc" }).map((l) => l.clint_contact_id),
    ).toEqual(["1", "3", "2"]);
    expect(
      ordenarPendentes(leads, { campo: "tier", direcao: "asc" }).map((l) => l.clint_contact_id),
    ).toEqual(["2", "1", "3"]);
  });
});

describe("validarIntervalo", () => {
  it("aceita até 90 dias e rejeita acima, apontando o campo", () => {
    expect(validarIntervalo("2026-09-01", "2026-11-30")).toBeNull();
    expect(validarIntervalo("2026-09-01", "2026-12-01")?.campo).toBe("ate");
  });
  it("rejeita ate < de e datas vazias", () => {
    expect(validarIntervalo("2026-09-10", "2026-09-01")?.campo).toBe("ate");
    expect(validarIntervalo("", "2026-09-01")?.campo).toBe("de");
    expect(validarIntervalo("2026-09-01", "")?.campo).toBe("ate");
  });
});

describe("percentuais, WhatsApp e CSV", () => {
  it("pct e formatação", () => {
    expect(pct(31, 87)).toBeCloseTo(35.63, 1);
    expect(pct(1, 0)).toBe(0);
    expect(formatarPct(35.63)).toBe("36%");
    expect(formatarPct(7.25)).toBe("7,3%");
  });
  it("linkWhatsApp usa só dígitos e ignora número curto/nulo", () => {
    expect(linkWhatsApp("+55 (11) 98765-4321")).toBe("https://wa.me/5511987654321");
    expect(linkWhatsApp("1234")).toBeNull();
    expect(linkWhatsApp(null)).toBeNull();
  });
  it("CSV V2: colunas fixas (nome, mql, dono, etapa, telefone, email, evento, entrou_em, url_clint, tags) e aspas escapadas", () => {
    const csv = csvDePendentes([
      lead({
        nome: 'Ana "Nina"',
        tags: ["Levantou a Mão", "MQL"],
        dono: { id: "u1", nome: "Benhur Ramos", email: null },
        etapa: "Prospecção",
        url_clint: "https://app.clint.digital/deal/abc",
      }),
      lead({ clint_contact_id: "c2", nome: "Zé" }),
    ]);
    const [cabecalho, l1, l2] = csv.split("\r\n");
    expect(cabecalho).toBe(
      '"nome";"mql";"dono";"etapa";"telefone";"email";"evento";"entrou_em";"url_clint";"tags"',
    );
    expect(l1).toBe(
      '"Ana ""Nina""";"MQL";"Benhur Ramos";"Prospecção";"+5511999990001";"ana@ex.com";"WG - 08.09.26";"2026-09-08T12:00:00Z";"https://app.clint.digital/deal/abc";"Levantou a Mão, MQL"',
    );
    expect(l2).toContain('"Zé";"MQL";"Sem dono";"";');
    expect(l2).toContain(';"";"Levantou a Mão, MQL"'); // url_clint vazia
  });
});

describe("assistiram (opcional no contrato)", () => {
  const base = { no_evento: 186, levantaram_mao: 40, agendaram: 10, pendentes: 30 };
  const resp = { de: "2026-09-15", ate: "2026-09-21", eventos: [], leads: [], gerado_em: "x", cache: "miss" };
  it("lead_id do pendente é opcional (link para a ficha só quando vem)", () => {
    const resp = { de: "x", ate: "x", eventos: [], totais: base, gerado_em: "x", cache: "miss" };
    const semId = OportunidadesResponseSchema.safeParse({ ...resp, leads: [lead({})] });
    const comId = OportunidadesResponseSchema.safeParse({ ...resp, leads: [lead({ lead_id: "ld_0001" })] });
    expect(semId.success && semId.data.leads[0].lead_id).toBeUndefined();
    expect(comId.success && comId.data.leads[0].lead_id).toBe("ld_0001");
  });
  it("contrato aceita totais com e sem assistiram", () => {
    expect(OportunidadesResponseSchema.safeParse({ ...resp, totais: base }).success).toBe(true);
    expect(
      OportunidadesResponseSchema.safeParse({ ...resp, totais: { ...base, assistiram: 90 } }).success,
    ).toBe(true);
  });
  it("sem assistiram: 3 etapas e base = no evento", () => {
    expect(etapasDoFunil(base).map((e) => [e.chave, e.valor])).toEqual([
      ["inscritos", 186],
      ["levantaram", 40],
      ["agendaram", 10],
    ]);
    expect(etapasDoFunil(base)[0].rotulo).toBe("No evento");
    expect(baseDeLevantaram(base)).toEqual({ valor: 186, rotulo: "do no evento" });
  });
  it("com assistiram: 4 etapas e base = assistiram", () => {
    const t = { ...base, assistiram: 90 };
    expect(etapasDoFunil(t).map((e) => [e.chave, e.valor])).toEqual([
      ["inscritos", 186],
      ["assistiram", 90],
      ["levantaram", 40],
      ["agendaram", 10],
    ]);
    expect(etapasDoFunil(t)[0].rotulo).toBe("Inscritos");
    expect(baseDeLevantaram(t)).toEqual({ valor: 90, rotulo: "dos que assistiram" });
  });
});

describe("dono (V2)", () => {
  const benhur = { id: "u-benhur", nome: "Benhur Ramos", email: "b@x.com" };
  const glaucio = { id: "u-glaucio", nome: "Glaucio Portela", email: null };
  const leads = [
    lead({ clint_contact_id: "1", nome: "Ana", tier: "UMQL", tier_rank: 5, dono: glaucio }),
    lead({ clint_contact_id: "2", nome: "Bia", tier: "MQL", tier_rank: 1, dono: null }),
    lead({ clint_contact_id: "3", nome: "Caio", tier: "HMQL", tier_rank: 4, dono: benhur }),
    lead({ clint_contact_id: "4", nome: "Dudu", tier: "MQL", tier_rank: 1, dono: benhur }),
    lead({ clint_contact_id: "5", nome: "Eva", tier: "SMQL", tier_rank: 3 }), // dono ausente (V1)
  ];

  it("chaveDono: id → nome → 'sem'", () => {
    expect(chaveDono(benhur)).toBe("u-benhur");
    expect(chaveDono({ id: null, nome: "X", email: null })).toBe("nome:X");
    expect(chaveDono(null)).toBe("sem");
    expect(chaveDono(undefined)).toBe("sem");
  });

  it("opcoesDeDono usa totais.por_dono quando vem, com 'Sem dono' por último", () => {
    const op = opcoesDeDono(leads, [
      { dono_id: null, dono_nome: "Sem dono", pendentes: 2, alto_valor: 0 },
      { dono_id: "u-benhur", dono_nome: "Benhur Ramos", pendentes: 2, alto_valor: 1 },
      { dono_id: "u-glaucio", dono_nome: "Glaucio Portela", pendentes: 1, alto_valor: 1 },
    ]);
    expect(op.map((o) => [o.chave, o.pendentes, o.altoValor])).toEqual([
      ["u-benhur", 2, 1],
      ["u-glaucio", 1, 1],
      ["sem", 2, 0],
    ]);
  });

  it("opcoesDeDono deriva dos leads sem por_dono (backend V1)", () => {
    const op = opcoesDeDono(leads, null);
    expect(op.map((o) => [o.chave, o.nome, o.pendentes, o.altoValor])).toEqual([
      ["u-benhur", "Benhur Ramos", 2, 1],
      ["u-glaucio", "Glaucio Portela", 1, 1],
      ["sem", "Sem dono", 2, 0],
    ]);
  });

  it("filtro por dono combina em série com MQL", () => {
    expect(filtrarPendentes(leads, { tiers: [], donos: ["u-benhur"], busca: "" }).map((l) => l.nome)).toEqual(["Caio", "Dudu"]);
    expect(filtrarPendentes(leads, { tiers: ["MQL"], donos: ["u-benhur"], busca: "" }).map((l) => l.nome)).toEqual(["Dudu"]);
    expect(filtrarPendentes(leads, { tiers: [], donos: ["sem"], busca: "" }).map((l) => l.nome)).toEqual(["Bia", "Eva"]);
    expect(filtrarPendentes(leads, { tiers: [], donos: [], busca: "" })).toHaveLength(5);
  });

  it("ordenação por dono: alfabética com 'Sem dono' no fim nas DUAS direções", () => {
    expect(ordenarPendentes(leads, { campo: "dono", direcao: "asc" }).map((l) => l.nome)).toEqual(["Caio", "Dudu", "Ana", "Bia", "Eva"]);
    expect(ordenarPendentes(leads, { campo: "dono", direcao: "desc" }).map((l) => l.nome)).toEqual(["Ana", "Caio", "Dudu", "Bia", "Eva"]);
  });

  it("agruparPorDono: seções por pendentes desc, 'Sem dono' último, ordem interna preservada", () => {
    const g = agruparPorDono(leads);
    expect(g.map((x) => [x.nome, x.leads.map((l) => l.nome), x.altoValor])).toEqual([
      ["Benhur Ramos", ["Caio", "Dudu"], 1],
      ["Glaucio Portela", ["Ana"], 1],
      ["Sem dono", ["Bia", "Eva"], 0],
    ]);
  });

  it("todosDesqualificados só quando no_evento = 0 e há desqualificados", () => {
    const base = { levantaram_mao: 0, agendaram: 0, pendentes: 0 };
    expect(todosDesqualificados({ ...base, no_evento: 0, desqualificados: 7 })).toBe(true);
    expect(todosDesqualificados({ ...base, no_evento: 0, desqualificados: 0 })).toBe(false);
    expect(todosDesqualificados({ ...base, no_evento: 0 })).toBe(false);
    expect(todosDesqualificados({ ...base, no_evento: 3, desqualificados: 7 })).toBe(false);
  });
});
