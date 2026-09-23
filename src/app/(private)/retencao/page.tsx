import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { RetencaoPanel } from "@/features/sdr/RetencaoPanel";
import { getServerSession } from "@/lib/auth/session";

// Retenção da audiência: item próprio do menu (fora da Produtividade SDR, a
// pedido do Vata em 23/09). Mesmo público da Produtividade SDR: SDR e admin.
// (/produtividade-sdr/retencao redireciona para cá — next.config.mjs.)
export default async function RetencaoPage() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role === "closer") redirect("/dashboard");

  return (
    <>
      <PageHeader
        titulo="Retenção da audiência"
        descricao="Até onde cada inscrito assistiu ao webinar, pelas tags “Assistiu N%” da Clint. Quem chegou a 50% também conta nos degraus anteriores — a curva só desce."
      />
      <RetencaoPanel />
    </>
  );
}
