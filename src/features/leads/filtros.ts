import type { LeadListItem } from "@/lib/api/contracts";
import { chaveDoProduto } from "@/lib/formatters/score";

// Filtros client-side da fila (F3) — a URL é a fonte de verdade.
// Token especial "sem_etapa" filtra leads com etapa_atual nula.
export const SEM_ETAPA = "sem_etapa";

// Aceita null/undefined sem quebrar: um campo ausente vira "" (não casa busca,
// mas NUNCA derruba o filtro com "toLowerCase of undefined").
function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function csv(valor: string | null): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

// Eixo do filtro de data: última atividade (base da retenção de 65 dias) com
// fallback no instante do cálculo do score quando a API ainda não expõe o campo.
// Fácil trocar p/ next_call_at aqui se a regra mudar.
export function dataEixo(l: LeadListItem): string {
  return (l.last_activity_at ?? l.score_calculated_at ?? "").slice(0, 10);
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
  const de = sp.get("de"); // YYYY-MM-DD (data_inicio)
  const ate = sp.get("ate"); // YYYY-MM-DD (data_fim)

  return leads.filter((l) => {
    if (busca) {
      const alvo = normalizar(`${l.nome_exibicao ?? ""} ${l.lead_id ?? ""}`);
      if (!alvo.includes(normalizar(busca))) return false;
    }
    if (de || ate) {
      const base = dataEixo(l);
      // Lead sem data não cabe num intervalo: fica fora quando o filtro está ativo.
      if (!base) return false;
      if (de && base < de) return false;
      if (ate && base > ate) return false;
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
    "de",
    "ate",
  ].filter((k) => sp.get(k)).length;
}
