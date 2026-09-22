import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/nao-abordados (LEADS_MODE=mock). Determinístico.
// Por evento do intervalo: 24 não abordados (o backend validou 24 no ciclo de
// 15/09) em 171 inscritos, 8 na trilha QC. Tier quase sempre null (1 em 5 tem
// tag MQL), todos com negócio e dono (Guilherme 7 : Benhur 2 : Glaucio 1),
// `stage_desde` espalhado entre 0 e 11 dias atrás. Ordem = a do backend
// (tier desc, evento desc, nome asc).
// `simular=vazio|sem_contatos|clint_auth|clint_indisponivel|leads_indisponivel|
// intervalo_muito_grande` exercita os estados (os de erro ficam no route handler).
// ---------------------------------------------------------------------------

const NOMES = [
  "Lúcio Cleber", "Adriana Peixoto", "Bento Sales", "Carla Miranda", "Décio Furtado",
  "Elisa Prado", "Flávio Torres", "Geovana Lacerda", "Heitor Sampaio", "Iara Nunes",
  "Jorge Bittencourt", "Kelly Amaral", "Lívia Serrano", "Murilo Esteves", "Nara Coimbra",
  "Osmar Tavares", "Priscila Rangel", "Quirino Leal", "Renata Assis", "Sérgio Dutra",
  "Tainá Moraes", "Ubirajara Pires", "Valentina Rezende", "Wagner Quintela",
];

const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
];
// 7 : 2 : 1 — 24 leads por evento viram 17 / 5 / 2.
const PESO_DONO = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

const TIERS_MQL: { tag: string; rank: number }[] = [
  { tag: "HMQL", rank: 4 },
  { tag: "SMQL", rank: 3 },
  { tag: "MQL+", rank: 2 },
  { tag: "MQL", rank: 1 },
];

export type LeadNaoAbordadoMock = {
  clint_contact_id: string;
  clint_deal_id: string;
  url_clint: string;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string | null;
  tier_rank: number;
  possivel_ninja: boolean;
  evento_tag: string;
  etapa: string;
  stage_desde: string;
  dono: { id: string; nome: string; email: string };
  tags: string[];
  created_at: string;
};

export type NaoAbordadosMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: { inscritos: number; nao_abordados: number; qc: number };
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  leads: LeadNaoAbordadoMock[];
  gerado_em: string;
  cache: "hit" | "miss";
};

function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

function chaveTag(tag: string): number {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  if (!m) return -1;
  return (2000 + Number(m[3])) * 10000 + Number(m[2]) * 100 + Number(m[1]);
}

function isoDaTag(tag: string): string {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : "2026-01-01";
}

function linha(i: number, evento: string, agora: Date): LeadNaoAbordadoMock {
  const nome = NOMES[i % NOMES.length];
  const tier = i % 5 === 4 ? TIERS_MQL[(i / 5) % TIERS_MQL.length | 0] : null;
  const dono = DONOS[PESO_DONO[i % PESO_DONO.length]];
  const possivelNinja = i % 9 === 8;
  const dia = isoDaTag(evento);
  // Parado entre 0 e 11 dias, espalhado para o chip "3+ dias" ter dos dois lados.
  const diasParado = (i * 7) % 12;
  const stageDesde = new Date(agora.getTime() - diasParado * 86_400_000 - (i % 24) * 3_600_000);
  const seq = String(i + 1).padStart(4, "0");
  return {
    clint_contact_id: `clint-na-${seq}`,
    clint_deal_id: `deal-na-${seq}`,
    url_clint: `https://app.clint.digital/deal/deal-na-${seq}`,
    // Quase sempre null: o lead só nasce no Mapa quando muda de etapa.
    lead_id: i % 12 === 5 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    nome,
    telefone: i % 11 === 10 ? null : `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(80000000 + i * 7919).slice(0, 8)}`,
    email: i % 13 === 12 ? null : `${slug(nome)}@exemplo.com`,
    tier: tier?.tag ?? null,
    tier_rank: tier?.rank ?? 0,
    possivel_ninja: possivelNinja,
    evento_tag: evento,
    etapa: "Sem atendimento",
    stage_desde: stageDesde.toISOString(),
    dono,
    tags: [evento, ...(tier ? [tier.tag] : []), ...(possivelNinja ? ["Possível Ninja"] : [])],
    created_at: `${dia}T12:00:00.000Z`,
  };
}

export function mockNaoAbordados(de: string, ate: string, simular?: string | null): NaoAbordadosMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  if (n === 0 || simular === "sem_contatos") {
    return { ...base, totais: { inscritos: 0, nao_abordados: 0, qc: 0 }, por_dono: [], leads: [] };
  }
  if (simular === "vazio") {
    return { ...base, totais: { inscritos: 171 * n, nao_abordados: 0, qc: 8 * n }, por_dono: [], leads: [] };
  }

  const agora = new Date();
  const leads: LeadNaoAbordadoMock[] = [];
  eventos.forEach((evento, e) => {
    for (let k = 0; k < 24; k++) leads.push(linha(e * 24 + k, evento, agora));
  });
  leads.sort((a, b) => {
    if (a.tier_rank !== b.tier_rank) return b.tier_rank - a.tier_rank;
    const da = chaveTag(a.evento_tag);
    const db = chaveTag(b.evento_tag);
    if (da !== db) return db - da;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });

  const porDono = new Map<string, NaoAbordadosMock["por_dono"][number]>();
  for (const l of leads) {
    const atual = porDono.get(l.dono.id) ?? { dono_id: l.dono.id, dono_nome: l.dono.nome, pendentes: 0, alto_valor: 0 };
    atual.pendentes += 1;
    if (l.tier_rank >= 4) atual.alto_valor += 1;
    porDono.set(l.dono.id, atual);
  }
  const por_dono = [...porDono.values()].sort(
    (a, b) => b.pendentes - a.pendentes || a.dono_nome.localeCompare(b.dono_nome, "pt-BR"),
  );

  return {
    ...base,
    totais: { inscritos: 171 * n, nao_abordados: leads.length, qc: 8 * n },
    por_dono,
    leads,
  };
}
