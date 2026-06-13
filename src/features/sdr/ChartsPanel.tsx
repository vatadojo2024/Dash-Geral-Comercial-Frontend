"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SdrMetrics } from "@/lib/data/sdrDashboard";
import { rgb, useThemeColors } from "@/features/theme/useThemeColors";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

// 6.4b — os 3 gráficos do Dashboard SDR original (Recharts), seguindo o tema:
//   1. Funil de Conversão por SDR (Agendadas azul · Realizadas teal · Qualificadas laranja)
//   2. Taxa de No-Show por SDR (rosa, eixo em %)
//   3. Atingimento de Meta e Gap (Meta azul · Qualificadas verde · Gap laranja em área)

// Props do conteúdo customizado de tooltip (tipadas localmente — a tipagem
// genérica do recharts 3 não expõe payload/label no TooltipProps)
type TooltipConteudoProps = {
  active?: boolean;
  label?: string | number;
  payload?: {
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
    color?: string;
    payload?: unknown;
  }[];
};

function TooltipDark({ active, payload, label }: TooltipConteudoProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-borda bg-noite px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-texto">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

type LinhaNoShow = { sdr: string; pct: number; count: number };

function TooltipNoShow({ active, payload, label }: TooltipConteudoProps) {
  const cores = useThemeColors();
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload as LinhaNoShow;
  return (
    <div className="rounded-lg border border-borda bg-noite px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-texto">{label}</p>
      <p style={{ color: rgb(cores.rosa) }}>
        No-show: {linha.count} ({linha.pct.toFixed(1).replace(".", ",")}%)
      </p>
    </div>
  );
}

export function ChartsPanel({ sdrs }: { sdrs: SdrMetrics[] }) {
  const cores = useThemeColors();
  const EIXO = { fill: rgb(cores["texto-sec"]), fontSize: 12 };
  const corBorda = rgb(cores.borda);
  const cursorGrid = { fill: rgb(cores.borda, 0.2) };
  const funil = sdrs.map((s) => ({
    sdr: s.sdr,
    Agendadas: s.callsAgendadas,
    Realizadas: s.callsRealizadas,
    Qualificadas: s.qualificados,
  }));

  const noShow: LinhaNoShow[] = sdrs.map((s) => ({
    sdr: s.sdr,
    pct: s.noShowPct,
    count: s.noShowCount,
  }));

  // Hana fica fora do gráfico de meta/gap (não tem meta)
  const metaGap = sdrs
    .filter((s) => s.metas !== null)
    .map((s) => ({
      sdr: s.sdr,
      Meta: s.metaAtual ?? 0,
      Qualificadas: s.qualificados,
      Gap: s.gap ?? 0,
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Funil de conversão por SDR"
          subtitle="Agendadas → realizadas → qualificadas no mês"
        />
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funil}>
              <CartesianGrid stroke={corBorda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sdr" stroke={corBorda} tick={EIXO} />
              <YAxis stroke={corBorda} tick={EIXO} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} cursor={cursorGrid} />
              <Legend wrapperStyle={{ color: rgb(cores["texto-sec"]), fontSize: 12 }} />
              <Bar dataKey="Agendadas" fill={rgb(cores.azul)} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizadas" fill={rgb(cores.teal)} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Qualificadas" fill={rgb(cores.laranja)} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Taxa de no-show por SDR"
          subtitle="Percentual sobre as calls agendadas"
        />
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={noShow}>
              <CartesianGrid stroke={corBorda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sdr" stroke={corBorda} tick={EIXO} />
              <YAxis
                stroke={corBorda}
                tick={EIXO}
                unit="%"
                allowDecimals={false}
              />
              <Tooltip content={<TooltipNoShow />} cursor={cursorGrid} />
              <Bar dataKey="pct" name="No-show %" fill={rgb(cores.rosa)} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Atingimento de meta e gap"
          subtitle="Meta atual vs. qualificadas, com o gap em área (Hana fora — sem meta)"
        />
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={metaGap}>
              <CartesianGrid stroke={corBorda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sdr" stroke={corBorda} tick={EIXO} />
              <YAxis stroke={corBorda} tick={EIXO} allowDecimals={false} />
              <Tooltip content={<TooltipDark />} cursor={cursorGrid} />
              <Legend wrapperStyle={{ color: rgb(cores["texto-sec"]), fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="Gap"
                fill={rgb(cores.laranja, 0.27)}
                stroke={rgb(cores.laranja)}
              />
              <Bar dataKey="Meta" fill={rgb(cores.azul)} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Qualificadas" fill={rgb(cores.verde)} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
