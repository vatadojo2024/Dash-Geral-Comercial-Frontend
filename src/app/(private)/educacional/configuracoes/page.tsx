import type { Metadata } from "next";
import { ConfiguracoesView } from "@/features/educacional/Configuracoes";

// Configurações do módulo Educacional (spec Fase 2, 6.3). A guarda de acesso
// (área `educacional`: admin e educacional) fica no layout do módulo.
export const metadata: Metadata = { title: "Configurações · Saúde da Jornada — Vata Dojo" };

export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}
