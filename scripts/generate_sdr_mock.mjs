// Gerador determinístico do mock do Dashboard SDR (src/lib/mock/sdr_dashboard.json).
// Espelha o payload dos endpoints da API externa (api.infradojo.pro), GRANULAR
// POR DIA (necessário para o filtro de semana da Liderança):
//   SDR:     agendadas, realizadas, no_show, por_produto, remarcadas
//   Marketing: marketing_leads, marketing_qualificados (com qualificacao)
//   Closer:  closer_agendadas/realizadas/no_show/por_produto/remarcadas
// 3 meses (abr/mai/jun 2026). Junho é "mês em andamento": só agendadas têm
// dias futuros; o resto corta em HOJE (2026-06-11).
// Rodar: npm run generate:sdr-mock

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(__dirname, "..", "src", "lib", "mock", "sdr_dashboard.json");

let seed = 20260612;
function rng() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

const MESES = ["2026-04", "2026-05", "2026-06"];
const HOJE = "2026-06-11";
// Volume cresce mês a mês (números distintos e coerentes)
const FATOR_MES = { "2026-04": 0.8, "2026-05": 0.95, "2026-06": 1.1 };

// Perfis diários (dias úteis) — base de calls agendadas e mix de produtos
const SDRS = [
  { nome: "Glaucio", base: 2.4, mix: { qc: 0.33, ninja: 0.28, black: 0.2, prime: 0.12, private: 0.07 } },
  { nome: "Delrue", base: 2.6, mix: { qc: 0.18, ninja: 0.38, black: 0.22, prime: 0.15, private: 0.07 } },
  { nome: "Benhur", base: 3.0, mix: { qc: 0.22, ninja: 0.35, black: 0.2, prime: 0.15, private: 0.08 } },
  { nome: "Hana", base: 1.1, mix: { qc: 0.4, ninja: 0.35, black: 0.25, prime: 0, private: 0 } },
];

const CLOSERS = [
  { nome: "Marcio", base: 2.6 },
  { nome: "Giba", base: 2.2 }, // ~20% das linhas saem como "Gilberto" (testa o alias 5.1)
  { nome: "Aurelio", base: 2.4 },
];

const PRODUTO_NOME = {
  qc: "Quebrando Código",
  ninja: "Ninja",
  black: "Black",
  prime: "Prime",
  private: "Private",
};

// Categorias de qualificação do marketing (tradução na regra 5.9)
const QUALIFICACOES = [
  ["sem qualificacao", 0.15],
  ["qualificado qc", 0.2],
  ["possivel ninja", 0.15],
  ["mql", 0.2],
  ["mql+", 0.12],
  ["smql", 0.08],
  ["hmql", 0.06],
  ["umql", 0.04],
];

function diasUteis(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const dias = [];
  const ultimo = new Date(ano, m, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const dow = new Date(ano, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) dias.push(`${mes}-${String(d).padStart(2, "0")}`);
  }
  return dias;
}

function sorteioMix(mix) {
  const r = rng();
  let acc = 0;
  for (const [chave, peso] of Object.entries(mix)) {
    acc += peso;
    if (r < acc) return chave;
  }
  return Object.keys(mix)[0];
}

// ----------------------------------------------------------------------------
// JUNHO ENGENHEIRADO (exemplos OFICIAIS da comissão SDR, It3 item 5):
//   Glaucio: 25 base + 14 QC → 29 p/ meta (<40, patamar base R$40 + 0,7%)
//   Delrue:  36 base +  9 QC → 39 p/ meta (<40, patamar base)
//   Benhur:  38 base + 12 QC → 42 p/ meta (≥40 → M1 RETROATIVO R$60 + 1,2%)
// Abril/maio continuam gerados; junho dos 3 SDRs sai deste plano exato.
// ----------------------------------------------------------------------------
const JUNHO_PLAN = {
  Glaucio: {
    realizadas: 41,
    noShow: 4,
    futuras: 8,
    produtos: { qc: 14, ninja: 10, black: 8, prime: 5, private: 2 },
  },
  Delrue: {
    realizadas: 47,
    noShow: 4,
    futuras: 7,
    produtos: { qc: 9, ninja: 14, black: 11, prime: 7, private: 4 },
  },
  Benhur: {
    realizadas: 52,
    noShow: 5,
    futuras: 9,
    produtos: { qc: 12, ninja: 15, black: 12, prime: 7, private: 4 },
  },
};

// Comissão dos SDRs (7.1.4): vendas do mês ORIGINADAS dos agendamentos de
// cada SDR — 3 a 6 vendas por mês, valores à vista da tabela oficial e
// produto já com a variante exibida (Semestral/Anual). Determinístico.
const VENDAS_PLAN = {
  "2026-04": [
    ["Glaucio", "Black Semestral", 25000, "2026-04-08"],
    ["Delrue", "Ninja Anual", 12000, "2026-04-15"],
    ["Benhur", "Prime Semestral", 68000, "2026-04-22"],
    ["Benhur", "QC", 1997, "2026-04-28"],
  ],
  "2026-05": [
    ["Glaucio", "Ninja Semestral", 7000, "2026-05-06"],
    ["Delrue", "Black Anual", 44000, "2026-05-13"],
    ["Delrue", "QC", 1997, "2026-05-20"],
    ["Benhur", "Black Semestral", 25000, "2026-05-27"],
  ],
  "2026-06": [
    ["Glaucio", "Black Anual", 44000, "2026-06-04"],
    ["Glaucio", "Ninja Semestral", 7000, "2026-06-09"],
    ["Delrue", "Prime Semestral", 68000, "2026-06-05"],
    ["Benhur", "Black Semestral", 25000, "2026-06-03"],
    ["Benhur", "Ninja Anual", 12000, "2026-06-10"],
  ],
};

const payload = {
  agendadas: [],
  realizadas: [],
  no_show: [],
  por_produto: [],
  remarcadas: [],
  marketing_leads: [],
  marketing_qualificados: [],
  closer_agendadas: [],
  closer_realizadas: [],
  closer_no_show: [],
  closer_por_produto: [],
  closer_remarcadas: [],
  vendas_por_sdr: [],
};

function geraPessoa({ nome, base, mix }, dia, fator, prefixo, rotuloDia) {
  const futuro = dia > HOJE;
  const ag = Math.max(0, Math.round(base * fator + (rng() - 0.45) * 2));
  if (ag > 0) payload[`${prefixo}agendadas`].push({ [rotuloDia]: nome, data_referencia: dia, total: ag });
  if (futuro || ag === 0) return;

  const re = Math.min(ag, Math.max(0, Math.round(ag * (0.72 + rng() * 0.2))));
  const ns = Math.min(ag - re, rng() < 0.55 ? 1 : rng() < 0.3 ? 2 : 0);
  if (re > 0) payload[`${prefixo}realizadas`].push({ [rotuloDia]: nome, data_referencia: dia, total: re });
  if (ns > 0) payload[`${prefixo}no_show`].push({ [rotuloDia]: nome, data_referencia: dia, total: ns });
  if (rng() < 0.12) payload[`${prefixo}remarcadas`].push({ [rotuloDia]: nome, data_referencia: dia, total: 1 });

  if (mix) {
    const porProduto = {};
    for (let i = 0; i < re; i++) {
      if (rng() < 0.92) {
        const p = sorteioMix(mix);
        porProduto[p] = (porProduto[p] ?? 0) + 1;
      }
    }
    for (const [chave, total] of Object.entries(porProduto)) {
      payload[`${prefixo}por_produto`].push({
        [rotuloDia]: nome,
        data_referencia: dia,
        produto: PRODUTO_NOME[chave],
        total,
      });
    }
  }
}

for (const mes of MESES) {
  const fator = FATOR_MES[mes];
  for (const dia of diasUteis(mes)) {
    // SDRs (junho de Glaucio/Delrue/Benhur sai do JUNHO_PLAN, não do sorteio)
    for (const sdr of SDRS) {
      if (mes === "2026-06" && JUNHO_PLAN[sdr.nome]) continue;
      geraPessoa(sdr, dia, fator, "", "sdr");
    }

    // Closers (sem mix detalhado — usa um mix médio; "Giba" às vezes vira "Gilberto")
    for (const closer of CLOSERS) {
      const nome = closer.nome === "Giba" && rng() < 0.2 ? "Gilberto" : closer.nome;
      geraPessoa(
        { nome, base: closer.base, mix: { qc: 0.2, ninja: 0.35, black: 0.22, prime: 0.15, private: 0.08 } },
        dia,
        fator,
        "closer_",
        "closer",
      );
    }

    // Marketing (sem linhas futuras)
    if (dia <= HOJE) {
      const leads = Math.round((8 + rng() * 6) * fator);
      payload.marketing_leads.push({ data_referencia: dia, total: leads });
      const qualificados = Math.round(leads * (0.38 + rng() * 0.14));
      const porQualificacao = {};
      for (let i = 0; i < qualificados; i++) {
        const r = rng();
        let acc = 0;
        let escolhida = QUALIFICACOES[0][0];
        for (const [q, peso] of QUALIFICACOES) {
          acc += peso;
          if (r < acc) {
            escolhida = q;
            break;
          }
        }
        porQualificacao[escolhida] = (porQualificacao[escolhida] ?? 0) + 1;
      }
      for (const [q, total] of Object.entries(porQualificacao)) {
        payload.marketing_qualificados.push({ data_referencia: dia, qualificacao: q, total });
      }
    }
  }
}

// --- Junho engenheirado dos 3 SDRs (exemplos oficiais da comissão) -----------
// Espalha um total pelos dias úteis (resto distribuído nos primeiros dias).
function espalhar(total, dias) {
  const porDia = Math.floor(total / dias.length);
  let resto = total - porDia * dias.length;
  const mapa = new Map();
  for (const dia of dias) {
    const qtd = porDia + (resto > 0 ? 1 : 0);
    if (resto > 0) resto--;
    if (qtd > 0) mapa.set(dia, qtd);
  }
  return mapa;
}

const DIAS_JUN_ATE_HOJE = diasUteis("2026-06").filter((d) => d <= HOJE);
const DIAS_JUN_FUTUROS = diasUteis("2026-06").filter((d) => d > HOJE).slice(0, 5);

for (const [nome, plano] of Object.entries(JUNHO_PLAN)) {
  const empurrar = (lista, mapa, extra = {}) => {
    for (const [dia, total] of mapa) {
      payload[lista].push({ sdr: nome, data_referencia: dia, total, ...extra });
    }
  };
  empurrar("agendadas", espalhar(plano.realizadas + plano.noShow, DIAS_JUN_ATE_HOJE));
  empurrar("agendadas", espalhar(plano.futuras, DIAS_JUN_FUTUROS));
  empurrar("realizadas", espalhar(plano.realizadas, DIAS_JUN_ATE_HOJE));
  empurrar("no_show", espalhar(plano.noShow, DIAS_JUN_ATE_HOJE));
  for (const [chave, totalProduto] of Object.entries(plano.produtos)) {
    if (totalProduto === 0) continue;
    empurrar("por_produto", espalhar(totalProduto, DIAS_JUN_ATE_HOJE), {
      produto: PRODUTO_NOME[chave],
    });
  }
}

// --- Vendas do mês por SDR (7.1.4): plano determinístico, 3–6 por mês --------
for (const mes of MESES) {
  for (const [sdr, produto, valor, dia] of VENDAS_PLAN[mes]) {
    payload.vendas_por_sdr.push({ sdr, data_referencia: dia, produto, valor });
  }
}

// --- Verificações de consistência -------------------------------------------
function somaMes(linhas, nome, mes, rotulo) {
  return linhas
    .filter((l) => (rotulo ? l[rotulo] === nome : true) && l.data_referencia.startsWith(mes))
    .reduce((a, l) => a + l.total, 0);
}

for (const mes of MESES) {
  for (const { nome } of SDRS) {
    const ag = somaMes(payload.agendadas, nome, mes, "sdr");
    const re = somaMes(payload.realizadas, nome, mes, "sdr");
    const ns = somaMes(payload.no_show, nome, mes, "sdr");
    const pp = somaMes(payload.por_produto, nome, mes, "sdr");
    if (re > ag) throw new Error(`${nome} ${mes}: realizadas ${re} > agendadas ${ag}`);
    if (pp > re) throw new Error(`${nome} ${mes}: produtos ${pp} > realizadas ${re}`);
    console.log(`${mes} ${nome.padEnd(8)} ag ${String(ag).padStart(3)} re ${String(re).padStart(3)} ns ${String(ns).padStart(2)} prod ${pp}`);
  }
  const leads = somaMes(payload.marketing_leads, null, mes, null);
  const quali = somaMes(payload.marketing_qualificados, null, mes, null);
  console.log(`${mes} marketing: ${leads} leads, ${quali} qualificados`);
  const vendasMes = payload.vendas_por_sdr.filter((v) =>
    v.data_referencia.startsWith(mes),
  );
  const volumeMes = vendasMes.reduce((a, v) => a + v.valor, 0);
  console.log(`${mes} vendas por SDR: ${vendasMes.length} vendas, R$ ${volumeMes}`);
}

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(payload, null, 1), "utf8");
console.log(`OK → ${SAIDA}`);
