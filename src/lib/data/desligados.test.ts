import { describe, expect, it } from "vitest";
import { UsuariosResponseSchema, type LeadListItem } from "@/lib/api/contracts";
import { chaveDeVendas } from "@/lib/config/salesops";
import { adaptApiUsuarios } from "@/lib/server/apiUsuarios";
import { closersDoMock } from "@/lib/mock/agendamentos_primeira_call";
import { comDesligado, opcoesDeDono } from "./donos";
import { ordenarClosers } from "./useUsuarios";

// Operador desligado (backend 9a04915): `ativo: false` no /api/usuarios. Continua
// no histórico (nome e filtros, marcado "(desligado)"); não recebe trabalho novo.

const lead = (p: Partial<LeadListItem>) => p as LeadListItem;

describe("operador desligado", () => {
  it("o contrato aceita papel e ativo; sem ativo (API antiga), vale ativo", () => {
    const r = UsuariosResponseSchema.parse({ usuarios: [{ id: "a", nome: "A" }, { id: "m", nome: "Marcio", papel: "closer", ativo: false }] });
    expect(r.usuarios.map((u) => u.ativo)).toEqual([true, false]);
    const adaptado = adaptApiUsuarios({ usuarios: [{ id: "m", nome: "Marcio", papel: "closer", ativo: false }, { id: "l", nome: "Lucas Frare", papel: "closer" }] });
    expect(adaptado.ok && adaptado.items.map((u) => [u.papel, u.ativo])).toEqual([
      ["closer", false],
      ["closer", true],
    ]);
  });

  it("closers do diretório: ativos primeiro, quem saiu por último", () => {
    const lista = ordenarClosers([
      { id: "m", nome: "Marcio", papel: "closer", ativo: false },
      { id: "l", nome: "Lucas Frare", papel: "closer", ativo: true },
      { id: "s", nome: "Benhur", papel: "sdr", ativo: true },
      { id: "a", nome: "Aurelio", papel: "closer", ativo: true },
    ]);
    expect(lista.map((u) => u.id)).toEqual(["a", "l", "m"]);
  });

  it("filtros de histórico: quem saiu continua como opção, marcado '(desligado)'", () => {
    const leads = [lead({ closer_id: "m", closer_nome: "Marcio", sdr_id: "s", sdr_nome: "Glaucio" }), lead({ closer_id: "l", closer_nome: "Lucas Frare", sdr_id: null })];
    const { closers } = opcoesDeDono(leads, null, new Set(["m"]));
    expect(closers).toEqual([
      { id: "l", nome: "Lucas Frare" },
      { id: "m", nome: "Marcio (desligado)" },
    ]);
    expect(comDesligado("Marcio", "m", null)).toBe("Marcio");
  });

  it("closer sem meta configurada (quem entrou) busca vendas pelo nome do diretório", () => {
    const nomes = new Map([
      ["uuid-giba", "Gilberto Arahawa"],
      ["uuid-lucas", "Lucas Frare"],
    ]);
    expect(chaveDeVendas("uuid-giba", nomes)).toBe("giba");
    expect(chaveDeVendas("uuid-lucas", nomes)).toBe("Lucas Frare");
    expect(chaveDeVendas("uuid-desconhecido", nomes)).toBeNull();
  });

  it("agenda da demonstração: quem saiu não recebe call nova", () => {
    expect(closersDoMock({ id: "uuid-admin", nome: "Admin", role: "admin" }).map((c) => c.id)).not.toContain("marcio");
  });
});
