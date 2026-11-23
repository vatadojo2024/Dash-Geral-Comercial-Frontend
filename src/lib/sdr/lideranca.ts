import {
  agregarDashboard,
  contarNaoIdentificadas,
  POOL,
  type SdrDashboardPayload,
  type TimeSdr,
} from "@/lib/data/sdrDashboard";

// ---------------------------------------------------------------------------
// Regras PURAS da aba "Liderança Pré-venda" (DOCUMENTACAO.md 5.5, 5.8–5.11
// e 6.5). Tudo aqui é testável sem rede nem React.
// ---------------------------------------------------------------------------

// 5.1 — closers: giba/gilberto → Giba; demais mantidos como vieram.
export function normalizarCloser(nome: string): string {
  const n = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("giba") || n.includes("gilberto")) return "Giba";
  return nome.trim();
}

// 5.11 — semana "de calendário" dentro do mês
export function weekOfMonth(dataISO: string): number {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  const dowPrimeiroDia = new Date(ano, mes - 1, 1).getDay();
  return Math.floor((dia + dowPrimeiroDia - 1) / 7) + 1;
}

export function semanasDoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return weekOfMonth(`${mes}-${String(ultimo).padStart(2, "0")}`);
}

// 5.9 — tradução de qualificação do marketing para produto/perfil
const TRADUCAO_QUALIFICACAO: Record<string, string> = {
  "sem qualificacao": "Masterclass",
  "qualificado qc": "QC",
  "possivel ninja": "QC/Ninja",
  mql: "Ninja",
  "mql+": "Black",
  smql: "Prime",
  hmql: "Prime/Private",
  umql: "Private",
};

export function traduzirQualificacao(valor: string): string {
  const chave = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!chave) return "Nao informado";
  return TRADUCAO_QUALIFICACAO[chave] ?? valor;
}

// 5.10 — arredondamento por maiores restos: inteiros somando exatamente o alvo
export function allocateIntegersWithTarget(fracoes: number[], alvo: number): number[] {
  const pisos = fracoes.map((f) => Math.floor(f));
  let restante = alvo - pisos.reduce((a, b) => a + b, 0);
  const ordem = fracoes
    .map((f, i) => ({ i, resto: f - Math.floor(f) }))
    .sort((a, b) => b.resto - a.resto);
  const saida = [...pisos];
  for (const { i } of ordem) {
    if (restante <= 0) break;
    saida[i] += 1;
    restante -= 1;
  }
  // alvo menor que a soma dos pisos (não deve ocorrer com frações válidas):
  for (let k = ordem.length - 1; restante < 0 && k >= 0; k--) {
    const { i } = ordem[k];
    if (saida[i] > 0) {
      saida[i] -= 1;
      restante += 1;
    }
  }
  return saida;
}

export const SEM_CLOSER = "Sem Closer";

export type ComparecimentoSdr = {
  sdr: string;
  nome: string;
  agendadasAteHoje: number;
  ocorridas: number;
  noShow: number;
  /** 0–100, 1 casa */
  taxa: number;
};

export type Lideranca = {
  kpis: {
    leadsEntraram: number;
    leadsQualificados: number;
    leadsDesqualificados: number;
    ocorridas: number;
    noShow: number;
    agendadasAteHoje: number;
    /** 0–100, 1 casa */
    taxaComparecimento: number;
  };
  comparecimentoPorSdr: ComparecimentoSdr[];
  produtosNoRecorte: { produto: string; total: number }[];
  matriz: {
    closers: string[];
    linhas: { sdr: string; nome: string; valores: Record<string, number>; total: number }[];
  };
  equipe: {
    qualificadosMes: number;
    /** 5.5 — metas da equipe do mês (da rota); null = sem meta definida. */
    metas: number[] | null;
    metaAtual: number | null;
    metasBatidas: number;
    progresso: { meta: number; pct: number; batida: boolean; faltam: number }[];
  };
  /** Linhas do recorte (agendadas, realizadas, no-show) com SDR que a dash não reconhece. */
  naoIdentificadas: number;
};

type Recorte = { mes: string; semana: number | null };

function noRecorte(data: string, r: Recorte): boolean {
  return (
    data.startsWith(r.mes) && (r.semana === null || weekOfMonth(data) === r.semana)
  );
}

export function agregarLideranca(
  payload: SdrDashboardPayload,
  mes: string,
  semana: number | null,
  hojeISO: string,
  time: TimeSdr,
): Lideranca {
  const r: Recorte = { mes, semana };
  const { reconhecer } = time;
  // Ordem das linhas: a dos operadores do mês, e o pool por último.
  const ordem = [...time.operadores.map((o) => o.id), ...(time.temPool ? [POOL] : [])];

  // --- Comparecimento (5.8): só calls com data ≤ hoje entram na base -------
  const porSdr = new Map<string, { agendadasAteHoje: number; ocorridas: number; noShow: number }>();
  const garantir = (sdr: string) => {
    const atual = porSdr.get(sdr) ?? { agendadasAteHoje: 0, ocorridas: 0, noShow: 0 };
    porSdr.set(sdr, atual);
    return atual;
  };
  for (const linha of payload.agendadas) {
    if (!noRecorte(linha.data_referencia, r) || linha.data_referencia > hojeISO) continue;
    const sdr = reconhecer(linha.sdr);
    if (sdr) garantir(sdr).agendadasAteHoje += linha.total;
  }
  for (const linha of payload.realizadas) {
    if (!noRecorte(linha.data_referencia, r) || linha.data_referencia > hojeISO) continue;
    const sdr = reconhecer(linha.sdr);
    if (sdr) garantir(sdr).ocorridas += linha.total;
  }
  for (const linha of payload.no_show) {
    if (!noRecorte(linha.data_referencia, r) || linha.data_referencia > hojeISO) continue;
    const sdr = reconhecer(linha.sdr);
    if (sdr) garantir(sdr).noShow += linha.total;
  }

  const comparecimentoPorSdr: ComparecimentoSdr[] = ordem.filter((s) => porSdr.has(s)).map((sdr) => {
    const c = porSdr.get(sdr)!;
    return {
      sdr,
      nome: time.nomeDe(sdr),
      ...c,
      taxa:
        c.agendadasAteHoje > 0
          ? Math.round((c.ocorridas / c.agendadasAteHoje) * 1000) / 10
          : 0,
    };
  });

  const agendadasAteHoje = comparecimentoPorSdr.reduce((a, c) => a + c.agendadasAteHoje, 0);
  const ocorridas = comparecimentoPorSdr.reduce((a, c) => a + c.ocorridas, 0);
  const noShow = comparecimentoPorSdr.reduce((a, c) => a + c.noShow, 0);

  // --- Funil de marketing (5.9) --------------------------------------------
  const leadsEntraram = (payload.marketing_leads ?? [])
    .filter((l) => noRecorte(l.data_referencia, r))
    .reduce((a, l) => a + l.total, 0);
  const qualificadosMkt = (payload.marketing_qualificados ?? []).filter((l) =>
    noRecorte(l.data_referencia, r),
  );
  const leadsQualificados = qualificadosMkt.reduce((a, l) => a + l.total, 0);

  const porProduto = new Map<string, number>();
  for (const linha of qualificadosMkt) {
    const produto = traduzirQualificacao(linha.qualificacao);
    porProduto.set(produto, (porProduto.get(produto) ?? 0) + linha.total);
  }
  const produtosNoRecorte = [...porProduto.entries()]
    .map(([produto, total]) => ({ produto, total }))
    .sort((a, b) => b.total - a.total);

  // --- Matriz SDR × Closer (5.10): distribuição proporcional por dia -------
  // calls marcadas no recorte (agendadas), distribuídas pela participação de
  // cada closer no MESMO dia; sem closer no dia → "Sem Closer"; arredondamento
  // por maiores restos para a soma bater com o total real do SDR.
  const sdrPorDia = new Map<string, Map<string, number>>();
  for (const linha of payload.agendadas) {
    if (!noRecorte(linha.data_referencia, r)) continue;
    const sdr = reconhecer(linha.sdr);
    if (!sdr) continue;
    const dia = sdrPorDia.get(linha.data_referencia) ?? new Map();
    dia.set(sdr, (dia.get(sdr) ?? 0) + linha.total);
    sdrPorDia.set(linha.data_referencia, dia);
  }
  const closerPorDia = new Map<string, Map<string, number>>();
  const todosClosers = new Set<string>();
  for (const linha of payload.closer_agendadas ?? []) {
    if (!noRecorte(linha.data_referencia, r)) continue;
    const closer = normalizarCloser(linha.closer);
    todosClosers.add(closer);
    const dia = closerPorDia.get(linha.data_referencia) ?? new Map();
    dia.set(closer, (dia.get(closer) ?? 0) + linha.total);
    closerPorDia.set(linha.data_referencia, dia);
  }

  const fracionado = new Map<string, Map<string, number>>();
  let usouSemCloser = false;
  for (const [dia, sdrs] of sdrPorDia) {
    const closersDoDia = closerPorDia.get(dia);
    const totalCloserDia = closersDoDia
      ? [...closersDoDia.values()].reduce((a, b) => a + b, 0)
      : 0;
    for (const [sdr, calls] of sdrs) {
      const alvo = fracionado.get(sdr) ?? new Map<string, number>();
      if (totalCloserDia === 0 || !closersDoDia) {
        usouSemCloser = true;
        alvo.set(SEM_CLOSER, (alvo.get(SEM_CLOSER) ?? 0) + calls);
      } else {
        for (const [closer, qtd] of closersDoDia) {
          const parte = (calls * qtd) / totalCloserDia;
          if (parte > 0) alvo.set(closer, (alvo.get(closer) ?? 0) + parte);
        }
      }
      fracionado.set(sdr, alvo);
    }
  }

  const colunas = [...todosClosers].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (usouSemCloser) colunas.push(SEM_CLOSER);

  const linhasMatriz = ordem.filter((s) => fracionado.has(s)).map((sdr) => {
    const fracoes = fracionado.get(sdr)!;
    const totalSdr = [...(sdrPorDia.values() ?? [])].reduce(
      (a, dia) => a + (dia.get(sdr) ?? 0),
      0,
    );
    const valoresFracionados = colunas.map((c) => fracoes.get(c) ?? 0);
    const inteiros = allocateIntegersWithTarget(valoresFracionados, totalSdr);
    const valores: Record<string, number> = {};
    colunas.forEach((c, i) => {
      valores[c] = inteiros[i];
    });
    return { sdr, nome: time.nomeDe(sdr), valores, total: totalSdr };
  });

  // --- Métricas da equipe (5.5): SEMPRE o mês inteiro, ignora a semana -----
  // Soma os qualificados de TODOS os SDRs acompanhados (incl. o pool — a meta
  // da equipe conta reuniões qualificadas do time inteiro de pré-venda).
  const dashboardMes = agregarDashboard(payload, mes, time);
  const qualificadosMes = dashboardMes.sdrs.reduce((a, s) => a + s.qualificados, 0);
  const metasEquipe = time.equipe;
  const metasBatidasEquipe = metasEquipe ? metasEquipe.filter((m) => qualificadosMes >= m).length : 0;
  const metaAtualEquipe = metasEquipe ? (metasEquipe.find((m) => qualificadosMes < m) ?? metasEquipe[metasEquipe.length - 1]) : null;

  return {
    kpis: {
      leadsEntraram,
      leadsQualificados,
      leadsDesqualificados: Math.max(leadsEntraram - leadsQualificados, 0),
      ocorridas,
      noShow,
      agendadasAteHoje,
      taxaComparecimento:
        agendadasAteHoje > 0 ? Math.round((ocorridas / agendadasAteHoje) * 1000) / 10 : 0,
    },
    comparecimentoPorSdr,
    produtosNoRecorte,
    matriz: { closers: colunas, linhas: linhasMatriz },
    naoIdentificadas: [payload.agendadas, payload.realizadas, payload.no_show].reduce(
      (a, linhas) => a + contarNaoIdentificadas(linhas, reconhecer, (l) => noRecorte(l.data_referencia, r)),
      0,
    ),
    equipe: {
      qualificadosMes,
      metas: metasEquipe,
      metaAtual: metaAtualEquipe,
      metasBatidas: metasBatidasEquipe,
      progresso: (metasEquipe ?? []).map((meta) => ({
        meta,
        pct: Math.min(qualificadosMes / meta, 1),
        batida: qualificadosMes >= meta,
        faltam: Math.max(meta - qualificadosMes, 0),
      })),
    },
  };
}
