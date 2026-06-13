// Gerador determinístico do mock data_clients.json (~40 leads).
// Espelha o contrato da Parte 1 do roadmap_frontend.md:
//  - 6 temperaturas, 12 etapas (+ etapa nula), 5 blocos de score (25/20/25/20/10)
//  - travas com teto (2 no-shows→60, parado→50, urgência baixa→65)
//  - donos (3 closers, 3 SDRs) + pool da Hana (sdr_pool=true)
//  - detalhe: score_breakdown, resumo_analises, timeline, contato, link_crm
// Rodar: npm run generate:mock  → escreve src/lib/mock/data_clients.json

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(__dirname, "..", "src", "lib", "mock", "data_clients.json");

// --- RNG seeded (LCG) — mesma saída a cada execução -------------------------
let seed = 20260611;
function rng() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function entre(min, max) {
  return min + rng() * (max - min);
}
function inteiro(min, max) {
  return Math.round(entre(min, max));
}

// Base temporal fixa do snapshot
const BASE = new Date("2026-06-11T09:00:00-03:00").getTime();
function isoOffset(horasAtras) {
  return new Date(BASE - horasAtras * 3600_000).toISOString();
}

// --- Pools ------------------------------------------------------------------
const NOMES = [
  "Ricardo Tavares", "Fernanda Lopes", "André Castilho", "Juliana Prado",
  "Marcelo Bittencourt", "Camila Sequeira", "Rodrigo Vilela", "Patrícia Mendonça",
  "Eduardo Sampaio", "Larissa Fontes", "Gustavo Rezende", "Beatriz Camargo",
  "Felipe Arruda", "Vanessa Siqueira", "Thiago Montenegro", "Renata Vasconcelos",
  "Bruno Cardoso", "Aline Furtado", "Daniel Queiroz", "Mariana Sales",
  "Leonardo Pacheco", "Carolina Brandão", "Vinícius Teles", "Priscila Dutra",
  "Rafael Negreiros", "Tatiana Couto", "Henrique Sabino", "Bianca Moraes",
  "Otávio Linhares", "Débora Antunes", "Caio Vergueiro", "Simone Peixoto",
  "Murilo Drummond", "Elaine Barros", "Sérgio Valente", "Cristina Nogueira",
  "Igor Falcão", "Luciana Aragão", "Paulo Cézar Mattos", "Natália Quintana",
];

const CLOSERS = ["marcio", "giba", "aurelio"];
const SDRS = ["benhur", "guilherme", "glaucio"];
const DDDS = ["11", "21", "31", "41", "51", "47", "62", "85"];
// Produtos oficiais (tabela de preços Vata jun/2026) — SEM variante S/A,
// como o backend guarda (nota do roadmap 6.2).
const PRODUTOS_POR_TIER = {
  A: ["Black", "Prime", "Private"],
  B: ["Ninja", "Black"],
  C: ["QC", "Ninja"],
};

const TETOS = { momento: 25, fit: 20, urgencia: 25, engajamento: 20, timing: 10 };

const ITENS_BLOCO = {
  momento: [
    "Respondeu no mesmo dia",
    "Pediu detalhes de preço",
    "Sinalizou decisão próxima",
    "Retomou contato por conta própria",
  ],
  fit: [
    "Perfil dentro do ICP",
    "Capacidade de investimento confirmada",
    "Experiência prévia com investimentos",
    "Patrimônio compatível com o produto",
  ],
  urgencia: [
    "Quer começar este mês",
    "Dor financeira declarada",
    "Janela de oportunidade citada",
    "Prazo definido pelo próprio lead",
  ],
  engajamento: [
    "Abriu e respondeu as mensagens",
    "Compareceu à call agendada",
    "Consumiu o conteúdo enviado",
    "Fez perguntas sobre o produto",
  ],
  timing: [
    "Última interação recente",
    "Lead criado há poucos dias",
    "Reaquecido após pausa",
  ],
};

const MOTIVOS = {
  muito_quente: [
    "Pediu proposta e declarou urgência para começar",
    "Decisor pronto: respondeu rápido e quer fechar este mês",
    "Alta intenção na última call e fit completo com o produto",
  ],
  quente: [
    "Engajado e com fit alto; falta destravar o próximo passo",
    "Respondeu bem ao pitch e pediu tempo curto para decidir",
    "Momento bom: interagiu nas últimas 24h com interesse claro",
  ],
  morno_alto: [
    "Interessado, mas ainda compara alternativas",
    "Fit bom; urgência ainda não declarada",
    "Avançou no funil, porém esfriou nos últimos dias",
  ],
  morno_baixo: [
    "Responde com atraso; interesse oscilando",
    "Fit parcial e momento ainda indefinido",
    "Precisa de novo gancho para reengajar",
  ],
  frio: [
    "Pouca resposta desde o agendamento",
    "Interesse baixo declarado na última conversa",
    "Engajamento fraco; nutrir antes de investir tempo",
  ],
  congelado: [
    "Sem resposta há semanas; carteira de reaquecimento",
    "Esfriou após no-show e não retomou contato",
    "Momento ruim declarado; revisitar no próximo ciclo",
  ],
};

// Agenda (Parte 7.3): leads em etapa de call agendada ganham next_call_at
// dentro dos próximos 10 dias (algumas hoje/amanhã) + o nº da call.
const CALL_NUMERO_POR_ETAPA = {
  "1a_call_agendada": 1,
  "2a_call_agendada": 2,
  "3a_call_agendada": 3,
  "4a_call_agendada": 4,
  "5a_mais_call_agendada": 5,
};
// Espalhamento determinístico dos dias (0=hoje, 1=amanhã...), com peso em hoje/amanhã.
const DIAS_AGENDA = [0, 1, 0, 2, 1, 4, 3, 0, 6, 1, 8, 5, 2, 9, 7, 3, 10];
function isoCallFutura(indice) {
  const dias = DIAS_AGENDA[indice % DIAS_AGENDA.length];
  const hora = 9 + (indice * 2) % 9; // 9h às 17h
  const minutos = indice % 2 === 0 ? 0 : 30;
  return new Date(
    BASE + dias * 86_400_000 + (hora - 9) * 3_600_000 + minutos * 60_000,
  ).toISOString();
}

const ACAO_POR_ETAPA = {
  "1a_call_agendada": "Confirmar presença na 1ª call com lembrete no WhatsApp",
  no_show_1a: "Reagendar a 1ª call ainda hoje com nova opção de horário",
  em_atendimento: "Enviar follow-up retomando o último ponto da conversa",
  "2a_call_agendada": "Preparar a 2ª call com base nos sinais da análise",
  "3a_call_agendada": "Confirmar a 3ª call e revalidar objeções mapeadas",
  "4a_call_agendada": "Alinhar expectativa antes da 4ª call; encurtar o ciclo",
  "5a_mais_call_agendada": "Decidir continuidade: 5ª+ call exige plano de fechamento",
  "no-show": "Recuperar com confirmação dupla e novo horário em 48h",
  fup_pos_pitch: "Cobrar decisão pós-pitch com resumo dos benefícios",
  fup_infinito_perdido: "Mensagem de reaquecimento com novo gancho de valor",
  blacklist: "Não acionar — lead em blacklist",
  fechado: "Pós-venda: garantir onboarding e pedir indicação",
  nula: "Fazer primeiro contato e qualificar o lead",
};

// --- Plano de cobertura (etapa, temperatura-alvo, trava, pool) ---------------
// score = alvo de score_bruto; trava reduz o final para o teto.
const PLANOS = [
  // muito_quente (90–100)
  { etapa: "2a_call_agendada", score: 96 },
  { etapa: "1a_call_agendada", score: 93 },
  { etapa: "em_atendimento", score: 91, pool: true },
  { etapa: "fup_pos_pitch", score: 90 },
  { etapa: "fechado", score: 94 },
  // quente (75–89)
  { etapa: "em_atendimento", score: 88 },
  // semCloser: lead com call agendada mas SEM closer atribuído — alimenta o
  // estado de atenção "Sem closer definido" na Agenda (item 2, It3).
  { etapa: "2a_call_agendada", score: 84, semCloser: true },
  { etapa: "1a_call_agendada", score: 82, pool: true },
  { etapa: "3a_call_agendada", score: 79, semCloser: true },
  { etapa: "em_atendimento", score: 77 },
  { etapa: "fup_pos_pitch", score: 75 },
  { etapa: null, score: 86 },
  // travas (decisão do roadmap: 2 no-shows→60, parado→50, urgência baixa→65)
  {
    etapa: "no-show", score: 78,
    trava: { tipo: "no_show_2x", teto: 60, motivo: "2 no-shows — teto de 60 aplicado" },
    alertasExtras: ["2 no-shows"],
  },
  {
    etapa: "fup_infinito_perdido", score: 64,
    trava: { tipo: "parado", teto: 50, motivo: "Sem interação há 14 dias — teto de 50 aplicado" },
    alertasExtras: ["Parado há 14 dias"],
  },
  {
    etapa: "em_atendimento", score: 81, urgenciaBaixa: true,
    trava: { tipo: "urgencia_baixa", teto: 65, motivo: "Urgência baixa declarada — teto de 65 aplicado" },
  },
  {
    etapa: "no_show_1a", score: 71,
    trava: { tipo: "no_show_2x", teto: 60, motivo: "2 no-shows — teto de 60 aplicado" },
    alertasExtras: ["2 no-shows"],
  },
  {
    etapa: "fup_infinito_perdido", score: 58,
    trava: { tipo: "parado", teto: 50, motivo: "Sem interação há 21 dias — teto de 50 aplicado" },
    alertasExtras: ["Parado há 21 dias"],
  },
  // morno_alto (60–74)
  { etapa: "1a_call_agendada", score: 72 },
  { etapa: "em_atendimento", score: 70, pool: true },
  { etapa: "2a_call_agendada", score: 67 },
  { etapa: "4a_call_agendada", score: 64 },
  { etapa: "fup_pos_pitch", score: 61 },
  // morno_baixo (45–59)
  { etapa: "1a_call_agendada", score: 58 },
  { etapa: "em_atendimento", score: 55 },
  { etapa: "no_show_1a", score: 52, alertasExtras: ["1 no-show"] },
  { etapa: "3a_call_agendada", score: 49 },
  { etapa: null, score: 47, pool: true },
  { etapa: "5a_mais_call_agendada", score: 46, alertasExtras: ["Ciclo longo: 5+ calls"] },
  // frio (30–44)
  { etapa: "1a_call_agendada", score: 43 },
  { etapa: "no-show", score: 41, alertasExtras: ["1 no-show"] },
  { etapa: "em_atendimento", score: 38 },
  { etapa: "fup_infinito_perdido", score: 35, pool: true },
  { etapa: "4a_call_agendada", score: 33 },
  { etapa: null, score: 31 },
  // congelado (0–29)
  { etapa: "no-show", score: 27, alertasExtras: ["3 no-shows"] },
  { etapa: "fup_infinito_perdido", score: 22 },
  { etapa: "no-show", score: 19, alertasExtras: ["2 no-shows"] },
  { etapa: "5a_mais_call_agendada", score: 16, pool: true },
  { etapa: "blacklist", score: 8 },
  { etapa: "3a_call_agendada", score: 25 },
];

function temperaturaDe(final) {
  if (final >= 90) return "muito_quente";
  if (final >= 75) return "quente";
  if (final >= 60) return "morno_alto";
  if (final >= 45) return "morno_baixo";
  if (final >= 30) return "frio";
  return "congelado";
}

// Distribui o score bruto entre os 5 blocos respeitando os tetos
function distribuirBlocos(total, urgenciaBaixa) {
  const chaves = Object.keys(TETOS);
  let pesos = chaves.map((k) => {
    let w = TETOS[k] * (0.75 + rng() * 0.5);
    if (urgenciaBaixa && k === "urgencia") w *= 0.25;
    return w;
  });
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const blocos = {};
  chaves.forEach((k, i) => {
    blocos[k] = Math.min(TETOS[k], Math.round((pesos[i] / somaPesos) * total));
  });
  // Ajuste fino até a soma bater exatamente no total
  let diff = total - chaves.reduce((a, k) => a + blocos[k], 0);
  let guarda = 0;
  while (diff !== 0 && guarda < 200) {
    const k = pick(chaves);
    if (urgenciaBaixa && k === "urgencia" && diff > 0) { guarda++; continue; }
    if (diff > 0 && blocos[k] < TETOS[k]) { blocos[k]++; diff--; }
    else if (diff < 0 && blocos[k] > 0) { blocos[k]--; diff++; }
    guarda++;
  }
  return blocos;
}

function itensDoBloco(bloco, pontos) {
  if (pontos <= 0) return [{ label: "Sem sinais relevantes neste bloco", pontos: 0 }];
  const pool = [...ITENS_BLOCO[bloco]];
  const qtd = pontos <= 5 ? 1 : pontos <= 12 ? 2 : 3;
  const itens = [];
  let restante = pontos;
  for (let i = 0; i < qtd; i++) {
    const label = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const p = i === qtd - 1 ? restante : Math.max(1, Math.round(restante * entre(0.35, 0.65)));
    itens.push({ label, pontos: Math.min(p, restante) });
    restante -= itens[i].pontos;
    if (restante <= 0) break;
  }
  if (restante > 0) itens[itens.length - 1].pontos += restante;
  return itens;
}

function telefone() {
  return `+55 ${pick(DDDS)} 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`;
}

function emailDe(nome) {
  const slug = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".");
  return `${slug}@${pick(["gmail.com", "hotmail.com", "outlook.com", "empresa.com.br"])}`;
}

function sinaisAnalise(temperatura) {
  const positivos = {
    quente: ["Decisor direto", "Orçamento disponível", "Urgência declarada", "Respondeu rápido"],
    morno: ["Interesse genuíno no método", "Perfil dentro do ICP", "Aberto a nova conversa"],
    frio: ["Educado e responsivo quando contatado", "Perfil compatível no longo prazo"],
  };
  const riscos = {
    quente: ["Compara com um concorrente", "Decisão envolve cônjuge/sócio"],
    morno: ["Sem prazo definido", "Sensível a preço", "Agenda apertada"],
    frio: ["Baixa resposta no WhatsApp", "Momento financeiro ruim", "Já teve no-show"],
  };
  const grupo =
    temperatura === "muito_quente" || temperatura === "quente"
      ? "quente"
      : temperatura === "morno_alto" || temperatura === "morno_baixo"
        ? "morno"
        : "frio";
  const escolher = (arr, n) => {
    const copia = [...arr];
    const out = [];
    for (let i = 0; i < n && copia.length; i++) {
      out.push(copia.splice(Math.floor(rng() * copia.length), 1)[0]);
    }
    return out;
  };
  return {
    positivos: escolher(positivos[grupo], inteiro(1, 2)),
    riscos: escolher(riscos[grupo], inteiro(1, 2)),
  };
}

// --- Geração ------------------------------------------------------------------
let proximaCallIdx = 0;
const leads = PLANOS.map((plano, idx) => {
  const n = idx + 1;
  const lead_id = `ld_${String(n).padStart(4, "0")}`;
  const nome = NOMES[idx];
  const bruto = plano.score;
  const final = plano.trava ? Math.min(bruto, plano.trava.teto) : bruto;
  const temperatura = temperaturaDe(final);
  const etapa = plano.etapa ?? null;

  const blocos = distribuirBlocos(bruto, plano.urgenciaBaixa);

  const pool = Boolean(plano.pool);
  // pick(CLOSERS) é chamado sempre (mantém a sequência determinística do RNG);
  // semCloser zera o resultado para forçar o estado "Sem closer definido".
  const closerSorteado =
    etapa === null && !pool ? (rng() < 0.5 ? null : pick(CLOSERS)) : pick(CLOSERS);
  const closer_id = plano.semCloser ? null : closerSorteado;
  const sdr_id = pool ? null : SDRS[idx % SDRS.length];

  // Alertas: trava/no-show primeiro, depois situacionais
  const alertas = [...(plano.alertasExtras ?? [])];
  if (plano.trava?.tipo === "urgencia_baixa") alertas.push("Urgência baixa declarada");
  if (!plano.trava && rng() < 0.25) alertas.push("Cônjuge/sócio no processo de decisão");
  if (etapa && etapa.endsWith("call_agendada") && rng() < 0.4) alertas.push("Call em menos de 24h");

  const proxima_acao = alertas.some((a) => a.includes("no-show"))
    ? ACAO_POR_ETAPA["no-show"]
    : ACAO_POR_ETAPA[etapa ?? "nula"];

  const tier_final = final >= 75 ? "A" : final >= 50 ? "B" : "C";
  // Lead recém-criado (sem etapa) ainda não tem produto sugerido pelo motor
  const produto_sugerido = etapa === null ? null : pick(PRODUTOS_POR_TIER[tier_final]);

  const horasCalculo = rng() < 0.15 ? entre(20, 40) : entre(0.2, 12);
  const score_calculated_at = isoOffset(horasCalculo);

  // Próxima call (Agenda): só etapas de call agendada têm call futura marcada.
  const next_call_numero = CALL_NUMERO_POR_ETAPA[etapa] ?? null;
  const next_call_at = next_call_numero ? isoCallFutura(proximaCallIdx++) : null;

  // Timeline coerente com a etapa
  const entradaHoras = entre(72, 720); // entre 3 e 30 dias atrás
  const eventos = [];
  let cursor = entradaHoras;
  const addEvento = (tipo, descricao, recuoHoras) => {
    cursor = Math.max(cursor - recuoHoras, horasCalculo + 0.5);
    eventos.push({
      event_id: `ev_${String(n).padStart(4, "0")}_${eventos.length + 1}`,
      tipo,
      descricao,
      occurred_at: isoOffset(cursor),
    });
  };
  eventos.push({
    event_id: `ev_${String(n).padStart(4, "0")}_1`,
    tipo: "entrada",
    descricao: pool
      ? "Lead criado pela Hana (IA agendadora) a partir de conversa no WhatsApp"
      : "Lead entrou pelo funil e foi atribuído ao SDR",
    occurred_at: isoOffset(entradaHoras),
  });
  addEvento("analise_sdr", "Análise da conversa do SDR concluída pela IA", entre(2, 12));
  const teveCall = etapa !== null && etapa !== "1a_call_agendada" && etapa !== "no_show_1a";
  if (etapa !== null) {
    addEvento("call_agendada", "1ª call agendada no Calendly", entre(4, 24));
  }
  if (etapa === "no_show_1a" || etapa === "no-show") {
    addEvento("no_show", "Lead não compareceu à call agendada", entre(12, 48));
    if (alertas.some((a) => a.startsWith("2") || a.startsWith("3"))) {
      addEvento("call_agendada", "Call remarcada após no-show", entre(8, 24));
      addEvento("no_show", "Novo no-show registrado", entre(12, 48));
    }
  } else if (teveCall) {
    addEvento("call_realizada", "Call realizada com o closer", entre(12, 48));
    addEvento("analise_call", "Análise da call concluída pela IA", entre(1, 4));
  }
  if (etapa !== null) {
    addEvento("mudanca_etapa", `Etapa atualizada para "${etapa}"`, entre(4, 24));
  }
  eventos.push({
    event_id: `ev_${String(n).padStart(4, "0")}_${eventos.length + 1}`,
    tipo: "score_recalculado",
    descricao: `Score recalculado pelo motor: ${final}`,
    occurred_at: score_calculated_at,
  });

  const { positivos, riscos } = sinaisAnalise(temperatura);
  const resumoSdr = {
    resumo_curto: pool
      ? "Hana qualificou o lead no WhatsApp: contexto financeiro e interesse mapeados antes do agendamento."
      : "SDR qualificou o lead: contexto, objetivo financeiro e disponibilidade mapeados na conversa.",
    sinais_positivos: positivos,
    sinais_risco: riscos,
    analisado_em: isoOffset(entradaHoras - 2),
  };
  const resumoCall = teveCall
    ? {
        resumo_curto:
          "Na última call o lead detalhou objetivos e objeções; closer apresentou o produto e definiu próximo passo.",
        sinais_positivos: positivos,
        sinais_risco: riscos,
        analisado_em: isoOffset(entre(8, 72)),
      }
    : null;

  return {
    lead_id,
    nome_exibicao: nome,
    telefone: telefone(),
    email: emailDe(nome),
    score_final: final,
    score_bruto: bruto,
    temperatura,
    etapa_atual: etapa,
    score_momento: blocos.momento,
    score_fit: blocos.fit,
    score_urgencia: blocos.urgencia,
    score_engajamento: blocos.engajamento,
    score_timing: blocos.timing,
    trava_aplicada: plano.trava ? plano.trava.motivo : null,
    motivo_curto: pick(MOTIVOS[temperatura]),
    proxima_acao,
    alertas,
    tier_final,
    produto_sugerido,
    closer_id,
    sdr_id,
    sdr_pool: pool,
    next_call_at,
    next_call_numero,
    link_crm: `https://app.clint.digital/deals/vata-dojo/${lead_id}`,
    score_calculated_at,
    score_breakdown: {
      blocos: Object.entries(blocos).map(([bloco, pontos]) => ({
        bloco,
        pontos,
        teto: TETOS[bloco],
        itens: itensDoBloco(bloco, pontos),
      })),
      trava: plano.trava ?? null,
    },
    resumo_analises: { sdr: resumoSdr, call: resumoCall },
    timeline: eventos.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)),
  };
});

// --- Verificações de consistência ---------------------------------------------
for (const l of leads) {
  const soma =
    l.score_momento + l.score_fit + l.score_urgencia + l.score_engajamento + l.score_timing;
  if (soma !== l.score_bruto) {
    throw new Error(`${l.lead_id}: blocos somam ${soma}, esperado ${l.score_bruto}`);
  }
  if (temperaturaDe(l.score_final) !== l.temperatura) {
    throw new Error(`${l.lead_id}: temperatura inconsistente`);
  }
  for (const b of l.score_breakdown.blocos) {
    const somaItens = b.itens.reduce((a, i) => a + i.pontos, 0);
    if (somaItens !== b.pontos) {
      throw new Error(`${l.lead_id}/${b.bloco}: itens somam ${somaItens}, esperado ${b.pontos}`);
    }
  }
}

const temps = new Set(leads.map((l) => l.temperatura));
const etapas = new Set(leads.map((l) => l.etapa_atual).filter(Boolean));
console.log(`Leads: ${leads.length}`);
console.log(`Temperaturas cobertas: ${temps.size}/6`);
console.log(`Etapas cobertas: ${etapas.size}/12 (+ ${leads.filter((l) => !l.etapa_atual).length} sem etapa)`);
console.log(`Travas: ${leads.filter((l) => l.trava_aplicada).length}`);
console.log(`Pool da Hana: ${leads.filter((l) => l.sdr_pool).length}`);
const comCall = leads.filter((l) => l.next_call_at);
const hoje = new Date(BASE).toISOString().slice(0, 10);
console.log(
  `Agenda: ${comCall.length} calls futuras (${comCall.filter((l) => l.next_call_at.slice(0, 10) === hoje).length} hoje)`,
);

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(leads, null, 2), "utf8");
console.log(`OK → ${SAIDA}`);
