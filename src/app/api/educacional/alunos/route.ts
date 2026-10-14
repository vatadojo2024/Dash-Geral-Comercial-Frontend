import type { NextRequest } from "next/server";
import { proxyEducacional } from "@/lib/server/proxyEducacional";

// GET /api/educacional/alunos?etapa&risco&checkpoint&responsavel&sinal&health_max&ordem&pagina
// → { itens: AlunoLinha[]; total } (modo api; desligado no mock).
export function GET(req: NextRequest) {
  return proxyEducacional(req, "/api/educacional/alunos");
}
