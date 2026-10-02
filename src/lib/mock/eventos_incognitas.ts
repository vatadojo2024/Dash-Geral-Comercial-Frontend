import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/incognitas (LEADS_MODE=mock). Determinístico e
// calibrado no ciclo real de 29/09 (por evento do intervalo): 312 inscritos =
// 130 classificados + 30 QC + 152 incógnitas; das incógnitas, 9 responderam a
// pesquisa, 21 estiveram ao vivo (os 3 primeiros sem pesquisa com 90%), 106 em
// Prospecção, 33 em Sem atendimento, 6 em Em qualificação e 7 sem negócio.
// Ordem = a do backend (pesquisa desc → ao vivo desc → % assistido desc → nome).
// `simular=vazio|sem_contatos` exercita os estados (os de erro ficam no proxy).
// ---------------------------------------------------------------------------

const PRIMEIROS = [
  "Adriana", "Bruno", "Camila", "Daniel", "Eduarda", "Felipe", "Gabriela", "Hugo", "Ingrid", "Júlio",
  "Kátia", "Leonardo", "Marina", "Nícolas", "Olga", "Pedro", "Raquel", "Samuel", "Tânia", "Vinícius",
];
const SOBRENOMES = ["Aguiar", "Brandão", "Cavalcanti", "Dias", "Fontes", "Guimarães", "Lima", "Macedo"];

const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
];

// Por evento: 152 incógnitas distribuídas pelas etapas (soma 152).
const ETAPAS: { etapa: string | null; qtd: number }[] = [
  { etapa: "Prospecção", qtd: 106 },
  { etapa: "Sem atendimento", qtd: 33 },
  { etapa: "Em qualificação", qtd: 6 },
  { etapa: null, qtd: 7 },
];
const POR_EVENTO = { inscritos: 312, classificados: 130, qc: 30, incognitas: 152, responderam: 9, aoVivo: 21 };
const PERCENTUAIS = [90, 90, 90, 70, 70, 50, 50, 30, 30, 20, 20, 10];

export type LeadIncognitoMock = {
  clint_contact_id: string;
  clint_deal_id: string | null;
  url_clint: string | null;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: null;
  evento_tag: string;
  etapa: string | null;
  dono: { id: string; nome: string; email: string } | null;
  respondeu_pesquisa: boolean;
  assistiu_ao_vivo: boolean;
  aplicou: boolean;
  viu_replay: boolean;
  convidado_resgate: boolean;
  ja_agendou: boolean;
  percentual_assistido: number | null;
  minutos_assistidos: number | null;
  tags: string[];
  created_at: string;
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

function leadsDoEvento(evento: string, e: number): LeadIncognitoMock[] {
  const leads: LeadIncognitoMock[] = [];
  let i = 0;
  for (const { etapa, qtd } of ETAPAS) {
    for (let k = 0; k < qtd; k++, i++) {
      const n = e * 200 + i;
      const nome = `${PRIMEIROS[n % PRIMEIROS.length]} ${SOBRENOMES[Math.floor(n / PRIMEIROS.length) % SOBRENOMES.length]}`;
      // Os que responderam a pesquisa ficam espalhados pelas etapas (de 17 em 17).
      const respondeu = i % 17 === 3 && leads.filter((l) => l.respondeu_pesquisa).length < POR_EVENTO.responderam;
      // Ao vivo: de 7 em 7, até 21 por evento; % assistido decrescente.
      const ordemAoVivo = i % 7 === 1 ? Math.floor(i / 7) : -1;
      const aoVivo = ordemAoVivo >= 0 && ordemAoVivo < POR_EVENTO.aoVivo;
      const percentual = aoVivo ? (PERCENTUAIS[ordemAoVivo] ?? null) : null;
      const comNegocio = etapa !== null;
      const seq = `${e}-${String(i + 1).padStart(4, "0")}`;
      leads.push({
        clint_contact_id: `clint-in-${seq}`,
        clint_deal_id: comNegocio ? `deal-in-${seq}` : null,
        url_clint: comNegocio ? `https://app.clint.digital/deal/deal-in-${seq}` : null,
        lead_id: i % 11 === 5 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
        nome,
        telefone: i % 13 === 12 ? null : `+55${["11", "21", "31", "41", "48"][i % 5]}9${String(50000000 + n * 2713).slice(0, 8)}`,
        email: i % 15 === 14 ? null : `${slug(nome)}@exemplo.com`,
        tier: null,
        evento_tag: evento,
        etapa,
        dono: comNegocio ? DONOS[i % 3] : null,
        respondeu_pesquisa: respondeu,
        assistiu_ao_vivo: aoVivo,
        aplicou: aoVivo && i % 3 === 0,
        viu_replay: !aoVivo && i % 9 === 4,
        convidado_resgate: i % 10 === 6,
        ja_agendou: i % 40 === 21,
        percentual_assistido: percentual,
        minutos_assistidos: percentual == null ? null : Math.round((percentual / 100) * 120),
        tags: [
          evento,
          ...(respondeu ? ["Respondeu pesquisa"] : []),
          ...(percentual != null ? [`Assistiu ${percentual}%`] : aoVivo ? ["Participou"] : []),
        ],
        created_at: `${isoDaTag(evento)}T12:00:00.000Z`,
      });
    }
  }
  return leads;
}

export function mockIncognitas(de: string, ate: string, simular?: string | null) {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, gerado_em: new Date().toISOString(), cache: "miss" as const };
  const zerado = {
    inscritos: 0, classificados: 0, qc: 0, incognitas: 0, responderam_pesquisa: 0, nao_responderam: 0,
    presentes_ao_vivo: 0, aplicaram: 0, sem_atendimento: 0, ja_agendaram: 0, desqualificados: 0, perdidos: 0,
  };
  if (n === 0 || simular === "sem_contatos") {
    return { ...base, totais: zerado, por_etapa: [], por_dono: [], leads: [] };
  }
  if (simular === "vazio") {
    // Todo inscrito tem classificação.
    return {
      ...base,
      totais: { ...zerado, inscritos: 312 * n, classificados: 282 * n, qc: 30 * n, desqualificados: 14 * n, perdidos: 6 * n },
      por_etapa: [],
      por_dono: [],
      leads: [],
    };
  }

  const leads = eventos.flatMap((evento, e) => leadsDoEvento(evento, e));
  leads.sort(
    (a, b) =>
      Number(b.respondeu_pesquisa) - Number(a.respondeu_pesquisa) ||
      Number(b.assistiu_ao_vivo) - Number(a.assistiu_ao_vivo) ||
      (b.percentual_assistido ?? -1) - (a.percentual_assistido ?? -1) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  const etapas = new Map<string | null, number>();
  for (const l of leads) etapas.set(l.etapa, (etapas.get(l.etapa) ?? 0) + 1);
  const por_etapa = [...etapas.entries()]
    .map(([etapa, total]) => ({ etapa, total }))
    .sort((a, b) => (a.etapa === null ? 1 : b.etapa === null ? -1 : b.total - a.total));

  const donos = new Map<string, { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }>();
  for (const l of leads) {
    const chave = l.dono?.id ?? "sem";
    const atual = donos.get(chave) ?? { dono_id: l.dono?.id ?? null, dono_nome: l.dono?.nome ?? "Sem dono", pendentes: 0, alto_valor: 0 };
    atual.pendentes += 1;
    donos.set(chave, atual);
  }
  const por_dono = [...donos.values()].sort((a, b) =>
    a.dono_id === null ? 1 : b.dono_id === null ? -1 : b.pendentes - a.pendentes,
  );

  const conta = (f: (l: LeadIncognitoMock) => boolean) => leads.filter(f).length;
  return {
    ...base,
    totais: {
      inscritos: POR_EVENTO.inscritos * n,
      classificados: POR_EVENTO.classificados * n,
      qc: POR_EVENTO.qc * n,
      incognitas: leads.length,
      responderam_pesquisa: conta((l) => l.respondeu_pesquisa),
      nao_responderam: conta((l) => !l.respondeu_pesquisa),
      presentes_ao_vivo: conta((l) => l.assistiu_ao_vivo),
      aplicaram: conta((l) => l.aplicou),
      sem_atendimento: conta((l) => l.etapa === "Sem atendimento"),
      ja_agendaram: conta((l) => l.ja_agendou),
      desqualificados: 14 * n,
      perdidos: 6 * n,
    },
    por_etapa,
    por_dono,
    leads,
  };
}
