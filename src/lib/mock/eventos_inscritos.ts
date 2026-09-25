import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";
import { RANK_ALTO_VALOR_MIN } from "@/lib/sdr/oportunidades";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/inscritos (LEADS_MODE=mock, CONTRATO PROVISÓRIO).
// Por evento, 96 inscritos de todas as classificações com os sinais do ciclo
// espalhados de forma determinística: ~35% presentes ao vivo, destes ~40%
// aplicaram; quem levantou a mão é sempre qualificado (MQL+ ou acima); parte
// agendou; ~25% em "Sem atendimento". Ordem: tier desc, presença desc, nome asc.
// `simular=vazio` → 0 inscritos.
// ---------------------------------------------------------------------------

const NOMES = [
  "Adão Carneiro", "Beatriz Lins", "Caio Fontoura", "Dora Salgado", "Elias Meireles",
  "Fátima Quadros", "Gilberto Nunes", "Hortência Reis", "Ícaro Bandeira", "Jussara Pontes",
  "Kleber Amorim", "Lídia Camargo", "Marcelo Espíndola", "Neusa Barros", "Orlando Vaz",
  "Patrícia Lemos", "Queiroz Almeida", "Rosana Trindade", "Sandro Bicalho", "Tereza Xavier",
  "Ulisses Prado", "Vanda Cerqueira", "Washington Lira", "Xuxa Medeiros", "Yuri Botelho",
  "Zenaide Couto", "Anderson Peres", "Bianca Sales", "Cristiano Melo", "Dulce Farias",
  "Edmundo Rios", "Fernanda Abreu", "Gabriel Torres", "Hilda Moreira", "Ivo Sarmento",
  "Josiane Lacerda", "Kaique Brito", "Luana Pimentel", "Mateus Ferraz", "Nádia Gouveia",
  "Otávio Lessa", "Paula Bittar", "Quitéria Melo", "Ramon Vidal", "Suzana Nobre",
  "Tadeu Moura", "Úrsula Dantas", "Vitor Rangel",
];

const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
  null,
];

// Distribuição de classificação nos 96: 3 UMQL+, 5 UMQL, 10 HMQL, 8 SMQL, 12 MQL+,
// 14 MQL, 4 Ninja, 40 sem classificação.
const TIERS: { tag: string | null; rank: number; qtd: number }[] = [
  { tag: "UMQL+", rank: 6, qtd: 3 },
  { tag: "UMQL", rank: 5, qtd: 5 },
  { tag: "HMQL", rank: 4, qtd: 10 },
  { tag: "SMQL", rank: 3, qtd: 8 },
  { tag: "MQL+", rank: 2, qtd: 12 },
  { tag: "MQL", rank: 1, qtd: 14 },
  { tag: "Ninja", rank: 0, qtd: 4 },
  { tag: null, rank: 0, qtd: 40 },
];
const ETAPAS = ["Sem atendimento", "Prospecção", "Qualificação", "Contato feito"];
const DEGRAUS: [number, number][] = [[90, 135], [70, 105], [50, 75], [30, 45], [10, 15]];

export type LeadInscritoMock = {
  clint_contact_id: string;
  clint_deal_id: string | null;
  url_clint: string | null;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string | null;
  tier_rank: number;
  possivel_ninja: boolean;
  evento_tag: string;
  etapa: string | null;
  dono: { id: string; nome: string; email: string } | null;
  assistiu_ao_vivo: boolean;
  aplicou: boolean;
  aplicou_ao_vivo: boolean;
  aplicou_replay: boolean;
  levantou_mao: boolean;
  ja_agendou: boolean;
  acessou_replay: boolean;
  assistiu_replay: boolean;
  convidado_resgate: boolean;
  percentual_assistido: number | null;
  minutos_assistidos: number | null;
  tags: string[];
  created_at: string;
};

export type InscritosMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: {
    inscritos: number;
    presentes: number;
    aplicaram: number;
    levantaram_mao: number;
    agendaram: number;
    sem_atendimento: number;
  };
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  leads: LeadInscritoMock[];
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

function lead(i: number, tier: (typeof TIERS)[number], evento: string): LeadInscritoMock {
  const nome = NOMES[(i + (chaveTag(evento) % 11) * 3) % NOMES.length];
  const qualificado = tier.rank >= 2;
  const presente = i % 20 < 7; // ~35%
  const aplicou = presente && i % 5 < 2; // ~40% dos presentes
  const levantou = qualificado && (aplicou || i % 7 === 3);
  const agendou = levantou && i % 3 === 0;
  const replay = !presente && i % 4 === 1;
  // Pela gravação: quem viu o replay e preencheu a aplicação lá (1 em 3).
  const aplicouReplay = replay && i % 3 === 0;
  const etapa = i % 4 === 0 ? "Sem atendimento" : ETAPAS[1 + (i % 3)];
  const comNegocio = i % 6 !== 5;
  const [pctv, min] = presente ? DEGRAUS[i % DEGRAUS.length] : [null, null];
  const seq = String(i + 1).padStart(4, "0");
  const dono = comNegocio ? DONOS[i % 4] : null;
  return {
    clint_contact_id: `clint-in-${seq}`,
    clint_deal_id: comNegocio ? `deal-in-${seq}` : null,
    url_clint: comNegocio ? `https://app.clint.digital/deal/deal-in-${seq}` : null,
    lead_id: agendou ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    nome,
    telefone: i % 10 === 9 ? null : `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(50000000 + i * 4813).slice(0, 8)}`,
    email: i % 12 === 11 ? null : `${slug(nome)}@exemplo.com`,
    tier: tier.tag,
    tier_rank: tier.rank,
    possivel_ninja: tier.tag === "Ninja" || i % 17 === 9,
    evento_tag: evento,
    etapa: comNegocio ? etapa : null,
    dono,
    assistiu_ao_vivo: presente,
    aplicou: aplicou || aplicouReplay,
    aplicou_ao_vivo: aplicou,
    aplicou_replay: aplicouReplay,
    levantou_mao: levantou,
    ja_agendou: agendou,
    acessou_replay: replay,
    assistiu_replay: replay && i % 2 === 0,
    convidado_resgate: !presente && i % 9 === 4,
    percentual_assistido: pctv,
    minutos_assistidos: min,
    tags: [
      evento,
      ...(presente ? ["Participou", `Assistiu ${pctv}%`] : []),
      ...(aplicou || aplicouReplay ? [`Pós WG-${evento.replace("WG - ", "")}`] : []),
      ...(aplicouReplay ? ["Preencheu Aplicação - Replay"] : []),
      ...(levantou ? ["Levantou a Mão"] : []),
      ...(tier.tag && tier.tag !== "Ninja" ? [tier.tag] : []),
      ...(tier.tag === "Ninja" ? ["Possível Ninja"] : []),
    ],
    created_at: `${isoDaTag(evento)}T12:00:00.000Z`,
  };
}

export function mockInscritos(de: string, ate: string, simular?: string | null): InscritosMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  const zerado = { inscritos: 0, presentes: 0, aplicaram: 0, levantaram_mao: 0, agendaram: 0, sem_atendimento: 0 };
  if (n === 0 || simular === "vazio" || simular === "sem_contatos") {
    return { ...base, totais: zerado, por_dono: [], leads: [] };
  }

  const leads: LeadInscritoMock[] = [];
  eventos.forEach((evento, e) => {
    let i = e * 96;
    for (const tier of TIERS) for (let k = 0; k < tier.qtd; k++, i++) leads.push(lead(i, tier, evento));
  });
  leads.sort(
    (a, b) =>
      b.tier_rank - a.tier_rank ||
      Number(b.assistiu_ao_vivo) - Number(a.assistiu_ao_vivo) ||
      chaveTag(b.evento_tag) - chaveTag(a.evento_tag) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  const porDono = new Map<string, InscritosMock["por_dono"][number]>();
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
      inscritos: leads.length,
      presentes: leads.filter((l) => l.assistiu_ao_vivo).length,
      aplicaram: leads.filter((l) => l.aplicou).length,
      levantaram_mao: leads.filter((l) => l.levantou_mao).length,
      agendaram: leads.filter((l) => l.ja_agendou).length,
      sem_atendimento: leads.filter((l) => l.etapa === "Sem atendimento").length,
    },
    por_dono,
    leads,
  };
}
