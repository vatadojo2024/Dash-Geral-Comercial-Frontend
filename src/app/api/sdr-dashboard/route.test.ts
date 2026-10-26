import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/api/contracts";
import { AREAS_DO_PAPEL, modulosDeAreas } from "@/lib/auth/areas";

// /api/sdr-dashboard em modo api, com a API externa simulada. A resposta tem de
// ser IDÊNTICA à do código antes da correção 2 (3 ondas em sequência), gravada
// em __fixtures__/esperado.json: mesmo conteúdo, mesma ordem de campos e mesmo
// status em sucesso e em cada tipo de falha. E as 13 chamadas saem juntas.

const sessao = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("@/lib/auth/session", () => ({ getServerSession: async () => sessao.user }));

const BASE = "https://api.exemplo.test";
const FIXTURE = path.join(__dirname, "__fixtures__", "esperado.json");

type Cenario = { nome: string; falha: string[] };
const CENARIOS: Cenario[] = [
  { nome: "sucesso", falha: [] },
  { nome: "falha_lideranca", falha: ["/api/closer/realizadas"] },
  { nome: "falha_vendas", falha: ["/api/sdr/vendas-por-produto"] },
  { nome: "falha_sdr", falha: ["/api/sdr/no-show"] },
  { nome: "falha_sdr_e_lideranca", falha: ["/api/sdr/no-show", "/api/marketing/leads"] },
];

// Linhas determinísticas por caminho, com o total no nome que a API usa.
function linhas(caminho: string) {
  const n = caminho.length;
  if (caminho === "/api/sdr/vendas-por-produto") {
    return [
      { sdr: "Ana", data_referencia: "2026-10-20", produto: "Prime", total_faturado: 12000, total_vendas: 2 },
      { sdr: null, data_referencia: "2026-10-21", produto: "Black", total_faturado: 5000, total_vendas: 1 },
      { sdr: "Bia", data_referencia: "2026-10-22", produto: null, total_faturado: 7000, total_vendas: 1 },
    ];
  }
  const campo = caminho.includes("leads")
    ? "total_leads"
    : caminho.includes("qualificados")
      ? "total_qualificados"
      : caminho.includes("no-show")
        ? "total_no_show"
        : caminho.includes("remarcadas")
          ? "total_remarcadas"
          : caminho.includes("agendadas")
            ? "total_agendadas"
            : "total_realizadas";
  const quem = caminho.includes("/closer/") ? { closer: "Marcio" } : { sdr: "Ana" };
  return [
    { ...quem, produto: "Prime", data_referencia: "2026-10-20", [campo]: n },
    { ...quem, qualificacao: "MQL", data_referencia: "2026-10-21", [campo]: n + 1, extra: "ignorado" },
    { ...quem, data_referencia: "2026-10-22", [campo]: "não numérico" },
  ];
}

let emVoo = 0;
let maxEmVoo = 0;
let chamadas: string[] = [];

function apiSimulada(falha: string[]) {
  return vi.fn(async (url: string) => {
    const caminho = new URL(url).pathname;
    chamadas.push(caminho);
    emVoo++;
    maxEmVoo = Math.max(maxEmVoo, emVoo);
    await new Promise((r) => setTimeout(r, 15));
    emVoo--;
    if (falha.includes(caminho)) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify(linhas(caminho)), { status: 200 });
  });
}

async function rodar(c: Cenario) {
  vi.stubGlobal("fetch", apiSimulada(c.falha));
  const { GET } = await import("./route");
  const res = await GET();
  return { status: res.status, corpo: await res.text() };
}

describe("/api/sdr-dashboard (modo api)", () => {
  beforeEach(() => {
    vi.stubEnv("SDR_DASHBOARD_MODE", "api");
    vi.stubEnv("SDR_DASHBOARD_API_URL", BASE);
    vi.stubEnv("SDR_DASHBOARD_API_KEY", "chave-de-teste");
    const areas = [...AREAS_DO_PAPEL.admin];
    sessao.user = { id: "vata", nome: "Vata", email: "vata@vatadojo.com.br", role: "admin", areas, modulos: modulosDeAreas(areas) };
    vi.spyOn(console, "error").mockImplementation(() => {});
    emVoo = 0;
    maxEmVoo = 0;
    chamadas = [];
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Rodar com GRAVAR=1 só no código antigo, para registrar a referência.
  if (process.env.GRAVAR === "1") {
    it("grava a referência (código antes da correção 2)", async () => {
      const saida: Record<string, unknown> = {};
      for (const c of CENARIOS) saida[c.nome] = await rodar(c);
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, JSON.stringify(saida, null, 2) + "\n");
    });
    return;
  }

  const esperado = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Record<string, { status: number; corpo: string }>;

  it.each(CENARIOS)("$nome: mesma resposta, byte a byte, que antes da correção", async (c) => {
    const r = await rodar(c);
    expect(r.status).toBe(esperado[c.nome].status);
    expect(r.corpo).toBe(esperado[c.nome].corpo);
  });

  it("as 13 chamadas à API externa saem juntas (uma onda só)", async () => {
    await rodar(CENARIOS[0]);
    expect(chamadas).toHaveLength(13);
    expect(maxEmVoo).toBe(13);
  });
});
