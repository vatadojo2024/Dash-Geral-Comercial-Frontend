import type { NextRequest } from "next/server";
import { mockRetencao } from "@/lib/mock/eventos_retencao";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/retencao?de&ate — proxy da aba "Retenção da audiência"
// (curva de quanto do webinar cada inscrito assistiu, pelas tags "Assistiu N%").
// Fonte por LEADS_MODE (api | mock); ver proxyEventos. Em mock,
// `simular=sem_medicao|vazio` exercita os estados.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/retencao",
    rotulo: "retenção",
    mock: mockRetencao,
  });
}
