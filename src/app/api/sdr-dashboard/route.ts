import { NextResponse } from "next/server";
import mock from "@/lib/mock/sdr_dashboard.json";

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

  // Carga SDR: se falhar, a tela inteira mostra erro (502 com mensagem).
  let payload: Record<string, unknown>;
  try {
    const entradas = Object.entries(ROTAS_SDR);
    const respostas = await Promise.all(entradas.map(([, rota]) => buscar(rota)));
    payload = Object.fromEntries(entradas.map(([nome], i) => [nome, respostas[i]]));
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API externa: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }

  // Carga da liderança: falha NÃO derruba a aba SDR (erro isolado).
  try {
    const entradas = Object.entries(ROTAS_LIDERANCA);
    const respostas = await Promise.all(entradas.map(([, rota]) => buscar(rota)));
    entradas.forEach(([nome], i) => {
      payload[nome] = respostas[i];
    });
    payload.lideranca_erro = null;
  } catch (e) {
    payload.lideranca_erro = `Falha ao carregar dados da liderança: ${e instanceof Error ? e.message : "erro"}`;
  }

  // A API externa ainda NÃO expõe as vendas originadas por SDR (aba
  // Comissões). Enquanto a fonte real não é definida (pendência no
  // PROGRESSO.md), as vendas vêm do mock para a comissão de vendas não
  // zerar — TODO trocar pela fonte real na integração.
  payload.vendas_por_sdr =
    (mock as { vendas_por_sdr?: unknown[] }).vendas_por_sdr ?? [];

  return NextResponse.json(payload);
}
