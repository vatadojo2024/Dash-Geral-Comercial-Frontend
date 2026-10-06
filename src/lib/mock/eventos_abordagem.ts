import { tagsEventoNoIntervalo } from "@/lib/sdr/ciclo";

// ---------------------------------------------------------------------------
// Mock de GET /api/eventos/abordagem (LEADS_MODE=mock). Determinístico e
// calibrado no ciclo real de 29/09 (por evento): 302 inscritos = 17 não
// abordados + 165 sem resposta + 29 responderam + 80 em outras colunas + 11 na
// Base (fora da aba). Indicadores: responderam 19 certos + 10 incertos;
// abordados que compareceram 41 + 35; sem resposta e compareceram 16 + 6.
// Mesmas regras do backend (eventos-abordagem.ts): corte às 20h de Brasília
// da terça; `antes` = card parado desde antes do corte; sem negócio → `outra`
// com momento `sem_informacao`. Ordem: presença → % assistido → grupo → nome.
// `simular=vazio|sem_contatos` exercita os estados (os de erro ficam no proxy).
// ---------------------------------------------------------------------------

type Grupo = "nao_abordado" | "sem_resposta" | "respondeu" | "outra";
type Momento = "antes" | "depois" | "sem_informacao";

// [coluna, grupo, presentes antes, presentes depois, ausentes antes, ausentes depois]
// Sem negócio: [null, "outra", 0, 0, 0, 0] + `semInfo` ausentes sem informação.
const COLUNAS: { etapa: string | null; grupo: Grupo; pa: number; pd: number; aa: number; ad: number; semInfo?: number }[] = [
  { etapa: "Prospecção", grupo: "sem_resposta", pa: 16, pd: 6, aa: 100, ad: 43 },
  { etapa: "Ainda não é o momento", grupo: "outra", pa: 6, pd: 8, aa: 12, ad: 6 },
  { etapa: "Potencial Promissor", grupo: "outra", pa: 5, pd: 7, aa: 6, ad: 4 },
  { etapa: "Em qualificação", grupo: "respondeu", pa: 6, pd: 3, aa: 7, ad: 4 },
  { etapa: "Sem atendimento", grupo: "nao_abordado", pa: 2, pd: 1, aa: 12, ad: 2 },
  { etapa: "Primeira Call Agendada", grupo: "outra", pa: 3, pd: 4, aa: 2, ad: 2 },
  { etapa: "2a Call Agendada", grupo: "outra", pa: 1, pd: 4, aa: 3, ad: 3 },
  { etapa: "Qualificado", grupo: "respondeu", pa: 3, pd: 2, aa: 3, ad: 1 },
  { etapa: "Follow-up", grupo: "outra", pa: 1, pd: 1, aa: 0, ad: 0 },
  { etapa: null, grupo: "outra", pa: 0, pd: 0, aa: 0, ad: 0, semInfo: 2 },
];
const FORA_DA_ABA = 11;
const HORA_DO_EVENTO_BR = 20;

const PRIMEIROS = [
  "Alice", "Bernardo", "Cecília", "Davi", "Elaine", "Fábio", "Giovana", "Henrique", "Isadora", "Jonas",
  "Karen", "Lucas", "Melissa", "Nathan", "Otávio", "Paula", "Rafael", "Sabrina", "Thiago", "Valéria",
];
const SOBRENOMES = ["Albuquerque", "Bastos", "Coelho", "Duarte", "Farias", "Gouveia", "Moreira", "Novaes", "Peixoto", "Rezende"];
const DONOS = [
  { id: "54934df3-0000-4000-8000-000000000001", nome: "Guilherme Alves", email: "guilherme@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000002", nome: "Benhur Ramos", email: "benhur@vatadojo.com.br" },
  { id: "54934df3-0000-4000-8000-000000000003", nome: "Glaucio Portela", email: "glaucio@vatadojo.com.br" },
];
const TIERS: { tag: string | null; rank: number }[] = [
  { tag: null, rank: 0 }, { tag: "MQL", rank: 1 }, { tag: "MQL+", rank: 2 }, { tag: "SMQL", rank: 3 },
  { tag: null, rank: 0 }, { tag: "HMQL", rank: 4 }, { tag: "MQL", rank: 1 },
];
const PERCENTUAIS = [90, 90, 70, 70, 50, 30, 20, 10, null];
const PESO: Record<Grupo, number> = { respondeu: 0, sem_resposta: 1, nao_abordado: 2, outra: 3 };

function slug(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");
}

function corteDoEvento(tag: string): string {
  const m = /^WG - (\d{2})\.(\d{2})\.(\d{2})$/.exec(tag);
  const dia = m ? `20${m[3]}-${m[2]}-${m[1]}` : "2026-01-01";
  return `${dia}T${String(HORA_DO_EVENTO_BR).padStart(2, "0")}:00:00-03:00`;
}

export type LeadAbordagemMock = {
  clint_contact_id: string;
  clint_deal_id: string | null;
  url_clint: string | null;
  lead_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  tier: string | null;
  tier_rank: number;
  evento_tag: string;
  etapa: string | null;
  grupo: Grupo;
  momento: Momento;
  movido_em: string | null;
  dono: { id: string; nome: string; email: string } | null;
  assistiu_ao_vivo: boolean;
  aplicou: boolean;
  ja_agendou: boolean;
  percentual_assistido: number | null;
  minutos_assistidos: number | null;
  tags: string[];
  created_at: string | null;
};

function leadsDoEvento(evento: string, e: number): LeadAbordagemMock[] {
  const corte = Date.parse(corteDoEvento(evento));
  const HORA = 3_600_000;
  const leads: LeadAbordagemMock[] = [];
  let i = 0;
  for (const c of COLUNAS) {
    const fatias: [boolean, Momento, number][] = [
      [true, "antes", c.pa],
      [true, "depois", c.pd],
      [false, "antes", c.aa],
      [false, "depois", c.ad],
      [false, "sem_informacao", c.semInfo ?? 0],
    ];
    for (const [presente, momento, qtd] of fatias) {
      for (let k = 0; k < qtd; k++, i++) {
        const n = e * 400 + i;
        const nome = `${PRIMEIROS[n % PRIMEIROS.length]} ${SOBRENOMES[Math.floor(n / PRIMEIROS.length) % SOBRENOMES.length]}`;
        const tier = TIERS[i % TIERS.length];
        const comNegocio = c.etapa !== null;
        const seq = `${e}-${String(i + 1).padStart(4, "0")}`;
        // Movimento: antes = 1 a 12 dias antes do corte; depois = 1 h a 5 dias depois.
        const movido =
          momento === "antes"
            ? new Date(corte - (1 + (i % 12)) * 24 * HORA - (i % 7) * HORA).toISOString()
            : momento === "depois"
              ? // Nunca no futuro: no ciclo da semana o "depois" fica entre o corte e agora.
                new Date(Math.max(corte + 60_000, Math.min(corte + (1 + (i % 5) * 24 + (i % 9)) * HORA, Date.now() - 60_000))).toISOString()
              : null;
        const pct = presente ? PERCENTUAIS[i % PERCENTUAIS.length] : null;
        leads.push({
          clint_contact_id: `clint-ab-${seq}`,
          clint_deal_id: comNegocio ? `deal-ab-${seq}` : null,
          url_clint: comNegocio ? `https://app.clint.digital/deal/deal-ab-${seq}` : null,
          lead_id: i % 10 === 3 ? `ld_${String((i % 40) + 1).padStart(4, "0")}` : null,
          nome,
          telefone: i % 17 === 16 ? null : `+55${["11", "21", "31", "41", "48"][i % 5]}9${String(60000000 + n * 1931).slice(0, 8)}`,
          email: i % 19 === 18 ? null : `${slug(nome)}@exemplo.com`,
          tier: tier.tag,
          tier_rank: tier.rank,
          evento_tag: evento,
          etapa: c.etapa,
          grupo: c.grupo,
          momento,
          movido_em: movido,
          dono: comNegocio ? DONOS[i % 3] : null,
          assistiu_ao_vivo: presente,
          aplicou: presente && i % 4 === 0,
          ja_agendou: c.etapa === "Primeira Call Agendada" || c.etapa === "2a Call Agendada" || i % 37 === 11,
          percentual_assistido: pct,
          minutos_assistidos: pct == null ? null : Math.round((pct / 100) * 120),
          tags: [evento, ...(tier.tag ? [tier.tag] : []), ...(presente ? [pct != null ? `Assistiu ${pct}%` : "Participou"] : [])],
          created_at: `${corteDoEvento(evento).slice(0, 10)}T12:00:00.000Z`,
        });
      }
    }
  }
  return leads;
}

function zeradoInd() {
  return { antes: 0, depois: 0, sem_informacao: 0, total: 0 };
}

export function mockAbordagem(de: string, ate: string, simular?: string | null) {
  const eventos = tagsEventoNoIntervalo(de, ate);
  const n = eventos.length;
  const base = {
    de,
    ate,
    eventos,
    hora_do_evento_br: HORA_DO_EVENTO_BR,
    cortes: eventos.map((evento) => ({ evento, corte: corteDoEvento(evento) })),
    gerado_em: new Date().toISOString(),
    cache: "miss" as const,
  };
  const indicadoresZerados = {
    responderam: zeradoInd(),
    abordados_compareceram: zeradoInd(),
    sem_resposta_compareceram: zeradoInd(),
  };
  const totaisZerados = {
    inscritos: 0, nao_abordados: 0, sem_resposta: 0, responderam: 0, outras_etapas: 0,
    fora_da_aba: 0, presentes_ao_vivo: 0, desqualificados: 0, perdidos: 0,
  };
  if (n === 0 || simular === "sem_contatos" || simular === "vazio") {
    return { ...base, indicadores: indicadoresZerados, totais: totaisZerados, por_etapa: [], por_dono: [], leads: [] };
  }

  const leads = eventos.flatMap((evento, e) => leadsDoEvento(evento, e));
  leads.sort(
    (a, b) =>
      Number(b.assistiu_ao_vivo) - Number(a.assistiu_ao_vivo) ||
      (b.percentual_assistido ?? -1) - (a.percentual_assistido ?? -1) ||
      PESO[a.grupo] - PESO[b.grupo] ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

  const indicadores = { responderam: zeradoInd(), abordados_compareceram: zeradoInd(), sem_resposta_compareceram: zeradoInd() };
  const somar = (ind: ReturnType<typeof zeradoInd>, m: Momento) => {
    ind[m] += 1;
    ind.total += 1;
  };
  const totais = { ...totaisZerados, inscritos: 0, fora_da_aba: FORA_DA_ABA * n, desqualificados: 14 * n, perdidos: 6 * n };
  const etapas = new Map<string, { etapa: string | null; grupo: Grupo; total: number; presentes: number }>();
  for (const l of leads) {
    if (l.grupo === "nao_abordado") totais.nao_abordados += 1;
    else if (l.grupo === "sem_resposta") totais.sem_resposta += 1;
    else if (l.grupo === "respondeu") totais.responderam += 1;
    else totais.outras_etapas += 1;
    if (l.assistiu_ao_vivo) totais.presentes_ao_vivo += 1;
    if (l.grupo === "respondeu") somar(indicadores.responderam, l.momento);
    if (l.grupo !== "nao_abordado" && l.assistiu_ao_vivo) somar(indicadores.abordados_compareceram, l.momento);
    if (l.grupo === "sem_resposta" && l.assistiu_ao_vivo) somar(indicadores.sem_resposta_compareceram, l.momento);
    const chave = l.etapa ?? "(sem negócio)";
    const atual = etapas.get(chave) ?? { etapa: l.etapa, grupo: l.grupo, total: 0, presentes: 0 };
    atual.total += 1;
    if (l.assistiu_ao_vivo) atual.presentes += 1;
    etapas.set(chave, atual);
  }
  totais.inscritos =
    totais.nao_abordados + totais.sem_resposta + totais.responderam + totais.outras_etapas + totais.fora_da_aba;
  const por_etapa = [...etapas.values()].sort((a, b) =>
    a.etapa === null ? 1 : b.etapa === null ? -1 : b.total - a.total,
  );

  const donos = new Map<string, { dono_id: string | null; dono_nome: string; pendentes: number; alto_valor: number }>();
  for (const l of leads) {
    const chave = l.dono?.id ?? "sem";
    const atual = donos.get(chave) ?? { dono_id: l.dono?.id ?? null, dono_nome: l.dono?.nome ?? "Sem dono", pendentes: 0, alto_valor: 0 };
    atual.pendentes += 1;
    if (l.tier_rank >= 3) atual.alto_valor += 1;
    donos.set(chave, atual);
  }
  const por_dono = [...donos.values()].sort((a, b) => (a.dono_id === null ? 1 : b.dono_id === null ? -1 : b.pendentes - a.pendentes));

  return { ...base, indicadores, totais, por_etapa, por_dono, leads };
}
