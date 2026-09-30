import { z } from "zod";
import { ItemHistoricoSchema, type HistoricoResponse, type ItemHistorico } from "@/lib/agendamentos/historico";
import { diaDeDataBr, partesBR } from "@/lib/agendamentos/primeiraCall";

// ---------------------------------------------------------------------------
// Adapter do GET /api/agendamentos/historico REAL → contrato do app (mesmo
// padrão de apiAgendamentosPrimeiraCall.ts). A API responde
//   { de, ate, total, retornados, proximo_cursor, agendamentos: [...], gerado_em }
// Tolerância ITEM A ITEM: um agendamento fora do formato é logado e descartado,
// nunca derruba o histórico. Só `agendado_em` (data-hora válida) é obrigatório.
// `agendado_em_br`/`call_br` vêm prontos em Brasília e são usados COMO VIERAM;
// só se faltarem (ou vierem ilegíveis) é que são derivados do ISO. A ordem é a
// da API — não reordena.
// ---------------------------------------------------------------------------

const ROTA = "[/api/agendamentos/historico]";

const texto = z
  .string()
  .nullish()
  .transform((v) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  });

const isoValido = (v: string) => !Number.isNaN(Date.parse(v));

const DataHoraBrSchema = z.object({ data: texto, hora: texto }).nullish();

const ApiItemSchema = z.object({
  agendado_em: z.string().min(1).refine(isoValido, "agendado_em não é uma data-hora válida"),
  agendado_em_br: DataHoraBrSchema,
  lead_id: texto,
  lead_nome: texto,
  lead_email: texto,
  lead_telefone: texto,
  closer_id: texto,
  closer_nome: texto,
  sdr_nome: texto,
  numero_call: z.number().nullish(),
  etapa: texto,
  call_at: texto,
  call_br: DataHoraBrSchema,
  urgencia: texto,
  link_call: texto,
  produto_indicado: texto,
  link_crm: texto,
});
type ApiItem = z.infer<typeof ApiItemSchema>;

const ApiEnvelopeSchema = z.object({
  de: z.string().nullish(),
  ate: z.string().nullish(),
  total: z.number().nullish(),
  retornados: z.number().nullish(),
  proximo_cursor: z.string().nullish(),
  agendamentos: z.array(z.unknown()),
  gerado_em: z.string().nullish(),
});

const NUMERO_POR_ETAPA: Record<string, number> = {
  "1a_call_agendada": 1,
  "2a_call_agendada": 2,
  "3a_call_agendada": 3,
  "4a_call_agendada": 4,
  "5a_mais_call_agendada": 5,
};

function issues(erro: z.ZodError): string {
  return erro.issues.map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`).join("; ");
}

const RE_HORA = /^\d{2}:\d{2}$/;

// Dia/hora em Brasília: o que a API mandou, se legível; senão, do ISO.
function dataHora(
  br: { data: string | null; hora: string | null } | null | undefined,
  iso: string | null,
): { data: string; hora: string; dia: string } | null {
  const dia = diaDeDataBr(br?.data);
  if (dia && br?.hora && RE_HORA.test(br.hora)) return { data: br.data as string, hora: br.hora, dia };
  if (!iso || !isoValido(iso)) return null;
  const p = partesBR(iso);
  return p ? { data: p.dataBr, hora: p.horaBr, dia: p.dia } : null;
}

function numeroDaCall(api: ApiItem): number | null {
  const n = api.numero_call;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1) return Math.min(n, 5);
  return api.etapa ? (NUMERO_POR_ETAPA[api.etapa] ?? null) : null;
}

function mapear(api: ApiItem): ItemHistorico | null {
  const agendado = dataHora(api.agendado_em_br, api.agendado_em);
  if (!agendado) return null;
  // Sem data da call: os campos da call ficam TODOS nulos (a tela mostra "sem data").
  const call = api.call_at && isoValido(api.call_at) ? dataHora(api.call_br, api.call_at) : null;
  return {
    id: [api.agendado_em, api.lead_id ?? "sem-lead", api.call_at ?? "sem-data", api.etapa ?? ""].join("|"),
    agendado_em: api.agendado_em,
    agendado_data: agendado.data,
    agendado_hora: agendado.hora,
    dia_agendamento: agendado.dia,
    lead_id: api.lead_id,
    lead_nome: api.lead_nome,
    lead_email: api.lead_email,
    lead_telefone: api.lead_telefone,
    closer_id: api.closer_id,
    closer_nome: api.closer_nome,
    sdr_nome: api.sdr_nome,
    numero_call: numeroDaCall(api),
    etapa: api.etapa,
    call_at: call ? api.call_at : null,
    call_data: call?.data ?? null,
    call_hora: call?.hora ?? null,
    dia_call: call?.dia ?? null,
    urgencia: api.urgencia,
    link_call: api.link_call,
    produto_indicado: api.produto_indicado,
    link_crm: api.link_crm,
  };
}

export type AdaptHistoricoResult = { ok: true; resposta: HistoricoResponse } | { ok: false; motivo: string };

export function adaptApiAgendamentosHistorico(corpo: unknown): AdaptHistoricoResult {
  const envelope = ApiEnvelopeSchema.safeParse(corpo);
  if (!envelope.success) {
    const motivo = `envelope inesperado (esperado { agendamentos: [...] }): ${issues(envelope.error)}`;
    console.error(`${ROTA} api 200 fora do contrato:`, motivo);
    return { ok: false, motivo };
  }

  const itens: ItemHistorico[] = [];
  let descartados = 0;
  envelope.data.agendamentos.forEach((bruto, idx) => {
    const parsed = ApiItemSchema.safeParse(bruto);
    const mapeado = parsed.success ? mapear(parsed.data) : null;
    const contrato = mapeado ? ItemHistoricoSchema.safeParse(mapeado) : null;
    if (!contrato?.success) {
      descartados += 1;
      console.error(
        `${ROTA} agendamento #${idx} descartado (fora do contrato):`,
        !parsed.success ? issues(parsed.error) : contrato ? issues(contrato.error) : "data do agendamento ilegível",
      );
      return;
    }
    itens.push(contrato.data);
  });

  const d = envelope.data;
  return {
    ok: true,
    resposta: {
      de: d.de ?? null,
      ate: d.ate ?? null,
      total: typeof d.total === "number" ? d.total : itens.length,
      retornados: itens.length,
      proximo_cursor: d.proximo_cursor ?? null,
      descartados,
      agendamentos: itens,
      gerado_em: d.gerado_em ?? new Date().toISOString(),
    },
  };
}
