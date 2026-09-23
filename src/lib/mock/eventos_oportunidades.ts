import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock da aba "Levantou a Mão" (LEADS_MODE=mock) no contrato V4 de
// GET /api/eventos/oportunidades. Determinístico. Três cenários principais:
//   - padrão: 1 evento (modo ciclo), 40 pendentes, ao vivo + replay + resgate;
//   - sem replay (`simular=sem_replay`): linha e funil do replay zerados;
//   - dois eventos (modo intervalo): UMA LINHA POR (contato, evento) — alguns
//     contatos aparecem em duas linhas, diferenciadas pela coluna Evento.
// Extras para validar estados: `simular=vazio|sem_contatos|desqualificados|
// sem_resgate|base_inflada`.
//
// Só para dev/demo: o route handler ignora este arquivo em LEADS_MODE=api.
// ---------------------------------------------------------------------------

type Tier = { tag: string | null; rank: number };

// A trilha QC não entra na lista (o backend a exclui e só informa `totais.qc`).
// Ninja é outra trilha (tag "Possível Ninja"): vem com tier "Ninja" e rank 0,
// nunca como degrau abaixo de MQL. Quem tem Ninja E uma tag MQL fica com a MQL
// no tier e `possivel_ninja: true`.
const TIERS: Tier[] = [
  { tag: "UMQL+", rank: 6 },
  { tag: "UMQL", rank: 5 },
  { tag: "HMQL", rank: 4 },
  { tag: "SMQL", rank: 3 },
  { tag: "MQL+", rank: 2 },
  { tag: "MQL", rank: 1 },
  { tag: "Ninja", rank: 0 },
  { tag: null, rank: 0 },
];

// Distribuição dos 40 pendentes: 3 UMQL+, 5 UMQL, 8 HMQL, 6 SMQL, 5 MQL+, 6 MQL,
// 4 Ninja, 3 sem classificação. Alto valor (UMQL+/UMQL/HMQL) segue 16.
const DISTRIBUICAO = [3, 5, 8, 6, 5, 6, 4, 3];

const NOMES = [
  "Ana Paula Ribeiro", "Bruno Carvalho", "Camila Ferreira", "Daniel Moreira", "Eduarda Santos",
  "Fábio Nogueira", "Gabriela Lima", "Henrique Alves", "Isabela Martins", "João Pedro Souza",
  "Karina Oliveira", "Leonardo Castro", "Mariana Costa", "Nicolas Barbosa", "Olívia Mendes",
  "Paulo Henrique Dias", "Quésia Rocha", "Rafael Teixeira", "Sabrina Azevedo", "Thiago Monteiro",
  "Úrsula Freitas", "Vinícius Pereira", "Wesley Cardoso", "Ximena Duarte", "Yasmin Lopes",
  "Zeca Andrade", "Amanda Cunha", "Bernardo Pinto", "Cláudia Ramos", "Diego Farias",
  "Elaine Braga", "Felipe Araújo", "Giovanna Melo", "Hugo Batista", "Ingrid Vasconcelos",
  "Júlio César Neves", "Larissa Fonseca", "Marcos Vinícius Reis", "Natália Guimarães", "Otávio Siqueira",
];

const DDDS = ["11", "21", "31", "41", "51", "61", "71", "81", "85", "48"];

const EXTRAS = [
  ["Webinar"],
  ["Webinar", "Origem: Instagram"],
  ["Webinar", "Origem: YouTube", "Formulário completo"],
  ["Webinar", "Origem: Instagram", "Formulário completo", "Já é aluno QC", "Indicação"],
  ["Origem: Tráfego pago"],
  ["Webinar", "Reengajado", "Origem: E-mail", "Lista VIP", "Convidado", "Sem WhatsApp"],
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

// "WG - 08.09.26" → chave ordenável 20260908 (mesma regra do backend).
function chaveTag(tag: string | null): number {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag ?? "");
  if (!m) return -1;
  return (2000 + Number(m[3])) * 10000 + Number(m[2]) * 100 + Number(m[1]);
}

// "WG - 08.09.26" → "2026-09-08" (created_at ancora no dia do evento).
function isoDaTag(tag: string): string {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : "2026-01-01";
}

export type LeadPendenteMock = {
  clint_contact_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string | null;
  tier_rank: number;
  evento_tag: string;
  tags: string[];
  created_at: string | null;
  lead_id: string | null;
  clint_deal_id: string | null;
  url_clint: string | null;
  etapa: string | null;
  dono: { id: string; nome: string; email: string | null } | null;
  origem: "ao_vivo" | "replay";
  assistiu_ao_vivo: boolean;
  acessou_replay: boolean;
  assistiu_replay: boolean;
  convidado_resgate: boolean;
  possivel_ninja: boolean;
};

// Donos (SDRs) do mock. null = negócio sem dono.
const DONOS: (LeadPendenteMock["dono"] | null)[] = [
  { id: "u-benhur", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "u-glaucio", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
  { id: "u-delrue", nome: "Guilherme Delrue", email: null },
  null,
];
const ETAPAS_CLINT = ["Prospecção", "Qualificação", "Contato feito", "Sem resposta"];

type LinhaMatrizMock = {
  acessaram: number | null;
  assistiram: number;
  aplicaram: number;
  agendaram: number;
  taxa_agendamento: number | null;
  pendentes: number;
  alto_valor_pendente: number;
};
type DegrauMock = { nome: string; valor: number };

export type OportunidadesMock = {
  de: string;
  ate: string;
  eventos: string[];
  totais: { inscritos: number; desqualificados: number; qc: number; pendentes: number };
  matriz: { ao_vivo: LinhaMatrizMock; replay: LinhaMatrizMock; total: LinhaMatrizMock };
  resumo: {
    inscritos: number;
    presentes_ao_vivo: number;
    aplicaram: number;
    qualificados_aplicaram: number;
    qualificados_sem_aplicar: number;
    fora_dos_qualificados: { qc: number; desqualificados: number };
  };
  funis: { ao_vivo: { degraus: DegrauMock[] }; replay: { degraus: DegrauMock[] } };
  resgate: {
    convidados: number;
    assistiram: number;
    aplicaram: number;
    agendaram: number;
    pendentes: number;
  } | null;
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  avisos: string[];
  leads: LeadPendenteMock[];
  gerado_em: string;
  cache: "hit" | "miss";
};

const taxa = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 10000 : null);

function linhaMatriz(
  acessaram: number | null,
  assistiram: number,
  pendentes: LeadPendenteMock[],
  agendaram: number,
): LinhaMatrizMock {
  const aplicaram = pendentes.length + agendaram;
  return {
    acessaram,
    assistiram,
    aplicaram,
    agendaram,
    taxa_agendamento: taxa(agendaram, aplicaram),
    pendentes: pendentes.length,
    alto_valor_pendente: pendentes.filter((l) => l.tier_rank >= 4).length,
  };
}

// Uma linha do mock para o contato `i` no evento `evento`.
function linhaDoContato(i: number, tier: Tier, evento: string, semReplay: boolean, semResgate: boolean): LeadPendenteMock {
  const nome = NOMES[i];
  const ddd = DDDS[i % DDDS.length];
  const numero = String(910000000 + ((i * 7919) % 89999999)).padStart(9, "0");
  const extras = EXTRAS[i % EXTRAS.length];
  // ~70% levantou a mão ao vivo; ~30% aplicou só pelo replay.
  const origem: "ao_vivo" | "replay" = !semReplay && i % 10 >= 7 ? "replay" : "ao_vivo";
  const assistiuReplay = !semReplay && (origem === "replay" || i % 7 === 0);
  const criado = new Date(`${isoDaTag(evento)}T${String(9 + (i % 10)).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}:00-03:00`);
  criado.setUTCDate(criado.getUTCDate() + (i % 5));
  const comNegocio = i % 4 !== 3;
  // Marcação "Possível Ninja": todo tier Ninja, mais 1 em 6 dos leads da escala MQL
  // (que ficam com a MQL no tier, por precedência, e ganham o selo).
  const possivelNinja = tier.tag === "Ninja" || (tier.tag !== null && i % 6 === 4);
  return {
    clint_contact_id: `clint-${String(i + 1).padStart(4, "0")}`,
    nome,
    telefone: i % 13 === 12 ? null : `+55${ddd}${numero}`,
    email: i % 11 === 10 ? null : `${slug(nome)}@exemplo.com.br`,
    tier: tier.tag,
    tier_rank: tier.rank,
    evento_tag: evento,
    // Na Clint a tag da trilha é "Possível Ninja"; o tier normalizado é só "Ninja".
    tags: [
      evento,
      "Levantou a Mão",
      ...(tier.tag && tier.tag !== "Ninja" ? [tier.tag] : []),
      ...(possivelNinja ? ["Possível Ninja"] : []),
      ...extras,
    ],
    created_at: criado.toISOString(),
    // 1 em cada 3 tem ficha no Mapa de Calor (ids do mock data_clients.json).
    lead_id: i % 3 === 0 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
    // 3 em 4 têm negócio na Clint (deal + url + etapa + dono).
    clint_deal_id: comNegocio ? `deal-${1000 + i}` : null,
    url_clint: comNegocio ? `https://app.clint.digital/deal/deal-${1000 + i}` : null,
    etapa: comNegocio ? ETAPAS_CLINT[i % ETAPAS_CLINT.length] : null,
    dono: comNegocio ? DONOS[i % 3] : null,
    origem,
    // Levantar a mão prova presença ao vivo; 1 em 10 do replay também esteve ao vivo.
    assistiu_ao_vivo: origem === "ao_vivo" || i % 10 === 9,
    acessou_replay: assistiuReplay || (!semReplay && i % 6 === 0),
    assistiu_replay: assistiuReplay,
    convidado_resgate: !semResgate && i % 4 === 2,
    possivel_ninja: possivelNinja,
  };
}

export function mockOportunidades(
  de: string,
  ate: string,
  simular?: string | null,
): OportunidadesMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = { de, ate, eventos, avisos: [] as string[], gerado_em: new Date().toISOString(), cache: "miss" as const };
  const semReplay = simular === "sem_replay";
  const semResgate = simular === "sem_resgate";
  const inflada = simular === "base_inflada";

  const degraus = (primeiro: string, l: LinhaMatrizMock, topo: number): DegrauMock[] => [
    { nome: primeiro, valor: topo },
    { nome: "assistiram", valor: l.assistiram },
    { nome: "aplicaram", valor: l.aplicaram },
    { nome: "agendaram", valor: l.agendaram },
    { nome: "pendentes", valor: l.pendentes },
  ];
  const montar = (
    leads: LeadPendenteMock[],
    inscritos: number,
    desqualificados: number,
    qc: number,
    agAoVivo: number,
    agReplay: number,
  ): Omit<OportunidadesMock, "de" | "ate" | "eventos" | "avisos" | "gerado_em" | "cache" | "resgate" | "por_dono"> => {
    const pendAoVivo = leads.filter((l) => l.origem === "ao_vivo");
    const pendReplay = leads.filter((l) => l.origem === "replay");
    const ativo = inscritos > 0;
    const aoVivo = linhaMatriz(null, ativo ? (inflada ? 1292 : semReplay ? 110 : 84) * n : 0, pendAoVivo, agAoVivo);
    const replay = linhaMatriz(
      ativo && !semReplay ? 58 * n : 0,
      ativo && !semReplay ? 36 * n : 0,
      pendReplay,
      agReplay,
    );
    // Total = união sem contagem dupla (no mock, 10 por evento viram os dois).
    const sobreposicao = ativo && !semReplay ? 10 * n : 0;
    const total: LinhaMatrizMock = {
      acessaram: replay.acessaram,
      assistiram: aoVivo.assistiram + replay.assistiram - sobreposicao,
      aplicaram: aoVivo.aplicaram + replay.aplicaram,
      agendaram: agAoVivo + agReplay,
      taxa_agendamento: taxa(agAoVivo + agReplay, aoVivo.aplicaram + replay.aplicaram),
      pendentes: leads.length,
      alto_valor_pendente: leads.filter((l) => l.tier_rank >= 4).length,
    };
    return {
      totais: { inscritos, desqualificados, qc, pendentes: leads.length },
      matriz: { ao_vivo: aoVivo, replay, total },
      // Bloco resumo (23/09): base BRUTA (antes de tirar QC e desqualificados),
      // presentes e aplicaram sem filtro; os dois "qualificados" só MQL+ ou acima.
      // qualificados_sem_aplicar = 28 por evento, o mesmo tamanho do mock de
      // /presentes-sem-aplicar (garantia do backend).
      resumo: {
        inscritos: inscritos + desqualificados + qc,
        presentes_ao_vivo: aoVivo.assistiram,
        // Pós WG (aplicou na transmissão, sem filtro) é mais que Levantou a Mão.
        aplicaram: aoVivo.aplicaram + 20 * n,
        qualificados_aplicaram: aoVivo.aplicaram,
        qualificados_sem_aplicar: ativo ? 28 * n : 0,
        fora_dos_qualificados: { qc, desqualificados },
      },
      funis: {
        ao_vivo: { degraus: degraus("inscritos", aoVivo, inscritos) },
        replay: { degraus: degraus("acessaram", replay, replay.acessaram ?? 0) },
      },
      leads,
    };
  };

  if (n === 0 || simular === "sem_contatos" || simular === "desqualificados") {
    return {
      ...base,
      ...montar([], 0, simular === "desqualificados" ? 9 * Math.max(n, 1) : 0, 0, 0, 0),
      resgate: null,
      por_dono: [],
    };
  }
  if (simular === "vazio") {
    // Todos que aplicaram já agendaram: zero pendentes.
    return { ...base, ...montar([], 214 * n, 9 * n, 5 * n, 28 * n, 10 * n), resgate: null, por_dono: [] };
  }

  // Uma linha por (contato, evento). Com 1 evento: os 40 contatos. Com 2+: cada
  // contato cai num evento e 1 em cada 8 aparece TAMBÉM no evento seguinte — o
  // mesmo nome em duas linhas, diferenciado pela coluna Evento.
  const leads: LeadPendenteMock[] = [];
  let i = 0;
  DISTRIBUICAO.forEach((qtd, t) => {
    for (let k = 0; k < qtd; k++, i++) {
      const tier = TIERS[t];
      leads.push(linhaDoContato(i, tier, eventos[i % n], semReplay, semResgate));
      if (n > 1 && i % 8 === 0) {
        leads.push(linhaDoContato(i, tier, eventos[(i + 1) % n], semReplay, semResgate));
      }
    }
  });

  // Mesma ordenação do backend: tier_rank desc → evento_tag desc → nome asc.
  leads.sort((a, b) => {
    if (a.tier_rank !== b.tier_rank) return b.tier_rank - a.tier_rank;
    const da = chaveTag(a.evento_tag);
    const db = chaveTag(b.evento_tag);
    if (da !== db) return db - da;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });

  // por_dono: pendentes desc, "Sem dono" por último (mesma regra do backend).
  const porDono = new Map<string, OportunidadesMock["por_dono"][number]>();
  for (const l of leads) {
    const chave = l.dono?.id ?? "sem";
    const atual = porDono.get(chave) ?? {
      dono_id: l.dono?.id ?? null,
      dono_nome: l.dono?.nome ?? "Sem dono",
      pendentes: 0,
      alto_valor: 0,
    };
    atual.pendentes += 1;
    if (l.tier_rank >= 4) atual.alto_valor += 1;
    porDono.set(chave, atual);
  }
  const por_dono = [...porDono.values()].sort((a, b) => {
    if (a.dono_id === null) return 1;
    if (b.dono_id === null) return -1;
    return b.pendentes - a.pendentes || a.dono_nome.localeCompare(b.dono_nome, "pt-BR");
  });

  const convidadosPend = leads.filter((l) => l.convidado_resgate).length;
  const resgate = semResgate
    ? null
    : {
        convidados: 2600 * n,
        assistiram: 180 * n,
        aplicaram: convidadosPend + 5 * n,
        agendaram: 5 * n,
        pendentes: convidadosPend,
      };

  return {
    ...base,
    // base_inflada reproduz o bug de base da V3: "assistiram" acima dos inscritos.
    avisos: inflada ? ["assistiram_acima_da_base", "taxa_acima_de_100"] : [],
    // 5 contatos por evento saem por serem da trilha QC (só conferência).
    ...montar(leads, 214 * n, 9 * n, 5 * n, (semReplay ? 21 : 15) * n, semReplay ? 0 : 6 * n),
    resgate,
    por_dono,
  };
}
