"use client";

import type { ReactNode } from "react";
import { definirUsuarioDaSessao } from "@/lib/educacional/apiEducacional";
import { useSession } from "@/features/session/SessionProvider";
import { ProvedorAvisos } from "./Avisos";
import { ProvedorLote } from "./lote/ProvedorLote";

// Casca do módulo Educacional (layout): avisos de gravação, alterações
// pendentes do salvar em lote (com a barra e a guarda de saída) e, no modo
// demonstração, o usuário logado como autor no histórico (no modo api é o JWT).
export function ModuloEducacional({ children }: { children: ReactNode }) {
  const user = useSession();
  definirUsuarioDaSessao({ id: user.id, nome: user.nome });
  return (
    <ProvedorAvisos>
      <ProvedorLote>{children}</ProvedorLote>
    </ProvedorAvisos>
  );
}
