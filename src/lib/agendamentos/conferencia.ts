import { z } from "zod";
import type { AgendamentoPrimeiraCall } from "./primeiraCall";

// ---------------------------------------------------------------------------
// Conferência da fila de Agendamentos com o Dashboard SDR (pedido Vata 29/09).
// A API do Dashboard Comercial (a MESMA do Dashboard SDR) só tem TOTAIS por dia
// e por closer — `/api/closer/agendadas` devolve { data_referencia, closer,
// total_agendadas } —, sem lead, horário, link ou urgência. Por isso a LISTA
// continua vindo do backend do Mapa de Calor (que tem os detalhes) e o total
// do Dashboard entra como número de conferência por dia: quando os dois
// divergem, a tela mostra a diferença.
//
// O Dashboard conta pela DATA DA CALL (como o Dashboard SDR). Ele pode contar
// calls que não são de primeira call; a tela diz "diferença", nunca "faltando".
// ---------------------------------------------------------------------------

export const LinhaConferenciaSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closer: z.string(),
  total: z.number().int().nonnegative(),
});
export type LinhaConferencia = z.infer<typeof LinhaConferenciaSchema>;

export const ConferenciaResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  linhas: z.array(LinhaConferenciaSchema),
  fonte: z.enum(["dashboard_sdr", "mock"]),
  gerado_em: z.string(),
});
export type ConferenciaResponse = z.infer<typeof ConferenciaResponseSchema>;

// "Marcio Travassos" / "márcio" → "marcio". O Dashboard usa o primeiro nome.
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type DiaConferido = {
  dia: string;
  lista: number;
  dashboard: number;
  // dashboard − lista: positivo = o Dashboard conta mais calls que a lista.
  diferenca: number;
};

// Compara, dia a dia, quantas calls a lista tem com o total do Dashboard.
// `closer` (primeiro nome) restringe os dois lados ao mesmo closer; null = todos.
// A lista entra INTEIRA (inclusive as calls de hoje que já passaram), porque o
// Dashboard conta o dia todo.
export function conferirPorDia(
  lista: readonly Pick<AgendamentoPrimeiraCall, "dia" | "closer_nome">[],
  linhas: readonly LinhaConferencia[],
  closer: string | null = null,
): DiaConferido[] {
  const alvo = closer ? primeiroNome(closer) : null;
  const porDia = new Map<string, DiaConferido>();
  const pegar = (dia: string) => {
    const atual = porDia.get(dia) ?? { dia, lista: 0, dashboard: 0, diferenca: 0 };
    porDia.set(dia, atual);
    return atual;
  };
  for (const a of lista) {
    if (alvo && primeiroNome(a.closer_nome) !== alvo) continue;
    pegar(a.dia).lista += 1;
  }
  for (const l of linhas) {
    if (alvo && primeiroNome(l.closer) !== alvo) continue;
    pegar(l.dia).dashboard += l.total;
  }
  return [...porDia.values()]
    .map((d) => ({ ...d, diferenca: d.dashboard - d.lista }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

// Na tela, "Clint" = a lista (chega da Clint pelo n8n) e "Planilha" = o total
// do Dashboard SDR — os nomes que o time usa para investigar a diferença.
export function rotuloDaDiferenca(d: Pick<DiaConferido, "diferenca">): string {
  if (d.diferenca === 0) return "Confere";
  const n = Math.abs(d.diferenca);
  return d.diferenca > 0
    ? `Planilha tem ${n} a mais`
    : `Clint tem ${n} a mais`;
}
