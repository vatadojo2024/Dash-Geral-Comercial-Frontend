import { hojeBR, somarDias } from "@/lib/agendamentos/primeiraCall";
import { CLOSERS, SDRS } from "@/lib/mock/users";

// ---------------------------------------------------------------------------
// Mock de GET /api/agendamentos/primeira-call (LEADS_MODE=mock). Espelha a
// resposta REAL do backend ({ de, ate, total, agendamentos, gerado_em }) — o
// route handler passa este corpo pelo MESMO adapter da API real. Datas
// RELATIVAS a hoje (Brasília), porque a fila só faz sentido com "hoje",
// "amanhã" e "já passou": um JSON estático envelheceria no dia seguinte.
//
// Determinístico: os mesmos leads nos mesmos horários a cada carga. Cobre os
// casos da spec: call de hoje que já passou e que ainda vai acontecer, item sem
// link_crm/deal_id, link da sala como código do Meet e como URL, campos vazios.
// `simular=invalido` acrescenta dois itens fora do contrato (descartados e
// logados pelo adapter); `simular=vazio` devolve a fila vazia.
// Os ids de closer são os das contas mock (marcio, giba, aurelio) — ou, no
// teste local com login real, o closer logado no lugar do primeiro
// (closersDoMock).
// ---------------------------------------------------------------------------

type Semente = {
  lead: string;
  // Deslocamento em dias a partir de hoje e horário em Brasília.
  dia: number;
  hora: string;
  closer: number;
  sdr: number;
  produto: string | null;
  variante: string | null;
  patrimonio: string | null;
  renda: string | null;
  urgencia: string | null;
  link: string | null;
  semClint?: boolean;
};

const SEMENTES: Semente[] = [
  { lead: "Renato Figueiredo", dia: -6, hora: "10:00", closer: 0, sdr: 0, produto: "prime", variante: "anual", patrimonio: "R$ 500 mil a R$ 1 milhão", renda: "R$ 20 mil a R$ 30 mil", urgencia: "8/10 - quer decidir antes da virada do ano", link: "abc-defg-hij" },
  { lead: "Simone Aragão", dia: -3, hora: "15:30", closer: 1, sdr: 1, produto: "black", variante: "semestral", patrimonio: "R$ 100 mil a R$ 300 mil", renda: "R$ 10 mil a R$ 15 mil", urgencia: "6/10 - comparando com outra mentoria", link: "https://meet.google.com/klm-nopq-rst" },
  { lead: "Tiago Bernardes", dia: -1, hora: "11:00", closer: 2, sdr: 2, produto: "private", variante: null, patrimonio: "Acima de R$ 5 milhões", renda: "Acima de R$ 50 mil", urgencia: "9/10 - 52 anos, mora nos EUA, quer estruturar a carteira em dólar", link: "uvw-xyza-bcd" },
  { lead: "Helena Couto", dia: 0, hora: "09:00", closer: 0, sdr: 0, produto: "prime", variante: "semestral", patrimonio: "R$ 1 milhão a R$ 3 milhões", renda: "R$ 30 mil a R$ 50 mil", urgencia: "9/10 - vendeu a empresa e está com o caixa parado", link: "vmf-tfvx-tbo" },
  { lead: "Marcos Paulo Lima", dia: 0, hora: "14:00", closer: 1, sdr: 1, produto: "black", variante: "anual", patrimonio: "R$ 300 mil a R$ 500 mil", renda: "R$ 15 mil a R$ 20 mil", urgencia: "7/10 - já investe sozinho, quer método", link: "https://meet.google.com/efg-hijk-lmn", semClint: true },
  { lead: "Patrícia Vasconcelos", dia: 0, hora: "16:30", closer: 0, sdr: 2, produto: "ninja", variante: "semestral", patrimonio: "Até R$ 100 mil", renda: "R$ 5 mil a R$ 10 mil", urgencia: "5/10 - começando agora, orçamento apertado", link: "opq-rstu-vwx" },
  { lead: "Eduardo Sampaio", dia: 0, hora: "20:00", closer: 2, sdr: 0, produto: "prime", variante: "anual", patrimonio: "R$ 1 milhão a R$ 3 milhões", renda: "R$ 20 mil a R$ 30 mil", urgencia: "8/10 - herança recente, medo de errar", link: "yza-bcde-fgh" },
  { lead: "Larissa Monteiro", dia: 1, hora: "10:30", closer: 0, sdr: 1, produto: "black", variante: "semestral", patrimonio: "R$ 100 mil a R$ 300 mil", renda: "R$ 10 mil a R$ 15 mil", urgencia: null, link: "ijk-lmno-pqr" },
  { lead: "Fábio Antunes", dia: 1, hora: "17:00", closer: 1, sdr: 2, produto: null, variante: null, patrimonio: null, renda: null, urgencia: "sem nota - pediu para falar só depois das 17h", link: null, semClint: true },
  { lead: "Cristina Nóbrega", dia: 2, hora: "11:00", closer: 2, sdr: 0, produto: "private", variante: null, patrimonio: "Acima de R$ 5 milhões", renda: "Acima de R$ 50 mil", urgencia: "10/10 - precisa realocar antes de uma venda de imóvel no dia 15", link: "stu-vwxy-zab" },
  { lead: "Vinícius Tavares", dia: 3, hora: "15:00", closer: 0, sdr: 1, produto: "prime", variante: "semestral", patrimonio: "R$ 500 mil a R$ 1 milhão", renda: "R$ 20 mil a R$ 30 mil", urgencia: "6/10 - esposa participa da decisão", link: "cde-fghi-jkl" },
  { lead: "Aline Pedrosa", dia: 5, hora: "09:30", closer: 1, sdr: 2, produto: "ninja", variante: "anual", patrimonio: "Até R$ 100 mil", renda: "R$ 5 mil a R$ 10 mil", urgencia: "4/10 - curiosa, ainda sem dor clara", link: "mno-pqrs-tuv" },
  { lead: "Rogério Bastos", dia: 8, hora: "14:30", closer: 2, sdr: 0, produto: "black", variante: "anual", patrimonio: "R$ 300 mil a R$ 500 mil", renda: "R$ 15 mil a R$ 20 mil", urgencia: "7/10 - quer sair da renda fixa", link: "wxy-zabc-def" },
  { lead: "Débora Lacerda", dia: 12, hora: "16:00", closer: 0, sdr: 1, produto: "prime", variante: "anual", patrimonio: "R$ 1 milhão a R$ 3 milhões", renda: "R$ 30 mil a R$ 50 mil", urgencia: "8/10 - médica, pouco tempo, quer delegar o método", link: "ghi-jklm-nop" },
  { lead: "Otávio Mendonça", dia: 20, hora: "10:00", closer: 1, sdr: 2, produto: "black", variante: "semestral", patrimonio: "R$ 100 mil a R$ 300 mil", renda: "R$ 10 mil a R$ 15 mil", urgencia: "5/10 - viagem no meio, remarcou duas vezes", link: "qrs-tuvw-xyz" },
];

function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

export type CloserDoMock = { id: string; nome: string };

function item(s: Semente, i: number, hoje: string, closers: readonly CloserDoMock[]) {
  const dia = somarDias(hoje, s.dia);
  const [a, m, d] = dia.split("-");
  const closer = closers[s.closer % closers.length];
  const sdr = SDRS[s.sdr % SDRS.length];
  const seq = String(i + 1).padStart(3, "0");
  return {
    evento_id: `ev-pc-${seq}`,
    deal_id: s.semClint ? null : `deal-pc-${seq}`,
    lead_id: `ld_${String((i % 40) + 1).padStart(4, "0")}`,
    closer_id: closer.id,
    closer_nome: closer.nome,
    lead_nome: s.lead,
    lead_email: `${slug(s.lead)}@exemplo.com`,
    lead_telefone: `+55${["11", "21", "31", "41", "48", "51"][i % 6]}9${String(30000000 + i * 2711).slice(0, 8)}`,
    call_at: `${dia}T${s.hora}:00-03:00`,
    data_br: `${d}/${m}/${a}`,
    hora_br: s.hora,
    urgencia: s.urgencia,
    sdr_nome: sdr.nome,
    link_call: s.link,
    patrimonio: s.patrimonio,
    renda: s.renda,
    produto_indicado: s.produto,
    produto_variante: s.variante,
    link_crm: s.semClint ? null : `https://app.clint.digital/deal/deal-pc-${seq}`,
    etapa_atual: "Primeira Call Agendada",
    agendado_em: `${somarDias(dia, -2)}T13:${String(10 + (i % 40)).padStart(2, "0")}:00-03:00`,
  };
}

export type ParamsMockAgendamentos = {
  de?: string | null;
  ate?: string | null;
  // Escopo: id do closer (closer logado, ou o foco do admin); null = todos.
  closerId?: string | null;
  simular?: string | null;
  agora?: Date;
  // Donos das calls. Padrão: os closers das contas mock. No teste local com
  // login real, o closer logado entra aqui para ter a própria fila.
  closers?: readonly CloserDoMock[];
};

// Closers do mock para a sessão: as contas de demonstração; se quem está
// logado é um closer que NÃO é uma delas (login real), ele assume o lugar do
// primeiro — assim a fila dele não vem vazia no teste local.
export function closersDoMock(user: { id: string; nome: string; role: string }): CloserDoMock[] {
  const demo = CLOSERS.map((c) => ({ id: c.id, nome: c.nome }));
  if (user.role !== "closer" || demo.some((c) => c.id === user.id)) return demo;
  return [{ id: user.id, nome: user.nome }, ...demo.slice(1)];
}

// Corpo no formato da API real. Sem de/ate, de hoje (00:00 de Brasília) em
// diante — a fila de trabalho; com de/ate, a janela inclusiva do calendário.
export function mockAgendamentosPrimeiraCall(p: ParamsMockAgendamentos = {}) {
  const hoje = hojeBR(p.agora ?? new Date());
  const de = p.de ?? null;
  const ate = p.ate ?? null;
  const base = { de: de ?? hoje, ate, gerado_em: (p.agora ?? new Date()).toISOString() };
  if (p.simular === "vazio") return { ...base, total: 0, agendamentos: [] as unknown[] };

  const closers = p.closers && p.closers.length > 0 ? p.closers : CLOSERS;
  const todos = SEMENTES.map((s, i) => item(s, i, hoje, closers)).sort((a, b) => a.call_at.localeCompare(b.call_at));
  const naJanela = todos.filter((a) => {
    const dia = a.call_at.slice(0, 10);
    if (de || ate) return (!de || dia >= de) && (!ate || dia <= ate);
    return dia >= hoje;
  });
  const noEscopo = p.closerId ? naJanela.filter((a) => a.closer_id === p.closerId) : naJanela;

  const agendamentos: unknown[] = [...noEscopo];
  if (p.simular === "invalido") {
    // Dois itens que o adapter tem de descartar sem derrubar a fila.
    agendamentos.splice(1, 0, { evento_id: "ev-quebrado-1", lead_nome: "Sem data da call" });
    agendamentos.push({ evento_id: "ev-quebrado-2", call_at: "amanhã cedo", lead_nome: "Data ilegível" });
  }
  return { ...base, total: agendamentos.length, agendamentos };
}
