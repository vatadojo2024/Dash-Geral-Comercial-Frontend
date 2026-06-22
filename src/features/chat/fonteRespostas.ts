import type { Role } from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// FONTE DE RESPOSTAS (mock) — design.md §7.
//
// ÚNICO ponto do recurso que conhece respostas fictícias. A tela e o hook de
// estado NÃO sabem que é falso: chamam `obterResposta`, esperam (pode demorar)
// e reagem ao texto resolvido ou ao erro rejeitado.
//
// Na Etapa 5, SOMENTE este arquivo é reimplementado para falar com o serviço
// real (gravar pendente / buscar quando ficar pronto). Contrato, tela, bolhas
// e estados permanecem intactos. Por isso a assinatura é deliberadamente
// simples: entra a pergunta + o papel, sai (de forma assíncrona) um texto.
// ---------------------------------------------------------------------------

export type PedidoResposta = {
  pergunta: string;
  papel: Role;
  // Permite SIMULAR uma falha de propósito (RF-06). O serviço real ignora.
  forcarErro?: boolean;
};

// Atraso fictício para imitar o assíncrono real (que pode levar minutos).
const ATRASO_MIN_MS = 1200;
const ATRASO_MAX_MS = 2800;

// Respostas fictícias por papel — só para dar cara ao fluxo nesta etapa.
const RESPOSTAS: Record<Role, string[]> = {
  admin: [
    "Pensando como gestão: priorize o que move o ponteiro do mês. Onde está a maior concentração de leads quentes parados?",
    "Estrategicamente, vale comparar a conversão por etapa entre os closers antes de redistribuir a fila.",
    "Boa pergunta. Olhe o funil de cima: se a entrada de SQLs caiu, o problema é de geração, não de fechamento.",
  ],
  closer: [
    "Na condução, retome a dor que ele citou na call anterior antes de avançar para a proposta.",
    "Esse lead está morno: confirme o orçamento e a urgência antes de marcar a call de fechamento.",
    "Para destravar, faça uma pergunta de compromisso: 'se isso fizer sentido, o que falta para começarmos?'",
  ],
  sdr: [
    "Na qualificação, valide momento e fit antes de agendar — assim o closer recebe um lead mais maduro.",
    "Esse contato parece frio. Tente um gancho de valor rápido por mensagem antes de insistir na ligação.",
    "Para o agendamento, ofereça duas janelas específicas em vez de perguntar 'qual seu melhor horário?'.",
  ],
};

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Recebe a pergunta do usuário + o papel e devolve, após um atraso fictício,
 * um texto de resposta. Rejeita quando `forcarErro` é pedido (RF-06).
 */
export async function obterResposta(pedido: PedidoResposta): Promise<string> {
  const atraso = ATRASO_MIN_MS + Math.random() * (ATRASO_MAX_MS - ATRASO_MIN_MS);
  await esperar(atraso);

  if (pedido.forcarErro) {
    throw new Error("Falha simulada ao gerar a resposta da IA.");
  }

  const opcoes = RESPOSTAS[pedido.papel];
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}
