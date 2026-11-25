import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SessionUser } from "@/lib/api/contracts";
import { AREAS_DO_PAPEL, modulosDeAreas } from "@/lib/auth/areas";

// /api/eventos/comparativo em modo mock: o route handler faz a checagem de
// PAPEL que o backend faz (só admin), com o mesmo 401/403.

const sessao = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/session", () => ({ getServerSession: async () => sessao.user }));

const { GET } = await import("./route");

function usuario(role: SessionUser["role"]): SessionUser {
  const areas = [...AREAS_DO_PAPEL[role]];
  return { id: role, nome: role, email: `${role}@exemplo.test`, role, areas, modulos: modulosDeAreas(areas) };
}
const pedir = (qs = "") => GET(new NextRequest(`http://localhost/api/eventos/comparativo${qs}`));

beforeEach(() => {
  vi.stubEnv("LEADS_MODE", "mock");
});
afterEach(() => {
  vi.unstubAllEnvs();
  sessao.user = null;
});

describe("GET /api/eventos/comparativo (mock)", () => {
  it("bloqueia quem não é admin com 403, mesmo quem tem área de eventos", async () => {
    for (const role of ["closer", "sdr", "marketing", "educacional"] as const) {
      sessao.user = usuario(role);
      const r = await pedir();
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: "Sem permissão" });
    }
  });

  it("sem sessão: 401", async () => {
    expect((await pedir()).status).toBe(401);
  });

  it("admin: a série, com de e ate opcionais", async () => {
    sessao.user = usuario("admin");
    const tudo = await (await pedir()).json();
    expect(tudo.eventos.length).toBeGreaterThan(12);
    const recorte = await (await pedir("?de=2026-11-01&ate=2026-11-30")).json();
    expect(recorte.eventos.map((e: { data_evento: string }) => e.data_evento)).toEqual([
      "2026-11-03",
      "2026-11-10",
      "2026-11-17",
      "2026-11-24",
    ]);
  });

  it("parâmetros inválidos: 400", async () => {
    sessao.user = usuario("admin");
    expect((await pedir("?de=24/11/2026")).status).toBe(400);
    expect((await pedir("?de=2026-11-30&ate=2026-11-01")).status).toBe(400);
  });

  it("simular=comparativo_indisponivel: 502 com o código do backend", async () => {
    sessao.user = usuario("admin");
    const r = await pedir("?simular=comparativo_indisponivel");
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erro: "comparativo_indisponivel" });
  });
});
