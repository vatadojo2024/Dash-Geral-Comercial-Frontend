import { describe, expect, it } from "vitest";
import {
  agruparPorDono,
  altoValorPendente,
  ehAltoValor,
  mostraSeloNinja,
  TIERS,
  TIERS_ALTO_VALOR,
  blocosDoFunil,
  blocosDoResgate,
  celulaMatriz,
  chaveDaLinha,
  chaveDono,
  contarPorOrigem,
  contarPorTier,
  csvDePendentes,
  distribuicaoPorTier,
  filtrarPendentes,
  formatarPct,
  formatarTaxa,
  funilZerado,
  linkWhatsApp,
  marcadoresDoLead,
  opcoesDeDono,
  OportunidadesResponseSchema,
  ordenarPendentes,
  origemDoLead,
  passagemCalculada,
  pct,
  rotuloDoDegrau,
  tierDoLead,
  todosDesqualificados,
  traduzirAvisos,
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

describe("Ninja: trilha separada da escala MQL", () => {
  const ninja = { tier: "Ninja", tier_rank: 0 };

  it("é reconhecido pelo nome (qualquer caixa) e o rótulo exibido é exatamente 'Ninja'", () => {
    expect(tierDoLead(ninja).chave).toBe("Ninja");
    expect(tierDoLead(ninja).label).toBe("Ninja");
    expect(tierDoLead({ tier: "NINJA", tier_rank: 0 }).chave).toBe("Ninja");
    expect(tierDoLead({ tier: "Possível Ninja", tier_rank: 0 }).chave).toBe("sem"); // backend manda "Ninja"
  });

  it("rank 0 NÃO o joga em 'Sem classificação', e lead sem tag continua 'sem'", () => {
    expect(tierDoLead(ninja).chave).not.toBe("sem");
    expect(tierDoLead({ tier: null, tier_rank: 0 }).chave).toBe("sem");
  });

  it("não é alto valor e não altera a escala MQL", () => {
    expect(ehAltoValor(ninja)).toBe(false);
    expect(TIERS.filter((t) => t.mql).map((t) => [t.chave, t.rank])).toEqual([
      ["UMQL+", 6],
      ["UMQL", 5],
      ["HMQL", 4],
      ["SMQL", 3],
      ["MQL+", 2],
      ["MQL", 1],
    ]);
    expect(TIERS_ALTO_VALOR).not.toContain("Ninja");
  });

  it("aparece entre MQL e 'Sem classificação' nos chips e nas barras", () => {
    expect(TIERS.map((t) => t.chave)).toEqual(["UMQL+", "UMQL", "HMQL", "SMQL", "MQL+", "MQL", "Ninja", "sem"]);
    const leads = [
      lead({ clint_contact_id: "1", tier: "MQL", tier_rank: 1 }),
      lead({ clint_contact_id: "2", tier: "Ninja", tier_rank: 0 }),
      lead({ clint_contact_id: "3", tier: null, tier_rank: 0 }),
    ];
    // Posição fixa: Ninja fica sempre entre MQL e "sem", com ou sem pendentes.
    const chaves = distribuicaoPorTier(leads).map((d) => d.tier.chave);
    expect(chaves.indexOf("Ninja")).toBe(chaves.indexOf("MQL") + 1);
    expect(chaves.indexOf("sem")).toBe(chaves.indexOf("Ninja") + 1);
  });

  it("conta e filtra como as demais classificações, sem contaminar alto valor", () => {
    const leads = [
      lead({ clint_contact_id: "1", nome: "Ana", tier: "HMQL", tier_rank: 4 }),
      lead({ clint_contact_id: "2", nome: "Bia", tier: "Ninja", tier_rank: 0 }),
      lead({ clint_contact_id: "3", nome: "Caio", tier: "Ninja", tier_rank: 0 }),
      lead({ clint_contact_id: "4", nome: "Dudu", tier: null, tier_rank: 0 }),
    ];
    expect(contarPorTier(leads)).toMatchObject({ HMQL: 1, Ninja: 2, sem: 1 });
    expect(altoValorPendente(leads)).toBe(1);
    expect(filtrarPendentes(leads, { tiers: ["Ninja"], busca: "" }).map((l) => l.nome)).toEqual(["Bia", "Caio"]);
    expect(filtrarPendentes(leads, { tiers: ["sem"], busca: "" }).map((l) => l.nome)).toEqual(["Dudu"]);
  });

  it("selo Ninja: só quando possivel_ninja é true E o tier é da escala MQL (ou nulo)", () => {
    expect(mostraSeloNinja({ tier: "SMQL", tier_rank: 3, possivel_ninja: true })).toBe(true);
    expect(mostraSeloNinja({ tier: "MQL", tier_rank: 1, possivel_ninja: true })).toBe(true);
    expect(mostraSeloNinja({ tier: "Ninja", tier_rank: 0, possivel_ninja: true })).toBe(false); // badge já diz Ninja
    expect(mostraSeloNinja({ tier: "SMQL", tier_rank: 3, possivel_ninja: false })).toBe(false);
    expect(mostraSeloNinja({ tier: "SMQL", tier_rank: 3 })).toBe(false); // backend antigo
  });

  it("no CSV sai 'Ninja' na coluna mql; o selo não altera a coluna", () => {
    const linhas = csvDePendentes([
      lead({ nome: "Bia", tier: "Ninja", tier_rank: 0 }),
      lead({ nome: "Dani", tier: "SMQL", tier_rank: 3, possivel_ninja: true }),
    ]).split("\r\n");
    expect(linhas[1]).toContain('"Bia";"Ninja";');
    expect(linhas[2]).toContain('"Dani";"SMQL";');
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
      Ninja: 0,
      sem: 1,
    });
  });
  it("alto valor = UMQL+/UMQL/HMQL", () => {
    expect(altoValorPendente(leads)).toBe(3);
  });
  it("distribuição em posição FIXA (ordem da hierarquia), incluindo zerados", () => {
    expect(distribuicaoPorTier(leads).map((d) => [d.tier.chave, d.total])).toEqual([
      ["UMQL+", 1],
      ["UMQL", 0],
      ["HMQL", 2],
      ["SMQL", 0],
      ["MQL+", 0],
      ["MQL", 1],
      ["Ninja", 0],
      ["sem", 1],
    ]);
    // Ordem não muda com a quantidade: HMQL (2) segue abaixo de UMQL+ (1).
    expect(distribuicaoPorTier([]).map((d) => d.tier.chave)).toEqual(
      distribuicaoPorTier(leads).map((d) => d.tier.chave),
    );
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
  it("CSV: doze colunas fixas e aspas escapadas", () => {
    const csv = csvDePendentes([
      lead({
        nome: 'Ana "Nina"',
        tags: ["Levantou a Mão", "MQL"],
        dono: { id: "u1", nome: "Benhur Ramos", email: null },
        etapa: "Prospecção",
        url_clint: "https://app.clint.digital/deal/abc",
        origem: "replay",
        convidado_resgate: true,
      }),
      lead({ clint_contact_id: "c2", nome: "Zé" }),
    ]);
    const [cabecalho, l1, l2] = csv.split("\r\n");
    expect(cabecalho).toBe(
      '"nome";"mql";"origem";"resgate";"dono";"etapa";"telefone";"email";"evento";"entrou_em";"url_clint";"tags"',
    );
    expect(l1).toBe(
      '"Ana ""Nina""";"MQL";"Replay";"sim";"Benhur Ramos";"Prospecção";"+5511999990001";"ana@ex.com";"WG - 08.09.26";"2026-09-08T12:00:00Z";"https://app.clint.digital/deal/abc";"Levantou a Mão, MQL"',
    );
    expect(l2).toContain('"Zé";"MQL";"";"";"Sem dono";"";'); // sem origem reconhecida → vazio
    expect(l2).toContain(';"";"Levantou a Mão, MQL"'); // url_clint vazia
  });
});

describe("contrato", () => {
  const resp = { de: "x", ate: "x", eventos: [], totais: { pendentes: 0 }, gerado_em: "x", cache: "miss" };
  it("lead_id do pendente é opcional (link para a ficha só quando vem)", () => {
    const semId = OportunidadesResponseSchema.safeParse({ ...resp, leads: [lead({})] });
    const comId = OportunidadesResponseSchema.safeParse({ ...resp, leads: [lead({ lead_id: "ld_0001" })] });
    expect(semId.success && semId.data.leads[0].lead_id).toBeUndefined();
    expect(comId.success && comId.data.leads[0].lead_id).toBe("ld_0001");
  });
  it("V4 completo, resgate null e resposta sem matriz/funis (backend antigo) são aceitos", () => {
    const linha = { acessaram: null, assistiram: 58, aplicaram: 20, agendaram: 11, taxa_agendamento: 0.55, pendentes: 9, alto_valor_pendente: 2 };
    const v4 = {
      ...resp,
      totais: { inscritos: 171, desqualificados: 64, pendentes: 9 },
      matriz: { ao_vivo: linha, replay: linha, total: linha },
      funis: { ao_vivo: { degraus: [{ nome: "inscritos", valor: 171 }] }, replay: { degraus: [] } },
      resgate: null,
      avisos: [],
      leads: [lead({ origem: "ao_vivo", assistiu_ao_vivo: true })],
    };
    expect(OportunidadesResponseSchema.safeParse(v4).success).toBe(true);
    expect(OportunidadesResponseSchema.safeParse({ ...resp, leads: [] }).success).toBe(true);
  });
  it("totais.qc é opcional: contagem de conferência dos excluídos da trilha QC", () => {
    const com = OportunidadesResponseSchema.safeParse({ ...resp, totais: { inscritos: 160, desqualificados: 15, qc: 10, pendentes: 7 }, leads: [] });
    expect(com.success && com.data.totais.qc).toBe(10);
    const sem = OportunidadesResponseSchema.safeParse({ ...resp, leads: [] });
    expect(sem.success && sem.data.totais.qc).toBeUndefined();
    // Lead que ainda viesse como "QC" (backend antigo) não ganha chip próprio: cai em "sem".
    expect(tierDoLead({ tier: "QC", tier_rank: 0 }).chave).toBe("sem");
  });
  it("possivel_ninja é opcional", () => {
    const r = OportunidadesResponseSchema.safeParse({ ...resp, leads: [lead({ possivel_ninja: true }), lead({})] });
    expect(r.success && r.data.leads.map((l) => l.possivel_ninja)).toEqual([true, undefined]);
  });
  it("chave da linha é (contato, evento): o mesmo contato em dois eventos não colide", () => {
    const a = lead({ clint_contact_id: "c1", evento_tag: "WG - 08.09.26" });
    const b = lead({ clint_contact_id: "c1", evento_tag: "WG - 15.09.26" });
    expect(chaveDaLinha(a)).not.toBe(chaveDaLinha(b));
    expect(chaveDaLinha(a)).toBe("c1|WG - 08.09.26");
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

  it("todosDesqualificados só quando inscritos = 0 e há desqualificados", () => {
    expect(todosDesqualificados({ pendentes: 0, inscritos: 0, desqualificados: 7 })).toBe(true);
    expect(todosDesqualificados({ pendentes: 0, inscritos: 0, desqualificados: 0 })).toBe(false);
    expect(todosDesqualificados({ pendentes: 0, inscritos: 0 })).toBe(false);
    expect(todosDesqualificados({ pendentes: 0, inscritos: 3, desqualificados: 7 })).toBe(false);
    expect(todosDesqualificados({ pendentes: 0, desqualificados: 7 })).toBe(false); // inscritos ausente
  });
});

describe("origem (V4): só ao vivo ou replay", () => {
  const leads = [
    lead({ clint_contact_id: "1", nome: "Ana", origem: "replay", convidado_resgate: true, assistiu_ao_vivo: true }),
    lead({ clint_contact_id: "2", nome: "Bia", origem: "replay" }),
    lead({ clint_contact_id: "3", nome: "Caio", origem: "ao_vivo", assistiu_replay: true, tier: "HMQL", tier_rank: 4 }),
    lead({ clint_contact_id: "4", nome: "Dudu", origem: "ao_vivo", convidado_resgate: true }),
    lead({ clint_contact_id: "5", nome: "Eva" }), // backend antigo: sem o campo
  ];

  it("origemDoLead reconhece os dois valores; ausente/inesperado → null (sem badge)", () => {
    expect(origemDoLead({ origem: "ao_vivo" })?.label).toBe("Ao vivo");
    expect(origemDoLead({ origem: "replay" })?.label).toBe("Replay");
    expect(origemDoLead({ origem: null })).toBeNull();
    expect(origemDoLead({})).toBeNull();
    expect(origemDoLead({ origem: "outro" })).toBeNull();
  });

  it("marcadores: resgate é independente; os outros apontam o recorte que NÃO é a origem", () => {
    expect(marcadoresDoLead(leads[0])).toEqual(["resgate", "esteve_ao_vivo"]);
    expect(marcadoresDoLead(leads[1])).toEqual([]);
    expect(marcadoresDoLead(leads[2])).toEqual(["viu_replay"]);
    expect(marcadoresDoLead(leads[3])).toEqual(["resgate"]);
    // ao vivo que "esteve ao vivo" e replay que "viu o replay" não ganham marcador redundante
    expect(marcadoresDoLead({ origem: "ao_vivo", assistiu_ao_vivo: true })).toEqual([]);
    expect(marcadoresDoLead({ origem: "replay", assistiu_replay: true })).toEqual([]);
  });

  it("contagens por origem e de convidados de resgate", () => {
    expect(contarPorOrigem(leads)).toEqual({ ao_vivo: 2, replay: 2, resgate: 2 });
  });

  it("filtro de origem é multi, aplica em série com MQL; resgate é independente", () => {
    const f = (x: Parameters<typeof filtrarPendentes>[1]) => filtrarPendentes(leads, x).map((l) => l.nome);
    expect(f({ tiers: [], origens: ["ao_vivo"], busca: "" })).toEqual(["Caio", "Dudu"]);
    expect(f({ tiers: [], origens: ["ao_vivo", "replay"], busca: "" })).toEqual(["Ana", "Bia", "Caio", "Dudu"]);
    expect(f({ tiers: ["HMQL"], origens: ["ao_vivo"], busca: "" })).toEqual(["Caio"]);
    expect(f({ tiers: [], soResgate: true, busca: "" })).toEqual(["Ana", "Dudu"]);
    expect(f({ tiers: [], origens: ["ao_vivo"], soResgate: true, busca: "" })).toEqual(["Dudu"]);
    expect(f({ tiers: [], origens: [], soResgate: false, busca: "" })).toHaveLength(5);
  });

  it("ordenação por origem; linha sem origem reconhecida sempre no fim", () => {
    expect(ordenarPendentes(leads, { campo: "origem", direcao: "asc" }).map((l) => l.nome)).toEqual(["Caio", "Dudu", "Ana", "Bia", "Eva"]);
    expect(ordenarPendentes(leads, { campo: "origem", direcao: "desc" }).map((l) => l.nome)).toEqual(["Ana", "Bia", "Caio", "Dudu", "Eva"]);
  });

  it("travessão só para null: célula e % da taxa de agendamento", () => {
    expect(celulaMatriz(null)).toBe("—");
    expect(celulaMatriz(0)).toBe("0");
    expect(formatarTaxa(null)).toBe("—");
    expect(formatarTaxa(0.55)).toBe("55%");
    expect(formatarTaxa(0)).toBe("0,0%");
  });
});

describe("funis (V4): degraus prontos, taxas no front", () => {
  const aoVivo = [
    { nome: "inscritos", valor: 171 },
    { nome: "assistiram", valor: 58 },
    { nome: "aplicaram", valor: 20 },
    { nome: "agendaram", valor: 11 },
    { nome: "pendentes", valor: 9 },
  ];
  const replay = [
    { nome: "acessaram", valor: 40 },
    { nome: "assistiram", valor: 22 },
    { nome: "aplicaram", valor: 6 },
    { nome: "agendaram", valor: 2 },
    { nome: "pendentes", valor: 4 },
  ];

  it("rótulos: 'aplicaram' muda por recorte; nome desconhecido nunca sai cru", () => {
    expect(rotuloDoDegrau("aplicaram", "ao_vivo")).toBe("Levantaram a mão");
    expect(rotuloDoDegrau("aplicaram", "replay")).toBe("Aplicaram");
    expect(rotuloDoDegrau("aplicaram", "resgate")).toBe("Levantaram a mão");
    expect(rotuloDoDegrau("acessaram", "replay")).toBe("Acessaram");
    expect(rotuloDoDegrau("degrau_novo", "ao_vivo")).toBe("Degrau novo");
  });

  it("passagem: degrau / anterior; anterior zero → travessão; degrau maior → verificar", () => {
    expect(passagemCalculada(58, 171)).toEqual({ tipo: "pct", texto: "34%" });
    expect(passagemCalculada(0, 0)).toEqual({ tipo: "pct", texto: "—" });
    expect(passagemCalculada(5, 0)).toEqual({ tipo: "pct", texto: "—" });
    expect(passagemCalculada(200, 171)).toEqual({ tipo: "verificar" });
    expect(passagemCalculada(171, 171)).toEqual({ tipo: "pct", texto: "100%" });
  });

  it("funil ao vivo: taxas consecutivas e Pendentes medido contra quem levantou a mão", () => {
    const b = blocosDoFunil(aoVivo, "ao_vivo");
    expect(b.map((x) => [x.rotulo, x.valor, x.passagem])).toEqual([
      ["Inscritos", 171, null],
      ["Assistiram", 58, { tipo: "pct", texto: "34%" }],
      ["Levantaram a mão", 20, { tipo: "pct", texto: "34%" }],
      ["Agendaram", 11, { tipo: "pct", texto: "55%" }],
      ["Pendentes", 9, { tipo: "pct", texto: "45%" }],
    ]);
    expect(b[4].baseDaPassagem).toBe("de quem levantou a mão");
  });

  it("funil do replay: menos da metade agendou NÃO vira 'verificar base' em Pendentes", () => {
    // agendaram 2, pendentes 4: contra 'agendaram' seria 200%; contra 'aplicaram' é 67%.
    const b = blocosDoFunil(replay, "replay");
    expect(b[2].rotulo).toBe("Aplicaram");
    expect(b[4]).toMatchObject({ rotulo: "Pendentes", passagem: { tipo: "pct", texto: "67%" }, baseDaPassagem: "de quem aplicou" });
  });

  it("funil monotônico: se um degrau sobe, aparece 'verificar'", () => {
    const b = blocosDoFunil(
      [{ nome: "inscritos", valor: 171 }, { nome: "assistiram", valor: 1292 }, { nome: "aplicaram", valor: 819 }],
      "ao_vivo",
    );
    expect(b[1].passagem).toEqual({ tipo: "verificar" });
    expect(b[2].passagem).toEqual({ tipo: "pct", texto: "63%" });
  });

  it("replay sem dados: zerado é detectado, e os blocos continuam existindo com zeros", () => {
    const zeros = replay.map((d) => ({ ...d, valor: 0 }));
    expect(funilZerado(zeros)).toBe(true);
    expect(funilZerado(replay)).toBe(false);
    expect(funilZerado([])).toBe(true);
    const b = blocosDoFunil(zeros, "replay");
    expect(b).toHaveLength(5);
    expect(b.slice(1).every((x) => x.passagem?.tipo === "pct" && x.passagem.texto === "—")).toBe(true);
  });

  it("resgate: mesmos blocos, base = convidados, taxas calculadas no front", () => {
    const b = blocosDoResgate({ convidados: 2600, assistiram: 180, aplicaram: 42, agendaram: 15, pendentes: 27 });
    expect(b.map((x) => [x.rotulo, x.valor, x.passagem?.tipo === "pct" ? x.passagem.texto : x.passagem])).toEqual([
      ["Convidados", 2600, null],
      ["Assistiram", 180, "6,9%"],
      ["Levantaram a mão", 42, "23%"],
      ["Agendaram", 15, "36%"],
      ["Pendentes", 27, "64%"],
    ]);
  });
});

describe("avisos (V4)", () => {
  it("os três códigos têm frase; chave crua e código desconhecido nunca aparecem", () => {
    const textos = traduzirAvisos([
      "assistiram_acima_da_base",
      "aplicaram_acima_de_assistiram",
      "taxa_acima_de_100",
      "codigo_novo_x",
      "outro_codigo",
    ]);
    expect(textos).toHaveLength(4); // os dois desconhecidos colapsam na frase genérica
    for (const t of textos) expect(t).not.toMatch(/_/);
    expect(textos[0]).toBe("Assistiram supera a base de inscritos e convidados — verificar tags.");
    expect(textos[1]).toBe("Aplicaram supera assistiram — inconsistência de cálculo, avise o time técnico.");
    expect(textos[2]).toBe("Há taxa acima de 100% — verificar base.");
    expect(traduzirAvisos(null)).toEqual([]);
  });
});
