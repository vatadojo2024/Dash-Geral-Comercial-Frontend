import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ABAS_SDR, ROTA_SDR } from "@/features/sdr/abas";
import { SdrView } from "@/features/sdr/SdrView";
import { getServerSession } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Produtividade SDR com uma rota por sub-aba:
//   /produtividade-sdr                  → Dashboard SDR
//   /produtividade-sdr/calls-por-ciclo  → Calls por Ciclo
//   /produtividade-sdr/levantou-a-mao   → Levantou a Mão
//   /produtividade-sdr/comissoes        → Comissões
//   /produtividade-sdr/lideranca        → Liderança Pré-venda (só admin)
// (/sdr antigo redireciona para cá — next.config.mjs.)
// ---------------------------------------------------------------------------

export default async function ProdutividadeSdrPage({
  params,
}: {
  params: Promise<{ aba?: string[] }>;
}) {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role === "closer") redirect("/dashboard");

  const { aba: segmentos } = await params;
  if (segmentos && segmentos.length > 1) notFound();
  const slug = segmentos?.[0] ?? "";
  const def = ABAS_SDR.find((a) => a.slug === slug);
  if (!def) notFound();
  if (def.soAdmin && user.role !== "admin") redirect(ROTA_SDR);

  return (
    <>
      <PageHeader
        titulo="Produtividade SDR"
        descricao="Calls, qualificados, produtos e metas escalonadas — espelho do Dashboard SDR."
      />
      <SdrView aba={def.aba} />
    </>
  );
}
