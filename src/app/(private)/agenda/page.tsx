import { PageHeader } from "@/components/layout/PageHeader";
import { AgendaView } from "@/features/agenda/AgendaView";

export default function AgendaPage() {
  return (
    <>
      <PageHeader
        titulo="Agenda"
        descricao="Próximas calls dos seus leads, agrupadas por dia."
      />
      <AgendaView />
    </>
  );
}
