import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { homeDoUsuario, ROTA_SEM_AREA } from "@/lib/auth/areas";
import { getServerSession } from "@/lib/auth/session";

// Destino de quem faz login sem nenhuma área (educacional, por enquanto). Fica
// dentro do app (menu vazio + barra de cima com "Sair") em vez de redirecionar,
// para não entrar em loop com a home. Quem ganhar uma área e cair aqui por um
// link antigo segue para a própria home.
export default async function SemAreaPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  const home = homeDoUsuario(user);
  if (home !== ROTA_SEM_AREA) redirect(home);

  return (
    <Card>
      <EmptyState
        icon={Clock}
        titulo="Sua área ainda não está disponível"
        descricao="Seu acesso está ativo, mas as telas do seu time ainda não foram liberadas no Mapa de Calor. Assim que estiverem, elas aparecem no menu."
      />
    </Card>
  );
}
