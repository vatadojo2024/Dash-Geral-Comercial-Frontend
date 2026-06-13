import type { SdrMetrics } from "@/lib/data/sdrDashboard";

// ---------------------------------------------------------------------------
// Insights do mês (DOCUMENTACAO.md 6.4c) — função PURA com as regras EXATAS
// do Dashboard SDR original. Recebe as métricas já agregadas dos SDRs
// exibidos; a Hana entra nos insights de volume (no-show, líder, eficiência)
// e fica fora dos de meta (não tem meta).
// ---------------------------------------------------------------------------

export type Insight = {
  tipo: "risco" | "destaque" | "acao";
  texto: string;
};

function pct(fracao: number): string {
  return `${(fracao * 100).toFixed(1).replace(".", ",")}%`;
}

export function getInsights(sdrs: SdrMetrics[]): Insight[] {
  const insights: Insight[] = [];
  if (sdrs.length === 0) return insights;

  // Risco: SDR com no-show ≥ 20%
  for (const s of sdrs) {
    if (s.noShowPct >= 20) {
      insights.push({
        tipo: "risco",
        texto: `${s.sdr} está com no-show de ${s.noShowPct.toFixed(1).replace(".", ",")}% — acima do limite de 20%.`,
      });
    }
  }

  const comMeta = sdrs.filter((s) => s.gap !== null);

  // Destaque: SDR mais próximo da meta (menor gap)
  if (comMeta.length > 0) {
    const maisProximo = comMeta.reduce((melhor, s) =>
      (s.gap ?? Infinity) < (melhor.gap ?? Infinity) ? s : melhor,
    );
    insights.push({
      tipo: "destaque",
      texto:
        maisProximo.gap === 0
          ? `${maisProximo.sdr} bateu a meta atual (${maisProximo.nivelAtual}: ${maisProximo.metaAtual}).`
          : `${maisProximo.sdr} é quem está mais perto da meta — faltam ${maisProximo.gap} para ${maisProximo.nivelAtual}: ${maisProximo.metaAtual}.`,
    });
  }

  // Destaque: líder em leads qualificados (se > 0)
  const lider = sdrs.reduce((melhor, s) =>
    s.qualificados > melhor.qualificados ? s : melhor,
  );
  if (lider.qualificados > 0) {
    insights.push({
      tipo: "destaque",
      texto: `${lider.sdr} lidera em leads qualificados no mês (${lider.qualificados}).`,
    });
  }

  // Destaque: melhor eficiência de qualificação (mín. 5 realizadas)
  const elegiveis = sdrs.filter((s) => s.callsRealizadas >= 5);
  if (elegiveis.length > 0) {
    const eficiente = elegiveis.reduce((melhor, s) =>
      s.qualificados / s.callsRealizadas > melhor.qualificados / melhor.callsRealizadas
        ? s
        : melhor,
    );
    insights.push({
      tipo: "destaque",
      texto: `${eficiente.sdr} tem a melhor eficiência de qualificação: ${pct(eficiente.qualificados / eficiente.callsRealizadas)} das calls realizadas viram lead qualificado.`,
    });
  }

  // Ação: taxa de realização < 70% (mín. 5 agendadas) — reforçar confirmação
  for (const s of sdrs) {
    if (s.callsAgendadas >= 5 && s.callsRealizadas / s.callsAgendadas < 0.7) {
      insights.push({
        tipo: "acao",
        texto: `${s.sdr} realizou só ${pct(s.callsRealizadas / s.callsAgendadas)} das calls agendadas — reforçar confirmação pré-call.`,
      });
    }
  }

  // Ação: SDR a 1 ou 2 QC do próximo bônus
  for (const s of sdrs) {
    const resto = s.produtos.qc % 3;
    if (resto === 1 || resto === 2) {
      const faltam = 3 - resto;
      insights.push({
        tipo: "acao",
        texto: `${s.sdr} está a ${faltam} QC do próximo bônus de qualificado (+1 a cada 3).`,
      });
    }
  }

  // Geral: taxa de realização da equipe
  const totalAgendadas = sdrs.reduce((a, s) => a + s.callsAgendadas, 0);
  const totalRealizadas = sdrs.reduce((a, s) => a + s.callsRealizadas, 0);
  if (totalAgendadas > 0) {
    const taxa = totalRealizadas / totalAgendadas;
    if (taxa < 0.8) {
      insights.push({
        tipo: "acao",
        texto: `Taxa de realização geral em ${pct(taxa)} — abaixo dos 80%; revisar processo de confirmação.`,
      });
    } else {
      insights.push({
        tipo: "destaque",
        texto: `Operação saudável: ${pct(taxa)} das calls agendadas foram realizadas.`,
      });
    }
  }

  return insights;
}
