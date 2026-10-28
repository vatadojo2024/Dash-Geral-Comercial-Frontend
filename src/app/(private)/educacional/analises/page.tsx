import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

// Análise de aula (Fase 3, seção 5). Marcador do item do menu até a tela do
// M5 (lista, envio e revisão). A guarda de acesso fica no layout do módulo.
export default function AnalisesPage() {
  return (
    <>
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-azul-claro">Educacional · Análise de aula</p>
        <h1 className="mt-1 font-jakarta text-2xl font-semibold tracking-tight text-texto">Análise de aula</h1>
      </header>
      <Card>
        <EmptyState titulo="Em construção" descricao="O envio e a revisão das transcrições chegam nesta tela." />
      </Card>
    </>
  );
}
