import { z } from "zod";
import { DonoAgregadoSchema, LeadPendenteSchema, chaveDono, nomeDono, tierDoLead } from "./oportunidades";

// ---------------------------------------------------------------------------
// Recorte "Abordagem" (Oportunidades do Evento). Fonte: GET
// /api/eventos/abordagem?de&ate. O estado da abordagem é a COLUNA do card na
// Clint: "Sem atendimento" = não abordado; "Prospecção" = abordado sem
// resposta; "Em qualificação"/"Qualificado" = respondeu; qualquer outra =
// `outra` (NÃO conta como respondeu — decisão do Vata, 06/10). "Base" fica fora
// da aba (`fora_da_aba`). Lead sem negócio cai em `outra`.
//
// A IMPRECISÃO, o ponto central da tela: a Clint guarda a coluna de HOJE e a
// data da última mudança, não a coluna do dia do webinar. Cada indicador vem
// partido em `antes` (o card não se move desde antes do evento: certeza) e
// `depois` + `sem_informacao` (sabemos onde está hoje, não onde estava no
// dia). REGRA DE OURO: nunca somar os dois sob o rótulo "antes do evento".
//
// Indicadores (mesma regra do backend, para filtrar a lista do MESMO payload):
//   - responderam: grupo "respondeu" (sem exigir presença);
//   - abordados_compareceram: grupo ≠ "nao_abordado" E presente ao vivo;
//   - sem_resposta_compareceram: grupo "sem_resposta" E presente ao vivo.
// Presença = tag de tempo ou "Participou" (`assistiu_ao_vivo`); a tag "Pós" é
// aplicação, nunca presença.
// ---------------------------------------------------------------------------

export const GRUPOS_ABORDAGEM = ["nao_abordado", "sem_resposta", "respondeu", "outra"] as const;
export type GrupoAbordagem = (typeof GRUPOS_ABORDAGEM)[number];
export type MomentoAbordagem = "antes" | "depois" | "sem_informacao";

export const ROTULO_GRUPO: Record<GrupoAbordagem, string> = {
  nao_abordado: "Não abordado",
  sem_resposta: "Abordado, sem resposta",
  respondeu: "Respondeu",
  outra: "Outra coluna",
};

// Tolerante: valor desconhecido vira `outra` / `sem_informacao` (nunca derruba a aba).
export function grupoDe(v: unknown): GrupoAbordagem {
  return (GRUPOS_ABORDAGEM as readonly string[]).includes(v as string) ? (v as GrupoAbordagem) : "outra";
}
export function momentoDe(v: unknown): MomentoAbordagem {
  return v === "antes" || v === "depois" ? v : "sem_informacao";
}

const GrupoSchema = z.unknown().transform(grupoDe);
const MomentoSchema = z.unknown().transform(momentoDe);

export const LeadAbordagemSchema = LeadPendenteSchema.extend({
  grupo: GrupoSchema,
  momento: MomentoSchema,
  // Quando o card mudou de coluna pela última vez (`updated_stage_at`).
  movido_em: z.string().nullish(),
});
export type LeadAbordagem = z.infer<typeof LeadAbordagemSchema>;

export const IndicadorSchema = z.object({
  antes: z.number().int(),
  depois: z.number().int(),
  sem_informacao: z.number().int().default(0),
  total: z.number().int(),
});
export type Indicador = z.infer<typeof IndicadorSchema>;

export const EtapaAbordagemSchema = z.object({
  etapa: z.string().nullable(),
  grupo: GrupoSchema,
  total: z.number().int(),
  presentes: z.number().int().default(0),
});
export type EtapaAbordagem = z.infer<typeof EtapaAbordagemSchema>;

export const AbordagemResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  hora_do_evento_br: z.number().nullish(),
  cortes: z.array(z.object({ evento: z.string(), corte: z.string() })).nullish(),
  indicadores: z.object({
    responderam: IndicadorSchema,
    abordados_compareceram: IndicadorSchema,
    sem_resposta_compareceram: IndicadorSchema,
  }),
  totais: z
    .object({
      inscritos: z.number().int(),
      nao_abordados: z.number().int(),
      sem_resposta: z.number().int(),
      responderam: z.number().int(),
      outras_etapas: z.number().int(),
      fora_da_aba: z.number().int().default(0),
      presentes_ao_vivo: z.number().int(),
      desqualificados: z.number().int().nullish(),
      perdidos: z.number().int().nullish(),
    })
    .passthrough(),
  por_etapa: z.array(EtapaAbordagemSchema).default([]),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadAbordagemSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type AbordagemResponse = z.infer<typeof AbordagemResponseSchema>;
export type TotaisAbordagem = AbordagemResponse["totais"];

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export type ChaveIndicador = "responderam" | "abordados_compareceram" | "sem_resposta_compareceram";

// O cinza do card: quem está na situação hoje mas pode não estar no dia do evento.
export function semComoConfirmar(ind: Indicador): number {
  return ind.depois + ind.sem_informacao;
}

export function esteveAoVivo(lead: Pick<LeadAbordagem, "assistiu_ao_vivo">): boolean {
  return lead.assistiu_ao_vivo === true;
}

export function noIndicador(lead: LeadAbordagem, indicador: ChaveIndicador): boolean {
  if (indicador === "responderam") return lead.grupo === "respondeu";
  if (indicador === "abordados_compareceram") return lead.grupo !== "nao_abordado" && esteveAoVivo(lead);
  return lead.grupo === "sem_resposta" && esteveAoVivo(lead);
}

// Texto do balão (fornecido pelo backend/Vata, 06/10 — usar literalmente).
export const TEXTO_IMPRECISAO =
  "A Clint registra em que coluna o lead está hoje, não em que coluna ele estava no dia do webinar. " +
  "Quando o card não se move desde antes do evento, sabemos com certeza. Quando ele se moveu depois, " +
  "sabemos onde está hoje mas não onde estava naquele dia — essas pessoas aparecem separadas, em cinza. " +
  "Não é dado faltando: é o que o CRM permite saber.";

// ---------------------------------------------------------------------------
// Proporção: nao_abordados + sem_resposta + responderam + outras_etapas +
// fora_da_aba = inscritos; presentes_ao_vivo = Σ por_etapa.presentes.
// ---------------------------------------------------------------------------

export type ChaveFatia = "nao_abordados" | "sem_resposta" | "responderam" | "outras_etapas" | "fora_da_aba";
export type FatiaAbordagem = { chave: ChaveFatia; rotulo: string; valor: number; pct: number };

export function proporcaoAbordagem(t: TotaisAbordagem): { fatias: FatiaAbordagem[]; fechaConta: boolean } {
  const partes: [ChaveFatia, string, number][] = [
    ["nao_abordados", "Não abordados (Sem atendimento)", t.nao_abordados],
    ["sem_resposta", "Abordados sem resposta (Prospecção)", t.sem_resposta],
    ["responderam", "Responderam (Em qualificação / Qualificado)", t.responderam],
    ["outras_etapas", "Em outras colunas", t.outras_etapas],
    ["fora_da_aba", "Coluna Base (fora da aba)", t.fora_da_aba],
  ];
  const soma = partes.reduce((s, [, , v]) => s + v, 0);
  const base = t.inscritos || soma || 1;
  return {
    fatias: partes.map(([chave, rotulo, valor]) => ({ chave, rotulo, valor, pct: (valor / base) * 100 })),
    fechaConta: soma === t.inscritos,
  };
}

export function presentesFecham(t: TotaisAbordagem, porEtapa: readonly EtapaAbordagem[]): boolean {
  if (porEtapa.length === 0) return true;
  return porEtapa.reduce((s, e) => s + e.presentes, 0) === t.presentes_ao_vivo;
}

export function rotuloDaEtapaAbordagem(etapa: string | null | undefined): string {
  const e = etapa?.trim();
  return !e || e === "(sem negócio)" ? "Sem negócio na Clint" : e;
}

// ---------------------------------------------------------------------------
// Filtro client-side (ordem do backend preservada: presença → quanto assistiu →
// grupo → nome).
// ---------------------------------------------------------------------------

export type FiltroCerteza = "todos" | "confirmados" | "sem_confirmar";

export type FiltroAbordagem = {
  indicador?: ChaveIndicador | null;
  grupo?: GrupoAbordagem | null;
  certeza?: FiltroCerteza;
  soAoVivo?: boolean;
  donos?: readonly string[];
  busca: string;
};

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function filtrarAbordagem(leads: LeadAbordagem[], f: FiltroAbordagem): LeadAbordagem[] {
  const donos = new Set(f.donos ?? []);
  const termo = normalizar(f.busca);
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (f.indicador && !noIndicador(l, f.indicador)) return false;
    if (f.grupo && l.grupo !== f.grupo) return false;
    if (f.certeza === "confirmados" && l.momento !== "antes") return false;
    if (f.certeza === "sem_confirmar" && l.momento === "antes") return false;
    if (f.soAoVivo && !esteveAoVivo(l)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// Conta, na lista, quantos de um indicador estão confirmados × sem como
// confirmar — tem de bater com o card (trava de sanidade nos testes).
export function contarIndicador(leads: readonly LeadAbordagem[], indicador: ChaveIndicador) {
  const dele = leads.filter((l) => noIndicador(l, indicador));
  const antes = dele.filter((l) => l.momento === "antes").length;
  return { antes, semConfirmar: dele.length - antes, total: dele.length };
}

// CSV — separador ";" com aspas escapadas, como o das outras abas.
export function csvDeAbordagem(leads: LeadAbordagem[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "coluna",
    "grupo",
    "certeza",
    "movido_em",
    "esteve_ao_vivo",
    "percentual_assistido",
    "aplicou",
    "ja_agendou",
    "dono",
    "telefone",
    "email",
    "evento",
    "url_clint",
  ];
  const certeza: Record<MomentoAbordagem, string> = {
    antes: "confirmado (sem movimento desde antes do evento)",
    depois: "sem como confirmar (movido no dia do evento ou depois)",
    sem_informacao: "sem informação",
  };
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) =>
    [
      l.nome,
      tierDoLead(l).label,
      rotuloDaEtapaAbordagem(l.etapa),
      ROTULO_GRUPO[l.grupo],
      certeza[l.momento],
      l.movido_em ?? "",
      esteveAoVivo(l) ? "sim" : "",
      l.percentual_assistido == null ? "" : String(l.percentual_assistido),
      l.aplicou ? "sim" : "",
      l.ja_agendou ? "sim" : "",
      nomeDono(l.dono),
      l.telefone ?? "",
      l.email ?? "",
      l.evento_tag ?? "",
      l.url_clint ?? "",
    ]
      .map(celula)
      .join(";"),
  );
  return [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}
