import { partesBR } from "@/lib/agendamentos/primeiraCall";

// ---------------------------------------------------------------------------
// Mock do GET /api/agendamentos/historico — MESMO formato e mesmas regras do
// backend (montarHistorico): mais recente primeiro, cursor = `agendado_em` do
// último item (a página seguinte é o que foi marcado ANTES dele), `total`
// contado a partir do cursor. Datas relativas à hora cheia atual, para a tela sempre ter
// Hoje/Ontem. Traz os casos que a tela precisa mostrar: ~18% sem data da call,
// 2ª/3ª calls e remarcações (o mesmo lead marcado duas vezes).
// ---------------------------------------------------------------------------

const CLOSERS = [
  { id: "marcio", nome: "Marcio" },
  { id: "giba", nome: "Giba" },
  { id: "aurelio", nome: "Aurelio" },
];
const SDRS = ["Benhur", "Guilherme", "Glaucio"];
const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fernando", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo", "Renata", "Sérgio", "Tatiana", "Vítor"];
const SOBRENOMES = ["Almeida", "Barros", "Cardoso", "Duarte", "Esteves", "Farias", "Gomes", "Hollanda", "Lacerda", "Moura", "Nogueira", "Pires", "Queiroz", "Ribeiro", "Siqueira", "Teixeira"];
const PRODUTOS = ["prime", "black", "ninja", "private", null];
const URGENCIAS = [
  "9/10 - vendeu a empresa e está com o caixa parado",
  "7/10 - já investe sozinho, quer método",
  "8/10 - herança recente, medo de errar",
  "5/10 - começando agora, orçamento apertado",
  "6/10 - esposa participa da decisão",
  null,
];
const ETAPAS = ["1a_call_agendada", "2a_call_agendada", "3a_call_agendada", "4a_call_agendada", "5a_mais_call_agendada"];

// PRNG determinístico: a mesma lista a cada chamada (o cursor depende disso).
function gerador(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

type ItemMock = {
  agendado_em: string;
  agendado_em_br: { data: string; hora: string };
  lead_id: string;
  lead_nome: string;
  lead_email: string;
  lead_telefone: string;
  closer_id: string;
  closer_nome: string;
  sdr_nome: string;
  numero_call: number;
  etapa: string;
  call_at: string | null;
  call_br: { data: string; hora: string } | null;
  urgencia: string | null;
  link_call: string | null;
  produto_indicado: string | null;
  link_crm: string | null;
  origens: string[];
};

function codigoDaSala(n: number): string {
  return Array.from({ length: 4 }, (_, i) => String.fromCharCode(97 + ((n * (i + 3)) % 26))).join("");
}

function br(iso: string) {
  const p = partesBR(iso)!;
  return { data: p.dataBr, hora: p.horaBr };
}

function montar(agora: Date): ItemMock[] {
  const rnd = gerador(20260930);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const itens: ItemMock[] = [];
  const HORA = 3600_000;
  let lead = 0;

  // ~250 agendamentos nas últimas 8 semanas (o mais recente, 25 min atrás) —
  // mais de uma página de 100, para o "carregar mais" ter o que buscar.
  for (let i = 0; i < 400; i++) {
    const atras = 25 * 60_000 + i * 3.4 * HORA + Math.floor(rnd() * 2 * HORA);
    const agendado = new Date(agora.getTime() - atras);
    const hBR = Number(partesBR(agendado.toISOString())!.horaBr.slice(0, 2));
    if (hBR < 8 || hBR > 21) continue; // ninguém agenda de madrugada

    const r = rnd();
    const numero = r < 0.72 ? 1 : r < 0.88 ? 2 : r < 0.95 ? 3 : r < 0.98 ? 4 : 5;
    const semData = rnd() < 0.18;
    const closer = pick(CLOSERS);
    lead += 1;
    const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}`;
    const diasAte = 1 + Math.floor(rnd() * 6);
    const call = new Date(agendado.getTime() + diasAte * 24 * HORA);
    call.setUTCMinutes(rnd() < 0.5 ? 0 : 30, 0, 0);
    const callIso = semData ? null : call.toISOString();
    const slug = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".");

    itens.push({
      agendado_em: agendado.toISOString(),
      agendado_em_br: br(agendado.toISOString()),
      lead_id: `lead-${lead}`,
      lead_nome: nome,
      lead_email: `${slug}@exemplo.com`,
      lead_telefone: `+55 11 9${String(10000000 + lead * 7919).slice(0, 8)}`,
      closer_id: closer.id,
      closer_nome: closer.nome,
      sdr_nome: pick(SDRS),
      numero_call: numero,
      etapa: ETAPAS[numero - 1],
      call_at: callIso,
      call_br: callIso ? br(callIso) : null,
      urgencia: numero === 1 ? pick(URGENCIAS) : null,
      // Código no formato do Meet (xxx-xxxx-xxx), para o botão "Abrir sala" aparecer.
      link_call: semData ? null : `mdc-${codigoDaSala(lead)}-sal`,
      produto_indicado: pick(PRODUTOS),
      link_crm: rnd() < 0.9 ? `https://app.clint.digital/deal/mock-${lead}` : null,
      origens: ["clint", "clint_primeira_call"],
    });
  }

  // Remarcações: a cada 12 itens, o mesmo lead é marcado de novo mais tarde
  // (mesma call, outra data) — aparece duas vezes, como na API real.
  const base = [...itens];
  base.forEach((orig, i) => {
    if (i % 12 !== 5 || !orig.call_at) return;
    const novoAgendado = new Date(Date.parse(orig.agendado_em) + 5 * HORA);
    if (novoAgendado >= agora) return;
    const novaCall = new Date(Date.parse(orig.call_at) + 2 * 24 * HORA);
    itens.push({
      ...orig,
      agendado_em: novoAgendado.toISOString(),
      agendado_em_br: br(novoAgendado.toISOString()),
      call_at: novaCall.toISOString(),
      call_br: br(novaCall.toISOString()),
    });
  });

  return itens.sort((a, b) => b.agendado_em.localeCompare(a.agendado_em));
}

export function mockAgendamentosHistorico(params: {
  de?: string | null;
  ate?: string | null;
  antesDe?: string | null;
  limite?: number;
  numeroCall?: number | null;
  incluirSemData?: boolean;
  simular?: string | null;
  agora?: Date;
}) {
  const gerado_em = new Date().toISOString();
  const vazio = { de: params.de ?? null, ate: params.ate ?? null, total: 0, retornados: 0, proximo_cursor: null, agendamentos: [], gerado_em };
  if (params.simular === "vazio") return vazio;

  const de = params.de ? Date.parse(params.de) : null;
  const ate = params.ate ? Date.parse(params.ate) : null;
  // Âncora na hora cheia: a lista precisa ser a MESMA entre chamadas (como na
  // API real) — senão o cursor e o aviso de "novos" viam os mesmos itens com
  // horários andando a cada segundo.
  const ancora = new Date(params.agora ?? new Date());
  ancora.setUTCMinutes(0, 0, 0);
  const filtrados = montar(ancora).filter((a) => {
    const t = Date.parse(a.agendado_em);
    if (de != null && t < de) return false;
    if (ate != null && t > ate) return false;
    if (params.numeroCall && a.numero_call !== params.numeroCall) return false;
    if (params.incluirSemData === false && !a.call_at) return false;
    return true;
  });
  const cursor = params.antesDe ?? null;
  const restantes = cursor ? filtrados.filter((a) => a.agendado_em < cursor) : filtrados;
  const limite = params.limite ?? 100;
  const pagina = restantes.slice(0, limite);
  return {
    ...vazio,
    total: restantes.length,
    retornados: pagina.length,
    proximo_cursor: restantes.length > pagina.length && pagina.length > 0 ? pagina[pagina.length - 1].agendado_em : null,
    agendamentos: pagina,
  };
}
