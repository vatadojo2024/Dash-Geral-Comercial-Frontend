import type {
  Etapa,
  NivelInicial,
  NivelRisco,
  PassoMetodologico,
  Sinal,
  StatusCheckpoint,
  StatusFinanceiro,
  TipoIntervencao,
  TipoResponsavel,
} from "./contrato";

// ---------------------------------------------------------------------------
// Rótulos e cores do módulo Educacional. Só apresentação: nenhum valor é
// calculado aqui. Cores semânticas FIXAS (spec, seção 7):
//   verde = saudável / realizado · âmbar = atenção / pendente ·
//   vermelho = risco / não respondeu · cinza = em pausa ·
//   cinza claro = previsto (data ainda não chegou)
// ---------------------------------------------------------------------------

export type Tom = "verde" | "ambar" | "vermelho" | "cinza" | "cinza_claro";

export const ROTULO_ETAPA: Record<Etapa, string> = {
  fundamentos_iniciais: "Fundamentos Iniciais",
  tres_pilares: "3 Pilares",
  oferta_e_demanda: "Oferta e Demanda",
  construcao_operacional: "Construção do Operacional",
  validacao: "Validação",
};

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

export const ROTULO_RISCO: Record<NivelRisco, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
};
export const TOM_RISCO: Record<NivelRisco, Tom> = { saudavel: "verde", atencao: "ambar", risco: "vermelho" };

export const ROTULO_NIVEL: Record<NivelInicial, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export const ROTULO_PASSO: Record<PassoMetodologico, string> = {
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

export const ROTULO_TIPO_INTERVENCAO: Record<TipoIntervencao, string> = {
  contato: "Contato",
  reuniao: "Reunião",
  ajuste_plano: "Ajuste de plano",
  outro: "Outro",
};

export const ROTULO_FINANCEIRO: Record<StatusFinanceiro, string> = {
  adimplente: "Adimplente",
  inadimplente: "Inadimplente",
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

export function reais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
