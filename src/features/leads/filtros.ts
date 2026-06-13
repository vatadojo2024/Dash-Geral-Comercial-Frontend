import type { LeadListItem } from "@/lib/api/contracts";
import { chaveDoProduto } from "@/lib/formatters/score";

// Filtros client-side da fila (F3) — a URL é a fonte de verdade.
// Token especial "sem_etapa" filtra leads com etapa_atual nula.
export const SEM_ETAPA = "sem_etapa";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function csv(valor: string | null): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

export function filtrarLeads(
  leads: LeadListItem[],
  sp: URLSearchParams,
): LeadListItem[] {
  const busca = sp.get("busca");
  const temperaturas = csv(sp.get("temperatura"));
  const etapas = csv(sp.get("etapa"));
  const produtos = csv(sp.get("produto"));
  const closer = sp.get("closer");
  const sdr = sp.get("sdr");
  const pool = sp.get("pool") === "1";
  const trava = sp.get("trava") === "1";

  return leads.filter((l) => {
    if (busca) {
      const alvo = normalizar(`${l.nome_exibicao} ${l.lead_id}`);
      if (!alvo.includes(normalizar(busca))) return false;
    }
    if (temperaturas.length && !temperaturas.includes(l.temperatura)) return false;
    if (etapas.length) {
      const chave = l.etapa_atual ?? SEM_ETAPA;
      if (!etapas.includes(chave)) return false;
    }
    if (produtos.length) {
      const chave = chaveDoProduto(l.produto_sugerido);
      if (!chave || !produtos.includes(chave)) return false;
    }
    if (closer && l.closer_id !== closer) return false;
    if (sdr && l.sdr_id !== sdr) return false;
    if (pool && !l.sdr_pool) return false;
    if (trava && !l.trava_aplicada) return false;
    return true;
  });
}

export function contarFiltrosAtivos(sp: URLSearchParams): number {
  return [
    "busca",
    "temperatura",
    "etapa",
    "produto",
    "closer",
    "sdr",
    "pool",
    "trava",
  ].filter((k) => sp.get(k)).length;
}
