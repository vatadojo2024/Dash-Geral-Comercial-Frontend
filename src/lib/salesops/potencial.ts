import type { LeadListItem } from "@/lib/api/contracts";
import { valorDeProjecao } from "@/lib/config/salesops";

// ---------------------------------------------------------------------------
// Potencial da carteira por produto (roadmap 7.1.1) — função PURA.
// Para cada produto com leads ATIVOS na carteira do closer: nº de leads,
// faturamento potencial (nº × valor de tabela usado na projeção) e a comissão
// do closer sobre esse faturamento (a tela aplica a taxa vigente E a taxa do
// cenário "fechando todos").
// ---------------------------------------------------------------------------

export type PotencialProduto = {
  /** chave normalizada (qc, ninja, black, prime, private) */
  chave: string;
  /** rótulo como vem do lead ("Black", "QC"...) */
  produto: string;
  leads: number;
  valorUnitario: number;
  faturamentoPotencial: number;
};

export type PotencialCarteira = {
  itens: PotencialProduto[];
  totalLeads: number;
  totalFaturamento: number;
  /** leads ativos sem produto sugerido (fora da conta) */
  semProduto: number;
};

export function potencialPorProduto(carteiraAtiva: LeadListItem[]): PotencialCarteira {
  const porChave = new Map<string, PotencialProduto>();
  let semProduto = 0;

  for (const lead of carteiraAtiva) {
    const valor = valorDeProjecao(lead.produto_sugerido);
    if (valor === null || !lead.produto_sugerido) {
      semProduto++;
      continue;
    }
    const chave = lead.produto_sugerido.trim().toLowerCase();
    const atual =
      porChave.get(chave) ??
      ({
        chave,
        produto: lead.produto_sugerido.trim(),
        leads: 0,
        valorUnitario: valor,
        faturamentoPotencial: 0,
      } satisfies PotencialProduto);
    atual.leads++;
    atual.faturamentoPotencial += valor;
    porChave.set(chave, atual);
  }

  const itens = [...porChave.values()].sort(
    (a, b) => b.faturamentoPotencial - a.faturamentoPotencial,
  );

  return {
    itens,
    totalLeads: itens.reduce((a, i) => a + i.leads, 0),
    totalFaturamento: itens.reduce((a, i) => a + i.faturamentoPotencial, 0),
    semProduto,
  };
}
