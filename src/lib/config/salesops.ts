// ---------------------------------------------------------------------------
// Configuração do Sales Ops (roadmap 6.2 — doc oficial Vata, jun/2026).
// Metas MUDAM por mês: editar AQUI (nunca hard-coded em componente).
// ---------------------------------------------------------------------------

import { chaveDoProduto } from "@/lib/formatters/score";

export type MetaMes = { m1: number; m2: number };

export const metasPorCloser: Record<string, MetaMes> = {
  aurelio: { m1: 260_000, m2: 320_000 },
  marcio: { m1: 260_000, m2: 320_000 },
  giba: { m1: 75_000, m2: 85_000 },
};

// Nome do closer na Dashboard Comercial (filtro de vendas é "contém" por NOME).
// O slug interno NÃO é o nome real na API: "giba" é "Gilberto" lá. Sem este
// mapa, o filtro não casaria e a venda do Giba viria ZERADA em silêncio.
// Conferir com o time se algum nome real diverge do mapeado aqui.
export const nomeApiVendasPorCloser: Record<string, string> = {
  aurelio: "Aurelio",
  marcio: "Marcio",
  giba: "Gilberto",
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Resolve a CHAVE única do closer (o SLUG de metasPorCloser) a partir do id que
// chega na tela. O admin já seleciona pelo slug; o closer LOGADO entra com o
// UUID do JWT, que precisa virar o MESMO slug ANTES de buscar meta/vendas e
// montar o cabeçalho — senão o UUID ia cru pra meta (→ "sem meta"), pra busca de
// vendas (que filtra por NOME e zeraria) e pro cabeçalho (UUID cru). A ponte é a
// MESMA do filtro de leads/carteira: UUID→nome (diretório /api/usuarios) e
// nome→slug (a correspondência por nome de nomeApiVendasPorCloser). Não há slug
// no diretório, então o casamento é por nome ("contém"), como nas demais telas.
export function slugDoCloser(
  closerId: string,
  usuariosMap: ReadonlyMap<string, string>,
): string | null {
  if (metasPorCloser[closerId]) return closerId; // já é um slug conhecido (admin)
  const nome = semAcento((usuariosMap.get(closerId) ?? "").toLowerCase());
  if (!nome) return null; // UUID ainda não resolvido (diretório carregando/sem match)
  for (const slug of Object.keys(metasPorCloser)) {
    const alvo = semAcento((nomeApiVendasPorCloser[slug] ?? slug).toLowerCase());
    if (alvo && nome.includes(alvo)) return slug;
  }
  return null;
}

export type PrecoProduto = { avista: number; parcelado12x: number };

// Tabela oficial de preços (Vata, jun/2026)
export const precosProdutos: Record<string, PrecoProduto> = {
  qc: { avista: 1_997, parcelado12x: 206 },
  ninja_s: { avista: 7_000, parcelado12x: 720 },
  ninja_a: { avista: 12_000, parcelado12x: 1_250 },
  black_s: { avista: 25_000, parcelado12x: 2_600 },
  black_a: { avista: 44_000, parcelado12x: 4_600 },
  prime_s: { avista: 68_000, parcelado12x: 6_800 },
  prime_a: { avista: 98_000, parcelado12x: 9_800 },
  private_s: { avista: 120_000, parcelado12x: 12_000 },
  private_a: { avista: 180_000, parcelado12x: 18_000 },
};

// REGRA de projeção: o lead só tem o produto SEM variante (S/A), então a
// projeção usa o À VISTA da variante S (conservador).
export const valorProjecaoPorProdutoSugerido: Record<string, number> = {
  qc: 1_997,
  ninja: 7_000,
  black: 25_000,
  prime: 68_000,
  private: 120_000,
};

// produto_sugerido do lead → valor de projeção. Usa a MESMA derivação de chave
// da fila (chaveDoProduto, por substring), não um lookup exato: o produto_sugerido
// real vem verboso ("Black Belt Semestral", "Ninja Anual"), então o lookup exato
// antigo zerava TUDO ("nenhum lead com produto sugerido") mesmo com o campo
// preenchido. Agora painel de carteira e fila concordam. Lead sem produto → null.
export function valorDeProjecao(
  produtoSugerido: string | null | undefined,
): number | null {
  const chave = chaveDoProduto(produtoSugerido);
  if (!chave) return null;
  return valorProjecaoPorProdutoSugerido[chave] ?? null;
}

// Nomenclatura oficial (7.1.3): as variantes S e A são EXIBIDAS como
// "Semestral" e "Anual" em todos os labels; as chaves internas (ninja_s,
// "Black A"...) permanecem como estão nos dados.
export function rotuloProduto(nome: string): string {
  return nome.replace(/ s$/i, " Semestral").replace(/ a$/i, " Anual");
}
