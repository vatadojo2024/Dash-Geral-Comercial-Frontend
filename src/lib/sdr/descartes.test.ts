import { describe, expect, it } from "vitest";
import { mockDescartes } from "@/lib/mock/sdr_descartes";
import {
  dataDoEvento,
  DescartesResponseSchema,
  ehSemDono,
  rotuloDaTaxa,
  sobreposicao,
  taxaDeDescarte,
  totalDeDescartes,
} from "./descartes";

const USUARIO = {
  usuario_id: "8a9f218f",
  usuario_clint_id: "2c538927",
  nome: "Guilherme Delrue",
  email: "g@x.com",
  papel: "sdr",
  desqualificou: 1,
  perdeu: 8,
  nutricao: 9,
  leads_distintos: 17,
};
const RESPOSTA = {
  de: "2026-09-22",
  ate: "2026-09-28",
  eventos: ["WG - 22.09.26"],
  totais: { desqualificou: 3, perdeu: 13, nutricao: 14, leads_distintos: 27 },
  por_evento: [
    {
      evento_tag: "WG - 22.09.26",
      inscritos: 485,
      totais: { desqualificou: 3, perdeu: 13, nutricao: 14, leads_distintos: 27 },
      por_usuario: [USUARIO],
    },
  ],
  por_usuario: [USUARIO],
  fontes: { etapas_desqualificacao: ["Desqualificado"], origin_id_pre_venda: "7c06", origin_id_nutricao: "4b2a" },
  avisos: [],
  gerado_em: "2026-09-29T14:00:00.000Z",
  cache: "miss",
};

describe("contrato de /api/sdr/descartes (por evento)", () => {
  it("aceita a resposta da spec; papel desconhecido vira null sem derrubar", () => {
    const r = DescartesResponseSchema.safeParse({
      ...RESPOSTA,
      por_usuario: [USUARIO, { ...USUARIO, nome: "X", papel: "gestor", extra: 1 }],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.por_usuario.map((u) => u.papel)).toEqual(["sdr", null]);
    expect(r.data.por_evento[0].inscritos).toBe(485);
  });

  it("por_evento é obrigatório; fontes, avisos, cache e inscritos são opcionais; contagem negativa é recusada", () => {
    const { por_evento: _pe, ...semEventos } = RESPOSTA;
    expect(DescartesResponseSchema.safeParse(semEventos).success).toBe(false);
    const { fontes: _f, avisos: _a, cache: _c, ...minimo } = RESPOSTA;
    expect(DescartesResponseSchema.safeParse(minimo).success).toBe(true);
    expect(
      DescartesResponseSchema.safeParse({ ...RESPOSTA, por_evento: [{ ...RESPOSTA.por_evento[0], inscritos: null }] }).success,
    ).toBe(true);
    expect(DescartesResponseSchema.safeParse({ ...RESPOSTA, totais: { ...RESPOSTA.totais, perdeu: -1 } }).success).toBe(false);
  });
});

describe("leitura dos números", () => {
  it("soma das colunas = descartes (eventos); leads é leads_distintos", () => {
    expect(totalDeDescartes(USUARIO)).toBe(18);
    expect(sobreposicao(USUARIO)).toBe(1);
    expect(sobreposicao({ desqualificou: 0, perdeu: 0, nutricao: 2, leads_distintos: 2 })).toBe(0);
  });

  it("taxa de descarte = leads distintos / inscritos; sem inscritos, travessão", () => {
    expect(rotuloDaTaxa(taxaDeDescarte(27, 485))).toBe("5,6%");
    expect(rotuloDaTaxa(taxaDeDescarte(0, 310))).toBe("0,0%");
    expect(rotuloDaTaxa(taxaDeDescarte(3, 0))).toBe("—");
    expect(rotuloDaTaxa(taxaDeDescarte(3, null))).toBe("—");
  });

  it("'Sem dono' e data curta do evento", () => {
    expect(ehSemDono({ usuario_id: null, nome: "Sem dono" })).toBe(true);
    expect(ehSemDono({ usuario_id: "x", nome: "Sem dono" })).toBe(false);
    expect(dataDoEvento("WG - 22.09.26")).toBe("22/09");
    expect(dataDoEvento("Evento especial")).toBe("Evento especial");
  });
});

describe("mock", () => {
  it("setembro por evento bate com os números reais do backend", () => {
    const r = DescartesResponseSchema.parse(mockDescartes("2026-09-01", "2026-09-29"));
    expect(
      r.por_evento.map((e) => [e.evento_tag, e.inscritos, e.totais.leads_distintos, rotuloDaTaxa(taxaDeDescarte(e.totais.leads_distintos, e.inscritos)), e.totais.desqualificou, e.totais.perdeu, e.totais.nutricao]),
    ).toEqual([
      ["WG - 01.09.26", 1004, 35, "3,5%", 11, 21, 5],
      ["WG - 08.09.26", 652, 29, "4,4%", 6, 21, 5],
      ["WG - 15.09.26", 185, 6, "3,2%", 3, 3, 1],
      ["WG - 22.09.26", 485, 27, "5,6%", 3, 13, 14],
      ["WG - 29.09.26", 310, 0, "0,0%", 0, 0, 0],
    ]);
  });

  it("22/09 por pessoa: Guilherme 17 (1·8·9), Glaucio 8 (2·5·3), Benhur 2 (0·0·2)", () => {
    const r = DescartesResponseSchema.parse(mockDescartes("2026-09-22", "2026-09-28"));
    expect(r.eventos).toEqual(["WG - 22.09.26"]);
    expect(r.por_evento[0].por_usuario.map((u) => [u.nome, u.leads_distintos, u.desqualificou, u.perdeu, u.nutricao])).toEqual([
      ["Guilherme Delrue", 17, 1, 8, 9],
      ["Glaucio Portela", 8, 2, 5, 3],
      ["Benhur Ramos", 2, 0, 0, 2],
    ]);
    expect(r.totais).toEqual({ desqualificou: 3, perdeu: 13, nutricao: 14, leads_distintos: 27 });
  });

  it("fora de setembro: 'Sem dono' por último; vazio devolve blocos sem pessoas", () => {
    const r = DescartesResponseSchema.parse(mockDescartes("2026-10-06", "2026-10-12"));
    const pessoas = r.por_evento[0].por_usuario;
    expect(pessoas[pessoas.length - 1].nome).toBe("Sem dono");
    expect(pessoas.some((u) => u.papel === "closer")).toBe(true);
    const v = DescartesResponseSchema.parse(mockDescartes("2026-09-22", "2026-09-28", "vazio"));
    expect(v.por_evento[0].por_usuario).toEqual([]);
    expect(v.por_evento[0].inscritos).toBe(485);
  });
});
