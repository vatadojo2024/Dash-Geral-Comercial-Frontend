import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/api/contracts";
import { filtrarPorEscopo, leadNoEscopo, type LeadComDono } from "./escopo";

function lead(parcial: Partial<LeadComDono> & { id: string }): LeadComDono & { id: string } {
  return { closer_id: null, sdr_id: null, sdr_pool: false, ...parcial };
}

const admin: SessionUser = { id: "vata", nome: "Vata", email: "v@v.com", role: "admin" };
const closer: SessionUser = { id: "marcio", nome: "Marcio", email: "m@v.com", role: "closer" };
const sdr: SessionUser = { id: "benhur", nome: "Benhur", email: "b@v.com", role: "sdr" };

// Carteira de teste: leads de vários donos + um do pool da Hana.
const CARTEIRA = [
  lead({ id: "a", closer_id: "marcio", sdr_id: "benhur" }),
  lead({ id: "b", closer_id: "giba", sdr_id: "glaucio" }),
  lead({ id: "c", closer_id: "aurelio", sdr_id: "guilherme" }),
  lead({ id: "d", closer_id: "giba", sdr_id: null, sdr_pool: true }), // pool da Hana
  lead({ id: "e", closer_id: "marcio", sdr_id: "guilherme" }),
];

describe("leadNoEscopo / filtrarPorEscopo — 3 papéis", () => {
  it("admin vê TODOS os leads", () => {
    expect(filtrarPorEscopo(CARTEIRA, admin).map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("closer vê SÓ os dele (closer_id = ele); pool não conta para closer", () => {
    expect(filtrarPorEscopo(CARTEIRA, closer).map((l) => l.id)).toEqual(["a", "e"]);
    // o lead do pool é de outro closer (giba) → fora
    expect(leadNoEscopo(lead({ id: "x", closer_id: "giba", sdr_pool: true }), closer)).toBe(
      false,
    );
  });

  it("SDR vê os dele (sdr_id = ele) + o pool da Hana, e NÃO os de outros SDRs", () => {
    expect(filtrarPorEscopo(CARTEIRA, sdr).map((l) => l.id)).toEqual(["a", "d"]);
    // lead de outro SDR (glaucio), sem pool → vazaria se a regra estivesse errada
    expect(leadNoEscopo(lead({ id: "y", sdr_id: "glaucio" }), sdr)).toBe(false);
    // pool é visível a qualquer SDR mesmo com sdr_id de outro
    expect(leadNoEscopo(lead({ id: "z", sdr_id: "glaucio", sdr_pool: true }), sdr)).toBe(
      true,
    );
  });
});
