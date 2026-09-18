"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Gem,
  Hand,
  Hourglass,
  LifeBuoy,
  MessageCircle,
  MonitorPlay,
  Radio,
  PartyPopper,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { fetchOportunidades, OportunidadesError } from "@/lib/data/dataClient";
import {
  rotuloCiclo,
  rotuloCicloEvento,
  tagsEventoNoIntervalo,
  ultimosCiclos,
  type Ciclo,
} from "@/lib/sdr/ciclo";
import {
  agruparPorDono,
  altoValorPendente,
  blocosDoFunil,
  blocosDoResgate,
  celulaMatriz,
  chaveDaLinha,
  contarPorOrigem,
  contarPorTier,
  formatarTaxa,
  funilZerado,
  marcadoresDoLead,
  ORIGENS,
  origemDoLead,
  TEXTO_MARCADOR,
  csvDePendentes,
  distribuicaoPorTier,
  filtrarPendentes,
  linkWhatsApp,
  MAX_DIAS_INTERVALO,
  opcoesDeDono,
  ordenarPendentes,
  TIERS,
  TIERS_ALTO_VALOR,
  todosDesqualificados,
  traduzirAvisos,
  validarIntervalo,
  type BlocoFunil,
  type CampoOrdenacao,
  type ContagemOrigem,
  type LeadPendente,
  type LinhaMatriz,
  type MarcadorOrigem,
  type OpcaoDono,
  type OrigemChave,
  type Ordenacao,
  type OportunidadesResponse,
  type TierChave,
} from "@/lib/sdr/oportunidades";
import { dataCompleta, dataHora, tempoRelativo } from "@/lib/formatters/date";
import { DonoBadge, MqlBadge, OrigemBadge } from "@/components/domain/Badges";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { CicloSelect } from "./CicloSelect";
import { KpiChip } from "./KpiChip";

// ---------------------------------------------------------------------------
// Aba "Levantou a Mão": quem aplicou no webinar e NÃO agendou call, com contato
// para o SDR agir sem sair da tela. Período (ciclo | intervalo) vai ao backend;
// MQL, busca, ordenação, paginação e CSV são client-side (lib/sdr/oportunidades).
// ---------------------------------------------------------------------------

type ModoPeriodo = "ciclo" | "intervalo";
type Visao = "lista" | "por_sdr";
const TAMANHO_PAGINA = 50;
const CLASSE_INPUT = "h-9 rounded-lg border bg-painel-claro px-2 text-sm text-texto";

export function LevantouMaoPanel() {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ciclos = useMemo(() => ultimosCiclos(hojeISO, 12), [hojeISO]);
  const cicloAtual = ciclos[0];

  // --- Período -------------------------------------------------------------
  const [modo, setModo] = useState<ModoPeriodo>("ciclo");
  const [inicioSel, setInicioSel] = useState(cicloAtual.inicio);
  const cicloSel: Ciclo = ciclos.find((c) => c.inicio === inicioSel) ?? cicloAtual;
  // Intervalo padrão: os 4 últimos ciclos (consolidar semanas é o uso do modo).
  const [de, setDe] = useState(ciclos[3]?.inicio ?? cicloAtual.inicio);
  const [ate, setAte] = useState(cicloAtual.fim);

  const erroIntervalo = modo === "intervalo" ? validarIntervalo(de, ate) : null;
  const periodo =
    modo === "ciclo" ? { de: cicloSel.inicio, ate: cicloSel.fim } : { de, ate };

  const { data, error, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["oportunidades", periodo.de, periodo.ate],
    queryFn: () => fetchOportunidades(periodo.de, periodo.ate),
    enabled: !erroIntervalo,
    retry: false,
  });

  // --- Filtros client-side --------------------------------------------------
  const [tiersSel, setTiersSel] = useState<TierChave[]>([]);
  const [donosSel, setDonosSel] = useState<string[]>([]);
  // Origem: a linha clicada na matriz e os chips compartilham ESTE estado.
  const [origensSel, setOrigensSel] = useState<OrigemChave[]>([]);
  const [soResgate, setSoResgate] = useState(false);
  const [visao, setVisao] = useState<Visao>("lista");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(null);
  const [pagina, setPagina] = useState(1);
  // Linha aberta no painel lateral (clique no nome). Chave = (contato, evento).
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const contagem = useMemo(() => contarPorTier(leads), [leads]);
  const opcoesDono = useMemo(() => opcoesDeDono(leads, data?.por_dono), [leads, data]);
  const contagemOrigem = useMemo(() => contarPorOrigem(leads), [leads]);
  // MQL → dono → origem → resgate → busca, em série.
  const recorte = useMemo(
    () =>
      filtrarPendentes(leads, {
        tiers: tiersSel,
        donos: donosSel,
        origens: origensSel,
        soResgate,
        busca,
      }),
    [leads, tiersSel, donosSel, origensSel, soResgate, busca],
  );
  const filtrados = useMemo(() => ordenarPendentes(recorte, ordenacao), [recorte, ordenacao]);
  // "Por SDR": seções a partir do MESMO recorte filtrado, na ordem do backend
  // (tier desc) — a ordenação por coluna não se aplica nesta visão.
  const grupos = useMemo(() => agruparPorDono(recorte), [recorte]);
  // Sem `matriz` na resposta (backend antigo) a aba cai nos KPIs de contingência.
  const temOrigem = data?.matriz != null;
  const multiEvento = (data?.eventos.length ?? 0) > 1;
  const selecionado = useMemo(
    () => leads.find((l) => chaveDaLinha(l) === selecionadoId) ?? null,
    [leads, selecionadoId],
  );

  useEffect(() => setPagina(1), [tiersSel, donosSel, origensSel, soResgate, busca, ordenacao, data]);

  function alternarTier(chave: TierChave) {
    setTiersSel((atual) =>
      atual.includes(chave) ? atual.filter((t) => t !== chave) : [...atual, chave],
    );
  }
  function alternarDono(chave: string) {
    setDonosSel((atual) =>
      atual.includes(chave) ? atual.filter((d) => d !== chave) : [...atual, chave],
    );
  }
  function alternarOrigem(chave: OrigemChave) {
    setOrigensSel((atual) =>
      atual.includes(chave) ? atual.filter((o) => o !== chave) : [...atual, chave],
    );
  }
  // Clique na linha da matriz: filtra SÓ por aquela origem; de novo, limpa.
  const linhaAtiva: OrigemChave | null = origensSel.length === 1 ? origensSel[0] : null;
  function alternarLinhaMatriz(chave: OrigemChave) {
    setOrigensSel(linhaAtiva === chave ? [] : [chave]);
  }
  const soAltoValor =
    tiersSel.length === TIERS_ALTO_VALOR.length && TIERS_ALTO_VALOR.every((t) => tiersSel.includes(t));

  function alternarOrdenacao(campo: CampoOrdenacao) {
    // Nome e dono começam em asc; tier começa em desc (melhor primeiro).
    const inicial = campo === "tier" ? "desc" : "asc";
    const oposta = inicial === "asc" ? "desc" : "asc";
    setOrdenacao((atual) => {
      if (!atual || atual.campo !== campo) return { campo, direcao: inicial };
      if (atual.direcao === inicial) return { campo, direcao: oposta };
      return null; // terceiro clique volta à ordem do backend
    });
  }

  function exportarCsv() {
    const csv = "﻿" + csvDePendentes(filtrados);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `levantou-a-mao_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Erro 400 do backend: destaca os campos de data (ambos — o backend não diz qual).
  const erro400 = error instanceof OportunidadesError && error.status === 400;
  const campoInvalido = erroIntervalo?.campo ?? (erro400 ? "ambos" : null);

  return (
    <div className="space-y-4">
      {/* Cabeçalho + controle de período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-texto">
            <Hand className="h-4 w-4 text-azul-claro" aria-hidden />
            Levantou a mão e não agendou
          </h2>
          <p className="mt-0.5 text-xs text-texto-sec">
            Contatos com a tag do evento (WG) que marcaram &ldquo;Levantou a Mão&rdquo; na Clint e
            ainda não têm call agendada (em nenhum estágio). Métrica de time — sem escopo por
            papel. Nome com ícone de ficha abre o lead no Mapa de Calor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Alternador<ModoPeriodo>
            rotulo="Modo do período"
            valor={modo}
            onChange={setModo}
            opcoes={[
              { valor: "ciclo", label: "Ciclo" },
              { valor: "intervalo", label: "Intervalo" },
            ]}
          />

          {modo === "ciclo" ? (
            <CicloSelect
              id="ciclo-levantou"
              ciclos={ciclos}
              value={inicioSel}
              onChange={setInicioSel}
              rotulo={rotuloCicloEvento}
              label={null}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  aria-label="Data inicial"
                  aria-invalid={campoInvalido === "de" || campoInvalido === "ambos"}
                  value={de}
                  max={ate || undefined}
                  onChange={(e) => setDe(e.target.value)}
                  className={cn(
                    CLASSE_INPUT,
                    campoInvalido === "de" || campoInvalido === "ambos"
                      ? "border-rosa ring-1 ring-rosa/40"
                      : "border-borda",
                  )}
                />
                <span className="text-xs text-texto-sec">até</span>
                <input
                  type="date"
                  aria-label="Data final"
                  aria-invalid={campoInvalido === "ate" || campoInvalido === "ambos"}
                  value={ate}
                  min={de || undefined}
                  onChange={(e) => setAte(e.target.value)}
                  className={cn(
                    CLASSE_INPUT,
                    campoInvalido === "ate" || campoInvalido === "ambos"
                      ? "border-rosa ring-1 ring-rosa/40"
                      : "border-borda",
                  )}
                />
              </div>
              <p className={cn("text-[11px]", erroIntervalo ? "text-rosa" : "text-texto-sec")} role="status">
                {erroIntervalo?.mensagem ?? `Máximo de ${MAX_DIAS_INTERVALO} dias.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {erroIntervalo ? null : isLoading ? (
        <Carregando />
      ) : isError || !data ? (
        <ErroOportunidades error={error} onRetry={() => refetch()} />
      ) : todosDesqualificados(data.totais) ? (
        <Card>
          <EmptyState
            icon={Ban}
            titulo="Nenhum lead ativo neste ciclo"
            descricao={`${data.totais.desqualificados} ${data.totais.desqualificados === 1 ? "contato foi desqualificado" : "contatos foram desqualificados"} na Clint e ${data.totais.desqualificados === 1 ? "saiu" : "saíram"} da base. Tag consultada: ${data.eventos.join(", ")}.`}
          />
        </Card>
      ) : data.totais.inscritos === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            titulo="Nenhum contato com a tag deste ciclo"
            descricao={
              data.eventos.length > 0
                ? `Tag consultada: ${data.eventos.join(", ")}. Confira se ela existe na Clint.`
                : `Nenhuma terça entre ${rotuloCiclo({ inicio: data.de, fim: data.ate })} — nenhuma tag WG para consultar.`
            }
          />
        </Card>
      ) : (
        <>
          <FaixaAvisos avisos={data.avisos} />
          {data.matriz ? (
            <MatrizOrigem
              data={data}
              linhaAtiva={linhaAtiva}
              onLinha={alternarLinhaMatriz}
            />
          ) : (
            <Kpis data={data} />
          )}
          {data.funis && <FunisDoCiclo funis={data.funis} />}
          {data.resgate && <FunilResgate resgate={data.resgate} />}

          {data.totais.pendentes === 0 || leads.length === 0 ? (
            <Card>
              <EmptyState
                icon={PartyPopper}
                tom="positivo"
                titulo="Todos que levantaram a mão já agendaram"
                descricao={
                  data.matriz
                    ? `${celulaMatriz(data.matriz.total.aplicaram)} levantaram a mão e ${celulaMatriz(data.matriz.total.agendaram)} agendaram neste período.`
                    : "Nenhum pendente neste período."
                }
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title="Pendentes por classificação"
                  subtitle="Clique numa barra ou num chip para filtrar a lista. Nenhum selecionado = todos."
                />
                <CardContent className="space-y-4">
                  <FiltroClassificacao
                    contagem={contagem}
                    selecionados={tiersSel}
                    soAltoValor={soAltoValor}
                    onAlternar={alternarTier}
                    onAltoValor={() => setTiersSel(soAltoValor ? [] : [...TIERS_ALTO_VALOR])}
                    onLimpar={() => setTiersSel([])}
                  />
                  <FiltroDono
                    opcoes={opcoesDono}
                    selecionados={donosSel}
                    onAlternar={alternarDono}
                    onLimpar={() => setDonosSel([])}
                  />
                  {temOrigem && (
                    <FiltroOrigem
                      contagem={contagemOrigem}
                      selecionados={origensSel}
                      soResgate={soResgate}
                      onAlternar={alternarOrigem}
                      onResgate={() => setSoResgate((v) => !v)}
                      onLimpar={() => {
                        setOrigensSel([]);
                        setSoResgate(false);
                      }}
                    />
                  )}
                  <BarrasPorTier leads={leads} selecionados={tiersSel} onAlternar={alternarTier} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title={`Pendentes${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
                  subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "pendente" : "pendentes"} no recorte`}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportarCsv}
                      disabled={filtrados.length === 0}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Exportar CSV
                    </Button>
                  }
                />
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="relative w-full max-w-sm">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome, e-mail ou telefone"
                        aria-label="Buscar pendente"
                        className="h-9 w-full rounded-lg border border-borda bg-noite pl-9 pr-3 text-sm text-texto placeholder:text-texto-sec/70"
                      />
                    </div>
                    <Alternador<Visao>
                      rotulo="Visão da lista"
                      valor={visao}
                      onChange={setVisao}
                      opcoes={[
                        { valor: "lista", label: "Lista" },
                        { valor: "por_sdr", label: "Por SDR" },
                      ]}
                    />
                  </div>

                  {filtrados.length === 0 ? (
                    <EmptyState
                      titulo="Nenhum pendente neste recorte"
                      descricao="Ajuste os chips de classificação, de dono, de origem ou a busca."
                    />
                  ) : visao === "lista" ? (
                    <ListaPendentes
                      leads={filtrados}
                      pagina={pagina}
                      onPagina={setPagina}
                      multiEvento={multiEvento}
                      ordenacao={ordenacao}
                      onOrdenar={alternarOrdenacao}
                      onAbrir={setSelecionadoId}
                      comOrigem={temOrigem}
                    />
                  ) : (
                    <div className="space-y-5">
                      {grupos.map((g) => (
                        <section key={g.chave} aria-label={`Pendentes de ${g.nome}`}>
                          <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borda/60 pb-1.5">
                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                              <UserRound className="h-3.5 w-3.5 text-azul-claro" aria-hidden />
                              {g.nome}
                            </h3>
                            <span className="text-xs text-texto-sec">
                              <span className="font-semibold tabular-nums text-texto">{g.leads.length}</span>{" "}
                              {g.leads.length === 1 ? "pendente" : "pendentes"}
                              {" · "}
                              <span className="font-semibold tabular-nums text-texto">{g.altoValor}</span> alto
                              valor
                            </span>
                          </header>
                          <ListaPendentes
                            leads={g.leads}
                            pagina={1}
                            onPagina={() => {}}
                            multiEvento={multiEvento}
                            ordenacao={null}
                            onOrdenar={() => {}}
                            onAbrir={setSelecionadoId}
                            ordenavel={false}
                            paginar={false}
                            semColunaDono
                            comOrigem={temOrigem}
                          />
                        </section>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          <Rodape data={data} atualizando={isFetching} onAtualizar={() => refetch()} />
        </>
      )}

      {selecionado && (
        <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />
      )}
    </div>
  );
}

// --- Estados ---------------------------------------------------------------

function Carregando() {
  return (
    <div className="space-y-4" aria-label="Carregando oportunidades" aria-busy>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function ErroOportunidades({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const e = error instanceof OportunidadesError ? error : null;
  const codigo = e?.codigo ?? "desconhecido";

  if (codigo === "clint_auth" || codigo === "clint_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Integração com a Clint indisponível. Avise o time técnico."
          descricao={
            codigo === "clint_auth"
              ? "A Clint recusou as credenciais da integração (token ausente ou inválido)."
              : "A Clint não respondeu (limite de requisições, instabilidade ou timeout)."
          }
          onRetry={codigo === "clint_indisponivel" ? onRetry : undefined}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "agendamentos_indisponivel") {
    return (
      <Card>
        <ErrorState
          titulo="Base de agendamentos indisponível"
          descricao="Sem o conjunto de quem agendou, a lista de pendentes não pode ser calculada."
          onRetry={onRetry}
          retryLabel="Tentar de novo"
        />
      </Card>
    );
  }
  if (codigo === "intervalo_muito_grande") {
    return (
      <Card>
        <ErrorState
          titulo="Período muito amplo. Reduza o intervalo."
          descricao="A consulta à Clint ultrapassou o limite de páginas. Escolha um intervalo menor."
        />
      </Card>
    );
  }
  if (codigo === "parametros_invalidos") {
    return (
      <Card>
        <ErrorState
          titulo="Datas inválidas"
          descricao={e?.message ?? "Confira as datas do período."}
        />
      </Card>
    );
  }
  return (
    <Card>
      <ErrorState
        titulo="Não foi possível carregar as oportunidades"
        descricao={error instanceof Error ? error.message : "Tente novamente."}
        onRetry={onRetry}
      />
    </Card>
  );
}

// --- KPIs e funil ------------------------------------------------------------

// Contingência: resposta SEM `matriz` (backend antigo). Só os números que o
// contrato V4 garante em `totais`, mais o alto valor derivado dos leads.
function Kpis({ data }: { data: OportunidadesResponse }) {
  const t = data.totais;
  const nEventos = `${data.eventos.length} ${data.eventos.length === 1 ? "evento" : "eventos"}`;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(t.inscritos)} detalhe={`tag do evento · ${nEventos}`} />
      <KpiChip
        icon={Ban}
        tom="neutro"
        rotulo="Desqualificados"
        valor={celulaMatriz(t.desqualificados)}
        detalhe="fora da base · conferência"
      />
      <KpiChip icon={Hourglass} rotulo="Pendentes" valor={String(t.pendentes)} destaque />
      <KpiChip
        icon={Gem}
        rotulo="Alto valor pendente"
        valor={String(altoValorPendente(data.leads))}
        detalhe="UMQL+ · UMQL · HMQL"
      />
    </div>
  );
}

// Cor de cada degrau dos funis (tokens do tema), pela chave `nome` do backend.
const COR_ETAPA: Record<string, string> = {
  inscritos: "bg-azul/25 text-azul-claro",
  convidados: "bg-azul/25 text-azul-claro",
  acessaram: "bg-azul/25 text-azul-claro",
  assistiram: "bg-violeta/25 text-violeta",
  aplicaram: "bg-teal/25 text-teal",
  agendaram: "bg-verde/25 text-verde",
  pendentes: "bg-laranja/20 text-laranja",
};
const COR_ETAPA_PADRAO = "bg-painel-claro text-texto";

// Blocos proporcionais com a passagem entre eles. A ESCALA é de quem chama
// (base = valor do primeiro bloco): ao vivo, replay e resgate usam o MESMO
// componente, cada um com o seu denominador — nunca o mesmo eixo.
// Passagem: porcentagem | travessão (referência zero) | "verificar base" (degrau
// maior que a referência nunca vira número — é sinal de base errada, em âmbar).
function FunilBlocos({ blocos }: { blocos: BlocoFunil[] }) {
  const base = blocos[0]?.valor || 1;
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {blocos.map((e, i) => {
        const p = e.passagem;
        return (
          <div key={e.chave} className="contents">
            {i > 0 && (
              <div
                className="flex shrink-0 items-center justify-center gap-1 px-1 text-xs font-medium text-texto-sec sm:flex-col sm:gap-0"
                aria-label={
                  !p
                    ? undefined
                    : p.tipo === "pct"
                      ? `Taxa de passagem: ${p.texto}${e.baseDaPassagem ? ` ${e.baseDaPassagem}` : ""}`
                      : "Taxa de passagem acima de 100%: verificar base"
                }
              >
                <ArrowDown className="h-3.5 w-3.5 sm:hidden" aria-hidden />
                <ChevronRight className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
                {p?.tipo === "pct" && <span className="tabular-nums">{p.texto}</span>}
                {p?.tipo === "pct" && e.baseDaPassagem && (
                  <span className="max-w-[72px] text-center text-[10px] font-normal leading-tight text-texto-sec/80">
                    {e.baseDaPassagem}
                  </span>
                )}
                {p?.tipo === "verificar" && (
                  <span
                    className="whitespace-nowrap rounded-full border border-laranja/40 bg-laranja/10 px-1.5 py-px text-[10px] font-medium text-laranja"
                    title="Passagem acima de 100% — o degrau é maior que o anterior. A base consultada precisa ser verificada."
                  >
                    verificar base
                  </span>
                )}
              </div>
            )}
            <div
              className={cn("min-w-0 rounded-lg px-3 py-2", COR_ETAPA[e.chave] ?? COR_ETAPA_PADRAO)}
              style={{ flexGrow: Math.min(Math.max(e.valor / base, 0.18), 1), flexBasis: 0 }}
            >
              <p className="truncate text-[11px] font-medium opacity-90">{e.rotulo}</p>
              <p className="text-xl font-bold tabular-nums">{e.valor}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Os DOIS funis do ciclo, empilhados, cada um com título e ESCALA PRÓPRIA. Os
// degraus vêm prontos do backend; as taxas são calculadas no front. Replay sem
// nenhum dado é renderizado com zeros + nota — não é escondido, para o time
// ver que o dado não chegou.
function FunisDoCiclo({ funis }: { funis: NonNullable<OportunidadesResponse["funis"]> }) {
  const semReplay = funilZerado(funis.replay.degraus);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Funil ao vivo" subtitle="Quem se inscreveu e participou ao vivo." />
        <CardContent>
          <FunilBlocos blocos={blocosDoFunil(funis.ao_vivo.degraus, "ao_vivo")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Funil do replay" subtitle="Quem abriu a gravação e aplicou só por ela." />
        <CardContent className="space-y-2">
          <FunilBlocos blocos={blocosDoFunil(funis.replay.degraus, "replay")} />
          {semReplay && (
            <p className="text-[11px] text-texto-sec/80" role="note">
              Sem replay neste ciclo
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Avisos de sanidade do backend: faixa cinza ACIMA da matriz, em
// linguagem direta. A chave crua nunca aparece (traduzirAvisos).
function FaixaAvisos({ avisos }: { avisos: readonly string[] | null | undefined }) {
  const textos = traduzirAvisos(avisos);
  if (textos.length === 0) return null;
  return (
    <div
      role="note"
      aria-label="Avisos sobre os números deste período"
      className="rounded-xl border border-borda bg-painel-claro/60 px-4 py-2.5 text-xs text-texto-sec"
    >
      <p className="font-medium text-texto">Atenção aos números deste período</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {textos.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

// Funil da CAMPANHA DE RESGATE: bloco separado abaixo dos dois funis, escala
// própria (base = convidados) e taxas calculadas no front.
function FunilResgate({ resgate }: { resgate: NonNullable<OportunidadesResponse["resgate"]> }) {
  return (
    <Card className="border-dashed">
      <CardHeader
        title="Campanha de resgate"
        subtitle="Base convidada a voltar — escala própria, denominador = convidados."
      />
      <CardContent className="space-y-3">
        <FunilBlocos blocos={blocosDoResgate(resgate)} />
        <p className="text-[11px] text-texto-sec/80">
          Convidados que voltaram aparecem também nas métricas do ciclo acima.
        </p>
      </CardContent>
    </Card>
  );
}

// --- Matriz ao vivo / replay / total ------------------------------------------------

const COLUNAS_MATRIZ = ["Acessaram", "Assistiram", "Levantaram a mão", "Agendaram", "Pendentes"] as const;

// Valores de exibição de uma linha. Travessão só onde o dado NÃO SE APLICA por
// definição: "Acessaram" no ao vivo (null) e a % quando taxa_agendamento é null.
// Zero é zero — ciclo sem replay mostra a linha Replay com zeros.
function valoresDaLinha(l: LinhaMatriz) {
  return {
    acessaram: celulaMatriz(l.acessaram),
    assistiram: celulaMatriz(l.assistiram),
    aplicaram: celulaMatriz(l.aplicaram),
    agendaram: celulaMatriz(l.agendaram),
    taxa: formatarTaxa(l.taxa_agendamento),
    pendentes: celulaMatriz(l.pendentes),
    altoValor: l.alto_valor_pendente ?? null,
  };
}

function MatrizOrigem({
  data,
  linhaAtiva,
  onLinha,
}: {
  data: OportunidadesResponse;
  linhaAtiva: OrigemChave | null;
  onLinha: (o: OrigemChave) => void;
}) {
  const m = data.matriz!;
  const linhas = [
    { chave: "ao_vivo" as const, rotulo: "Ao vivo", valores: valoresDaLinha(m.ao_vivo) },
    { chave: "replay" as const, rotulo: "Replay", valores: valoresDaLinha(m.replay) },
    { chave: "total" as const, rotulo: "Total", valores: valoresDaLinha(m.total) },
  ];
  const t = data.totais;

  return (
    <Card>
      <CardContent className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {/* sm+: tabela compacta na faixa. Em telas estreitas este wrapper some
            (display: contents) e cada linha vira um card empilhado pelo flex-col. */}
        <div className="contents sm:block sm:min-w-0 sm:flex-1">
          <table className="hidden w-full border-collapse text-sm sm:table">
            <caption className="sr-only">
              Matriz do ciclo por origem. Clique numa linha para filtrar os pendentes.
            </caption>
            <thead>
              <tr className="text-xs text-texto-sec">
                <th className="px-3 py-1.5 text-left font-medium">Origem</th>
                {COLUNAS_MATRIZ.map((c) => (
                  <th key={c} className="px-3 py-1.5 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const total = l.chave === "total";
                const ativa = !total && linhaAtiva === l.chave;
                return (
                  <tr
                    key={l.chave}
                    onClick={total ? undefined : () => onLinha(l.chave as OrigemChave)}
                    className={cn(
                      "tabular-nums transition-colors",
                      total
                        ? "border-t border-borda bg-painel-claro/50 font-semibold text-texto"
                        : "cursor-pointer border-t border-borda/40 text-texto hover:bg-painel-claro/60",
                      ativa && "bg-azul/15 ring-1 ring-inset ring-azul/40 hover:bg-azul/15",
                    )}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {total ? (
                        l.rotulo
                      ) : (
                        <button
                          type="button"
                          aria-pressed={ativa}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLinha(l.chave as OrigemChave);
                          }}
                          title={ativa ? "Limpar o filtro de origem" : `Filtrar pendentes: ${l.rotulo}`}
                          className={cn("font-medium", ativa ? "text-azul-claro" : "hover:text-azul-claro")}
                        >
                          {l.rotulo}
                        </button>
                      )}
                    </th>
                    <td className="px-3 py-2 text-right">{l.valores.acessaram}</td>
                    <td className="px-3 py-2 text-right">{l.valores.assistiram}</td>
                    <td className="px-3 py-2 text-right">{l.valores.aplicaram}</td>
                    <td className="px-3 py-2 text-right">
                      {l.valores.agendaram}{" "}
                      <span className="text-xs font-normal text-texto-sec">({l.valores.taxa})</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn(total && "text-laranja")}>{l.valores.pendentes}</span>
                      {l.valores.altoValor != null && (
                        <span className="ml-1 text-xs font-normal text-texto-sec" title="Pendentes de alto valor (UMQL+, UMQL, HMQL)">
                          · {l.valores.altoValor} alto valor
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {linhas.map((l) => {
            const total = l.chave === "total";
            const ativa = !total && linhaAtiva === l.chave;
            const Conteudo = (
              <>
                <p className={cn("text-sm font-semibold", ativa ? "text-azul-claro" : "text-texto")}>
                  {l.rotulo}
                </p>
                <dl className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1.5 text-left">
                  {[
                    ["Acessaram", l.valores.acessaram],
                    ["Assistiram", l.valores.assistiram],
                    ["Levantaram", l.valores.aplicaram],
                    ["Agendaram", `${l.valores.agendaram} (${l.valores.taxa})`],
                    ["Pendentes", l.valores.pendentes],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-[10px] uppercase tracking-wide text-texto-sec">{rotulo}</dt>
                      <dd className="text-sm font-semibold tabular-nums text-texto">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </>
            );
            return total ? (
              <div key={l.chave} className="rounded-lg border border-borda bg-painel-claro/50 p-3 sm:hidden">
                {Conteudo}
              </div>
            ) : (
              <button
                key={l.chave}
                type="button"
                aria-pressed={ativa}
                onClick={() => onLinha(l.chave as OrigemChave)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors sm:hidden",
                  ativa ? "border-azul/50 bg-azul/15" : "border-borda/60 hover:bg-painel-claro/60",
                )}
              >
                {Conteudo}
              </button>
            );
          })}
        </div>

        {/* Números de CONFERÊNCIA (não de ação): saíram da linha de cards. */}
        <dl className="flex shrink-0 gap-4 border-borda/60 text-xs text-texto-sec sm:flex-col sm:gap-1.5 sm:border-l sm:pl-4">
          <div title="Contatos com a tag do evento, já sem os desqualificados">
            <dt className="inline">Inscritos: </dt>
            <dd className="inline font-semibold tabular-nums text-cinza">{celulaMatriz(t.inscritos)}</dd>
          </div>
          <div title="Removidos da base por estarem em Desqualificado na Clint">
            <dt className="inline">Desqualificados: </dt>
            <dd className="inline font-semibold tabular-nums text-cinza">{celulaMatriz(t.desqualificados)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// --- Filtro por MQL --------------------------------------------------------------

// Grupo de chips multi-seleção (MQL e dono usam o MESMO componente). Nenhum
// selecionado = todos. `classeAtivo` permite a cor por tier; sem ela, o chip
// ativo usa o neutro do tema.
type OpcaoChip = { chave: string; label: string; contagem: number; classeAtivo?: string };

function Chips({
  rotulo,
  opcoes,
  selecionados,
  onAlternar,
  children,
}: {
  rotulo: string;
  opcoes: OpcaoChip[];
  selecionados: readonly string[];
  onAlternar: (chave: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={rotulo}>
      {opcoes.map((o) => {
        const ativo = selecionados.includes(o.chave);
        return (
          <button
            key={o.chave}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(o.chave)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              ativo
                ? (o.classeAtivo ?? "border-azul/60 bg-azul/15 text-azul-claro")
                : "border-borda text-texto-sec hover:text-texto",
              o.contagem === 0 && !ativo && "opacity-50",
            )}
          >
            {o.label} <span className="tabular-nums">({o.contagem})</span>
          </button>
        );
      })}
      {children}
    </div>
  );
}

// Chips de classificação: a escala MQL, QC (outra trilha) e "Sem classificação".
function FiltroClassificacao({
  contagem,
  selecionados,
  soAltoValor,
  onAlternar,
  onAltoValor,
  onLimpar,
}: {
  contagem: Record<TierChave, number>;
  selecionados: TierChave[];
  soAltoValor: boolean;
  onAlternar: (t: TierChave) => void;
  onAltoValor: () => void;
  onLimpar: () => void;
}) {
  return (
    <Chips
      rotulo="Filtrar por classificação"
      opcoes={TIERS.map((t) => ({
        chave: t.chave,
        label: t.label,
        contagem: contagem[t.chave],
        classeAtivo: t.chipAtivo,
      }))}
      selecionados={selecionados}
      onAlternar={(chave) => onAlternar(chave as TierChave)}
    >
      <span className="mx-1 h-4 w-px bg-borda" aria-hidden />
      <button
        type="button"
        aria-pressed={soAltoValor}
        onClick={onAltoValor}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          soAltoValor
            ? "border-laranja/60 bg-laranja/15 text-laranja"
            : "border-borda text-texto-sec hover:text-texto",
        )}
      >
        <Gem className="h-3 w-3" aria-hidden />
        Só alto valor
      </button>
      {selecionados.length > 0 && (
        <button
          type="button"
          onClick={onLimpar}
          className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
        >
          Limpar
        </button>
      )}
    </Chips>
  );
}

// Chips de dono (SDR). Contagens de totais.por_dono; "Sem dono" já vem por último.
function FiltroDono({
  opcoes,
  selecionados,
  onAlternar,
  onLimpar,
}: {
  opcoes: OpcaoDono[];
  selecionados: string[];
  onAlternar: (chave: string) => void;
  onLimpar: () => void;
}) {
  if (opcoes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        Dono:
      </span>
      <Chips
        rotulo="Filtrar por dono (SDR)"
        opcoes={opcoes.map((o) => ({ chave: o.chave, label: o.nome, contagem: o.pendentes }))}
        selecionados={selecionados}
        onAlternar={onAlternar}
      >
        {selecionados.length > 0 && (
          <button
            type="button"
            onClick={onLimpar}
            className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
          >
            Limpar
          </button>
        )}
      </Chips>
    </div>
  );
}

// Chips de origem: Ao vivo | Replay são multi-seleção entre si; "Convidados de
// resgate" é INDEPENDENTE e combina com qualquer um deles.
function FiltroOrigem({
  contagem,
  selecionados,
  soResgate,
  onAlternar,
  onResgate,
  onLimpar,
}: {
  contagem: ContagemOrigem;
  selecionados: OrigemChave[];
  soResgate: boolean;
  onAlternar: (o: OrigemChave) => void;
  onResgate: () => void;
  onLimpar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
        <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
        Origem:
      </span>
      <Chips
        rotulo="Filtrar por origem"
        opcoes={ORIGENS.map((o) => ({
          chave: o.chave,
          label: o.label,
          contagem: contagem[o.chave],
          classeAtivo: o.chipAtivo,
        }))}
        selecionados={selecionados}
        onAlternar={(chave) => onAlternar(chave as OrigemChave)}
      >
        <span className="mx-1 h-4 w-px bg-borda" aria-hidden />
        <button
          type="button"
          aria-pressed={soResgate}
          onClick={onResgate}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            soResgate
              ? "border-azul/60 bg-azul/15 text-azul-claro"
              : "border-borda text-texto-sec hover:text-texto",
            contagem.resgate === 0 && !soResgate && "opacity-50",
          )}
        >
          <LifeBuoy className="h-3 w-3" aria-hidden />
          Convidados de resgate <span className="tabular-nums">({contagem.resgate})</span>
        </button>
        {(selecionados.length > 0 || soResgate) && (
          <button
            type="button"
            onClick={onLimpar}
            className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
          >
            Limpar
          </button>
        )}
      </Chips>
    </div>
  );
}

// Controle segmentado de duas ou mais opções (Ciclo | Intervalo, Lista | Por SDR).
function Alternador<T extends string>({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="flex gap-1 rounded-lg border border-borda bg-painel p-0.5"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            valor === o.valor ? "bg-azul/20 text-azul-claro" : "text-texto-sec hover:text-texto",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BarrasPorTier({
  leads,
  selecionados,
  onAlternar,
}: {
  leads: LeadPendente[];
  selecionados: TierChave[];
  onAlternar: (t: TierChave) => void;
}) {
  const dist = distribuicaoPorTier(leads);
  const max = dist[0]?.total ?? 1;
  return (
    <ul className="space-y-1.5" aria-label="Pendentes por classificação">
      {dist.map(({ tier, total }) => {
        const ativo = selecionados.includes(tier.chave);
        return (
          <li key={tier.chave}>
            <button
              type="button"
              aria-pressed={ativo}
              onClick={() => onAlternar(tier.chave)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-painel-claro",
                ativo && "bg-painel-claro ring-1 ring-borda",
              )}
            >
              <span className={cn("w-32 shrink-0 truncate text-xs font-medium", tier.text)}>
                {tier.label}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-borda/30">
                <span
                  className={cn("block h-full rounded-full", tier.barra)}
                  style={{ width: `${Math.max((total / max) * 100, 3)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-texto">
                {total}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Tabela / cards ----------------------------------------------------------

function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1500);
    return () => clearTimeout(t);
  }, [copiado]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valor).then(() => setCopiado(true)).catch(() => {});
      }}
      aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
      title={copiado ? "Copiado!" : `Copiar ${rotulo}`}
      className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5 text-verde" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

function LinkWhatsApp({ telefone, destaque = false }: { telefone: string | null | undefined; destaque?: boolean }) {
  const href = linkWhatsApp(telefone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir conversa no WhatsApp"
      title="Abrir no WhatsApp"
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium text-verde transition-colors hover:bg-verde/10",
        destaque ? "border border-verde/40 bg-verde/10 px-3 py-1.5 text-sm" : "p-1 text-xs",
      )}
    >
      <MessageCircle className={destaque ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {destaque && "WhatsApp"}
    </a>
  );
}

// Nome do pendente: botão que abre o painel lateral com os dados do contato.
// O ícone de ficha sinaliza que o backend casou o contato com um lead do Mapa
// de Calor (o link para /leads/:id fica dentro do painel).
function NomePendente({
  lead,
  onAbrir,
  className,
}: {
  lead: LeadPendente;
  onAbrir: (id: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(chaveDaLinha(lead))}
      title={
        lead.lead_id
          ? "Ver detalhes — tem ficha no Mapa de Calor"
          : "Ver detalhes do contato (sem ficha no Mapa de Calor)"
      }
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-left font-medium text-texto hover:text-azul-claro hover:underline",
        className,
      )}
    >
      <span className="truncate">{lead.nome}</span>
      {lead.lead_id && <FileText className="h-3.5 w-3.5 shrink-0 text-azul-claro" aria-hidden />}
    </button>
  );
}

// --- Painel lateral de detalhe do pendente -----------------------------------

function LinhaDetalhe({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-borda/40 py-2.5 last:border-0">
      <p className="text-[11px] uppercase tracking-wide text-texto-sec">{rotulo}</p>
      <div className="mt-0.5 text-sm text-texto">{children}</div>
    </div>
  );
}

function DetalhePendente({ lead, onClose }: { lead: LeadPendente; onClose: () => void }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  const wa = linkWhatsApp(lead.telefone);
  const tags = lead.tags ?? [];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Detalhes de ${lead.nome}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-borda bg-painel shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-borda/60 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-texto">{lead.nome}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <MqlBadge lead={lead} size="sm" />
              {lead.origem !== undefined && <OrigemCelula lead={lead} />}
              <DonoBadge dono={lead.dono} size="sm" />
              {lead.evento_tag && <span className="text-xs text-texto-sec">{lead.evento_tag}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-texto-sec hover:bg-painel-claro hover:text-texto"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <LinhaDetalhe rotulo="Negócio na Clint">
            {lead.url_clint ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <LinkClint url={lead.url_clint} destaque />
                <span className="text-texto-sec">
                  {lead.etapa ? `Etapa: ${lead.etapa}` : "Etapa não informada"}
                  {lead.dono ? ` · Dono: ${lead.dono.nome}` : " · Sem dono"}
                </span>
              </span>
            ) : (
              <span className="text-texto-sec">Sem negócio na Clint para este contato.</span>
            )}
          </LinhaDetalhe>

          {lead.origem !== undefined && (
            <LinhaDetalhe rotulo="Presença no ciclo">
              <span className="text-texto-sec">
                Origem: <span className="text-texto">{origemDoLead(lead)?.label ?? "—"}</span>
                {lead.assistiu_ao_vivo ? " · esteve ao vivo" : ""}
                {lead.acessou_replay ? " · abriu o replay" : ""}
                {lead.assistiu_replay ? " · assistiu 30+ min do replay" : ""}
                {lead.convidado_resgate ? " · convidado da campanha de resgate" : ""}
              </span>
            </LinhaDetalhe>
          )}

          <LinhaDetalhe rotulo="Ficha no Mapa de Calor">
            {lead.lead_id ? (
              <Link
                href={`/leads/${encodeURIComponent(lead.lead_id)}`}
                className="inline-flex items-center gap-1 font-medium text-azul-claro hover:underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Abrir ficha do lead
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : (
              <span className="text-texto-sec">
                Sem ficha — o contato ainda não entrou em nenhum estágio na Clint, então o motor
                de score não o conhece. Aja pelo WhatsApp ou e-mail.
              </span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Telefone">
            {lead.telefone ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{lead.telefone}</span>
                <BotaoCopiar valor={lead.telefone} rotulo="telefone" />
                {wa && <LinkWhatsApp telefone={lead.telefone} destaque />}
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="E-mail">
            {lead.email ? (
              <span className="flex flex-wrap items-center gap-1">
                <a href={`mailto:${lead.email}`} className="break-all hover:text-azul-claro hover:underline">
                  {lead.email}
                </a>
                <BotaoCopiar valor={lead.email} rotulo="e-mail" />
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Entrou em">
            {lead.created_at ? (
              <span>
                {dataCompleta(lead.created_at)}{" "}
                <span className="text-texto-sec">
                  ({dataHora(lead.created_at)} · {tempoRelativo(lead.created_at)})
                </span>
              </span>
            ) : (
              <span className="text-texto-sec">—</span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo={`Tags na Clint (${tags.length})`}>
            {tags.length === 0 ? (
              <span className="text-texto-sec">—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-borda bg-painel-claro px-2 py-0.5 text-[11px] text-texto-sec"
                  >
                    {t}
                  </span>
                ))}
              </span>
            )}
          </LinhaDetalhe>

          <LinhaDetalhe rotulo="Id do contato na Clint">
            <span className="flex items-center gap-1 text-xs text-texto-sec">
              <span className="font-mono">{lead.clint_contact_id}</span>
              <BotaoCopiar valor={lead.clint_contact_id} rotulo="id do contato" />
            </span>
          </LinhaDetalhe>
        </div>
      </aside>
    </div>
  );
}

// Célula "Origem": badge (Ao vivo | Replay) + marcadores pequenos com tooltip.
const ICONE_MARCADOR: Record<MarcadorOrigem, { Icone: typeof LifeBuoy; cor: string }> = {
  resgate: { Icone: LifeBuoy, cor: "text-azul-claro" },
  viu_replay: { Icone: MonitorPlay, cor: "text-violeta" },
  esteve_ao_vivo: { Icone: Radio, cor: "text-teal" },
};

function OrigemCelula({ lead }: { lead: LeadPendente }) {
  return (
    <span className="inline-flex items-center gap-1">
      <OrigemBadge lead={lead} size="sm" />
      {marcadoresDoLead(lead).map((m) => {
        const { Icone, cor } = ICONE_MARCADOR[m];
        return (
          <span key={m} role="img" aria-label={TEXTO_MARCADOR[m]} title={TEXTO_MARCADOR[m]} className="inline-flex">
            <Icone className={cn("h-3.5 w-3.5", cor)} aria-hidden />
          </span>
        );
      })}
    </span>
  );
}

// "Abrir na Clint": usa EXATAMENTE a url_clint recebida (o front nunca monta
// URL). Sem url → não renderiza.
function LinkClint({ url, destaque = false }: { url: string | null | undefined; destaque?: boolean }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir na Clint"
      title="Abrir na Clint"
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium text-azul-claro transition-colors hover:bg-azul/10",
        destaque ? "border border-azul/40 bg-azul/10 px-3 py-1.5 text-sm" : "p-1 text-xs",
      )}
    >
      <ExternalLink className={destaque ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      {destaque && "Clint"}
    </a>
  );
}

function Tags({ tags }: { tags: string[] | null | undefined }) {
  const lista = tags ?? [];
  if (lista.length === 0) return <span className="text-texto-sec/50">—</span>;
  const visiveis = lista.slice(0, 3);
  const resto = lista.slice(3);
  return (
    <span className="flex flex-wrap gap-1">
      {visiveis.map((t) => (
        <span
          key={t}
          className="max-w-[140px] truncate rounded-full border border-borda bg-painel-claro px-2 py-0.5 text-[11px] text-texto-sec"
          title={t}
        >
          {t}
        </span>
      ))}
      {resto.length > 0 && (
        <span
          className="rounded-full border border-borda px-2 py-0.5 text-[11px] font-medium text-texto-sec"
          title={resto.join(", ")}
          tabIndex={0}
          aria-label={`Mais ${resto.length}: ${resto.join(", ")}`}
        >
          +{resto.length}
        </span>
      )}
    </span>
  );
}

function EntrouEm({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-texto-sec/50">—</span>;
  return (
    <time dateTime={iso} title={dataHora(iso)} className="whitespace-nowrap text-texto-sec">
      {tempoRelativo(iso)}
    </time>
  );
}

function CabecalhoOrdenavel({
  rotulo,
  campo,
  ordenacao,
  onOrdenar,
}: {
  rotulo: string;
  campo: CampoOrdenacao;
  ordenacao: Ordenacao;
  onOrdenar: (c: CampoOrdenacao) => void;
}) {
  const ativo = ordenacao?.campo === campo;
  const Icone = !ativo ? ArrowUpDown : ordenacao.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(campo)}
      aria-sort={ativo ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:text-texto",
        ativo ? "text-texto" : "text-texto-sec",
      )}
    >
      {rotulo}
      <Icone className="h-3 w-3" aria-hidden />
    </button>
  );
}

function ListaPendentes({
  leads,
  pagina,
  onPagina,
  multiEvento,
  ordenacao,
  onOrdenar,
  onAbrir,
  ordenavel = true,
  paginar: permitePaginar = true,
  semColunaDono = false,
  comOrigem = false,
}: {
  leads: LeadPendente[];
  pagina: number;
  onPagina: (p: number) => void;
  multiEvento: boolean;
  ordenacao: Ordenacao;
  onOrdenar: (c: CampoOrdenacao) => void;
  onAbrir: (id: string) => void;
  // "Por SDR": ordem fixa (tier desc), sem paginação e sem a coluna Dono (é o título da seção).
  ordenavel?: boolean;
  paginar?: boolean;
  semColunaDono?: boolean;
  // Coluna "Origem" — só quando o backend manda a matriz/origem.
  comOrigem?: boolean;
}) {
  const paginar = permitePaginar && leads.length > TAMANHO_PAGINA;
  const th = (rotulo: string, campo: CampoOrdenacao) =>
    ordenavel ? (
      <CabecalhoOrdenavel rotulo={rotulo} campo={campo} ordenacao={ordenacao} onOrdenar={onOrdenar} />
    ) : (
      <span className="font-medium">{rotulo}</span>
    );
  const totalPaginas = Math.max(1, Math.ceil(leads.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = paginar
    ? leads.slice((paginaAtual - 1) * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA)
    : leads;

  return (
    <>
      {/* Tabela (≥ md) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda text-xs text-texto-sec">
              <th className="px-2 py-2 text-left">{th("Nome", "nome")}</th>
              <th className="px-2 py-2 text-left">{th("MQL", "tier")}</th>
              {comOrigem && <th className="px-2 py-2 text-left">{th("Origem", "origem")}</th>}
              {!semColunaDono && <th className="px-2 py-2 text-left">{th("Dono", "dono")}</th>}
              {multiEvento && <th className="px-2 py-2 text-left font-medium">Evento</th>}
              <th className="px-2 py-2 text-left font-medium">Telefone</th>
              <th className="px-2 py-2 text-left font-medium">E-mail</th>
              <th className="whitespace-nowrap px-2 py-2 text-left font-medium">Entrou em</th>
              <th className="min-w-[280px] px-2 py-2 text-left font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={chaveDaLinha(l)} className="border-b border-borda/40 align-top">
                <td className="max-w-[220px] px-2 py-2">
                  <NomePendente lead={l} onAbrir={onAbrir} />
                </td>
                <td className="px-2 py-2">
                  <MqlBadge lead={l} size="sm" />
                </td>
                {comOrigem && (
                  <td className="whitespace-nowrap px-2 py-2">
                    <OrigemCelula lead={l} />
                  </td>
                )}
                {!semColunaDono && (
                  <td className="px-2 py-2">
                    <DonoBadge dono={l.dono} size="sm" />
                  </td>
                )}
                {multiEvento && (
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-texto-sec">
                    {l.evento_tag ?? "—"}
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-2">
                  <span className="inline-flex items-center gap-0.5">
                    {l.telefone ? (
                      <>
                        <span className="tabular-nums text-texto">{l.telefone}</span>
                        <BotaoCopiar valor={l.telefone} rotulo="telefone" />
                        <LinkWhatsApp telefone={l.telefone} />
                      </>
                    ) : (
                      <span className="text-texto-sec/50">—</span>
                    )}
                    <LinkClint url={l.url_clint} />
                  </span>
                </td>
                <td className="max-w-[240px] px-2 py-2">
                  {l.email ? (
                    <span className="inline-flex max-w-full items-center gap-0.5">
                      <span className="truncate text-texto" title={l.email}>
                        {l.email}
                      </span>
                      <BotaoCopiar valor={l.email} rotulo="e-mail" />
                    </span>
                  ) : (
                    <span className="text-texto-sec/50">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-xs">
                  <EntrouEm iso={l.created_at} />
                </td>
                <td className="px-2 py-2">
                  <Tags tags={l.tags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards (< md): nome + MQL + WhatsApp em destaque */}
      <ul className="space-y-2 md:hidden">
        {visiveis.map((l) => (
          <li key={chaveDaLinha(l)} className="rounded-xl border border-borda bg-painel-claro/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <NomePendente lead={l} onAbrir={onAbrir} />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <MqlBadge lead={l} size="sm" />
                  {comOrigem && <OrigemCelula lead={l} />}
                  {!semColunaDono && <DonoBadge dono={l.dono} size="sm" />}
                  {multiEvento && l.evento_tag && (
                    <span className="text-[11px] text-texto-sec">{l.evento_tag}</span>
                  )}
                  <EntrouEm iso={l.created_at} />
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <LinkWhatsApp telefone={l.telefone} destaque />
                <LinkClint url={l.url_clint} destaque />
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {l.telefone && (
                <p className="flex items-center gap-1 text-texto">
                  <span className="tabular-nums">{l.telefone}</span>
                  <BotaoCopiar valor={l.telefone} rotulo="telefone" />
                </p>
              )}
              {l.email && (
                <p className="flex items-center gap-1 text-texto">
                  <span className="truncate">{l.email}</span>
                  <BotaoCopiar valor={l.email} rotulo="e-mail" />
                </p>
              )}
              <Tags tags={l.tags} />
            </div>
          </li>
        ))}
      </ul>

      {paginar && (
        <nav className="flex items-center justify-between text-xs text-texto-sec" aria-label="Paginação">
          <span>
            Página {paginaAtual} de {totalPaginas} · {leads.length} pendentes
          </span>
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={paginaAtual <= 1}
              onClick={() => onPagina(paginaAtual - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => onPagina(paginaAtual + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </span>
        </nav>
      )}
    </>
  );
}

// --- Rodapé -----------------------------------------------------------------------

function Rodape({
  data,
  atualizando,
  onAtualizar,
}: {
  data: OportunidadesResponse;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-texto-sec">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Atualizado em{" "}
          <time dateTime={data.gerado_em} className="text-texto">
            {dataHora(data.gerado_em)}
          </time>
        </span>
        {data.cache === "hit" && (
          <span className="inline-flex items-center gap-1 text-texto-sec/70" title="Resposta servida do cache do backend">
            <Database className="h-3 w-3" aria-hidden />
            Dado em cache — pode ter até 5 min.
          </span>
        )}
        <span className="text-texto-sec/70">
          Tags consultadas: {data.eventos.length > 0 ? data.eventos.join(", ") : tagsEventoNoIntervalo(data.de, data.ate).join(", ") || "nenhuma"}
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onAtualizar} loading={atualizando}>
        {!atualizando && <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        Atualizar
      </Button>
    </div>
  );
}
