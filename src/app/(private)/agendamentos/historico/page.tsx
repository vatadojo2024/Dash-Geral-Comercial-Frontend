import { HistoricoAgendamentosView } from "@/features/agendamentos/HistoricoAgendamentosView";
import { exigirArea } from "@/lib/auth/acesso";

// Sub-aba "Histórico" de Agendamentos — o substituto do canal único do Discord.
// Área `historico_agendamentos` (hoje só admin; vem de GET /api/me → areas).
// (/historico-agendamentos antigo redireciona para cá — next.config.mjs.)
export default async function HistoricoAgendamentosPage() {
  await exigirArea("historico_agendamentos");
  return <HistoricoAgendamentosView />;
}
