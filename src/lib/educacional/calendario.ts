import { TIPOS_EVENTO_CALENDARIO, type EventoCalendario, type TipoEventoCalendario } from "./contrato";

// ---------------------------------------------------------------------------
// Calendário do Educacional (Entrega 2, M3): datas da grade, agrupamento por
// dia e por hora, e o estado na URL. As funções de data são CÓPIA das do
// calendário de primeiras calls (lib/agendamentos), de propósito: o módulo não
// importa código do comercial, então mudar um não mexe no outro.
// Datas são "AAAA-MM-DD" (dia em Brasília); a semana vai de domingo a sábado.
// ---------------------------------------------------------------------------

export type VisaoCalendario = "semana" | "mes";

function utc(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}
function deUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function somarDias(dia: string, n: number): string {
  return deUtc(utc(dia) + n * 86_400_000);
}

export function diferencaEmDias(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

// Mesmo dia do mês seguinte/anterior (limitado ao último dia do mês de destino).
export function somarMeses(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return deUtc(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ultimo)));
}

export function diasDaSemana(dia: string): string[] {
  const domingo = somarDias(dia, -new Date(utc(dia)).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
}

// Semanas inteiras (dom→sáb) que cobrem o mês do dia.
export function gradeDoMes(dia: string): string[][] {
  const [a, m] = dia.split("-").map(Number);
  const inicio = diasDaSemana(deUtc(Date.UTC(a, m - 1, 1)))[0];
  const fim = diasDaSemana(deUtc(Date.UTC(a, m, 0)))[6];
  const semanas: string[][] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 7)) semanas.push(diasDaSemana(d));
  return semanas;
}

// Período que o calendário pede à API (inicio/fim inclusivos).
export function periodoVisivel(visao: VisaoCalendario, ancora: string): { inicio: string; fim: string } {
  if (visao === "semana") {
    const s = diasDaSemana(ancora);
    return { inicio: s[0], fim: s[6] };
  }
  const g = gradeDoMes(ancora);
  return { inicio: g[0][0], fim: g[g.length - 1][6] };
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;

export const diaDaSemanaCurto = (dia: string) => DIAS_CURTOS[new Date(utc(dia)).getUTCDay()];

export function diaMes(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

export function tituloDoMes(dia: string): string {
  const [a, m] = dia.split("-").map(Number);
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

export function tituloDaSemana(dia: string): string {
  const s = diasDaSemana(dia);
  return `${diaMes(s[0])} a ${diaMes(s[6])}`;
}

// "Hoje", "Amanhã", "Ontem" ou "seg, 29/09".
export function rotuloDoDia(dia: string, hoje: string): string {
  const delta = diferencaEmDias(hoje, dia);
  if (delta === 0) return "Hoje";
  if (delta === 1) return "Amanhã";
  if (delta === -1) return "Ontem";
  return `${diaDaSemanaCurto(dia)}, ${diaMes(dia)}`;
}

// ---------------------------------------------------------------------------
// Itens: por dia, sem hora primeiro (o dia todo) e depois pela hora; na semana,
// os com hora vão para a linha da hora deles.
// ---------------------------------------------------------------------------

// Hora cheia do item (19 para "19:30"); null = sem hora.
export function horaDe(e: Pick<EventoCalendario, "hora">): number | null {
  const m = /^(\d{1,2}):/.exec(e.hora ?? "");
  const h = m ? Number(m[1]) : NaN;
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

export function porDia(itens: readonly EventoCalendario[]): Map<string, EventoCalendario[]> {
  const mapa = new Map<string, EventoCalendario[]>();
  for (const e of itens) {
    const dia = e.data.slice(0, 10);
    mapa.set(dia, [...(mapa.get(dia) ?? []), e]);
  }
  for (const [dia, lista] of mapa) {
    mapa.set(
      dia,
      [...lista].sort((x, y) => (x.hora ? 1 : 0) - (y.hora ? 1 : 0) || (x.hora ?? "").localeCompare(y.hora ?? "")),
    );
  }
  return mapa;
}

// Linhas de hora da semana: 7h às 21h, ampliadas se algum item cair fora.
export function horasDaSemana(itens: readonly EventoCalendario[]): number[] {
  const horas = itens.map(horaDe).filter((h): h is number => h != null);
  const de = Math.min(7, ...horas);
  const ate = Math.max(21, ...horas);
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

// ---------------------------------------------------------------------------
// Estado na URL (?visao=&dia=&responsavel=&programa=&tipo=): o "Voltar" do
// Raio-X devolve o calendário como estava.
// ---------------------------------------------------------------------------

export type EstadoCalendario = {
  visao: VisaoCalendario;
  dia: string | null; // âncora; null = hoje
  responsavel: string | null;
  programa: string | null;
  tipo: TipoEventoCalendario | null;
};

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function lerEstadoCalendario(sp: Pick<URLSearchParams, "get">): EstadoCalendario {
  const tipo = sp.get("tipo");
  const dia = sp.get("dia");
  return {
    visao: sp.get("visao") === "semana" ? "semana" : "mes",
    dia: dia && RE_DIA.test(dia) ? dia : null,
    responsavel: sp.get("responsavel") || null,
    programa: sp.get("programa") || null,
    tipo: tipo && (TIPOS_EVENTO_CALENDARIO as readonly string[]).includes(tipo) ? (tipo as TipoEventoCalendario) : null,
  };
}

export function queryDoCalendario(e: EstadoCalendario): string {
  const q = new URLSearchParams();
  if (e.visao === "semana") q.set("visao", "semana");
  if (e.dia) q.set("dia", e.dia);
  if (e.responsavel) q.set("responsavel", e.responsavel);
  if (e.programa) q.set("programa", e.programa);
  if (e.tipo) q.set("tipo", e.tipo);
  return q.toString();
}
