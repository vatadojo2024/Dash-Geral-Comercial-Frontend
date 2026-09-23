import type { NextRequest } from "next/server";
import { mockPresentes } from "@/lib/mock/eventos_presentes";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/presentes-sem-aplicar?de&ate — proxy da aba "Presentes que
// não aplicaram" (MQL+ ou acima, presentes ao vivo, sem aplicar no evento).
// Fonte por LEADS_MODE (api | mock); ver proxyEventos. Em mock,
// `simular=agendados|vazio|sem_contatos` exercita os estados.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/presentes-sem-aplicar",
    rotulo: "presentes sem aplicar",
    mock: mockPresentes,
  });
}
