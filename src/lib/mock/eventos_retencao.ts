import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/retencao (LEADS_MODE=mock). Determinístico.
// Padrão: por evento, 467 inscritos e uma curva saudável (312 chegaram a 3%,
// 38 a 90%), 40 leads medidos listados por evento. Com 2+ eventos no intervalo
// entra o aviso `atribuicao_ambigua` (tags de percentual não têm data).
// `simular=sem_medicao` reproduz o dado real de 22/09 (467 inscritos, 1 medido
// no degrau de 10%, aviso `sem_medicao_alta`); `simular=vazio` → 0 inscritos.
// Erros (`clint_auth` etc.) ficam no proxy.
// ---------------------------------------------------------------------------

const DEGRAUS: { percentual: number; minutos: number; alcancaram: number }[] = [
  { percentual: 3, minutos: 5, alcancaram: 312 },
  { percentual: 10, minutos: 15, alcancaram: 268 },
  { percentual: 20, minutos: 30, alcancaram: 221 },
  { percentual: 30, minutos: 45, alcancaram: 184 },
  { percentual: 50, minutos: 75, alcancaram: 129 },
  { percentual: 70, minutos: 105, alcancaram: 81 },
  { percentual: 90, minutos: 135, alcancaram: 38 },
];

const NOMES = [
  "Jonas Vieira", "Aline Sabino", "Breno Cardim", "Cecília Antunes", "Davi Lourenço",
  "Estela Macedo", "Fernando Baptista", "Gisele Ramalho", "Hélio Custódio", "Íris Falcão",
  "Jaime Bezerra", "Kátia Sotero", "Lucas Menezes", "Marta Villela", "Nilton Aragão",
  "Ofélia Brandão", "Pedro Galvão", "Quênia Rocha", "Rodrigo Tenório", "Sílvia Paixão",
  "Tomás Linhares", "Umberto Sá", "Vera Nascimento", "Wilson Carmo", "Xavier Lemos",
  "Yara Beltrão", "Zilda Moura", "Arthur Peçanha", "Bárbara Cintra", "Caetano Ribas",
  "Denise Fraga", "Everton Sales", "Fabiana Leite", "Gustavo Arruda", "Helena Vidal",
  "Igor Toledo", "Joana Feitosa", "Kauê Matos", "Lorena Pires", "Maurício Godoy",
];

const TIERS: { tag: string | null; rank: number }[] = [
  { tag: "UMQL+", rank: 6 },
  { tag: "UMQL", rank: 5 },
  { tag: "HMQL", rank: 4 },
  { tag: "SMQL", rank: 3 },
  { tag: "MQL+", rank: 2 },
  { tag: "MQL", rank: 1 },
  { tag: null, rank: 0 },
];

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

export type LeadRetencaoMock = {
  clint_contact_id: string;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string | null;
  tier_rank: number;
  possivel_ninja: boolean;
  evento_tag: string;
  percentual_maximo: number;
  minutos: number;
  tags: string[];
  created_at: string;
};

export type RetencaoMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: { inscritos: number; assistiram: number; sem_medicao: number };
  curva: { percentual: number; minutos: number; tag: string; alcancaram: number; com_a_tag: number }[];
  avisos: string[];
  leads: LeadRetencaoMock[];
  gerado_em: string;
  cache: "hit" | "miss";
};

function lead(i: number, evento: string, degrau: (typeof DEGRAUS)[number]): LeadRetencaoMock {
  // Nomes deslocados pela data do evento: ciclos diferentes mostram contatos
  // diferentes (senão a troca de ciclo pareceria não fazer nada no mock).
  const nome = NOMES[(i + (chaveTag(evento) % 11) * 3) % NOMES.length];
  const tier = TIERS[(i * 5) % TIERS.length];
  return {
    clint_contact_id: `clint-ret-${String(i + 1).padStart(4, "0")}`,
    // 1 em 6 tem ficha no Mapa (ids do mock de leads).
    lead_id: i % 6 === 2 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    nome,
    telefone: i % 9 === 8 ? null : `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(70000000 + i * 6151).slice(0, 8)}`,
    email: i % 13 === 12 ? null : `${slug(nome)}@exemplo.com`,
    tier: tier.tag,
    tier_rank: tier.rank,
    possivel_ninja: i % 11 === 7,
    evento_tag: evento,
    percentual_maximo: degrau.percentual,
    minutos: degrau.minutos,
    tags: [evento, `Assistiu ${degrau.percentual}%`, ...(tier.tag ? [tier.tag] : [])],
    created_at: `${isoDaTag(evento)}T12:00:00.000Z`,
  };
}

export function mockRetencao(de: string, ate: string, simular?: string | null): RetencaoMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  const curvaZerada = DEGRAUS.map((d) => ({ ...d, tag: `Assistiu ${d.percentual}%`, alcancaram: 0, com_a_tag: 0 }));

  if (n === 0 || simular === "vazio") {
    return { ...base, totais: { inscritos: 0, assistiram: 0, sem_medicao: 0 }, curva: curvaZerada, avisos: [], leads: [] };
  }
  if (simular === "sem_medicao") {
    // O dado real de 22/09: 467 inscritos, um único medido (10%).
    const curva = curvaZerada.map((d) => ({
      ...d,
      alcancaram: d.percentual <= 10 ? 1 : 0,
      com_a_tag: d.percentual === 10 ? 1 : 0,
    }));
    return {
      ...base,
      totais: { inscritos: 467, assistiram: 1, sem_medicao: 466 },
      curva,
      avisos: ["sem_medicao_alta"],
      leads: [lead(0, eventos[0], DEGRAUS[1])],
    };
  }

  const curva = DEGRAUS.map((d, i) => ({
    ...d,
    tag: `Assistiu ${d.percentual}%`,
    alcancaram: d.alcancaram * n,
    // Quem PAROU neste degrau (conferência): diferença para o próximo.
    com_a_tag: (d.alcancaram - (DEGRAUS[i + 1]?.alcancaram ?? 0)) * n,
  }));

  // 40 medidos por evento, distribuídos pelos degraus na proporção da curva.
  const leads: LeadRetencaoMock[] = [];
  eventos.forEach((evento, e) => {
    for (let k = 0; k < 40; k++) {
      const degrau = DEGRAUS[[6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0][k]];
      leads.push(lead(e * 40 + k, evento, degrau));
    }
  });
  // Ordem do backend: percentual desc → evento desc → nome asc.
  leads.sort(
    (a, b) =>
      b.percentual_maximo - a.percentual_maximo ||
      chaveTag(b.evento_tag) - chaveTag(a.evento_tag) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  return {
    ...base,
    totais: { inscritos: 467 * n, assistiram: 312 * n, sem_medicao: (467 - 312) * n },
    curva,
    avisos: n > 1 ? ["atribuicao_ambigua"] : [],
    leads,
  };
}
