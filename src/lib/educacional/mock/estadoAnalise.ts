import type { AnaliseAulaBanco, Banco } from "./tipos";

// Estado de uma análise de aula com IA no modo demonstração: "processando" até
// `pronta_em`, depois "pronta" (ou "erro", se era para falhar). Separado de
// analiseAula.ts para o motor usar sem importar o servidor da análise.
export function statusDe(an: AnaliseAulaBanco, agora: string) {
  if (agora < an.pronta_em) return "processando" as const;
  return an.falhar ? ("erro" as const) : ("pronta" as const);
}

// Resumo da ÚLTIMA análise da aula, como o backend manda em cada aula da ficha.
export function resumoDaUltimaAnalise(banco: Banco, aulaId: string, agora: string) {
  const ultima = (banco.analises_aula ?? [])
    .filter((x) => x.aula_id === aulaId)
    .sort((x, y) => y.criada_em.localeCompare(x.criada_em))[0];
  return ultima ? { id: ultima.id, status: statusDe(ultima, agora), decidida: ultima.decidida_em != null } : null;
}
