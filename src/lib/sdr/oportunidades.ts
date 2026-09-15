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
  })
  .passthrough();
export type LeadPendente = z.infer<typeof LeadPendenteSchema>;

export const OportunidadesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z.object({
    // Inscritos no evento (contatos com a tag WG).
    no_evento: z.number().int(),
    // Quem ASSISTIU (tags "Participou" / "Pós WG" / "Levantou a Mão"). Opcional:
    // backend anterior à correção de set/2026 não manda — a UI cai em no_evento.
    assistiram: z.number().int().nullish(),
    levantaram_mao: z.number().int(),
    agendaram: z.number().int(),
    pendentes: z.number().int(),
  }),
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
  busca: string;
};

// Busca por nome/e-mail/telefone (acento e caixa ignorados; no telefone só os
// dígitos contam, então "21 9123" casa com "+5521 9123…").
export function filtrarPendentes(leads: LeadPendente[], f: FiltroPendentes): LeadPendente[] {
  const tiers = new Set(f.tiers);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

export type Ordenacao = { campo: "nome" | "tier"; direcao: "asc" | "desc" } | null;

// null = ordem do backend (já correta). Ordenação estável: empate mantém a
// ordem original.
export function ordenarPendentes(leads: LeadPendente[], ord: Ordenacao): LeadPendente[] {
  if (!ord) return leads;
  const sinal = ord.direcao === "asc" ? 1 : -1;
  return leads
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
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
// escapadas. A primeira linha é o cabeçalho.
export function csvDePendentes(leads: LeadPendente[], comEvento: boolean): string {
  const cabecalho = [
    "Nome",
    "MQL",
    ...(comEvento ? ["Evento"] : []),
    "Telefone",
    "E-mail",
    "Entrou em",
    "Tags",
  ];
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) =>
    [
      l.nome,
      tierDoLead(l).label,
      ...(comEvento ? [l.evento_tag ?? ""] : []),
      l.telefone ?? "",
      l.email ?? "",
      l.created_at ?? "",
      (l.tags ?? []).join(", "),
    ]
      .map(celula)
      .join(";"),
  );
  return [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}
