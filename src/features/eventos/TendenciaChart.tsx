"use client";

import { useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  formatarPct,
  mediaDaMetrica,
  METRICAS,
  serieDeTendencia,
  textoDaMedia,
  type ChaveMetrica,
  type Evento,
  type ModoPresenca,
  type PontoTendencia,
} from "@/lib/eventos/comparativo";
import { rgb, useThemeColors } from "@/features/theme/useThemeColors";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DICA_APROXIMADO, DICA_EM_ANDAMENTO } from "./Pecas";

// ---------------------------------------------------------------------------
// Tendência de uma métrica, evento a evento (do mais antigo ao mais recente),
// sobre os eventos na tela. Evento sem número vira VÃO na linha
// (connectNulls={false}), nunca zero. Base insuficiente fica fora.
//
// Nas métricas que dependem da presença, exata e aproximada são duas linhas,
// com cor E forma de ponto diferentes (círculo = aproximada, losango = exata):
// a linha nunca liga um ponto exato a um aproximado, porque eles não se
// comparam. O ponto VAZADO é outra coisa (janela aberta) e só existe nas
// métricas de agendamento, que não dependem da presença.
// A linha tracejada é a média dos eventos na tela (no mesmo modo do evento
// selecionado, nas métricas de presença).
// ---------------------------------------------------------------------------

const OPCOES: ChaveMetrica[] = ["presenca", "levantaram", "agendamento", "inscritos", "assistiram", "aplicaram", "agendaram"];

type TooltipProps = { active?: boolean; payload?: { payload?: PontoTendencia }[] };
type PropsPonto = { cx?: number; cy?: number; index?: number; payload?: PontoTendencia; value?: number | null };

const NOME_MODO: Record<ModoPresenca, string> = { exato: "presença exata (medida)", aproximado: "presença aproximada (teto)" };

export function TendenciaChart({ eventos, modoReferencia }: { eventos: Evento[]; modoReferencia: ModoPresenca }) {
  const [chave, setChave] = useState<ChaveMetrica>("presenca");
  const cores = useThemeColors();
  const metrica = METRICAS[chave];
  const porModo = metrica.dependeDaPresenca;
  const serie = serieDeTendencia(eventos, chave);
  const media = mediaDaMetrica(eventos, chave, porModo ? modoReferencia : null);
  const formatar = (v: number) => (metrica.tipo === "taxa" ? formatarPct(v) : v.toLocaleString("pt-BR"));
  const corTexto = rgb(cores["texto-sec"]);
  const corBorda = rgb(cores.borda);
  const corNoite = rgb(cores.noite);
  const COR: Record<ModoPresenca | "unica", string> = {
    unica: rgb(cores["azul-claro"]),
    aproximado: rgb(cores["azul-claro"]),
    exato: rgb(cores.teal),
  };
  const temExato = serie.some((p) => p.valorExato != null);
  const temAberta = metrica.agendamento && serie.some((p) => p.janelaAberta && p.valor != null);

  function TooltipTendencia({ active, payload }: TooltipProps) {
    const p = payload?.[0]?.payload;
    if (!active || !p) return null;
    return (
      <div className="rounded-lg border border-borda bg-noite px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-semibold text-texto">{p.rotulo}</p>
        <p className="text-texto">
          {metrica.rotulo}:{" "}
          {p.valor == null ? "sem número neste evento" : `${porModo && p.modo === "aproximado" ? "≈ " : ""}${formatar(p.valor)}`}
        </p>
        {porModo && <p className="mt-1 opacity-80">{NOME_MODO[p.modo]}</p>}
        {p.janelaAberta && metrica.agendamento && <p className="mt-1 text-info">em andamento</p>}
      </div>
    );
  }

  // Ponto: círculo (aproximada ou métrica sem modo) ou losango (exata);
  // vazado = janela aberta numa métrica de agendamento.
  const ponto = (modo: ModoPresenca | "unica") =>
    function Ponto({ cx, cy, index, payload, value }: PropsPonto) {
      if (cx == null || cy == null || value == null || !payload) return <g key={`v-${modo}-${index}`} />;
      const cor = COR[modo];
      const vazado = metrica.agendamento && payload.janelaAberta;
      const preenchimento = vazado ? corNoite : cor;
      const borda = vazado ? cor : corNoite;
      if (modo === "exato") {
        return (
          <path
            key={`p-${modo}-${index}`}
            d={`M${cx},${cy - 6} L${cx + 6},${cy} L${cx},${cy + 6} L${cx - 6},${cy} Z`}
            fill={preenchimento}
            stroke={borda}
            strokeWidth={1.5}
          />
        );
      }
      return <circle key={`p-${modo}-${index}`} cx={cx} cy={cy} r={4} fill={preenchimento} stroke={borda} strokeWidth={2} />;
    };

  const linha = (modo: ModoPresenca | "unica", dataKey: keyof PontoTendencia, nome: string) => (
    <Line
      key={modo}
      type="monotone"
      dataKey={dataKey}
      name={nome}
      stroke={COR[modo]}
      strokeWidth={2}
      connectNulls={false}
      isAnimationActive={false}
      dot={ponto(modo)}
      activeDot={false}
    />
  );

  return (
    <Card>
      <CardHeader
        title="Tendência por evento"
        subtitle="Vão na linha = evento sem o dado. Eventos com base insuficiente ficam de fora. Tracejado = média dos eventos na tela."
        action={
          <label className="flex items-center gap-2 text-xs">
            <span className="opacity-70">Métrica</span>
            <select
              value={chave}
              onChange={(e) => setChave(e.target.value as ChaveMetrica)}
              className="rounded-lg border border-white/10 bg-noite px-2 py-1 text-xs text-texto"
            >
              {OPCOES.map((o) => (
                <option key={o} value={o}>
                  {METRICAS[o].rotulo}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={rgb(cores.borda, 0.4)} vertical={false} />
            <XAxis dataKey="rotulo" stroke={corBorda} tick={{ fill: corTexto, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              stroke={corBorda}
              tick={{ fill: corTexto, fontSize: 11 }}
              width={48}
              allowDecimals={metrica.tipo === "taxa"}
              tickFormatter={(v: number) => (metrica.tipo === "taxa" ? `${Math.round(v)}%` : v.toLocaleString("pt-BR"))}
              domain={metrica.tipo === "taxa" ? [0, "auto"] : ["auto", "auto"]}
            />
            <Tooltip content={<TooltipTendencia />} cursor={{ stroke: rgb(cores.borda, 0.6) }} />
            {media.valor != null && (
              <ReferenceLine
                y={media.valor}
                stroke={rgb(cores["texto-sec"], 0.6)}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            {porModo
              ? [
                  linha("aproximado", "valorAproximado", "Presença aproximada"),
                  linha("exato", "valorExato", "Presença exata"),
                ]
              : linha("unica", "valor", metrica.rotulo)}
          </LineChart>
        </ResponsiveContainer>

        {/* Legenda: forma + cor + texto (nunca só cor). */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {porModo && (
            <>
              <ItemLegenda rotulo="Presença aproximada (teto)" dica={DICA_APROXIMADO}>
                <circle cx="7" cy="7" r="4" fill={COR.aproximado} stroke={corNoite} strokeWidth="2" />
              </ItemLegenda>
              <ItemLegenda rotulo={temExato ? "Presença exata (medida)" : "Presença exata (nenhum evento na tela)"}>
                <path d="M7,1 L13,7 L7,13 L1,7 Z" fill={COR.exato} stroke={corNoite} strokeWidth="1.5" />
              </ItemLegenda>
            </>
          )}
          {temAberta && (
            <ItemLegenda rotulo="Janela aberta (em andamento)" dica={DICA_EM_ANDAMENTO}>
              <circle cx="7" cy="7" r="4" fill={corNoite} stroke={COR.unica} strokeWidth="2" />
            </ItemLegenda>
          )}
          <span className="opacity-80">
            <svg width="18" height="8" className="mr-1 inline-block align-middle" aria-hidden>
              <line x1="0" y1="4" x2="18" y2="4" stroke={rgb(cores["texto-sec"], 0.8)} strokeDasharray="4 4" strokeWidth="1.5" />
            </svg>
            {media.eventos === 0
              ? `Sem média: nenhum evento${porModo ? ` com presença ${modoReferencia === "exato" ? "exata" : "aproximada"}` : ""} com o dado na tela`
              : `Média de ${media.eventos} ${media.eventos === 1 ? "evento" : "eventos"}${
                  porModo ? ` com presença ${modoReferencia === "exato" ? "exata" : "aproximada"}` : ""
                }: ${textoDaMedia(chave, media.valor)}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemLegenda({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 opacity-80" title={dica}>
      <svg width="14" height="14" aria-hidden>
        {children}
      </svg>
      {rotulo}
    </span>
  );
}
