import { describe, expect, it } from "vitest";
import { adaptApiAgendamentosHistorico } from "@/lib/server/apiAgendamentosHistorico";
import { mockAgendamentosHistorico } from "@/lib/mock/agendamentos_historico";
import {
  agruparPorDiaDoAgendamento,
  contarNovos,
  idsRemarcados,
  inicioDoPeriodo,
  juntarPaginas,
  queryDoHistorico,
  rotuloDaCall,
  soPrimeiraCall,
  type ItemHistorico,
} from "./historico";

// Item cru, no formato da API real.
function api(extra: Record<string, unknown> = {}) {
  return {
    agendado_em: "2026-09-30T17:05:00.000Z",
    agendado_em_br: { data: "30/09/2026", hora: "14:05" },
    lead_id: "lead-1",
    lead_nome: "Ana Barros",
    lead_email: "ana@exemplo.com",
    lead_telefone: null,
    closer_id: "u-marcio",
    closer_nome: "Marcio",
    sdr_nome: "Benhur",
    numero_call: 1,
    etapa: "1a_call_agendada",
    call_at: "2026-10-02T17:00:00.000Z",
    call_br: { data: "02/10/2026", hora: "14:00" },
    urgencia: "9/10 - quer decidir logo",
    link_call: "abc-defg-hij",
    produto_indicado: "prime",
    link_crm: null,
    origens: ["clint", "clint_primeira_call"],
    ...extra,
  };
}

function adaptar(itens: unknown[], envelope: Record<string, unknown> = {}) {
  const r = adaptApiAgendamentosHistorico({
    de: null,
    ate: null,
    total: itens.length,
    retornados: itens.length,
    proximo_cursor: null,
    agendamentos: itens,
    gerado_em: "2026-09-30T18:00:00Z",
    ...envelope,
  });
  if (!r.ok) throw new Error(r.motivo);
  return r.resposta;
}

describe("adapter do histórico", () => {
  it("usa agendado_em_br e call_br COMO VIERAM — não reconverte (sem somar 3h de novo)", () => {
    const [a] = adaptar([api()]).agendamentos;
    expect(a.agendado_data).toBe("30/09/2026");
    expect(a.agendado_hora).toBe("14:05");
    expect(a.dia_agendamento).toBe("2026-09-30");
    expect(a.call_hora).toBe("14:00");
    expect(a.dia_call).toBe("2026-10-02");
  });

  it("call_br nulo = sem data: o item fica, com os campos da call nulos", () => {
    const [a] = adaptar([api({ call_at: null, call_br: null })]).agendamentos;
    expect(a.call_at).toBeNull();
    expect(a.call_data).toBeNull();
    expect(a.dia_call).toBeNull();
    expect(a.lead_nome).toBe("Ana Barros");
  });

  it("mantém a ordem da API e o cursor; item ilegível é descartado sem derrubar a página", () => {
    const r = adaptar(
      [
        api({ agendado_em: "2026-09-30T18:00:00Z", agendado_em_br: { data: "30/09/2026", hora: "15:00" } }),
        { lead_nome: "sem data de agendamento" },
        api(),
      ],
      { total: 250, proximo_cursor: "2026-09-30T17:05:00.000Z" },
    );
    expect(r.agendamentos.map((a) => a.agendado_hora)).toEqual(["15:00", "14:05"]);
    expect(r.descartados).toBe(1);
    expect(r.total).toBe(250);
    expect(r.proximo_cursor).toBe("2026-09-30T17:05:00.000Z");
  });

  it("remarcação vem duas vezes e as duas ficam (ids diferentes)", () => {
    const r = adaptar([
      api({ agendado_em: "2026-09-30T19:00:00Z", call_at: "2026-10-04T17:00:00Z", call_br: { data: "04/10/2026", hora: "14:00" } }),
      api(),
    ]);
    expect(r.agendamentos).toHaveLength(2);
    expect(new Set(r.agendamentos.map((a) => a.id)).size).toBe(2);
  });

  it("numero_call ausente sai da etapa", () => {
    const [a] = adaptar([api({ numero_call: null, etapa: "3a_call_agendada" })]).agendamentos;
    expect(a.numero_call).toBe(3);
  });
});

describe("regras da tela", () => {
  const itens = (): ItemHistorico[] =>
    adaptar([
      api({ agendado_em: "2026-09-30T19:00:00Z", agendado_em_br: { data: "30/09/2026", hora: "16:00" }, call_at: "2026-10-04T17:00:00Z", call_br: { data: "04/10/2026", hora: "14:00" } }),
      api(),
      api({ lead_id: "lead-2", agendado_em: "2026-09-29T13:00:00Z", agendado_em_br: { data: "29/09/2026", hora: "10:00" }, numero_call: 2, etapa: "2a_call_agendada" }),
    ]).agendamentos;

  it("agrupa pelo dia do agendamento, na ordem recebida", () => {
    expect(agruparPorDiaDoAgendamento(itens()).map((g) => [g.dia, g.itens.length])).toEqual([
      ["2026-09-30", 2],
      ["2026-09-29", 1],
    ]);
  });

  it("sinaliza como remarcação só o agendamento MAIS RECENTE do mesmo lead e mesma call", () => {
    const lista = itens();
    expect([...idsRemarcados(lista)]).toEqual([lista[0].id]);
  });

  it("junta as páginas sem repetir item", () => {
    const lista = itens();
    expect(juntarPaginas([{ agendamentos: lista.slice(0, 2) }, { agendamentos: lista.slice(1) }])).toHaveLength(3);
  });

  it("novos = só o que caiu DEPOIS do topo (a consulta é inclusiva)", () => {
    const lista = itens();
    expect(contarNovos(lista, lista[0].agendado_em)).toBe(0);
    expect(contarNovos(lista, "2026-09-30T17:30:00Z")).toBe(1);
    expect(contarNovos(lista, null)).toBe(0);
  });

  it("período começa às 00:00 de Brasília; 'tudo' não manda de", () => {
    expect(inicioDoPeriodo("hoje", "2026-09-30")).toBe("2026-09-30T00:00:00-03:00");
    expect(inicioDoPeriodo("7d", "2026-09-30")).toBe("2026-09-24T00:00:00-03:00");
    expect(inicioDoPeriodo("tudo", "2026-09-30")).toBeNull();
  });

  it("querystring só leva o que foi escolhido (cursor em antes_de)", () => {
    expect(queryDoHistorico({})).toBe("");
    expect(queryDoHistorico({ antesDe: "2026-09-30T17:05:00Z", numeroCall: 2, incluirSemData: false, limite: 100 })).toBe(
      "antes_de=2026-09-30T17%3A05%3A00Z&limite=100&numero_call=2&incluir_sem_data=false",
    );
  });

  it("rótulo da call", () => {
    expect(rotuloDaCall(1)).toBe("1ª call");
    expect(rotuloDaCall(5)).toBe("5ª+ call");
    expect(rotuloDaCall(null)).toBeNull();
  });
});

describe("só primeira call (pedido 02/10)", () => {
  it("2ª call em diante e item sem número nunca passam; o cursor e o total da API ficam", () => {
    const r = adaptar(
      [
        api({ agendado_em: "2026-09-30T19:00:00Z" }),
        api({ agendado_em: "2026-09-30T18:00:00Z", numero_call: 2, etapa: "2a_call_agendada" }),
        api({ agendado_em: "2026-09-30T17:30:00Z", numero_call: null, etapa: "fechado" }),
        api(),
      ],
      { total: 120, proximo_cursor: "2026-09-30T17:05:00.000Z" },
    );
    const so = soPrimeiraCall(r);
    expect(so.agendamentos.map((a) => a.numero_call)).toEqual([1, 1]);
    expect(so.retornados).toBe(2);
    expect(so.total).toBe(120);
    expect(so.proximo_cursor).toBe("2026-09-30T17:05:00.000Z");
  });
});

describe("mock do histórico segue as regras do backend", () => {
  const agora = new Date("2026-09-30T18:00:00Z");

  it("mais recente primeiro; o cursor leva à página seguinte sem repetir nem pular", () => {
    const p1 = mockAgendamentosHistorico({ limite: 40, agora });
    const p2 = mockAgendamentosHistorico({ limite: 40, antesDe: p1.proximo_cursor, agora });
    const todos = mockAgendamentosHistorico({ limite: 500, agora });
    expect(p1.agendamentos.map((a) => a.agendado_em)).toEqual(todos.agendamentos.slice(0, 40).map((a) => a.agendado_em));
    expect(p2.agendamentos.map((a) => a.agendado_em)).toEqual(todos.agendamentos.slice(40, 80).map((a) => a.agendado_em));
    expect(p2.total).toBe(todos.total - 40);
  });

  it("tem itens sem data, 2ª+ call e remarcação; os filtros funcionam", () => {
    const todos = mockAgendamentosHistorico({ limite: 500, agora }).agendamentos;
    expect(todos.some((a) => a.call_br === null)).toBe(true);
    expect(todos.some((a) => a.numero_call >= 2)).toBe(true);
    expect(idsRemarcados(adaptar(todos).agendamentos).size).toBeGreaterThan(0);
    const soSegundas = mockAgendamentosHistorico({ limite: 500, numeroCall: 2, agora }).agendamentos;
    expect(soSegundas.every((a) => a.numero_call === 2)).toBe(true);
    const comData = mockAgendamentosHistorico({ limite: 500, incluirSemData: false, agora }).agendamentos;
    expect(comData.every((a) => a.call_br !== null)).toBe(true);
  });
});
