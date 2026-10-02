import type { NextRequest } from "next/server";
import { mockIncognitas } from "@/lib/mock/eventos_incognitas";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/incognitas?de&ate — proxy do recorte "Incógnitas"
// (inscritos sem nenhuma tag de classificação). Fonte por LEADS_MODE (api |
// mock); ver proxyEventos.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/incognitas",
    rotulo: "incógnitas",
    mock: mockIncognitas,
  });
}
