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
// Recorte "Não abordados" da aba Oportunidades do Evento. Fonte PRÓPRIA:
// GET /api/eventos/nao-abordados?de&ate — contato inscrito no evento (tag WG)
// cujo negócio mais recente está na etapa "Sem atendimento". Uma linha por
// (contato, evento). É OUTRA população (não é subconjunto dos pendentes que
// levantaram a mão), por isso não deriva da resposta de /oportunidades.
//
// Regras do contrato (backend, 22/09):
//   - ordem já vem pronta (tier desc, evento desc, nome asc) — NÃO reordenar;
//   - sem paginação;
//   - `por_dono[].pendentes` é a contagem de não abordados (nome herdado);
//   - `lead_id` quase sempre null (o lead só nasce no Mapa quando muda de etapa);
//   - `tier` costuma ser null — o que prioriza aqui é `stage_desde` (há quanto
//     tempo o negócio está parado);
//   - `url_clint` vem montada; nunca concatenar URL no front.
// ---------------------------------------------------------------------------

// Mesmo lead da aba (o schema já aceita `stage_desde`, opcional): os componentes
// de tabela, cards e painel lateral servem sem adaptação.
export const LeadNaoAbordadoSchema = LeadPendenteSchema;
export type LeadNaoAbordado = LeadPendente;

export const NaoAbordadosResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      inscritos: z.number().int().nullish(),
      nao_abordados: z.number().int(),
      // Trilha QC, fora do recorte (só conferência, como na outra aba).
      qc: z.number().int().nullish(),
    })
    .passthrough(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  leads: z.array(LeadNaoAbordadoSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type NaoAbordadosResponse = z.infer<typeof NaoAbordadosResponseSchema>;

// ---------------------------------------------------------------------------
// Tempo parado em "Sem atendimento" (o campo que prioriza este recorte).
// ---------------------------------------------------------------------------

// A partir de quantos dias parado o lead vira alerta (chip e cor na tabela).
export const DIAS_PARADO_ALERTA = 3;

const MS_DIA = 86_400_000;

// Dias inteiros desde `stage_desde`; null quando o campo falta ou é inválido.
// Data no futuro (relógio do servidor à frente) conta como zero, nunca negativo.
export function diasParado(
  lead: Pick<LeadNaoAbordado, "stage_desde">,
  agora: Date = new Date(),
): number | null {
  if (!lead.stage_desde) return null;
  const t = Date.parse(lead.stage_desde);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / MS_DIA));
}

export function paradoHaMais(
  lead: Pick<LeadNaoAbordado, "stage_desde">,
  dias: number = DIAS_PARADO_ALERTA,
  agora: Date = new Date(),
): boolean {
  const d = diasParado(lead, agora);
  return d != null && d >= dias;
}

export function contarParados(
  leads: readonly Pick<LeadNaoAbordado, "stage_desde">[],
  dias: number = DIAS_PARADO_ALERTA,
  agora: Date = new Date(),
): number {
  return leads.filter((l) => paradoHaMais(l, dias, agora)).length;
}

// ---------------------------------------------------------------------------
// Funil do recorte: dois degraus (inscritos → não abordados). Não é conversão,
// é a fatia do evento que ninguém atendeu — a passagem é lida como "% dos
// inscritos".
// ---------------------------------------------------------------------------

export function blocosNaoAbordados(totais: NaoAbordadosResponse["totais"]): BlocoFunil[] {
  const inscritos = totais.inscritos ?? 0;
  return [
    { chave: "inscritos", rotulo: "Inscritos", valor: inscritos, passagem: null },
    {
      chave: "nao_abordados",
      rotulo: "Não abordados",
      valor: totais.nao_abordados,
      passagem: passagemCalculada(totais.nao_abordados, inscritos),
      baseDaPassagem: "dos inscritos",
    },
  ];
}

// ---------------------------------------------------------------------------
// Filtro client-side (a ordem do backend é preservada: filter mantém a ordem).
// ---------------------------------------------------------------------------

export type FiltroNaoAbordados = {
  tiers: readonly TierChave[];
  donos?: readonly string[];
  // Só quem está parado há DIAS_PARADO_ALERTA dias ou mais.
  soParados?: boolean;
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

export function filtrarNaoAbordados(
  leads: LeadNaoAbordado[],
  f: FiltroNaoAbordados,
  agora: Date = new Date(),
): LeadNaoAbordado[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (f.soParados && !paradoHaMais(l, DIAS_PARADO_ALERTA, agora)) return false;
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

// CSV do recorte — separador ";" com aspas escapadas, como o da outra aba.
// `parado_desde` é o ISO cru e `dias_parado` o número já calculado.
export function csvDeNaoAbordados(leads: LeadNaoAbordado[], agora: Date = new Date()): string {
  const cabecalho = [
    "nome",
    "mql",
    "dono",
    "etapa",
    "parado_desde",
    "dias_parado",
    "telefone",
    "email",
    "evento",
    "entrou_em",
    "url_clint",
    "tags",
  ];
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) => {
    const dias = diasParado(l, agora);
    return [
      l.nome,
      tierDoLead(l).label,
      nomeDono(l.dono),
      l.etapa ?? "",
      l.stage_desde ?? "",
      dias == null ? "" : String(dias),
      l.telefone ?? "",
      l.email ?? "",
      l.evento_tag ?? "",
      l.created_at ?? "",
      l.url_clint ?? "",
      (l.tags ?? []).join(", "),
    ]
      .map(celula)
      .join(";");
  });
  return [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}
