import type { NextRequest } from "next/server";
import { mockOportunidades } from "@/lib/mock/eventos_oportunidades";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/oportunidades?de&ate — proxy da aba "Oportunidades do Evento".
// Fonte por LEADS_MODE (api | mock); ver proxyEventos. Em mock, além dos erros,
// `simular=vazio|sem_contatos|desqualificados|sem_replay|sem_resgate|base_inflada`
// exercita os estados da tela.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/oportunidades",
    rotulo: "oportunidades",
    mock: mockOportunidades,
  });
}
