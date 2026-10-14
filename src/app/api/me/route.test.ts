import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// /api/me com a API real respondendo e o mock local do módulo Educacional
// (ME_MOCK_EDUCACIONAL=1) — o caminho de quem testa com login do Supabase
// antes de o backend mandar `modulos` e a área `educacional`.

function apiResponde(corpo: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })));
}

async function me() {
  const res = await GET(new NextRequest("http://localhost/api/me", { headers: { authorization: "Bearer x" } }));
  return (await res.json()) as { areas: string[]; modulos: string[]; role: string };
}

const base = { id: "u1", nome: "Fulana", email: "fulana@vatadojo.com.br" };

describe("GET /api/me — módulos", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.local");
    vi.stubEnv("VERCEL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("usa `modulos` e `areas` da API quando vêm", async () => {
    apiResponde({ ...base, role: "educacional", areas: ["educacional"], modulos: ["educacional"] });
    expect(await me()).toMatchObject({ areas: ["educacional"], modulos: ["educacional"] });
  });

  it("sem o mock, API antiga: educacional fica sem módulo (nada é inventado)", async () => {
    apiResponde({ ...base, role: "educacional", areas: [] });
    expect(await me()).toMatchObject({ areas: [], modulos: [] });
  });

  it("mock local: completa área e módulo para educacional e admin", async () => {
    vi.stubEnv("ME_MOCK_EDUCACIONAL", "1");
    apiResponde({ ...base, role: "educacional", areas: [] });
    expect(await me()).toMatchObject({ areas: ["educacional"], modulos: ["educacional"] });
    apiResponde({ ...base, role: "admin", areas: ["visao_geral", "dashboard"] });
    expect(await me()).toMatchObject({ areas: ["visao_geral", "dashboard", "educacional"], modulos: ["comercial", "educacional"] });
  });

  it("mock local não toca papéis comerciais", async () => {
    vi.stubEnv("ME_MOCK_EDUCACIONAL", "1");
    apiResponde({ ...base, role: "closer", areas: ["dashboard", "leads"] });
    expect(await me()).toMatchObject({ areas: ["dashboard", "leads"], modulos: ["comercial"] });
  });

  it("na Vercel o mock é ignorado", async () => {
    vi.stubEnv("ME_MOCK_EDUCACIONAL", "1");
    vi.stubEnv("VERCEL", "1");
    apiResponde({ ...base, role: "educacional", areas: [] });
    expect(await me()).toMatchObject({ modulos: [] });
  });
});
