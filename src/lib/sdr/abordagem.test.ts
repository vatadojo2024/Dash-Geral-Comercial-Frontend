import { describe, expect, it } from "vitest";
import { mockAbordagem } from "@/lib/mock/eventos_abordagem";
import {
  AbordagemResponseSchema,
  contarIndicador,
  csvDeAbordagem,
  filtrarAbordagem,
  grupoDe,
  momentoDe,
  presentesFecham,
  proporcaoAbordagem,
  rotuloDaEtapaAbordagem,
  semComoConfirmar,
  type ChaveIndicador,
} from "./abordagem";

// Ciclo de 29/09 (uma terça no intervalo).
const resp = AbordagemResponseSchema.parse(mockAbordagem("2026-09-29", "2026-10-05"));

describe("mock calibrado no ciclo de 29/09", () => {
  it("indicadores: certos e incertos separados", () => {
    const i = resp.indicadores;
    expect([i.responderam.antes, semComoConfirmar(i.responderam)]).toEqual([19, 10]);
    expect([i.abordados_compareceram.antes, semComoConfirmar(i.abordados_compareceram)]).toEqual([41, 35]);
    expect([i.sem_resposta_compareceram.antes, semComoConfirmar(i.sem_resposta_compareceram)]).toEqual([16, 6]);
  });

  it("totais fecham: cinco baldes = inscritos; presentes = Σ por_etapa", () => {
    const t = resp.totais;
    expect(t.inscritos).toBe(302);
    expect([t.nao_abordados, t.sem_resposta, t.responderam, t.outras_etapas, t.fora_da_aba]).toEqual([17, 165, 29, 80, 11]);
    expect(proporcaoAbordagem(t).fechaConta).toBe(true);
    expect(presentesFecham(t, resp.por_etapa)).toBe(true);
    expect(resp.leads).toHaveLength(291); // a Base não entra na lista
  });

  it("por_etapa: maior primeiro, sem negócio por último", () => {
    expect(resp.por_etapa[0]).toMatchObject({ etapa: "Prospecção", total: 165 });
    expect(resp.por_etapa[resp.por_etapa.length - 1].etapa).toBeNull();
    expect(rotuloDaEtapaAbordagem(null)).toBe("Sem negócio na Clint");
    expect(rotuloDaEtapaAbordagem("(sem negócio)")).toBe("Sem negócio na Clint");
  });
});

describe("a lista reproduz os cards (mesmo payload, sem nova requisição)", () => {
  it.each<[ChaveIndicador]>([["responderam"], ["abordados_compareceram"], ["sem_resposta_compareceram"]])(
    "%s",
    (chave) => {
      const ind = resp.indicadores[chave];
      expect(contarIndicador(resp.leads, chave)).toEqual({ antes: ind.antes, semConfirmar: semComoConfirmar(ind), total: ind.total });
    },
  );

  it("filtro de certeza separa confirmados de sem como confirmar, mantendo a ordem", () => {
    const certos = filtrarAbordagem(resp.leads, { indicador: "responderam", certeza: "confirmados", busca: "" });
    const incertos = filtrarAbordagem(resp.leads, { indicador: "responderam", certeza: "sem_confirmar", busca: "" });
    expect([certos.length, incertos.length]).toEqual([19, 10]);
    const ordem = resp.leads.filter((l) => certos.includes(l));
    expect(certos).toEqual(ordem);
  });

  it("filtro por grupo e presença", () => {
    expect(filtrarAbordagem(resp.leads, { grupo: "nao_abordado", busca: "" })).toHaveLength(17);
    expect(filtrarAbordagem(resp.leads, { soAoVivo: true, busca: "" })).toHaveLength(resp.totais.presentes_ao_vivo);
  });
});

describe("tolerância e CSV", () => {
  it("grupo/momento desconhecidos não derrubam a aba", () => {
    expect(grupoDe("coluna_nova")).toBe("outra");
    expect(momentoDe(null)).toBe("sem_informacao");
  });

  it("CSV com a certeza por extenso", () => {
    const linhas = csvDeAbordagem(resp.leads.slice(0, 2)).split("\r\n");
    expect(linhas[0]).toContain('"certeza"');
    expect(linhas).toHaveLength(3);
  });
});
