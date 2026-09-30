import { LeadDetailView } from "@/features/leads/LeadDetailView";
import { exigirArea } from "@/lib/auth/acesso";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await exigirArea("leads");
  const { leadId } = await params;
  return <LeadDetailView leadId={leadId} />;
}
