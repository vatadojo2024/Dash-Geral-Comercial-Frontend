// ---------------------------------------------------------------------------
// Modo demonstração de GET /api/eventos/comparativo?de&ate (aba "Eventos ao
// Vivo"). Números inventados, no FORMATO e no FORMATO DO HISTÓRICO real do
// contrato final (backend de93b17, docs/eventos-comparativo.md):
//   - os eventos de 03/03 a 24/11 (as terças, mais o WG - 26.06.26, de sexta);
//   - presença NULA antes de agosto (a tag "Participou Xs" já tinha sido
//     apagada e sobraram menos presentes que aplicações), e no 01/09;
//   - agendamento NULO em dois trechos sem 1ª call registrada no Supabase:
//     de 03/03 a 02/06 e de 04/08 a 18/08 (primeiras_calls_na_janela = 0);
//   - base insuficiente (< 50 inscritos) em 28/04, 26/06 e 14/07;
//   - presença APROXIMADA na maioria (um teto) e um único EXATO no fim: o 24/11,
//     com retenção e a janela ainda aberta;
//   - replay só a partir de 15/09; resgate em três eventos (22/09 é nulo: a tag
//     existe, ninguém foi convidado);
//   - um aviso (20/10: agendaram acima de aplicaram ao vivo).
// `simular`: sem_exato | vazio | evento_invalido (os 502/401/403 são do route handler).
// ---------------------------------------------------------------------------

type Etapas = { assistiram: number | null; aplicaram: number; agendaram: number | null };

const BASE_INSUFICIENTE: Record<string, number> = { "2026-04-28": 22, "2026-06-26": 14, "2026-07-14": 31 };
const SEM_CALLS: [string, string][] = [
  ["2026-03-03", "2026-06-02"],
  ["2026-08-04", "2026-08-18"],
];
const RESGATE: Record<string, number> = { "2026-08-18": 96, "2026-09-29": 110, "2026-11-17": 126 };
const EXATO = "2026-11-24";
const INICIO_REPLAY = "2026-09-15";

// As terças de 03/03 a 24/11, mais a sexta 26/06, em ordem de data.
function datas(): string[] {
  const saida: string[] = [];
  for (let d = new Date(Date.UTC(2026, 2, 3)); d <= new Date(Date.UTC(2026, 10, 24)); d.setUTCDate(d.getUTCDate() + 7)) {
    saida.push(d.toISOString().slice(0, 10));
  }
  saida.push("2026-06-26");
  return saida.sort();
}

// Variação determinística (sem Math.random, para a tela não mudar a cada F5).
const onda = (i: number, amplitude: number) => Math.round(Math.sin(i * 1.7) * amplitude);

function tiers(presentes: number): Record<string, number> {
  const fatias: [string, number][] = [
    ["UMQL+", 0.04],
    ["UMQL", 0.07],
    ["HMQL", 0.12],
    ["SMQL", 0.17],
    ["MQL+", 0.16],
    ["MQL", 0.2],
    ["QC", 0.05],
    ["Ninja", 0.03],
  ];
  const saida: Record<string, number> = {};
  let soma = 0;
  for (const [t, f] of fatias) {
    saida[t] = Math.floor(presentes * f);
    soma += saida[t];
  }
  saida.sem_tier = presentes - soma;
  return saida;
}

// Quantos presentes chegaram a cada degrau (5, 15, 30, 45, 75, 105 e 135 min).
function retencao(presentes: number): Record<string, number> {
  const fracoes = [0.96, 0.88, 0.74, 0.63, 0.49, 0.37, 0.22];
  return Object.fromEntries(
    [300, 900, 1800, 2700, 4500, 6300, 8100].map((s, i) => [String(s), Math.round(presentes * fracoes[i])]),
  );
}

const tagDe = (data: string) => {
  const [a, m, d] = data.split("-");
  return `WG - ${d}.${m}.${a.slice(2)}`;
};
const soma = (a: number | null, b: number | null) => (a == null || b == null ? null : a + b);

function eventoDe(data: string, i: number, simular: string | null) {
  const exato = data === EXATO && simular !== "sem_exato";
  const aberta = data === EXATO;
  const inscritos = BASE_INSUFICIENTE[data] ?? 640 + onda(i, 70) + i * 3;
  const semPresenca = data < "2026-08-01" || data === "2026-09-01";
  const semCalls = SEM_CALLS.some(([de, ate]) => data >= de && data <= ate);
  const calls = semCalls ? 0 : aberta ? 41 : 68 + onda(i + 3, 14);

  // A aproximada é um teto (conta quem assistiu a eventos anteriores): ~45%.
  // A exata é medida: mais baixa (~37%).
  const assistiram = semPresenca ? null : Math.round(inscritos * (exato ? 0.37 : 0.45 + onda(i, 3) / 100));
  const aplicaram = Math.max(1, Math.round(inscritos * (0.08 + onda(i + 1, 1) / 100)));
  const agendaram = semCalls ? null : data === "2026-10-20" ? aplicaram + 2 : Math.round(aplicaram * (aberta ? 0.3 : 0.47));

  const comReplay = data >= INICIO_REPLAY;
  const replay = comReplay
    ? (() => {
        const acessaram = Math.round(inscritos * 0.2);
        const rAssistiram = Math.round(acessaram * 0.66);
        const rAplicaram = Math.round(rAssistiram * 0.1);
        return {
          acessaram,
          assistiram: rAssistiram,
          aplicaram: rAplicaram,
          agendaram: aberta ? null : semCalls ? null : Math.round(rAplicaram * 0.45),
        };
      })()
    : null;
  // Janela aberta: o replay ainda nem saiu no 24/11.
  const replayFinal = aberta ? null : replay;

  const aoVivo: Etapas = { assistiram, aplicaram, agendaram };
  const convidados = RESGATE[data];
  const resgate = convidados
    ? {
        convidados,
        assistiram: Math.round(convidados * 0.2),
        aplicaram: Math.round(convidados * 0.05),
        agendaram: semCalls ? null : Math.round(convidados * 0.02),
      }
    : null;

  return {
    data_evento: data,
    tag: tagDe(data),
    modo_presenca: exato ? "exato" : "aproximado",
    janela_fechada: !aberta,
    base_insuficiente: inscritos < 50,
    capturado_em: `${data}T23:40:00.000Z`,
    atualizado_em: `${data}T23:40:00.000Z`,
    inscritos,
    desqualificados: Math.round(inscritos * 0.03),
    primeiras_calls_na_janela: calls,
    ao_vivo: aoVivo,
    replay: replayFinal,
    total: replayFinal
      ? {
          assistiram: soma(assistiram, replayFinal.assistiram),
          aplicaram: aplicaram + replayFinal.aplicaram,
          agendaram: soma(agendaram, replayFinal.agendaram),
        }
      : aoVivo,
    resgate,
    retencao: exato && assistiram != null ? retencao(assistiram) : null,
    presentes_por_tier: assistiram == null ? null : tiers(assistiram),
    avisos: data === "2026-10-20" ? ["ao_vivo_agendaram_acima_de_aplicaram"] : [],
  };
}

export function mockComparativo(de: string | null, ate: string | null, simular: string | null) {
  const eventos =
    simular === "vazio"
      ? []
      : datas()
          .map((d, i) => eventoDe(d, i, simular))
          .filter((e) => (!de || e.data_evento >= de) && (!ate || e.data_evento <= ate));
  if (simular === "evento_invalido") {
    // Dois eventos fora do contrato: a tela os descarta e avisa no console.
    eventos.push({ ...eventoDe("2026-02-24", 0, null), data_evento: "2026-02-24", tag: "WG - 24.02.26", inscritos: -3 });
    eventos.push({ ...eventoDe("2026-02-17", 1, null), data_evento: "2026-02-17", tag: "WG - 17.02.26", modo_presenca: "parcial" });
  }
  return { de, ate, eventos, gerado_em: new Date().toISOString() };
}
