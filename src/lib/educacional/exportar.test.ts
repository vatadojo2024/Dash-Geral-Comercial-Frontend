import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVISO_LIMITE, ERRO_EXPORTAR, mensagemDaFalha, SEM_PERMISSAO_EXPORTAR } from "@/features/educacional/ExportarCsv";
import {
  _simularGravacaoEmTeste,
  buscarAlunos,
  definirUsuarioDaSessao,
  EducacionalError,
  exportarAlunos,
  idsDosAlunos,
  LIMITE_EXPORTACAO,
  nomeDoArquivo,
} from "./apiEducacional";
import { _zerarMemoria, carregarBanco } from "./mock/banco";
import { celula } from "./mock/exportacao";
import { hojeBR } from "./mock/motor";
import { atender } from "./mock/servidor";

// Exportar CSV da aba Alunos (16/11/2026): ids de todos os filtrados, na ordem
// da tela; o arquivo vai para blob() sem reescrever (BOM e CRLF são do arquivo).

const HOJE = hojeBR();

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const linhasDo = async (b: Blob) => new TextDecoder().decode((await bytes(b)).slice(3)).split("\r\n").slice(0, -1);

describe("ids na ordem da tela", () => {
  it("todos os alunos filtrados, não só a página, na ordem da tela", async () => {
    // Páginas de 4 (a demonstração tem menos alunos que uma página de verdade).
    const f = { ordem: "nome" as const, incluir_arquivados: true, por_pagina: 4 };
    const ids = await idsDosAlunos({ ...f, pagina: 2 });
    const { total } = await buscarAlunos({ ...f, pagina: 1 });
    const paginas = await Promise.all(Array.from({ length: Math.ceil(total / 4) }, (_, i) => buscarAlunos({ ...f, pagina: i + 1 })));
    expect(total).toBeGreaterThan(4);
    expect(ids).toEqual(paginas.flatMap((p) => p.itens.map((a) => a.id)));
  });

  it("respeita filtros e ordem invertida", async () => {
    const asc = await idsDosAlunos({ ordem: "nome", status_aluno: "ativo" });
    const desc = await idsDosAlunos({ ordem: "-nome", status_aluno: "ativo" });
    expect(desc).toEqual([...asc].reverse());
    expect(asc.length).toBe((await buscarAlunos({ status_aluno: "ativo" })).total);
  });
});

describe("arquivo no modo demonstração", () => {
  it("UTF-8 com BOM, ponto e vírgula, CRLF; uma linha por aluno, na ordem enviada", async () => {
    const ids = (await idsDosAlunos({ ordem: "-nome" })).slice(0, 5);
    const { blob, nome } = await exportarAlunos(ids);
    expect(nome).toBe(`alunos-educacional-${HOJE}.csv`);
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect([...(await bytes(blob)).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const linhas = await linhasDo(blob);
    expect(linhas[0].split(";").slice(0, 3)).toEqual(["Nome", "E-mail", "Telefone"]);
    expect(linhas).toHaveLength(1 + ids.length);
    const nomes = (await buscarAlunos({ ordem: "-nome" })).itens.slice(0, 5).map((a) => a.nome);
    expect(linhas.slice(1).map((l) => l.split(";")[0].replace(/^"|"$/g, ""))).toEqual(nomes);
  });

  it("id inexistente é ignorado; repetido conta uma vez, na primeira posição", async () => {
    const [a, b] = await idsDosAlunos({ ordem: "nome" });
    const linhas = await linhasDo((await exportarAlunos([b, "nao-existe", a, b])).blob);
    expect(linhas).toHaveLength(3);
  });

  it("corpo estrito, de 1 a 2000 ids: o resto é 400", async () => {
    const banco = carregarBanco(HOJE);
    const ctx = { usuario: { id: "u", nome: "U" }, hoje: HOJE, agora: new Date().toISOString() };
    const status = (corpo: unknown) => {
      try {
        atender(banco, { metodo: "POST", caminho: "alunos/exportar", corpo }, ctx);
        return 200;
      } catch (e) {
        return (e as { status: number }).status;
      }
    };
    expect(status({ ids: [] })).toBe(400);
    expect(status({ ids: Array.from({ length: LIMITE_EXPORTACAO + 1 }, (_, i) => `x${i}`) })).toBe(400);
    expect(status({ ids: [banco.alunos[0].id], filtros: {} })).toBe(400);
    expect(status({ ids: "x" })).toBe(400);
    expect(status({ ids: [banco.alunos[0].id] })).toBe(200);
    await expect(exportarAlunos([])).rejects.toMatchObject({ status: 400 });
  });

  it("célula: aspas só quando precisa e apóstrofo contra fórmula", () => {
    expect(celula("João")).toBe("João");
    expect(celula(null)).toBe("");
    expect(celula('diz "oi"; tchau')).toBe('"diz ""oi""; tchau"');
    expect(celula("linha\r\noutra")).toBe('"linha\r\noutra"');
    expect(celula("+55 31 99999-8888")).toBe("'+55 31 99999-8888");
    expect(celula("=1+1")).toBe("'=1+1");
    expect(celula('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celula(42)).toBe("42");
  });
});

describe("nome do arquivo e mensagens", () => {
  it("nome do Content-Disposition (filename e filename*); sem ele, o padrão com a data de Brasília", () => {
    expect(nomeDoArquivo('attachment; filename="alunos-educacional-2026-11-16.csv"')).toBe("alunos-educacional-2026-11-16.csv");
    expect(nomeDoArquivo("attachment; filename=alunos.csv")).toBe("alunos.csv");
    expect(nomeDoArquivo("attachment; filename*=UTF-8''alunos%20educa%C3%A7%C3%A3o.csv")).toBe("alunos educação.csv");
    expect(nomeDoArquivo(null)).toBe(`alunos-educacional-${HOJE}.csv`);
  });

  it("400 e rede: tente de novo; 403: sem permissão; 401: nada (vai para o login); limite", () => {
    expect(mensagemDaFalha(new EducacionalError("x", 400))).toBe(ERRO_EXPORTAR);
    expect(mensagemDaFalha(new EducacionalError("x", 0))).toBe(ERRO_EXPORTAR);
    expect(mensagemDaFalha(new EducacionalError("x", 502))).toBe(ERRO_EXPORTAR);
    expect(mensagemDaFalha(new TypeError("x"))).toBe(ERRO_EXPORTAR);
    expect(mensagemDaFalha(new EducacionalError("x", 403))).toBe(SEM_PERMISSAO_EXPORTAR);
    expect(mensagemDaFalha(new EducacionalError("x", 401))).toBeNull();
    expect(AVISO_LIMITE(2350)).toBe("São 2350 alunos com esses filtros, e o limite é 2000. Refine o filtro para exportar.");
  });
});

describe("modo api", () => {
  const fetchMock = vi.fn();
  async function adapterApi() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_EDU_DATA_SOURCE", "api");
    vi.stubGlobal("fetch", fetchMock);
    return import("./apiEducacional");
  }
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POST com { ids } e o arquivo em bytes, sem reescrever; nome do Content-Disposition", async () => {
    const api = await adapterApi();
    const arquivo = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Nome;Ação\r\nJoão;Sim\r\n")]);
    fetchMock.mockResolvedValue(
      new Response(arquivo, { status: 200, headers: { "Content-Disposition": 'attachment; filename="alunos-educacional-2026-11-16.csv"' } }),
    );
    const r = await api.exportarAlunos(["a", "b"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/educacional/alunos/exportar", "POST", '{"ids":["a","b"]}']);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(r.nome).toBe("alunos-educacional-2026-11-16.csv");
    expect(await bytes(r.blob)).toEqual(arquivo);
  });

  it("403, 400 e rede viram erro com o status", async () => {
    const api = await adapterApi();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "sem_permissao" }), { status: 403 }));
    await expect(api.exportarAlunos(["a"])).rejects.toMatchObject({ status: 403 });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "validacao", campo: "ids" }), { status: 400 }));
    await expect(api.exportarAlunos(["a"])).rejects.toMatchObject({ status: 400 });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.exportarAlunos(["a"])).rejects.toMatchObject({ status: 0 });
  });
});
