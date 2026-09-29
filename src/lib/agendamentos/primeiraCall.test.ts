import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  closersPresentes,
  diaDeDataBr,
  diasDaSemana,
  filtrarPorEscopo,
  gradeDoMes,
  hojeBR,
  intervaloVisivel,
  ordenarPorCall,
  partesBR,
  partesDaUrgencia,
  porDia,
  produtoDoAgendamento,
  proximaCall,
  rotuloDoDia,
  rotuloDoStatus,
  soQueAindaVaoAcontecer,
  somarDias,
  somarMeses,
  statusDaCall,
  tituloDaSemana,
  tituloDoMes,
  urlDaSala,
  veAgendaDeTodos,
  type AgendamentoPrimeiraCall,
} from "./primeiraCall";

// Segunda-feira, 28/09/2026, 13:00 em Brasília.
const AGORA = new Date("2026-09-28T13:00:00-03:00");

function ag(extra: Partial<AgendamentoPrimeiraCall> & { evento_id: string; call_at: string }): AgendamentoPrimeiraCall {
  const partes = partesBR(extra.call_at)!;
  return {
    deal_id: "d",
    lead_id: "l",
    closer_id: "marcio",
    closer_nome: "Marcio",
    lead_nome: `Lead ${extra.evento_id}`,
    lead_email: null,
    lead_telefone: null,
    data_br: partes.dataBr,
    hora_br: partes.horaBr,
    dia: partes.dia,
    urgencia: null,
    sdr_nome: null,
    link_call: null,
    patrimonio: null,
    renda: null,
    produto_indicado: null,
    produto_variante: null,
    link_crm: null,
    etapa_atual: null,
    agendado_em: null,
    ...extra,
  };
}

describe("datas em Brasília", () => {
  it("data_br → dia; formato errado ou data impossível → null", () => {
    expect(diaDeDataBr("22/09/2026")).toBe("2026-09-22");
    expect(diaDeDataBr(" 01/01/2027 ")).toBe("2027-01-01");
    expect(diaDeDataBr("2026-09-22")).toBeNull();
    expect(diaDeDataBr("31/02/2026")).toBeNull();
    expect(diaDeDataBr(null)).toBeNull();
  });

  it("hoje e as partes saem do fuso de Brasília, não do UTC", () => {
    // 01:30 UTC de 29/09 ainda é 22:30 de 28/09 em Brasília.
    expect(hojeBR(new Date("2026-09-29T01:30:00Z"))).toBe("2026-09-28");
    expect(partesBR("2026-09-29T01:30:00Z")).toEqual({ dia: "2026-09-28", dataBr: "28/09/2026", horaBr: "22:30" });
    expect(partesBR("amanhã")).toBeNull();
  });

  it("soma de dias e meses atravessa mês, ano e fim de mês", () => {
    expect(somarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(somarMeses("2026-03-10", -1)).toBe("2026-02-10");
  });
});

describe("calendário", () => {
  it("semana vai de domingo a sábado", () => {
    expect(diasDaSemana("2026-09-28")).toEqual([
      "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
    ]);
  });

  it("grade do mês tem semanas inteiras, com os dias vizinhos", () => {
    const g = gradeDoMes("2026-09-28");
    expect(g).toHaveLength(5);
    expect(g[0][0]).toBe("2026-08-30");
    expect(g[4][6]).toBe("2026-10-03");
    expect(g.every((s) => s.length === 7)).toBe(true);
  });

  it("janela pedida à API = o que está na tela", () => {
    expect(intervaloVisivel("semana", "2026-09-28")).toEqual({ de: "2026-09-27", ate: "2026-10-03" });
    expect(intervaloVisivel("mes", "2026-09-28")).toEqual({ de: "2026-08-30", ate: "2026-10-03" });
  });

  it("títulos e rótulo do dia", () => {
    expect(tituloDoMes("2026-09-28")).toBe("Setembro de 2026");
    expect(tituloDaSemana("2026-09-28")).toBe("27/09 a 03/10");
    expect(rotuloDoDia("2026-09-28", "2026-09-28")).toBe("Hoje");
    expect(rotuloDoDia("2026-09-29", "2026-09-28")).toBe("Amanhã");
    expect(rotuloDoDia("2026-09-27", "2026-09-28")).toBe("Ontem");
    expect(rotuloDoDia("2026-10-02", "2026-09-28")).toBe("sex, 02/10");
  });
});

describe("fila: ordem, status e agrupamento", () => {
  const cedo = ag({ evento_id: "cedo", call_at: "2026-09-28T09:00:00-03:00" });
  const tarde = ag({ evento_id: "tarde", call_at: "2026-09-28T16:30:00-03:00" });
  const amanha = ag({ evento_id: "amanha", call_at: "2026-09-29T10:00:00-03:00" });
  const semana = ag({ evento_id: "semana", call_at: "2026-10-03T10:00:00-03:00" });
  const ontem = ag({ evento_id: "ontem", call_at: "2026-09-27T10:00:00-03:00" });

  it("próxima call no topo; empate mantém a ordem recebida", () => {
    const gemeo = ag({ evento_id: "gemeo", call_at: "2026-09-28T16:30:00-03:00" });
    expect(ordenarPorCall([semana, tarde, amanha, gemeo, cedo]).map((a) => a.evento_id)).toEqual([
      "cedo", "tarde", "gemeo", "amanha", "semana",
    ]);
    expect(proximaCall([semana, cedo, tarde], AGORA)?.evento_id).toBe("tarde");
    expect(proximaCall([cedo, ontem], AGORA)).toBeNull();
  });

  it("call de hoje destacada; call passada diferenciada — sempre com texto", () => {
    expect(statusDaCall(tarde, AGORA)).toBe("hoje");
    expect(rotuloDoStatus(tarde, AGORA)).toBe("Hoje");
    expect(statusDaCall(cedo, AGORA)).toBe("passada");
    expect(rotuloDoStatus(cedo, AGORA)).toBe("Hoje · já passou");
    expect(statusDaCall(ontem, AGORA)).toBe("passada");
    expect(rotuloDoStatus(ontem, AGORA)).toBe("Já passou");
    expect(statusDaCall(amanha, AGORA)).toBe("futura");
    expect(rotuloDoStatus(amanha, AGORA)).toBe("Amanhã");
    expect(rotuloDoStatus(semana, AGORA)).toBe("Em 5 dias");
  });

  it("fila sem as calls que já passaram: hoje cedo e ontem saem; hoje mais tarde e amanhã ficam", () => {
    expect(soQueAindaVaoAcontecer([ontem, cedo, tarde, amanha], AGORA).map((a) => a.evento_id)).toEqual(["tarde", "amanha"]);
    // Exatamente agora ainda conta como "vai acontecer".
    const agoraMesmo = ag({ evento_id: "agora", call_at: "2026-09-28T13:00:00-03:00" });
    expect(soQueAindaVaoAcontecer([agoraMesmo], AGORA)).toHaveLength(1);
  });

  it("agrupa por dia preservando a ordem; porDia indexa o calendário", () => {
    const g = agruparPorDia([cedo, tarde, amanha]);
    expect(g.map((x) => [x.dia, x.itens.map((a) => a.evento_id)])).toEqual([
      ["2026-09-28", ["cedo", "tarde"]],
      ["2026-09-29", ["amanha"]],
    ]);
    expect(porDia([cedo, tarde, amanha]).get("2026-09-28")?.map((a) => a.evento_id)).toEqual(["cedo", "tarde"]);
  });
});

describe("escopo por papel (nada de outro closer vaza)", () => {
  const itens = [
    ag({ evento_id: "1", call_at: "2026-09-28T09:00:00-03:00", closer_id: "marcio", closer_nome: "Marcio" }),
    ag({ evento_id: "2", call_at: "2026-09-28T10:00:00-03:00", closer_id: "giba", closer_nome: "Giba" }),
    ag({ evento_id: "3", call_at: "2026-09-28T11:00:00-03:00", closer_id: null, closer_nome: null }),
  ];
  const ids = (x: AgendamentoPrimeiraCall[]) => x.map((a) => a.evento_id);

  it("closer vê só as próprias; admin e SDR veem a agenda de todos", () => {
    expect(ids(filtrarPorEscopo(itens, { id: "marcio", role: "closer" }))).toEqual(["1"]);
    expect(ids(filtrarPorEscopo(itens, { id: "aurelio", role: "closer" }))).toEqual([]);
    expect(ids(filtrarPorEscopo(itens, { id: "vata", role: "admin" }))).toEqual(["1", "2", "3"]);
    expect(ids(filtrarPorEscopo(itens, { id: "benhur", role: "sdr" }))).toEqual(["1", "2", "3"]);
    expect(veAgendaDeTodos("closer")).toBe(false);
  });

  it("filtro do admin: closers por nome, 'Sem closer' por último", () => {
    expect(closersPresentes(itens).map((c) => [c.chave, c.nome, c.total])).toEqual([
      ["giba", "Giba", 1],
      ["marcio", "Marcio", 1],
      ["sem", "Sem closer", 1],
    ]);
  });
});

describe("exibição", () => {
  it("produto indicado: chave + variante viram rótulo", () => {
    expect(produtoDoAgendamento({ produto_indicado: "prime", produto_variante: "semestral" })).toBe("Prime Semestral");
    expect(produtoDoAgendamento({ produto_indicado: "black", produto_variante: null })).toBe("Black");
    expect(produtoDoAgendamento({ produto_indicado: null, produto_variante: "anual" })).toBeNull();
  });

  it("link da sala: URL como veio, código do Meet vira URL, texto solto não vira link", () => {
    expect(urlDaSala("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(urlDaSala("vmf-tfvx-tbo")).toBe("https://meet.google.com/vmf-tfvx-tbo");
    expect(urlDaSala("meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(urlDaSala("sala do zoom 3")).toBeNull();
    expect(urlDaSala(null)).toBeNull();
    expect(urlDaSala("  ")).toBeNull();
  });

  it("urgência: separa a nota do texto; sem nota, mantém o texto inteiro", () => {
    expect(partesDaUrgencia("9/10 - 52 anos, mora nos EUA")).toEqual({ nota: 9, texto: "52 anos, mora nos EUA" });
    expect(partesDaUrgencia("10/10")).toEqual({ nota: 10, texto: "" });
    expect(partesDaUrgencia("pediu para ligar depois")).toEqual({ nota: null, texto: "pediu para ligar depois" });
    expect(partesDaUrgencia("")).toBeNull();
    expect(partesDaUrgencia(null)).toBeNull();
  });
});
