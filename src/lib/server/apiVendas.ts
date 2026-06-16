// ---------------------------------------------------------------------------
// Adapter das VENDAS da Dashboard Comercial → forma interna. A API responde uma
// lista de linhas agregadas por (data, closer|sdr[, produto]):
//   { data_referencia, closer|sdr, produto?, total_vendas, total_faturado,
//     total_entrada, ... }
//   - total_faturado = valor da venda (R$, em reais)   → `faturado`
//   - total_entrada  = entrada/cash collected (R$)      → `entrada`
//   - total_vendas   = quantidade de vendas na linha    → `quantidade`
// Tolerância item a item: linha sem data ou sem total_faturado é LOGADA e
// descartada — NUNCA zera/derruba a tela inteira. Nada de valor "chutado":
// ausência do campo de valor = descarte, não 0 silencioso.
// ---------------------------------------------------------------------------

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

export type VendaBruta = {
  nome: string | null; // closer ou sdr (conforme campoNome)
  data: string; // YYYY-MM-DD
  produto: string | null;
  faturado: number;
  entrada: number;
  quantidade: number;
};

export function mapVendasComercial(
  corpo: unknown,
  campoNome: "closer" | "sdr",
  origem: string,
): VendaBruta[] {
  if (!Array.isArray(corpo)) {
    console.error(`[${origem}] resposta não é uma lista (recebido ${typeof corpo}).`);
    return [];
  }
  const out: VendaBruta[] = [];
  corpo.forEach((bruto, i) => {
    const r = bruto as Record<string, unknown>;
    const data = texto(r.data_referencia);
    const faturado = numero(r.total_faturado);
    // Sem data ou sem valor monetário não dá para somar com segurança → descarta.
    if (!data || faturado === null) {
      console.error(
        `[${origem}] linha #${i} descartada (sem data_referencia/total_faturado):`,
        bruto,
      );
      return;
    }
    out.push({
      nome: texto(r[campoNome]),
      data,
      produto: texto(r.produto),
      faturado,
      entrada: numero(r.total_entrada) ?? 0,
      quantidade: numero(r.total_vendas) ?? 1,
    });
  });
  return out;
}
