import type {
  AutorizacaoProvaSocial,
  CampoAjustavel,
  EntidadeHistorico,
  FaixaSaude,
  NivelInicial,
  Sinal,
  StatusAluno,
  StatusCheckpoint,
  StatusFinanceiro,
  TipoResponsavel,
} from "./contrato";

// ---------------------------------------------------------------------------
// Rótulos e cores do módulo Educacional. Só apresentação: nenhum valor é
// calculado aqui. Nomes de etapa, tipo de intervenção e responsável vêm da
// configuração (Fase 2). Cores semânticas FIXAS:
//   verde = saudável / realizado · âmbar = atenção / pendente ·
//   vermelho = risco / não respondeu · cinza = em pausa ·
//   cinza claro = previsto (data ainda não chegou)
// ---------------------------------------------------------------------------

export type Tom = "verde" | "ambar" | "vermelho" | "cinza" | "cinza_claro";

export const ROTULO_STATUS_CHECKPOINT: Record<StatusCheckpoint, string> = {
  realizado: "Realizado",
  pendente: "Pendente",
  nao_respondeu: "Não respondeu",
  em_pausa: "Em pausa",
  previsto: "Previsto",
};
export const TOM_STATUS_CHECKPOINT: Record<StatusCheckpoint, Tom> = {
  realizado: "verde",
  pendente: "ambar",
  nao_respondeu: "vermelho",
  em_pausa: "cinza",
  previsto: "cinza_claro",
};

export const ROTULO_FAIXA: Record<FaixaSaude, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
};
export const TOM_FAIXA: Record<FaixaSaude, Tom> = { saudavel: "verde", atencao: "ambar", risco: "vermelho" };

export const ROTULO_NIVEL: Record<NivelInicial, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const PASSOS = ["consumiu", "entendeu", "aplicou", "validou"] as const;
export type Passo = (typeof PASSOS)[number];
export const ROTULO_PASSO: Record<Passo, string> = {
  consumiu: "Consumiu",
  entendeu: "Entendeu",
  aplicou: "Aplicou",
  validou: "Validou",
};

export const ROTULO_SINAL: Record<Sinal, string> = {
  upgrade: "Upgrade",
  renovacao: "Renovação",
  prova_social: "Prova Social",
};
// Títulos dos sub-cards do Cockpit.
export const TITULO_SINAL: Record<Sinal, string> = {
  upgrade: "Prontos para Upgrade",
  renovacao: "Em janela de Renovação",
  prova_social: "Potencial de Prova Social",
};

export const ROTULO_TIPO_RESPONSAVEL: Record<TipoResponsavel, string> = {
  mentor: "Mentor",
  suporte: "Suporte",
  comercial: "Comercial",
};

export const ROTULO_FINANCEIRO: Record<StatusFinanceiro, string> = {
  adimplente: "Adimplente",
  inadimplente: "Inadimplente",
};

export const ROTULO_STATUS_ALUNO: Record<StatusAluno, string> = {
  ativo: "Ativo",
  em_pausa: "Em pausa",
  concluido: "Concluído",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
};

export const ROTULO_AUTORIZACAO: Record<AutorizacaoProvaSocial, string> = {
  nao_solicitado: "Não solicitado",
  sim: "Autorizada",
  nao: "Não autorizada",
  pendente: "Pendente",
};

export const ROTULO_STATUS_INTERVENCAO = { aberta: "Aberta", concluida: "Concluída" } as const;

export const ROTULO_ENTIDADE: Record<EntidadeHistorico, string> = {
  aluno: "Aluno",
  checkpoint: "Checkpoint",
  intervencao: "Intervenção",
  ajuste: "Ajuste manual",
};

export const ROTULO_CAMPO_AJUSTAVEL: Record<CampoAjustavel, string> = {
  health_score: "Health Score",
  faixa_saude: "Faixa de saúde",
  dias_na_etapa: "Dias na etapa",
  ultima_atividade: "Última atividade",
  dias_sem_atividade: "Dias sem atividade",
  status_financeiro: "Status financeiro",
  ltv: "LTV",
  progresso_consumiu: "Consumiu",
  progresso_entendeu: "Entendeu",
  progresso_aplicou: "Aplicou",
  progresso_validou: "Validou",
  sinal_upgrade: "Upgrade",
  sinal_renovacao: "Renovação",
  sinal_prova_social: "Prova Social",
};

// Classes por tom, com os tokens do design system.
export const TAG_DO_TOM: Record<Tom, string> = {
  verde: "tag-success",
  ambar: "tag-warning",
  vermelho: "tag-error",
  cinza: "border-cinza/40 bg-cinza/20 text-cinza",
  // Tracejado e sem fundo: algo que ainda vai acontecer.
  cinza_claro: "border-dashed border-cinza-claro/40 bg-transparent text-cinza-claro",
};
export const PONTO_DO_TOM: Record<Tom, string> = {
  verde: "bg-sucesso",
  ambar: "bg-aviso",
  vermelho: "bg-erro",
  cinza: "bg-cinza",
  cinza_claro: "bg-cinza-claro",
};
export const TEXTO_DO_TOM: Record<Tom, string> = {
  verde: "text-sucesso",
  ambar: "text-aviso",
  vermelho: "text-erro",
  cinza: "text-cinza",
  cinza_claro: "text-cinza-claro",
};

// ---------------------------------------------------------------------------
// Formatação (sem fuso: datas do contrato são dias, "AAAA-MM-DD", ou ISO).
// ---------------------------------------------------------------------------

export function dataCurta(valor: string | null | undefined): string {
  if (!valor) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export function dataHoraBr(valor: string | null | undefined): string {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Hoje em Brasília, AAAA-MM-DD (valor inicial de campos de data).
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function reais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
