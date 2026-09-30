import { redirect } from "next/navigation";
import type { Area, SessionUser } from "@/lib/api/contracts";
import { temArea } from "./areas";
import { getServerSession } from "./session";

// Guarda das páginas (server): sem sessão → login; sem NENHUMA das áreas → "/",
// que manda para a home do usuário (a primeira área dele, ou a tela "Sua área
// ainda não está disponível"). Sem loop: a home de cada área é guardada pela
// própria área.
export async function exigirArea(...areas: Area[]): Promise<SessionUser> {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (!areas.some((a) => temArea(user, a))) redirect("/");
  return user;
}
