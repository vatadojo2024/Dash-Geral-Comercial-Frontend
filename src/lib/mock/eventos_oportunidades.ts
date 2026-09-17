import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock da aba "Levantou a Mão" (LEADS_MODE=mock). Espelha o contrato REAL de
// GET /api/eventos/oportunidades: 40 pendentes cobrindo os 7 tiers, distribuídos
// entre os eventos (terças) do intervalo pedido — 1 ciclo = 1 evento; um
// intervalo de várias semanas exercita a coluna "Evento". Determinístico.
//
// Só para dev/demo: o route handler ignora este arquivo em LEADS_MODE=api.
// ---------------------------------------------------------------------------

type Tier = { tag: string | null; rank: number };

const TIERS: Tier[] = [
  { tag: "UMQL+", rank: 6 },
  { tag: "UMQL", rank: 5 },
  { tag: "HMQL", rank: 4 },
  { tag: "SMQL", rank: 3 },
  { tag: "MQL+", rank: 2 },
  { tag: "MQL", rank: 1 },
  { tag: null, rank: 0 },
];

// Distribuição dos 40 pendentes: 3 UMQL+, 5 UMQL, 8 HMQL, 7 SMQL, 6 MQL+, 7 MQL, 4 sem.
const DISTRIBUICAO = [3, 5, 8, 7, 6, 7, 4];

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
  evento_tag: string | null;
  tags: string[];
  created_at: string | null;
  lead_id: string | null;
  clint_deal_id: string | null;
  url_clint: string | null;
  etapa: string | null;
  dono: { id: string; nome: string; email: string | null } | null;
  origem: "ao_vivo" | "replay" | null;
  convidado_resgate: boolean;
  acessou_replay: boolean;
  assistiu_replay: boolean;
  aplicacao_por_fallback: boolean;
};

type LinhaMatrizMock = {
  acessaram: number | null;
  assistiram: number | null;
  aplicaram: number;
  agendaram: number;
  taxa_agendamento: number | null;
  pendentes: number;
  alto_valor_pendente: number;
};

// Donos (SDRs) do mock. null = negócio sem dono.
const DONOS: (LeadPendenteMock["dono"] | null)[] = [
  { id: "u-benhur", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "u-glaucio", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
  { id: "u-delrue", nome: "Guilherme Delrue", email: null },
  null,
];
const ETAPAS_CLINT = ["Prospecção", "Qualificação", "Contato feito", "Sem resposta"];

export type OportunidadesMock = {
  de: string;
  ate: string;
  eventos: string[];
  atribuicao_parcial: boolean;
  sinais_indisponiveis: string[];
  avisos: string[];
  matriz: { ao_vivo: LinhaMatrizMock; replay: LinhaMatrizMock; total: LinhaMatrizMock };
  resgate: {
    convidados: number;
    assistiram: number;
    aplicaram: number;
    agendaram: number;
    pendentes: number;
    taxa_retorno: number | null;
    taxa_aplicacao: number | null;
    taxa_agendamento: number | null;
  } | null;
  totais: {
    inscritos: number;
    sem_origem: number;
    no_evento: number;
    desqualificados: number;
    assistiram: number;
    levantaram_mao: number;
    agendaram: number;
    pendentes: number;
  };
  por_dono: { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }[];
  leads: LeadPendenteMock[];
  gerado_em: string;
  cache: "hit" | "miss";
};

const LINHA_VAZIA: LinhaMatrizMock = {
  acessaram: 0,
  assistiram: 0,
  aplicaram: 0,
  agendaram: 0,
  taxa_agendamento: null,
  pendentes: 0,
  alto_valor_pendente: 0,
};
const taxa = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 10000 : null);

// `simular` (só mock): "vazio" = todos agendaram; "sem_contatos" = tag sem
// contatos na Clint; "sem_replay" = ciclo sem dados de replay; "sem_resgate" =
// resgate null; "sem_participou" = sinal de presença ao vivo indisponível
// (assistiram null); "base_inflada" = o bug da V3 (assistiram > inscritos, taxa
// acima de 100% e avisos). Serve para validar os estados da tela sem o backend.
export function mockOportunidades(
  de: string,
  ate: string,
  simular?: string | null,
): OportunidadesMock {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const base = {
    de,
    ate,
    eventos,
    atribuicao_parcial: eventos.length > 1,
    sinais_indisponiveis: [] as string[],
    avisos: [] as string[],
    gerado_em: new Date().toISOString(),
    cache: "miss" as const,
  };
  const matrizVazia = {
    ao_vivo: { ...LINHA_VAZIA, acessaram: null },
    replay: LINHA_VAZIA,
    total: LINHA_VAZIA,
  };

  if (eventos.length === 0 || simular === "sem_contatos" || simular === "desqualificados") {
    return {
      ...base,
      matriz: matrizVazia,
      resgate: null,
      totais: {
        inscritos: 0,
        sem_origem: 0,
        no_evento: 0,
        desqualificados: simular === "desqualificados" ? 9 * eventos.length : 0,
        assistiram: 0,
        levantaram_mao: 0,
        agendaram: 0,
        pendentes: 0,
      },
      por_dono: [],
      leads: [],
    };
  }
  if (simular === "vazio") {
    return {
      ...base,
      matriz: {
        ao_vivo: { acessaram: null, assistiram: 90 * eventos.length, aplicaram: 28 * eventos.length, agendaram: 28 * eventos.length, taxa_agendamento: 1, pendentes: 0, alto_valor_pendente: 0 },
        replay: { acessaram: 60 * eventos.length, assistiram: 30 * eventos.length, aplicaram: 10 * eventos.length, agendaram: 10 * eventos.length, taxa_agendamento: 1, pendentes: 0, alto_valor_pendente: 0 },
        total: { acessaram: 60 * eventos.length, assistiram: 120 * eventos.length, aplicaram: 38 * eventos.length, agendaram: 38 * eventos.length, taxa_agendamento: 1, pendentes: 0, alto_valor_pendente: 0 },
      },
      resgate: null,
      totais: {
        inscritos: 214 * eventos.length,
        sem_origem: 0,
        no_evento: 214 * eventos.length,
        desqualificados: 9 * eventos.length,
        assistiram: 120 * eventos.length,
        levantaram_mao: 38 * eventos.length,
        agendaram: 38 * eventos.length,
        pendentes: 0,
      },
      por_dono: [],
      leads: [],
    };
  }

  const leads: LeadPendenteMock[] = [];
  let i = 0;
  DISTRIBUICAO.forEach((qtd, t) => {
    const tier = TIERS[t];
    for (let k = 0; k < qtd; k++, i++) {
      const nome = NOMES[i];
      const evento = eventos[i % eventos.length];
      const semTelefone = i % 13 === 12;
      const semEmail = i % 11 === 10;
      const ddd = DDDS[i % DDDS.length];
      const numero = String(910000000 + ((i * 7919) % 89999999)).padStart(9, "0");
      const extras = EXTRAS[i % EXTRAS.length];
      const diasDepois = i % 5;
      leads.push({
        clint_contact_id: `clint-${String(i + 1).padStart(4, "0")}`,
        nome,
        telefone: semTelefone ? null : `+55${ddd}${numero}`,
        email: semEmail ? null : `${slug(nome)}@exemplo.com.br`,
        tier: tier.tag,
        tier_rank: tier.rank,
        evento_tag: evento,
        tags: [evento, "Levantou a Mão", ...(tier.tag ? [tier.tag] : []), ...extras],
        created_at: `${isoDaTag(evento)}T${String(9 + (i % 10)).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}:00-03:00`,
        // 1 em cada 3 tem ficha no Mapa de Calor (ids do mock data_clients.json).
        lead_id: i % 3 === 0 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
        // 3 em 4 têm negócio na Clint (deal + url + etapa); dono só existe com negócio,
        // e 1 em 4 negócios está sem dono.
        // Origem: ~60% ao vivo, ~30% replay, ~10% sem sinal de presença. Com
        // simular=sem_replay ninguém vem do replay.
        ...(() => {
          const r = i % 10;
          const origem: "ao_vivo" | "replay" | null =
            r === 9 ? null : r >= 6 && simular !== "sem_replay" ? "replay" : "ao_vivo";
          const assistiuReplay = origem === "replay" || (origem === "ao_vivo" && i % 7 === 0 && simular !== "sem_replay");
          return {
            origem,
            convidado_resgate: simular !== "sem_resgate" && i % 4 === 2,
            acessou_replay: assistiuReplay || (simular !== "sem_replay" && i % 6 === 0),
            assistiu_replay: assistiuReplay,
            aplicacao_por_fallback: i % 9 === 4,
          };
        })(),
        ...(i % 4 === 3
          ? { clint_deal_id: null, url_clint: null, etapa: null, dono: null }
          : {
              clint_deal_id: `deal-${1000 + i}`,
              url_clint: `https://app.clint.digital/deal/deal-${1000 + i}`,
              etapa: ETAPAS_CLINT[i % ETAPAS_CLINT.length],
              dono: DONOS[i % 3],
            }),
      });
      if (diasDepois > 0) {
        // Entrou alguns dias depois do evento (mantém ordem estável no mock).
        const d = new Date(leads[leads.length - 1].created_at!);
        d.setUTCDate(d.getUTCDate() + diasDepois);
        leads[leads.length - 1].created_at = d.toISOString();
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

  const pendentes = leads.length;
  const agendaram = 22 * eventos.length;
  const levantaram = pendentes + agendaram;
  const noEvento = 214 * eventos.length; // inscritos (tag WG), já sem desqualificados
  const assistiram = 120 * eventos.length; // Participou / Pós WG / Levantou a Mão
  const desqualificados = 9 * eventos.length;

  // por_dono: pendentes desc, "Sem dono" por último (mesma regra do backend).
  const porDono = new Map<string, { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }>();
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

  // Matriz coerente com os leads: pendentes por origem saem da própria lista;
  // os agendados do mock se repartem 15 ao vivo / 6 replay / 1 sem origem por evento.
  const semReplay = simular === "sem_replay";
  const n = eventos.length;
  const pend = (o: "ao_vivo" | "replay" | null) => leads.filter((l) => l.origem === o);
  const alto = (ls: LeadPendenteMock[]) => ls.filter((l) => l.tier_rank >= 4).length;
  const agAoVivo = (semReplay ? 21 : 15) * n;
  const agReplay = semReplay ? 0 : 6 * n;
  const agSem = 1 * n;
  const linha = (
    ls: LeadPendenteMock[],
    ag: number,
    assistiramL: number,
    acessaram: number | null,
  ): LinhaMatrizMock => ({
    acessaram,
    assistiram: assistiramL,
    aplicaram: ls.length + ag,
    agendaram: ag,
    taxa_agendamento: taxa(ag, ls.length + ag),
    pendentes: ls.length,
    alto_valor_pendente: alto(ls),
  });
  const aoVivo = linha(pend("ao_vivo"), agAoVivo, (semReplay ? 120 : 84) * n, null);
  const replay = semReplay ? LINHA_VAZIA : linha(pend("replay"), agReplay, 36 * n, 58 * n);
  const semOrigem = pend(null).length + agSem;
  const semParticipou = simular === "sem_participou";
  const inflada = simular === "base_inflada";
  if (semParticipou) aoVivo.assistiram = null;
  if (inflada) aoVivo.assistiram = 1292 * n;
  const total: LinhaMatrizMock = {
    acessaram: replay.acessaram,
    assistiram: semParticipou ? null : (aoVivo.assistiram ?? 0) + (replay.assistiram ?? 0),
    aplicaram: aoVivo.aplicaram + replay.aplicaram + semOrigem,
    agendaram: agAoVivo + agReplay + agSem,
    taxa_agendamento: taxa(agAoVivo + agReplay + agSem, aoVivo.aplicaram + replay.aplicaram + semOrigem),
    pendentes: leads.length,
    alto_valor_pendente: alto(leads),
  };

  const convidadosPend = leads.filter((l) => l.convidado_resgate).length;
  const resgate =
    simular === "sem_resgate"
      ? null
      : {
          convidados: 2600 * n,
          assistiram: 180 * n,
          aplicaram: convidadosPend + 5 * n,
          agendaram: 5 * n,
          pendentes: convidadosPend,
          taxa_retorno: taxa(180 * n, 2600 * n),
          taxa_aplicacao: taxa(convidadosPend + 5 * n, 180 * n),
          taxa_agendamento: taxa(5 * n, convidadosPend + 5 * n),
        };

  return {
    ...base,
    sinais_indisponiveis: semParticipou ? ["participou"] : [],
    avisos: inflada ? ["assistiram_acima_de_inscritos", "taxa_acima_de_100"] : [],
    matriz: { ao_vivo: aoVivo, replay, total },
    resgate: inflada && resgate ? { ...resgate, taxa_aplicacao: 1.35 } : resgate,
    totais: {
      inscritos: noEvento,
      sem_origem: semOrigem,
      no_evento: noEvento,
      desqualificados,
      // Igual ao backend: totais.assistiram cai em 0 quando o sinal é null.
      assistiram: total.assistiram ?? 0,
      levantaram_mao: total.aplicaram,
      agendaram: total.agendaram,
      pendentes,
    },
    por_dono,
    leads,
  };
}
