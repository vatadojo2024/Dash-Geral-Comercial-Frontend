import { redirect } from "next/navigation";
import { homeDoUsuario } from "@/lib/auth/areas";
import { getServerSession } from "@/lib/auth/session";

// Home pós-login: a primeira área do usuário (GET /api/me → areas). Admin cai
// na Visão Geral; closer e SDR no Dashboard; marketing na Retenção. Sem área
// nenhuma (educacional, por enquanto) → "Sua área ainda não está disponível".
export default async function Home() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  redirect(homeDoUsuario(user));
}
