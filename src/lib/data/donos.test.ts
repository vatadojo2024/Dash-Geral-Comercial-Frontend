import { describe, expect, it } from "vitest";
import type { LeadListItem } from "@/lib/api/contracts";
import { opcoesDeDono } from "./donos";

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
    ...over,
  };
}

describe("opcoesDeDono", () => {
  it("deriva closers/sdrs distintos dos próprios leads (ids reais)", () => {
    const uuidA = "11111111-1111-1111-1111-111111111111";
    const uuidB = "22222222-2222-2222-2222-222222222222";
    const leads = [
      lead({ closer_id: uuidA, sdr_id: uuidB }),
      lead({ closer_id: uuidA, sdr_id: null }), // dono repetido + sdr nulo
      lead({ closer_id: null, sdr_id: uuidB }),
      lead({ closer_id: null, sdr_id: null }), // lead sem dono nenhum
    ];
    const { closers, sdrs } = opcoesDeDono(leads);
    // UUID aparece UMA vez (distinto); nulos não viram opção.
    expect(closers.map((c) => c.id)).toEqual([uuidA]);
    expect(sdrs.map((s) => s.id)).toEqual([uuidB]);
    // O value da opção é o UUID exato que está no lead → o filtro casa.
    expect(closers[0].nome).toBe(uuidA); // sem fonte de nomes → cai no id
  });

  it("resolve o nome quando o id é uma conta conhecida (mock)", () => {
    const { closers } = opcoesDeDono([lead({ closer_id: "marcio" })]);
    expect(closers).toEqual([{ id: "marcio", nome: "Marcio" }]);
  });

  it("não inventa opção quando nenhum lead tem dono", () => {
    const { closers, sdrs } = opcoesDeDono([lead({}), lead({})]);
    expect(closers).toEqual([]);
    expect(sdrs).toEqual([]);
  });
});
