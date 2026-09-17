import { z } from "zod";
import { diasEntre } from "./ciclo";

// ---------------------------------------------------------------------------
// Aba "Levantou a Mão" (Produtividade SDR). Fonte: GET /api/eventos/oportunidades
// (backend mapacalor-api) — quem aplicou no webinar (tag "Levantou a Mão") e NÃO
// agendou a 1ª call. `leads` traz SÓ os pendentes, já ordenados pelo backend
// (tier_rank desc → evento_tag desc → nome asc). Todo filtro de MQL, busca,
// ordenação e CSV acontece AQUI, no cliente, sobre esse array — sem ida extra
// ao servidor. Funções puras, sem rede.
// ---------------------------------------------------------------------------

// Contrato TOLERANTE (um campo nulo/extra nunca derruba a aba).
export const LeadPendenteSchema = z
  .object({
    clint_contact_id: z.string(),
    nome: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    tier: z.string().nullish(),
    tier_rank: z.number().int().nullish(),
    evento_tag: z.string().nullish(),
    tags: z.array(z.string()).nullish(),
    created_at: z.string().nullish(),
    // Id do lead no Mapa de Calor quando o backend casou o contato (e-mail ou
    // telefone) com a tabela `leads`. null = sem ficha (quem só se inscreveu e
    // levantou a mão não passa pelo webhook da Clint). Opcional: backend antigo
    // não manda.
    lead_id: z.string().nullish(),
    // --- V2 (todos opcionais: backend V1 segue válido) ---
    // Negócio escolhido na Clint e o card dele. url_clint vem PRONTA do backend;
    // o front nunca monta a URL. null = contato sem negócio.
    clint_deal_id: z.string().nullish(),
    url_clint: z.string().nullish(),
    // Etapa do negócio na Clint (ex.: "Prospecção").
    etapa: z.string().nullish(),
    // Dono do negócio (SDR responsável). null = "Sem dono".
    dono: z
      .object({ id: z.string().nullish(), nome: z.string(), email: z.string().nullish() })
      .nullish(),
    // --- V3 (opcionais: backend V2 segue válido) ---
    // Recorte do contato no ciclo: "ao_vivo" | "replay" | null (aplicou sem sinal
    // de presença). String livre de propósito: valor novo não derruba a aba.
    origem: z.string().nullish(),
    convidado_resgate: z.boolean().nullish(),
    acessou_replay: z.boolean().nullish(),
    assistiu_replay: z.boolean().nullish(),
  })
  .passthrough();
export type LeadPendente = z.infer<typeof LeadPendenteSchema>;

// Pendentes por dono (V2), já ordenado pelo backend: pendentes desc, "Sem dono" último.
export const DonoAgregadoSchema = z.object({
  dono_id: z.string().nullish(),
  dono_nome: z.string(),
  pendentes: z.number().int(),
  alto_valor: z.number().int(),
});
export type DonoAgregado = z.infer<typeof DonoAgregadoSchema>;

// Linha da matriz ao vivo / replay / total (V3). `acessaram` é null no ao vivo
// (não é degrau desse recorte) e `taxa_agendamento` é null quando aplicaram = 0.
export const LinhaMatrizSchema = z.object({
  acessaram: z.number().int().nullish(),
  assistiram: z.number().int().nullish(),
  aplicaram: z.number().int().nullish(),
  agendaram: z.number().int().nullish(),
  taxa_agendamento: z.number().nullish(),
  pendentes: z.number().int().nullish(),
  alto_valor_pendente: z.number().int().nullish(),
});
export type LinhaMatriz = z.infer<typeof LinhaMatrizSchema>;

export const MatrizSchema = z.object({
  ao_vivo: LinhaMatrizSchema,
  replay: LinhaMatrizSchema,
  total: LinhaMatrizSchema,
});
export type Matriz = z.infer<typeof MatrizSchema>;

// Funil da campanha de resgate (denominador próprio). Taxas vêm PRONTAS.
export const ResgateSchema = z.object({
  convidados: z.number().int(),
  assistiram: z.number().int(),
  aplicaram: z.number().int(),
  agendaram: z.number().int(),
  pendentes: z.number().int(),
  taxa_retorno: z.number().nullish(),
  taxa_aplicacao: z.number().nullish(),
  taxa_agendamento: z.number().nullish(),
});
export type Resgate = z.infer<typeof ResgateSchema>;

export const OportunidadesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  // V3: intervalo com 2+ eventos — tags sem data foram ignoradas (subcontagem).
  atribuicao_parcial: z.boolean().nullish(),
  totais: z.object({
    // Inscritos no evento (contatos com a tag WG).
    no_evento: z.number().int(),
    // Quem ASSISTIU (tags "Participou" / "Pós WG" / "Levantou a Mão"). Opcional:
    // backend anterior à correção de set/2026 não manda — a UI cai em no_evento.
    assistiram: z.number().int().nullish(),
    // V2: contatos removidos da base por estarem em "Desqualificado" (conferência).
    // no_evento já vem SEM eles.
    desqualificados: z.number().int().nullish(),
    // V3: aplicaram sem nenhum sinal de presença (só entram na linha Total).
    sem_origem: z.number().int().nullish(),
    levantaram_mao: z.number().int(),
    agendaram: z.number().int(),
    pendentes: z.number().int(),
  }),
  matriz: MatrizSchema.nullish(),
  resgate: ResgateSchema.nullish(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadPendenteSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type OportunidadesResponse = z.infer<typeof OportunidadesResponseSchema>;
export type TotaisOportunidades = OportunidadesResponse["totais"];

// Etapas do funil na ordem. Com `assistiram` presente são 4 (inscritos →
// assistiram → levantaram → agendaram); sem ele, as 3 originais.
export type EtapaFunil = {
  chave: "inscritos" | "assistiram" | "levantaram" | "agendaram";
  rotulo: string;
  valor: number;
};

export function etapasDoFunil(t: TotaisOportunidades): EtapaFunil[] {
  const temAssistiram = t.assistiram != null;
  return [
    { chave: "inscritos", rotulo: temAssistiram ? "Inscritos" : "No evento", valor: t.no_evento },
    ...(temAssistiram
      ? [{ chave: "assistiram" as const, rotulo: "Assistiram", valor: t.assistiram ?? 0 }]
      : []),
    { chave: "levantaram", rotulo: "Levantou a mão", valor: t.levantaram_mao },
    { chave: "agendaram", rotulo: "Agendou", valor: t.agendaram },
  ];
}

// Base sobre a qual "levantaram a mão" faz sentido: quem assistiu, se houver.
export function baseDeLevantaram(t: TotaisOportunidades): { valor: number; rotulo: string } {
  return t.assistiram != null
    ? { valor: t.assistiram, rotulo: "dos que assistiram" }
    : { valor: t.no_evento, rotulo: "do no evento" };
}

// Códigos de erro do endpoint (seção 10 do backend) → tratamento da UI.
export type CodigoErroOportunidades =
  | "clint_auth"
  | "clint_indisponivel"
  | "agendamentos_indisponivel"
  | "intervalo_muito_grande"
  | "parametros_invalidos"
  | "desconhecido";

// ---------------------------------------------------------------------------
// Tiers (MQL). Ordem hierárquica fixa da spec; a chave "sem" representa o lead
// sem classificação (tier null / tier_rank 0). As cores seguem a escala de
// temperatura do tema (tokens em globals.css) — NENHUMA cor solta aqui.
// ---------------------------------------------------------------------------

export type TierChave = "UMQL+" | "UMQL" | "HMQL" | "SMQL" | "MQL+" | "MQL" | "sem";

export type TierConfig = {
  chave: TierChave;
  label: string;
  rank: number;
  // Classes Tailwind (tokens da paleta): badge/chip, texto e barra.
  badge: string;
  chipAtivo: string;
  text: string;
  barra: string;
};

export const TIERS: readonly TierConfig[] = [
  {
    chave: "UMQL+",
    label: "UMQL+",
    rank: 6,
    badge: "bg-muito-quente/15 text-muito-quente border border-muito-quente/30",
    chipAtivo: "bg-muito-quente/20 text-muito-quente border-muito-quente/60",
    text: "text-muito-quente",
    barra: "bg-muito-quente",
  },
  {
    chave: "UMQL",
    label: "UMQL",
    rank: 5,
    badge: "bg-quente/15 text-quente border border-quente/30",
    chipAtivo: "bg-quente/20 text-quente border-quente/60",
    text: "text-quente",
    barra: "bg-quente",
  },
  {
    chave: "HMQL",
    label: "HMQL",
    rank: 4,
    badge: "bg-morno-alto/15 text-morno-alto border border-morno-alto/30",
    chipAtivo: "bg-morno-alto/20 text-morno-alto border-morno-alto/60",
    text: "text-morno-alto",
    barra: "bg-morno-alto",
  },
  {
    chave: "SMQL",
    label: "SMQL",
    rank: 3,
    badge: "bg-morno-baixo/15 text-morno-baixo border border-morno-baixo/30",
    chipAtivo: "bg-morno-baixo/20 text-morno-baixo border-morno-baixo/60",
    text: "text-morno-baixo",
    barra: "bg-morno-baixo",
  },
  {
    chave: "MQL+",
    label: "MQL+",
    rank: 2,
    badge: "bg-frio/15 text-frio border border-frio/30",
    chipAtivo: "bg-frio/20 text-frio border-frio/60",
    text: "text-frio",
    barra: "bg-frio",
  },
  {
    chave: "MQL",
    label: "MQL",
    rank: 1,
    badge: "bg-congelado/15 text-congelado border border-congelado/30",
    chipAtivo: "bg-congelado/20 text-congelado border-congelado/60",
    text: "text-congelado",
    barra: "bg-congelado",
  },
  {
    chave: "sem",
    label: "Sem classificação",
    rank: 0,
    badge: "border border-dashed border-borda bg-transparent text-texto-sec/80",
    chipAtivo: "bg-painel-claro text-texto border-texto-sec/60",
    text: "text-texto-sec",
    barra: "bg-borda",
  },
] as const;

// Atalho "Só alto valor" = UMQL+, UMQL e HMQL.
export const TIERS_ALTO_VALOR: readonly TierChave[] = ["UMQL+", "UMQL", "HMQL"];
export const RANK_ALTO_VALOR_MIN = 4;

const TIER_POR_CHAVE = new Map<string, TierConfig>(TIERS.map((t) => [t.chave, t]));
const TIER_POR_RANK = new Map<number, TierConfig>(TIERS.map((t) => [t.rank, t]));
const TIER_SEM = TIERS[TIERS.length - 1];

// Tier do lead: pelo nome canônico; se não casar, pelo rank; senão "sem".
export function tierDoLead(lead: Pick<LeadPendente, "tier" | "tier_rank">): TierConfig {
  const porNome = lead.tier ? TIER_POR_CHAVE.get(lead.tier.trim().toUpperCase()) : undefined;
  if (porNome) return porNome;
  return TIER_POR_RANK.get(lead.tier_rank ?? 0) ?? TIER_SEM;
}

export function ehAltoValor(lead: Pick<LeadPendente, "tier" | "tier_rank">): boolean {
  return tierDoLead(lead).rank >= RANK_ALTO_VALOR_MIN;
}

// Contagem de pendentes por tier (todas as 7 chaves presentes, zero incluso).
export function contarPorTier(leads: LeadPendente[]): Record<TierChave, number> {
  const out = Object.fromEntries(TIERS.map((t) => [t.chave, 0])) as Record<TierChave, number>;
  for (const l of leads) out[tierDoLead(l).chave] += 1;
  return out;
}

// Distribuição para o gráfico de barras: só tiers com pendentes, maior → menor.
export function distribuicaoPorTier(
  leads: LeadPendente[],
): { tier: TierConfig; total: number }[] {
  const contagem = contarPorTier(leads);
  return TIERS.map((tier) => ({ tier, total: contagem[tier.chave] }))
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total || b.tier.rank - a.tier.rank);
}

export function altoValorPendente(leads: LeadPendente[]): number {
  return leads.filter(ehAltoValor).length;
}

// ---------------------------------------------------------------------------
// Dono (SDR responsável pelo negócio na Clint) — V2.
// ---------------------------------------------------------------------------

export const SEM_DONO_CHAVE = "sem";
export const SEM_DONO_LABEL = "Sem dono";

// Chave estável do dono para filtro/agrupamento: id do dono; sem id, o nome;
// sem dono, "sem".
export function chaveDono(dono: LeadPendente["dono"]): string {
  if (!dono) return SEM_DONO_CHAVE;
  return dono.id ?? `nome:${dono.nome}`;
}

export function nomeDono(dono: LeadPendente["dono"]): string {
  return dono?.nome?.trim() || SEM_DONO_LABEL;
}

export type OpcaoDono = { chave: string; nome: string; pendentes: number; altoValor: number };

// Chips de dono. Fonte preferida: totais.por_dono (contagens do backend). Sem
// ele (backend V1), deriva dos próprios leads. Sempre pendentes desc, "Sem dono"
// por último.
export function opcoesDeDono(
  leads: LeadPendente[],
  porDono?: DonoAgregado[] | null,
): OpcaoDono[] {
  const opcoes: OpcaoDono[] = [];
  if (porDono && porDono.length > 0) {
    for (const d of porDono) {
      opcoes.push({
        chave: d.dono_id ?? (d.dono_nome === SEM_DONO_LABEL ? SEM_DONO_CHAVE : `nome:${d.dono_nome}`),
        nome: d.dono_id || d.dono_nome !== SEM_DONO_LABEL ? d.dono_nome : SEM_DONO_LABEL,
        pendentes: d.pendentes,
        altoValor: d.alto_valor,
      });
    }
  } else {
    const mapa = new Map<string, OpcaoDono>();
    for (const l of leads) {
      const chave = chaveDono(l.dono);
      const atual = mapa.get(chave) ?? { chave, nome: nomeDono(l.dono), pendentes: 0, altoValor: 0 };
      atual.pendentes += 1;
      if (ehAltoValor(l)) atual.altoValor += 1;
      mapa.set(chave, atual);
    }
    opcoes.push(...mapa.values());
  }
  return opcoes.sort(compararDonos);
}

function compararDonos(a: { chave: string; pendentes: number; nome: string }, b: { chave: string; pendentes: number; nome: string }): number {
  if (a.chave === SEM_DONO_CHAVE) return 1;
  if (b.chave === SEM_DONO_CHAVE) return -1;
  return b.pendentes - a.pendentes || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}

export type GrupoDono = { chave: string; nome: string; leads: LeadPendente[]; altoValor: number };

// Visão "Por SDR": uma seção por dono, pendentes desc, "Sem dono" por último.
// Dentro de cada seção mantém a ordem recebida (a do backend: tier desc).
export function agruparPorDono(leads: LeadPendente[]): GrupoDono[] {
  const mapa = new Map<string, GrupoDono>();
  for (const l of leads) {
    const chave = chaveDono(l.dono);
    const g = mapa.get(chave) ?? { chave, nome: nomeDono(l.dono), leads: [], altoValor: 0 };
    g.leads.push(l);
    if (ehAltoValor(l)) g.altoValor += 1;
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) =>
    compararDonos(
      { chave: a.chave, pendentes: a.leads.length, nome: a.nome },
      { chave: b.chave, pendentes: b.leads.length, nome: b.nome },
    ),
  );
}

// ---------------------------------------------------------------------------
// Origem (V3): ao vivo | replay | sem origem. Cores por token do tema.
// ---------------------------------------------------------------------------

export type OrigemChave = "ao_vivo" | "replay" | "sem";

export type OrigemConfig = {
  chave: OrigemChave;
  label: string;
  ordem: number;
  badge: string;
  chipAtivo: string;
};

export const ORIGENS: readonly OrigemConfig[] = [
  {
    chave: "ao_vivo",
    label: "Ao vivo",
    ordem: 0,
    badge: "bg-teal/15 text-teal border border-teal/30",
    chipAtivo: "bg-teal/20 text-teal border-teal/60",
  },
  {
    chave: "replay",
    label: "Replay",
    ordem: 1,
    badge: "bg-violeta/15 text-violeta border border-violeta/30",
    chipAtivo: "bg-violeta/20 text-violeta border-violeta/60",
  },
  {
    chave: "sem",
    label: "Sem origem",
    ordem: 2,
    badge: "border border-dashed border-borda bg-transparent text-texto-sec/80",
    chipAtivo: "bg-painel-claro text-texto border-texto-sec/60",
  },
] as const;

const ORIGEM_POR_CHAVE = new Map<string, OrigemConfig>(ORIGENS.map((o) => [o.chave, o]));

export function origemDoLead(lead: Pick<LeadPendente, "origem">): OrigemConfig {
  return ORIGEM_POR_CHAVE.get(lead.origem ?? "") ?? ORIGENS[2];
}

// Marcador "Viu o replay também": só faz sentido em lead de origem AO VIVO.
export function viuReplayTambem(lead: Pick<LeadPendente, "origem" | "assistiu_replay">): boolean {
  return origemDoLead(lead).chave === "ao_vivo" && lead.assistiu_replay === true;
}

export type ContagemOrigem = Record<OrigemChave, number> & { resgate: number };

export function contarPorOrigem(leads: LeadPendente[]): ContagemOrigem {
  const out: ContagemOrigem = { ao_vivo: 0, replay: 0, sem: 0, resgate: 0 };
  for (const l of leads) {
    out[origemDoLead(l).chave] += 1;
    if (l.convidado_resgate) out.resgate += 1;
  }
  return out;
}

// Célula da matriz: null/undefined → travessão, NUNCA zero.
export const TRAVESSAO = "—";
export function celulaMatriz(v: number | null | undefined): string {
  return v == null ? TRAVESSAO : String(v);
}

// Taxa que vem PRONTA do backend como fração (0.393). null → travessão, nunca 0%.
export function formatarTaxa(taxa: number | null | undefined): string {
  return taxa == null ? TRAVESSAO : formatarPct(taxa * 100);
}

// Recorte sem nenhum dado (tudo 0/null) — ex.: ciclo sem replay. A linha inteira
// vira travessões em vez de uma fileira de zeros.
export function linhaSemDados(l: LinhaMatriz): boolean {
  return [l.acessaram, l.assistiram, l.aplicaram, l.agendaram, l.pendentes].every(
    (v) => v == null || v === 0,
  );
}

// Conferência da matriz: Total.aplicaram = Ao vivo + Replay + sem_origem.
export function matrizFecha(m: Matriz, semOrigem: number | null | undefined): boolean {
  return (
    (m.total.aplicaram ?? 0) ===
    (m.ao_vivo.aplicaram ?? 0) + (m.replay.aplicaram ?? 0) + (semOrigem ?? 0)
  );
}

// Degraus do funil de resgate. `taxa` é a passagem a partir do degrau anterior,
// exatamente como o backend mandou; o último degrau (Pendentes) não tem taxa.
export type DegrauResgate = {
  chave: "convidados" | "assistiram" | "levantaram" | "agendaram" | "pendentes";
  rotulo: string;
  valor: number;
  taxa: string | null;
};

export function degrausDoResgate(r: Resgate): DegrauResgate[] {
  return [
    { chave: "convidados", rotulo: "Convidados", valor: r.convidados, taxa: null },
    { chave: "assistiram", rotulo: "Assistiram", valor: r.assistiram, taxa: formatarTaxa(r.taxa_retorno) },
    { chave: "levantaram", rotulo: "Levantaram a mão", valor: r.aplicaram, taxa: formatarTaxa(r.taxa_aplicacao) },
    { chave: "agendaram", rotulo: "Agendaram", valor: r.agendaram, taxa: formatarTaxa(r.taxa_agendamento) },
    { chave: "pendentes", rotulo: "Pendentes", valor: r.pendentes, taxa: null },
  ];
}

// ---------------------------------------------------------------------------
// Filtros e ordenação (client-side).
// ---------------------------------------------------------------------------

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export type FiltroPendentes = {
  // Nenhum tier selecionado = todos.
  tiers: readonly TierChave[];
  // Chaves de dono (chaveDono). Nenhum selecionado = todos. Aplica em série com tiers.
  donos?: readonly string[];
  // Origens (V3). Nenhuma selecionada = todas. Em série com tiers e donos.
  origens?: readonly OrigemChave[];
  // "Convidados de resgate": filtro independente, combina com qualquer outro.
  soResgate?: boolean;
  busca: string;
};

// Busca por nome/e-mail/telefone (acento e caixa ignorados; no telefone só os
// dígitos contam, então "21 9123" casa com "+5521 9123…").
export function filtrarPendentes(leads: LeadPendente[], f: FiltroPendentes): LeadPendente[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const origens = new Set(f.origens ?? []);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (origens.size > 0 && !origens.has(origemDoLead(l).chave)) return false;
    if (f.soResgate && !l.convidado_resgate) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

export type CampoOrdenacao = "nome" | "tier" | "dono" | "origem";
export type Ordenacao = { campo: CampoOrdenacao; direcao: "asc" | "desc" } | null;

// null = ordem do backend (já correta). Ordenação estável: empate mantém a
// ordem original. Por dono: alfabético, "Sem dono" SEMPRE no fim nas duas direções.
export function ordenarPendentes(leads: LeadPendente[], ord: Ordenacao): LeadPendente[] {
  if (!ord) return leads;
  const sinal = ord.direcao === "asc" ? 1 : -1;
  return leads
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      if (ord.campo === "dono") {
        const semA = !a.l.dono;
        const semB = !b.l.dono;
        if (semA !== semB) return semA ? 1 : -1;
        const cmp = nomeDono(a.l.dono).localeCompare(nomeDono(b.l.dono), "pt-BR", { sensitivity: "base" });
        return cmp !== 0 ? cmp * sinal : a.i - b.i;
      }
      if (ord.campo === "origem") {
        // Ao vivo → Replay (ou o inverso); "Sem origem" SEMPRE no fim.
        const oa = origemDoLead(a.l);
        const ob = origemDoLead(b.l);
        if ((oa.chave === "sem") !== (ob.chave === "sem")) return oa.chave === "sem" ? 1 : -1;
        const cmp = oa.ordem - ob.ordem;
        return cmp !== 0 ? cmp * sinal : a.i - b.i;
      }
      const cmp =
        ord.campo === "nome"
          ? a.l.nome.localeCompare(b.l.nome, "pt-BR", { sensitivity: "base" })
          : tierDoLead(a.l).rank - tierDoLead(b.l).rank;
      return cmp !== 0 ? cmp * sinal : a.i - b.i;
    })
    .map((x) => x.l);
}

// ---------------------------------------------------------------------------
// Percentuais e período.
// ---------------------------------------------------------------------------

// Percentual (0–100) de parte sobre total; 0 quando total = 0.
export function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export function formatarPct(v: number): string {
  return `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")}%`;
}

export const MAX_DIAS_INTERVALO = 90;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export type ErroIntervalo = { campo: "de" | "ate"; mensagem: string } | null;

// Validação do modo intervalo (espelha a do backend): datas válidas, ate ≥ de e
// no máximo 90 dias. Retorna o campo a destacar.
export function validarIntervalo(de: string, ate: string): ErroIntervalo {
  if (!RE_DATA.test(de)) return { campo: "de", mensagem: "Informe a data inicial." };
  if (!RE_DATA.test(ate)) return { campo: "ate", mensagem: "Informe a data final." };
  const dias = diasEntre(de, ate);
  if (dias < 0) {
    return { campo: "ate", mensagem: "A data final deve ser igual ou depois da inicial." };
  }
  if (dias > MAX_DIAS_INTERVALO) {
    return {
      campo: "ate",
      mensagem: `Período muito amplo. Reduza o intervalo (máximo ${MAX_DIAS_INTERVALO} dias).`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Telefone e CSV.
// ---------------------------------------------------------------------------

// Link wa.me: só dígitos (E.164 sem "+"). null quando não há número utilizável.
export function linkWhatsApp(telefone: string | null | undefined): string | null {
  const digitos = soDigitos(telefone);
  return digitos.length >= 10 ? `https://wa.me/${digitos}` : null;
}

// CSV do recorte filtrado — separador ";" (abre certo no Excel pt-BR) e aspas
// escapadas. Colunas fixas na ordem da spec V3 (resgate = "sim" ou vazio).
export function csvDePendentes(leads: LeadPendente[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "origem",
    "resgate",
    "dono",
    "etapa",
    "telefone",
    "email",
    "evento",
    "entrou_em",
    "url_clint",
    "tags",
  ];
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) =>
    [
      l.nome,
      tierDoLead(l).label,
      origemDoLead(l).label,
      l.convidado_resgate ? "sim" : "",
      nomeDono(l.dono),
      l.etapa ?? "",
      l.telefone ?? "",
      l.email ?? "",
      l.evento_tag ?? "",
      l.created_at ?? "",
      l.url_clint ?? "",
      (l.tags ?? []).join(", "),
    ]
      .map(celula)
      .join(";"),
  );
  return [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}

// Estado "todos desqualificados": o ciclo tinha contatos, mas todos saíram da
// base por "Desqualificado" — nenhum lead ativo para trabalhar.
export function todosDesqualificados(t: TotaisOportunidades): boolean {
  return t.no_evento === 0 && (t.desqualificados ?? 0) > 0;
}
