import type { Metadata } from "next";
import type { ReactNode } from "react";
import { exigirArea } from "@/lib/auth/acesso";

// Guarda do módulo Educacional, no servidor e antes de qualquer conteúdo: sem a
// área `educacional`, vai para "/" (que manda à home do módulo permitido). As
// páginas comerciais têm a guarda delas (exigirArea), então o educacional que
// abre uma rota comercial também volta para cá.
export const metadata: Metadata = {
  title: "Saúde da Jornada — Vata Dojo",
  description: "Acompanhamento da jornada dos alunos.",
};

export default async function EducacionalLayout({ children }: { children: ReactNode }) {
  await exigirArea("educacional");
  return <>{children}</>;
}
