import { describe, expect, it, vi } from "vitest";
import {
  aplicarConteudo,
  aplicarStatus,
  mensagensValidas,
  novaMensagem,
  ordenarCronologico,
} from "./conversa";
import type { Mensagem } from "./tipos";

function msg(parcial: Partial<Mensagem>): Mensagem {
  return {
    id: "ms_1",
    conversa_id: "cv_1",
    autor: "ia",
    conteudo: "",
    status: "pendente",
    criada_em: "2026-06-19T10:00:00.000Z",
    anexos: [],
    ...parcial,
  };
}

describe("conversa (lógica pura)", () => {
  it("novaMensagem cria com anexos vazio e os campos do contrato", () => {
    const m = novaMensagem({
      id: "ms_x",
      conversa_id: "cv_1",
      autor: "usuario",
      conteudo: "olá",
      status: "pronta",
      criada_em: "2026-06-19T10:00:00.000Z",
    });
    expect(m.anexos).toEqual([]);
    expect(m.autor).toBe("usuario");
    expect(m.status).toBe("pronta");
  });

  it("aplicarConteudo conclui a mensagem da IA (vira pronta com texto)", () => {
    const lista = [msg({ id: "ia_1", status: "pendente" })];
    const out = aplicarConteudo(lista, "ia_1", "resposta");
    expect(out[0].conteudo).toBe("resposta");
    expect(out[0].status).toBe("pronta");
  });

  it("aplicarStatus para erro mantém conteúdo; para pendente limpa o conteúdo", () => {
    const base = [msg({ id: "ia_1", status: "pronta", conteudo: "texto" })];
    expect(aplicarStatus(base, "ia_1", "erro")[0]).toMatchObject({
      status: "erro",
      conteudo: "texto",
    });
    expect(aplicarStatus(base, "ia_1", "pendente")[0]).toMatchObject({
      status: "pendente",
      conteudo: "",
    });
  });

  it("mensagensValidas descarta a malformada e registra, mantendo as demais", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const itens = [
      msg({ id: "ok_1" }),
      { id: "quebrada", autor: "marciano" }, // status/conteudo/etc ausentes
      msg({ id: "ok_2" }),
    ];
    const out = mensagensValidas(itens);
    expect(out.map((m) => m.id)).toEqual(["ok_1", "ok_2"]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("ordenarCronologico coloca as mais recentes embaixo", () => {
    const out = ordenarCronologico([
      msg({ id: "b", criada_em: "2026-06-19T10:05:00.000Z" }),
      msg({ id: "a", criada_em: "2026-06-19T10:00:00.000Z" }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });
});
