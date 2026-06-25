import { z } from "zod";
import {
  EtapaSchema,
  FICHA_VAZIA,
  LeadDetailSchema,
  TemperaturaSchema,
  TETOS_BLOCOS,
  type AnaliseResumo,
  type Etapa,
  type FichaLead,
  type LeadDetail,
  type LeadEvent,
  type ScoreBreakdown,
} from "@/lib/api/contracts";

// ---------------------------------------------------------------------------
// Adapter do GET /api/leads/:id REAL (mapacalor-api.infradojo.pro) → contrato
// do app (LeadDetailSchema). Mesma raiz do adapter da lista: o corpo real ≠ o
// shape do mock, então repassar cru fazia o Zod do client derrubar a tela
// ("Não foi possível carregar o lead") mesmo com 200 válido.
//
// Contrato real (campos NULL onde a API manda null — NADA disso pode quebrar):
//   { id, nome_exibicao, telefone, email, score_final, score_bruto,
//     score_momento, score_fit, score_urgencia, score_engajamento, score_timing,
//     trava_aplicada (null ok),
//     score_breakdown {
//       avisos[], blocos { fit, timing, momento, urgencia, engajamento },
//       alertas[], financeiro { ... }, teto_aplicado (null ok),
//       travas_ativas[], fonte_urgencia
//     },
//     temperatura, motivo_curto, proxima_acao, alertas[],
//     score_calculated_at, tier_final, produto_sugerido, produto_variante,
//     etapa_atual (null ok), next_call_at (null ok), link_crm (null ok),
//     analise_sdr { resumo_curto:null, sinais_positivos:null, sinais_de_risco:null },
//     analise_call (null ok),
//     timeline [ { event_type, occurred_at, etapa, call_at } ]  (pode ser vazia)
//   }
//
// Tudo o que é opcional/ausente vira default seguro; erro só em status != 2xx
// (tratado no route handler). Um campo opcional faltando é "ausente", não falha.
// ---------------------------------------------------------------------------

// Os 5 blocos reais (objeto pontos-por-bloco). Cada um é opcional/nullable: um
// bloco ausente conta como 0, não derruba o detalhe.
const ApiBlocosSchema = z
  .object({
    momento: z.number().nullish(),
    fit: z.number().nullish(),
    urgencia: z.number().nullish(),
    engajamento: z.number().nullish(),
    timing: z.number().nullish(),
  })
  .partial()
  .passthrough();

// analise_sdr / analise_call: TODOS os campos podem vir null (ou o bloco
// inteiro null). Note o nome real do campo: sinais_de_risco.
const ApiAnaliseSchema = z
  .object({
    resumo_curto: z.string().nullish(),
    sinais_positivos: z.array(z.string()).nullish(),
    sinais_de_risco: z.array(z.string()).nullish(),
    analisado_em: z.string().nullish(),
  })
  .passthrough()
  .nullish();

const ApiTimelineEventSchema = z
  .object({
    event_type: z.string().nullish(),
    occurred_at: z.string().nullish(),
    etapa: z.string().nullish(),
    call_at: z.string().nullish(),
  })
  .passthrough();

// Schema tolerante do corpo real: campos opcionais são .nullish() para que um
// null ou uma ausência nunca falhem o parse. O mapeamento abaixo aplica os
// defaults do contrato do app.
const ApiLeadDetailSchema = z
  .object({
    id: z.string(),
    nome_exibicao: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    score_final: z.number().min(0).max(100),
    score_bruto: z.number().min(0).max(100).nullish(),
    score_momento: z.number().nullish(),
    score_fit: z.number().nullish(),
    score_urgencia: z.number().nullish(),
    score_engajamento: z.number().nullish(),
    score_timing: z.number().nullish(),
    trava_aplicada: z.string().nullish(),
    // score_breakdown é um jsonb. Alinhado ao formato REAL do backend, campo a
    // campo, de forma TOLERANTE (nada aqui pode derrubar o lead):
    //   { avisos[], blocos{...}, alertas[], financeiro{...}, teto_aplicado,
    //     travas_ativas: [ { nome, teto } ], fonte_urgencia }
    // A tela só usa blocos / teto_aplicado / travas_ativas; os demais ficam
    // declarados (lenientes) só para documentar e blindar contra surpresa futura.
    score_breakdown: z
      .object({
        blocos: ApiBlocosSchema.nullish(),
        teto_aplicado: z.number().nullish(),
        // FORMATO REAL: array de OBJETO ({ nome, teto }). Já apareceu como array
        // de string em outras respostas — z.unknown() aceita os dois sem falhar;
        // mapBreakdown normaliza para nome/teto.
        travas_ativas: z.array(z.unknown()).nullish(),
        avisos: z.array(z.unknown()).nullish(),
        alertas: z.array(z.unknown()).nullish(),
        financeiro: z.record(z.unknown()).nullish(),
        fonte_urgencia: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    temperatura: TemperaturaSchema,
    motivo_curto: z.string().nullish(),
    proxima_acao: z.string().nullish(),
    alertas: z.array(z.string()).nullish(),
    score_calculated_at: z.string().nullish(),
    tier_final: z.string().nullish(),
    // Produto efetivo do lead. A API real expõe sob nomes variados
    // (produto_sugerido | produto_recomendado) e SEM variante para QC
    // (produto_*_variante = null). Lemos todos e usamos o efetivo; a variante
    // NÃO é concatenada (QC = "QC", nunca "qc - null"). labelProduto canoniza.
    produto_sugerido: z.string().nullish(),
    produto_recomendado: z.string().nullish(),
    produto_variante: z.string().nullish(),
    produto_recomendado_variante: z.string().nullish(),
    etapa_atual: z.string().nullish(),
    next_call_at: z.string().nullish(),
    link_crm: z.string().nullish(),
    // Ficha do Clint + briefing (12 campos novos). z.unknown(): aceitamos
    // QUALQUER tipo sem nunca derrubar o parse do lead; a coerção campo-a-campo
    // (textoOuNull) decide o que vira texto e o que vira null.
    renda_faixa: z.unknown(),
    patrimonio_faixa: z.unknown(),
    investimento_mensal: z.unknown(),
    profissao: z.unknown(),
    objetivo_mercado: z.unknown(),
    obstaculo: z.unknown(),
    momento_financeiro: z.unknown(),
    motivacao: z.unknown(),
    tempo_disponivel: z.unknown(),
    momento_atual: z.unknown(),
    desafio_resolver: z.unknown(),
    briefing: z.unknown(),
    // Ainda não vêm da API (backend vai capturá-los); por ora chegam ausentes.
    conducao_da_call: z.unknown(),
    guia_sdr: z.unknown(),
    // Posse: o backend passou a expor closer/sdr no detalhe. Tolerante ao nome do
    // campo (id ou nome) — a UI resolve via /api/usuarios (nome↔UUID) ou exibe
    // o valor como veio. Ausência → null ("Sem closer atribuído").
    closer_id: z.string().nullish(),
    sdr_id: z.string().nullish(),
    closer: z.string().nullish(),
    sdr: z.string().nullish(),
    sdr_pool: z.boolean().nullish(),
    last_activity_at: z.string().nullish(),
    analise_sdr: ApiAnaliseSchema,
    analise_call: ApiAnaliseSchema,
    timeline: z.array(ApiTimelineEventSchema).nullish(),
  })
  .passthrough();
type ApiLeadDetail = z.infer<typeof ApiLeadDetailSchema>;

function coagirEtapa(valor: string | null | undefined): Etapa | null {
  return valor && EtapaSchema.safeParse(valor).success ? (valor as Etapa) : null;
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

// Coerção campo-a-campo da ficha do Clint: só string não-vazia vira texto; null,
// ausência, "" ou qualquer tipo inesperado viram null (linha some na UI), sem
// nunca derrubar o lead. Trim remove brancos de borda; o miolo é preservado.
function textoOuNull(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length > 0 ? limpo : null;
}

// Escapa caracteres de CONTROLE crus (U+0000–U+001F: quebra de linha, tab, CR…)
// que aparecem DENTRO de strings JSON. É a causa clássica do "Bad control
// character in string literal": campos de texto (briefing/condução) vêm do CRM
// com <br/> e quebras de linha REAIS não-escapadas, e o JSON.parse rejeita o
// corpo inteiro → a rota devolvia 502. Só toca no que está dentro de string;
// barras invertidas e aspas já escapadas passam intactas, e a estrutura do JSON
// (chaves, vírgulas, espaços entre tokens) é preservada.
function escaparControlesCrusEmStrings(json: string): string {
  let dentroDeString = false;
  let escapando = false;
  let saida = "";
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (escapando) {
      // Caractere logo após uma "\" — já é parte de um escape válido (\", \\, \n…).
      saida += c;
      escapando = false;
      continue;
    }
    if (c === "\\") {
      saida += c;
      escapando = true;
      continue;
    }
    if (c === '"') {
      dentroDeString = !dentroDeString;
      saida += c;
      continue;
    }
    const code = json.charCodeAt(i);
    if (dentroDeString && code < 0x20) {
      saida +=
        c === "\n"
          ? "\\n"
          : c === "\r"
            ? "\\r"
            : c === "\t"
              ? "\\t"
              : "\\u" + code.toString(16).padStart(4, "0");
      continue;
    }
    saida += c;
  }
  return saida;
}

// Parse TOLERANTE do corpo da API. Tenta o JSON normal; se o corpo trouxer
// controles crus dentro de strings (texto com quebras de linha não-escapadas),
// repara e tenta de novo — assim leads com briefing/condução preenchidos abrem
// em vez de virar 502. Devolve null só se for de fato irrecuperável.
export function parseCorpoLead(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    try {
      const valor = JSON.parse(escaparControlesCrusEmStrings(texto));
      console.warn(
        "[/api/leads/:id] corpo com caracteres de controle crus dentro de strings — reparado antes do parse (texto com quebras de linha não-escapadas).",
      );
      return valor;
    } catch {
      return null;
    }
  }
}

// Monta a ficha do app a partir do corpo real, um campo de cada vez.
function mapFicha(api: ApiLeadDetail): FichaLead {
  return {
    renda_faixa: textoOuNull(api.renda_faixa),
    patrimonio_faixa: textoOuNull(api.patrimonio_faixa),
    investimento_mensal: textoOuNull(api.investimento_mensal),
    profissao: textoOuNull(api.profissao),
    objetivo_mercado: textoOuNull(api.objetivo_mercado),
    obstaculo: textoOuNull(api.obstaculo),
    momento_financeiro: textoOuNull(api.momento_financeiro),
    motivacao: textoOuNull(api.motivacao),
    tempo_disponivel: textoOuNull(api.tempo_disponivel),
    momento_atual: textoOuNull(api.momento_atual),
    desafio_resolver: textoOuNull(api.desafio_resolver),
  };
}

// link_crm é o ÚNICO campo onde o contrato do app (z.string().url()) é mais
// estrito que este adapter (z.string().nullish()): a API real manda null OU, às
// vezes, uma string que NÃO é URL ("" ou um caminho do Clint sem http). Sem
// sanear, o LeadDetailSchema rejeitaria o lead INTEIRO ("Não foi possível
// carregar o lead"). Mantém só URL válida; o resto vira null (botão some).
function urlValidaOuNull(valor: string | null | undefined): string | null {
  return valor && z.string().url().safeParse(valor).success ? valor : null;
}

// Objeto {fit, timing, ...} → array do contrato, na ordem fixa dos 5 blocos,
// com os tetos reais. Sem itens (a API não os expõe neste contrato).
function mapBreakdown(api: ApiLeadDetail): ScoreBreakdown {
  const blocos = api.score_breakdown?.blocos ?? {};
  const blocosArray = (Object.keys(TETOS_BLOCOS) as (keyof typeof TETOS_BLOCOS)[]).map(
    (bloco) => {
      const teto = TETOS_BLOCOS[bloco];
      const pontos = typeof blocos[bloco] === "number" ? (blocos[bloco] as number) : 0;
      return { bloco, pontos: clamp(pontos, teto), teto, itens: [] };
    },
  );

  // travas_ativas: formato real = [{ nome, teto }]; legado = ["nome"]. Normaliza
  // os dois para nome (string) e teto (number|null), sem nunca derrubar o lead.
  const itens = api.score_breakdown?.travas_ativas ?? [];
  const nomes = itens.map(nomeDaTrava).filter((n) => n.length > 0);
  // teto: o teto_aplicado do breakdown tem prioridade; senão, o teto da 1ª trava.
  const teto = api.score_breakdown?.teto_aplicado ?? tetoDaTrava(itens[0]);
  const temTrava = (teto !== null && teto !== undefined) || nomes.length > 0;
  const trava = temTrava
    ? {
        tipo: nomes[0] ?? api.trava_aplicada ?? "trava",
        teto: teto ?? 0,
        motivo: nomes.length
          ? `Travas ativas: ${nomes.map(humanizarTrava).join(", ")}.`
          : "Trava aplicada ao score.",
      }
    : null;

  return { blocos: blocosArray, trava };
}

// Nome da trava a partir de um item de travas_ativas (objeto {nome} ou string).
function nomeDaTrava(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const nome = (item as { nome?: unknown }).nome;
    if (typeof nome === "string") return nome.trim();
  }
  return "";
}

// Teto embutido no objeto de trava ({ teto }), quando houver — fallback do teto.
function tetoDaTrava(item: unknown): number | null {
  if (item && typeof item === "object") {
    const teto = (item as { teto?: unknown }).teto;
    if (typeof teto === "number") return teto;
  }
  return null;
}

// snake_case → "Snake case" para exibição (mesmo espírito do humanizar de labels).
function humanizarTrava(nome: string): string {
  const t = nome.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : nome;
}

// analise_sdr/call → AnaliseResumo | null. Sem resumo nem sinais = sem análise
// (null) — exatamente o caso do contrato real (todos os campos null).
function mapAnalise(
  api: ApiLeadDetail["analise_sdr"],
  analisadoEmFallback: string,
): AnaliseResumo | null {
  if (!api) return null;
  const resumo = api.resumo_curto ?? "";
  const positivos = api.sinais_positivos ?? [];
  const risco = api.sinais_de_risco ?? [];
  if (!resumo && positivos.length === 0 && risco.length === 0) return null;
  return {
    resumo_curto: resumo,
    sinais_positivos: positivos,
    sinais_risco: risco,
    analisado_em: api.analisado_em ?? analisadoEmFallback,
  };
}

const TIPOS_EVENTO = new Set<LeadEvent["tipo"]>([
  "entrada",
  "analise_sdr",
  "call_agendada",
  "call_realizada",
  "analise_call",
  "no_show",
  "mensagem",
  "mudanca_etapa",
  "score_recalculado",
]);

function mapEvento(
  ev: z.infer<typeof ApiTimelineEventSchema>,
  idx: number,
): LeadEvent {
  const tipoBruto = ev.event_type ?? "";
  const tipo: LeadEvent["tipo"] = TIPOS_EVENTO.has(tipoBruto as LeadEvent["tipo"])
    ? (tipoBruto as LeadEvent["tipo"])
    : "mudanca_etapa";
  const occurred_at = ev.occurred_at ?? ev.call_at ?? "";
  const descricao =
    DESCRICAO_EVENTO[tipo] +
    (ev.etapa ? ` — ${ev.etapa}` : "") +
    (ev.call_at && tipo === "call_agendada" ? ` (${ev.call_at})` : "");
  return { event_id: `ev_${idx}`, tipo, descricao, occurred_at };
}

const DESCRICAO_EVENTO: Record<LeadEvent["tipo"], string> = {
  entrada: "Entrada do lead",
  analise_sdr: "Análise do SDR",
  call_agendada: "Call agendada",
  call_realizada: "Call realizada",
  analise_call: "Análise da call",
  no_show: "No-show",
  mensagem: "Mensagem",
  mudanca_etapa: "Mudança de etapa",
  score_recalculado: "Score recalculado",
};

function mapApiLeadDetail(api: ApiLeadDetail): LeadDetail {
  const scoreFinal = api.score_final;
  const scoreCalc = api.score_calculated_at ?? "";
  const timeline = (api.timeline ?? []).map(mapEvento);

  return {
    lead_id: api.id,
    nome_exibicao: api.nome_exibicao,
    score_final: scoreFinal,
    score_bruto: api.score_bruto ?? scoreFinal,
    temperatura: api.temperatura,
    etapa_atual: coagirEtapa(api.etapa_atual),
    score_momento: clamp(api.score_momento ?? 0, TETOS_BLOCOS.momento),
    score_fit: clamp(api.score_fit ?? 0, TETOS_BLOCOS.fit),
    score_urgencia: clamp(api.score_urgencia ?? 0, TETOS_BLOCOS.urgencia),
    score_engajamento: clamp(api.score_engajamento ?? 0, TETOS_BLOCOS.engajamento),
    score_timing: clamp(api.score_timing ?? 0, TETOS_BLOCOS.timing),
    trava_aplicada: api.trava_aplicada ?? null,
    motivo_curto: api.motivo_curto ?? "",
    proxima_acao: api.proxima_acao ?? "",
    alertas: api.alertas ?? [],
    tier_final: api.tier_final ?? "",
    // Efetivo sob qualquer um dos nomes; variante NÃO entra (QC sem variante =
    // "QC" via labelProduto, jamais "qc - null").
    produto_sugerido: api.produto_sugerido ?? api.produto_recomendado ?? null,
    // Posse: lê o que o backend mandar (id ou nome, sob qualquer um dos campos);
    // ausência → null e a UI mostra "Sem closer/SDR atribuído".
    closer_id: api.closer_id ?? api.closer ?? null,
    sdr_id: api.sdr_id ?? api.sdr ?? null,
    sdr_pool: api.sdr_pool ?? false,
    next_call_at: api.next_call_at ?? null,
    next_call_numero: null,
    score_calculated_at: scoreCalc,
    last_activity_at: api.last_activity_at ?? null,
    telefone: api.telefone ?? "",
    email: api.email ?? "",
    link_crm: urlValidaOuNull(api.link_crm),
    briefing: textoOuNull(api.briefing),
    conducao_da_call: textoOuNull(api.conducao_da_call),
    guia_sdr: textoOuNull(api.guia_sdr),
    ficha: mapFicha(api),
    score_breakdown: mapBreakdown(api),
    resumo_analises: {
      sdr: mapAnalise(api.analise_sdr, scoreCalc),
      call: mapAnalise(api.analise_call, scoreCalc),
    },
    timeline,
  };
}

// Defaults seguros por campo NÃO-essencial do contrato. O detalhe é UM lead sem
// rede: se um campo opcional vier numa forma inesperada, caímos no default e o
// lead ainda abre — mesma filosofia da tolerância item-a-item da lista, aqui
// campo-a-campo. Os 4 essenciais (id/nome_exibicao/score_final/temperatura) não
// entram: sem eles não há lead, e já foram validados no ApiLeadDetailSchema.
function defaultsPorCampo(lead: LeadDetail): Partial<Record<keyof LeadDetail, unknown>> {
  return {
    score_bruto: lead.score_final,
    etapa_atual: null,
    score_momento: 0,
    score_fit: 0,
    score_urgencia: 0,
    score_engajamento: 0,
    score_timing: 0,
    trava_aplicada: null,
    motivo_curto: "",
    proxima_acao: "",
    alertas: [],
    tier_final: "",
    produto_sugerido: null,
    closer_id: null,
    sdr_id: null,
    sdr_pool: false,
    next_call_at: null,
    next_call_numero: null,
    score_calculated_at: "",
    last_activity_at: null,
    telefone: "",
    email: "",
    link_crm: null,
    briefing: null,
    conducao_da_call: null,
    guia_sdr: null,
    ficha: FICHA_VAZIA,
    resumo_analises: { sdr: null, call: null },
    timeline: [],
  };
}

// Tenta validar o lead mapeado; se falhar APENAS em campos não-essenciais, troca
// cada um pelo default e revalida. Só desiste (null) se sobrar erro num campo
// sem default (essencial) — aí o lead é realmente inviável.
function repararContrato(mapeado: LeadDetail): LeadDetail | null {
  const primeira = LeadDetailSchema.safeParse(mapeado);
  if (primeira.success) return primeira.data;

  const defaults = defaultsPorCampo(mapeado);
  const remendado: Record<string, unknown> = { ...mapeado };
  let remendou = false;
  for (const issue of primeira.error.issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && campo in defaults) {
      remendado[campo] = defaults[campo as keyof LeadDetail];
      remendou = true;
      console.error(
        `[/api/leads/:id] campo "${issue.path.join(".")}" fora do contrato (${issue.message}) — usando fallback, lead preservado.`,
      );
    }
  }
  if (!remendou) return null; // erro só em campo essencial → inviável

  const segunda = LeadDetailSchema.safeParse(remendado);
  return segunda.success ? segunda.data : null;
}

export type AdaptDetailResult =
  | { ok: true; lead: LeadDetail }
  | { ok: false; motivo: string };

/**
 * Converte o corpo (já parseado em JSON) do GET /api/leads/:id real para o
 * contrato do app (LeadDetailSchema). Loga no servidor o motivo exato de
 * qualquer divergência — diagnóstico sem mascarar, sem derrubar a tela por um
 * campo opcional ausente.
 */
export function adaptApiLeadDetail(corpo: unknown): AdaptDetailResult {
  const parsed = ApiLeadDetailSchema.safeParse(corpo);
  if (!parsed.success) {
    const motivo = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
      .join("; ");
    console.error("[/api/leads/:id] api 200 fora do contrato:", motivo);
    return { ok: false, motivo };
  }

  const mapeado = mapApiLeadDetail(parsed.data);
  // Cinto de segurança tolerante: valida o contrato do app e, se falhar só em
  // campos não-essenciais, repara campo-a-campo em vez de derrubar o lead.
  const lead = repararContrato(mapeado);
  if (!lead) {
    const motivo = LeadDetailSchema.safeParse(mapeado)
      .error?.issues.map((i) => `${i.path.join(".") || "(raiz)"} — ${i.message}`)
      .join("; ") ?? "campo essencial inválido";
    console.error(
      `[/api/leads/:id] (id=${parsed.data.id}) falhou no contrato do app após mapeamento (campo essencial):`,
      motivo,
    );
    return { ok: false, motivo };
  }

  return { ok: true, lead };
}
