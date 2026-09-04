import type { LeadListItem, Temperatura } from "@/lib/api/contracts";
import {
  ETAPAS_FORA_DO_HEATMAP,
  GRUPOS_ETAPA_HEATMAP,
  TEMPERATURA_CONFIG,
  TEMPERATURAS_ORDENADAS,
  type GrupoEtapa,
} from "@/lib/formatters/score";

// F4 + iteração 2 (6.1): tudo derivado da própria lista de GET /api/leads.
// O dashboard agora é interativo — cards e células selecionam um RECORTE
// (lista lateral + ações recomendadas), sem navegar para a fila.

export type Recorte = {
  id: string;
  label: string;
  predicado: (l: LeadListItem) => boolean;
};

export type CardResumo = {
  id: string;
  label: string;
  valor: number;
  destaque: "rosa" | "laranja" | "azul" | "teal" | "cinza" | "violeta";
  recorte: Recorte;
};

const NO_SHOW_ETAPAS = ["no_show_1a", "no-show"];

export function leadAtivo(l: LeadListItem): boolean {
  return l.etapa_atual === null || !ETAPAS_FORA_DO_HEATMAP.includes(l.etapa_atual);
}

export function cardsResumo(leads: LeadListItem[]): CardResumo[] {
  const defs: Omit<CardResumo, "valor">[] = [
    {
      id: "total",
      label: "Leads no ranking",
      destaque: "azul",
      recorte: { id: "total", label: "Todos os leads do recorte", predicado: () => true },
    },
    {
      id: "muito_quentes",
      label: "Muito quentes",
      destaque: "rosa",
      recorte: {
        id: "muito_quentes",
        label: "Leads muito quentes (90–100)",
        predicado: (l) => l.temperatura === "muito_quente",
      },
    },
    {
      id: "quentes",
      label: "Quentes",
      destaque: "laranja",
      recorte: {
        id: "quentes",
        label: "Leads quentes (75–89)",
        predicado: (l) => l.temperatura === "quente",
      },
    },
    {
      id: "no_shows",
      label: "No-shows a recuperar",
      destaque: "teal",
      recorte: {
        id: "no_shows",
        label: "Leads em no-show",
        predicado: (l) => l.etapa_atual !== null && NO_SHOW_ETAPAS.includes(l.etapa_atual),
      },
    },
    {
      id: "congelados",
      label: "Congelados",
      destaque: "cinza",
      recorte: {
        id: "congelados",
        label: "Leads congelados (0–29)",
        predicado: (l) => l.temperatura === "congelado",
      },
    },
    {
      id: "travas",
      label: "Com trava no score",
      destaque: "violeta",
      recorte: {
        id: "travas",
        label: "Leads com trava aplicada",
        predicado: (l) => l.trava_aplicada !== null,
      },
    },
  ];
  return defs.map((d) => ({ ...d, valor: leads.filter(d.recorte.predicado).length }));
}

export type CelulaHeatmap = {
  temperatura: Temperatura;
  grupo: GrupoEtapa;
  total: number;
  scoreMedio: number | null;
  // Quantos leads DESTA célula estão marcados com estrela pelo admin. A grade
  // usa isso só como indicador visual (a coordenada tem prioridade manual) —
  // não altera intensidade, score médio nem a ordem de nada.
  destaques: number;
};

export type Heatmap = {
  celulas: CelulaHeatmap[];
  maxTotal: number;
  foraDaGrade: number; // FUP, blacklist, fechado e sem etapa
  // Destacados que caem FORA da grade (ex.: um lead em FUP pós-pitch, que não é
  // coluna do mapa). Sem isto, um lead com estrela ficaria invisível na tela:
  // nenhuma célula o indicaria e o link "fora da grade" não diria que ele existe.
  destaquesForaDaGrade: number;
};

export function montarHeatmap(leads: LeadListItem[]): Heatmap {
  const celulas: CelulaHeatmap[] = [];
  let maxTotal = 0;

  for (const temperatura of TEMPERATURAS_ORDENADAS) {
    for (const grupo of GRUPOS_ETAPA_HEATMAP) {
      const doGrupo = leads.filter(
        (l) =>
          l.temperatura === temperatura &&
          l.etapa_atual !== null &&
          (grupo.etapas as string[]).includes(l.etapa_atual),
      );
      const total = doGrupo.length;
      maxTotal = Math.max(maxTotal, total);
      celulas.push({
        temperatura,
        grupo,
        total,
        scoreMedio: total
          ? Math.round(doGrupo.reduce((a, l) => a + l.score_final, 0) / total)
          : null,
        destaques: doGrupo.filter((l) => l.destaque).length,
      });
    }
  }

  const etapasNaGrade = new Set(GRUPOS_ETAPA_HEATMAP.flatMap((g) => g.etapas as string[]));
  const fora = leads.filter(
    (l) => l.etapa_atual === null || !etapasNaGrade.has(l.etapa_atual),
  );

  return {
    celulas,
    maxTotal,
    foraDaGrade: fora.length,
    destaquesForaDaGrade: fora.filter((l) => l.destaque).length,
  };
}

export function recorteDaCelula(c: CelulaHeatmap): Recorte {
  return {
    id: `celula:${c.temperatura}:${c.grupo.id}`,
    label: `${TEMPERATURA_CONFIG[c.temperatura].label} · ${c.grupo.label}`,
    predicado: (l) =>
      l.temperatura === c.temperatura &&
      l.etapa_atual !== null &&
      (c.grupo.etapas as string[]).includes(l.etapa_atual),
  };
}

export function recorteForaDaGrade(): Recorte {
  const etapasNaGrade = new Set(GRUPOS_ETAPA_HEATMAP.flatMap((g) => g.etapas as string[]));
  return {
    id: "fora_da_grade",
    label: "Fora da grade (FUP, blacklist, fechado, sem etapa)",
    predicado: (l) => l.etapa_atual === null || !etapasNaGrade.has(l.etapa_atual),
  };
}

// Ações recomendadas (6.1.3): derivadas dos leads visíveis no recorte atual,
// só ativos (blacklist/fechado fora), ordenadas por score desc.
export function acoesRecomendadas(leads: LeadListItem[], limite = 6): LeadListItem[] {
  return leads
    .filter(leadAtivo)
    .sort((a, b) => b.score_final - a.score_final)
    .slice(0, limite);
}
