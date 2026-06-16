import { z } from "zod";

// ---------------------------------------------------------------------------
// Camada de dados do Sales Ops (vendas/faturamento do closer). A FONTE (mock |
// Dashboard Comercial real) é decidida no servidor pelo route handler
// /api/sales/closer (env SDR_DASHBOARD_MODE) — trocar o modo no .env muda a
// fonte SEM tocar em componente. Aqui só buscamos e validamos o contrato.
// ---------------------------------------------------------------------------

export const VendaSchema = z.object({
  // SEM .nonnegative(): estorno vem como valor NEGATIVO e deve ABATER.
  valor: z.number(),
  produto: z.string(),
  data: z.string(),
  // Linhas reais da API são agregadas por (data, produto): quantidade ≥ 1.
  quantidade: z.number().int().positive().optional(),
});
export type Venda = z.infer<typeof VendaSchema>;

export const VendasDoMesSchema = z.object({
  mes: z.string(),
  vendas: z.array(VendaSchema),
  // Somas podem ficar negativas num mês dominado por estornos — não restringir.
  volumeVendido: z.number(),
  cashCollected: z.number(),
});
export type VendasDoMes = z.infer<typeof VendasDoMesSchema>;

export async function fetchVendasDoMes(
  closerId: string,
  mes?: string,
): Promise<VendasDoMes> {
  const qs = new URLSearchParams({ closer: closerId });
  if (mes) qs.set("mes", mes);
  const res = await fetch(`/api/sales/closer?${qs}`);
  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? `A busca de vendas respondeu ${res.status}.`);
  }
  return VendasDoMesSchema.parse(await res.json());
}
