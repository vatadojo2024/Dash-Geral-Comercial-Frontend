// ---------------------------------------------------------------------------
// Quanto tempo cada tipo de dado vale no cache do React Query (staleTime).
// Enquanto vale, trocar de tela ou voltar para a aba do navegador NÃO busca de
// novo (o refetchOnWindowFocus só recarrega o que já venceu). Para forçar, cada
// tela tem o botão "Atualizar". Aprovado em 26/10/2026 (Fase 3, correção 7).
// ---------------------------------------------------------------------------

const MINUTO = 60_000;

export const VALIDADE = {
  leads: 1 * MINUTO, // /api/leads e /api/leads/:id
  agendamentos: 1 * MINUTO, // fila, calendário, conferência, histórico e Calls por Ciclo
  pacoteSdr: 5 * MINUTO, // /api/sdr-dashboard
  vendas: 5 * MINUTO, // /api/sales/closer e /api/sdr/comissoes
  retencao: 5 * MINUTO, // /api/eventos/retencao
  eventos: 5 * MINUTO, // Oportunidades do Evento, recortes e descartes
} as const;
