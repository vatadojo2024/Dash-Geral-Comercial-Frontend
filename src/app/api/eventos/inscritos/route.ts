import type { NextRequest } from "next/server";
import { mockInscritos } from "@/lib/mock/eventos_inscritos";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/eventos/inscritos?de&ate — CONTRATO PROVISÓRIO (23/09): todos os
// inscritos do ciclo com os sinais (presença, aplicação, levantou a mão,
// agendou, replay, etapa). Enquanto o backend não publicar a rota, em
// LEADS_MODE=api ela responde 404 e a Visão geral cai nos pendentes.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/eventos/inscritos",
    rotulo: "inscritos",
    mock: mockInscritos,
  });
}
