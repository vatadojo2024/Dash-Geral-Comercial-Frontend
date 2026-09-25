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
import type { FiltroAgendou } from "./presentesSemAplicar";

// ---------------------------------------------------------------------------
// Recorte "Não participaram — Qualificados" (Oportunidades do Evento). Fonte:
// GET /api/eventos/ausentes?de&ate — espelho de "Presentes que não aplicaram":
// inscritos MQL+ ou acima (tier_rank >= 2) SEM nenhum sinal de presença ao
// vivo. QC e negócio em "Desqualificado" saem da base. Garantias do backend:
// presentes + ausentes = inscritos; ninguém aparece aqui e em
// /presentes-sem-aplicar ao mesmo tempo.
//   - ordem: tier desc → quem viu o replay primeiro → nome asc (mantida aqui);
//   - `viu_replay` (acessou OU assistiu) é o ausente com interesse comprovado:
//     ganha destaque na tabela;
//   - `por_dono[].pendentes` = ausentes do dono (nome herdado);
//   - sem percentual_assistido/minutos_assistidos: seriam sempre null.
// ---------------------------------------------------------------------------

export const LeadAusenteSchema = LeadPendenteSchema;
export type LeadAusente = LeadPendente;

export const AusentesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int().nullish(),
      presentes: z.number().int().nullish(),
      ausentes: z.number().int().nullish(),
      // Tamanho da lista.
      qualificados_ausentes: z.number().int(),
      viram_replay: z.number().int().nullish(),
      ja_agendaram: z.number().int().nullish(),
    })
    .passthrough(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadAusenteSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type AusentesResponse = z.infer<typeof AusentesResponseSchema>;
export type TotaisAusentes = AusentesResponse["totais"];

// `viu_replay` pronto do backend; sem ele, deriva de acessou/assistiu.
export function viuReplay(
  lead: Pick<LeadAusente, "viu_replay" | "acessou_replay" | "assistiu_replay">,
): boolean {
  if (lead.viu_replay != null) return lead.viu_replay;
  return lead.acessou_replay === true || lead.assistiu_replay === true;
}

export function contarViramReplay(
  leads: readonly Pick<LeadAusente, "viu_replay" | "acessou_replay" | "assistiu_replay">[],
): number {
  return leads.filter(viuReplay).length;
}

// Funil: Inscritos → Não participaram (dos inscritos) → Qualificados (dos que
// não participaram) → Viram o replay (dos qualificados ausentes; só quando o
// backend manda o total).
export function blocosAusentes(t: TotaisAusentes): BlocoFunil[] {
  const inscritos = t.inscritos ?? 0;
  const ausentes = t.ausentes ?? 0;
  const blocos: BlocoFunil[] = [
    { chave: "inscritos", rotulo: "Inscritos", valor: inscritos, passagem: null },
    { chave: "ausentes", rotulo: "Não participaram", valor: ausentes, passagem: passagemCalculada(ausentes, inscritos) },
    {
      chave: "qualificados_ausentes",
      rotulo: "Qualificados (MQL+ ou acima)",
      valor: t.qualificados_ausentes,
      passagem: passagemCalculada(t.qualificados_ausentes, ausentes),
      baseDaPassagem: "dos que não participaram",
    },
  ];
  if (t.viram_replay != null) {
    blocos.push({
      chave: "viram_replay",
      rotulo: "Viram o replay",
      valor: t.viram_replay,
      passagem: passagemCalculada(t.viram_replay, t.qualificados_ausentes),
      baseDaPassagem: "dos qualificados ausentes",
    });
  }
  return blocos;
}

// ---------------------------------------------------------------------------
// Filtro client-side (ordem do backend preservada).
// ---------------------------------------------------------------------------

export type FiltroAusentes = {
  tiers: readonly TierChave[];
  donos?: readonly string[];
  // Só quem viu o replay (acessou ou assistiu).
  soViuReplay?: boolean;
  agendou?: FiltroAgendou;
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

export function filtrarAusentes(leads: LeadAusente[], f: FiltroAusentes): LeadAusente[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (f.soViuReplay && !viuReplay(l)) return false;
    if (f.agendou === "sim" && l.ja_agendou !== true) return false;
    if (f.agendou === "nao" && l.ja_agendou === true) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// CSV — separador ";" com aspas escapadas, 14 colunas fixas.
export function csvDeAusentes(leads: LeadAusente[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "dono",
    "etapa",
    "viu_replay",
    "aplicou_replay",
    "resgate",
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
      viuReplay(l) ? "sim" : "",
      l.aplicou_replay ? "sim" : "",
      l.convidado_resgate ? "sim" : "",
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
