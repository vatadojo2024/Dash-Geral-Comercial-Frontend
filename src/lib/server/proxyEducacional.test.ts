import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Role, SessionUser } from "@/lib/api/contracts";
import { AREAS_DO_PAPEL, modulosDeAreas } from "@/lib/auth/areas";
import { caminhoSeguro } from "./proxyEducacional";

// Proxy único /api/educacional/[...caminho]: só repassa para baixo de
// /api/educacional/ no backend; trava de área; status repassados.

const sessao = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/session", () => ({ getServerSession: async () => sessao.user }));

function como(role: Role) {
  const areas = [...AREAS_DO_PAPEL[role]];
  sessao.user = { id: role, nome: role, email: `${role}@vatadojo.com.br`, role, areas, modulos: modulosDeAreas(areas) };
}

const BASE = "https://api.exemplo.test";
const fetchMock = vi.fn();

type Init = { method?: string; body?: BodyInit; headers?: Record<string, string> };

function req(caminho: string, init?: Init) {
  return new NextRequest(`http://localhost${caminho}`, {
    method: init?.method ?? "GET",
    body: init?.body,
    headers: { authorization: "Bearer jwt-da-sessao", ...init?.headers },
  });
}

const texto = (b: unknown) => new TextDecoder().decode(b as ArrayBuffer);

async function chamar(caminho: string, init?: Init) {
  const rota = await import("@/app/api/educacional/[...caminho]/route");
  const metodo = (init?.method ?? "GET") as "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  return rota[metodo](req(caminho, init));
}

describe("caminhoSeguro", () => {
  it("aceita as rotas da seção 4 do backend", () => {
    expect(caminhoSeguro("/api/educacional/resumo")).toEqual(["resumo"]);
    expect(caminhoSeguro("/api/educacional/alunos/3f1c-9a/ajustes/health_score")).toEqual([
      "alunos",
      "3f1c-9a",
      "ajustes",
      "health_score",
    ]);
    expect(caminhoSeguro("/api/educacional/config/checkpoints-modelo/abc")).toEqual(["config", "checkpoints-modelo", "abc"]);
  });

  it.each([
    ["..%2Fleads", "/api/educacional/..%2Fleads"],
    ["%2e%2e%2fleads", "/api/educacional/%2e%2e%2fleads"],
    ["%2E%2E/leads", "/api/educacional/%2E%2E/leads"],
    ["..", "/api/educacional/alunos/.."],
    [".", "/api/educacional/./resumo"],
    ["barra dupla", "/api/educacional//leads"],
    ["barra dupla no meio", "/api/educacional/alunos//x"],
    ["barra codificada", "/api/educacional/alunos%2F..%2F..%2Fleads"],
    ["codificação dupla", "/api/educacional/%252e%252e%252fleads"],
    ["codificação dupla do ponto", "/api/educacional/%252e%252e/leads"],
    ["barra invertida", "/api/educacional/alunos\\..\\leads"],
    ["barra invertida codificada", "/api/educacional/alunos%5C..%5Cleads"],
    ["% malformado", "/api/educacional/alunos/%E0%A4%A"],
    ["vazio", "/api/educacional/"],
    ["barra no fim", "/api/educacional/resumo/"],
    ["fora do prefixo", "/api/leads"],
    ["prefixo parecido", "/api/educacionalx/resumo"],
  ])("rejeita %s", (_nome, caminho) => {
    expect(caminhoSeguro(caminho)).toBeNull();
  });
});

describe("rota /api/educacional/[...caminho]", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    sessao.user = null;
  });

  it.each(["/api/educacional/..%2Fleads", "/api/educacional/%2e%2e%2Fleads", "/api/educacional/%252e%252e%252fleads", "/api/educacional/alunos%5C..%5Cleads"])(
    "%s → 400 sem chamar o backend",
    async (caminho) => {
      como("educacional");
      const res = await chamar(caminho);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "validacao", campo: "caminho" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("caminho válido: repassa método, corpo, query e o Bearer para baixo de /api/educacional/", async () => {
    como("educacional");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await chamar("/api/educacional/alunos/abc-1?versao=3", { method: "PATCH", body: '{"nome":"X","versao":3}' });
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/educacional/alunos/abc-1?versao=3`);
    expect(init.method).toBe("PATCH");
    expect(texto(init.body)).toBe('{"nome":"X","versao":3}');
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-da-sessao");
  });

  it("multipart (análise de aula) passa em bytes, com o Content-Type e o boundary originais", async () => {
    como("educacional");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "an-1" }), { status: 202 }));
    const fd = new FormData();
    fd.set("aluno_id", "a1");
    fd.set("arquivo", new File(["1\n00:00:01,000 --> 00:00:02,000\nOlá"], "aula.srt", { type: "text/plain" }));
    const enviado = new Request("http://x", { method: "POST", body: fd });
    const tipo = enviado.headers.get("content-type")!;
    const bytes = await enviado.arrayBuffer();
    const res = await chamar("/api/educacional/analises", { method: "POST", body: bytes, headers: { "content-type": tipo } });
    expect(res.status).toBe(202);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(tipo);
    expect(tipo).toMatch(/^multipart\/form-data; boundary=/);
    expect(texto(init.body)).toBe(texto(bytes));
  });

  it("409 passa com o corpo (aluno atual); 500 do backend vira 502", async () => {
    como("admin");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "versao", aluno: { id: "a" } }), { status: 409 }));
    const r409 = await chamar("/api/educacional/alunos/a", { method: "PATCH", body: "{}" });
    expect(r409.status).toBe(409);
    expect(await r409.json()).toEqual({ error: "versao", aluno: { id: "a" } });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect((await chamar("/api/educacional/resumo")).status).toBe(502);
  });

  it("papéis comerciais recebem 403 e nada é repassado", async () => {
    for (const role of ["closer", "sdr", "marketing"] as Role[]) {
      como(role);
      const res = await chamar("/api/educacional/resumo");
      expect(res.status).toBe(403);
    }
    sessao.user = null;
    expect((await chamar("/api/educacional/resumo")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
