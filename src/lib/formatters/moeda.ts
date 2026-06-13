const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const BRL_CENTAVOS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatarBRL(valor: number): string {
  return BRL.format(valor);
}

export function formatarBRLExato(valor: number): string {
  return BRL_CENTAVOS.format(valor);
}

export function formatarPct(fracao: number, casas = 1): string {
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}
