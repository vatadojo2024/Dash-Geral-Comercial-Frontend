"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Flame,
  Info,
  Landmark,
  Lock,
  Package,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LeadListItem } from "@/lib/api/contracts";
import { fetchLeads } from "@/lib/data/dataClient";
import { fetchVendasDoMes } from "@/lib/data/salesOps";
import { useUsuariosMap, useUsuariosCarregando } from "@/lib/data/useUsuarios";
import {
  metasPorCloser,
  nomeApiVendasPorCloser,
  rotuloProduto,
  slugDoCloser,
  valorDeProjecao,
} from "@/lib/config/salesops";
import {
  calcularComissao,
  projetarComissao,
  MINIMO_CASH_PCT,
  type EntradaComissao,
  type Projecao,
} from "@/lib/salesops/comissao";
import { potencialPorProduto } from "@/lib/salesops/potencial";
import { formatarBRL, formatarBRLExato, formatarPct } from "@/lib/formatters/moeda";
import { leadAtivo } from "@/features/dashboard/derivacoes";
import { useSession } from "@/features/session/SessionProvider";
import { CLOSERS, findAccountById, nomeDoUsuario } from "@/lib/mock/users";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function BarraMeta({
  rotulo,
  volume,
  meta,
}: {
  rotulo: string;
  volume: number;
  meta: number;
}) {
  const pct = meta > 0 ? Math.min(volume / meta, 1) : 0;
  const atingida = volume >= meta;
  const gap = Math.max(meta - volume, 0);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-texto-sec">
          {rotulo}: <span className="font-medium text-texto">{formatarBRL(meta)}</span>
        </span>
        <span className={atingida ? "font-semibold text-verde" : "text-texto-sec"}>
          {atingida ? "Batida ✓" : `${formatarPct(pct)} · faltam ${formatarBRL(gap)}`}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-borda/40"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${rotulo}: ${formatarPct(pct)} da meta`}
      >
        <div
          className={`h-full rounded-full ${atingida ? "bg-verde" : "bg-azul"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function CardProjecao({
  titulo,
  icone: Icon,
  projecao,
  qtdLeads,
  semProduto,
}: {
  titulo: string;
  icone: typeof Flame;
  projecao: Projecao;
  qtdLeads: number;
  semProduto: number;
}) {
  const r = projecao.resultado;
  return (
    <div className="rounded-xl border border-borda bg-noite/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-texto">
        <Icon className="h-4 w-4 text-laranja" aria-hidden />
        {titulo}
      </p>
      <p className="mt-0.5 text-xs text-texto-sec">
        {qtdLeads} {qtdLeads === 1 ? "lead" : "leads"} somando na projeção
        {semProduto > 0 && ` · ${semProduto} sem produto sugerido (fora da conta)`}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-texto-sec">Faturamento projetado</dt>
          <dd className="font-semibold tabular-nums text-texto">
            {formatarBRL(projecao.volumeProjetado)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-texto-sec">Taxa atingida</dt>
          <dd className={`font-semibold tabular-nums ${r.travaDoCaixa ? "text-laranja" : "text-verde"}`}>
            {formatarPct(r.taxaVigente, 0)}
            {r.travaDoCaixa && " (trava)"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-texto-sec">Comissão projetada</dt>
          <dd className="font-bold tabular-nums text-texto">
            {formatarBRLExato(r.comissao)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// Quadro "Potencial da carteira por produto" (7.1.1): clicar num produto
// filtra a fila de leads por ele (URL como fonte de verdade).
function PotencialPorProduto({
  carteira,
  taxaVigente,
  taxaFechandoTodos,
  closerId,
  linkComCloser,
}: {
  carteira: LeadListItem[];
  taxaVigente: number;
  taxaFechandoTodos: number;
  closerId: string;
  linkComCloser: boolean;
}) {
  const potencial = potencialPorProduto(carteira);

  const hrefDoProduto = (chave: string) =>
    linkComCloser
      ? `/leads?produto=${chave}&closer=${closerId}`
      : `/leads?produto=${chave}`;

  return (
    <Card>
      <CardHeader
        title="Potencial da carteira por produto"
        subtitle={`Valor de tabela da projeção (à vista, variante Semestral) × leads ativos. Comissão na taxa vigente (${formatarPct(taxaVigente, 0)}) e na taxa do cenário "fechando todos" (${formatarPct(taxaFechandoTodos, 0)}). Clique num produto para filtrar a fila.`}
      />
      {potencial.itens.length === 0 ? (
        <EmptyState
          icon={Package}
          titulo="Nenhum lead ativo com produto sugerido"
          descricao="Quando o motor sugerir produtos para a carteira, o potencial aparece aqui."
        />
      ) : (
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-borda/60 text-left text-xs uppercase tracking-wide text-texto-sec">
                <th className="py-2 pr-3 font-medium">Produto</th>
                <th className="py-2 pr-3 text-right font-medium">Leads</th>
                <th className="py-2 pr-3 text-right font-medium">Faturamento potencial</th>
                <th className="py-2 pr-3 text-right font-medium">
                  Comissão ({formatarPct(taxaVigente, 0)} vigente)
                </th>
                <th className="py-2 text-right font-medium">
                  Comissão ({formatarPct(taxaFechandoTodos, 0)} fechando todos)
                </th>
              </tr>
            </thead>
            <tbody>
              {potencial.itens.map((item) => (
                <tr key={item.chave} className="border-b border-borda/40 last:border-0">
                  <td className="py-2 pr-3">
                    <Link
                      href={hrefDoProduto(item.chave)}
                      title={`Filtrar a fila por ${rotuloProduto(item.produto)}`}
                      className="font-medium text-azul-claro hover:underline"
                    >
                      {rotuloProduto(item.produto)}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-texto">
                    {item.leads}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-texto">
                    {formatarBRL(item.faturamentoPotencial)}
                    <span className="ml-1 text-xs text-texto-sec">
                      ({item.leads} × {formatarBRL(item.valorUnitario)})
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-texto">
                    {formatarBRLExato(item.faturamentoPotencial * taxaVigente)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-verde">
                    {formatarBRLExato(item.faturamentoPotencial * taxaFechandoTodos)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-borda text-texto">
                <td className="py-2 pr-3 font-semibold">Total</td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                  {potencial.totalLeads}
                </td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                  {formatarBRL(potencial.totalFaturamento)}
                </td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                  {formatarBRLExato(potencial.totalFaturamento * taxaVigente)}
                </td>
                <td className="py-2 text-right font-bold tabular-nums text-verde">
                  {formatarBRLExato(potencial.totalFaturamento * taxaFechandoTodos)}
                </td>
              </tr>
            </tfoot>
          </table>
          {potencial.semProduto > 0 && (
            <p className="mt-2 text-xs text-texto-sec">
              {potencial.semProduto} lead(s) ativo(s) sem produto sugerido — fora da conta.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PainelCloser({ closerId }: { closerId: string }) {
  const user = useSession();
  const usuarios = useUsuariosMap();
  const usuariosCarregando = useUsuariosCarregando();

  // closerId entra como slug (admin seleciona) ou UUID (closer logado). Metas,
  // vendas e carteira são TODAS chaveadas por slug → resolvemos UUID→slug UMA vez
  // (diretório /api/usuarios + nome→slug) e dali pra frente tudo usa o mesmo slug.
  // Admin e closer passam pelo MESMO ponto de resolução. Ver slugDoCloser.
  const slug = slugDoCloser(closerId, usuarios);
  const meta = slug ? metasPorCloser[slug] : undefined;
  // Diferencia "diretório ainda carregando" de "carregou e não achou meta": sem
  // isto, o closer logado piscaria "sem meta" enquanto o UUID não resolve.
  const resolvendoCloser = !slug && usuariosCarregando;

  const vendasQuery = useQuery({
    queryKey: ["vendas", slug],
    queryFn: () => fetchVendasDoMes(slug!),
    enabled: !!slug,
  });
  const leadsQuery = useQuery({
    queryKey: ["leads", user.id],
    queryFn: () => fetchLeads(user),
  });

  // O closer_id dos leads é UUID; já temos o slug resolvido acima. Resolvemos
  // o(s) UUID(s) reais do closer pelo nome, via diretório /api/usuarios
  // (nome↔UUID), igual ao filtro de vendas (por nome). Inclui o próprio slug por
  // segurança (mock chaveia leads por slug).
  const idsDoCloser = useMemo(() => {
    const chave = slug ?? closerId;
    const ids = new Set<string>([chave]);
    const alvo = semAcento(
      (nomeApiVendasPorCloser[chave] ?? findAccountById(chave)?.nome ?? "").toLowerCase(),
    );
    if (alvo) {
      for (const [id, nome] of usuarios) {
        if (semAcento(nome.toLowerCase()).includes(alvo)) ids.add(id);
      }
    }
    return ids;
  }, [usuarios, slug, closerId]);

  // Para o link da fila (?closer=): a fila casa por closer_id (UUID), então
  // passamos o UUID resolvido, não o slug.
  const idParaFila = useMemo(
    () => [...idsDoCloser].find((id) => id.includes("-")) ?? closerId,
    [idsDoCloser, closerId],
  );

  const carteira = useMemo(
    () =>
      (leadsQuery.data ?? []).filter(
        (l) => l.closer_id !== null && idsDoCloser.has(l.closer_id) && leadAtivo(l),
      ),
    [leadsQuery.data, idsDoCloser],
  );

  if (resolvendoCloser || vendasQuery.isLoading || leadsQuery.isLoading) {
    return (
      <div className="space-y-4" aria-label="Carregando Sales Ops">
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (vendasQuery.isError || leadsQuery.isError) {
    return (
      <Card>
        <ErrorState
          titulo="Não foi possível carregar o Sales Ops"
          descricao="Tente novamente; se persistir, acione o suporte interno."
          onRetry={() => {
            vendasQuery.refetch();
            leadsQuery.refetch();
          }}
        />
      </Card>
    );
  }

  const vendas = vendasQuery.data!;

  if (!meta) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          titulo="Closer sem meta configurada"
          descricao="Cadastre as metas do mês em src/lib/config/salesops.ts."
        />
      </Card>
    );
  }

  const entrada: EntradaComissao = {
    volumeVendido: vendas.volumeVendido,
    cashCollected: vendas.cashCollected,
    meta1: meta.m1,
    meta2: meta.m2,
  };
  const comissao = calcularComissao(entrada);

  // Projeções com a carteira ativa: lead sem produto sugerido não soma
  const valorDe = (l: LeadListItem) => valorDeProjecao(l.produto_sugerido);
  const quentes = carteira.filter((l) => l.score_final >= 75);
  const somaValores = (ls: LeadListItem[]) =>
    ls.reduce((acc, l) => acc + (valorDe(l) ?? 0), 0);
  const comProduto = (ls: LeadListItem[]) => ls.filter((l) => valorDe(l) !== null);

  const projQuentes = projetarComissao(entrada, somaValores(quentes));
  const projTodos = projetarComissao(entrada, somaValores(carteira));

  const pctCash = comissao.percentualCash;

  return (
    <div className="space-y-4">
      {/* Linha 1 — faturamento, cash, comissão */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Faturamento do mês" subtitle={`Período ${vendas.mes}`} />
          <CardContent className="space-y-4">
            <p className="flex items-center gap-2 text-3xl font-bold tabular-nums text-texto">
              <Landmark className="h-5 w-5 text-azul-claro" aria-hidden />
              {formatarBRL(vendas.volumeVendido)}
            </p>
            <BarraMeta rotulo="Meta 1" volume={vendas.volumeVendido} meta={meta.m1} />
            <BarraMeta rotulo="Meta 2" volume={vendas.volumeVendido} meta={meta.m2} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Cash collected"
            subtitle="Quanto do volume vendido já entrou no caixa"
          />
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-3xl font-bold tabular-nums text-texto">
              <Banknote className="h-5 w-5 text-teal" aria-hidden />
              {formatarBRL(vendas.cashCollected)}
            </p>
            <p className="text-sm text-texto-sec">
              <span
                className={`font-semibold ${
                  pctCash >= MINIMO_CASH_PCT ? "text-verde" : "text-laranja"
                }`}
              >
                {formatarPct(pctCash)}
              </span>{" "}
              do faturamento · mínimo de {formatarPct(MINIMO_CASH_PCT, 0)} para liberar
              taxas acima de 3%
            </p>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-borda/40"
              role="progressbar"
              aria-valuenow={Math.round(Math.min(pctCash, 1) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Cash collected: ${formatarPct(pctCash)} do volume`}
            >
              <div
                className={`h-full rounded-full ${
                  pctCash >= MINIMO_CASH_PCT ? "bg-teal" : "bg-laranja"
                }`}
                style={{ width: `${Math.min(pctCash, 1) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Comissão atual" subtitle="Regra progressiva e retroativa" />
          <CardContent className="space-y-3">
            <p className="flex items-center gap-2 text-3xl font-bold tabular-nums text-texto">
              <Wallet className="h-5 w-5 text-verde" aria-hidden />
              {formatarBRLExato(comissao.comissao)}
            </p>
            <p className="text-sm">
              <span
                className={`font-semibold ${comissao.travaDoCaixa ? "text-laranja" : "text-verde"}`}
              >
                Taxa vigente: {formatarPct(comissao.taxaVigente, 0)}
              </span>
            </p>
            <p
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                comissao.travaDoCaixa
                  ? "border-laranja/30 bg-laranja/10 text-laranja"
                  : "border-borda bg-noite/40 text-texto-sec"
              }`}
            >
              {comissao.travaDoCaixa ? (
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {comissao.motivo}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2 — projeções com a carteira */}
      <Card>
        <CardHeader
          title="Projeções com a carteira ativa"
          subtitle={`Valor por lead = à vista da variante Semestral do produto sugerido (conservador). Premissa: cash collected proporcional ao atual (${formatarPct(pctCash)}).`}
        />
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <CardProjecao
            titulo="Se fechar os quentes (score ≥ 75)"
            icone={Flame}
            projecao={projQuentes}
            qtdLeads={comProduto(quentes).length}
            semProduto={quentes.length - comProduto(quentes).length}
          />
          <CardProjecao
            titulo="Se fechar todos os ativos"
            icone={TrendingUp}
            projecao={projTodos}
            qtdLeads={comProduto(carteira).length}
            semProduto={carteira.length - comProduto(carteira).length}
          />
        </CardContent>
      </Card>

      {/* Potencial da carteira por produto (7.1.1) */}
      <PotencialPorProduto
        carteira={carteira}
        taxaVigente={comissao.taxaVigente}
        taxaFechandoTodos={projTodos.resultado.taxaVigente}
        closerId={idParaFila}
        linkComCloser={user.role === "admin"}
      />

      {/* Vendas do mês */}
      <Card>
        <CardHeader
          title="Vendas do mês"
          subtitle={`${vendas.vendas.length} venda(s) registradas em ${vendas.mes}`}
        />
        {vendas.vendas.length === 0 ? (
          <EmptyState
            icon={Banknote}
            titulo="Nenhuma venda registrada neste mês"
            descricao="As vendas aparecem aqui assim que forem lançadas."
          />
        ) : (
          <CardContent className="space-y-1.5">
            {vendas.vendas.map((v, i) => (
              <div
                key={`${v.data}-${i}`}
                className="flex items-center justify-between rounded-lg border border-borda/60 bg-noite/40 px-3 py-2 text-sm"
              >
                <span className="text-texto">{rotuloProduto(v.produto)}</span>
                <span className="text-xs text-texto-sec">
                  {new Date(`${v.data}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span className="font-semibold tabular-nums text-texto">
                  {formatarBRL(v.valor)}
                </span>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export function SalesOpsView() {
  const user = useSession();
  const usuarios = useUsuariosMap();
  const [closerSelecionado, setCloserSelecionado] = useState<string>(
    user.role === "closer" ? user.id : CLOSERS[0].id,
  );

  // Closer vê a própria página; admin escolhe qual carteira ver.
  const closerId = user.role === "closer" ? user.id : closerSelecionado;

  // Cabeçalho: nome real (diretório /api/usuarios resolve o UUID do closer; admin
  // cai no nome da conta pelo slug). Último recurso de nomeDoUsuario é o próprio
  // id — se isso for um UUID (diretório ainda carregando), mostramos um rótulo
  // limpo, NUNCA o UUID cru.
  const nomeResolvido = nomeDoUsuario(closerId, usuarios);
  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(nomeResolvido);
  const rotuloCloser = ehUuid ? "Closer" : nomeResolvido;

  return (
    <div className="space-y-4">
      {user.role === "admin" && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-painel p-3"
          role="tablist"
          aria-label="Selecionar closer"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-texto-sec">
            Closer:
          </span>
          {CLOSERS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={closerId === c.id}
              onClick={() => setCloserSelecionado(c.id)}
              className={`h-9 rounded-lg border px-4 text-sm font-medium transition-colors ${
                closerId === c.id
                  ? "border-azul/40 bg-azul/15 text-azul-claro"
                  : "border-borda bg-painel-claro text-texto-sec hover:text-texto"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-texto-sec">
        Carteira de <span className="font-medium text-texto">{rotuloCloser}</span> ·
        metas e tabela de preços vigentes do mês
      </p>

      <PainelCloser closerId={closerId} />
    </div>
  );
}
