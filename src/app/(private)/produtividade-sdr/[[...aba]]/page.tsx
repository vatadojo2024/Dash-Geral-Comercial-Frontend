import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ABAS_SDR, RECORTES_LEVANTOU, ROTA_SDR } from "@/features/sdr/abas";
import { SdrView } from "@/features/sdr/SdrView";
import { getServerSession } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Produtividade SDR com uma rota por sub-aba:
//   /produtividade-sdr                  → Dashboard SDR
//   /produtividade-sdr/calls-por-ciclo  → Calls por Ciclo
//   /produtividade-sdr/oportunidades    → Oportunidades do Evento (visão geral)
//   /produtividade-sdr/oportunidades/ao-vivo | replay | presentes-sem-aplicar | resgate | nao-abordados
//   (/levantou-a-mao redireciona — next.config.mjs)
//   /produtividade-sdr/retencao         → Retenção da audiência
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
  const slug = segmentos?.[0] ?? "";
  const def = ABAS_SDR.find((a) => a.slug === slug);
  if (!def) notFound();
  if (def.soAdmin && user.role !== "admin") redirect(ROTA_SDR);
  // Só "Oportunidades do Evento" tem um segundo nível (os recortes).
  if (segmentos && segmentos.length > 2) notFound();
  const slugRecorte = segmentos?.[1] ?? "";
  if (slugRecorte && def.aba !== "levantou") notFound();
  const recorte = RECORTES_LEVANTOU.find((r) => r.slug === slugRecorte);
  if (!recorte) notFound();

  return (
    <>
      <PageHeader
        titulo="Produtividade SDR"
        descricao="Calls, qualificados, produtos e metas escalonadas — espelho do Dashboard SDR."
      />
      <SdrView aba={def.aba} recorte={recorte.recorte} />
    </>
  );
}
