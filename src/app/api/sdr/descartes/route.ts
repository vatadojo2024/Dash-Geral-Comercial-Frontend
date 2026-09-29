import type { NextRequest } from "next/server";
import { mockDescartes } from "@/lib/mock/sdr_descartes";
import { proxyEventos } from "@/lib/server/proxyEventos";

// GET /api/sdr/descartes?de&ate — proxy da sub-aba "Descartes" (Produtividade
// SDR): quantos leads cada pessoa da pré-venda desqualificou, deu como perdido
// ou mandou para a Nutrição. Mesmo protocolo das rotas de evento (de/ate
// obrigatórios, erros por código, LEADS_MODE mock|api) — ver proxyEventos.
// Em mock, `simular=vazio|usuarios_indisponivel|clint_indisponivel|…`.
export function GET(req: NextRequest) {
  return proxyEventos(req, {
    caminho: "/api/sdr/descartes",
    rotulo: "descartes",
    mock: mockDescartes,
  });
}
