import { z } from "zod";
import {
  DonoAgregadoSchema,
  LeadPendenteSchema,
  chaveDono,
  nomeDono,
  tierDoLead,
  type LeadPendente,
  type TierChave,
} from "./oportunidades";

// ---------------------------------------------------------------------------
// Lista COMPLETA dos inscritos do ciclo (Visão geral de Oportunidades do Evento).
// CONTRATO PROVISÓRIO (23/09): GET /api/eventos/inscritos?de&ate — um lead por
// (contato, evento) com a tag WG, QUALQUER classificação (não só quem levantou
// a mão), e os sinais do ciclo como booleanos. O que o backend ainda não manda
// simplesmente não aparece: todo sinal é opcional.
//
//   sinais por lead: assistiu_ao_vivo · aplicou (tag Pós WG, qualquer caminho)
//   · aplicou_ao_vivo (Pós sem tag de replay) · aplicou_replay (pela gravação)
//   · levantou_mao (tag Levantou a Mão) · ja_agendou · acessou_replay ·
//   assistiu_replay · convidado_resgate · etapa ("Sem atendimento" = ninguém
//   abordou) · percentual_assistido / minutos_assistidos.
// Ordem do backend mantida (sugestão: tier desc, presença desc, nome asc).
// ---------------------------------------------------------------------------

export const LeadInscritoSchema = LeadPendenteSchema;
export type LeadInscrito = LeadPendente;

export const InscritosResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int(),
      presentes: z.number().int().nullish(),
      aplicaram: z.number().int().nullish(),
      levantaram_mao: z.number().int().nullish(),
      agendaram: z.number().int().nullish(),
      sem_atendimento: z.number().int().nullish(),
    })
    .passthrough(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadInscritoSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type InscritosResponse = z.infer<typeof InscritosResponseSchema>;

// ---------------------------------------------------------------------------
// Sinais do inscrito no ciclo (chips de filtro e coluna "Sinais" da tabela).
// ---------------------------------------------------------------------------

export type SinalChave =
  | "presente"
  | "aplicou"
  | "aplicou_ao_vivo"
  | "aplicou_replay"
  | "levantou"
  | "agendou"
  | "replay"
  | "resgate"
  | "sem_atendimento";

export type SinalConfig = { chave: SinalChave; label: string; curto: string; classe: string };

// Ordem = ordem do funil. Classes por token do tema (nenhuma cor solta).
export const SINAIS: readonly SinalConfig[] = [
  { chave: "presente", label: "Presente ao vivo", curto: "Ao vivo", classe: "border-violeta/60 bg-violeta/15 text-violeta" },
  { chave: "aplicou", label: "Aplicou (qualquer caminho)", curto: "Aplicou", classe: "border-teal/60 bg-teal/15 text-teal" },
  { chave: "aplicou_ao_vivo", label: "Aplicou ao vivo", curto: "Aplicou ao vivo", classe: "border-teal/60 bg-teal/25 text-teal" },
  { chave: "aplicou_replay", label: "Aplicou pelo replay", curto: "Aplicou pelo replay", classe: "border-info-forte/60 bg-info-forte/25 text-info" },
  { chave: "levantou", label: "Levantou a mão", curto: "Levantou a mão", classe: "border-azul/60 bg-azul/15 text-azul-claro" },
  { chave: "agendou", label: "Agendou call", curto: "Agendou", classe: "border-verde/60 bg-verde/15 text-verde" },
  { chave: "replay", label: "Acessou o replay", curto: "Replay", classe: "border-info-forte/60 bg-info-forte/15 text-info" },
  { chave: "resgate", label: "Convidado de resgate", curto: "Resgate", classe: "border-laranja/60 bg-laranja/15 text-laranja" },
  { chave: "sem_atendimento", label: "Sem atendimento", curto: "Sem atendimento", classe: "border-rosa/60 bg-rosa/15 text-rosa" },
];

export function temSinal(lead: LeadInscrito, sinal: SinalChave): boolean {
  switch (sinal) {
    case "presente":
      return lead.assistiu_ao_vivo === true;
    case "aplicou":
      // `aplicou` pronto do backend; sem ele, qualquer um dos dois caminhos.
      return lead.aplicou ?? (lead.aplicou_ao_vivo === true || lead.aplicou_replay === true);
    case "aplicou_ao_vivo":
      return lead.aplicou_ao_vivo === true;
    case "aplicou_replay":
      return lead.aplicou_replay === true;
    case "levantou":
      return lead.levantou_mao === true;
    case "agendou":
      return lead.ja_agendou === true;
    case "replay":
      return lead.acessou_replay === true || lead.assistiu_replay === true;
    case "resgate":
      return lead.convidado_resgate === true;
    case "sem_atendimento":
      return (lead.etapa ?? "").trim().toLowerCase() === "sem atendimento";
  }
}

export function sinaisDoInscrito(lead: LeadInscrito): SinalConfig[] {
  return SINAIS.filter((s) => temSinal(lead, s.chave));
}

export function contarSinais(leads: readonly LeadInscrito[]): Record<SinalChave, number> {
  const c = Object.fromEntries(SINAIS.map((s) => [s.chave, 0])) as Record<SinalChave, number>;
  for (const l of leads) for (const s of SINAIS) if (temSinal(l, s.chave)) c[s.chave] += 1;
  return c;
}

// ---------------------------------------------------------------------------
// Filtro client-side (ordem do backend preservada). Sinais selecionados são
// TODOS exigidos (E): "presente + sem atendimento" = esteve ao vivo e ninguém
// abordou.
// ---------------------------------------------------------------------------

export type FiltroInscritos = {
  tiers: readonly TierChave[];
  donos?: readonly string[];
  sinais?: readonly SinalChave[];
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

export function filtrarInscritos(leads: LeadInscrito[], f: FiltroInscritos): LeadInscrito[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const sinais = f.sinais ?? [];
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (sinais.length > 0 && !sinais.every((s) => temSinal(l, s))) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// CSV — separador ";" com aspas escapadas; um "sim" por sinal (19 colunas).
export function csvDeInscritos(leads: LeadInscrito[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "dono",
    "etapa",
    "presente_ao_vivo",
    "aplicou",
    "aplicou_ao_vivo",
    "aplicou_replay",
    "levantou_mao",
    "agendou",
    "replay",
    "resgate",
    "percentual_assistido",
    "telefone",
    "email",
    "evento",
    "entrou_em",
    "url_clint",
    "tags",
  ];
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const sim = (l: LeadInscrito, s: SinalChave) => (temSinal(l, s) ? "sim" : "");
  const linhas = leads.map((l) =>
    [
      l.nome,
      tierDoLead(l).label,
      nomeDono(l.dono),
      l.etapa ?? "",
      sim(l, "presente"),
      sim(l, "aplicou"),
      sim(l, "aplicou_ao_vivo"),
      sim(l, "aplicou_replay"),
      sim(l, "levantou"),
      sim(l, "agendou"),
      sim(l, "replay"),
      sim(l, "resgate"),
      l.percentual_assistido == null ? "" : String(l.percentual_assistido),
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
