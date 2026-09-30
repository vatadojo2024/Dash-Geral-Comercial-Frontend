import { PageHeader } from "@/components/layout/PageHeader";
import { RetencaoPanel } from "@/features/sdr/RetencaoPanel";
import { exigirArea } from "@/lib/auth/acesso";

// Retenção da audiência: item próprio do menu (fora da Produtividade SDR, a
// pedido do Vata em 23/09). Área `retencao` (admin, SDR e marketing).
// (/produtividade-sdr/retencao redireciona para cá — next.config.mjs.)
export default async function RetencaoPage() {
  await exigirArea("retencao");

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
