import type { NextRequest } from "next/server";
import { proxyEducacional } from "@/lib/server/proxyEducacional";

// GET /api/educacional/resumo → ResumoEducacional (modo api; desligado no mock).
export function GET(req: NextRequest) {
  return proxyEducacional(req, "/api/educacional/resumo");
}
