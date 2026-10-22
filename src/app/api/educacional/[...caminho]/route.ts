import type { NextRequest } from "next/server";
import { proxyEducacional } from "@/lib/server/proxyEducacional";

// /api/educacional/* (seção 4 do backend da Fase 2) → proxy único, com trava de
// área e validação de caminho (só repassa para baixo de /api/educacional/).
// Modo api do adapter; desligado enquanto NEXT_PUBLIC_EDU_DATA_SOURCE=mock.
export const GET = (req: NextRequest) => proxyEducacional(req);
export const POST = (req: NextRequest) => proxyEducacional(req);
export const PATCH = (req: NextRequest) => proxyEducacional(req);
export const PUT = (req: NextRequest) => proxyEducacional(req);
export const DELETE = (req: NextRequest) => proxyEducacional(req);
