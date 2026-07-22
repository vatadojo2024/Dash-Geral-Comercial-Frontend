// ---------------------------------------------------------------------------
// Ciclo de evento (Produtividade SDR → aba "Calls por Ciclo").
//
// O evento acontece TODA TERÇA e o ciclo REINICIA na terça: um ciclo vai da
// terça 00:00 à segunda seguinte 23:59. Âncora conhecida (uma terça real):
// 21/07/2026. O cálculo é pura aritmética de datas — qualquer terça alinha; a
// âncora serve de referência/documentação e é coberta por teste.
//
// Datas são tratadas pela sua PORÇÃO CIVIL (YYYY-MM-DD), como no resto do app
// (ex.: weekOfMonth em lib/sdr/lideranca.ts). Assim não há deriva de fuso entre
// "YYYY-MM-DD" (âncora/testes) e um ISO completo com hora/offset (next_call_at):
// só o dia importa para o recorte de ciclo.
// ---------------------------------------------------------------------------

export type Ciclo = { inicio: string; fim: string }; // ambos "YYYY-MM-DD"

const DIA_MS = 86_400_000;
const TERCA = 2; // getUTCDay(): dom=0, seg=1, ter=2, ... sáb=6

// "YYYY-MM-DD" | ISO completo → Date na meia-noite UTC do dia civil.
function diaUTC(dataISO: string): Date {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// A terça ≤ data (início do ciclo que contém a data).
export function inicioDoCiclo(dataISO: string): string {
  const dia = diaUTC(dataISO);
  const desde = (dia.getUTCDay() - TERCA + 7) % 7; // dias desde a última terça
  return iso(new Date(dia.getTime() - desde * DIA_MS));
}

// Ciclo (terça → segunda) que contém a data.
export function cicloDe(dataISO: string): Ciclo {
  const inicio = inicioDoCiclo(dataISO);
  const fim = iso(new Date(diaUTC(inicio).getTime() + 6 * DIA_MS));
  return { inicio, fim };
}

// data ∈ ciclo? Comparação lexicográfica de "YYYY-MM-DD" (cronológica).
export function dentroDoCiclo(dataISO: string, ciclo: Ciclo): boolean {
  const dia = dataISO.slice(0, 10);
  return dia >= ciclo.inicio && dia <= ciclo.fim;
}

// Os n ciclos mais recentes, do ATUAL (primeiro) para trás.
export function ultimosCiclos(hojeISO: string, n = 12): Ciclo[] {
  const out: Ciclo[] = [];
  let inicio = diaUTC(inicioDoCiclo(hojeISO));
  for (let i = 0; i < n; i++) {
    out.push(cicloDe(iso(inicio)));
    inicio = new Date(inicio.getTime() - 7 * DIA_MS);
  }
  return out;
}

// "21/07 a 27/07" (dd/MM).
export function rotuloCiclo(ciclo: Ciclo): string {
  return `${ddmm(ciclo.inicio)} a ${ddmm(ciclo.fim)}`;
}

function ddmm(dataISO: string): string {
  const [, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}
