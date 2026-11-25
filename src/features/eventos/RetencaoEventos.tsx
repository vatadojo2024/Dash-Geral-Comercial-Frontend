"use client";

import { Timer } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { curvasDeRetencao, DEGRAUS_RETENCAO, formatarPct, TRAVESSAO, type Evento } from "@/lib/eventos/comparativo";
import { rgb, useThemeColors, type CorToken } from "@/features/theme/useThemeColors";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

// ---------------------------------------------------------------------------
// Retenção ao vivo: uma curva por evento EXATO, cada degrau em % dos presentes.
// Com uma curva só, fica legível sozinha (sem legenda; o título diz qual é) e a
// tabela embaixo dá os números. Cresce a cada evento novo: mostra as 8 mais
// recentes, e a cor segue o evento (posição na série inteira), não o ranking.
// ---------------------------------------------------------------------------

const MAX_CURVAS = 8;
const CORES: CorToken[] = ["azul-claro", "teal", "laranja", "violeta", "amarelo", "frio", "verde", "rosa"];
const rotuloDegrau = (s: number) => `${s / 60} min`;

type TooltipProps = { active?: boolean; label?: string | number; payload?: { name?: string; value?: number | null; color?: string }[] };

function TooltipRetencao({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-borda bg-noite px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-texto">Aos {label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-texto">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: {p.value == null ? TRAVESSAO : formatarPct(p.value)}
        </p>
      ))}
    </div>
  );
}

export function RetencaoEventos({ eventos }: { eventos: Evento[] }) {
  const cores = useThemeColors();
  const todas = curvasDeRetencao(eventos); // do mais antigo ao mais recente
  const inicio = Math.max(0, todas.length - MAX_CURVAS);
  const curvas = todas.slice(inicio).map((c, i) => ({ ...c, cor: rgb(cores[CORES[(inicio + i) % CORES.length]]) }));
  const corTexto = rgb(cores["texto-sec"]);
  const corBorda = rgb(cores.borda);

  if (curvas.length === 0) {
    return (
      <Card>
        <CardHeader title="Retenção ao vivo" />
        <EmptyState
          icon={Timer}
          titulo="Nenhum evento com presença exata no período"
          descricao="A retenção passa a ser medida a partir do próximo evento capturado ao vivo."
        />
      </Card>
    );
  }

  const dados = DEGRAUS_RETENCAO.map((s, i) => ({
    degrau: rotuloDegrau(s),
    ...Object.fromEntries(curvas.map((c) => [c.rotulo, c.pontos[i]])),
  }));
  const uma = curvas.length === 1;

  return (
    <Card>
      <CardHeader
        title={uma ? `Retenção ao vivo · ${curvas[0].rotulo}` : "Retenção ao vivo"}
        subtitle={`% dos presentes ao vivo que ainda estavam no ar em cada momento. Só eventos com presença exata${
          todas.length > MAX_CURVAS ? `; mostrando os ${MAX_CURVAS} mais recentes de ${todas.length}` : ""
        }.`}
      />
      <CardContent className="space-y-4 pt-0">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dados} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={rgb(cores.borda, 0.4)} vertical={false} />
            <XAxis dataKey="degrau" stroke={corBorda} tick={{ fill: corTexto, fontSize: 11 }} interval={0} />
            <YAxis
              stroke={corBorda}
              tick={{ fill: corTexto, fontSize: 11 }}
              width={44}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<TooltipRetencao />} cursor={{ stroke: rgb(cores.borda, 0.6) }} />
            {!uma && <Legend wrapperStyle={{ fontSize: 11, color: corTexto }} />}
            {curvas.map((c, i) => (
              <Line
                key={c.data}
                type="monotone"
                dataKey={c.rotulo}
                name={c.rotulo}
                stroke={c.cor}
                strokeWidth={i === curvas.length - 1 ? 2.5 : 1.5}
                dot={{ r: 3.5, fill: c.cor, stroke: rgb(cores.noite), strokeWidth: 1.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Retenção por degrau, em % dos presentes ao vivo</caption>
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-medium opacity-70">Evento</th>
                {DEGRAUS_RETENCAO.map((s) => (
                  <th key={s} className="px-2 py-1 text-right font-medium opacity-70">
                    {rotuloDegrau(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {curvas
                .slice()
                .reverse()
                .map((c) => (
                  <tr key={c.data} className="border-t border-white/5">
                    <td className="px-2 py-1 text-left text-texto">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: c.cor }} aria-hidden />
                      {c.rotulo}
                    </td>
                    {c.pontos.map((p, i) => (
                      <td key={i} className="px-2 py-1 text-right tabular-nums text-texto">
                        {p == null ? <span title="não medido neste evento">{TRAVESSAO}</span> : formatarPct(p)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
