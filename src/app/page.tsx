import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";

// Home pós-login por papel (Parte 7): admin cai na Visão Geral; closer e SDR
// continuam no Dashboard.
export default async function Home() {
  const user = await getServerSession();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/visao-geral" : "/dashboard");
}
