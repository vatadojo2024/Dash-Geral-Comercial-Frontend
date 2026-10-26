import { NextResponse } from "next/server";
import mock from "@/lib/mock/sdr_dashboard.json";
import { exigirAreaNaApi } from "@/lib/server/acessoApi";
import { mapVendasComercial } from "@/lib/server/apiVendas";

// ---------------------------------------------------------------------------
// Route handler SERVER-SIDE do Dashboard SDR: a chave da API externa NUNCA
// vai ao navegador. Modo controlado por SDR_DASHBOARD_MODE:
//   - "mock": devolve src/lib/mock/sdr_dashboard.json
//   - "api": busca os 12 endpoints da API externa (api.infradojo.pro) com
//     X-API-Key + Authorization: Bearer e monta o MESMO payload do contrato.
// DIVERGÊNCIA DE CAMPO (verificada em 11/06/2026): a API devolve o total com
// nome por endpoint (total_agendadas, total_realizadas, total_no_show,
// total_remarcadas, total_leads, total_qualificados; por-produto usa
// total_realizadas) — o mapeamento para o `total` genérico do contrato é
// feito AQUI, e só aqui.
// Erro isolado (6.5g): se só a carga da LIDERANÇA falhar, os dados SDR voltam
// normalmente com `lideranca_erro` preenchido — a aba SDR continua de pé.
// ---------------------------------------------------------------------------

type Rota = { caminho: string; campoTotal: string };

const ROTAS_SDR: Record<string, Rota> = {
  agendadas: { caminho: "/api/sdr/agendadas", campoTotal: "total_agendadas" },
  realizadas: { caminho: "/api/sdr/realizadas", campoTotal: "total_realizadas" },
  no_show: { caminho: "/api/sdr/no-show", campoTotal: "total_no_show" },
  por_produto: { caminho: "/api/sdr/por-produto", campoTotal: "total_realizadas" },
  remarcadas: { caminho: "/api/sdr/remarcadas", campoTotal: "total_remarcadas" },
};

const ROTAS_LIDERANCA: Record<string, Rota> = {
  marketing_leads: { caminho: "/api/marketing/leads", campoTotal: "total_leads" },
  marketing_qualificados: {
    caminho: "/api/marketing/qualificados",
    campoTotal: "total_qualificados",
  },
  closer_agendadas: { caminho: "/api/closer/agendadas", campoTotal: "total_agendadas" },
  closer_realizadas: {
    caminho: "/api/closer/realizadas",
    campoTotal: "total_realizadas",
  },
  closer_no_show: { caminho: "/api/closer/no-show", campoTotal: "total_no_show" },
  closer_por_produto: {
    caminho: "/api/closer/por-produto",
    campoTotal: "total_realizadas",
  },
  closer_remarcadas: {
    caminho: "/api/closer/remarcadas",
    campoTotal: "total_remarcadas",
  },
};

// Linha da API externa → linha do contrato interno ({..., total}).
function mapearLinhas(linhas: unknown, campoTotal: string): unknown[] {
  if (!Array.isArray(linhas)) {
    throw new Error(`resposta não é uma lista (recebido ${typeof linhas})`);
  }
  return linhas.map((linha) => {
    const l = linha as Record<string, unknown>;
    return {
      ...(typeof l.sdr === "string" ? { sdr: l.sdr } : {}),
      ...(typeof l.closer === "string" ? { closer: l.closer } : {}),
      ...(typeof l.produto === "string" ? { produto: l.produto } : {}),
      ...(typeof l.qualificacao === "string" ? { qualificacao: l.qualificacao } : {}),
      data_referencia: l.data_referencia,
      total: typeof l[campoTotal] === "number" ? l[campoTotal] : 0,
    };
  });
}

export async function GET() {
  // Não passa pela API do Mapa de Calor: a trava por área fica aqui. Quem lê
  // este payload: Produtividade SDR, a sub-aba Liderança e a Visão Geral.
  const { negado } = await exigirAreaNaApi("produtividade_sdr", "lideranca_pre_venda", "visao_geral");
  if (negado) return negado;

  const modo = process.env.SDR_DASHBOARD_MODE === "api" ? "api" : "mock";

  if (modo === "mock") {
    return NextResponse.json(mock);
  }

  const base = process.env.SDR_DASHBOARD_API_URL;
  const chave = process.env.SDR_DASHBOARD_API_KEY;
  if (!base || !chave) {
    return NextResponse.json(
      { error: "Configure SDR_DASHBOARD_API_URL e SDR_DASHBOARD_API_KEY no .env" },
      { status: 500 },
    );
  }

  const headers = {
    "X-API-Key": chave,
    Authorization: `Bearer ${chave}`,
  };

  async function buscar(rota: Rota): Promise<unknown[]> {
    const res = await fetch(`${base!.replace(/\/$/, "")}${rota.caminho}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${rota.caminho} respondeu ${res.status}`);
    return mapearLinhas(await res.json(), rota.campoTotal);
  }

  // Vendas originadas por SDR (aba Comissões) — agora da Dashboard Comercial
  // REAL (/api/sdr/vendas-por-produto), não mais do mock. total_faturado = valor
  // da venda; total_vendas = quantidade. Tolerância linha a linha fica no
  // mapVendasComercial.
  async function buscarVendas() {
    const res = await fetch(
      `${base!.replace(/\/$/, "")}/api/sdr/vendas-por-produto`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`/api/sdr/vendas-por-produto respondeu ${res.status}`);
    return mapVendasComercial(
      await res.json().catch(() => null),
      "sdr",
      "/api/sdr/vendas-por-produto",
    )
      .filter((l) => l.nome) // sem SDR nomeado não há a quem atribuir
      .map((l) => ({
        sdr: l.nome,
        data_referencia: l.data,
        produto: l.produto ?? "—",
        valor: l.faturado,
        quantidade: l.quantidade,
      }));
  }

  // As três cargas saem JUNTAS (uma onda só: não dependem uma da outra). A
  // montagem abaixo mantém exatamente a regra de antes, inclusive a ordem dos
  // campos do payload.
  const sdr = Object.entries(ROTAS_SDR);
  const lideranca = Object.entries(ROTAS_LIDERANCA);
  const [rSdr, rLideranca, rVendas] = await Promise.allSettled([
    Promise.all(sdr.map(([, rota]) => buscar(rota))),
    Promise.all(lideranca.map(([, rota]) => buscar(rota))),
    buscarVendas(),
  ]);

  // Carga SDR: se falhar, a tela inteira mostra erro (502 com mensagem).
  if (rSdr.status === "rejected") {
    const e = rSdr.reason;
    return NextResponse.json(
      { error: `Falha ao consultar a API externa: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
  const payload: Record<string, unknown> = Object.fromEntries(sdr.map(([nome], i) => [nome, rSdr.value[i]]));

  // Carga da liderança: falha NÃO derruba a aba SDR (erro isolado).
  if (rLideranca.status === "fulfilled") {
    lideranca.forEach(([nome], i) => {
      payload[nome] = rLideranca.value[i];
    });
    payload.lideranca_erro = null;
  } else {
    const e = rLideranca.reason;
    payload.lideranca_erro = `Falha ao carregar dados da liderança: ${e instanceof Error ? e.message : "erro"}`;
  }

  // Vendas: erro isolado (como a liderança). Se a busca falhar, a aba mostra
  // vazio — NÃO injeta mock em modo api (seria número fictício).
  if (rVendas.status === "fulfilled") {
    payload.vendas_por_sdr = rVendas.value;
  } else {
    const e = rVendas.reason;
    console.error(
      "[/api/sdr-dashboard] vendas_por_sdr:",
      e instanceof Error ? e.message : e,
    );
    payload.vendas_por_sdr = [];
  }

  return NextResponse.json(payload);
}
