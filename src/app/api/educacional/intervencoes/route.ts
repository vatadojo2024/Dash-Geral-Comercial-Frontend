import type { NextRequest } from "next/server";
import { proxyEducacional } from "@/lib/server/proxyEducacional";

// POST /api/educacional/intervencoes { aluno_id, tipo, descricao, responsavel, prazo }
// → Intervencao (modo api; desligado no mock).
export function POST(req: NextRequest) {
  return proxyEducacional(req, "/api/educacional/intervencoes", { method: "POST" });
}
