import { z } from "zod";
import { formatarPct, pct, TRAVESSAO, tierDoLead, type LeadPendente } from "./oportunidades";

// ---------------------------------------------------------------------------
// Aba "Retenção da audiência" (Produtividade SDR). Fonte: GET
// /api/eventos/retencao?de&ate — quanto do webinar cada inscrito assistiu,
// pelas tags "Assistiu N%" da Clint. Sete degraus (3 · 10 · 20 · 30 · 50 · 70 ·
// 90%), cada um com quantos inscritos chegaram ATÉ ali (`alcancaram`, sempre
// decrescente). `com_a_tag` é conferência do backend: não vai para a tela.
// Funções puras; o gráfico e os cards só consomem `pontosDaCurva`.
// ---------------------------------------------------------------------------

export const DegrauRetencaoSchema = z
  .object({
    percentual: z.number(),
    minutos: z.number().nullish(),
    tag: z.string().nullish(),
    alcancaram: z.number().int(),
    com_a_tag: z.number().int().nullish(),
  })
  .passthrough();
export type DegrauRetencao = z.infer<typeof DegrauRetencaoSchema>;

// Lead medido: os mesmos campos de identificação/classificação dos outros
// endpoints de evento, mais até onde assistiu.
export const LeadRetencaoSchema = z
  .object({
    clint_contact_id: z.string(),
    lead_id: z.string().nullish(),
    nome: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    tier: z.string().nullish(),
    tier_rank: z.number().int().nullish(),
    possivel_ninja: z.boolean().nullish(),
    evento_tag: z.string().nullish(),
    percentual_maximo: z.number().nullish(),
    minutos: z.number().nullish(),
    tags: z.array(z.string()).nullish(),
    created_at: z.string().nullish(),
  })
  .passthrough();
export type LeadRetencao = z.infer<typeof LeadRetencaoSchema>;

export const RetencaoResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int().nullish(),
      // Chegaram ao 1º degrau (têm alguma tag de percentual).
      assistiram: z.number().int(),
      // Inscritos sem nenhuma tag de percentual.
      sem_medicao: z.number().int().nullish(),
    })
    .passthrough(),
  curva: z.array(DegrauRetencaoSchema),
  avisos: z.array(z.string()).nullish(),
  leads: z.array(LeadRetencaoSchema).nullish(),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type RetencaoResponse = z.infer<typeof RetencaoResponseSchema>;

// ---------------------------------------------------------------------------
// Curva pronta para a tela.
// ---------------------------------------------------------------------------

export type PontoRetencao = {
  percentual: number;
  minutos: number | null;
  // "3%" e "5 min" — rótulo do eixo e do tooltip.
  rotulo: string;
  rotuloMinutos: string;
  alcancaram: number;
  // % dos inscritos que chegaram até aqui (null sem inscritos).
  dosInscritos: number | null;
  // Retenção relativa ao 1º degrau (100% no primeiro; null se o 1º é zero).
  doPrimeiro: number | null;
};

export function rotuloMinutos(minutos: number | null | undefined): string {
  if (minutos == null) return TRAVESSAO;
  return minutos >= 60 && minutos % 60 === 0 ? `${minutos / 60} h` : `${minutos} min`;
}

// Ordena pelo percentual (o backend já manda assim, mas não dependemos disso)
// e calcula as duas leituras de cada degrau.
export function pontosDaCurva(curva: readonly DegrauRetencao[], inscritos: number | null | undefined): PontoRetencao[] {
  const ordenada = [...curva].sort((a, b) => a.percentual - b.percentual);
  const primeiro = ordenada[0]?.alcancaram ?? 0;
  return ordenada.map((d) => ({
    percentual: d.percentual,
    minutos: d.minutos ?? null,
    rotulo: `${d.percentual}%`,
    rotuloMinutos: rotuloMinutos(d.minutos),
    alcancaram: d.alcancaram,
    dosInscritos: inscritos && inscritos > 0 ? pct(d.alcancaram, inscritos) : null,
    doPrimeiro: primeiro > 0 ? pct(d.alcancaram, primeiro) : null,
  }));
}

// A curva é decrescente por definição (quem chegou a 50% chegou a 30%). Um
// degrau maior que o anterior é base inconsistente — a tela avisa, não esconde.
export function curvaInconsistente(curva: readonly DegrauRetencao[]): boolean {
  const ordenada = [...curva].sort((a, b) => a.percentual - b.percentual);
  return ordenada.some((d, i) => i > 0 && d.alcancaram > ordenada[i - 1].alcancaram);
}

// Quantos chegaram a um degrau específico (ex.: 50% = "viram metade").
export function alcancaramNoDegrau(curva: readonly DegrauRetencao[], percentual: number): number | null {
  return curva.find((d) => d.percentual === percentual)?.alcancaram ?? null;
}

export function formatarPctOuTravessao(v: number | null): string {
  return v == null ? TRAVESSAO : formatarPct(v);
}

// ---------------------------------------------------------------------------
// Lista de leads medidos: ordem do backend (percentual desc); só busca e tier.
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

export function filtrarMedidos(
  leads: readonly LeadRetencao[],
  f: { busca: string; percentualMinimo?: number | null },
): LeadRetencao[] {
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (f.percentualMinimo != null && (l.percentual_maximo ?? 0) < f.percentualMinimo) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// Linhas da planilha XLSX dos medidos (cabeçalhos em português, uma linha por
// lead, ordem do backend). Pura: o RetencaoPanel só converte em arquivo.
export type LinhaXlsxRetencao = Record<string, string | number>;

export function linhasXlsxRetencao(leads: readonly LeadRetencao[]): LinhaXlsxRetencao[] {
  return leads.map((l) => ({
    Nome: l.nome,
    "Classificação": tierDoMedido(l).label,
    "Assistiu até (%)": l.percentual_maximo ?? "",
    Minutos: l.minutos ?? "",
    Evento: l.evento_tag ?? "",
    Telefone: l.telefone ?? "",
    "E-mail": l.email ?? "",
    "Entrou em": l.created_at ?? "",
    "Ficha no Mapa": l.lead_id ?? "",
    Tags: (l.tags ?? []).join(", "),
  }));
}

// Classificação do lead medido (mesma régua da aba de oportunidades).
export function tierDoMedido(l: LeadRetencao) {
  return tierDoLead({ tier: l.tier, tier_rank: l.tier_rank } as Pick<LeadPendente, "tier" | "tier_rank">);
}
