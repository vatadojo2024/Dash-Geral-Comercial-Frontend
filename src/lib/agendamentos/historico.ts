import { z } from "zod";
import { somarDias } from "./primeiraCall";

// ---------------------------------------------------------------------------
// Histórico geral de agendamentos (pedido Vata 30/09) — o substituto do canal
// único do Discord: TODOS os agendamentos, de todos os closers, na ordem em que
// foram MARCADOS (o mais recente no topo). Só admin (área
// `historico_agendamentos`, vinda de GET /api/me → areas).
//
// Fonte: GET /api/agendamentos/historico[?de&ate&antes_de&limite&numero_call&incluir_sem_data].
// Este arquivo é o CONTRATO DO APP (já adaptado pelo route handler, item a
// item) mais as regras puras da tela.
//
// Datas: `agendado_em_br` e `call_br` vêm PRONTOS em Brasília — a tela exibe
// esses, nunca reconverte o ISO (converter de novo soma 3h duas vezes). A ORDEM
// é a da API (mais recente primeiro); a tela não reordena.
// ---------------------------------------------------------------------------

export const ItemHistoricoSchema = z.object({
  // Chave estável do item na tela (o agendamento não tem id próprio na API).
  id: z.string(),
  agendado_em: z.string(),
  agendado_data: z.string(), // DD/MM/AAAA, Brasília
  agendado_hora: z.string(), // HH:MM, Brasília
  dia_agendamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lead_id: z.string().nullable(),
  lead_nome: z.string().nullable(),
  lead_email: z.string().nullable(),
  lead_telefone: z.string().nullable(),
  closer_id: z.string().nullable(),
  closer_nome: z.string().nullable(),
  sdr_nome: z.string().nullable(),
  numero_call: z.number().int().min(1).max(5).nullable(),
  etapa: z.string().nullable(),
  // Sem data = card movido na Clint sem a data da call preenchida. Os três
  // campos são nulos juntos; a tela mostra "sem data", nunca esconde.
  call_at: z.string().nullable(),
  call_data: z.string().nullable(),
  call_hora: z.string().nullable(),
  dia_call: z.string().nullable(),
  urgencia: z.string().nullable(),
  link_call: z.string().nullable(),
  produto_indicado: z.string().nullable(),
  link_crm: z.string().nullable(),
});
export type ItemHistorico = z.infer<typeof ItemHistoricoSchema>;

export const HistoricoResponseSchema = z.object({
  de: z.string().nullable(),
  ate: z.string().nullable(),
  // Tamanho da janela depois dos filtros, A PARTIR do cursor pedido — o total
  // da janela inteira é o da primeira página.
  total: z.number().int(),
  retornados: z.number().int(),
  // Passar em `antes_de` para a página seguinte; null = acabou.
  proximo_cursor: z.string().nullable(),
  descartados: z.number().int().default(0),
  agendamentos: z.array(ItemHistoricoSchema),
  gerado_em: z.string(),
  // "mock_local" quando só esta tela está em dados de demonstração.
  fonte: z.string().nullish(),
});
export type HistoricoResponse = z.infer<typeof HistoricoResponseSchema>;

// A aba mostra SÓ agendamentos de PRIMEIRA CALL (pedido Vata 02/10): 2ª call
// em diante nunca aparece. A rota pede `numero_call=1` à API e, por garantia,
// descarta aqui o que vier com outro número (ou sem número).
export const NUMERO_DA_PRIMEIRA_CALL = 1;

export function soPrimeiraCall(resposta: HistoricoResponse): HistoricoResponse {
  const agendamentos = resposta.agendamentos.filter((a) => a.numero_call === NUMERO_DA_PRIMEIRA_CALL);
  return { ...resposta, agendamentos, retornados: agendamentos.length };
}

export type FiltrosHistorico = {
  de?: string | null;
  ate?: string | null;
  antesDe?: string | null;
  limite?: number;
  numeroCall?: number | null;
  incluirSemData?: boolean;
};

// Querystring da rota — mesma nos dois lados (tela e route handler).
export function queryDoHistorico(f: FiltrosHistorico): string {
  const qs = new URLSearchParams();
  if (f.de) qs.set("de", f.de);
  if (f.ate) qs.set("ate", f.ate);
  if (f.antesDe) qs.set("antes_de", f.antesDe);
  if (f.limite) qs.set("limite", String(f.limite));
  if (f.numeroCall) qs.set("numero_call", String(f.numeroCall));
  if (f.incluirSemData === false) qs.set("incluir_sem_data", "false");
  return qs.toString();
}

// ---------------------------------------------------------------------------
// Período: janela sobre o MOMENTO DO AGENDAMENTO (não a data da call).
// ---------------------------------------------------------------------------

export type PeriodoHistorico = "tudo" | "hoje" | "7d" | "30d";

export const OPCOES_PERIODO: { valor: PeriodoHistorico; label: string }[] = [
  { valor: "tudo", label: "Tudo" },
  { valor: "hoje", label: "Hoje" },
  { valor: "7d", label: "7 dias" },
  { valor: "30d", label: "30 dias" },
];

// Início do período em Brasília (00:00 de `hoje` − n dias), como ISO com offset.
// Sem fim: a janela vai até agora, então o que cair depois ainda entra.
export function inicioDoPeriodo(periodo: PeriodoHistorico, hoje: string): string | null {
  const dias = { tudo: null, hoje: 0, "7d": 6, "30d": 29 }[periodo];
  if (dias == null) return null;
  return `${somarDias(hoje, -dias)}T00:00:00-03:00`;
}

// ---------------------------------------------------------------------------
// Regras da lista
// ---------------------------------------------------------------------------

export function rotuloDaCall(n: number | null): string | null {
  if (n == null) return null;
  return n >= 5 ? "5ª+ call" : `${n}ª call`;
}

// Páginas do "carregar mais" numa lista só, na ordem da API, sem repetir.
export function juntarPaginas(paginas: readonly { agendamentos: readonly ItemHistorico[] }[]): ItemHistorico[] {
  const vistos = new Set<string>();
  const itens: ItemHistorico[] = [];
  for (const p of paginas) {
    for (const a of p.agendamentos) {
      if (vistos.has(a.id)) continue;
      vistos.add(a.id);
      itens.push(a);
    }
  }
  return itens;
}

export type GrupoDoHistorico = { dia: string; itens: ItemHistorico[] };

// Agrupa pelo DIA DO AGENDAMENTO, preservando a ordem recebida (mais recente
// primeiro) — tanto dos dias quanto dentro de cada dia.
export function agruparPorDiaDoAgendamento(itens: readonly ItemHistorico[]): GrupoDoHistorico[] {
  const grupos: GrupoDoHistorico[] = [];
  const porDia = new Map<string, GrupoDoHistorico>();
  for (const a of itens) {
    let g = porDia.get(a.dia_agendamento);
    if (!g) {
      g = { dia: a.dia_agendamento, itens: [] };
      porDia.set(a.dia_agendamento, g);
      grupos.push(g);
    }
    g.itens.push(a);
  }
  return grupos;
}

// Remarcação: o mesmo lead, mesma call (1ª, 2ª…), marcado de novo para OUTRA
// data. A API devolve os dois agendamentos (foi marcado duas vezes — correto);
// a tela só sinaliza o mais recente como "remarcou". Olha só o que já está
// carregado.
export function idsRemarcados(itens: readonly ItemHistorico[]): Set<string> {
  const ids = new Set<string>();
  itens.forEach((a, i) => {
    if (!a.lead_id) return;
    const anterior = itens
      .slice(i + 1)
      .some((b) => b.lead_id === a.lead_id && b.numero_call === a.numero_call && b.call_at !== a.call_at);
    if (anterior) ids.add(a.id);
  });
  return ids;
}

// Quantos agendamentos caíram DEPOIS do mais recente da tela (o aviso de
// "novos agendamentos"). Compara instantes, não texto.
export function contarNovos(itens: readonly Pick<ItemHistorico, "agendado_em">[], desde: string | null): number {
  if (!desde) return 0;
  const limite = Date.parse(desde);
  if (Number.isNaN(limite)) return 0;
  return itens.filter((a) => Date.parse(a.agendado_em) > limite).length;
}
