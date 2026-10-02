import { z } from "zod";
import { DonoAgregadoSchema, LeadPendenteSchema, chaveDono, nomeDono, type LeadPendente } from "./oportunidades";
import type { FiltroAgendou } from "./presentesSemAplicar";

// ---------------------------------------------------------------------------
// Recorte "Incógnitas" (Oportunidades do Evento). Fonte: GET
// /api/eventos/incognitas?de&ate — inscritos do evento SEM NENHUMA tag de
// classificação (nem escala MQL, nem Ninja, nem QC). Pergunta: de quantos
// inscritos não sabemos a qualificação?
//
// NÃO É "Não abordados": lá é quem está em "Sem atendimento" (ninguém
// procurou); aqui é quem está sem classificação, procurado ou não. Os dois se
// cruzam só em parte — `totais.sem_atendimento` é esse cruzamento, e a tela o
// mostra para os números não parecerem brigar.
//
// Regras do contrato (backend, 01/10):
//   - `tier` vem SEMPRE null e não vem `tier_rank`: nada de badge de
//     classificação nesta aba;
//   - `respondeu_pesquisa` é o coração: true = a resposta existe e a
//     classificação não saiu (falha de etiquetagem, resolvível hoje); false =
//     nunca respondeu (só sai perguntando);
//   - ordem pronta (pesquisa desc → ao vivo desc → % assistido desc → nome):
//     NÃO reordenar;
//   - classificados + qc + incognitas = inscritos (a barra de proporção);
//   - `por_etapa`: maior primeiro, `etapa: null` (sem negócio) sempre por último;
//   - `por_dono[].alto_valor` é sempre 0 por definição: não desenhar.
// ---------------------------------------------------------------------------

export const LeadIncognitoSchema = LeadPendenteSchema.extend({
  respondeu_pesquisa: z.boolean().nullish(),
});
export type LeadIncognito = z.infer<typeof LeadIncognitoSchema>;

export const PorEtapaSchema = z.object({ etapa: z.string().nullable(), total: z.number().int() });
export type PorEtapa = z.infer<typeof PorEtapaSchema>;

export const IncognitasResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int(),
      classificados: z.number().int().nullish(),
      qc: z.number().int().nullish(),
      // Tamanho da lista.
      incognitas: z.number().int(),
      responderam_pesquisa: z.number().int().nullish(),
      nao_responderam: z.number().int().nullish(),
      presentes_ao_vivo: z.number().int().nullish(),
      aplicaram: z.number().int().nullish(),
      // Cruzamento com a aba "Não abordados".
      sem_atendimento: z.number().int().nullish(),
      ja_agendaram: z.number().int().nullish(),
      desqualificados: z.number().int().nullish(),
      perdidos: z.number().int().nullish(),
    })
    .passthrough(),
  por_etapa: z.array(PorEtapaSchema).nullish(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadIncognitoSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type IncognitasResponse = z.infer<typeof IncognitasResponseSchema>;
export type TotaisIncognitas = IncognitasResponse["totais"];

// Aceita qualquer lead (o painel lateral recebe o tipo genérico das abas): o
// campo só existe na resposta de /incognitas.
export function respondeuPesquisa(lead: object): boolean {
  return (lead as { respondeu_pesquisa?: unknown }).respondeu_pesquisa === true;
}

export function esteveAoVivo(lead: Pick<LeadPendente, "assistiu_ao_vivo" | "percentual_assistido">): boolean {
  return lead.assistiu_ao_vivo === true || (lead.percentual_assistido ?? 0) > 0;
}

// Etapa sem negócio na Clint (`etapa: null`) tem nome na tela.
export const ROTULO_SEM_NEGOCIO = "Sem negócio na Clint";
export const ETAPA_SEM_ATENDIMENTO = "Sem atendimento";

export function rotuloDaEtapa(etapa: string | null | undefined): string {
  return etapa?.trim() ? etapa : ROTULO_SEM_NEGOCIO;
}

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function ehSemAtendimento(etapa: string | null | undefined): boolean {
  return normalizar(etapa) === normalizar(ETAPA_SEM_ATENDIMENTO);
}

// ---------------------------------------------------------------------------
// Proporção da audiência: classificados + QC + incógnitas = inscritos.
// ---------------------------------------------------------------------------

export type FatiaAudiencia = { chave: "classificados" | "qc" | "incognitas"; rotulo: string; valor: number; pct: number };

export function proporcaoDaAudiencia(t: TotaisIncognitas): { fatias: FatiaAudiencia[]; fechaConta: boolean } {
  const classificados = t.classificados ?? 0;
  const qc = t.qc ?? 0;
  const soma = classificados + qc + t.incognitas;
  const base = t.inscritos || soma || 1;
  const fatia = (chave: FatiaAudiencia["chave"], rotulo: string, valor: number): FatiaAudiencia => ({
    chave,
    rotulo,
    valor,
    pct: (valor / base) * 100,
  });
  return {
    fatias: [
      fatia("classificados", "Classificados (MQL ou Ninja)", classificados),
      fatia("qc", "Trilha QC", qc),
      fatia("incognitas", "Incógnitas", t.incognitas),
    ],
    // Só confere quando o backend mandou as três partes.
    fechaConta: t.classificados == null || t.qc == null || soma === t.inscritos,
  };
}

// ---------------------------------------------------------------------------
// Etapas: a maior (o gargalo) × "Sem atendimento" (o cruzamento com "Não
// abordados"). A ordem do backend é mantida.
// ---------------------------------------------------------------------------

export function leituraDasEtapas(porEtapa: readonly PorEtapa[]): {
  maior: PorEtapa | null;
  semAtendimento: number;
} {
  const comNegocio = porEtapa.filter((e) => e.etapa != null);
  const maior = comNegocio.reduce<PorEtapa | null>((m, e) => (!m || e.total > m.total ? e : m), null);
  const semAtendimento = porEtapa.filter((e) => ehSemAtendimento(e.etapa)).reduce((s, e) => s + e.total, 0);
  return { maior, semAtendimento };
}

// ---------------------------------------------------------------------------
// Filtro client-side (ordem do backend preservada).
// ---------------------------------------------------------------------------

export type FiltroPesquisa = "todos" | "respondeu" | "nao_respondeu";

export type FiltroIncognitas = {
  pesquisa?: FiltroPesquisa;
  soAoVivo?: boolean;
  agendou?: FiltroAgendou;
  donos?: readonly string[];
  busca: string;
};

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function filtrarIncognitas(leads: LeadIncognito[], f: FiltroIncognitas): LeadIncognito[] {
  const donos = new Set(f.donos ?? []);
  const termo = normalizar(f.busca);
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (f.pesquisa === "respondeu" && !respondeuPesquisa(l)) return false;
    if (f.pesquisa === "nao_respondeu" && respondeuPesquisa(l)) return false;
    if (f.soAoVivo && !esteveAoVivo(l)) return false;
    if (f.agendou === "sim" && l.ja_agendou !== true) return false;
    if (f.agendou === "nao" && l.ja_agendou === true) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// Os dois grupos de ação, na ordem do backend dentro de cada um.
export function separarPorPesquisa(leads: readonly LeadIncognito[]): {
  responderam: LeadIncognito[];
  nunca: LeadIncognito[];
} {
  return {
    responderam: leads.filter(respondeuPesquisa),
    nunca: leads.filter((l) => !respondeuPesquisa(l)),
  };
}

// CSV — separador ";" com aspas escapadas, como o das outras abas.
export function csvDeIncognitas(leads: LeadIncognito[]): string {
  const cabecalho = [
    "nome",
    "respondeu_pesquisa",
    "etapa",
    "dono",
    "esteve_ao_vivo",
    "percentual_assistido",
    "aplicou",
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
      respondeuPesquisa(l) ? "sim" : "nao",
      rotuloDaEtapa(l.etapa),
      nomeDono(l.dono),
      esteveAoVivo(l) ? "sim" : "",
      l.percentual_assistido == null ? "" : String(l.percentual_assistido),
      l.aplicou ? "sim" : "",
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
