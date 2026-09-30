import { HistoricoAgendamentosView } from "@/features/agendamentos/HistoricoAgendamentosView";
import { exigirArea } from "@/lib/auth/acesso";

// Histórico geral de agendamentos — o substituto do canal único do Discord.
// Área `historico_agendamentos` (hoje só admin; vem de GET /api/me → areas).
export default async function HistoricoAgendamentosPage() {
  await exigirArea("historico_agendamentos");
  return <HistoricoAgendamentosView />;
}
