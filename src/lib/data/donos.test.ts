import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { leadDoSdr, opcoesDeDono, SEM_SDR } from "./donos";

function lead(over: Partial<LeadListItem>): LeadListItem {
  return {
    lead_id: "x",
    nome_exibicao: "X",
    score_final: 50,
    score_bruto: 50,
    temperatura: "morno_alto",
    etapa_atual: "em_atendimento",
    score_momento: 0,
    score_fit: 0,
    score_urgencia: 0,
    score_engajamento: 0,
    score_timing: 0,
    trava_aplicada: null,
    motivo_curto: "",
    proxima_acao: "",
    alertas: [],
    tier_final: "",
    produto_sugerido: null,
    closer_id: null,
    sdr_id: null,
    sdr_pool: false,
    next_call_at: null,
    next_call_numero: null,
    score_calculated_at: "",
    destaque: false,
    ...over,
  };
}

describe("opcoesDeDono", () => {
  it("deriva closers/sdrs distintos dos leads, com o NOME que vem no lead (ordenado)", () => {
    const leads = [
      lead({ closer_id: "c1", closer_nome: "Marcio", sdr_id: "s1", sdr_nome: "Benhur" }),
      lead({ closer_id: "c1", closer_nome: "Marcio", sdr_id: "s1", sdr_nome: "Benhur" }), // repetido
      lead({ closer_id: "c2", closer_nome: "Giba", sdr_id: "s2", sdr_nome: "Guilherme" }),
    ];
    const { closers, sdrs } = opcoesDeDono(leads);
    expect(closers).toEqual([
      { id: "c2", nome: "Giba" },
      { id: "c1", nome: "Marcio" },
    ]);
    expect(sdrs).toEqual([
      { id: "s1", nome: "Benhur" },
      { id: "s2", nome: "Guilherme" },
    ]);
  });

  it("value = id REAL (UUID), rótulo = sdr_nome — não exibe UUID havendo nome", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    const { sdrs } = opcoesDeDono([lead({ sdr_id: uuid, sdr_nome: "Benhur" })]);
    expect(sdrs).toEqual([{ id: uuid, nome: "Benhur" }]);
  });

  it("sem nome no lead: cai no diretório (/api/usuarios) e, por fim, no id", () => {
    const uuid = "22222222-2222-2222-2222-222222222222";
    // sem sdr_nome, sem mapa → id cru
    expect(opcoesDeDono([lead({ sdr_id: uuid })]).sdrs).toEqual([{ id: uuid, nome: uuid }]);
    // sem sdr_nome, com mapa → nome do diretório
    expect(
      opcoesDeDono([lead({ sdr_id: uuid })], new Map([[uuid, "Benhur"]])).sdrs,
    ).toEqual([{ id: uuid, nome: "Benhur" }]);
    // conta conhecida do mock (slug)
    expect(opcoesDeDono([lead({ closer_id: "marcio" })]).closers).toEqual([
      { id: "marcio", nome: "Marcio" },
    ]);
  });

  it("leads sem SDR (Hana/pool) viram uma opção própria no fim da lista", () => {
    const { sdrs } = opcoesDeDono([
      lead({ sdr_id: "s1", sdr_nome: "Benhur" }),
      lead({ sdr_id: null, sdr_pool: true }), // Hana
    ]);
    expect(sdrs).toEqual([
      { id: "s1", nome: "Benhur" },
      { id: SEM_SDR, nome: "Hana (IA)" },
    ]);
  });

  it("sem SDR e sem pool → rótulo 'Sem SDR'", () => {
    const { sdrs } = opcoesDeDono([lead({ sdr_id: null, sdr_pool: false })]);
    expect(sdrs).toEqual([{ id: SEM_SDR, nome: "Sem SDR" }]);
  });

  it("todos com sdr_id preenchido → sem a opção 'sem SDR'", () => {
    const { sdrs } = opcoesDeDono([lead({ sdr_id: "s1", sdr_nome: "Benhur" })]);
    expect(sdrs).toEqual([{ id: "s1", nome: "Benhur" }]);
  });
});

describe("leadDoSdr", () => {
  it("vazio/nulo = sem filtro (passa todos)", () => {
    expect(leadDoSdr(lead({ sdr_id: "s1" }), "")).toBe(true);
    expect(leadDoSdr(lead({ sdr_id: null }), null)).toBe(true);
  });

  it("casa pelo sdr_id exato", () => {
    expect(leadDoSdr(lead({ sdr_id: "s1" }), "s1")).toBe(true);
    expect(leadDoSdr(lead({ sdr_id: "s2" }), "s1")).toBe(false);
  });

  it("a sentinela SEM_SDR pega só os leads sem sdr_id (Hana/pool)", () => {
    expect(leadDoSdr(lead({ sdr_id: null }), SEM_SDR)).toBe(true);
    expect(leadDoSdr(lead({ sdr_id: "s1" }), SEM_SDR)).toBe(false);
  });
});
