import type { SituacaoAnalise } from "../contrato";
import type { AnaliseAulaBanco, Banco } from "./tipos";

// Estado de uma análise de aula com IA no modo demonstração: "processando" até
// `pronta_em`, depois "pronta" (ou "erro", se era para falhar). Separado de
// analiseAula.ts para o motor usar sem importar o servidor da análise.
export function statusDe(an: AnaliseAulaBanco, agora: string) {
  if (an.travada || agora < an.pronta_em) return "processando" as const;
  return an.falhar ? ("erro" as const) : ("pronta" as const);
}

// Resumo da ÚLTIMA análise da aula, como o backend manda em cada aula da ficha.
export function resumoDaUltimaAnalise(banco: Banco, aulaId: string, agora: string) {
  const ultima = (banco.analises_aula ?? [])
    .filter((x) => x.aula_id === aulaId)
    .sort((x, y) => y.criada_em.localeCompare(x.criada_em))[0];
  // Com a `situacao`, como o backend manda desde 4197783 ("Interrompida" na ficha).
  return ultima ? { id: ultima.id, status: statusDe(ultima, agora), decidida: ultima.decidida_em != null, situacao: situacaoDe(ultima, agora) } : null;
}

// Situação como o backend deriva (40d18c8): decidida primeiro; "interrompida" é
// processando há mais de 30 minutos (o banco não muda).
export const MINUTOS_ATE_INTERROMPIDA = 30;
export function situacaoDe(an: AnaliseAulaBanco, agora: string): SituacaoAnalise {
  if (an.decidida_em) return "decidida";
  const status = statusDe(an, agora);
  if (status === "pronta") return "aguardando_decisao";
  if (status === "processando") {
    const minutos = (Date.parse(agora) - Date.parse(an.criada_em)) / 60_000;
    return minutos > MINUTOS_ATE_INTERROMPIDA ? "interrompida" : "analisando";
  }
  return "erro";
}
