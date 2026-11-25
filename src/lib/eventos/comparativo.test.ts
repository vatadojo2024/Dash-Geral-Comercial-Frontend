import { afterEach, describe, expect, it, vi } from "vitest";
import { mockComparativo } from "@/lib/mock/eventos_comparativo";
import {
  adaptarComparativo,
  comparacaoComMedia,
  ContratoComparativoError,
  curvasDeRetencao,
  DICA_MODOS_DIFERENTES,
  dicaAgendamentoNulo,
  eventoAnterior,
  eventoPadrao,
  mediaDaMetrica,
  mediaParaComparar,
  podeVerEventosAoVivo,
  sentidoDaVariacao,
  serieDeTendencia,
  taxa,
  taxasAoVivo,
  taxasDoBloco,
  textoDaTaxa,
  textoDaVariacao,
  tiersDoEvento,
  variacaoColorivel,
  variacaoContraAnterior,
  type Evento,
} from "./comparativo";

// Um evento válido pelo contrato final (backend de93b17), com os campos que o
// teste quiser trocar.
function bruto(over: Record<string, unknown> = {}) {
  return {
    data_evento: "2026-11-17",
    tag: "WG - 17.11.26",
    modo_presenca: "aproximado",
    janela_fechada: true,
    base_insuficiente: false,
    capturado_em: null,
    atualizado_em: null,
    inscritos: 200,
    desqualificados: 5,
    primeiras_calls_na_janela: 40,
    ao_vivo: { assistiram: 100, aplicaram: 20, agendaram: 10 },
    replay: null,
    total: { assistiram: 100, aplicaram: 20, agendaram: 10 },
    resgate: null,
    retencao: null,
    presentes_por_tier: null,
    avisos: [],
    ...over,
  };
}
const ev = (over: Record<string, unknown> = {}): Evento =>
  adaptarComparativo({ de: null, ate: null, gerado_em: "x", eventos: [bruto(over)] }).eventos[0];

// Série do mais recente ao mais antigo, como a tela usa.
function serie(...linhas: Record<string, unknown>[]): Evento[] {
  return adaptarComparativo({ de: null, ate: null, gerado_em: "x", eventos: linhas.map(bruto) }).eventos;
}

afterEach(() => vi.restoreAllMocks());

describe("taxa", () => {
  it("divide e dá a porcentagem", () => {
    expect(taxa(25, 100)).toEqual({ tipo: "pct", valor: 25 });
    expect(textoDaTaxa(taxa(1, 3)).texto).toBe("33%");
    expect(textoDaTaxa(taxa(1, 20)).texto).toBe("5,0%");
  });

  it("numerador ou denominador nulo: travessão com 'não medido neste evento', nunca 0%", () => {
    for (const t of [taxa(null, 100), taxa(10, null), taxa(undefined, undefined)]) {
      expect(t).toEqual({ tipo: "nao_medido" });
      expect(textoDaTaxa(t)).toEqual({ texto: "—", dica: "não medido neste evento", alerta: false });
    }
  });

  it("denominador zero: travessão, nunca 0%", () => {
    expect(taxa(0, 0)).toEqual({ tipo: "sem_base" });
    expect(textoDaTaxa(taxa(0, 0)).texto).toBe("—");
  });

  it("acima de 100%: alerta, nunca o número", () => {
    const t = textoDaTaxa(taxa(46, 40));
    expect(t.alerta).toBe(true);
    expect(t.texto).not.toMatch(/\d/);
  });
});

describe("regras de cada taxa", () => {
  const e = ev({
    inscritos: 400,
    ao_vivo: { assistiram: 200, aplicaram: 50, agendaram: 20 },
    replay: { acessaram: 80, assistiram: 40, aplicaram: 8, agendaram: 2 },
    total: { assistiram: 240, aplicaram: 58, agendaram: 22 },
    resgate: { convidados: 100, assistiram: 25, aplicaram: 5, agendaram: 1 },
  });

  it("presença = assistiram ao vivo ÷ inscritos; levantaram = aplicaram ÷ assistiram; agendamento = agendaram ÷ aplicaram", () => {
    const t = taxasAoVivo(e);
    expect(t.presenca).toEqual({ tipo: "pct", valor: 50 });
    expect(t.levantaram).toEqual({ tipo: "pct", valor: 25 });
    expect(t.agendamento).toEqual({ tipo: "pct", valor: 40 });
  });

  it("replay: assistiram ÷ acessaram e aplicaram ÷ assistiram; agendamento em cada bloco", () => {
    const b = taxasDoBloco(e);
    expect(b.replay.assistiram).toEqual({ tipo: "pct", valor: 50 });
    expect(b.replay.aplicaram).toEqual({ tipo: "pct", valor: 20 });
    expect(b.replay.agendaram).toEqual({ tipo: "pct", valor: 25 });
    expect(b.total.agendaram.tipo).toBe("pct");
  });

  it("resgate: cada degrau sobre o anterior, a partir dos convidados", () => {
    const b = taxasDoBloco(e);
    expect(b.resgate.assistiram).toEqual({ tipo: "pct", valor: 25 });
    expect(b.resgate.aplicaram).toEqual({ tipo: "pct", valor: 20 });
    expect(b.resgate.agendaram).toEqual({ tipo: "pct", valor: 20 });
  });

  it("bloco nulo (sem replay, sem resgate): travessão, nunca 0%", () => {
    const b = taxasDoBloco(ev());
    expect(b.replay.assistiram.tipo).toBe("nao_medido");
    expect(b.resgate.assistiram.tipo).toBe("nao_medido");
  });

  it("presença nula: presença e levantaram viram travessão", () => {
    const t = taxasAoVivo(ev({ ao_vivo: { assistiram: null, aplicaram: 20, agendaram: 10 } }));
    expect(t.presenca.tipo).toBe("nao_medido");
    expect(t.levantaram.tipo).toBe("nao_medido");
    expect(t.agendamento.tipo).toBe("pct");
  });

  it("agendaram nulo com a janela fechada e zero 1ªs calls: a dica diz o motivo", () => {
    const semCalls = ev({ primeiras_calls_na_janela: 0, ao_vivo: { assistiram: 100, aplicaram: 20, agendaram: null } });
    expect(taxasAoVivo(semCalls).agendamento.tipo).toBe("nao_medido");
    expect(dicaAgendamentoNulo(semCalls)).toBe("não medido neste evento: nenhuma 1ª call registrada na janela");
    expect(dicaAgendamentoNulo(ev())).toBe("não medido neste evento");
  });
});

describe("média (sobre os eventos na tela)", () => {
  it("só janela fechada e base suficiente; nulos ficam de fora; conta quantos entraram", () => {
    const es = serie(
      { data_evento: "2026-11-24", janela_fechada: false, ao_vivo: { assistiram: 10, aplicaram: 10, agendaram: 0 } },
      { data_evento: "2026-11-17", ao_vivo: { assistiram: 100, aplicaram: 20, agendaram: 10 } },
      { data_evento: "2026-11-10", ao_vivo: { assistiram: 100, aplicaram: 40, agendaram: null } },
      { data_evento: "2026-11-03", inscritos: 20, base_insuficiente: true, ao_vivo: { assistiram: 10, aplicaram: 10, agendaram: 10 } },
      { data_evento: "2026-10-27", ao_vivo: { assistiram: null, aplicaram: 30, agendaram: 6 } },
    );
    // levantaram: 20% (17/11) e 40% (10/11); 24/11 aberto, 03/11 base insuficiente, 27/10 sem presença.
    expect(mediaDaMetrica(es, "levantaram", "aproximado")).toEqual({ valor: 30, eventos: 2 });
    // agendamento: 50% (17/11) e 20% (27/10); 10/11 é nulo.
    expect(mediaDaMetrica(es, "agendamento", null)).toEqual({ valor: 35, eventos: 2 });
    // contagem: assistiram 100 e 100 (27/10 nulo).
    expect(mediaDaMetrica(es, "assistiram", "aproximado")).toEqual({ valor: 100, eventos: 2 });
  });

  it("muda com o recorte na tela: a média dos 2 mais recentes não é a dos 4", () => {
    const es = serie(
      { data_evento: "2026-11-24", inscritos: 300 },
      { data_evento: "2026-11-17", inscritos: 100 },
      { data_evento: "2026-11-10", inscritos: 1000 },
      { data_evento: "2026-11-03", inscritos: 1000 },
    );
    expect(mediaDaMetrica(es.slice(0, 2), "inscritos", null)).toEqual({ valor: 200, eventos: 2 });
    expect(mediaDaMetrica(es, "inscritos", null)).toEqual({ valor: 600, eventos: 4 });
    expect(comparacaoComMedia(es.slice(0, 2), es[0], "inscritos")).toEqual({ tipo: "pct", valor: 50 });
  });

  it("sem evento com dado: média nula, comparação com travessão", () => {
    const es = serie({ janela_fechada: false });
    expect(mediaDaMetrica(es, "presenca", "aproximado").valor).toBeNull();
    expect(comparacaoComMedia(es, es[0], "presenca").tipo).toBe("indisponivel");
  });
});

describe("exata × aproximada não se comparam", () => {
  // 24/11 exato logo depois de 17/11 aproximado (o caso real).
  const es = serie(
    { data_evento: "2026-11-24", modo_presenca: "exato", inscritos: 400, ao_vivo: { assistiram: 148, aplicaram: 32, agendaram: 14 } },
    { data_evento: "2026-11-17", inscritos: 380, ao_vivo: { assistiram: 175, aplicaram: 30, agendaram: 14 } },
    { data_evento: "2026-11-10", inscritos: 360, ao_vivo: { assistiram: 160, aplicaram: 28, agendaram: 13 } },
  );
  const [e24, e17] = es;

  it("variação contra o anterior: travessão nas métricas de presença, com a dica", () => {
    for (const chave of ["presenca", "assistiram", "levantaram"] as const) {
      expect(variacaoContraAnterior(es, e24, chave)).toEqual({ tipo: "indisponivel", motivo: DICA_MODOS_DIFERENTES });
    }
    expect(DICA_MODOS_DIFERENTES).toBe("medições diferentes: exata × aproximada");
  });

  it("as demais métricas seguem comparando", () => {
    expect(variacaoContraAnterior(es, e24, "inscritos")).toEqual({ tipo: "pct", valor: (20 / 380) * 100 });
    expect(variacaoContraAnterior(es, e24, "aplicaram").tipo).toBe("pct");
    expect(variacaoContraAnterior(es, e24, "agendamento").tipo).toBe("pp");
  });

  it("mesmo modo compara normalmente", () => {
    expect(variacaoContraAnterior(es, e17, "presenca").tipo).toBe("pp");
  });

  it("média: só o mesmo modo; sem outro evento do modo, travessão", () => {
    expect(comparacaoComMedia(es, e24, "presenca")).toEqual({
      tipo: "indisponivel",
      motivo: "sem outros eventos com presença exata na tela",
    });
    // 17/11 aproximado: média de 17/11 e 10/11 (o exato fica de fora).
    expect(mediaParaComparar(es, e17, "presenca")).toEqual({ valor: (175 / 380 + 160 / 360) * 50, eventos: 2, motivo: null });
    // Métrica que não depende da presença: entram os três.
    expect(mediaParaComparar(es, e24, "inscritos").eventos).toBe(3);
  });

  it("gráfico: cada modo na sua linha, nunca ligando exato a aproximado", () => {
    const s = serieDeTendencia(es, "presenca");
    expect(s.map((p) => [p.valorAproximado, p.valorExato])).toEqual([
      [(160 / 360) * 100, null],
      [(175 / 380) * 100, null],
      [null, 37],
    ]);
    // Métrica sem presença: uma linha só.
    expect(serieDeTendencia(es, "inscritos").every((p) => p.valorExato == null && p.valorAproximado == null)).toBe(true);
  });
});

describe("variação contra o evento anterior", () => {
  const es = serie(
    { data_evento: "2026-11-24", inscritos: 220, ao_vivo: { assistiram: 110, aplicaram: 22, agendaram: 11 } },
    { data_evento: "2026-11-17", inscritos: 200, ao_vivo: { assistiram: 100, aplicaram: 20, agendaram: 10 } },
    { data_evento: "2026-11-10", inscritos: 30, base_insuficiente: true, ao_vivo: { assistiram: 10, aplicaram: 1, agendaram: 0 } },
    { data_evento: "2026-11-03", inscritos: 250, ao_vivo: { assistiram: null, aplicaram: 20, agendaram: 10 } },
    { data_evento: "2026-10-27", inscritos: 250, ao_vivo: { assistiram: 125, aplicaram: 25, agendaram: 10 } },
  );
  const [e24, e17, e10, e03] = es;

  it("contagem em %, taxa em p.p.", () => {
    expect(variacaoContraAnterior(es, e24, "inscritos")).toEqual({ tipo: "pct", valor: 10 });
    expect(textoDaVariacao(variacaoContraAnterior(es, e24, "inscritos"))).toBe("+10%");
    expect(variacaoContraAnterior(es, e24, "presenca")).toEqual({ tipo: "pp", valor: 0 });
    expect(textoDaVariacao({ tipo: "pp", valor: -2.5 })).toBe("−2,5 p.p.");
    // O que arredonda para zero não tem sinal nem cor de queda.
    expect(textoDaVariacao({ tipo: "pp", valor: -0.04 })).toBe("0,0 p.p.");
    expect(sentidoDaVariacao({ tipo: "pp", valor: -0.04 })).toBe(0);
    expect(sentidoDaVariacao({ tipo: "pct", valor: -12.3 })).toBe(-1);
  });

  it("pula o evento de base insuficiente", () => {
    expect(eventoAnterior(es, e17)?.data_evento).toBe("2026-11-03");
  });

  it("anterior sem o dado: travessão, sem buscar um evento mais antigo", () => {
    const v = variacaoContraAnterior(es, e17, "presenca");
    expect(v).toEqual({ tipo: "indisponivel", motivo: "o evento anterior não tem este dado" });
    expect(variacaoContraAnterior(es, e17, "inscritos").tipo).toBe("pct");
  });

  it("o próprio evento sem o dado, ou de base insuficiente, ou o primeiro: travessão", () => {
    expect(variacaoContraAnterior(es, e03, "presenca").tipo).toBe("indisponivel");
    expect(variacaoContraAnterior(es, e10, "inscritos").tipo).toBe("indisponivel");
    expect(variacaoContraAnterior(es, es[4], "inscritos")).toEqual({
      tipo: "indisponivel",
      motivo: "sem evento anterior no período",
    });
  });

  it("janela aberta: a variação do agendamento não é pintada como queda", () => {
    const aberto = ev({ janela_fechada: false });
    expect(variacaoColorivel(aberto, "agendamento")).toBe(false);
    expect(variacaoColorivel(aberto, "agendaram")).toBe(false);
    expect(variacaoColorivel(aberto, "presenca")).toBe(true);
    expect(variacaoColorivel(ev(), "agendamento")).toBe(true);
  });
});

describe("gráfico de tendência", () => {
  it("evento sem o dado vira vão (null), nunca zero; base insuficiente fica fora; do mais antigo ao mais recente", () => {
    const es = serie(
      { data_evento: "2026-11-24" },
      { data_evento: "2026-11-17", ao_vivo: { assistiram: null, aplicaram: 20, agendaram: 10 } },
      { data_evento: "2026-11-10", inscritos: 12, base_insuficiente: true },
      { data_evento: "2026-11-03", replay: { acessaram: 0, assistiram: 0, aplicaram: 0, agendaram: 0 } },
    );
    const s = serieDeTendencia(es, "presenca");
    expect(s.map((p) => p.data)).toEqual(["2026-11-03", "2026-11-17", "2026-11-24"]);
    expect(s.map((p) => p.valor)).toEqual([50, null, 50]);
    expect(s.map((p) => p.valorAproximado)).toEqual([50, null, 50]);
  });

  it("taxa acima de 100% também é vão no gráfico", () => {
    const es = serie({ ao_vivo: { assistiram: 40, aplicaram: 46, agendaram: 20 } });
    expect(serieDeTendencia(es, "levantaram")[0].valor).toBeNull();
  });
});

describe("contrato final (de93b17)", () => {
  it("descarta e loga o evento inválido sem derrubar os outros", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = adaptarComparativo({
      de: null,
      ate: null,
      gerado_em: "x",
      eventos: [bruto(), bruto({ data_evento: "2026-11-10", tag: "WG - 10.11.26", modo_presenca: "parcial" }), { lixo: true }],
    });
    expect(r.eventos).toHaveLength(1);
    expect(r.descartados).toBe(2);
    expect(aviso).toHaveBeenCalledTimes(2);
    expect(aviso.mock.calls[0][0]).toContain("WG - 10.11.26");
  });

  it("envelope fora do contrato é erro (não há o que mostrar)", () => {
    expect(() => adaptarComparativo({ eventos: "x" })).toThrow(ContratoComparativoError);
  });

  it("aceita os nulos do contrato: assistiram, agendaram, tiers, replay, resgate, retenção", () => {
    const e = ev({
      ao_vivo: { assistiram: null, aplicaram: 1, agendaram: null },
      total: { assistiram: null, aplicaram: 1, agendaram: null },
      replay: { acessaram: 10, assistiram: 5, aplicaram: 1, agendaram: null },
      resgate: { convidados: 10, assistiram: 2, aplicaram: 1, agendaram: null },
    });
    expect(e.ao_vivo.assistiram).toBeNull();
    expect(e.replay?.agendaram).toBeNull();
  });

  it("recusa o que o contrato diz que nunca é nulo ou ausente", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const casos = [
      bruto({ ao_vivo: { assistiram: 100, aplicaram: null, agendaram: 10 } }),
      bruto({ base_insuficiente: undefined }),
      bruto({ primeiras_calls_na_janela: null }),
      bruto({ replay: { acessaram: null, assistiram: 1, aplicaram: 1, agendaram: 1 } }),
    ];
    const r = adaptarComparativo({ de: null, ate: null, gerado_em: "x", eventos: casos });
    expect(r.eventos).toHaveLength(0);
    expect(r.descartados).toBe(4);
  });

  it("base_insuficiente vem do backend (a tela não recalcula pelos inscritos)", () => {
    expect(ev({ inscritos: 31, base_insuficiente: true }).base_insuficiente).toBe(true);
    expect(ev({ inscritos: 31, base_insuficiente: false }).base_insuficiente).toBe(false);
  });

  it("ordena do mais recente ao mais antigo; o padrão é o mais recente com base suficiente", () => {
    const es = serie(
      { data_evento: "2026-11-10" },
      { data_evento: "2026-11-24", inscritos: 20, base_insuficiente: true },
      { data_evento: "2026-11-17" },
    );
    expect(es.map((e) => e.data_evento)).toEqual(["2026-11-24", "2026-11-17", "2026-11-10"]);
    expect(eventoPadrao(es)?.data_evento).toBe("2026-11-17");
  });
});

describe("retenção e tiers", () => {
  it("curva só dos eventos exatos, em % dos presentes ao vivo", () => {
    const es = serie(
      { data_evento: "2026-11-24", modo_presenca: "exato", retencao: { "300": 90, "900": 80, "8100": 10 } },
      { data_evento: "2026-11-17", retencao: { "300": 50 } },
    );
    const c = curvasDeRetencao(es);
    expect(c).toHaveLength(1);
    expect(c[0].pontos).toEqual([90, 80, null, null, null, null, 10]);
  });

  it("SMQL ou acima = SMQL + HMQL + UMQL + UMQL+; presença nula → null", () => {
    const t = tiersDoEvento(
      ev({ presentes_por_tier: { "UMQL+": 1, UMQL: 2, HMQL: 3, SMQL: 4, "MQL+": 5, MQL: 6, QC: 0, Ninja: 0, sem_tier: 79 } }),
    );
    expect(t?.smqlOuAcima).toBe(10);
    expect(t?.taxaSmqlOuAcima).toEqual({ tipo: "pct", valor: 10 });
    expect(t?.linhas[0].tier).toBe("UMQL+");
    expect(tiersDoEvento(ev())).toBeNull();
  });
});

describe("mock (formato do histórico real)", () => {
  const r = adaptarComparativo(mockComparativo(null, null, null));
  const por = (d: string) => r.eventos.find((e) => e.data_evento === d)!;

  it("é válido pelo contrato e vai de 03/03 a 24/11, com o 26/06", () => {
    expect(r.descartados).toBe(0);
    expect(r.eventos.at(-1)?.data_evento).toBe("2026-03-03");
    expect(r.eventos[0].data_evento).toBe("2026-11-24");
    expect(por("2026-06-26")).toBeDefined();
  });

  it("presença nula antes de agosto", () => {
    const antes = r.eventos.filter((e) => e.data_evento < "2026-08-01");
    expect(antes.length).toBeGreaterThan(0);
    expect(antes.every((e) => e.ao_vivo.assistiram === null && e.presentes_por_tier === null)).toBe(true);
    expect(por("2026-08-25").ao_vivo.assistiram).not.toBeNull();
  });

  it("agendamento nulo nos dois trechos sem 1ª call, e só neles", () => {
    const nulos = r.eventos.filter((e) => e.ao_vivo.agendaram === null).map((e) => e.data_evento);
    const dentro = (d: string) => (d >= "2026-03-03" && d <= "2026-06-02") || (d >= "2026-08-04" && d <= "2026-08-18");
    expect(nulos.length).toBeGreaterThan(0);
    expect(nulos.every(dentro)).toBe(true);
    expect(nulos).toContain("2026-08-11");
    expect(r.eventos.filter((e) => dentro(e.data_evento)).every((e) => e.primeiras_calls_na_janela === 0)).toBe(true);
  });

  it("aproximado na maioria e um único exato no fim; base insuficiente nos três casos reais", () => {
    const exatos = r.eventos.filter((e) => e.modo_presenca === "exato");
    expect(exatos.map((e) => e.data_evento)).toEqual(["2026-11-24"]);
    expect(curvasDeRetencao(r.eventos)).toHaveLength(1);
    expect(r.eventos.filter((e) => e.base_insuficiente).map((e) => e.data_evento).sort()).toEqual([
      "2026-04-28",
      "2026-06-26",
      "2026-07-14",
    ]);
  });

  it("simular=evento_invalido: os inválidos saem, o resto fica", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const inv = adaptarComparativo(mockComparativo(null, null, "evento_invalido"));
    expect(inv.descartados).toBe(2);
    expect(inv.eventos).toHaveLength(r.eventos.length);
  });
});

describe("acesso", () => {
  it("só o admin vê a aba", () => {
    expect(podeVerEventosAoVivo("admin")).toBe(true);
    for (const p of ["closer", "sdr", "marketing", "educacional"] as const) expect(podeVerEventosAoVivo(p)).toBe(false);
    expect(podeVerEventosAoVivo(null)).toBe(false);
  });
});
