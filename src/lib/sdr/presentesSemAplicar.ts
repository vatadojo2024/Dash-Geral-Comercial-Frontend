import { z } from "zod";
import {
  DonoAgregadoSchema,
  LeadPendenteSchema,
  chaveDono,
  nomeDono,
  passagemCalculada,
  tierDoLead,
  type BlocoFunil,
  type LeadPendente,
  type TierChave,
} from "./oportunidades";

// ---------------------------------------------------------------------------
// Aba "Presentes que não aplicaram" (Produtividade SDR). Fonte:
// GET /api/eventos/presentes-sem-aplicar?de&ate — lead MQL+ ou acima, inscrito
// no evento, que ESTEVE AO VIVO e NÃO aplicou durante o evento (quem aplicou
// está na aba de Oportunidades). Quem ficou até o fim e não aplicou é o melhor
// alvo de ligação: a lista vem ordenada por tier desc e tempo assistido desc,
// e a ordem NÃO é alterada aqui.
//   - `ja_agendou` true: só sinalizar (selo), nunca filtrar.
//   - `por_dono[].pendentes` é a contagem de leads (nome herdado).
//   - `lead_id` costuma ser null; `url_clint` vem pronta.
// ---------------------------------------------------------------------------

// Mesmo lead das outras abas (o schema comum já aceita percentual_assistido,
// minutos_assistidos e ja_agendou, opcionais).
export const LeadPresenteSchema = LeadPendenteSchema;
export type LeadPresente = LeadPendente;

export const PresentesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int().nullish(),
      presentes: z.number().int().nullish(),
      aplicaram: z.number().int().nullish(),
      presentes_sem_aplicar: z.number().int().nullish(),
      // Tamanho da lista: MQL+ ou acima, presentes, sem aplicar.
      qualificados_sem_aplicar: z.number().int(),
    })
    .passthrough(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadPresenteSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type PresentesResponse = z.infer<typeof PresentesResponseSchema>;
export type TotaisPresentes = PresentesResponse["totais"];

// Funil: Inscritos → Presentes → Não aplicaram (dos presentes) → Qualificados
// MQL+ (dos que não aplicaram). "Aplicaram" fica nos cards: é o complemento de
// "não aplicaram", não um degrau abaixo dele.
export function blocosPresentes(t: TotaisPresentes): BlocoFunil[] {
  const inscritos = t.inscritos ?? 0;
  const presentes = t.presentes ?? 0;
  const semAplicar = t.presentes_sem_aplicar ?? 0;
  return [
    { chave: "inscritos", rotulo: "Inscritos", valor: inscritos, passagem: null },
    { chave: "presentes", rotulo: "Presentes ao vivo", valor: presentes, passagem: passagemCalculada(presentes, inscritos) },
    {
      chave: "nao_aplicaram",
      rotulo: "Não aplicaram",
      valor: semAplicar,
      passagem: passagemCalculada(semAplicar, presentes),
      baseDaPassagem: "dos presentes",
    },
    {
      chave: "qualificados",
      rotulo: "Qualificados (MQL+ ou acima)",
      valor: t.qualificados_sem_aplicar,
      passagem: passagemCalculada(t.qualificados_sem_aplicar, semAplicar),
      baseDaPassagem: "dos que não aplicaram",
    },
  ];
}

// A partir de quantos minutos o tempo assistido ganha destaque (ficou até o fim).
export const MINUTOS_DESTAQUE = 90;

export function ficouAteOFim(lead: Pick<LeadPresente, "minutos_assistidos" | "percentual_assistido">): boolean {
  if (lead.percentual_assistido != null) return lead.percentual_assistido >= 70;
  return (lead.minutos_assistidos ?? 0) >= MINUTOS_DESTAQUE;
}

export function contarAgendaram(leads: readonly Pick<LeadPresente, "ja_agendou">[]): number {
  return leads.filter((l) => l.ja_agendou === true).length;
}

export function contarAteOFim(
  leads: readonly Pick<LeadPresente, "minutos_assistidos" | "percentual_assistido">[],
): number {
  return leads.filter(ficouAteOFim).length;
}

// ---------------------------------------------------------------------------
// Filtro client-side (preserva a ordem do backend). `ja_agendou` NÃO filtra.
// ---------------------------------------------------------------------------

export type FiltroPresentes = {
  tiers: readonly TierChave[];
  donos?: readonly string[];
  // Só quem ficou até o fim (percentual ≥ 70% ou MINUTOS_DESTAQUE minutos).
  soAteOFim?: boolean;
  busca: string;
};

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function filtrarPresentes(leads: LeadPresente[], f: FiltroPresentes): LeadPresente[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (f.soAteOFim && !ficouAteOFim(l)) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// CSV — separador ";" com aspas escapadas, 13 colunas fixas.
export function csvDePresentes(leads: LeadPresente[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "dono",
    "etapa",
    "percentual_assistido",
    "minutos_assistidos",
    "ja_agendou",
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
      nomeDono(l.dono),
      l.etapa ?? "",
      l.percentual_assistido == null ? "" : String(l.percentual_assistido),
      l.minutos_assistidos == null ? "" : String(l.minutos_assistidos),
      l.ja_agendou ? "sim" : "",
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
