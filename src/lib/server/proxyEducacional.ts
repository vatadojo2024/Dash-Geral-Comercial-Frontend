import { NextResponse, type NextRequest } from "next/server";
import { exigirAreaNaApi } from "./acessoApi";

// ---------------------------------------------------------------------------
// Proxy ÚNICO do módulo Educacional (modo `api` do adapter — DESLIGADO enquanto
// NEXT_PUBLIC_EDU_DATA_SOURCE=mock), usado por /api/educacional/[...caminho].
//   - Só repassa para caminhos SOB /api/educacional/ no backend. Segmento "." ou
//     "..", barra dupla, barra invertida, barra ou ponto codificados que saiam do
//     prefixo e codificação dupla → 400, antes de qualquer chamada.
//   - Trava pela área `educacional` (401/403).
//   - Repassa o Bearer da sessão; devolve 400/401/403/404/409 como vieram (o
//     409 traz o aluno atual ou a contagem de alunos); o resto vira 502.
// ---------------------------------------------------------------------------

const PREFIXO = "/api/educacional/";
const METODOS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
type Metodo = (typeof METODOS)[number];
// Segmento já decodificado: ids (uuid), nomes de rota e de campo. Nada além disso.
const SEGMENTO_OK = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const REPASSA = [400, 401, 403, 404, 409];

const caminhoInvalido = () =>
  NextResponse.json({ error: "validacao", campo: "caminho", mensagem: "Caminho inválido." }, { status: 400 });

// Recebe o pathname CRU da requisição (ainda codificado) e devolve os segmentos
// seguros, ou null. Exportada para os testes.
export function caminhoSeguro(pathnameCru: string): string[] | null {
  if (!pathnameCru.startsWith(PREFIXO)) return null;
  const resto = pathnameCru.slice(PREFIXO.length);
  if (!resto || resto.includes("//") || resto.includes("\\") || resto.endsWith("/")) return null;
  const segmentos: string[] = [];
  for (const cru of resto.split("/")) {
    let decodificado: string;
    try {
      decodificado = decodeURIComponent(cru);
    } catch {
      return null; // % malformado
    }
    // Codificação dupla (%252e…) ou qualquer coisa fora da lista (/, \, %, espaço…).
    if (decodificado.includes("%") || !SEGMENTO_OK.test(decodificado)) return null;
    if (decodificado === "." || decodificado === "..") return null;
    segmentos.push(decodificado);
  }
  return segmentos;
}

export async function proxyEducacional(req: NextRequest): Promise<NextResponse> {
  const segmentos = caminhoSeguro(req.nextUrl.pathname);
  if (!segmentos) return caminhoInvalido();
  const metodo = req.method.toUpperCase() as Metodo;
  if (!METODOS.includes(metodo)) return NextResponse.json({ error: "Método não permitido." }, { status: 405 });

  const { negado } = await exigirAreaNaApi("educacional");
  if (negado) return negado;

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return NextResponse.json({ error: "Configure NEXT_PUBLIC_API_URL." }, { status: 500 });
  const token = req.headers.get("authorization");
  if (!token) return NextResponse.json({ error: "Sem token da sessão — faça login novamente." }, { status: 401 });

  // Remonta o caminho a partir dos segmentos validados (recodificados).
  const destino = `${base.replace(/\/$/, "")}${PREFIXO}${segmentos.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const temCorpo = metodo !== "GET";
  // O corpo vai como veio, em bytes, com o Content-Type original: JSON ou
  // multipart da análise de aula (o boundary está no Content-Type).
  const tipo = req.headers.get("content-type") ?? "application/json";
  try {
    const res = await fetch(destino, {
      method: metodo,
      headers: { Authorization: token, ...(temCorpo ? { "Content-Type": tipo } : {}) },
      body: temCorpo ? await req.arrayBuffer() : undefined,
      cache: "no-store",
    });
    const corpo = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      return NextResponse.json(corpo ?? { error: `O serviço educacional respondeu ${res.status}.` }, {
        status: REPASSA.includes(res.status) ? res.status : 502,
      });
    }
    return NextResponse.json(corpo, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar o serviço educacional: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
