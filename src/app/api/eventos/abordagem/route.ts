import type { NextRequest } from "next/server";
import { mockAbordagem } from "@/lib/mock/eventos_abordagem";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/abordagem?de&ate — proxy do recorte "Abordagem" (estado da
// abordagem pela coluna da Clint × presença no webinar). Fonte por LEADS_MODE
// (api | mock); ver proxyEventos.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/abordagem",
    rotulo: "abordagem",
    mock: mockAbordagem,
  });
}
