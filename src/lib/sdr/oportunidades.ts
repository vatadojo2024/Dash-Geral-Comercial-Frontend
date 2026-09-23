import { z } from "zod";
import { diasEntre } from "./ciclo";

// ---------------------------------------------------------------------------
// Aba "Levantou a Mão" (Produtividade SDR). Fonte: GET /api/eventos/oportunidades
// (backend mapacalor-api, contrato V4) — quem aplicou no webinar e NÃO tem call
// agendada. `leads` traz SÓ os pendentes, uma linha por (contato, evento), já
// ordenados pelo backend. Filtros (MQL, dono, origem), busca, ordenação e CSV
// acontecem AQUI, no cliente — sem ida extra ao servidor. Funções puras.
//
// O front lê: matriz, funis, resgate, por_dono, avisos, leads e, de `totais`,
// só inscritos / desqualificados / pendentes.
// ---------------------------------------------------------------------------

// Contrato TOLERANTE (um campo nulo/extra/ausente nunca derruba a aba).
export const LeadPendenteSchema = z
  .object({
    clint_contact_id: z.string(),
    nome: z.string(),
    telefone: z.string().nullish(),
    email: z.string().nullish(),
    tier: z.string().nullish(),
    tier_rank: z.number().int().nullish(),
    // Evento a que ESTA linha se refere: com dois eventos no intervalo o mesmo
    // contato aparece em duas linhas.
    evento_tag: z.string().nullish(),
    tags: z.array(z.string()).nullish(),
    created_at: z.string().nullish(),
    // Id do lead no Mapa de Calor quando o backend casou o contato (e-mail ou
    // telefone) com a tabela `leads`. null = sem ficha.
    lead_id: z.string().nullish(),
    // Negócio escolhido na Clint e o card dele. url_clint vem PRONTA do backend;
    // o front nunca monta a URL. null = contato sem negócio.
    clint_deal_id: z.string().nullish(),
    url_clint: z.string().nullish(),
    etapa: z.string().nullish(),
    // Dono do negócio (SDR responsável). null = "Sem dono".
    dono: z
      .object({ id: z.string().nullish(), nome: z.string(), email: z.string().nullish() })
      .nullish(),
    // "ao_vivo" (levantou a mão) | "replay" (aplicou só pelo replay). String
    // livre de propósito: valor inesperado não derruba a aba, só fica sem badge.
    origem: z.string().nullish(),
    assistiu_ao_vivo: z.boolean().nullish(),
    acessou_replay: z.boolean().nullish(),
    assistiu_replay: z.boolean().nullish(),
    convidado_resgate: z.boolean().nullish(),
    // Marcação "Possível Ninja" na Clint. Vem true MESMO quando o tier mostra uma
    // tag da escala MQL (que tem precedência na classificação) — daí o selo.
    possivel_ninja: z.boolean().nullish(),
    // Desde quando o negócio está na etapa atual. Só o endpoint de "Não
    // abordados" manda (é o campo que prioriza aquele recorte); aqui é opcional
    // para o MESMO tipo de lead servir às duas fontes.
    stage_desde: z.string().nullish(),
    // Só o endpoint de "Presentes que não aplicaram" manda: quanto assistiu ao
    // vivo e se já tem call agendada (sinalizar, nunca filtrar).
    percentual_assistido: z.number().nullish(),
    minutos_assistidos: z.number().nullish(),
    ja_agendou: z.boolean().nullish(),
  })
  .passthrough();
export type LeadPendente = z.infer<typeof LeadPendenteSchema>;

// ---------------------------------------------------------------------------
// Recortes da aba (sub-abas com rota própria). Os quatro primeiros têm funil,
// filtros e tabela próprios sobre a MESMA resposta de /oportunidades (nada de
// chamada extra ao trocar). "Presentes que não aplicaram" e "Não abordados"
// são OUTRAS populações, com endpoint próprio (lib/sdr/presentesSemAplicar.ts
// e lib/sdr/naoAbordados.ts) — por isso o tipo separado abaixo.
// ---------------------------------------------------------------------------

export type RecorteLevantou = "geral" | "ao_vivo" | "replay" | "presentes" | "resgate" | "nao_abordados";
// Recortes que derivam da resposta de /oportunidades.
export type RecorteOportunidades = Exclude<RecorteLevantou, "nao_abordados" | "presentes">;

// Base de cada recorte, ANTES dos chips: os filtros da tela aplicam em série
// sobre esta lista.
export function leadsDoRecorte(leads: LeadPendente[], recorte: RecorteOportunidades): LeadPendente[] {
  switch (recorte) {
    case "ao_vivo":
      return leads.filter((l) => origemDoLead(l)?.chave === "ao_vivo");
    case "replay":
      return leads.filter((l) => origemDoLead(l)?.chave === "replay");
    case "resgate":
      return leads.filter((l) => l.convidado_resgate === true);
    default:
      return leads;
  }
}

// Chave estável da LINHA da tabela: (contato, evento).
export function chaveDaLinha(l: Pick<LeadPendente, "clint_contact_id" | "evento_tag">): string {
  return `${l.clint_contact_id}|${l.evento_tag ?? ""}`;
}

// Pendentes por dono, já ordenado pelo backend: pendentes desc, "Sem dono" último.
export const DonoAgregadoSchema = z.object({
  dono_id: z.string().nullish(),
  dono_nome: z.string(),
  pendentes: z.number().int(),
  alto_valor: z.number().int(),
});
export type DonoAgregado = z.infer<typeof DonoAgregadoSchema>;

// Linha da matriz ao vivo / replay / total. `acessaram` é null no ao vivo (não é
// degrau desse recorte) e `taxa_agendamento` é null quando aplicaram = 0.
export const LinhaMatrizSchema = z.object({
  acessaram: z.number().int().nullish(),
  assistiram: z.number().int().nullish(),
  aplicaram: z.number().int().nullish(),
  agendaram: z.number().int().nullish(),
  taxa_agendamento: z.number().nullish(),
  pendentes: z.number().int().nullish(),
  alto_valor_pendente: z.number().int().nullish(),
});
export type LinhaMatriz = z.infer<typeof LinhaMatrizSchema>;

export const MatrizSchema = z.object({
  ao_vivo: LinhaMatrizSchema,
  replay: LinhaMatrizSchema,
  total: LinhaMatrizSchema,
});
export type Matriz = z.infer<typeof MatrizSchema>;

// Funis prontos do backend: degraus { nome, valor }. As TAXAS são do front.
export const DegrauSchema = z.object({ nome: z.string(), valor: z.number().int() });
export type Degrau = z.infer<typeof DegrauSchema>;
export const FunilSchema = z.object({ degraus: z.array(DegrauSchema) });
export const FunisSchema = z.object({ ao_vivo: FunilSchema, replay: FunilSchema });
export type Funis = z.infer<typeof FunisSchema>;

// Campanha de resgate (denominador próprio = convidados). Só valores; taxas no front.
export const ResgateSchema = z.object({
  convidados: z.number().int(),
  assistiram: z.number().int(),
  aplicaram: z.number().int(),
  agendaram: z.number().int(),
  pendentes: z.number().int(),
});
export type Resgate = z.infer<typeof ResgateSchema>;

// Bloco `resumo` (backend 23/09): os cinco números do topo da aba, cada um com
// o filtro explícito — os três primeiros SEM filtro (base bruta, antes de tirar
// QC e desqualificados), os dois últimos só MQL+ ou acima. `fora_dos_qualificados`
// explica a conta: inscritos − qc − desqualificados = totais.inscritos.
// `qualificados_sem_aplicar` é, por garantia do backend, o tamanho da lista de
// /presentes-sem-aplicar.
export const ResumoEventoSchema = z
  .object({
    inscritos: z.number().int().nullish(),
    presentes_ao_vivo: z.number().int().nullish(),
    aplicaram: z.number().int().nullish(),
    qualificados_aplicaram: z.number().int().nullish(),
    qualificados_sem_aplicar: z.number().int().nullish(),
    fora_dos_qualificados: z
      .object({ qc: z.number().int().nullish(), desqualificados: z.number().int().nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();
export type ResumoEvento = z.infer<typeof ResumoEventoSchema>;

// A conta do resumo fecha com a base de pendentes? null quando falta algum
// número (não dá para conferir) — a tela então não afirma nada.
export function resumoFecha(
  resumo: ResumoEvento,
  totais: { inscritos?: number | null | undefined },
): boolean | null {
  const bruto = resumo.inscritos;
  const qc = resumo.fora_dos_qualificados?.qc;
  const desq = resumo.fora_dos_qualificados?.desqualificados;
  const base = totais.inscritos;
  if (bruto == null || qc == null || desq == null || base == null) return null;
  return bruto - qc - desq === base;
}

export const OportunidadesResponseSchema = z.object({
  de: z.string(),
  ate: z.string(),
  eventos: z.array(z.string()),
  totais: z
    .object({
      // Pares (contato, evento) com a tag WG do ciclo, já sem os desqualificados.
      inscritos: z.number().int().nullish(),
      // Removidos da base por estarem em "Desqualificado" (número de conferência).
      desqualificados: z.number().int().nullish(),
      // Excluídos por serem da trilha QC (outro produto/público) — saem antes de
      // qualquer conta, como os desqualificados. Só conferência.
      qc: z.number().int().nullish(),
      // = matriz.total.pendentes e o tamanho de `leads`.
      pendentes: z.number().int(),
    })
    .passthrough(),
  matriz: MatrizSchema.nullish(),
  funis: FunisSchema.nullish(),
  resgate: ResgateSchema.nullish(),
  resumo: ResumoEventoSchema.nullish(),
  por_dono: z.array(DonoAgregadoSchema).nullish(),
  // Travas de sanidade do backend (não bloqueiam a resposta).
  avisos: z.array(z.string()).nullish(),
  leads: z.array(LeadPendenteSchema),
  gerado_em: z.string(),
  cache: z.enum(["hit", "miss"]).nullish(),
});
export type OportunidadesResponse = z.infer<typeof OportunidadesResponseSchema>;
export type TotaisOportunidades = OportunidadesResponse["totais"];

// ---------------------------------------------------------------------------
// Funis. Os degraus vêm prontos; a passagem entre degraus consecutivos é
// calculada aqui. Três saídas: porcentagem, travessão (anterior = 0) e
// "verificar base" (degrau maior que o anterior — nunca vira porcentagem).
// ---------------------------------------------------------------------------

export type PassagemFunil = { tipo: "pct"; texto: string } | { tipo: "verificar" };

export type BlocoFunil = {
  chave: string;
  rotulo: string;
  valor: number;
  // Passagem a partir do degrau de referência; null = primeiro degrau.
  passagem: PassagemFunil | null;
  // Rótulo da base da passagem quando ela NÃO é o degrau imediatamente anterior.
  baseDaPassagem?: string;
};

export type RecorteFunil = "ao_vivo" | "replay" | "resgate";

const ROTULO_DEGRAU: Record<string, string> = {
  inscritos: "Inscritos",
  convidados: "Convidados",
  acessaram: "Acessaram",
  assistiram: "Assistiram",
  agendaram: "Agendaram",
  pendentes: "Pendentes",
  nao_abordados: "Não abordados",
};

// `nome` do degrau → rótulo. "aplicaram" muda por recorte: no ao vivo (e no
// resgate) é "Levantaram a mão"; no replay é "Aplicaram". Nome desconhecido vira
// texto legível, nunca a chave crua com underscore.
export function rotuloDoDegrau(nome: string, recorte: RecorteFunil): string {
  if (nome === "aplicaram") return recorte === "replay" ? "Aplicaram" : "Levantaram a mão";
  const conhecido = ROTULO_DEGRAU[nome];
  if (conhecido) return conhecido;
  const limpo = nome.replace(/_/g, " ").trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : "—";
}

// degrau / referência. Referência zero → travessão; degrau maior → "verificar".
export function passagemCalculada(valor: number, referencia: number): PassagemFunil {
  if (referencia === 0) return { tipo: "pct", texto: TRAVESSAO };
  if (valor > referencia) return { tipo: "verificar" };
  return { tipo: "pct", texto: formatarPct(pct(valor, referencia)) };
}

// Blocos de um funil. Regra geral: degrau[i] / degrau[i-1]. EXCEÇÃO: "pendentes"
// não é passagem de "agendaram" — os dois são partes complementares de quem
// aplicou (pendentes = aplicaram − agendaram). Medir contra "agendaram" daria
// mais de 100% sempre que menos da metade agendou (falso "verificar base"), então
// "pendentes" é medido contra "aplicaram", com a base dita no rótulo.
export function blocosDoFunil(degraus: readonly Degrau[], recorte: RecorteFunil): BlocoFunil[] {
  const aplicaram = degraus.find((d) => d.nome === "aplicaram");
  return degraus.map((d, i) => {
    const bloco = { chave: d.nome, rotulo: rotuloDoDegrau(d.nome, recorte), valor: d.valor };
    if (i === 0) return { ...bloco, passagem: null };
    if (d.nome === "pendentes" && aplicaram) {
      return {
        ...bloco,
        passagem: passagemCalculada(d.valor, aplicaram.valor),
        baseDaPassagem: recorte === "replay" ? "de quem aplicou" : "de quem levantou a mão",
      };
    }
    return { ...bloco, passagem: passagemCalculada(d.valor, degraus[i - 1].valor) };
  });
}

// Funil sem nenhum dado (todos os degraus zero) — ex.: ciclo sem replay. O
// bloco é renderizado com zeros + nota, nunca escondido.
export function funilZerado(degraus: readonly Degrau[]): boolean {
  return degraus.length === 0 || degraus.every((d) => d.valor === 0);
}

// Campanha de resgate → mesmos blocos, base própria (convidados).
export function blocosDoResgate(r: Resgate): BlocoFunil[] {
  return blocosDoFunil(
    [
      { nome: "convidados", valor: r.convidados },
      { nome: "assistiram", valor: r.assistiram },
      { nome: "aplicaram", valor: r.aplicaram },
      { nome: "agendaram", valor: r.agendaram },
      { nome: "pendentes", valor: r.pendentes },
    ],
    "resgate",
  );
}

// Avisos de sanidade do backend → linguagem direta. A chave crua NUNCA vai para
// a tela: código desconhecido cai numa frase genérica.
const TEXTO_AVISO: Record<string, string> = {
  assistiram_acima_da_base:
    "Assistiram supera a base de inscritos e convidados — verificar tags.",
  aplicaram_acima_de_assistiram:
    "Aplicaram supera assistiram — inconsistência de cálculo, avise o time técnico.",
  taxa_acima_de_100: "Há taxa acima de 100% — verificar base.",
  // Retenção da audiência
  sem_medicao_alta: "Medição indisponível para este evento (mais de 90% dos inscritos sem tag de percentual).",
  atribuicao_ambigua: "Intervalo com vários eventos: as tags de percentual não têm data, então os números podem se repetir.",
};
const TEXTO_AVISO_GENERICO =
  "O backend sinalizou uma inconsistência na base deste período. Avise o time técnico.";

export function traduzirAvisos(avisos: readonly string[] | null | undefined): string[] {
  const textos = (avisos ?? []).map((a) => TEXTO_AVISO[a] ?? TEXTO_AVISO_GENERICO);
  return [...new Set(textos)];
}

// Códigos de erro dos endpoints de evento (oportunidades e não abordados) →
// tratamento da UI. `leads_indisponivel` é só do endpoint de não abordados
// (tabela `leads` fora do ar no cruzamento com o Mapa).
export type CodigoErroOportunidades =
  | "clint_auth"
  | "clint_indisponivel"
  | "agendamentos_indisponivel"
  | "leads_indisponivel"
  | "supabase_indisponivel"
  | "intervalo_muito_grande"
  | "parametros_invalidos"
  | "desconhecido";

// ---------------------------------------------------------------------------
// Classificação do lead na Clint. Duas trilhas DISTINTAS:
//   - escala MQL, hierárquica: UMQL+ (6) > UMQL (5) > HMQL (4) > SMQL (3) >
//     MQL+ (2) > MQL (1);
//   - Ninja ("Possível Ninja"), que NÃO é degrau dessa escala — é outra trilha
//     e por isso vem com rank 0, não abaixo de MQL. Quem tem Ninja E uma tag MQL
//     é classificado pela MQL (precedência) e ganha o selo `possivel_ninja`.
// A chave "sem" é o lead sem NENHUMA tag de classificação (tier null).
// A trilha QC não chega a esta lista: o backend a exclui e só informa `totais.qc`.
// Cores por token do tema (globals.css) — NENHUMA cor solta aqui. A escala MQL
// usa a rampa de temperatura; Ninja usa `verde`, fora da rampa, porque não tem
// posição nela.
// ---------------------------------------------------------------------------

export type TierChave = "UMQL+" | "UMQL" | "HMQL" | "SMQL" | "MQL+" | "MQL" | "Ninja" | "sem";

export type TierConfig = {
  chave: TierChave;
  label: string;
  // Posição na escala MQL: 6..1. Ninja e "sem" têm 0 — Ninja de propósito.
  rank: number;
  // Pertence à escala MQL? Só esses resolvem um lead PELO RANK quando o nome do
  // tier não casa; Ninja e "sem" ficam de fora para não capturar o rank 0.
  mql: boolean;
  // Classes Tailwind (tokens da paleta): badge/chip, texto e barra.
  badge: string;
  chipAtivo: string;
  text: string;
  barra: string;
};

export const TIERS: readonly TierConfig[] = [
  {
    chave: "UMQL+",
    label: "UMQL+",
    rank: 6,
    mql: true,
    badge: "bg-muito-quente/15 text-muito-quente border border-muito-quente/30",
    chipAtivo: "bg-muito-quente/20 text-muito-quente border-muito-quente/60",
    text: "text-muito-quente",
    barra: "bg-muito-quente",
  },
  {
    chave: "UMQL",
    label: "UMQL",
    rank: 5,
    mql: true,
    badge: "bg-quente/15 text-quente border border-quente/30",
    chipAtivo: "bg-quente/20 text-quente border-quente/60",
    text: "text-quente",
    barra: "bg-quente",
  },
  {
    chave: "HMQL",
    label: "HMQL",
    rank: 4,
    mql: true,
    badge: "bg-morno-alto/15 text-morno-alto border border-morno-alto/30",
    chipAtivo: "bg-morno-alto/20 text-morno-alto border-morno-alto/60",
    text: "text-morno-alto",
    barra: "bg-morno-alto",
  },
  {
    chave: "SMQL",
    label: "SMQL",
    rank: 3,
    mql: true,
    badge: "bg-morno-baixo/15 text-morno-baixo border border-morno-baixo/30",
    chipAtivo: "bg-morno-baixo/20 text-morno-baixo border-morno-baixo/60",
    text: "text-morno-baixo",
    barra: "bg-morno-baixo",
  },
  {
    chave: "MQL+",
    label: "MQL+",
    rank: 2,
    mql: true,
    badge: "bg-frio/15 text-frio border border-frio/30",
    chipAtivo: "bg-frio/20 text-frio border-frio/60",
    text: "text-frio",
    barra: "bg-frio",
  },
  {
    chave: "MQL",
    label: "MQL",
    rank: 1,
    mql: true,
    badge: "bg-congelado/15 text-congelado border border-congelado/30",
    chipAtivo: "bg-congelado/20 text-congelado border-congelado/60",
    text: "text-congelado",
    barra: "bg-congelado",
  },
  {
    // Outra trilha (tag "Possível Ninja" na Clint). Rótulo exibido: só "Ninja".
    chave: "Ninja",
    label: "Ninja",
    rank: 0,
    mql: false,
    badge: "bg-verde/15 text-verde border border-verde/30",
    chipAtivo: "bg-verde/20 text-verde border-verde/60",
    text: "text-verde",
    barra: "bg-verde",
  },
  {
    chave: "sem",
    label: "Sem classificação",
    rank: 0,
    mql: false,
    badge: "border border-dashed border-borda bg-transparent text-texto-sec/80",
    chipAtivo: "bg-painel-claro text-texto border-texto-sec/60",
    text: "text-texto-sec",
    barra: "bg-borda",
  },
] as const;

// Atalho "Só alto valor" = UMQL+, UMQL e HMQL. Ninja NÃO entra: é outra trilha.
export const TIERS_ALTO_VALOR: readonly TierChave[] = ["UMQL+", "UMQL", "HMQL"];
export const RANK_ALTO_VALOR_MIN = 4;

const TIER_POR_CHAVE = new Map<string, TierConfig>(
  TIERS.map((t) => [t.chave.toUpperCase(), t]),
);
// Só a escala MQL: assim o rank 0 de um lead sem classificação nunca cai em Ninja.
const TIER_POR_RANK = new Map<number, TierConfig>(
  TIERS.filter((t) => t.mql).map((t) => [t.rank, t]),
);
const TIER_SEM = TIERS[TIERS.length - 1];

// Classificação do lead: pelo nome canônico (inclui "Ninja"); se não casar, pelo
// rank DA ESCALA MQL (backend que só manda rank); senão, sem classificação.
export function tierDoLead(lead: Pick<LeadPendente, "tier" | "tier_rank">): TierConfig {
  const porNome = lead.tier ? TIER_POR_CHAVE.get(lead.tier.trim().toUpperCase()) : undefined;
  if (porNome) return porNome;
  return TIER_POR_RANK.get(lead.tier_rank ?? 0) ?? TIER_SEM;
}

// Alto valor = UMQL+, UMQL, HMQL. Ninja tem rank 0, então nunca entra aqui.
export function ehAltoValor(lead: Pick<LeadPendente, "tier" | "tier_rank">): boolean {
  return tierDoLead(lead).rank >= RANK_ALTO_VALOR_MIN;
}

// Selo "Ninja" ao lado do tier: quem tem a marcação mas foi classificado pela
// escala MQL (precedência). Se o próprio tier já é Ninja, o badge basta.
export function mostraSeloNinja(
  lead: Pick<LeadPendente, "tier" | "tier_rank" | "possivel_ninja">,
): boolean {
  return lead.possivel_ninja === true && tierDoLead(lead).chave !== "Ninja";
}

// Contagem por classificação (todas as chaves presentes, zero incluso).
export function contarPorTier(leads: LeadPendente[]): Record<TierChave, number> {
  const out = Object.fromEntries(TIERS.map((t) => [t.chave, 0])) as Record<TierChave, number>;
  for (const l of leads) out[tierDoLead(l).chave] += 1;
  return out;
}

// Distribuição para o gráfico de barras: TODAS as classificações, em POSIÇÃO
// FIXA (a ordem de TIERS: UMQL+ … MQL, Ninja, Sem classificação), inclusive as
// zeradas. Não ordena por quantidade — a posição de cada barra nunca muda.
export function distribuicaoPorTier(
  leads: LeadPendente[],
): { tier: TierConfig; total: number }[] {
  const contagem = contarPorTier(leads);
  return TIERS.map((tier) => ({ tier, total: contagem[tier.chave] }));
}

export function altoValorPendente(leads: LeadPendente[]): number {
  return leads.filter(ehAltoValor).length;
}

// ---------------------------------------------------------------------------
// Dono (SDR responsável pelo negócio na Clint) — V2.
// ---------------------------------------------------------------------------

export const SEM_DONO_CHAVE = "sem";
export const SEM_DONO_LABEL = "Sem dono";

// Chave estável do dono para filtro/agrupamento: id do dono; sem id, o nome;
// sem dono, "sem".
export function chaveDono(dono: LeadPendente["dono"]): string {
  if (!dono) return SEM_DONO_CHAVE;
  return dono.id ?? `nome:${dono.nome}`;
}

export function nomeDono(dono: LeadPendente["dono"]): string {
  return dono?.nome?.trim() || SEM_DONO_LABEL;
}

export type OpcaoDono = { chave: string; nome: string; pendentes: number; altoValor: number };

// Chips de dono. Fonte preferida: totais.por_dono (contagens do backend). Sem
// ele (backend V1), deriva dos próprios leads. Sempre pendentes desc, "Sem dono"
// por último.
export function opcoesDeDono(
  leads: LeadPendente[],
  porDono?: DonoAgregado[] | null,
): OpcaoDono[] {
  const opcoes: OpcaoDono[] = [];
  if (porDono && porDono.length > 0) {
    for (const d of porDono) {
      opcoes.push({
        chave: d.dono_id ?? (d.dono_nome === SEM_DONO_LABEL ? SEM_DONO_CHAVE : `nome:${d.dono_nome}`),
        nome: d.dono_id || d.dono_nome !== SEM_DONO_LABEL ? d.dono_nome : SEM_DONO_LABEL,
        pendentes: d.pendentes,
        altoValor: d.alto_valor,
      });
    }
  } else {
    const mapa = new Map<string, OpcaoDono>();
    for (const l of leads) {
      const chave = chaveDono(l.dono);
      const atual = mapa.get(chave) ?? { chave, nome: nomeDono(l.dono), pendentes: 0, altoValor: 0 };
      atual.pendentes += 1;
      if (ehAltoValor(l)) atual.altoValor += 1;
      mapa.set(chave, atual);
    }
    opcoes.push(...mapa.values());
  }
  return opcoes.sort(compararDonos);
}

function compararDonos(a: { chave: string; pendentes: number; nome: string }, b: { chave: string; pendentes: number; nome: string }): number {
  if (a.chave === SEM_DONO_CHAVE) return 1;
  if (b.chave === SEM_DONO_CHAVE) return -1;
  return b.pendentes - a.pendentes || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
}

export type GrupoDono = { chave: string; nome: string; leads: LeadPendente[]; altoValor: number };

// Visão "Por SDR": uma seção por dono, pendentes desc, "Sem dono" por último.
// Dentro de cada seção mantém a ordem recebida (a do backend: tier desc).
export function agruparPorDono(leads: LeadPendente[]): GrupoDono[] {
  const mapa = new Map<string, GrupoDono>();
  for (const l of leads) {
    const chave = chaveDono(l.dono);
    const g = mapa.get(chave) ?? { chave, nome: nomeDono(l.dono), leads: [], altoValor: 0 };
    g.leads.push(l);
    if (ehAltoValor(l)) g.altoValor += 1;
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) =>
    compararDonos(
      { chave: a.chave, pendentes: a.leads.length, nome: a.nome },
      { chave: b.chave, pendentes: b.leads.length, nome: b.nome },
    ),
  );
}

// ---------------------------------------------------------------------------
// Origem: "ao_vivo" (levantou a mão) | "replay" (aplicou só pelo replay). Não
// existe terceiro valor. Cores por token do tema.
// ---------------------------------------------------------------------------

export type OrigemChave = "ao_vivo" | "replay";

export type OrigemConfig = {
  chave: OrigemChave;
  label: string;
  ordem: number;
  badge: string;
  chipAtivo: string;
};

export const ORIGENS: readonly OrigemConfig[] = [
  {
    chave: "ao_vivo",
    label: "Ao vivo",
    ordem: 0,
    badge: "bg-teal/15 text-teal border border-teal/30",
    chipAtivo: "bg-teal/20 text-teal border-teal/60",
  },
  {
    chave: "replay",
    label: "Replay",
    ordem: 1,
    badge: "bg-violeta/15 text-violeta border border-violeta/30",
    chipAtivo: "bg-violeta/20 text-violeta border-violeta/60",
  },
] as const;

const ORIGEM_POR_CHAVE = new Map<string, OrigemConfig>(ORIGENS.map((o) => [o.chave, o]));

// null = backend antigo ou valor inesperado: a linha fica sem badge de origem.
export function origemDoLead(lead: Pick<LeadPendente, "origem">): OrigemConfig | null {
  return ORIGEM_POR_CHAVE.get(lead.origem ?? "") ?? null;
}

// Marcadores da célula de origem (tooltip). "Resgate" é independente; os outros
// dois dizem que o lead esteve TAMBÉM no recorte que não é a origem dele.
export type MarcadorOrigem = "resgate" | "viu_replay" | "esteve_ao_vivo";

export const TEXTO_MARCADOR: Record<MarcadorOrigem, string> = {
  resgate: "Resgate",
  viu_replay: "Viu o replay também",
  esteve_ao_vivo: "Esteve ao vivo também",
};

export function marcadoresDoLead(
  lead: Pick<LeadPendente, "origem" | "convidado_resgate" | "assistiu_replay" | "assistiu_ao_vivo">,
): MarcadorOrigem[] {
  const origem = origemDoLead(lead)?.chave;
  const out: MarcadorOrigem[] = [];
  if (lead.convidado_resgate) out.push("resgate");
  if (origem === "ao_vivo" && lead.assistiu_replay) out.push("viu_replay");
  if (origem === "replay" && lead.assistiu_ao_vivo) out.push("esteve_ao_vivo");
  return out;
}

export type ContagemOrigem = Record<OrigemChave, number> & { resgate: number };

export function contarPorOrigem(leads: LeadPendente[]): ContagemOrigem {
  const out: ContagemOrigem = { ao_vivo: 0, replay: 0, resgate: 0 };
  for (const l of leads) {
    const origem = origemDoLead(l);
    if (origem) out[origem.chave] += 1;
    if (l.convidado_resgate) out.resgate += 1;
  }
  return out;
}

// Travessão: só onde o dado NÃO SE APLICA por definição ("Acessaram" no ao vivo,
// a % quando taxa_agendamento é null). null/undefined → travessão, nunca zero.
export const TRAVESSAO = "—";
export function celulaMatriz(v: number | null | undefined): string {
  return v == null ? TRAVESSAO : String(v);
}

// taxa_agendamento vem PRONTA do backend como fração (0.393). null → travessão.
export function formatarTaxa(taxa: number | null | undefined): string {
  return taxa == null ? TRAVESSAO : formatarPct(taxa * 100);
}

// ---------------------------------------------------------------------------
// Filtros e ordenação (client-side).
// ---------------------------------------------------------------------------

function normalizar(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export type FiltroPendentes = {
  // Nenhum tier selecionado = todos.
  tiers: readonly TierChave[];
  // Chaves de dono (chaveDono). Nenhum selecionado = todos. Aplica em série com tiers.
  donos?: readonly string[];
  // Origens. Nenhuma selecionada = todas. Em série com tiers e donos.
  origens?: readonly OrigemChave[];
  // "Convidados de resgate": filtro independente, combina com qualquer outro.
  soResgate?: boolean;
  // Marcadores exigidos (todos): "viu_replay" / "esteve_ao_vivo".
  marcadores?: readonly MarcadorOrigem[];
  busca: string;
};

// Busca por nome/e-mail/telefone (acento e caixa ignorados; no telefone só os
// dígitos contam, então "21 9123" casa com "+5521 9123…").
export function filtrarPendentes(leads: LeadPendente[], f: FiltroPendentes): LeadPendente[] {
  const tiers = new Set(f.tiers);
  const donos = new Set(f.donos ?? []);
  const origens = new Set(f.origens ?? []);
  const termo = normalizar(f.busca.trim());
  const termoDigitos = soDigitos(termo);
  return leads.filter((l) => {
    if (tiers.size > 0 && !tiers.has(tierDoLead(l).chave)) return false;
    if (donos.size > 0 && !donos.has(chaveDono(l.dono))) return false;
    if (origens.size > 0) {
      const origem = origemDoLead(l)?.chave;
      if (!origem || !origens.has(origem)) return false;
    }
    if (f.soResgate && !l.convidado_resgate) return false;
    if (f.marcadores && f.marcadores.length > 0) {
      const tem = marcadoresDoLead(l);
      if (!f.marcadores.every((m) => tem.includes(m))) return false;
    }
    if (!termo) return true;
    if (normalizar(l.nome).includes(termo)) return true;
    if (normalizar(l.email).includes(termo)) return true;
    if (termoDigitos.length >= 2 && soDigitos(l.telefone).includes(termoDigitos)) return true;
    return false;
  });
}

export type CampoOrdenacao = "nome" | "tier" | "dono" | "origem";
export type Ordenacao = { campo: CampoOrdenacao; direcao: "asc" | "desc" } | null;

// null = ordem do backend (já correta). Ordenação estável: empate mantém a
// ordem original. Por dono: alfabético, "Sem dono" SEMPRE no fim nas duas direções.
export function ordenarPendentes(leads: LeadPendente[], ord: Ordenacao): LeadPendente[] {
  if (!ord) return leads;
  const sinal = ord.direcao === "asc" ? 1 : -1;
  return leads
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      if (ord.campo === "dono") {
        const semA = !a.l.dono;
        const semB = !b.l.dono;
        if (semA !== semB) return semA ? 1 : -1;
        const cmp = nomeDono(a.l.dono).localeCompare(nomeDono(b.l.dono), "pt-BR", { sensitivity: "base" });
        return cmp !== 0 ? cmp * sinal : a.i - b.i;
      }
      if (ord.campo === "origem") {
        // Ao vivo → Replay (ou o inverso). Linha sem origem reconhecida (backend
        // antigo) fica sempre no fim.
        const oa = origemDoLead(a.l);
        const ob = origemDoLead(b.l);
        if (!oa || !ob) return oa === ob ? a.i - b.i : oa ? -1 : 1;
        const cmp = oa.ordem - ob.ordem;
        return cmp !== 0 ? cmp * sinal : a.i - b.i;
      }
      const cmp =
        ord.campo === "nome"
          ? a.l.nome.localeCompare(b.l.nome, "pt-BR", { sensitivity: "base" })
          : tierDoLead(a.l).rank - tierDoLead(b.l).rank;
      return cmp !== 0 ? cmp * sinal : a.i - b.i;
    })
    .map((x) => x.l);
}

// ---------------------------------------------------------------------------
// Percentuais e período.
// ---------------------------------------------------------------------------

// Percentual (0–100) de parte sobre total; 0 quando total = 0.
export function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export function formatarPct(v: number): string {
  return `${v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")}%`;
}

export const MAX_DIAS_INTERVALO = 90;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export type ErroIntervalo = { campo: "de" | "ate"; mensagem: string } | null;

// Validação do modo intervalo (espelha a do backend): datas válidas, ate ≥ de e
// no máximo 90 dias. Retorna o campo a destacar.
export function validarIntervalo(de: string, ate: string): ErroIntervalo {
  if (!RE_DATA.test(de)) return { campo: "de", mensagem: "Informe a data inicial." };
  if (!RE_DATA.test(ate)) return { campo: "ate", mensagem: "Informe a data final." };
  const dias = diasEntre(de, ate);
  if (dias < 0) {
    return { campo: "ate", mensagem: "A data final deve ser igual ou depois da inicial." };
  }
  if (dias > MAX_DIAS_INTERVALO) {
    return {
      campo: "ate",
      mensagem: `Período muito amplo. Reduza o intervalo (máximo ${MAX_DIAS_INTERVALO} dias).`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Telefone e CSV.
// ---------------------------------------------------------------------------

// Link wa.me: só dígitos (E.164 sem "+"). null quando não há número utilizável.
export function linkWhatsApp(telefone: string | null | undefined): string | null {
  const digitos = soDigitos(telefone);
  return digitos.length >= 10 ? `https://wa.me/${digitos}` : null;
}

// CSV do recorte filtrado — separador ";" (abre certo no Excel pt-BR) e aspas
// escapadas. Doze colunas fixas (resgate = "sim" ou vazio).
export function csvDePendentes(leads: LeadPendente[]): string {
  const cabecalho = [
    "nome",
    "mql",
    "origem",
    "resgate",
    "dono",
    "etapa",
    "telefone",
    "email",
    "evento",
    "entrou_em",
    "url_clint",
    "tags",
  ];
  const celula = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const linhas = leads.map((l) =>
    [
      l.nome,
      tierDoLead(l).label,
      origemDoLead(l)?.label ?? "",
      l.convidado_resgate ? "sim" : "",
      nomeDono(l.dono),
      l.etapa ?? "",
      l.telefone ?? "",
      l.email ?? "",
      l.evento_tag ?? "",
      l.created_at ?? "",
      l.url_clint ?? "",
      (l.tags ?? []).join(", "),
    ]
      .map(celula)
      .join(";"),
  );
  return [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}

// Estado "todos desqualificados": o ciclo tinha contatos, mas todos saíram da
// base por "Desqualificado" — nenhum lead ativo para trabalhar.
export function todosDesqualificados(t: TotaisOportunidades): boolean {
  return t.inscritos === 0 && (t.desqualificados ?? 0) > 0;
}
