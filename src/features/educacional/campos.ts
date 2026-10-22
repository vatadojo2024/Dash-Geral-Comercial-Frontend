import {
  FAIXAS_SAUDE,
  STATUS_FINANCEIRO,
  type AlunoDetalhe,
  type AlunoLinha,
  type CampoAjustavel,
  type CampoCalculado,
} from "@/lib/educacional/contrato";
import { dataCurta, reais, ROTULO_CAMPO_AJUSTAVEL, ROTULO_FAIXA, ROTULO_FINANCEIRO } from "@/lib/educacional/rotulos";

// ---------------------------------------------------------------------------
// Campos calculados (ajuste manual): como editar, como exibir e onde ficam no
// aluno. Só apresentação e endereço: o valor efetivo vem pronto da API.
// ---------------------------------------------------------------------------

export type Editor =
  | { tipo: "numero"; min: number; max?: number; passo?: number; sufixo?: string }
  | { tipo: "lista"; opcoes: { valor: string; rotulo: string }[] }
  | { tipo: "booleano" }
  | { tipo: "data" };

const NOTA: Editor = { tipo: "numero", min: 0, max: 100 };
const DIAS: Editor = { tipo: "numero", min: 0, sufixo: "dias" };

export const EDITOR_DO_CAMPO: Record<CampoAjustavel, Editor> = {
  health_score: NOTA,
  faixa_saude: { tipo: "lista", opcoes: FAIXAS_SAUDE.map((f) => ({ valor: f, rotulo: ROTULO_FAIXA[f] })) },
  dias_na_etapa: DIAS,
  ultima_atividade: { tipo: "data" },
  dias_sem_atividade: DIAS,
  status_financeiro: { tipo: "lista", opcoes: STATUS_FINANCEIRO.map((f) => ({ valor: f, rotulo: ROTULO_FINANCEIRO[f] })) },
  ltv: { tipo: "numero", min: 0, passo: 100, sufixo: "R$" },
  progresso_consumiu: NOTA,
  progresso_entendeu: NOTA,
  progresso_aplicou: NOTA,
  progresso_validou: NOTA,
  sinal_upgrade: { tipo: "booleano" },
  sinal_renovacao: { tipo: "booleano" },
  sinal_prova_social: { tipo: "booleano" },
};

// Mudanças que mexem nos totais do Cockpit (faixa, sinais): recarrega o resumo.
export const AJUSTE_AFETA_TOTAIS: ReadonlySet<CampoAjustavel> = new Set([
  "health_score",
  "faixa_saude",
  "sinal_upgrade",
  "sinal_renovacao",
  "sinal_prova_social",
]);

export function formatarValor(campo: CampoAjustavel, valor: unknown): string {
  if (valor == null || valor === "") return "sem cálculo";
  switch (campo) {
    case "faixa_saude":
      return ROTULO_FAIXA[valor as keyof typeof ROTULO_FAIXA] ?? String(valor);
    case "status_financeiro":
      return ROTULO_FINANCEIRO[valor as keyof typeof ROTULO_FINANCEIRO] ?? String(valor);
    case "ltv":
      return typeof valor === "number" ? reais(valor) : String(valor);
    case "ultima_atividade":
      return dataCurta(String(valor));
    case "dias_na_etapa":
    case "dias_sem_atividade":
      return `${valor} ${valor === 1 ? "dia" : "dias"}`;
    case "sinal_upgrade":
    case "sinal_renovacao":
    case "sinal_prova_social":
      return valor ? "Sim" : "Não";
    default:
      return String(valor);
  }
}

export const rotuloDoCampo = (campo: CampoAjustavel) => ROTULO_CAMPO_AJUSTAVEL[campo];

type Aluno = AlunoLinha | AlunoDetalhe;

// Onde cada campo ajustável mora no aluno (null quando a linha não tem o campo).
export function campoDe(a: Aluno, campo: CampoAjustavel): CampoCalculado<unknown> | null {
  const d = a as Partial<AlunoDetalhe>;
  switch (campo) {
    case "health_score":
      return a.health_score;
    case "faixa_saude":
      return a.faixa_saude;
    case "dias_na_etapa":
      return a.dias_na_etapa;
    case "dias_sem_atividade":
      return a.dias_sem_atividade;
    case "sinal_upgrade":
      return a.sinais.upgrade;
    case "sinal_renovacao":
      return a.sinais.renovacao;
    case "sinal_prova_social":
      return a.sinais.prova_social;
    case "ultima_atividade":
      return d.ultima_atividade ?? null;
    case "status_financeiro":
      return d.status_financeiro ?? null;
    case "ltv":
      return d.ltv ?? null;
    case "progresso_consumiu":
      return d.progresso?.consumiu ?? null;
    case "progresso_entendeu":
      return d.progresso?.entendeu ?? null;
    case "progresso_aplicou":
      return d.progresso?.aplicou ?? null;
    case "progresso_validou":
      return d.progresso?.validou ?? null;
  }
}

// Cópia do aluno com o campo trocado (para o otimista). Campos que a linha não tem ficam como estão.
export function comCampo<T extends Aluno>(a: T, campo: CampoAjustavel, novo: CampoCalculado<unknown>): T {
  const c = novo as never;
  switch (campo) {
    case "health_score":
    case "faixa_saude":
    case "dias_na_etapa":
    case "dias_sem_atividade":
      return { ...a, [campo]: c };
    case "sinal_upgrade":
      return { ...a, sinais: { ...a.sinais, upgrade: c } };
    case "sinal_renovacao":
      return { ...a, sinais: { ...a.sinais, renovacao: c } };
    case "sinal_prova_social":
      return { ...a, sinais: { ...a.sinais, prova_social: c } };
  }
  if (!("progresso" in a)) return a;
  switch (campo) {
    case "ultima_atividade":
    case "status_financeiro":
    case "ltv":
      return { ...a, [campo]: c };
    case "progresso_consumiu":
      return { ...a, progresso: { ...a.progresso, consumiu: c } };
    case "progresso_entendeu":
      return { ...a, progresso: { ...a.progresso, entendeu: c } };
    case "progresso_aplicou":
      return { ...a, progresso: { ...a.progresso, aplicou: c } };
    case "progresso_validou":
      return { ...a, progresso: { ...a.progresso, validou: c } };
  }
  return a;
}

// Algum campo exibido no card do Kanban tem ajuste manual? (ícone no card)
export function temAjusteNoCard(a: AlunoLinha): boolean {
  return Boolean(a.faixa_saude.ajuste || a.dias_na_etapa.ajuste || a.health_score.ajuste);
}
