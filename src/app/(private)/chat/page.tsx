import { PageHeader } from "@/components/layout/PageHeader";
import { CopilotoView } from "@/features/copiloto/CopilotoView";

export default function ChatPage() {
  return (
    <>
      <PageHeader
        titulo="Copiloto"
        descricao="Converse com a IA-guia do seu papel ou gere um playbook a partir de uma transcrição."
      />
      <CopilotoView />
    </>
  );
}
