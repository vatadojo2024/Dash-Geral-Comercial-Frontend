import { describe, expect, it, vi } from "vitest";
import { AgendamentosPrimeiraCallResponseSchema } from "@/lib/agendamentos/primeiraCall";
import { closersDoMock, mockAgendamentosPrimeiraCall } from "@/lib/mock/agendamentos_primeira_call";
import { adaptApiAgendamentosPrimeiraCall } from "./apiAgendamentosPrimeiraCall";

// Payload no formato REAL de GET /api/agendamentos/primeira-call
// (DOCUMENTACAO-FRONT.md do backend): { de, ate, total, agendamentos, gerado_em }.
const ITEM_REAL = {
  evento_id: "ev-1",
  deal_id: "deal-1",
  lead_id: "lead-uuid-1",
  closer_id: "closer-uuid-1",
  closer_nome: "Marcio",
  lead_nome: "Helena Couto",
  lead_email: "helena@exemplo.com",
  lead_telefone: "+5511999990000",
  call_at: "2026-09-28T14:00:00-03:00",
  data_br: "28/09/2026",
  hora_br: "14:00",
  urgencia: "9/10 - 52 anos, mora nos EUA...",
  sdr_nome: "Benhur",
  link_call: "vmf-tfvx-tbo",
  patrimonio: "R$ 1 milhão a R$ 3 milhões",
  renda: "R$ 30 mil a R$ 50 mil",
  produto_indicado: "prime",
  produto_variante: "semestral",
  link_crm: "https://app.clint.digital/deal/deal-1",
  etapa_atual: "Primeira Call Agendada",
  agendado_em: "2026-09-26T13:10:00-03:00",
};
const envelope = (agendamentos: unknown[]) => ({
  de: "2026-09-28",
  ate: null,
  total: agendamentos.length,
  agendamentos,
  gerado_em: "2026-09-28T12:00:00Z",
});

describe("adaptApiAgendamentosPrimeiraCall", () => {
  it("aceita o contrato real e produz itens válidos para o app, com o dia derivado de data_br", () => {
    const r = adaptApiAgendamentosPrimeiraCall(envelope([ITEM_REAL]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(AgendamentosPrimeiraCallResponseSchema.safeParse(r.resposta).success).toBe(true);
    expect(r.resposta.total).toBe(1);
    expect(r.resposta.descartados).toBe(0);
    expect(r.resposta.agendamentos[0]).toMatchObject({
      evento_id: "ev-1",
      dia: "2026-09-28",
      data_br: "28/09/2026",
      hora_br: "14:00",
      link_crm: "https://app.clint.digital/deal/deal-1",
    });
  });

  it("agendamento sem link_crm e sem deal_id segue na fila, com os campos nulos", () => {
    const r = adaptApiAgendamentosPrimeiraCall(envelope([{ ...ITEM_REAL, link_crm: null, deal_id: null }]));
    expect(r.ok && r.resposta.agendamentos[0]).toMatchObject({ link_crm: null, deal_id: null, lead_nome: "Helena Couto" });
  });

  it("campos opcionais ausentes ou vazios viram null — o item não é descartado", () => {
    const r = adaptApiAgendamentosPrimeiraCall(
      envelope([{ evento_id: "ev-2", call_at: "2026-09-29T10:30:00-03:00", urgencia: "", link_call: "   ", closer_nome: undefined }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resposta.agendamentos[0]).toMatchObject({
      evento_id: "ev-2",
      urgencia: null,
      link_call: null,
      closer_nome: null,
      lead_nome: null,
      // Sem data_br/hora_br: derivados de call_at no fuso de Brasília.
      dia: "2026-09-29",
      data_br: "29/09/2026",
      hora_br: "10:30",
    });
  });

  it("item com dado inválido é descartado e LOGADO; a fila segue com os válidos", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = adaptApiAgendamentosPrimeiraCall(
      envelope([
        ITEM_REAL,
        { evento_id: "sem-data", lead_nome: "Sem call_at" },
        { evento_id: "data-ruim", call_at: "amanhã cedo" },
        { call_at: "2026-09-29T10:00:00-03:00", lead_nome: "Sem evento_id" },
        "nem objeto é",
        { ...ITEM_REAL, evento_id: "ev-3", call_at: "2026-09-28T09:00:00-03:00", data_br: "28/09/2026", hora_br: "09:00" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Os dois válidos ficam, ordenados pela call (a das 09:00 primeiro).
    expect(r.resposta.agendamentos.map((a) => a.evento_id)).toEqual(["ev-3", "ev-1"]);
    expect(r.resposta.descartados).toBe(4);
    expect(r.resposta.total).toBe(2);
    expect(log).toHaveBeenCalledTimes(4);
    expect(String(log.mock.calls[0][0])).toContain("agendamento #1 descartado");
    log.mockRestore();
  });

  it("envelope fora do formato vira erro explícito (não fila vazia silenciosa)", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(adaptApiAgendamentosPrimeiraCall({ items: [] }).ok).toBe(false);
    expect(adaptApiAgendamentosPrimeiraCall(null).ok).toBe(false);
    expect(adaptApiAgendamentosPrimeiraCall(envelope([])).ok).toBe(true);
    log.mockRestore();
  });
});

describe("mock no formato da API real", () => {
  const AGORA = new Date("2026-09-28T13:00:00-03:00");

  it("sem de/ate devolve de hoje em diante, ordenado, e passa inteiro pelo adapter", () => {
    const r = adaptApiAgendamentosPrimeiraCall(mockAgendamentosPrimeiraCall({ agora: AGORA }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resposta.descartados).toBe(0);
    expect(r.resposta.agendamentos.length).toBeGreaterThan(5);
    expect(r.resposta.agendamentos.every((a) => a.dia >= "2026-09-28")).toBe(true);
    const horarios = r.resposta.agendamentos.map((a) => a.call_at);
    expect([...horarios].sort()).toEqual(horarios);
  });

  it("closer vê só as próprias; janela de/ate alcança dias anteriores", () => {
    const soMarcio = adaptApiAgendamentosPrimeiraCall(mockAgendamentosPrimeiraCall({ agora: AGORA, closerId: "marcio" }));
    expect(soMarcio.ok && soMarcio.resposta.agendamentos.every((a) => a.closer_id === "marcio")).toBe(true);
    const janela = adaptApiAgendamentosPrimeiraCall(
      mockAgendamentosPrimeiraCall({ agora: AGORA, de: "2026-09-20", ate: "2026-09-27" }),
    );
    expect(janela.ok && janela.resposta.agendamentos.map((a) => a.dia)).toEqual(["2026-09-22", "2026-09-25", "2026-09-27"]);
  });

  it("teste local com login real: o closer logado assume a fila do primeiro closer do mock", () => {
    const real = { id: "3f1c0b52-uuid-do-closer", nome: "Marcio Travassos", role: "closer" };
    const closers = closersDoMock(real);
    expect(closers.map((c) => c.id)).toEqual(["3f1c0b52-uuid-do-closer", "giba", "aurelio"]);
    const r = adaptApiAgendamentosPrimeiraCall(
      mockAgendamentosPrimeiraCall({ agora: AGORA, closerId: real.id, closers }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resposta.agendamentos.length).toBeGreaterThan(0);
    expect(r.resposta.agendamentos.every((a) => a.closer_id === real.id && a.closer_nome === "Marcio Travassos")).toBe(true);
    // Conta de demonstração e admin seguem com os closers do mock.
    expect(closersDoMock({ id: "giba", nome: "Giba", role: "closer" }).map((c) => c.id)).toEqual(["marcio", "giba", "aurelio"]);
    expect(closersDoMock({ id: "uuid-admin", nome: "Vata", role: "admin" }).map((c) => c.id)).toEqual(["marcio", "giba", "aurelio"]);
  });

  it("simular=invalido: os dois itens quebrados são descartados, o resto fica", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = adaptApiAgendamentosPrimeiraCall(mockAgendamentosPrimeiraCall({ agora: AGORA }));
    const r = adaptApiAgendamentosPrimeiraCall(mockAgendamentosPrimeiraCall({ agora: AGORA, simular: "invalido" }));
    expect(r.ok && ok.ok && r.resposta.descartados).toBe(2);
    expect(r.ok && ok.ok && r.resposta.agendamentos.length).toBe(ok.ok ? ok.resposta.agendamentos.length : -1);
    log.mockRestore();
  });

  it("simular=vazio: fila vazia, sem erro", () => {
    const r = adaptApiAgendamentosPrimeiraCall(mockAgendamentosPrimeiraCall({ agora: AGORA, simular: "vazio" }));
    expect(r.ok && r.resposta.agendamentos).toEqual([]);
  });
});
