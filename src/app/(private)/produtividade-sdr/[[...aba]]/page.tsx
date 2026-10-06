import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ABAS_SDR, RECORTES_LEVANTOU, ROTA_SDR } from "@/features/sdr/abas";
import { SdrView } from "@/features/sdr/SdrView";
import { exigirArea } from "@/lib/auth/acesso";
import { ROTA_DA_AREA, temArea } from "@/lib/auth/areas";

// ---------------------------------------------------------------------------
// Produtividade SDR com uma rota por sub-aba:
//   /produtividade-sdr                  → Dashboard SDR
//   /produtividade-sdr/calls-por-ciclo  → Calls por Ciclo
//   /produtividade-sdr/oportunidades    → Oportunidades do Evento (visão geral)
//   /produtividade-sdr/oportunidades/ao-vivo | replay | presentes-sem-aplicar | nao-participaram | resgate | nao-abordados | incognitas | abordagem | descartes
//   (/levantou-a-mao redireciona — next.config.mjs)
//   /produtividade-sdr/comissoes        → Comissões
//   /produtividade-sdr/lideranca        → Liderança Pré-venda (área lideranca_pre_venda)
// Cada sub-aba exige a área dela (abas.ts); as demais são produtividade_sdr.
// (/sdr antigo redireciona para cá — next.config.mjs.)
// ---------------------------------------------------------------------------

export default async function ProdutividadeSdrPage({
  params,
}: {
  params: Promise<{ aba?: string[] }>;
}) {
  const user = await exigirArea("produtividade_sdr", "lideranca_pre_venda");

  const { aba: segmentos } = await params;
  const slug = segmentos?.[0] ?? "";
  const def = ABAS_SDR.find((a) => a.slug === slug);
  if (!def) notFound();
  if (!temArea(user, def.area)) {
    // Sem a sub-aba pedida: vai para a entrada da Produtividade SDR que ele tem.
    redirect(temArea(user, "produtividade_sdr") ? ROTA_SDR : ROTA_DA_AREA.lideranca_pre_venda);
  }
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
