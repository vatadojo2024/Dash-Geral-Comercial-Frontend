import { z } from "zod";
import rawVendas from "@/lib/mock/vendas_closers.json";

// ---------------------------------------------------------------------------
// Camada de dados do Sales Ops — isolada para a troca mock→real futura
// (as vendas/cash virão do backend; o contrato Zod permanece).
// ---------------------------------------------------------------------------

export const VendaSchema = z.object({
  valor: z.number().nonnegative(),
  produto: z.string(),
  data: z.string(),
});
export type Venda = z.infer<typeof VendaSchema>;

const ArquivoVendasSchema = z.object({
  mes: z.string(),
  closers: z.record(
    z.string(),
    z.object({
      cash_collected: z.number().nonnegative(),
      vendas: z.array(VendaSchema),
    }),
  ),
});

export type VendasDoMes = {
  mes: string;
  vendas: Venda[];
  volumeVendido: number;
  cashCollected: number;
};

let cache: z.infer<typeof ArquivoVendasSchema> | null = null;
function arquivo() {
  if (!cache) cache = ArquivoVendasSchema.parse(rawVendas);
  return cache;
}

function simularRede(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300));
}

export async function fetchVendasDoMes(closerId: string): Promise<VendasDoMes> {
  await simularRede();
  const dados = arquivo();
  const doCloser = dados.closers[closerId] ?? { cash_collected: 0, vendas: [] };
  return {
    mes: dados.mes,
    vendas: [...doCloser.vendas].sort((a, b) => b.data.localeCompare(a.data)),
    volumeVendido: doCloser.vendas.reduce((acc, v) => acc + v.valor, 0),
    cashCollected: doCloser.cash_collected,
  };
}
