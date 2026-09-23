"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  MessageCircle,
  Search,
  Users,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchRetencao, OportunidadesError } from "@/lib/data/dataClient";
import { rotuloCiclo } from "@/lib/sdr/ciclo";
import { celulaMatriz, formatarPct, linkWhatsApp, pct } from "@/lib/sdr/oportunidades";
import {
  alcancaramNoDegrau,
  curvaInconsistente,
  filtrarMedidos,
  formatarPctOuTravessao,
  pontosDaCurva,
  rotuloMinutos,
  type LeadRetencao,
  type PontoRetencao,
  type RetencaoResponse,
} from "@/lib/sdr/retencao";
import { rgb, useThemeColors } from "@/features/theme/useThemeColors";
import { MqlBadge, SeloNinja } from "@/components/domain/Badges";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import { KpiChip } from "./KpiChip";
import { CarregandoEventos, ErroEventos, FaixaAvisos, RodapeEventos } from "./EventosComuns";
import { SeletorPeriodo, usePeriodoEvento } from "./PeriodoEvento";

// ---------------------------------------------------------------------------
// Página "Retenção da audiência" (/retencao, item próprio do menu): quanto do
// webinar cada inscrito assistiu, pelas tags "Assistiu N%" da Clint. Período
// compartilhado com a aba de Oportunidades (usePeriodoEvento). Curva de 7 degraus (eixo X = percentual com
// o minuto correspondente; eixo Y = quantos chegaram até ali), três cards e a
// lista dos medidos, na ordem do backend.
// ---------------------------------------------------------------------------

export function RetencaoPanel() {
  const periodoEvento = usePeriodoEvento();
  const { erroIntervalo, periodo } = periodoEvento;

  const { data, error, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["retencao", periodo.de, periodo.ate],
    queryFn: () => fetchRetencao(periodo.de, periodo.ate),
    enabled: !erroIntervalo,
    retry: false,
  });

  const erro400 = error instanceof OportunidadesError && error.status === 400;
  const campoInvalido = erroIntervalo?.campo ?? (erro400 ? "ambos" : null);

  return (
    <div className="space-y-4">
      {/* Título e descrição vêm do PageHeader da página /retencao. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <SeletorPeriodo id="ciclo-retencao" periodo={periodoEvento} campoInvalido={campoInvalido} />
      </div>

      {erroIntervalo ? null : isLoading ? (
        <CarregandoEventos rotulo="retenção" />
      ) : isError || !data ? (
        <ErroEventos error={error} onRetry={() => refetch()} rotulo="a retenção" />
      ) : (data.totais.inscritos ?? 0) === 0 && data.totais.assistiram === 0 ? (
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
        <ConteudoRetencao data={data} atualizando={isFetching} onAtualizar={() => refetch()} />
      )}
    </div>
  );
}

function ConteudoRetencao({
  data,
  atualizando,
  onAtualizar,
}: {
  data: RetencaoResponse;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const inscritos = data.totais.inscritos ?? 0;
  const assistiram = data.totais.assistiram;
  const semMedicao = data.totais.sem_medicao ?? (inscritos > 0 ? inscritos - assistiram : null);
  const pontos = useMemo(() => pontosDaCurva(data.curva, data.totais.inscritos), [data.curva, data.totais.inscritos]);
  const metade = alcancaramNoDegrau(data.curva, 50);
  const fim = alcancaramNoDegrau(data.curva, 90);
  const inconsistente = curvaInconsistente(data.curva);
  const leads = data.leads ?? [];

  return (
    <>
      <FaixaAvisos avisos={data.avisos} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiChip icon={Users} rotulo="Inscritos" valor={celulaMatriz(data.totais.inscritos)} detalhe="com a tag do evento" />
        <KpiChip
          icon={Eye}
          rotulo="Assistiram"
          valor={String(assistiram)}
          detalhe={inscritos > 0 ? `${formatarPct(pct(assistiram, inscritos))} dos inscritos · chegaram ao 1º degrau` : "chegaram ao 1º degrau"}
          destaque
        />
        <KpiChip
          icon={EyeOff}
          rotulo="Sem medição"
          valor={celulaMatriz(semMedicao)}
          detalhe={semMedicao != null && inscritos > 0 ? `${formatarPct(pct(semMedicao, inscritos))} sem tag de percentual` : "sem tag de percentual"}
          tom="neutro"
        />
        <KpiChip
          icon={Gauge}
          rotulo="Viram metade"
          valor={celulaMatriz(metade)}
          detalhe={metade != null && assistiram > 0 ? `${formatarPct(pct(metade, assistiram))} de quem assistiu` : "chegaram a 50%"}
        />
        <KpiChip
          icon={Flag}
          rotulo="Até o fim"
          valor={celulaMatriz(fim)}
          detalhe={fim != null && assistiram > 0 ? `${formatarPct(pct(fim, assistiram))} de quem assistiu` : "chegaram a 90%"}
        />
      </div>

      <Card>
        <CardHeader
          title="Curva de retenção"
          subtitle="Quantos inscritos chegaram até cada degrau do webinar (percentual e minuto correspondente)."
          action={
            inconsistente ? (
              <span className="tag tag-warning" title="Um degrau tem mais gente que o anterior — a curva deveria só descer.">
                verificar base
              </span>
            ) : undefined
          }
        />
        <CardContent className="space-y-4">
          {assistiram === 0 ? (
            <EmptyState
              icon={EyeOff}
              titulo="Sem medição neste período"
              descricao="Nenhum inscrito tem tag de percentual assistido. Depois do evento, as tags chegam pela integração."
            />
          ) : (
            <>
              <GraficoRetencao pontos={pontos} />
              <TabelaDegraus pontos={pontos} />
            </>
          )}
        </CardContent>
      </Card>

      {leads.length > 0 && <ListaMedidos leads={leads} pontos={pontos} multiEvento={data.eventos.length > 1} />}

      <RodapeEventos data={data} atualizando={atualizando} onAtualizar={onAtualizar} />
    </>
  );
}

// --- Gráfico ------------------------------------------------------------------

type PontoGrafico = PontoRetencao & { eixo: string };

type TooltipProps = {
  active?: boolean;
  payload?: { payload?: PontoGrafico }[];
};

function TooltipRetencao({ active, payload }: TooltipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-borda bg-noite px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-texto">
        Assistiu {p.rotulo} · {p.rotuloMinutos}
      </p>
      <p className="text-texto">
        <span className="font-semibold tabular-nums">{p.alcancaram}</span> chegaram até aqui
      </p>
      <p className="text-texto-sec">
        {formatarPctOuTravessao(p.dosInscritos)} dos inscritos · {formatarPctOuTravessao(p.doPrimeiro)} de quem assistiu
      </p>
    </div>
  );
}

// Tick de duas linhas: "10%" em cima, "15 min" embaixo.
function TickDegrau({ x, y, payload, fill }: { x?: number; y?: number; payload?: { value?: string }; fill?: string }) {
  const [pctTxt, minTxt] = String(payload?.value ?? "").split("\n");
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text textAnchor="middle" fill={fill} fontSize={12} dy={12}>
        {pctTxt}
      </text>
      <text textAnchor="middle" fill={fill} fontSize={10} opacity={0.7} dy={26}>
        {minTxt}
      </text>
    </g>
  );
}

function GraficoRetencao({ pontos }: { pontos: PontoRetencao[] }) {
  const cores = useThemeColors();
  const corTexto = rgb(cores["texto-sec"]);
  const corBorda = rgb(cores.borda);
  const dados: PontoGrafico[] = pontos.map((p) => ({ ...p, eixo: `${p.rotulo}\n${p.rotuloMinutos}` }));
  return (
    <div role="img" aria-label="Curva de retenção: inscritos que chegaram a cada degrau do webinar">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 8, right: 28, bottom: 20, left: 0 }}>
          <defs>
            <linearGradient id="retencao-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rgb(cores.azul)} stopOpacity={0.45} />
              <stop offset="100%" stopColor={rgb(cores.azul)} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={rgb(cores.borda, 0.4)} vertical={false} />
          <XAxis dataKey="eixo" stroke={corBorda} tick={<TickDegrau fill={corTexto} />} interval={0} height={44} />
          <YAxis stroke={corBorda} tick={{ fill: corTexto, fontSize: 12 }} allowDecimals={false} width={44} />
          <Tooltip content={<TooltipRetencao />} cursor={{ stroke: rgb(cores.borda, 0.6) }} />
          <Area type="monotone" dataKey="alcancaram" stroke="none" fill="url(#retencao-area)" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="alcancaram"
            name="Chegaram"
            stroke={rgb(cores["azul-claro"])}
            strokeWidth={2.5}
            dot={{ r: 4, fill: rgb(cores["azul-claro"]), stroke: rgb(cores.noite), strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Os mesmos números do gráfico em tabela (leitura exata e acessível).
function TabelaDegraus({ pontos }: { pontos: PontoRetencao[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-borda text-texto-sec">
            <th className="px-2 py-1.5 text-left font-medium">Degrau</th>
            <th className="px-2 py-1.5 text-left font-medium">Minuto</th>
            <th className="px-2 py-1.5 text-right font-medium">Chegaram</th>
            <th className="px-2 py-1.5 text-right font-medium">Dos inscritos</th>
            <th className="px-2 py-1.5 text-right font-medium">De quem assistiu</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.percentual} className="border-b border-borda/40">
              <td className="px-2 py-1.5 font-medium text-texto">{p.rotulo}</td>
              <td className="px-2 py-1.5 text-texto-sec">{p.rotuloMinutos}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-texto">{p.alcancaram}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-texto-sec">{formatarPctOuTravessao(p.dosInscritos)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-texto-sec">{formatarPctOuTravessao(p.doPrimeiro)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Lista dos medidos --------------------------------------------------------

const MAX_TAGS = 4;

function ListaMedidos({
  leads,
  pontos,
  multiEvento,
}: {
  leads: LeadRetencao[];
  pontos: PontoRetencao[];
  multiEvento: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [minimo, setMinimo] = useState<number | null>(null);
  const filtrados = useMemo(
    () => filtrarMedidos(leads, { busca, percentualMinimo: minimo }),
    [leads, busca, minimo],
  );

  return (
    <Card>
      <CardHeader
        title="Leads medidos"
        subtitle={`${filtrados.length} de ${leads.length} ${leads.length === 1 ? "inscrito" : "inscritos"} com tag de percentual · ordem do backend`}
      />
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-sec" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              aria-label="Buscar lead medido"
              className="h-9 w-full rounded-xl border border-white/20 bg-white/5 pl-9 pr-3 text-sm text-texto placeholder:opacity-60 focus:border-azul/50 focus:bg-white/10"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-texto-sec">
            Assistiu pelo menos
            <select
              value={minimo ?? ""}
              onChange={(e) => setMinimo(e.target.value === "" ? null : Number(e.target.value))}
              className="h-9 rounded-lg border border-borda bg-painel-claro px-2 text-sm text-texto"
            >
              <option value="">qualquer degrau</option>
              {pontos.map((p) => (
                <option key={p.percentual} value={p.percentual}>
                  {p.rotulo} ({p.rotuloMinutos})
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState titulo="Nenhum lead neste recorte" descricao="Ajuste a busca ou o degrau mínimo." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borda text-xs text-texto-sec">
                    <th className="px-2 py-2 text-left font-medium">Nome</th>
                    <th className="px-2 py-2 text-left font-medium">MQL</th>
                    <th className="whitespace-nowrap px-2 py-2 text-left font-medium">Assistiu até</th>
                    {multiEvento && <th className="px-2 py-2 text-left font-medium">Evento</th>}
                    <th className="px-2 py-2 text-left font-medium">Telefone</th>
                    <th className="px-2 py-2 text-left font-medium">E-mail</th>
                    <th className="min-w-[220px] px-2 py-2 text-left font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((l) => (
                    <tr key={`${l.clint_contact_id}|${l.evento_tag ?? ""}`} className="border-b border-borda/40 align-top">
                      <td className="max-w-[220px] px-2 py-2">
                        <NomeMedido lead={l} />
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1">
                          <MqlBadge lead={l} size="sm" />
                          <SeloNinja lead={l} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <AssistiuAte lead={l} />
                      </td>
                      {multiEvento && <td className="whitespace-nowrap px-2 py-2 text-xs text-texto-sec">{l.evento_tag ?? "—"}</td>}
                      <td className="whitespace-nowrap px-2 py-2">
                        <Telefone telefone={l.telefone} />
                      </td>
                      <td className="max-w-[240px] px-2 py-2">
                        {l.email ? (
                          <a href={`mailto:${l.email}`} className="block truncate text-texto hover:text-azul-claro hover:underline" title={l.email}>
                            {l.email}
                          </a>
                        ) : (
                          <span className="text-texto-sec/50">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Tags tags={l.tags} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {filtrados.map((l) => (
                <li key={`${l.clint_contact_id}|${l.evento_tag ?? ""}`} className="card-interactive rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <NomeMedido lead={l} />
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <MqlBadge lead={l} size="sm" />
                        <SeloNinja lead={l} />
                        <AssistiuAte lead={l} />
                        {multiEvento && l.evento_tag && <span className="text-[11px] text-texto-sec">{l.evento_tag}</span>}
                      </div>
                    </div>
                    <Telefone telefone={l.telefone} destaque />
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    {l.email && <p className="truncate text-texto">{l.email}</p>}
                    <Tags tags={l.tags} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Nome + link da ficha SÓ quando o backend mandou lead_id.
function NomeMedido({ lead }: { lead: LeadRetencao }) {
  if (!lead.lead_id) return <span className="font-medium text-texto">{lead.nome}</span>;
  return (
    <Link
      href={`/leads/${encodeURIComponent(lead.lead_id)}`}
      title="Abrir ficha do lead no Mapa de Calor"
      className="inline-flex max-w-full items-center gap-1 font-medium text-texto hover:text-azul-claro hover:underline"
    >
      <span className="truncate">{lead.nome}</span>
      <FileText className="h-3.5 w-3.5 shrink-0 text-azul-claro" aria-hidden />
    </Link>
  );
}

function AssistiuAte({ lead }: { lead: LeadRetencao }) {
  if (lead.percentual_maximo == null) return <span className="text-texto-sec/50">—</span>;
  const alto = lead.percentual_maximo >= 50;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", alto ? "font-medium text-verde" : "text-texto")}>
      {lead.percentual_maximo}%
      <span className="text-xs font-normal text-texto-sec">· {rotuloMinutos(lead.minutos)}</span>
    </span>
  );
}

function Telefone({ telefone, destaque = false }: { telefone: string | null | undefined; destaque?: boolean }) {
  const wa = linkWhatsApp(telefone);
  if (!telefone) return destaque ? null : <span className="text-texto-sec/50">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {!destaque && <span className="tabular-nums text-texto">{telefone}</span>}
      {wa && (
        <a
          href={wa}
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
      )}
    </span>
  );
}

function Tags({ tags }: { tags: string[] | null | undefined }) {
  const lista = tags ?? [];
  if (lista.length === 0) return <span className="text-texto-sec/50">—</span>;
  const visiveis = lista.slice(0, MAX_TAGS);
  return (
    <span className="flex flex-wrap gap-1" title={lista.join(", ")}>
      {visiveis.map((t) => (
        <span key={t} className="tag normal-case tracking-normal">
          {t}
        </span>
      ))}
      {lista.length > MAX_TAGS && <span className="text-[10px] text-texto-sec">+{lista.length - MAX_TAGS}</span>}
    </span>
  );
}
