import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/presentes-sem-aplicar (LEADS_MODE=mock).
// Determinístico. Por evento reproduz a validação de 22/09: 438 inscritos, 132
// presentes, 62 aplicaram, 70 sem aplicar, 28 qualificados (2 UMQL, 10 HMQL,
// 4 SMQL, 12 MQL+), nenhum com call agendada. Ordem do backend: tier desc,
// tempo assistido desc. `simular=agendados` marca 3 com `ja_agendou` (para ver
// o selo); `simular=vazio` → ninguém qualificado sem aplicar; `sem_contatos` →
// zero inscritos. Erros ficam no proxy.
// ---------------------------------------------------------------------------

const NOMES = [
  "Ane Cristina Dutra", "Bruna Sarmento", "Cauã Ferraz", "Dalila Moreno", "Enzo Prates",
  "Flora Benevides", "Gael Nogueira", "Heloísa Tavora", "Ivan Sequeira", "Júlia Marques",
  "Kevin Andrade", "Laís Figueira", "Miguel Saraiva", "Noemi Castelo", "Otto Bernardes",
  "Pietra Lacerda", "Raul Mesquita", "Sofia Guedes", "Théo Palmeira", "Valéria Fontes",
  "Wendel Souto", "Yasmin Correia", "Alice Vasques", "Bento Ribeiro", "Clara Damasceno",
  "Davi Machado", "Emília Rocha", "Francisco Leão",
];

const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
];

// 2 UMQL, 10 HMQL, 4 SMQL, 12 MQL+ (nunca MQL ou abaixo: o backend corta em MQL+).
const TIERS: { tag: string; rank: number; qtd: number }[] = [
  { tag: "UMQL", rank: 5, qtd: 2 },
  { tag: "HMQL", rank: 4, qtd: 10 },
  { tag: "SMQL", rank: 3, qtd: 4 },
  { tag: "MQL+", rank: 2, qtd: 12 },
];

// Degraus de presença da Clint (percentual → minutos).
const DEGRAUS: [number, number][] = [
  [90, 135],
  [70, 105],
  [50, 75],
  [30, 45],
  [20, 30],
  [10, 15],
];
const ETAPAS = ["Prospecção", "Qualificação", "Contato feito", "Sem resposta"];

export type LeadPresenteMock = {
  clint_contact_id: string;
  clint_deal_id: string;
  url_clint: string;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string;
  tier_rank: number;
  possivel_ninja: boolean;
  evento_tag: string;
  etapa: string;
  dono: { id: string; nome: string; email: string };
  percentual_assistido: number;
  minutos_assistidos: number;
  ja_agendou: boolean;
  tags: string[];
  created_at: string;
};

export type PresentesMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: {
    inscritos: number;
    presentes: number;
    aplicaram: number;
    presentes_sem_aplicar: number;
    qualificados_sem_aplicar: number;
  };
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  leads: LeadPresenteMock[];
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

function isoDaTag(tag: string): string {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : "2026-01-01";
}

function chaveTag(tag: string): number {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  return m ? (2000 + Number(m[3])) * 10000 + Number(m[2]) * 100 + Number(m[1]) : -1;
}

function lead(i: number, tier: (typeof TIERS)[number], evento: string, agendou: boolean): LeadPresenteMock {
  const nome = NOMES[i % NOMES.length];
  const [percentual, minutos] = DEGRAUS[(i * 5) % DEGRAUS.length];
  const dono = DONOS[i % 3];
  const seq = String(i + 1).padStart(4, "0");
  const possivelNinja = i % 9 === 4;
  return {
    clint_contact_id: `clint-pr-${seq}`,
    clint_deal_id: `deal-pr-${seq}`,
    url_clint: `https://app.clint.digital/deal/deal-pr-${seq}`,
    lead_id: i % 7 === 3 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    nome,
    telefone: i % 10 === 9 ? null : `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(60000000 + i * 5237).slice(0, 8)}`,
    email: i % 12 === 11 ? null : `${slug(nome)}@exemplo.com`,
    tier: tier.tag,
    tier_rank: tier.rank,
    possivel_ninja: possivelNinja,
    evento_tag: evento,
    etapa: ETAPAS[i % ETAPAS.length],
    dono,
    percentual_assistido: percentual,
    minutos_assistidos: minutos,
    ja_agendou: agendou,
    tags: [evento, "Participou", `Assistiu ${percentual}%`, tier.tag, ...(possivelNinja ? ["Possível Ninja"] : [])],
    created_at: `${isoDaTag(evento)}T12:00:00.000Z`,
  };
}

export function mockPresentes(de: string, ate: string, simular?: string | null): PresentesMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  const zerado = { inscritos: 0, presentes: 0, aplicaram: 0, presentes_sem_aplicar: 0, qualificados_sem_aplicar: 0 };
  if (n === 0 || simular === "sem_contatos") {
    return { ...base, totais: zerado, por_dono: [], leads: [] };
  }
  if (simular === "vazio") {
    return {
      ...base,
      totais: { inscritos: 438 * n, presentes: 132 * n, aplicaram: 62 * n, presentes_sem_aplicar: 70 * n, qualificados_sem_aplicar: 0 },
      por_dono: [],
      leads: [],
    };
  }

  const leads: LeadPresenteMock[] = [];
  eventos.forEach((evento, e) => {
    let i = e * 28;
    for (const tier of TIERS) {
      for (let k = 0; k < tier.qtd; k++, i++) {
        leads.push(lead(i, tier, evento, simular === "agendados" && i % 28 < 3));
      }
    }
  });
  // Ordem do backend: tier desc → tempo assistido desc → evento desc → nome asc.
  leads.sort(
    (a, b) =>
      b.tier_rank - a.tier_rank ||
      b.minutos_assistidos - a.minutos_assistidos ||
      chaveTag(b.evento_tag) - chaveTag(a.evento_tag) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  const porDono = new Map<string, PresentesMock["por_dono"][number]>();
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
    totais: {
      inscritos: 438 * n,
      presentes: 132 * n,
      aplicaram: 62 * n,
      presentes_sem_aplicar: 70 * n,
      qualificados_sem_aplicar: leads.length,
    },
    por_dono,
    leads,
  };
}
