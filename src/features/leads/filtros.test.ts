import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { filtrarLeads, SEM_ETAPA } from "./filtros";

// Leads com os valores CANÔNICOS reais (temperatura, etapa_atual nullable,
// produto_sugerido). O bug: clicar num filtro zerava a lista. Estes testes
// provam que cada valor real REDUZ a lista e nunca a zera quando há quem bata.

function lead(over: Partial<LeadListItem>): LeadListItem {
  return {
    lead_id: "ld_x",
    nome_exibicao: "Lead X",
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
    score_calculated_at: "2026-06-14T10:00:00Z",
    ...over,
  };
}

// Carteira com os 6 valores canônicos de temperatura, etapas variadas (+ null)
// e os 5 produtos canônicos.
const LEADS: LeadListItem[] = [
  lead({ lead_id: "a", temperatura: "muito_quente", etapa_atual: "1a_call_agendada", produto_sugerido: "qc" }),
  lead({ lead_id: "b", temperatura: "quente", etapa_atual: "2a_call_agendada", produto_sugerido: "ninja" }),
  lead({ lead_id: "c", temperatura: "morno_alto", etapa_atual: "em_atendimento", produto_sugerido: "black" }),
  lead({ lead_id: "d", temperatura: "morno_baixo", etapa_atual: "no-show", produto_sugerido: "prime" }),
  lead({ lead_id: "e", temperatura: "frio", etapa_atual: null, produto_sugerido: "private" }),
  lead({ lead_id: "f", temperatura: "congelado", etapa_atual: "fechado", produto_sugerido: "Ninja" }),
];

function sp(q: Record<string, string>): URLSearchParams {
  return new URLSearchParams(q);
}

describe("filtrarLeads — valores canônicos reais reduzem, não zeram", () => {
  it("cada temperatura canônica reduz a lista sem zerar", () => {
    for (const t of [
      "muito_quente",
      "quente",
      "morno_alto",
      "morno_baixo",
      "frio",
      "congelado",
    ]) {
      const r = filtrarLeads(LEADS, sp({ temperatura: t }));
      expect(r.length).toBeGreaterThan(0); // não zera (há quem bata)
      expect(r.length).toBeLessThan(LEADS.length); // reduz
      expect(r.every((l) => l.temperatura === t)).toBe(true);
    }
  });

  it("cada etapa canônica reduz a lista sem zerar", () => {
    for (const e of ["1a_call_agendada", "2a_call_agendada", "em_atendimento", "no-show", "fechado"]) {
      const r = filtrarLeads(LEADS, sp({ etapa: e }));
      expect(r.length).toBe(1);
      expect(r[0].etapa_atual).toBe(e);
    }
  });

  it("cada produto canônico reduz a lista sem zerar (case-insensitive)", () => {
    for (const p of ["qc", "ninja", "black", "prime", "private"]) {
      const r = filtrarLeads(LEADS, sp({ produto: p }));
      expect(r.length).toBeGreaterThan(0);
      expect(r.length).toBeLessThan(LEADS.length);
    }
    // "Ninja" (lead f) cai sob a chave canônica "ninja" junto do lead b.
    expect(filtrarLeads(LEADS, sp({ produto: "ninja" })).map((l) => l.lead_id).sort()).toEqual([
      "b",
      "f",
    ]);
  });

  it("etapa null cai em 'sem_etapa' e NÃO some de outros filtros", () => {
    // O lead 'e' (etapa null) aparece no filtro sem_etapa...
    const semEtapa = filtrarLeads(LEADS, sp({ etapa: SEM_ETAPA }));
    expect(semEtapa.map((l) => l.lead_id)).toEqual(["e"]);

    // ...e continua visível por temperatura (frio) — não some indevidamente.
    expect(filtrarLeads(LEADS, sp({ temperatura: "frio" })).map((l) => l.lead_id)).toEqual(["e"]);
    // ...e por produto (private).
    expect(filtrarLeads(LEADS, sp({ produto: "private" })).map((l) => l.lead_id)).toEqual(["e"]);
  });

  it("filtro de produto não zera quando os leads carregam produto_sugerido (regressão do adapter)", () => {
    // Antes do fix, o adapter da lista zerava produto_sugerido → este filtro
    // devolvia [] mesmo com leads de produto 'black'.
    const r = filtrarLeads(LEADS, sp({ produto: "black" }));
    expect(r).toHaveLength(1);
    expect(r[0].lead_id).toBe("c");
  });

  it("produto com variante (S/A) ou casing casa a base canônica", () => {
    const comVariante: LeadListItem[] = [
      lead({ lead_id: "v1", produto_sugerido: "prime" }),
      lead({ lead_id: "v2", produto_sugerido: "Prime Anual" }),
      lead({ lead_id: "v3", produto_sugerido: "ninja_s" }),
      lead({ lead_id: "v4", produto_sugerido: "private" }),
    ];
    expect(filtrarLeads(comVariante, sp({ produto: "prime" })).map((l) => l.lead_id)).toEqual([
      "v1",
      "v2",
    ]);
    // "private" NÃO é capturado por "prime" (prefixo difere).
    expect(filtrarLeads(comVariante, sp({ produto: "private" })).map((l) => l.lead_id)).toEqual([
      "v4",
    ]);
    expect(filtrarLeads(comVariante, sp({ produto: "ninja" })).map((l) => l.lead_id)).toEqual([
      "v3",
    ]);
  });

  it("não quebra (toLowerCase of undefined) com campos undefined/null no lead", () => {
    // Simula um lead fora do contrato estrito: campos usados em filtro vindo
    // undefined/null. Nenhum filtro pode lançar — no máximo o lead não casa.
    const quebrado = {
      ...lead({ lead_id: "z" }),
      nome_exibicao: undefined,
      produto_sugerido: undefined,
      closer_id: undefined,
      sdr_id: undefined,
      etapa_atual: undefined,
      temperatura: undefined,
    } as unknown as LeadListItem;
    const carteira = [...LEADS, quebrado];

    expect(() => filtrarLeads(carteira, sp({ busca: "lead" }))).not.toThrow();
    expect(() => filtrarLeads(carteira, sp({ produto: "ninja" }))).not.toThrow();
    expect(() => filtrarLeads(carteira, sp({ closer: "marcio" }))).not.toThrow();
    expect(() => filtrarLeads(carteira, sp({ etapa: "em_atendimento" }))).not.toThrow();
    // O lead quebrado não casa um produto canônico (produto undefined → null).
    expect(filtrarLeads(carteira, sp({ produto: "ninja" })).some((l) => l.lead_id === "z")).toBe(false);
  });

  it("filtro de closer/SDR casa o id real (UUID) — reduz, não zera", () => {
    const uuidCloser = "aaaaaaaa-0000-0000-0000-000000000001";
    const uuidSdr = "bbbbbbbb-0000-0000-0000-000000000002";
    const carteira: LeadListItem[] = [
      lead({ lead_id: "m", nome_exibicao: "Mayron", closer_id: uuidCloser, sdr_id: uuidSdr }),
      lead({ lead_id: "n", closer_id: "outro-uuid", sdr_id: "outro-sdr" }),
      lead({ lead_id: "o", closer_id: null, sdr_id: null }), // sem dono
    ];
    // Filtrar pelo UUID do closer mostra só os dele (não zera).
    expect(filtrarLeads(carteira, sp({ closer: uuidCloser })).map((l) => l.lead_id)).toEqual(["m"]);
    expect(filtrarLeads(carteira, sp({ sdr: uuidSdr })).map((l) => l.lead_id)).toEqual(["m"]);
    // Lead sem dono não some dos demais filtros (aparece por temperatura).
    expect(filtrarLeads(carteira, sp({ temperatura: "morno_alto" })).length).toBe(3);
  });
});
