"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Eye,
  Gem,
  Hand,
  Hourglass,
  Inbox,
  LifeBuoy,
  MessageCircle,
  MonitorPlay,
  Radio,
  PartyPopper,
  Search,
  Timer,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  fetchInscritos,
  fetchNaoAbordados,
  fetchOportunidades,
  fetchPresentes,
  OportunidadesError,
} from "@/lib/data/dataClient";
import {
  rotuloCiclo,
} from "@/lib/sdr/ciclo";
import {
  agruparPorDono,
  altoValorPendente,
  blocosDoFunil,
  blocosDoResgate,
  blocosFunilAoVivo,
  leadsDoRecorte,
  celulaMatriz,
  chaveDaLinha,
  contarPorOrigem,
  contarPorTier,
  formatarPct,
  formatarTaxa,
  pct,
  funilZerado,
  marcadoresDoLead,
  ORIGENS,
  origemDoLead,
  TEXTO_MARCADOR,
  csvDePendentes,
  distribuicaoPorTier,
  filtrarPendentes,
  linkWhatsApp,
  opcoesDeDono,
  ordenarPendentes,
  TIERS,
  TIERS_ALTO_VALOR,
  todosDesqualificados,
  type BlocoFunil,
  type CampoOrdenacao,
  type ContagemOrigem,
  type LeadPendente,
  type LinhaMatriz,
  type MarcadorOrigem,
  type OpcaoDono,
  type OrigemChave,
  type RecorteLevantou,
  type Ordenacao,
  type OportunidadesResponse,
  resumoFecha,
  type RecorteOportunidades,
  type ResumoEvento,
  type TotaisOportunidades,
  type TierChave,
} from "@/lib/sdr/oportunidades";
import {
  blocosNaoAbordados,
  contarParados,
  csvDeNaoAbordados,
  DIAS_PARADO_ALERTA,
  diasParado,
  filtrarNaoAbordados,
  paradoHaMais,
  type NaoAbordadosResponse,
} from "@/lib/sdr/naoAbordados";
import {
  blocosPresentes,
  contarAgendaram,
  contarAteOFim,
  csvDePresentes,
  ficouAteOFim,
  filtrarPresentes,
  type PresentesResponse,
} from "@/lib/sdr/presentesSemAplicar";
import { rotuloMinutos } from "@/lib/sdr/retencao";
import {
  contarSinais,
  csvDeInscritos,
  filtrarInscritos,
  SINAIS,
  sinaisDoInscrito,
  type InscritosResponse,
  type SinalChave,
} from "@/lib/sdr/inscritos";
import { dataCompleta, dataHora, tempoRelativo } from "@/lib/formatters/date";
import { DonoBadge, MqlBadge, OrigemBadge, SeloAgendou, SeloNinja } from "@/components/domain/Badges";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";
import { hrefDoRecorte, RECORTES_LEVANTOU } from "./abas";
import { KpiChip } from "./KpiChip";
import { Alternador, CarregandoEventos, ErroEventos, FaixaAvisos, RodapeEventos } from "./EventosComuns";
import { SeletorPeriodo, usePeriodoEvento } from "./PeriodoEvento";

// ---------------------------------------------------------------------------
// Aba "Oportunidades do Evento": quem aplicou no webinar e NÃO agendou call, com contato
// para o SDR agir sem sair da tela. Período (ciclo | intervalo) vai ao backend;
// MQL, busca, ordenação, paginação e CSV são client-side (lib/sdr/oportunidades).
//
// LAYOUT: período e, logo abaixo, a barra de RECORTES (Visão geral | Ao vivo |
// Replay | Campanha de resgate | Não abordados) ACIMA de tudo. O que vem depois
// depende do recorte: na Visão geral, a matriz completa e os três funis; nos
// demais, CARDS com os números daquele recorte, SÓ o funil dele e só os leads
// dele (filtros e tabela). Os quatro recortes de quem levantou a mão partem da
// MESMA resposta (/oportunidades); "Não abordados" é OUTRA população (inscritos
// em "Sem atendimento") com endpoint próprio e conteúdo próprio
// (ConteudoNaoAbordados). O período é compartilhado (LevantouMaoPanel) e os
// filtros são por recorte (remontados por `key` e restaurados da memória).
// ---------------------------------------------------------------------------

type Visao = "lista" | "por_sdr";
const TAMANHO_PAGINA = 50;

export function LevantouMaoPanel({ recorte }: { recorte: RecorteLevantou }) {
  // Período compartilhado com a aba de Retenção; sobrevive à troca de recorte.
  const periodoEvento = usePeriodoEvento();
  const { erroIntervalo, periodo } = periodoEvento;

  // Duas fontes, uma por vez: só a consulta do recorte aberto roda.
  const ehNaoAbordados = recorte === "nao_abordados";
  const oportunidades = useQuery({
    queryKey: ["oportunidades", periodo.de, periodo.ate],
    queryFn: () => fetchOportunidades(periodo.de, periodo.ate),
    enabled: !erroIntervalo && recorte !== "nao_abordados" && recorte !== "presentes",
    retry: false,
  });
  const naoAbordados = useQuery({
    queryKey: ["nao-abordados", periodo.de, periodo.ate],
    queryFn: () => fetchNaoAbordados(periodo.de, periodo.ate),
    enabled: !erroIntervalo && ehNaoAbordados,
    retry: false,
  });
  const ehPresentes = recorte === "presentes";
  const presentes = useQuery({
    queryKey: ["presentes-sem-aplicar", periodo.de, periodo.ate],
    queryFn: () => fetchPresentes(periodo.de, periodo.ate),
    enabled: !erroIntervalo && ehPresentes,
    retry: false,
  });
  // Visão geral: além de /oportunidades (matriz, funis), a lista COMPLETA dos
  // inscritos vem de /inscritos (contrato provisório). Se falhar (rota ainda
  // não publicada), a Visão geral mostra os pendentes e avisa — nunca quebra.
  const ehGeral = recorte === "geral";
  const inscritos = useQuery({
    queryKey: ["inscritos", periodo.de, periodo.ate],
    queryFn: () => fetchInscritos(periodo.de, periodo.ate),
    enabled: !erroIntervalo && ehGeral,
    retry: false,
  });
  const { error, isLoading, isFetching, isError, refetch } = ehNaoAbordados
    ? naoAbordados
    : ehPresentes
      ? presentes
      : oportunidades;
  const data = oportunidades.data;

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
            Oportunidades do evento
          </h2>
          <p className="mt-0.5 text-xs text-texto-sec">
            Contatos com a tag do evento (WG) que marcaram &ldquo;Levantou a Mão&rdquo; na Clint e
            ainda não têm call agendada (em nenhum estágio). Métrica de time — sem escopo por
            papel. Nome com ícone de ficha abre o lead no Mapa de Calor.
          </p>
        </div>

        <SeletorPeriodo id="ciclo-levantou" periodo={periodoEvento} campoInvalido={campoInvalido} />
      </div>

      {erroIntervalo ? null : isLoading ? (
        <CarregandoEventos rotulo="oportunidades" />
      ) : isError ? (
        <ErroEventos error={error} onRetry={() => refetch()} rotulo="as oportunidades" />
      ) : recorte === "nao_abordados" ? (
        naoAbordados.data && (
          <ConteudoNaoAbordados
            data={naoAbordados.data}
            periodo={periodo}
            atualizando={isFetching}
            onAtualizar={() => refetch()}
          />
        )
      ) : recorte === "presentes" ? (
        presentes.data && (
          <ConteudoPresentes
            data={presentes.data}
            periodo={periodo}
            atualizando={isFetching}
            onAtualizar={() => refetch()}
          />
        )
      ) : !data ? (
        <ErroEventos error={error} onRetry={() => refetch()} rotulo="as oportunidades" />
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
        <ConteudoRecorte
          key={recorte}
          recorte={recorte}
          data={data}
          inscritos={ehGeral ? inscritos.data ?? null : null}
          inscritosIndisponivel={ehGeral && inscritos.isError}
          inscritosCarregando={ehGeral && inscritos.isLoading}
          periodo={periodo}
          atualizando={isFetching || (ehGeral && inscritos.isFetching)}
          onAtualizar={() => {
            refetch();
            if (ehGeral) inscritos.refetch();
          }}
        />
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo de UM recorte: matriz, sub-abas, funil, filtros e tabela. Remontado
// (key) a cada troca de recorte; os filtros voltam do que ficou em memória.
// ---------------------------------------------------------------------------

type FiltrosSalvos = {
  tiers: TierChave[];
  donos: string[];
  origens: OrigemChave[];
  soResgate: boolean;
  marcadores: MarcadorOrigem[];
  visao: Visao;
  busca: string;
  ordenacao: Ordenacao;
};
// Memória por recorte, viva enquanto a página estiver aberta (sobrevive à troca
// de aba, que remonta o componente; não sobrevive a um reload — de propósito).
const memoriaFiltros = new Map<RecorteOportunidades, FiltrosSalvos>();

const TITULO_TABELA: Record<RecorteOportunidades, string> = {
  geral: "Pendentes",
  ao_vivo: "Pendentes do ao vivo",
  replay: "Pendentes do replay",
  resgate: "Pendentes da campanha de resgate",
};

const VAZIO_RECORTE: Record<RecorteOportunidades, { titulo: string; descricao: string }> = {
  geral: { titulo: "Nenhum pendente neste período", descricao: "" },
  ao_vivo: {
    titulo: "Nenhum pendente do ao vivo",
    descricao: "Todos que levantaram a mão ao vivo já agendaram neste período.",
  },
  replay: {
    titulo: "Nenhum pendente do replay",
    descricao: "Ninguém aplicou só pelo replay sem agendar neste período.",
  },
  resgate: {
    titulo: "Nenhum pendente da campanha de resgate",
    descricao: "Nenhum convidado de resgate está aguardando agendamento neste período.",
  },
};

function ConteudoRecorte({
  recorte,
  data,
  inscritos = null,
  inscritosIndisponivel = false,
  inscritosCarregando = false,
  periodo,
  atualizando,
  onAtualizar,
}: {
  recorte: RecorteOportunidades;
  data: OportunidadesResponse;
  // Lista completa dos inscritos (só na Visão geral; null = sem dado).
  inscritos?: InscritosResponse | null;
  inscritosIndisponivel?: boolean;
  inscritosCarregando?: boolean;
  periodo: { de: string; ate: string };
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const router = useRouter();
  // --- Filtros client-side --------------------------------------------------
  // Estado POR RECORTE: começa do que ficou salvo da última visita a esta aba.
  const salvo = memoriaFiltros.get(recorte);
  const [tiersSel, setTiersSel] = useState<TierChave[]>(salvo?.tiers ?? []);
  const [donosSel, setDonosSel] = useState<string[]>(salvo?.donos ?? []);
  // Origem: a linha clicada na matriz e os chips compartilham ESTE estado.
  const [origensSel, setOrigensSel] = useState<OrigemChave[]>(salvo?.origens ?? []);
  const [soResgate, setSoResgate] = useState(salvo?.soResgate ?? false);
  const [marcadoresSel, setMarcadoresSel] = useState<MarcadorOrigem[]>(salvo?.marcadores ?? []);
  const [visao, setVisao] = useState<Visao>(salvo?.visao ?? "lista");
  const [busca, setBusca] = useState(salvo?.busca ?? "");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(salvo?.ordenacao ?? null);
  const [pagina, setPagina] = useState(1);
  // Linha aberta no painel lateral (clique no nome). Chave = (contato, evento).
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    memoriaFiltros.set(recorte, {
      tiers: tiersSel,
      donos: donosSel,
      origens: origensSel,
      soResgate,
      marcadores: marcadoresSel,
      visao,
      busca,
      ordenacao,
    });
  }, [recorte, tiersSel, donosSel, origensSel, soResgate, marcadoresSel, visao, busca, ordenacao]);

  const leads = data.leads;
  // Base do recorte: os chips aplicam em série sobre ELA, não sobre a resposta toda.
  const base = useMemo(() => leadsDoRecorte(leads, recorte), [leads, recorte]);
  const contagem = useMemo(() => contarPorTier(base), [base]);
  // por_dono do backend só vale para a resposta inteira; nos recortes deriva da base.
  const opcoesDono = useMemo(
    () => opcoesDeDono(base, recorte === "geral" ? data.por_dono : null),
    [base, recorte, data.por_dono],
  );
  const contagemOrigem = useMemo(() => contarPorOrigem(base), [base]);
  // MQL → dono → origem → resgate → marcadores → busca, em série.
  const recortado = useMemo(
    () =>
      filtrarPendentes(base, {
        tiers: tiersSel,
        donos: donosSel,
        origens: origensSel,
        soResgate,
        marcadores: marcadoresSel,
        busca,
      }),
    [base, tiersSel, donosSel, origensSel, soResgate, marcadoresSel, busca],
  );
  const filtrados = useMemo(() => ordenarPendentes(recortado, ordenacao), [recortado, ordenacao]);
  // "Por SDR": seções a partir do MESMO recorte filtrado, na ordem do backend
  // (tier desc) — a ordenação por coluna não se aplica nesta visão.
  const grupos = useMemo(() => agruparPorDono(recortado), [recortado]);
  // Sem `matriz` na resposta (backend antigo) a aba cai nos KPIs de contingência.
  const temOrigem = data.matriz != null;
  const multiEvento = data.eventos.length > 1;
  // Nos recortes Ao vivo/Replay a origem é constante: a coluna vira "Sinais" e
  // mostra só os marcadores (resgate, viu o replay / esteve ao vivo).
  const origemConstante = recorte === "ao_vivo" || recorte === "replay";
  const selecionado = useMemo(
    () => leads.find((l) => chaveDaLinha(l) === selecionadoId) ?? null,
    [leads, selecionadoId],
  );

  useEffect(
    () => setPagina(1),
    [tiersSel, donosSel, origensSel, soResgate, marcadoresSel, busca, ordenacao, data],
  );

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
  function alternarMarcador(m: MarcadorOrigem) {
    setMarcadoresSel((atual) => (atual.includes(m) ? atual.filter((x) => x !== m) : [...atual, m]));
  }
  // Clique na linha da matriz. Na visão geral filtra SÓ por aquela origem (de
  // novo, limpa). Nos outros recortes leva para a aba daquela origem.
  const linhaAtiva: OrigemChave | null =
    recorte === "ao_vivo" || recorte === "replay"
      ? recorte
      : recorte === "geral" && origensSel.length === 1
        ? origensSel[0]
        : null;
  function alternarLinhaMatriz(chave: OrigemChave) {
    if (recorte === "geral") setOrigensSel(linhaAtiva === chave ? [] : [chave]);
    else router.push(hrefDoRecorte(chave));
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
    const sufixo = recorte === "geral" ? "" : `_${recorte.replace("_", "-")}`;
    a.download = `oportunidades${sufixo}_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const contagemMarcadores = useMemo(
    () => ({
      viu_replay: base.filter((l) => marcadoresDoLead(l).includes("viu_replay")).length,
      esteve_ao_vivo: base.filter((l) => marcadoresDoLead(l).includes("esteve_ao_vivo")).length,
    }),
    [base],
  );

  return (
    <>
          {/* Barra de recortes ACIMA de tudo: antes da matriz, dos funis e da tabela. */}
          <BarraRecortes recorte={recorte} />
          <FaixaAvisos avisos={data.avisos} />
          {recorte === "geral" ? (
            <>
              {data.resumo && <ResumoDoEvento resumo={data.resumo} totais={data.totais} />}
              {data.matriz ? (
                <MatrizOrigem data={data} linhaAtiva={linhaAtiva} onLinha={alternarLinhaMatriz} />
              ) : (
                <Kpis data={data} />
              )}
              {data.funis && <FunisDoCiclo funis={data.funis} resumo={data.resumo} />}
              {data.resgate && <FunilResgate resgate={data.resgate} />}
            </>
          ) : (
            <>
              <CardsDoRecorte recorte={recorte} data={data} base={base} />
              <FunilDoRecorte recorte={recorte} data={data} />
            </>
          )}


          {recorte === "geral" && inscritos ? (
            <ListaInscritos data={inscritos} periodo={periodo} />
          ) : recorte === "geral" && inscritosCarregando ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : (
            <>
              {recorte === "geral" && inscritosIndisponivel && (
                <p className="ds-card px-6 py-3 text-xs text-texto-sec" role="note">
                  A lista completa dos inscritos ainda não está disponível no backend (rota
                  /api/eventos/inscritos). Abaixo, só os pendentes: quem levantou a mão e não agendou.
                </p>
              )}
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
          ) : base.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                titulo={VAZIO_RECORTE[recorte].titulo}
                descricao={VAZIO_RECORTE[recorte].descricao}
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
                      recorte={recorte}
                      contagem={contagemOrigem}
                      contagemMarcadores={contagemMarcadores}
                      selecionados={origensSel}
                      marcadoresSel={marcadoresSel}
                      soResgate={soResgate}
                      onAlternar={alternarOrigem}
                      onMarcador={alternarMarcador}
                      onResgate={() => setSoResgate((v) => !v)}
                      onLimpar={() => {
                        setOrigensSel([]);
                        setSoResgate(false);
                        setMarcadoresSel([]);
                      }}
                    />
                  )}
                  <BarrasPorTier leads={base} selecionados={tiersSel} onAlternar={alternarTier} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title={`${TITULO_TABELA[recorte]}${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
                  subtitle={`${filtrados.length} de ${base.length} ${base.length === 1 ? "pendente" : "pendentes"} no recorte`}
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
                        className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
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
                      semBadgeOrigem={origemConstante}
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
                            semBadgeOrigem={origemConstante}
                          />
                        </section>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
            </>
          )}

          <RodapeEventos data={data} atualizando={atualizando} onAtualizar={onAtualizar} />
      {selecionado && (
        <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// Recorte "Não abordados": inscritos no evento cujo negócio mais recente está
// em "Sem atendimento" — fonte própria (/api/eventos/nao-abordados). Não é
// subconjunto dos pendentes: é quem ninguém atendeu. A ordem do backend é
// mantida (tier desc, evento desc, nome asc); o que prioriza é o tempo parado.
// ---------------------------------------------------------------------------

type FiltrosNaoAbordadosSalvos = {
  tiers: TierChave[];
  donos: string[];
  soParados: boolean;
  visao: Visao;
  busca: string;
};
const memoriaFiltrosNaoAbordados: { salvo: FiltrosNaoAbordadosSalvos | null } = { salvo: null };

function ConteudoNaoAbordados({
  data,
  periodo,
  atualizando,
  onAtualizar,
}: {
  data: NaoAbordadosResponse;
  periodo: { de: string; ate: string };
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const salvo = memoriaFiltrosNaoAbordados.salvo;
  const [tiersSel, setTiersSel] = useState<TierChave[]>(salvo?.tiers ?? []);
  const [donosSel, setDonosSel] = useState<string[]>(salvo?.donos ?? []);
  const [soParados, setSoParados] = useState(salvo?.soParados ?? false);
  const [visao, setVisao] = useState<Visao>(salvo?.visao ?? "lista");
  const [busca, setBusca] = useState(salvo?.busca ?? "");
  const [pagina, setPagina] = useState(1);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    memoriaFiltrosNaoAbordados.salvo = { tiers: tiersSel, donos: donosSel, soParados, visao, busca };
  }, [tiersSel, donosSel, soParados, visao, busca]);

  const leads = data.leads;
  const contagem = useMemo(() => contarPorTier(leads), [leads]);
  // por_dono vale para a resposta inteira (a mesma população da lista).
  const opcoesDono = useMemo(() => opcoesDeDono(leads, data.por_dono), [leads, data.por_dono]);
  const parados = useMemo(() => contarParados(leads), [leads]);
  const altoValor = altoValorPendente(leads);
  const filtrados = useMemo(
    () => filtrarNaoAbordados(leads, { tiers: tiersSel, donos: donosSel, soParados, busca }),
    [leads, tiersSel, donosSel, soParados, busca],
  );
  const grupos = useMemo(() => agruparPorDono(filtrados), [filtrados]);
  const multiEvento = data.eventos.length > 1;
  const selecionado = useMemo(
    () => leads.find((l) => chaveDaLinha(l) === selecionadoId) ?? null,
    [leads, selecionadoId],
  );
  useEffect(() => setPagina(1), [tiersSel, donosSel, soParados, busca, data]);

  function alternarTier(chave: TierChave) {
    setTiersSel((atual) => (atual.includes(chave) ? atual.filter((t) => t !== chave) : [...atual, chave]));
  }
  function alternarDono(chave: string) {
    setDonosSel((atual) => (atual.includes(chave) ? atual.filter((d) => d !== chave) : [...atual, chave]));
  }
  const soAltoValor =
    tiersSel.length === TIERS_ALTO_VALOR.length && TIERS_ALTO_VALOR.every((t) => tiersSel.includes(t));

  function exportarCsv() {
    const csv = "\uFEFF" + csvDeNaoAbordados(filtrados);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oportunidades_nao-abordados_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inscritos = data.totais.inscritos ?? 0;
  const total = data.totais.nao_abordados;

  return (
    <>
      <BarraRecortes recorte="nao_abordados" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(data.totais.inscritos)} detalhe="com a tag do evento" />
        <KpiChip
          icon={Hourglass}
          rotulo="Não abordados"
          valor={String(total)}
          detalhe={inscritos > 0 ? `${formatarPct(pct(total, inscritos))} dos inscritos` : "em “Sem atendimento”"}
          destaque
        />
        <KpiChip
          icon={Timer}
          rotulo={`Parados há ${DIAS_PARADO_ALERTA}+ dias`}
          valor={String(parados)}
          detalhe={total > 0 ? `${formatarPct(pct(parados, total))} dos não abordados` : undefined}
        />
        <KpiChip icon={Gem} rotulo="Alto valor" valor={String(altoValor)} detalhe="UMQL+ · UMQL · HMQL" />
        <KpiChip icon={Ban} rotulo="QC (fora do recorte)" valor={celulaMatriz(data.totais.qc)} detalhe="outra trilha" tom="neutro" />
      </div>

      <Card>
        <CardHeader
          title="Do evento aos não abordados"
          subtitle="Inscritos no evento e, entre eles, quem ainda está em “Sem atendimento” na Clint."
        />
        <CardContent>
          <FunilBlocos blocos={blocosNaoAbordados(data.totais)} />
        </CardContent>
      </Card>

      {inscritos === 0 && total === 0 ? (
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
      ) : total === 0 || leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={PartyPopper}
            tom="positivo"
            titulo="Todos os inscritos já foram atendidos"
            descricao={`Nenhum dos ${inscritos} inscritos está em “Sem atendimento” neste período.`}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Não abordados por classificação"
              subtitle="A maioria chega sem classificação: o que prioriza aqui é o tempo parado. Clique numa barra ou num chip para filtrar."
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  Tempo parado:
                </span>
                <button
                  type="button"
                  aria-pressed={soParados}
                  onClick={() => setSoParados((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
                    soParados
                      ? "border-laranja/60 bg-laranja/15 text-laranja"
                      : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
                    parados === 0 && !soParados && "opacity-50",
                  )}
                >
                  Parados há {DIAS_PARADO_ALERTA}+ dias <span className="tabular-nums">({parados})</span>
                </button>
                {soParados && (
                  <button
                    type="button"
                    onClick={() => setSoParados(false)}
                    className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <BarrasPorTier leads={leads} selecionados={tiersSel} onAlternar={alternarTier} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={`Não abordados${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
              subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "contato" : "contatos"} em “Sem atendimento” · ordem do backend`}
              action={
                <Button variant="outline" size="sm" onClick={exportarCsv} disabled={filtrados.length === 0}>
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
                    aria-label="Buscar não abordado"
                    className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
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
                  titulo="Nenhum contato neste recorte"
                  descricao="Ajuste os chips de classificação, de dono, o tempo parado ou a busca."
                />
              ) : visao === "lista" ? (
                <ListaPendentes
                  leads={filtrados}
                  pagina={pagina}
                  onPagina={setPagina}
                  multiEvento={multiEvento}
                  ordenacao={null}
                  onOrdenar={() => {}}
                  onAbrir={setSelecionadoId}
                  ordenavel={false}
                  comParadoDesde
                />
              ) : (
                <div className="space-y-5">
                  {grupos.map((g) => (
                    <section key={g.chave} aria-label={`Não abordados de ${g.nome}`}>
                      <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borda/60 pb-1.5">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                          <UserRound className="h-3.5 w-3.5 text-azul-claro" aria-hidden />
                          {g.nome}
                        </h3>
                        <span className="text-xs text-texto-sec">
                          <span className="font-semibold tabular-nums text-texto">{g.leads.length}</span>{" "}
                          {g.leads.length === 1 ? "contato" : "contatos"}
                          {" · "}
                          <span className="font-semibold tabular-nums text-texto">{contarParados(g.leads)}</span>{" "}
                          parados há {DIAS_PARADO_ALERTA}+ dias
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
                        comParadoDesde
                      />
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <RodapeEventos data={data} atualizando={atualizando} onAtualizar={onAtualizar} />
      {selecionado && <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />}
    </>
  );
}


// ---------------------------------------------------------------------------
// Recorte "Presentes que não aplicaram": MQL+ ou acima, inscritos, que ESTIVERAM
// ao vivo e NÃO aplicaram durante o evento — fonte própria
// (/api/eventos/presentes-sem-aplicar). Quem aplicou está nos outros recortes.
// Ordem do backend (tier desc, tempo assistido desc) mantida: quem ficou até o
// fim e não aplicou é o melhor alvo de ligação. `ja_agendou` só ganha selo.
// ---------------------------------------------------------------------------

type FiltrosPresentesSalvos = {
  tiers: TierChave[];
  donos: string[];
  soAteOFim: boolean;
  visao: Visao;
  busca: string;
};
const memoriaFiltrosPresentes: { salvo: FiltrosPresentesSalvos | null } = { salvo: null };

function ConteudoPresentes({
  data,
  periodo,
  atualizando,
  onAtualizar,
}: {
  data: PresentesResponse;
  periodo: { de: string; ate: string };
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const salvo = memoriaFiltrosPresentes.salvo;
  const [tiersSel, setTiersSel] = useState<TierChave[]>(salvo?.tiers ?? []);
  const [donosSel, setDonosSel] = useState<string[]>(salvo?.donos ?? []);
  const [soAteOFim, setSoAteOFim] = useState(salvo?.soAteOFim ?? false);
  const [visao, setVisao] = useState<Visao>(salvo?.visao ?? "lista");
  const [busca, setBusca] = useState(salvo?.busca ?? "");
  const [pagina, setPagina] = useState(1);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    memoriaFiltrosPresentes.salvo = { tiers: tiersSel, donos: donosSel, soAteOFim, visao, busca };
  }, [tiersSel, donosSel, soAteOFim, visao, busca]);

  const leads = data.leads;
  const contagem = useMemo(() => contarPorTier(leads), [leads]);
  const opcoesDono = useMemo(() => opcoesDeDono(leads, data.por_dono), [leads, data.por_dono]);
  const ateOFim = useMemo(() => contarAteOFim(leads), [leads]);
  const agendaram = useMemo(() => contarAgendaram(leads), [leads]);
  const altoValor = altoValorPendente(leads);
  const filtrados = useMemo(
    () => filtrarPresentes(leads, { tiers: tiersSel, donos: donosSel, soAteOFim, busca }),
    [leads, tiersSel, donosSel, soAteOFim, busca],
  );
  const grupos = useMemo(() => agruparPorDono(filtrados), [filtrados]);
  const multiEvento = data.eventos.length > 1;
  const selecionado = useMemo(
    () => leads.find((l) => chaveDaLinha(l) === selecionadoId) ?? null,
    [leads, selecionadoId],
  );
  useEffect(() => setPagina(1), [tiersSel, donosSel, soAteOFim, busca, data]);

  function alternarTier(chave: TierChave) {
    setTiersSel((atual) => (atual.includes(chave) ? atual.filter((t) => t !== chave) : [...atual, chave]));
  }
  function alternarDono(chave: string) {
    setDonosSel((atual) => (atual.includes(chave) ? atual.filter((d) => d !== chave) : [...atual, chave]));
  }
  const soAltoValor =
    tiersSel.length === TIERS_ALTO_VALOR.length && TIERS_ALTO_VALOR.every((t) => tiersSel.includes(t));

  function exportarCsv() {
    const csv = "\uFEFF" + csvDePresentes(filtrados);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oportunidades_presentes-sem-aplicar_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const t = data.totais;
  const inscritos = t.inscritos ?? 0;
  const presentes = t.presentes ?? 0;
  const semAplicar = t.presentes_sem_aplicar ?? 0;
  const total = t.qualificados_sem_aplicar;

  return (
    <>
      <BarraRecortes recorte="presentes" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(t.inscritos)} detalhe="com a tag do evento" />
        <KpiChip
          icon={Radio}
          rotulo="Presentes ao vivo"
          valor={celulaMatriz(t.presentes)}
          detalhe={inscritos > 0 ? `${formatarPct(pct(presentes, inscritos))} dos inscritos` : undefined}
        />
        <KpiChip
          icon={Hand}
          rotulo="Aplicaram"
          valor={celulaMatriz(t.aplicaram)}
          detalhe={presentes > 0 && t.aplicaram != null ? `${formatarPct(pct(t.aplicaram, presentes))} dos presentes` : "durante o evento"}
        />
        <KpiChip
          icon={Hourglass}
          rotulo="Não aplicaram"
          valor={celulaMatriz(t.presentes_sem_aplicar)}
          detalhe={presentes > 0 ? `${formatarPct(pct(semAplicar, presentes))} dos presentes` : undefined}
        />
        <KpiChip
          icon={Gem}
          rotulo="Qualificados sem aplicar"
          valor={String(total)}
          detalhe="MQL+ ou acima · a lista abaixo"
          destaque
        />
      </div>

      <Card>
        <CardHeader
          title="Do evento aos qualificados que não aplicaram"
          subtitle="Inscritos que estiveram ao vivo, não aplicaram durante o evento e são MQL+ ou acima."
        />
        <CardContent>
          <FunilBlocos blocos={blocosPresentes(t)} />
        </CardContent>
      </Card>

      {inscritos === 0 && total === 0 ? (
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
      ) : total === 0 || leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={PartyPopper}
            tom="positivo"
            titulo="Todo qualificado presente aplicou"
            descricao={`Nenhum MQL+ ou acima esteve ao vivo sem aplicar neste período (${presentes} presentes, ${t.aplicaram ?? 0} aplicaram).`}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Qualificados sem aplicar por classificação"
              subtitle={`${ateOFim} ${ateOFim === 1 ? "ficou" : "ficaram"} até o fim · ${agendaram} já ${agendaram === 1 ? "tem" : "têm"} call agendada (só sinalizado, não filtra). Clique numa barra ou num chip para filtrar.`}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  Presença:
                </span>
                <button
                  type="button"
                  aria-pressed={soAteOFim}
                  onClick={() => setSoAteOFim((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
                    soAteOFim
                      ? "border-verde/60 bg-verde/15 text-verde"
                      : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
                    ateOFim === 0 && !soAteOFim && "opacity-50",
                  )}
                >
                  Ficaram até o fim <span className="tabular-nums">({ateOFim})</span>
                </button>
                {soAteOFim && (
                  <button
                    type="button"
                    onClick={() => setSoAteOFim(false)}
                    className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <BarrasPorTier leads={leads} selecionados={tiersSel} onAlternar={alternarTier} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={`Presentes que não aplicaram${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
              subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "qualificado" : "qualificados"} · ${altoValor} alto valor · ordem do backend (classificação, depois tempo assistido)`}
              action={
                <Button variant="outline" size="sm" onClick={exportarCsv} disabled={filtrados.length === 0}>
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
                    aria-label="Buscar presente sem aplicar"
                    className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
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
                  titulo="Nenhum contato neste recorte"
                  descricao="Ajuste os chips de classificação, de dono, a presença ou a busca."
                />
              ) : visao === "lista" ? (
                <ListaPendentes
                  leads={filtrados}
                  pagina={pagina}
                  onPagina={setPagina}
                  multiEvento={multiEvento}
                  ordenacao={null}
                  onOrdenar={() => {}}
                  onAbrir={setSelecionadoId}
                  ordenavel={false}
                  comAssistido
                />
              ) : (
                <div className="space-y-5">
                  {grupos.map((g) => (
                    <section key={g.chave} aria-label={`Presentes sem aplicar de ${g.nome}`}>
                      <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borda/60 pb-1.5">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                          <UserRound className="h-3.5 w-3.5 text-azul-claro" aria-hidden />
                          {g.nome}
                        </h3>
                        <span className="text-xs text-texto-sec">
                          <span className="font-semibold tabular-nums text-texto">{g.leads.length}</span>{" "}
                          {g.leads.length === 1 ? "qualificado" : "qualificados"}
                          {" · "}
                          <span className="font-semibold tabular-nums text-texto">{g.altoValor}</span> alto valor
                          {" · "}
                          <span className="font-semibold tabular-nums text-texto">{contarAteOFim(g.leads)}</span> até o fim
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
                        comAssistido
                      />
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <RodapeEventos data={data} atualizando={atualizando} onAtualizar={onAtualizar} />
      {selecionado && <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />}
    </>
  );
}

// Tempo assistido ao vivo, em destaque: minutos grandes (verde quando ficou até
// o fim) e o percentual ao lado.
function Assistido({ lead }: { lead: LeadPendente }) {
  if (lead.minutos_assistidos == null && lead.percentual_assistido == null) {
    return <span className="text-texto-sec/50">—</span>;
  }
  const fim = ficouAteOFim(lead);
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums", fim ? "text-verde" : "text-texto")}
      title={fim ? "Ficou até o fim do evento" : undefined}
    >
      <Timer className="h-3 w-3 self-center" aria-hidden />
      <span className="text-sm font-semibold">{rotuloMinutos(lead.minutos_assistidos)}</span>
      {lead.percentual_assistido != null && (
        <span className="text-xs text-texto-sec">· {lead.percentual_assistido}%</span>
      )}
    </span>
  );
}

// Há quanto tempo o negócio está parado na etapa. A partir de
// DIAS_PARADO_ALERTA dias fica em laranja (é o critério de prioridade do recorte).
function ParadoDesde({ iso, completo = false }: { iso: string | null | undefined; completo?: boolean }) {
  if (!iso) return <span className="text-texto-sec/50">—</span>;
  const dias = diasParado({ stage_desde: iso });
  const alerta = paradoHaMais({ stage_desde: iso });
  const texto = dias === 0 ? "hoje" : dias === 1 ? "1 dia" : `${dias} dias`;
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap tabular-nums", alerta ? "font-medium text-laranja" : "text-texto-sec")}
      title={`Desde ${dataHora(iso)} (${tempoRelativo(iso)})`}
    >
      <Timer className="h-3 w-3" aria-hidden />
      {texto}
      {completo && <span className="font-normal text-texto-sec"> · desde {dataHora(iso)}</span>}
    </span>
  );
}


// Os cinco números do topo da aba (bloco `resumo` do backend), na ordem pedida,
// cada um com o filtro escrito no próprio card. Definições (backend, 23/09):
// "Aplicaram" = tag Pós WG do evento (aplicou durante a transmissão), sem
// filtro — QC e desqualificados contam; "Qualificados que aplicaram" = tag
// Levantou a Mão do evento, sem corte de tier (na Clint só quem se qualifica a
// recebe); "Qualificados que não aplicaram" = MQL+ ou acima, presentes, sem
// Pós WG. aplicaram − qualificados_aplicaram é informativo (quem aplicou ao vivo
// sem se qualificar) — os dois crus não excluem QC/desqualificado, o outro
// exclui; por isso a diferença só é mostrada quando não é negativa. O último abre a lista de
// /presentes-sem-aplicar (o número é, por garantia do backend, o tamanho dela).
// Abaixo, a conta que liga a base bruta à base de pendentes.
function ResumoDoEvento({ resumo, totais }: { resumo: ResumoEvento; totais: TotaisOportunidades }) {
  const fora = resumo.fora_dos_qualificados;
  const fecha = resumoFecha(resumo, totais);
  const bruto = resumo.inscritos;
  const presentes = resumo.presentes_ao_vivo;
  const aplicaram = resumo.aplicaram;
  // Quem aplicou ao vivo mas não se qualificou (informativo; null se faltar
  // número ou se der negativo, porque as bases dos dois cards não são as mesmas).
  const semQualificar =
    aplicaram != null && resumo.qualificados_aplicaram != null && aplicaram - resumo.qualificados_aplicaram >= 0
      ? aplicaram - resumo.qualificados_aplicaram
      : null;
  const pctDe = (parte: number | null | undefined, todo: number | null | undefined) =>
    parte != null && todo ? `${formatarPct(pct(parte, todo))}` : null;
  return (
    <section aria-label="Resumo do evento" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiChip
          icon={Users}
          rotulo="Inscritos"
          valor={celulaMatriz(bruto)}
          detalhe="todos com a tag do evento"
          filtro="sem filtro"
        />
        <KpiChip
          icon={Radio}
          rotulo="Presentes ao vivo"
          valor={celulaMatriz(presentes)}
          detalhe={pctDe(presentes, bruto) ? `${pctDe(presentes, bruto)} dos inscritos` : undefined}
          filtro="sem filtro"
        />
        <KpiChip
          icon={Hand}
          rotulo="Aplicaram"
          valor={celulaMatriz(aplicaram)}
          detalhe={pctDe(aplicaram, presentes) ? `${pctDe(aplicaram, presentes)} dos presentes` : "durante o evento"}
          filtro="aplicaram durante o evento · sem filtro"
        />
        <KpiChip
          icon={CalendarCheck2}
          rotulo="Qualificados que aplicaram"
          valor={celulaMatriz(resumo.qualificados_aplicaram)}
          detalhe="tag Levantou a Mão do evento"
          filtro="levantaram a mão"
        />
        <KpiChip
          icon={Gem}
          rotulo="Qualificados que não aplicaram"
          valor={celulaMatriz(resumo.qualificados_sem_aplicar)}
          detalhe="presentes ao vivo · abrir a lista"
          filtro="MQL+ ou acima"
          href={hrefDoRecorte("presentes")}
          destaque
        />
      </div>
      {fora && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-texto-sec">
          <span>
            Fora dos qualificados:{" "}
            <span className="font-semibold tabular-nums text-texto">{celulaMatriz(fora.qc)}</span> QC ·{" "}
            <span className="font-semibold tabular-nums text-texto">{celulaMatriz(fora.desqualificados)}</span>{" "}
            desqualificados.
          </span>
          {fecha != null && bruto != null && (
            <span className="tabular-nums">
              {bruto} − {fora.qc} − {fora.desqualificados} = {celulaMatriz(totais.inscritos)} na base de pendentes
            </span>
          )}
          {fecha === true && (
            <span className="inline-flex items-center gap-1 text-verde">
              <Check className="h-3 w-3" aria-hidden />
              confere
            </span>
          )}
          {fecha === false && (
            <span className="tag tag-warning" title="inscritos − qc − desqualificados deveria dar a base de pendentes">
              verificar base
            </span>
          )}
          {semQualificar != null && (
            <span className="basis-full tabular-nums">
              {aplicaram} aplicaram − {resumo.qualificados_aplicaram} levantaram a mão ={" "}
              <span className="font-semibold text-texto">{semQualificar}</span> aplicaram ao vivo sem se qualificar.
            </span>
          )}
        </p>
      )}
    </section>
  );
}


// ---------------------------------------------------------------------------
// Visão geral: lista COMPLETA dos inscritos do ciclo (todas as classificações),
// de /api/eventos/inscritos — contrato provisório. Chips de sinal do ciclo
// (presente, aplicou, levantou a mão, agendou, replay, resgate, sem atendimento)
// combinam em E; classificação, dono e busca como nos outros recortes.
// ---------------------------------------------------------------------------

type FiltrosInscritosSalvos = {
  tiers: TierChave[];
  donos: string[];
  sinais: SinalChave[];
  visao: Visao;
  busca: string;
};
const memoriaFiltrosInscritos: { salvo: FiltrosInscritosSalvos | null } = { salvo: null };

function ListaInscritos({ data, periodo }: { data: InscritosResponse; periodo: { de: string; ate: string } }) {
  const salvo = memoriaFiltrosInscritos.salvo;
  const [tiersSel, setTiersSel] = useState<TierChave[]>(salvo?.tiers ?? []);
  const [donosSel, setDonosSel] = useState<string[]>(salvo?.donos ?? []);
  const [sinaisSel, setSinaisSel] = useState<SinalChave[]>(salvo?.sinais ?? []);
  const [visao, setVisao] = useState<Visao>(salvo?.visao ?? "lista");
  const [busca, setBusca] = useState(salvo?.busca ?? "");
  const [pagina, setPagina] = useState(1);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    memoriaFiltrosInscritos.salvo = { tiers: tiersSel, donos: donosSel, sinais: sinaisSel, visao, busca };
  }, [tiersSel, donosSel, sinaisSel, visao, busca]);

  const leads = data.leads;
  const contagem = useMemo(() => contarPorTier(leads), [leads]);
  const opcoesDono = useMemo(() => opcoesDeDono(leads, data.por_dono), [leads, data.por_dono]);
  const contagemSinais = useMemo(() => contarSinais(leads), [leads]);
  const filtrados = useMemo(
    () => filtrarInscritos(leads, { tiers: tiersSel, donos: donosSel, sinais: sinaisSel, busca }),
    [leads, tiersSel, donosSel, sinaisSel, busca],
  );
  const grupos = useMemo(() => agruparPorDono(filtrados), [filtrados]);
  const multiEvento = data.eventos.length > 1;
  const selecionado = useMemo(
    () => leads.find((l) => chaveDaLinha(l) === selecionadoId) ?? null,
    [leads, selecionadoId],
  );
  useEffect(() => setPagina(1), [tiersSel, donosSel, sinaisSel, busca, data]);

  function alternarTier(chave: TierChave) {
    setTiersSel((atual) => (atual.includes(chave) ? atual.filter((t) => t !== chave) : [...atual, chave]));
  }
  function alternarDono(chave: string) {
    setDonosSel((atual) => (atual.includes(chave) ? atual.filter((d) => d !== chave) : [...atual, chave]));
  }
  function alternarSinal(chave: SinalChave) {
    setSinaisSel((atual) => (atual.includes(chave) ? atual.filter((x) => x !== chave) : [...atual, chave]));
  }
  const soAltoValor =
    tiersSel.length === TIERS_ALTO_VALOR.length && TIERS_ALTO_VALOR.every((t) => tiersSel.includes(t));

  function exportarCsv() {
    const csv = "\uFEFF" + csvDeInscritos(filtrados);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscritos_${periodo.de}_${periodo.ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (leads.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          titulo="Nenhum inscrito neste período"
          descricao={data.eventos.length > 0 ? `Tag consultada: ${data.eventos.join(", ")}.` : "Nenhuma tag WG no período."}
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Todos os inscritos por classificação"
          subtitle="Todas as classificações, inclusive sem classificação. Clique numa barra ou num chip para filtrar; os chips de sinal combinam (todos exigidos)."
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
          <FiltroDono opcoes={opcoesDono} selecionados={donosSel} onAlternar={alternarDono} onLimpar={() => setDonosSel([])} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Sinais do ciclo:
            </span>
            <Chips
              rotulo="Filtrar por sinal do ciclo"
              opcoes={SINAIS.map((s) => ({ chave: s.chave, label: s.label, contagem: contagemSinais[s.chave], classeAtivo: s.classe }))}
              selecionados={sinaisSel}
              onAlternar={(chave) => alternarSinal(chave as SinalChave)}
            >
              {sinaisSel.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSinaisSel([])}
                  className="text-xs text-texto-sec underline-offset-2 hover:text-texto hover:underline"
                >
                  Limpar
                </button>
              )}
            </Chips>
          </div>
          <BarrasPorTier leads={leads} selecionados={tiersSel} onAlternar={alternarTier} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={`Todos os inscritos${multiEvento ? ` — ${data.eventos.length} eventos` : ""}`}
          subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "inscrito" : "inscritos"} · ordem do backend`}
          action={
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={filtrados.length === 0}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Exportar CSV
            </Button>
          }
        />
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec" aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                aria-label="Buscar inscrito"
                className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
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
            <EmptyState titulo="Nenhum inscrito neste recorte" descricao="Ajuste os chips de classificação, de dono, de sinal ou a busca." />
          ) : visao === "lista" ? (
            <ListaPendentes
              leads={filtrados}
              pagina={pagina}
              onPagina={setPagina}
              multiEvento={multiEvento}
              ordenacao={null}
              onOrdenar={() => {}}
              onAbrir={setSelecionadoId}
              ordenavel={false}
              comSinais
            />
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => (
                <section key={g.chave} aria-label={`Inscritos de ${g.nome}`}>
                  <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-borda/60 pb-1.5">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                      <UserRound className="h-3.5 w-3.5 text-azul-claro" aria-hidden />
                      {g.nome}
                    </h3>
                    <span className="text-xs text-texto-sec">
                      <span className="font-semibold tabular-nums text-texto">{g.leads.length}</span>{" "}
                      {g.leads.length === 1 ? "inscrito" : "inscritos"}
                      {" · "}
                      <span className="font-semibold tabular-nums text-texto">{g.altoValor}</span> alto valor
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
                    comSinais
                  />
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {selecionado && <DetalhePendente lead={selecionado} onClose={() => setSelecionadoId(null)} />}
    </>
  );
}

// Chips (só leitura) com os sinais do inscrito no ciclo.
function SinaisCelula({ lead, vazio = "—" }: { lead: LeadPendente; vazio?: string }) {
  const sinais = sinaisDoInscrito(lead);
  if (sinais.length === 0) return <span className="text-xs text-texto-sec/60">{vazio}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {sinais.map((s) => (
        <span key={s.chave} title={s.label} className={cn("tag px-1.5 py-px", s.classe)}>
          {s.curto}
        </span>
      ))}
    </span>
  );
}

// Fileira de cards com um rótulo curto à esquerda ("Sem filtro", "Qualificados"):
// deixa claro de que base cada grupo de números vem.
function FileiraCards({
  rotulo,
  descricao,
  children,
}: {
  rotulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-texto">{rotulo}</span>
        <span className="text-[11px] text-texto-sec">{descricao}</span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{children}</div>
    </div>
  );
}

// Cards com os números do recorte selecionado (no lugar da matriz completa).
// Fonte: a linha da matriz do recorte ou o bloco `resgate`. A "% agendaram" é a
// taxa de agendamento do backend.
function CardsDoRecorte({
  recorte,
  data,
  base,
}: {
  recorte: RecorteOportunidades;
  data: OportunidadesResponse;
  base: LeadPendente[];
}) {
  const altoValor = altoValorPendente(base);
  const grade = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5";

  // Ao vivo com o bloco `resumo`: mesma leitura da Visão geral — uma fileira
  // SEM filtro (base bruta) e outra só dos QUALIFICADOS (matriz.ao_vivo).
  if (recorte === "ao_vivo" && data.resumo && data.matriz) {
    const r = data.resumo;
    const l = data.matriz.ao_vivo;
    const bruto = r.inscritos;
    const presentes = r.presentes_ao_vivo;
    const pctDe = (parte: number | null | undefined, todo: number | null | undefined) =>
      parte != null && todo ? `${formatarPct(pct(parte, todo))}` : null;
    return (
      <div className="space-y-3">
        <FileiraCards rotulo="Sem filtro" descricao="todos com a tag do evento, inclusive QC e desqualificados">
          <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(bruto)} detalhe="todos com a tag do evento" filtro="sem filtro" />
          <KpiChip
            icon={Radio}
            rotulo="Assistiram ao vivo"
            valor={celulaMatriz(presentes)}
            detalhe={pctDe(presentes, bruto) ? `${pctDe(presentes, bruto)} dos inscritos` : undefined}
            filtro="sem filtro"
          />
          <KpiChip
            icon={Hand}
            rotulo="Aplicaram"
            valor={celulaMatriz(r.aplicaram)}
            detalhe={pctDe(r.aplicaram, presentes) ? `${pctDe(r.aplicaram, presentes)} dos que assistiram` : "durante o evento"}
            filtro="aplicaram durante o evento · sem filtro"
          />
          {r.qualificados_presentes != null && (
            <KpiChip
              icon={Eye}
              rotulo="Assistiram · MQL+ ou acima"
              valor={String(r.qualificados_presentes)}
              detalhe={pctDe(r.qualificados_presentes, presentes) ? `${pctDe(r.qualificados_presentes, presentes)} dos que assistiram` : undefined}
              filtro="MQL+ ou acima"
            />
          )}
        </FileiraCards>
        <FileiraCards rotulo="Qualificados" descricao="quem levantou a mão — só quem se qualifica recebe a tag">
          <KpiChip
            icon={Hand}
            rotulo="Levantaram a mão"
            valor={celulaMatriz(l.aplicaram)}
            detalhe={pctDe(l.aplicaram, r.qualificados_presentes ?? presentes) ? `${pctDe(l.aplicaram, r.qualificados_presentes ?? presentes)} ${r.qualificados_presentes != null ? "dos MQL+ que assistiram" : "dos que assistiram"}` : undefined}
            filtro="levantaram a mão"
          />
          <KpiChip
            icon={CalendarCheck2}
            rotulo="Agendaram"
            valor={celulaMatriz(l.agendaram)}
            detalhe={`${formatarTaxa(l.taxa_agendamento)} de conversão`}
            filtro="qualificados"
          />
          <KpiChip icon={Hourglass} rotulo="Pendentes" valor={celulaMatriz(l.pendentes)} detalhe="levantaram a mão e não agendaram" filtro="qualificados" destaque />
          <KpiChip
            icon={Gem}
            rotulo="Alto valor pendente"
            valor={celulaMatriz(l.alto_valor_pendente ?? altoValor)}
            detalhe="entre os pendentes"
            filtro="UMQL+ · UMQL · HMQL"
          />
        </FileiraCards>
      </div>
    );
  }

  if (recorte === "ao_vivo" || recorte === "replay") {
    const l = recorte === "ao_vivo" ? data.matriz?.ao_vivo : data.matriz?.replay;
    if (!l) return null;
    const rotuloAplicaram = recorte === "ao_vivo" ? "Levantaram a mão" : "Aplicaram";
    return (
      <div className={cn(grade, recorte === "replay" && "xl:grid-cols-6")}>
        {recorte === "replay" && (
          <KpiChip icon={MonitorPlay} rotulo="Acessaram" valor={celulaMatriz(l.acessaram)} detalhe="abriram a gravação" />
        )}
        <KpiChip
          icon={Eye}
          rotulo="Assistiram"
          valor={celulaMatriz(l.assistiram)}
          detalhe={recorte === "ao_vivo" ? "participaram ao vivo" : "30+ min da gravação"}
        />
        <KpiChip
          icon={Hand}
          rotulo={rotuloAplicaram}
          valor={celulaMatriz(l.aplicaram)}
          detalhe={l.assistiram ? `${formatarPct(pct(l.aplicaram ?? 0, l.assistiram))} dos que assistiram` : undefined}
        />
        <KpiChip
          icon={CalendarCheck2}
          rotulo="Agendaram"
          valor={celulaMatriz(l.agendaram)}
          detalhe={`${formatarTaxa(l.taxa_agendamento)} de conversão`}
        />
        <KpiChip icon={Hourglass} rotulo="Pendentes" valor={celulaMatriz(l.pendentes)} destaque />
        <KpiChip
          icon={Gem}
          rotulo="Alto valor pendente"
          valor={celulaMatriz(l.alto_valor_pendente ?? altoValor)}
          detalhe="UMQL+ · UMQL · HMQL"
        />
      </div>
    );
  }

  if (recorte === "geral") return null;
  {
    const r = data.resgate;
    if (!r) return null;
    return (
      <div className={cn(grade, "xl:grid-cols-6")}>
        <KpiChip icon={LifeBuoy} rotulo="Convidados" valor={String(r.convidados)} detalhe="receberam o convite" />
        <KpiChip
          icon={Eye}
          rotulo="Assistiram"
          valor={String(r.assistiram)}
          detalhe={`${formatarPct(pct(r.assistiram, r.convidados))} dos convidados`}
        />
        <KpiChip
          icon={Hand}
          rotulo="Levantaram a mão"
          valor={String(r.aplicaram)}
          detalhe={`${formatarPct(pct(r.aplicaram, r.assistiram))} dos que assistiram`}
        />
        <KpiChip
          icon={CalendarCheck2}
          rotulo="Agendaram"
          valor={String(r.agendaram)}
          detalhe={`${formatarPct(pct(r.agendaram, r.aplicaram))} de conversão`}
        />
        <KpiChip icon={Hourglass} rotulo="Pendentes" valor={String(r.pendentes)} destaque />
        <KpiChip icon={Gem} rotulo="Alto valor pendente" valor={String(altoValor)} detalhe="UMQL+ · UMQL · HMQL" />
      </div>
    );
  }
}

// Funil do recorte selecionado (a Visão geral mostra os três).
function FunilDoRecorte({ recorte, data }: { recorte: RecorteOportunidades; data: OportunidadesResponse }) {
  switch (recorte) {
    case "ao_vivo":
      return data.funis ? <FunilAoVivo funis={data.funis} resumo={data.resumo} /> : null;
    case "replay":
      return data.funis ? <FunilReplay funis={data.funis} /> : null;
    case "resgate":
      return data.resgate ? (
        <FunilResgate resgate={data.resgate} />
      ) : (
        <Card>
          <EmptyState
            icon={LifeBuoy}
            titulo="Sem campanha de resgate neste período"
            descricao="Nenhum contato recebeu a tag de convite de resgate do ciclo."
          />
        </Card>
      );
    default:
      return null;
  }
}

// Sub-abas (recortes). Sem contagem ao lado do rótulo (decisão Vata 22/09).
function BarraRecortes({ recorte }: { recorte: RecorteLevantou }) {
  return (
    <div
      role="tablist"
      aria-label="Recortes das oportunidades"
      className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1"
    >
      {RECORTES_LEVANTOU.map((r) => {
        const ativo = r.recorte === recorte;
        return (
          <Link
            key={r.recorte}
            role="tab"
            href={hrefDoRecorte(r.recorte)}
            aria-selected={ativo}
            className={cn(
              "nav-link inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              ativo ? "border-azul/50 bg-azul/15 text-texto" : "border-transparent text-texto",
            )}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}

// --- Estados ---------------------------------------------------------------

// --- KPIs e funil ------------------------------------------------------------

// Contingência: resposta SEM `matriz` (backend antigo). Só os números que o
// contrato V4 garante em `totais`, mais o alto valor derivado dos leads.
function Kpis({ data }: { data: OportunidadesResponse }) {
  const t = data.totais;
  const nEventos = `${data.eventos.length} ${data.eventos.length === 1 ? "evento" : "eventos"}`;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(t.inscritos)} detalhe={`tag do evento · ${nEventos}`} />
      <KpiChip
        icon={Ban}
        tom="neutro"
        rotulo="Desqualificados"
        valor={celulaMatriz(t.desqualificados)}
        detalhe="fora da base · conferência"
      />
      <KpiChip
        icon={Ban}
        tom="neutro"
        rotulo="QC (fora do recorte)"
        valor={celulaMatriz(t.qc)}
        detalhe="outra trilha · conferência"
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
  assistiram_mql: "bg-violeta/40 text-violeta",
  aplicaram: "bg-teal/25 text-teal",
  agendaram: "bg-verde/25 text-verde",
  pendentes: "bg-laranja/20 text-laranja",
  nao_abordados: "bg-rosa/20 text-rosa",
  presentes: "bg-violeta/25 text-violeta",
  nao_aplicaram: "bg-laranja/20 text-laranja",
  qualificados: "bg-rosa/20 text-rosa",
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
function FunilAoVivo({
  funis,
  resumo,
}: {
  funis: NonNullable<OportunidadesResponse["funis"]>;
  resumo?: ResumoEvento | null;
}) {
  const completo = resumo?.presentes_ao_vivo != null;
  const temMql = completo && resumo?.qualificados_presentes != null;
  return (
    <Card>
      <CardHeader
        title="Funil ao vivo — Qualificados"
        subtitle={
          completo
            ? `Todos que assistiram ao vivo${temMql ? ", os MQL+ ou acima entre eles" : ""} e, daí, só os qualificados: “Levantaram a mão” é a tag Levantou a Mão, que só quem se qualifica recebe.`
            : "Quem se inscreveu e participou ao vivo; “Levantaram a mão” é a tag Levantou a Mão, que só os qualificados recebem."
        }
      />
      <CardContent className="space-y-2">
        <FunilBlocos blocos={blocosFunilAoVivo(funis.ao_vivo.degraus, resumo)} />
        {completo && !temMql && (
          <p className="text-[11px] text-texto-sec/80" role="note">
            O degrau “MQL+ ou acima que assistiram” entra quando o backend enviar resumo.qualificados_presentes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FunilReplay({ funis }: { funis: NonNullable<OportunidadesResponse["funis"]> }) {
  const semReplay = funilZerado(funis.replay.degraus);
  return (
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
  );
}

function FunisDoCiclo({
  funis,
  resumo,
}: {
  funis: NonNullable<OportunidadesResponse["funis"]>;
  resumo?: ResumoEvento | null;
}) {
  return (
    <div className="space-y-4">
      <FunilAoVivo funis={funis} resumo={resumo} />
      <FunilReplay funis={funis} />
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
                        ? "border-t border-white/20 bg-white/[0.08] font-semibold text-texto"
                        : "cursor-pointer border-t border-white/10 text-texto hover:bg-white/[0.08]",
                      ativa && "bg-azul/15 ring-1 ring-inset ring-azul/50 hover:bg-azul/15",
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
          <div title="Contatos da trilha QC (outro produto e outro público): saem da base antes de qualquer conta, como os desqualificados">
            <dt className="inline">QC (fora do recorte): </dt>
            <dd className="inline font-semibold tabular-nums text-cinza">{celulaMatriz(t.qc)}</dd>
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
              "rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
              ativo
                ? (o.classeAtivo ?? "border-azul/50 bg-azul/15 text-azul-claro")
                : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
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

// Chips de classificação: a escala MQL, Ninja (outra trilha) e "Sem classificação".
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
          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
          soAltoValor
            ? "border-laranja/60 bg-laranja/15 text-laranja"
            : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
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

// Chips de origem, por recorte. Na visão geral e no resgate: Ao vivo | Replay,
// multi-seleção. Em Ao vivo/Replay a origem é constante, então entra no lugar o
// marcador cruzado ("Viu o replay também" / "Esteve ao vivo também").
// "Convidados de resgate" é independente e combina com qualquer um — some no
// recorte que já é ele.
function FiltroOrigem({
  recorte,
  contagem,
  contagemMarcadores,
  selecionados,
  marcadoresSel,
  soResgate,
  onAlternar,
  onMarcador,
  onResgate,
  onLimpar,
}: {
  recorte: RecorteOportunidades;
  contagem: ContagemOrigem;
  contagemMarcadores: { viu_replay: number; esteve_ao_vivo: number };
  selecionados: OrigemChave[];
  marcadoresSel: MarcadorOrigem[];
  soResgate: boolean;
  onAlternar: (o: OrigemChave) => void;
  onMarcador: (m: MarcadorOrigem) => void;
  onResgate: () => void;
  onLimpar: () => void;
}) {
  const mostraOrigens = recorte !== "ao_vivo" && recorte !== "replay";
  const marcadorCruzado: MarcadorOrigem | null =
    recorte === "ao_vivo" ? "viu_replay" : recorte === "replay" ? "esteve_ao_vivo" : null;
  const mostraResgate = recorte !== "resgate";
  const algumAtivo = selecionados.length > 0 || marcadoresSel.length > 0 || soResgate;

  const opcoes = mostraOrigens
    ? ORIGENS.map((o) => ({ chave: o.chave, label: o.label, contagem: contagem[o.chave], classeAtivo: o.chipAtivo }))
    : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-texto-sec">
        <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
        Origem:
      </span>
      <Chips
        rotulo="Filtrar por origem"
        opcoes={opcoes}
        selecionados={selecionados}
        onAlternar={(chave) => onAlternar(chave as OrigemChave)}
      >
        {marcadorCruzado && (
          <button
            type="button"
            aria-pressed={marcadoresSel.includes(marcadorCruzado)}
            onClick={() => onMarcador(marcadorCruzado)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
              marcadoresSel.includes(marcadorCruzado)
                ? marcadorCruzado === "viu_replay"
                  ? "border-violeta/60 bg-violeta/15 text-violeta"
                  : "border-teal/60 bg-teal/15 text-teal"
                : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
              contagemMarcadores[marcadorCruzado] === 0 && !marcadoresSel.includes(marcadorCruzado) && "opacity-50",
            )}
          >
            {marcadorCruzado === "viu_replay" ? (
              <MonitorPlay className="h-3 w-3" aria-hidden />
            ) : (
              <Radio className="h-3 w-3" aria-hidden />
            )}
            {TEXTO_MARCADOR[marcadorCruzado]}{" "}
            <span className="tabular-nums">({contagemMarcadores[marcadorCruzado]})</span>
          </button>
        )}
        {(mostraOrigens || marcadorCruzado) && mostraResgate && (
          <span className="mx-1 h-4 w-px bg-borda" aria-hidden />
        )}
        {mostraResgate && (
          <button
            type="button"
            aria-pressed={soResgate}
            onClick={onResgate}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-all",
              soResgate
                ? "border-azul/60 bg-azul/15 text-azul-claro"
                : "border-white/20 bg-white/10 text-texto opacity-70 hover:opacity-100",
              contagem.resgate === 0 && !soResgate && "opacity-50",
            )}
          >
            <LifeBuoy className="h-3 w-3" aria-hidden />
            Convidados de resgate <span className="tabular-nums">({contagem.resgate})</span>
          </button>
        )}
        {algumAtivo && (
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

function BarrasPorTier({
  leads,
  selecionados,
  onAlternar,
}: {
  leads: LeadPendente[];
  selecionados: TierChave[];
  onAlternar: (t: TierChave) => void;
}) {
  // Posição fixa (ordem da hierarquia), inclusive barras zeradas.
  const dist = distribuicaoPorTier(leads);
  const max = Math.max(1, ...dist.map((d) => d.total));
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
                "flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-white/[0.08]",
                ativo && "bg-azul/15 ring-1 ring-azul/50",
              )}
            >
              <span
                className={cn(
                  "w-32 shrink-0 truncate text-xs font-medium",
                  total === 0 ? "text-texto-sec/50" : tier.text,
                )}
              >
                {tier.label}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-borda/30">
                <span
                  className={cn("block h-full rounded-full", tier.barra)}
                  style={{ width: `${Math.max((total / max) * 100, 3)}%` }}
                />
              </span>
              <span
                className={cn(
                  "w-8 shrink-0 text-right text-xs font-semibold tabular-nums",
                  total === 0 ? "text-texto-sec/50" : "text-texto",
                )}
              >
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
      className="icon-button h-7 w-7"
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
    <div className="border-b border-white/10 py-3 last:border-0">
      <p className="text-[10px] uppercase tracking-wide opacity-60">{rotulo}</p>
      <div className="mt-1 text-sm text-texto">{children}</div>
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
      <aside className="modal-surface modal-border absolute inset-y-0 right-0 flex w-full max-w-md flex-col rounded-l-modal shadow-layered">
        <div className="flex items-start justify-between gap-4 pb-0 pl-6 pr-6 pt-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="icon-circle shadow-layered">
              <Hand className="h-5 w-5 text-violeta" aria-hidden />
            </span>
            <div className="min-w-0">
            <h2 className="truncate font-jakarta text-xl font-semibold tracking-tight text-texto">{lead.nome}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <MqlBadge lead={lead} size="sm" />
              <SeloNinja lead={lead} />
              <SeloAgendou lead={lead} />
              {lead.origem !== undefined && <OrigemCelula lead={lead} />}
              <DonoBadge dono={lead.dono} size="sm" />
              {lead.evento_tag && <span className="text-xs opacity-70">{lead.evento_tag}</span>}
            </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="icon-button">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
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

          {(lead.levantou_mao != null || lead.aplicou_ao_vivo != null) && (
            <LinhaDetalhe rotulo="Sinais do ciclo">
              <SinaisCelula lead={lead} vazio="Inscrito sem nenhum sinal neste ciclo." />
            </LinhaDetalhe>
          )}

          {(lead.minutos_assistidos != null || lead.percentual_assistido != null) && (
            <LinhaDetalhe rotulo="Presença ao vivo">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Assistido lead={lead} />
                <span className="text-texto-sec">
                  {ficouAteOFim(lead) ? "Ficou até o fim e não aplicou durante o evento — melhor alvo de ligação." : "Esteve ao vivo e não aplicou durante o evento."}
                  {lead.ja_agendou ? " Já tem call agendada." : ""}
                </span>
              </span>
            </LinhaDetalhe>
          )}

          {lead.stage_desde && (
            <LinhaDetalhe rotulo={`Parado em "${lead.etapa ?? "Sem atendimento"}"`}>
              <ParadoDesde iso={lead.stage_desde} completo />
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

function OrigemCelula({ lead, semBadge = false }: { lead: LeadPendente; semBadge?: boolean }) {
  const marcadores = marcadoresDoLead(lead);
  if (semBadge && marcadores.length === 0) return <span className="text-texto-sec/40">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {!semBadge && <OrigemBadge lead={lead} size="sm" />}
      {marcadores.map((m) => {
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
  semBadgeOrigem = false,
  comParadoDesde = false,
  comAssistido = false,
  comSinais = false,
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
  // Origem constante no recorte: cabeçalho "Sinais" e só os marcadores na célula.
  semBadgeOrigem?: boolean;
  // Recorte "Não abordados": coluna com há quanto tempo o negócio está parado.
  comParadoDesde?: boolean;
  // Recorte "Presentes que não aplicaram": coluna com o tempo assistido ao vivo.
  comAssistido?: boolean;
  // Lista completa dos inscritos: coluna com os sinais do ciclo (chips).
  comSinais?: boolean;
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
              {comAssistido && <th className="whitespace-nowrap px-2 py-2 text-left font-medium">Assistiu ao vivo</th>}
              {comSinais && <th className="min-w-[200px] px-2 py-2 text-left font-medium">Sinais do ciclo</th>}
              {comOrigem && (
                <th className="px-2 py-2 text-left">
                  {semBadgeOrigem ? <span className="font-medium">Sinais</span> : th("Origem", "origem")}
                </th>
              )}
              {!semColunaDono && <th className="px-2 py-2 text-left">{th("Dono", "dono")}</th>}
              {comParadoDesde && <th className="whitespace-nowrap px-2 py-2 text-left font-medium">Parado há</th>}
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
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <MqlBadge lead={l} size="sm" />
                    <SeloNinja lead={l} />
                    {!comSinais && <SeloAgendou lead={l} />}
                  </span>
                </td>
                {comAssistido && (
                  <td className="whitespace-nowrap px-2 py-2">
                    <Assistido lead={l} />
                  </td>
                )}
                {comSinais && (
                  <td className="px-2 py-2">
                    <SinaisCelula lead={l} />
                  </td>
                )}
                {comOrigem && (
                  <td className="whitespace-nowrap px-2 py-2">
                    <OrigemCelula lead={l} semBadge={semBadgeOrigem} />
                  </td>
                )}
                {!semColunaDono && (
                  <td className="px-2 py-2">
                    <DonoBadge dono={l.dono} size="sm" />
                  </td>
                )}
                {comParadoDesde && (
                  <td className="whitespace-nowrap px-2 py-2 text-xs">
                    <ParadoDesde iso={l.stage_desde} />
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
          <li key={chaveDaLinha(l)} className="card-interactive rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <NomePendente lead={l} onAbrir={onAbrir} />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <MqlBadge lead={l} size="sm" />
                  <SeloNinja lead={l} />
                  {!comSinais && <SeloAgendou lead={l} />}
                  {comAssistido && <Assistido lead={l} />}
                  {comSinais && <SinaisCelula lead={l} />}
                  {comOrigem && <OrigemCelula lead={l} semBadge={semBadgeOrigem} />}
                  {!semColunaDono && <DonoBadge dono={l.dono} size="sm" />}
                  {comParadoDesde && <ParadoDesde iso={l.stage_desde} />}
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
