import type { NextRequest } from "next/server";
import { mockNaoAbordados } from "@/lib/mock/eventos_nao_abordados";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/nao-abordados?de&ate — proxy do recorte "Não abordados"
// (inscritos no evento cujo negócio mais recente está em "Sem atendimento").
// Fonte por LEADS_MODE (api | mock); ver proxyEventos.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/nao-abordados",
    rotulo: "não abordados",
    mock: mockNaoAbordados,
  });
}
