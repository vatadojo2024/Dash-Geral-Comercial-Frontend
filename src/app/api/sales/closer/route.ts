import { NextResponse, type NextRequest } from "next/server";
import rawVendas from "@/lib/mock/vendas_closers.json";
import { nomeApiVendasPorCloser } from "@/lib/config/salesops";
import { mapVendasComercial } from "@/lib/server/apiVendas";
import {
  configComercial,
  headersComercial,
  janelaDoMes,
  mesCorrente,
  modoComercial,
} from "@/lib/server/dashboardComercial";

// ---------------------------------------------------------------------------
// GET /api/sales/closer?closer=<slug>&mes=YYYY-MM — vendas/faturamento de um
// closer no mês, para o Sales Ops. Fonte controlada por SDR_DASHBOARD_MODE
// (mesma origem/credencial do Dashboard SDR):
//   - "mock": src/lib/mock/vendas_closers.json (chaveado por slug).
//   - "api": GET {base}/api/closer/vendas-por-produto filtrado por NOME (não
//     slug) e janela do mês; total_faturado soma o volume, total_entrada soma
//     o cash collected. Mapeamento tolerante linha a linha (ver apiVendas).
// Antes isto era 100% mock client-side, sem fio até a Dashboard Comercial.
// ---------------------------------------------------------------------------

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

type VendaMock = { valor: number; produto: string; data: string };
type ArquivoMock = {
  mes: string;
  closers: Record<string, { cash_collected: number; vendas: VendaMock[] }>;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const closer = (searchParams.get("closer") ?? "").trim();
  const mes = searchParams.get("mes") || mesCorrente();

  if (!closer) {
    return NextResponse.json({ error: "Informe ?closer=" }, { status: 400 });
  }

  if (modoComercial() === "mock") {
    const arq = rawVendas as ArquivoMock;
    const doCloser = arq.closers[closer] ?? { cash_collected: 0, vendas: [] };
    return NextResponse.json({
      mes: arq.mes,
      vendas: [...doCloser.vendas].sort((a, b) => b.data.localeCompare(a.data)),
      volumeVendido: doCloser.vendas.reduce((acc, v) => acc + v.valor, 0),
      cashCollected: doCloser.cash_collected,
    });
  }

  const cfg = configComercial();
  if (!cfg) {
    return NextResponse.json(
      { error: "Configure SDR_DASHBOARD_API_URL e SDR_DASHBOARD_API_KEY no .env" },
      { status: 500 },
    );
  }

  // Filtro da API é por NOME (contém); o slug interno difere do nome real
  // ("giba" → "Gilberto"). Sem acento no que enviamos: os nomes na API vêm sem
  // acento (Aurelio), então normalizar evita falso-negativo se a config/sessão
  // trouxer "Aurélio".
  const nomeApi = semAcento(nomeApiVendasPorCloser[closer] ?? closer);
  const { data_inicio, data_fim } = janelaDoMes(mes);
  const qs = new URLSearchParams({ data_inicio, data_fim, closer: nomeApi });

  try {
    const res = await fetch(`${cfg.base}/api/closer/vendas-por-produto?${qs}`, {
      headers: headersComercial(cfg.chave),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `A API de vendas respondeu ${res.status}.` },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 },
      );
    }
    const linhas = mapVendasComercial(
      await res.json().catch(() => null),
      "closer",
      "/api/closer/vendas-por-produto",
    );
    return NextResponse.json({
      mes,
      vendas: linhas
        .map((l) => ({
          valor: l.faturado,
          produto: l.produto ?? "—",
          data: l.data,
          quantidade: l.quantidade,
        }))
        .sort((a, b) => b.data.localeCompare(a.data)),
      volumeVendido: linhas.reduce((acc, l) => acc + l.faturado, 0),
      // total_entrada = entrada da venda; é a melhor proxy real de cash collected.
      cashCollected: linhas.reduce((acc, l) => acc + l.entrada, 0),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao consultar a API de vendas: ${e instanceof Error ? e.message : "erro"}` },
      { status: 502 },
    );
  }
}
