import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";
import { RANK_ALTO_VALOR_MIN } from "@/lib/sdr/oportunidades";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/ausentes (LEADS_MODE=mock). Determinístico. Por
// evento reproduz o ciclo de 22/09: 436 inscritos, 133 presentes, 303 ausentes,
// 55 qualificados ausentes (3 UMQL+, 5 UMQL, 12 HMQL, 10 SMQL, 25 MQL+), ~1 em 5
// viu o replay (metade desses aplicou pela gravação), 1 já agendou. Ordem do
// backend: tier desc → viu o replay primeiro → nome asc. `simular=vazio` →
// nenhum qualificado ausente; `sem_contatos` → zero inscritos.
// ---------------------------------------------------------------------------

const NOMES = [
  "Abel Quintanilha", "Berenice Lago", "Célio Andrade", "Dalva Peixoto", "Ernesto Vilar",
  "Flávia Camargo", "Gustavo Henrique", "Heloá Brandão", "Isaac Pimenta", "Joyce Carvalho",
  "Kadu Ferreira", "Leila Sampaio", "Milton Rezende", "Nicole Assis", "Olavo Bittencourt",
  "Poliana Duarte", "Quintino Sales", "Roberta Lins", "Sebastião Cruz", "Talita Nogueira",
  "Uriel Matos", "Verônica Prado", "Waldir Gomes", "Ximena Corrêa", "Yasmin Freitas",
  "Zacarias Melo", "Aurora Teles", "Breno Guimarães", "Cíntia Ramalho", "Douglas Farias",
  "Eloá Soares", "Fabrício Lemos", "Graziela Pontes", "Hugo Sabino", "Irene Castro",
  "Jonatas Vieira", "Karen Oliveira", "Leonel Braga", "Marina Cunha", "Nelson Aguiar",
  "Otília Ramos", "Plínio Xavier", "Raíssa Moura", "Samuel Torres", "Tânia Lopes",
  "Ubaldo Neves", "Vilma Santana", "Wesley Fonseca", "Yago Barbosa", "Zilá Mendes",
  "Alan Teixeira", "Bruna Falcão", "Cássio Rocha", "Débora Lira", "Emerson Paiva",
];

const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
];

// MQL+ ou acima, como o backend corta.
const TIERS: { tag: string; rank: number; qtd: number }[] = [
  { tag: "UMQL+", rank: 6, qtd: 3 },
  { tag: "UMQL", rank: 5, qtd: 5 },
  { tag: "HMQL", rank: 4, qtd: 12 },
  { tag: "SMQL", rank: 3, qtd: 10 },
  { tag: "MQL+", rank: 2, qtd: 25 },
];
const ETAPAS = ["Sem atendimento", "Prospecção", "Qualificação", "Contato feito"];

export type LeadAusenteMock = {
  clint_contact_id: string;
  clint_deal_id: string | null;
  url_clint: string | null;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string;
  tier_rank: number;
  possivel_ninja: boolean;
  evento_tag: string;
  etapa: string | null;
  dono: { id: string; nome: string; email: string } | null;
  ja_agendou: boolean;
  acessou_replay: boolean;
  assistiu_replay: boolean;
  viu_replay: boolean;
  aplicou_replay: boolean;
  convidado_resgate: boolean;
  tags: string[];
  created_at: string;
};

export type AusentesMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: {
    inscritos: number;
    presentes: number;
    ausentes: number;
    qualificados_ausentes: number;
    viram_replay: number;
    ja_agendaram: number;
  };
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  leads: LeadAusenteMock[];
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

function lead(i: number, tier: (typeof TIERS)[number], evento: string): LeadAusenteMock {
  const nome = NOMES[(i + (chaveTag(evento) % 11) * 3) % NOMES.length];
  const acessou = i % 5 === 0;
  const assistiu = acessou && i % 10 === 0;
  const aplicouReplay = assistiu && i % 20 === 0;
  const comNegocio = i % 8 !== 7;
  const seq = String(i + 1).padStart(4, "0");
  const sufixo = evento.replace("WG - ", "");
  return {
    clint_contact_id: `clint-au-${seq}`,
    clint_deal_id: comNegocio ? `deal-au-${seq}` : null,
    url_clint: comNegocio ? `https://app.clint.digital/deal/deal-au-${seq}` : null,
    lead_id: i % 9 === 4 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    nome,
    telefone: i % 11 === 10 ? null : `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(40000000 + i * 3571).slice(0, 8)}`,
    email: i % 13 === 12 ? null : `${slug(nome)}@exemplo.com`,
    tier: tier.tag,
    tier_rank: tier.rank,
    possivel_ninja: i % 14 === 6,
    evento_tag: evento,
    etapa: comNegocio ? ETAPAS[i % ETAPAS.length] : null,
    dono: comNegocio ? DONOS[i % 3] : null,
    // Só 1 por evento já tem call (validação do backend: 1 no ciclo de 22/09).
    ja_agendou: i % 55 === 40,
    acessou_replay: acessou,
    assistiu_replay: assistiu,
    viu_replay: acessou || assistiu,
    aplicou_replay: aplicouReplay,
    convidado_resgate: i % 7 === 2,
    tags: [
      evento,
      tier.tag,
      ...(acessou ? ["Acessou Replay"] : []),
      ...(assistiu ? ["Assistiu Replay 30min"] : []),
      ...(aplicouReplay ? [`Pós WG-${sufixo}`, "Preencheu Aplicação - Replay"] : []),
      ...(i % 7 === 2 ? ["Convite Resgate"] : []),
    ],
    created_at: `${isoDaTag(evento)}T12:00:00.000Z`,
  };
}

export function mockAusentes(de: string, ate: string, simular?: string | null): AusentesMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  const zerado = { inscritos: 0, presentes: 0, ausentes: 0, qualificados_ausentes: 0, viram_replay: 0, ja_agendaram: 0 };
  if (n === 0 || simular === "sem_contatos") {
    return { ...base, totais: zerado, por_dono: [], leads: [] };
  }
  if (simular === "vazio") {
    return {
      ...base,
      totais: { inscritos: 436 * n, presentes: 133 * n, ausentes: 303 * n, qualificados_ausentes: 0, viram_replay: 0, ja_agendaram: 0 },
      por_dono: [],
      leads: [],
    };
  }

  const leads: LeadAusenteMock[] = [];
  eventos.forEach((evento, e) => {
    let i = e * 55;
    for (const tier of TIERS) for (let k = 0; k < tier.qtd; k++, i++) leads.push(lead(i, tier, evento));
  });
  // Ordem do backend: tier desc → viu o replay primeiro → evento desc → nome asc.
  leads.sort(
    (a, b) =>
      b.tier_rank - a.tier_rank ||
      Number(b.viu_replay) - Number(a.viu_replay) ||
      chaveTag(b.evento_tag) - chaveTag(a.evento_tag) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  const porDono = new Map<string, AusentesMock["por_dono"][number]>();
  for (const l of leads) {
    const chave = l.dono?.id ?? "sem";
    const atual = porDono.get(chave) ?? { dono_id: l.dono?.id ?? null, dono_nome: l.dono?.nome ?? "Sem dono", pendentes: 0, alto_valor: 0 };
    atual.pendentes += 1;
    if (l.tier_rank >= RANK_ALTO_VALOR_MIN) atual.alto_valor += 1;
    porDono.set(chave, atual);
  }
  const por_dono = [...porDono.values()].sort((a, b) => {
    if (a.dono_id === null) return 1;
    if (b.dono_id === null) return -1;
    return b.pendentes - a.pendentes || a.dono_nome.localeCompare(b.dono_nome, "pt-BR");
  });

  return {
    ...base,
    totais: {
      inscritos: 436 * n,
      presentes: 133 * n,
      ausentes: 303 * n,
      qualificados_ausentes: leads.length,
      viram_replay: leads.filter((l) => l.viu_replay).length,
      ja_agendaram: leads.filter((l) => l.ja_agendou).length,
    },
    por_dono,
    leads,
  };
}
