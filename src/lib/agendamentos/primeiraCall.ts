import { z } from "zod";
import type { SessionUser } from "@/lib/api/contracts";
import { labelProduto } from "@/lib/formatters/labels";

// ---------------------------------------------------------------------------
// Módulo "Agendamentos — Primeira Call" (spec
// specs/primeiro-agendamento/spec_frontend_agendamentos_primeira_call.md).
// Fonte: GET /api/agendamentos/primeira-call[?de&ate&closer_id] — a API já
// filtra por closer (cada closer vê só as próprias; admin vê todas). Tela
// SOMENTE LEITURA. Este arquivo é o CONTRATO DO APP (o que os componentes
// consomem, já adaptado pelo route handler) mais as regras puras de ordenação,
// status e calendário.
//
// Datas: `data_br` (DD/MM/AAAA) e `hora_br` (HH:MM) vêm prontas do backend no
// fuso de Brasília — a tela exibe ESSAS, não reconverte `call_at`. `dia`
// (AAAA-MM-DD) é derivado de `data_br` pelo adapter e serve de chave do
// calendário. `call_at` (ISO com offset) só entra em comparação com "agora".
// ---------------------------------------------------------------------------

export const AgendamentoPrimeiraCallSchema = z.object({
  evento_id: z.string(),
  deal_id: z.string().nullable(),
  lead_id: z.string().nullable(),
  closer_id: z.string().nullable(),
  closer_nome: z.string().nullable(),
  lead_nome: z.string().nullable(),
  lead_email: z.string().nullable(),
  lead_telefone: z.string().nullable(),
  call_at: z.string(),
  data_br: z.string(),
  hora_br: z.string(),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  urgencia: z.string().nullable(),
  sdr_nome: z.string().nullable(),
  link_call: z.string().nullable(),
  patrimonio: z.string().nullable(),
  renda: z.string().nullable(),
  produto_indicado: z.string().nullable(),
  produto_variante: z.string().nullable(),
  link_crm: z.string().nullable(),
  etapa_atual: z.string().nullable(),
  agendado_em: z.string().nullable(),
});
export type AgendamentoPrimeiraCall = z.infer<typeof AgendamentoPrimeiraCallSchema>;

export const AgendamentosPrimeiraCallResponseSchema = z.object({
  de: z.string().nullable(),
  ate: z.string().nullable(),
  total: z.number().int(),
  // Itens fora do contrato que o adapter descartou (e logou no servidor).
  descartados: z.number().int().default(0),
  agendamentos: z.array(AgendamentoPrimeiraCallSchema),
  gerado_em: z.string(),
  // "mock_local" quando SÓ esta tela está em dados de demonstração
  // (AGENDAMENTOS_MODE=mock com o resto do app na API real) — a tela avisa.
  fonte: z.string().nullish(),
});
export type AgendamentosPrimeiraCallResponse = z.infer<typeof AgendamentosPrimeiraCallResponseSchema>;

// ---------------------------------------------------------------------------
// Datas (sempre em AAAA-MM-DD, aritmética em UTC: sem fuso no meio).
// ---------------------------------------------------------------------------

export const FUSO_BR = "America/Sao_Paulo";

// "22/09/2026" → "2026-09-22"; null se o formato não for DD/MM/AAAA válido.
export function diaDeDataBr(dataBr: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((dataBr ?? "").trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const t = Date.UTC(Number(a), Number(mes) - 1, Number(d));
  const conf = new Date(t);
  if (conf.getUTCDate() !== Number(d) || conf.getUTCMonth() !== Number(mes) - 1) return null;
  return `${a}-${mes}-${d}`;
}

// Dia de hoje em Brasília (a fila e o destaque "Hoje" são do fuso do time).
export function hojeBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR }).format(agora);
}

// Dia e hora de um instante em Brasília (fallback do adapter quando a API não
// manda data_br/hora_br).
export function partesBR(iso: string): { dia: string; dataBr: string; horaBr: string } | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR }).format(d);
  const horaBr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const [a, m, dd] = dia.split("-");
  return { dia, dataBr: `${dd}/${m}/${a}`, horaBr };
}

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

// Semana de domingo a sábado que contém o dia.
export function diasDaSemana(dia: string): string[] {
  const domingo = somarDias(dia, -new Date(utc(dia)).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
}

// Grade do mês: semanas inteiras (dom→sáb), com os dias vizinhos que completam
// a primeira e a última linha.
export function gradeDoMes(dia: string): string[][] {
  const [a, m] = dia.split("-").map(Number);
  const primeiro = deUtc(Date.UTC(a, m - 1, 1));
  const ultimo = deUtc(Date.UTC(a, m, 0));
  const inicio = diasDaSemana(primeiro)[0];
  const fim = diasDaSemana(ultimo)[6];
  const semanas: string[][] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 7)) semanas.push(diasDaSemana(d));
  return semanas;
}

export type VisaoCalendario = "semana" | "mes";

// Janela que o calendário pede à API (de/ate inclusivos).
export function intervaloVisivel(visao: VisaoCalendario, ancora: string): { de: string; ate: string } {
  if (visao === "semana") {
    const s = diasDaSemana(ancora);
    return { de: s[0], ate: s[6] };
  }
  const g = gradeDoMes(ancora);
  return { de: g[0][0], ate: g[g.length - 1][6] };
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export function diaDaSemanaCurto(dia: string): string {
  return DIAS_CURTOS[new Date(utc(dia)).getUTCDay()];
}

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

// Rótulo do dia na fila: "Hoje", "Amanhã", "Ontem" ou "seg, 29/09".
export function rotuloDoDia(dia: string, hoje: string): string {
  const delta = diferencaEmDias(hoje, dia);
  if (delta === 0) return "Hoje";
  if (delta === 1) return "Amanhã";
  if (delta === -1) return "Ontem";
  return `${diaDaSemanaCurto(dia)}, ${diaMes(dia)}`;
}

// ---------------------------------------------------------------------------
// Ordenação, status e agrupamento.
// ---------------------------------------------------------------------------

// Próxima call primeiro. A API já entrega assim; reaplicar é idempotente e
// garante a ordem no mock e depois do filtro por closer. Empate mantém a ordem.
export function ordenarPorCall<T extends Pick<AgendamentoPrimeiraCall, "call_at">>(itens: readonly T[]): T[] {
  return itens
    .map((item, i) => ({ item, i, t: Date.parse(item.call_at) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.item);
}

// "hoje" = ainda vai acontecer hoje; "passada" = o horário já passou (a call
// de hoje cedo continua na fila até sair da janela); "futura" = outro dia.
export type StatusCall = "hoje" | "passada" | "futura";

export function statusDaCall(
  ag: Pick<AgendamentoPrimeiraCall, "call_at" | "dia">,
  agora: Date = new Date(),
): StatusCall {
  const t = Date.parse(ag.call_at);
  if (!Number.isNaN(t) && t < agora.getTime()) return "passada";
  return ag.dia === hojeBR(agora) ? "hoje" : "futura";
}

// Texto do status — SEMPRE acompanha a cor (acessibilidade).
export function rotuloDoStatus(
  ag: Pick<AgendamentoPrimeiraCall, "call_at" | "dia">,
  agora: Date = new Date(),
): string {
  const status = statusDaCall(ag, agora);
  const hoje = hojeBR(agora);
  if (status === "passada") return ag.dia === hoje ? "Hoje · já passou" : "Já passou";
  if (status === "hoje") return "Hoje";
  const delta = diferencaEmDias(hoje, ag.dia);
  return delta === 1 ? "Amanhã" : `Em ${delta} dias`;
}

// A FILA só mostra o que ainda vai acontecer (pedido Vata 29/09): call cujo
// horário já passou sai da lista. O calendário continua mostrando o histórico.
export function soQueAindaVaoAcontecer<T extends Pick<AgendamentoPrimeiraCall, "call_at">>(
  itens: readonly T[],
  agora: Date = new Date(),
): T[] {
  return itens.filter((a) => {
    const t = Date.parse(a.call_at);
    return Number.isNaN(t) || t >= agora.getTime();
  });
}

export function proximaCall<T extends Pick<AgendamentoPrimeiraCall, "call_at">>(
  itens: readonly T[],
  agora: Date = new Date(),
): T | null {
  return ordenarPorCall(itens).find((a) => Date.parse(a.call_at) >= agora.getTime()) ?? null;
}

export type GrupoDoDia<T> = { dia: string; itens: T[] };

// Agrupa por dia preservando a ordem recebida.
export function agruparPorDia<T extends Pick<AgendamentoPrimeiraCall, "dia">>(itens: readonly T[]): GrupoDoDia<T>[] {
  const grupos: GrupoDoDia<T>[] = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === item.dia) ultimo.itens.push(item);
    else grupos.push({ dia: item.dia, itens: [item] });
  }
  return grupos;
}

export function porDia<T extends Pick<AgendamentoPrimeiraCall, "dia">>(itens: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) mapa.set(item.dia, [...(mapa.get(item.dia) ?? []), item]);
  return mapa;
}

// ---------------------------------------------------------------------------
// Escopo por papel — a MESMA regra do backend (pedido Vata 29/09): cada closer
// vê só a própria agenda; admin e SDR veem a agenda de todos os closers. Usada
// nos route handlers e, de forma defensiva, na tela: mesmo que a fonte mude,
// nada de outro closer vaza para um closer.
// ---------------------------------------------------------------------------

export function veAgendaDeTodos(role: SessionUser["role"]): boolean {
  return role === "admin" || role === "sdr";
}

export function agendamentoNoEscopo(
  ag: Pick<AgendamentoPrimeiraCall, "closer_id">,
  user: Pick<SessionUser, "id" | "role">,
): boolean {
  if (veAgendaDeTodos(user.role)) return true;
  if (user.role === "closer") return ag.closer_id === user.id;
  return false;
}

export function filtrarPorEscopo<T extends Pick<AgendamentoPrimeiraCall, "closer_id">>(
  itens: readonly T[],
  user: Pick<SessionUser, "id" | "role">,
): T[] {
  return itens.filter((a) => agendamentoNoEscopo(a, user));
}

export type OpcaoCloser = { chave: string; nome: string; total: number };
export const SEM_CLOSER = "sem";

export function chaveDoCloser(ag: Pick<AgendamentoPrimeiraCall, "closer_id" | "closer_nome">): string {
  return ag.closer_id ?? (ag.closer_nome ? `nome:${ag.closer_nome}` : SEM_CLOSER);
}

// Closers presentes na resposta (filtro do admin), por nome; "Sem closer" no fim.
export function closersPresentes(
  itens: readonly Pick<AgendamentoPrimeiraCall, "closer_id" | "closer_nome">[],
): OpcaoCloser[] {
  const mapa = new Map<string, OpcaoCloser>();
  for (const a of itens) {
    const chave = chaveDoCloser(a);
    const atual = mapa.get(chave) ?? { chave, nome: a.closer_nome ?? "Sem closer", total: 0 };
    atual.total += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => {
    if (a.chave === SEM_CLOSER) return 1;
    if (b.chave === SEM_CLOSER) return -1;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}

// ---------------------------------------------------------------------------
// Exibição.
// ---------------------------------------------------------------------------

// "prime" + "semestral" → "Prime Semestral". null quando não há produto.
export function produtoDoAgendamento(
  ag: Pick<AgendamentoPrimeiraCall, "produto_indicado" | "produto_variante">,
): string | null {
  const produto = labelProduto(ag.produto_indicado);
  if (!produto) return null;
  const variante = (ag.produto_variante ?? "").trim();
  if (!variante) return produto;
  return `${produto} ${variante.charAt(0).toUpperCase()}${variante.slice(1).toLowerCase()}`;
}

// A API manda o link da sala como URL completa OU só o código do Meet
// ("vmf-tfvx-tbo"). URL → como veio; código do Meet → https://meet.google.com/…;
// qualquer outra coisa → null (a tela mostra o texto cru, sem inventar link).
export function urlDaSala(link: string | null | undefined): string | null {
  const v = (link ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^meet\.google\.com\//i.test(v)) return `https://${v}`;
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(v)) return `https://meet.google.com/${v.toLowerCase()}`;
  return null;
}

// "9/10 - 52 anos, mora nos EUA..." → { nota: 9, texto: "52 anos, mora nos EUA..." }.
// Sem nota no começo, devolve o texto inteiro com nota null.
export function partesDaUrgencia(urgencia: string | null | undefined): { nota: number | null; texto: string } | null {
  const v = (urgencia ?? "").trim();
  if (!v) return null;
  const m = /^(\d{1,2})\s*\/\s*10\s*[-–—:·]?\s*/.exec(v);
  if (!m) return { nota: null, texto: v };
  const nota = Number(m[1]);
  if (nota > 10) return { nota: null, texto: v };
  return { nota, texto: v.slice(m[0].length).trim() };
}

export function nomeDoLead(ag: Pick<AgendamentoPrimeiraCall, "lead_nome" | "lead_email">): string {
  return ag.lead_nome?.trim() || ag.lead_email?.trim() || "Lead sem nome";
}
