import { PageHeader } from "@/components/layout/PageHeader";
import { ChatView } from "@/features/chat/ChatView";

export default function ChatPage() {
  return (
    <>
      <PageHeader
        titulo="Chat IA"
        descricao="Converse com o guia de IA do seu papel para orientação comercial."
      />
      <ChatView />
    </>
  );
}
