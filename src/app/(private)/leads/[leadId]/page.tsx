import { LeadDetailView } from "@/features/leads/LeadDetailView";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <LeadDetailView leadId={leadId} />;
}
