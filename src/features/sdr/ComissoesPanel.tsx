"use client";

import { VALIDADE } from "@/lib/data/validade";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Banknote, Info, TrendingUp, Wallet } from "lucide-react";
import {
  vendasDoMesPorSdr,
  type SdrDashboardPayload,
  type SdrMetrics,
  type SdrCanonico,
} from "@/lib/data/sdrDashboard";
import {
  calcularComissaoSdr,
  type ResultadoComissaoSdr,
} from "@/lib/salesops/comissaoSdr";
import { fetchComissoesSdr } from "@/lib/data/dataClient";
import {
  comissoesPorSdr,
  numerosDoCard,
  totalDoTime,
  type NumerosComissao,
} from "@/lib/sdr/comissoes";
import { dataHora } from "@/lib/formatters/date";
import { rotuloProduto } from "@/lib/config/salesops";
import { formatarBRL, formatarBRLExato, formatarPct } from "@/lib/formatters/moeda";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";

const ROTULO_PATAMAR = ["Abaixo da M1", "M1 batida", "M2 batida", "M3 batida"] as const;

function Linha({
  rotulo,
  detalhe,
  valor,
}: {
  rotulo: string;
  detalhe?: string;
  valor: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-borda/40 py-1.5 text-sm last:border-0">
      <span className="text-texto-sec">
        {rotulo}
        {detalhe && <span className="block text-xs text-texto-sec/70">{detalhe}</span>}
      </span>
      <span className="text-right font-medium tabular-nums text-texto">{valor}</span>
    </div>
  );
}

function CardComissaoSdr({
  m,
  resultado,
  numeros,
  volumeVendas,
  qtdVendas,
  destaque,
}: {
  m: SdrMetrics;
  resultado: ResultadoComissaoSdr;
  numeros: NumerosComissao;
  volumeVendas: number;
  qtdVendas: number;
  destaque: boolean;
}) {
  if (resultado.semComissao) {
    return (
      <Card className="border-dashed">
        <CardContent>
          <p className="flex items-center gap-2 text-base font-semibold text-texto">
            <Bot className="h-4 w-4 text-violeta" aria-hidden />
            {m.sdr}
          </p>
          <p className="mt-2 flex items-start gap-2 text-sm text-texto-sec">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Sem comissão — linha informativa, fora dos totais do time.
          </p>
          <div className="mt-3">
            <Linha rotulo="Reuniões qualificadas" valor={String(m.qualificadosBase)} />
            <Linha
              rotulo="Vendas originadas"
              valor={`${qtdVendas} · ${formatarBRL(volumeVendas)}`}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(destaque && "border-azul/60 ring-1 ring-azul/40")}>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-base font-semibold text-texto">
            {m.sdr}
            {destaque && (
              <span className="rounded-full border border-azul/30 bg-azul/15 px-2 py-px text-[10px] font-medium text-azul-claro">
                você
              </span>
            )}
          </p>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              resultado.patamar > 0
                ? "border-verde/30 bg-verde/15 text-verde"
                : "border-borda bg-painel-claro text-texto-sec",
            )}
          >
            {ROTULO_PATAMAR[resultado.patamar]} · R$ {resultado.valorPorReuniao}/reunião +{" "}
            {formatarPct(resultado.taxaVenda)}
          </span>
        </div>

        {/* As DUAS métricas de qualificadas: o patamar usa o nº que conta para a
            meta individual (`qualificadosMeta`; regra Ninja/QC em sdrDashboard.ts);
            a comissão de reuniões paga só as qualificadas BASE. */}
        <p className="mt-1 text-xs text-texto-sec">
          Patamar definido por {m.qualificadosMeta} qualificados p/ meta
          {m.foraDaMeta > 0 ? ` (${m.foraDaMeta} Ninja/QC não contam)` : ""}
          {m.gap !== null && m.gap > 0 && m.metaAtual !== null
            ? ` · faltam ${m.gap} p/ ${m.metaAtual}`
            : ""}
        </p>

        <div className="mt-3">
          <Linha
            rotulo="Comissão de reuniões"
            detalhe={`${m.qualificadosBase} qualificadas × R$ ${resultado.valorPorReuniao} (retroativo)`}
            valor={formatarBRLExato(resultado.comissaoReunioes)}
          />
          <Linha
            rotulo="Bônus QC"
            detalhe={`${m.produtos.qc} calls QC → ${Math.floor(m.produtos.qc / 3)} × R$ 20`}
            valor={formatarBRLExato(resultado.bonusQC)}
          />
          {/* Total do Financeiro − reuniões − QC (a % incide sobre o caixa). */}
          <Linha
            rotulo="Comissão de vendas"
            detalhe="sobre o caixa do mês (Financeiro)"
            valor={numeros.comissaoVendas === null ? "—" : formatarBRLExato(numeros.comissaoVendas)}
          />
        </div>

        <p className="mt-3 flex items-center justify-between rounded-lg border border-borda bg-noite/40 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-texto">
            <Wallet className="h-4 w-4 text-verde" aria-hidden />
            Total do mês
          </span>
          {numeros.total === null ? (
            <span className="text-sm text-texto-sec">Sem comissão registrada</span>
          ) : (
            <span className="text-lg font-bold tabular-nums text-texto">
              {formatarBRLExato(numeros.total)}
            </span>
          )}
        </p>

        {numeros.projecao && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-azul/30 bg-azul/10 px-3 py-2 text-xs text-azul-claro">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Se bater a meta de {numeros.projecao.meta} qualificados, o mês
              recalcula retroativamente para{" "}
              <span className="font-bold">
                {formatarBRLExato(numeros.projecao.total)}
              </span>{" "}
              (R$ {numeros.projecao.valorPorReuniao}/reunião +{" "}
              {formatarPct(numeros.projecao.taxaVenda)} do caixa).
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ComissoesPanel({
  payload,
  sdrs,
  mes,
  destaqueSdr,
}: {
  payload: SdrDashboardPayload;
  sdrs: SdrMetrics[];
  mes: string;
  destaqueSdr: SdrCanonico | null;
}) {
  const vendasPorSdr = useMemo(() => vendasDoMesPorSdr(payload, mes), [payload, mes]);

  // Total oficial do Financeiro. Em erro NÃO há fallback para o cálculo local
  // (seria um número errado com cara de certo): a aba mostra o aviso.
  const financeiro = useQuery({
    queryKey: ["sdr-comissoes", mes],
    queryFn: () => fetchComissoesSdr(mes),
    staleTime: VALIDADE.vendas,
  });
  const totaisFinanceiro = useMemo(
    () => (financeiro.data ? comissoesPorSdr(financeiro.data) : null),
    [financeiro.data],
  );

  const calculados = sdrs.map((m) => {
    const vendas = vendasPorSdr.get(m.sdr) ?? [];
    const volumeVendas = vendas.reduce((a, v) => a + v.valor, 0);
    // Linhas reais são agregadas (quantidade ≥ 1); o mock antigo não traz o
    // campo, então cada linha conta como 1.
    const qtdVendas = vendas.reduce((a, v) => a + (v.quantidade ?? 1), 0);
    const resultado = calcularComissaoSdr({
      reunioesQualificadas: m.qualificadosBase,
      qualificadosParaMeta: m.qualificadosMeta,
      callsQC: m.produtos.qc,
      volumeVendas,
      metas: m.metas,
    });
    const numeros = numerosDoCard(resultado, m.qualificadosBase, totaisFinanceiro?.get(m.sdr));
    return { m, vendas, volumeVendas, qtdVendas, resultado, numeros };
  });

  const totalTime = totaisFinanceiro ? totalDoTime(calculados.map((c) => c.numeros)) : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-texto-sec" role="status">
        Regras oficiais: R$ 40/60/80/100 por reunião qualificada realizada conforme o
        patamar da meta (retroativo) · R$ 20 a cada 3 calls QC · % sobre o caixa que
        entrou no mês (calculado pelo Financeiro).
        {totalTime !== null && (
          <>
            {" "}Total do time:{" "}
            <span className="font-semibold text-texto">{formatarBRLExato(totalTime)}</span>
          </>
        )}
        {financeiro.data?.atualizado_em && (
          <span className="block">
            Atualizado pelo Financeiro em{" "}
            <time dateTime={financeiro.data.atualizado_em} className="text-texto">
              {dataHora(financeiro.data.atualizado_em)}
            </time>
          </span>
        )}
      </p>

      {financeiro.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label="Carregando comissões" aria-busy>
          {calculados.map(({ m }) => (
            <Skeleton key={m.sdr} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : financeiro.isError || !totaisFinanceiro ? (
        <Card>
          <ErrorState
            titulo="Não foi possível carregar as comissões do Financeiro"
            error={financeiro.error}
            descricao={financeiro.error instanceof Error ? financeiro.error.message : "Tente novamente."}
            onRetry={() => financeiro.refetch()}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {calculados.map(({ m, resultado, numeros, volumeVendas, qtdVendas }) => (
            <CardComissaoSdr
              key={m.sdr}
              m={m}
              resultado={resultado}
              numeros={numeros}
              volumeVendas={volumeVendas}
              qtdVendas={qtdVendas}
              destaque={destaqueSdr === m.sdr}
            />
          ))}
        </div>
      )}

      {/* Vendas do mês por SDR */}
      <Card>
        <CardHeader
          title="Vendas originadas no mês"
          subtitle="Vendas atribuídas aos agendamentos de cada SDR (informativo; a comissão sobre vendas usa o caixa do mês)"
        />
        <CardContent className="overflow-x-auto">
          {calculados.every((c) => c.vendas.length === 0) ? (
            <p className="flex items-center gap-2 py-4 text-sm text-texto-sec">
              <Banknote className="h-4 w-4" aria-hidden />
              Nenhuma venda atribuída neste mês.
            </p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-borda/60 text-left text-xs uppercase tracking-wide text-texto-sec">
                  <th className="py-2 pr-3 font-medium">SDR</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {calculados.flatMap(({ m, vendas }) =>
                  vendas.map((v, i) => (
                    <tr
                      key={`${m.sdr}-${v.data_referencia}-${i}`}
                      className="border-b border-borda/40 last:border-0"
                    >
                      <td className="py-2 pr-3 text-texto">{m.sdr}</td>
                      <td className="py-2 pr-3 text-texto">{rotuloProduto(v.produto)}</td>
                      <td className="py-2 pr-3 text-texto-sec">
                        {new Date(`${v.data_referencia}T12:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 text-right tabular-nums text-texto">
                        {formatarBRL(v.valor)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
