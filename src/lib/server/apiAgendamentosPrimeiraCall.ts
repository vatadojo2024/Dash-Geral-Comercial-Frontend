import { z } from "zod";
import {
  AgendamentoPrimeiraCallSchema,
  diaDeDataBr,
  ordenarPorCall,
  partesBR,
  type AgendamentoPrimeiraCall,
  type AgendamentosPrimeiraCallResponse,
} from "@/lib/agendamentos/primeiraCall";

// ---------------------------------------------------------------------------
// Adapter do GET /api/agendamentos/primeira-call REAL → contrato do app
// (mesmo padrão de apiLeads.ts / apiLeadDetail.ts). A API responde
//   { de, ate, total, agendamentos: [...], gerado_em }
// Tolerância ITEM A ITEM: cada agendamento é validado isoladamente — um item
// fora do formato é logado (server-side) e descartado, NUNCA derruba a fila.
// Só `evento_id` e `call_at` (data-hora válida) são obrigatórios; o resto vira
// null quando falta. `data_br`/`hora_br` vêm prontos da API; se faltarem, são
// derivados de `call_at` no fuso de Brasília.
// ---------------------------------------------------------------------------

const ROTA = "[/api/agendamentos/primeira-call]";

// Texto opcional: string vazia vira "ausente".
const texto = z
  .string()
  .nullish()
  .transform((v) => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  });

const ApiAgendamentoSchema = z.object({
  evento_id: z.string().min(1),
  call_at: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), "call_at não é uma data-hora válida"),
  data_br: texto,
  hora_br: texto,
  deal_id: texto,
  lead_id: texto,
  closer_id: texto,
  closer_nome: texto,
  lead_nome: texto,
  lead_email: texto,
  lead_telefone: texto,
  urgencia: texto,
  sdr_nome: texto,
  link_call: texto,
  patrimonio: texto,
  renda: texto,
  produto_indicado: texto,
  produto_variante: texto,
  link_crm: texto,
  etapa_atual: texto,
  agendado_em: texto,
});
type ApiAgendamento = z.infer<typeof ApiAgendamentoSchema>;

const ApiEnvelopeSchema = z.object({
  de: z.string().nullish(),
  ate: z.string().nullish(),
  // Validado item a item depois.
  agendamentos: z.array(z.unknown()),
  gerado_em: z.string().nullish(),
});

function issues(erro: z.ZodError): string {
  return erro.issues.map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`).join("; ");
}

function mapear(api: ApiAgendamento): AgendamentoPrimeiraCall | null {
  const derivado = partesBR(api.call_at);
  const dia = diaDeDataBr(api.data_br) ?? derivado?.dia ?? null;
  const horaOk = api.hora_br && /^\d{2}:\d{2}$/.test(api.hora_br) ? api.hora_br : null;
  if (!dia || !derivado) return null;
  return {
    evento_id: api.evento_id,
    deal_id: api.deal_id,
    lead_id: api.lead_id,
    closer_id: api.closer_id,
    closer_nome: api.closer_nome,
    lead_nome: api.lead_nome,
    lead_email: api.lead_email,
    lead_telefone: api.lead_telefone,
    call_at: api.call_at,
    data_br: diaDeDataBr(api.data_br) ? (api.data_br as string) : derivado.dataBr,
    hora_br: horaOk ?? derivado.horaBr,
    dia,
    urgencia: api.urgencia,
    sdr_nome: api.sdr_nome,
    link_call: api.link_call,
    patrimonio: api.patrimonio,
    renda: api.renda,
    produto_indicado: api.produto_indicado,
    produto_variante: api.produto_variante,
    link_crm: api.link_crm,
    etapa_atual: api.etapa_atual,
    agendado_em: api.agendado_em,
  };
}

export type AdaptAgendamentosResult =
  | { ok: true; resposta: AgendamentosPrimeiraCallResponse }
  | { ok: false; motivo: string };

/**
 * Converte o corpo (JSON já parseado) da API real para o contrato do app.
 * Loga no console do servidor o motivo exato de cada item descartado e de um
 * envelope inválido — diagnóstico sem mascarar.
 */
export function adaptApiAgendamentosPrimeiraCall(corpo: unknown): AdaptAgendamentosResult {
  const envelope = ApiEnvelopeSchema.safeParse(corpo);
  if (!envelope.success) {
    const motivo = `envelope inesperado (esperado { agendamentos: [...] }): ${issues(envelope.error)}`;
    console.error(`${ROTA} api 200 fora do contrato:`, motivo);
    return { ok: false, motivo };
  }

  const itens: AgendamentoPrimeiraCall[] = [];
  let descartados = 0;
  envelope.data.agendamentos.forEach((bruto, idx) => {
    const parsed = ApiAgendamentoSchema.safeParse(bruto);
    if (!parsed.success) {
      descartados += 1;
      console.error(
        `${ROTA} agendamento #${idx} descartado (fora do contrato):`,
        issues(parsed.error),
        "| recebido:",
        bruto,
      );
      return;
    }
    const mapeado = mapear(parsed.data);
    // Cinto de segurança: o item mapeado tem de satisfazer o contrato do app.
    const contrato = mapeado ? AgendamentoPrimeiraCallSchema.safeParse(mapeado) : null;
    if (!contrato || !contrato.success) {
      descartados += 1;
      console.error(
        `${ROTA} agendamento #${idx} (evento_id=${parsed.data.evento_id}) falhou no contrato do app após mapeamento:`,
        contrato && !contrato.success ? issues(contrato.error) : "data da call ilegível",
      );
      return;
    }
    itens.push(contrato.data);
  });

  const agendamentos = ordenarPorCall(itens);
  return {
    ok: true,
    resposta: {
      de: envelope.data.de ?? null,
      ate: envelope.data.ate ?? null,
      total: agendamentos.length,
      descartados,
      agendamentos,
      gerado_em: envelope.data.gerado_em ?? new Date().toISOString(),
    },
  };
}
