import type { NextRequest } from "next/server";
import { mockAusentes } from "@/lib/mock/eventos_ausentes";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/ausentes?de&ate — proxy do recorte "Não participaram —
// Qualificados" (MQL+ ou acima, inscritos, sem nenhum sinal de presença ao vivo).
// Fonte por LEADS_MODE (api | mock); ver proxyEventos. Em mock,
// `simular=vazio|sem_contatos` exercita os estados.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/ausentes",
    rotulo: "ausentes",
    mock: mockAusentes,
  });
}
