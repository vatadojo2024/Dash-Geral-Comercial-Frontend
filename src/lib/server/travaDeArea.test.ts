import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Role, SessionUser } from "@/lib/api/contracts";
import { AREAS_DO_PAPEL, modulosDeAreas } from "@/lib/auth/areas";

// Trava de área nas rotas comerciais do front com os dados de demonstração
// (LEADS_MODE=mock): mesmo 403 { error: "Sem permissão" } do modo real, e
// nada muda para os papéis comerciais.

const sessao = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/session", () => ({ getServerSession: async () => sessao.user }));

function como(role: Role) {
  const areas = [...AREAS_DO_PAPEL[role]];
  sessao.user = { id: role === "closer" ? "marcio" : role, nome: role, email: `${role}@vatadojo.com.br`, role, areas, modulos: modulosDeAreas(areas) };
}

const req = (url: string) => new NextRequest(`http://localhost${url}`);
const PERIODO = "?de=2026-09-29&ate=2026-10-05";

async function status(rota: () => Promise<Response>) {
  const res = await rota();
  return { status: res.status, corpo: res.status === 403 ? await res.json() : null };
}

describe("rotas comerciais em modo mock", () => {
  beforeEach(() => {
    vi.stubEnv("LEADS_MODE", "mock");
    vi.stubEnv("SDR_DASHBOARD_MODE", "mock");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    sessao.user = null;
  });

  it("educacional recebe 403 'Sem permissão' em leads, eventos, Calls por Ciclo e vendas", async () => {
    como("educacional");
    const { GET: leads } = await import("@/app/api/leads/route");
    const { GET: detalhe } = await import("@/app/api/leads/[leadId]/route");
    const { GET: oportunidades } = await import("@/app/api/eventos/oportunidades/route");
    const { GET: retencao } = await import("@/app/api/eventos/retencao/route");
    const { GET: descartes } = await import("@/app/api/sdr/descartes/route");
    const { GET: calls } = await import("@/app/api/sdr/agendamentos/route");
    const { GET: vendas } = await import("@/app/api/sales/closer/route");
    const respostas = [
      await status(() => leads(req("/api/leads"))),
      await status(() => detalhe(req("/api/leads/ld_0001"), { params: Promise.resolve({ leadId: "ld_0001" }) })),
      await status(() => oportunidades(req(`/api/eventos/oportunidades${PERIODO}`))),
      await status(() => retencao(req(`/api/eventos/retencao${PERIODO}`))),
      await status(() => descartes(req(`/api/sdr/descartes${PERIODO}`))),
      await status(() => calls(req("/api/sdr/agendamentos?inicio=2026-09-29&fim=2026-10-05"))),
      await status(() => vendas(req("/api/sales/closer?closer=marcio"))),
    ];
    for (const r of respostas) expect(r).toEqual({ status: 403, corpo: { error: "Sem permissão" } });
  });

  it("papéis comerciais seguem acessando o que já acessavam", async () => {
    const { GET: leads } = await import("@/app/api/leads/route");
    const { GET: oportunidades } = await import("@/app/api/eventos/oportunidades/route");
    const { GET: retencao } = await import("@/app/api/eventos/retencao/route");
    const { GET: vendas } = await import("@/app/api/sales/closer/route");
    como("closer");
    expect((await leads(req("/api/leads"))).status).toBe(200);
    expect((await vendas(req("/api/sales/closer?closer=marcio"))).status).toBe(200);
    como("sdr");
    expect((await leads(req("/api/leads"))).status).toBe(200);
    expect((await oportunidades(req(`/api/eventos/oportunidades${PERIODO}`))).status).toBe(200);
    como("marketing");
    expect((await retencao(req(`/api/eventos/retencao${PERIODO}`))).status).toBe(200);
    como("admin");
    expect((await vendas(req("/api/sales/closer?closer=marcio"))).status).toBe(200);
  });

  it("mesma área que o backend: closer não tem Produtividade SDR", async () => {
    const { GET: oportunidades } = await import("@/app/api/eventos/oportunidades/route");
    como("closer");
    expect((await oportunidades(req(`/api/eventos/oportunidades${PERIODO}`))).status).toBe(403);
  });

  it("vendas exigem login em qualquer modo (antes não exigiam nada)", async () => {
    const { GET: vendas } = await import("@/app/api/sales/closer/route");
    expect((await vendas(req("/api/sales/closer?closer=marcio"))).status).toBe(401);
    vi.stubEnv("SDR_DASHBOARD_MODE", "api");
    expect((await vendas(req("/api/sales/closer?closer=marcio"))).status).toBe(401);
  });

  it("usuários: como no backend, só exige login", async () => {
    const { GET: usuarios } = await import("@/app/api/usuarios/route");
    expect((await usuarios(req("/api/usuarios"))).status).toBe(401);
    como("educacional");
    expect((await usuarios(req("/api/usuarios"))).status).toBe(200);
  });
});
