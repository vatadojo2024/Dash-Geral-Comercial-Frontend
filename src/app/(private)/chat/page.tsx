import { PageHeader } from "@/components/layout/PageHeader";
import { exigirArea } from "@/lib/auth/acesso";
import { CopilotoView } from "@/features/copiloto/CopilotoView";

export default async function ChatPage() {
  await exigirArea("chat");
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
