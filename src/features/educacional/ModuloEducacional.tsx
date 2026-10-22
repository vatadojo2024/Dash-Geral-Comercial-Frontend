"use client";

import type { ReactNode } from "react";
import { definirUsuarioDaSessao } from "@/lib/educacional/apiEducacional";
import { useSession } from "@/features/session/SessionProvider";
import { ProvedorAvisos } from "./Avisos";

// Casca do módulo Educacional (layout): avisos de gravação e, no modo
// demonstração, o usuário logado como autor no histórico (no modo api é o JWT).
export function ModuloEducacional({ children }: { children: ReactNode }) {
  const user = useSession();
  definirUsuarioDaSessao({ id: user.id, nome: user.nome });
  return <ProvedorAvisos>{children}</ProvedorAvisos>;
}
