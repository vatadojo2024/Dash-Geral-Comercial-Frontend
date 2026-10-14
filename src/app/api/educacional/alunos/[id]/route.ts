import type { NextRequest } from "next/server";
import { proxyEducacional } from "@/lib/server/proxyEducacional";

// GET /api/educacional/alunos/:id → AlunoDetalhe (modo api; desligado no mock).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyEducacional(req, `/api/educacional/alunos/${encodeURIComponent(id)}`);
}
