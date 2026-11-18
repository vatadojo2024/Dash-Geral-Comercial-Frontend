import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _simularGravacaoEmTeste,
  buscarAluno,
  buscarAlunos,
  buscarAnaliseAula,
  criarAnaliseAula,
  decidirAnalise,
  definirUsuarioDaSessao,
  EducacionalError,
  listarAnalises,
  listarAnalisesDaAula,
  queryDaCentral,
} from "./apiEducacional";
import { AulaSchema, type AlunoDetalhe, type PedidoDecisao } from "./contrato";
import { _zerarMemoria, carregarBanco } from "./mock/banco";
import { hojeBR } from "./mock/motor";
import { centralDeAnalises } from "./mock/analiseAula";
import { atender } from "./mock/servidor";

// Análise de aula com IA (16/11/2026, backend 0fec174), no modo demonstração:
// cria em "processando", fica "pronta" com a proposta, e "decidir" aplica o
// aprovado pelo caminho do lote (versão do aluno, ajuste com motivo, histórico).

const TEXTO = "00:01 Mentor: vamos revisar a oferta. ".repeat(8);

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});
afterEach(() => {
  vi.useRealTimers();
});

// A análise de exemplo da semente: pronta, sem decisão.
async function exemplo() {
  const banco = carregarBanco(hojeBR());
  const ex = banco.analises_aula!.find((x) => x.id === "ana-exemplo")!;
  const aluno = await buscarAluno(ex.aluno_id);
  return { aulaId: ex.aula_id, aluno, analise: await buscarAnaliseAula(ex.id) };
}

const ehErro = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e as EducacionalError;
  }
};

describe("leitura e criação", () => {
  it("semente: uma análise pronta e sem decisão, na lista da aula; a transcrição não volta", async () => {
    const { aulaId, analise } = await exemplo();
    expect(analise).toMatchObject({ status: "pronta", decidida_em: null, aula_id: aulaId });
    expect(analise.analise?.pilares.map((p) => p.pilar)).toEqual(["entendeu", "aplicou", "validou"]);
    expect(analise.analise?.pilares.find((p) => p.pilar === "validou")?.notaSugerida).toBeNull();
    expect(analise.analise?.checkpoints.filter((c) => c.situacao === "parece_cumprido")).toHaveLength(1);
    expect((await listarAnalisesDaAula(aulaId)).map((x) => x.id)).toContain("ana-exemplo");
    expect(JSON.stringify(analise)).not.toMatch(/transcricao/);
  });

  it("cria em processando; 8 s depois fica pronta; a mais nova vem primeiro na lista", async () => {
    const { aulaId } = await exemplo();
    vi.useFakeTimers({ toFake: ["Date"] });
    const { id } = await criarAnaliseAula(aulaId, { transcricao: TEXTO });
    expect((await buscarAnaliseAula(id)).status).toBe("processando");
    expect((await buscarAnaliseAula(id)).analise).toBeNull();
    vi.setSystemTime(Date.now() + 9000);
    const pronta = await buscarAnaliseAula(id);
    expect(pronta.status).toBe("pronta");
    expect(pronta.analise?.resumo).toBeTruthy();
    expect((await listarAnalisesDaAula(aulaId))[0].id).toBe(id);
  });

  it("arquivo .txt e .docx em multipart; formato e tamanho barrados antes de enviar", async () => {
    const { aulaId } = await exemplo();
    await expect(criarAnaliseAula(aulaId, { arquivo: new File([TEXTO], "aula.txt", { type: "text/plain" }) })).resolves.toHaveProperty("id");
    await expect(criarAnaliseAula(aulaId, { arquivo: new File(["x"], "aula.docx") })).resolves.toHaveProperty("id");
    expect((await ehErro(criarAnaliseAula(aulaId, { arquivo: new File(["x"], "aula.pdf") })))?.corpo.campo).toBe("arquivo");
    const grande = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "aula.txt");
    expect((await ehErro(criarAnaliseAula(aulaId, { arquivo: grande })))?.corpo.mensagem).toMatch(/limite é 4 MB/);
  });

  it("transcrição curta é 400; aula inexistente é 404; erro simulado termina em erro com o motivo", async () => {
    const { aulaId } = await exemplo();
    expect((await ehErro(criarAnaliseAula(aulaId, { transcricao: "curta demais" })))?.status).toBe(400);
    expect((await ehErro(criarAnaliseAula("nao-existe", { transcricao: TEXTO })))?.status).toBe(404);
    const hoje = hojeBR();
    const banco = carregarBanco(hoje);
    const agora = new Date().toISOString();
    const ctx = { usuario: { id: "u", nome: "U" }, hoje, agora };
    const { id } = atender(banco, { metodo: "POST", caminho: "analises", corpo: { aula_id: aulaId, transcricao: TEXTO, simular_erro: "1" } }, ctx) as { id: string };
    const depois = { ...ctx, agora: new Date(Date.now() + 9000).toISOString() };
    const r = atender(banco, { metodo: "GET", caminho: `analises/${id}` }, depois) as { status: string; erro: string; analise: unknown };
    expect([r.status, r.analise, Boolean(r.erro)]).toEqual(["erro", null, true]);
  });
});

describe("situação na lista de aulas (backend f4154a5)", () => {
  it("toda aula da ficha traz a chave: o resumo da última análise ou null", async () => {
    const { aulaId, aluno } = await exemplo();
    expect(aluno.aulas.every((x) => "analise" in x)).toBe(true);
    expect(aluno.aulas.find((x) => x.id === aulaId)?.analise).toEqual({ id: "ana-exemplo", status: "pronta", decidida: false, situacao: null });
    const outra = aluno.aulas.find((x) => x.id !== aulaId)!;
    expect(outra.analise).toBeNull();
    await criarAnaliseAula(outra.id, { transcricao: TEXTO });
    const depois = await buscarAluno(aluno.id);
    expect(depois.aulas.find((x) => x.id === outra.id)?.analise).toMatchObject({ status: "processando", decidida: false });
  });

  it("o contrato separa chave ausente (undefined) de null", () => {
    const aula = { id: "a", numero: 1, data: "2026-11-14", hora: null, mentor: null, status: "feito", observacao: null };
    expect(AulaSchema.parse(aula).analise).toBeUndefined();
    expect(AulaSchema.parse({ ...aula, analise: null }).analise).toBeNull();
    expect(AulaSchema.parse({ ...aula, analise: { id: "x", status: "pronta", decidida: false } }).analise).toEqual({ id: "x", status: "pronta", decidida: false, situacao: null });
  });
});

describe("central de análises (backend 40d18c8)", () => {
  it("todas as análises, mais nova primeiro, com os totais das cinco situações; a lista não traz conteúdo", async () => {
    const r = await listarAnalises();
    expect(r.totais).toEqual({ analisando: 0, interrompida: 1, aguardando_decisao: 1, decidida: 1, erro: 1 });
    expect(r.total).toBe(4);
    const datas = r.itens.map((x) => x.criada_em ?? "");
    expect(datas).toEqual([...datas].sort().reverse());
    expect(r.itens.find((x) => x.id === "ana-exemplo")).toMatchObject({ situacao: "aguardando_decisao", alertas: 1, descartes: 1, criada_por_nome: "Mariana (exemplo)" });
    expect(r.itens.find((x) => x.id === "ana-decidida")).toMatchObject({ situacao: "decidida", decidida: true, decidida_por_nome: "Mariana (exemplo)" });
    const corpo = JSON.stringify(r);
    expect(corpo).not.toMatch(/transcricao|resumo|justificativa|trecho/);
  });

  it("filtro por situação não muda os totais; aluno e período recortam os dois", async () => {
    const tudo = await listarAnalises();
    const erro = await listarAnalises({ situacao: "erro" });
    expect(erro.itens.map((x) => x.situacao)).toEqual(["erro"]);
    expect(erro.totais).toEqual(tudo.totais);
    const ex = tudo.itens.find((x) => x.id === "ana-exemplo")!;
    const doAluno = await listarAnalises({ aluno_id: ex.aluno.id });
    expect(doAluno.itens.every((x) => x.aluno.id === ex.aluno.id)).toBe(true);
    expect(doAluno.totais.aguardando_decisao).toBe(1);
    const futuro = await listarAnalises({ de: "2099-01-01" });
    expect([futuro.total, Object.values(futuro.totais).every((n) => n === 0)]).toEqual([0, true]);
  });

  it("interrompida (processando há mais de 30 min) vem com a situação também na leitura individual; refazer cria outra na mesma aula", async () => {
    const travada = await buscarAnaliseAula("ana-interrompida");
    expect([travada.status, travada.situacao]).toEqual(["processando", "interrompida"]);
    const { id } = await criarAnaliseAula(travada.aula_id, { transcricao: TEXTO });
    const nova = await buscarAnaliseAula(id);
    expect([nova.aula_id, nova.situacao]).toEqual([travada.aula_id, "analisando"]);
    expect((await listarAnalisesDaAula(travada.aula_id))[0].id).toBe(id);
    expect((await listarAnalises()).totais.analisando).toBe(1);
  });

  it("query estrita: página de 20; situação inválida e período invertido são 400; aula arquivada vem sem número", async () => {
    expect(queryDaCentral({ pagina: 2, situacao: "erro", de: "2026-11-01", ate: "2026-11-17" })).toBe(
      "pagina=2&por_pagina=20&situacao=erro&de=2026-11-01&ate=2026-11-17",
    );
    const hoje = hojeBR();
    const banco = carregarBanco(hoje);
    const agora = new Date().toISOString();
    const pedir = (qs: string) => {
      try {
        return centralDeAnalises(banco, new URLSearchParams(qs), agora);
      } catch (e) {
        return (e as { status: number }).status;
      }
    };
    expect(pedir("situacao=talvez")).toBe(400);
    expect(pedir("de=2026-11-10&ate=2026-11-01")).toBe(400);
    expect(pedir("ordem=nome")).toBe(400);
    const ex = banco.analises_aula!.find((x) => x.id === "ana-exemplo")!;
    banco.aulas.find((x) => x.id === ex.aula_id)!.arquivado_em = agora;
    const r = pedir("") as ReturnType<typeof centralDeAnalises>;
    expect(r.itens.find((x) => x.id === "ana-exemplo")?.aula.numero).toBeNull();
    expect(r.itens.find((x) => x.id === "ana-exemplo")?.aula.data).toBeTruthy();
  });
});

describe("decidir", () => {
  function pedido(aluno: AlunoDetalhe, cpId: string): PedidoDecisao {
    return {
      versao: aluno.versao,
      pilares: [
        { pilar: "entendeu", decisao: "aprovar" },
        { pilar: "aplicou", decisao: "editar", nota: 65 },
      ],
      checkpoints: [{ id: cpId, decisao: "aprovar" }],
      motivo: "Revisado na reunião de equipe",
    };
  }

  it("aplica numa versão só: nota aprovada, nota editada com motivo, checkpoint realizado; a análise fica decidida", async () => {
    const { aluno, analise } = await exemplo();
    const p = analise.analise!;
    const sugerida = p.pilares.find((x) => x.pilar === "entendeu")!.notaSugerida!;
    const cp = p.checkpoints.find((c) => c.situacao === "parece_cumprido")!.id;
    const r = await decidirAnalise(analise.id, pedido(aluno, cp));
    expect(r.aluno.versao).toBe(aluno.versao + 1);
    expect(r.aluno.progresso.entendeu.valor).toBe(sugerida);
    expect(r.aluno.progresso.aplicou.valor).toBe(65);
    expect(r.aluno.progresso.aplicou.ajuste?.motivo).toBe(
      `Análise de aula por IA: sugerido pela IA (nota ${p.pilares.find((x) => x.pilar === "aplicou")!.notaSugerida}), aprovado por Equipe Teste (nota 65) · Revisado na reunião de equipe`,
    );
    expect(r.aluno.checkpoints.find((c) => c.id === cp)?.status).toBe("realizado");
    expect(r.analise.decidida_em).toBeTruthy();
    expect([r.analise.decidida_por, r.analise.decidida_por_nome]).toEqual(["u-edu", "Equipe Teste"]);
    // A aula, na ficha relida, já diz que a análise foi decidida.
    expect(r.aluno.aulas.find((x) => x.id === analise.aula_id)?.analise).toEqual({ id: analise.id, status: "pronta", decidida: true, situacao: null });
    // Validou (sem nota sugerida) não muda.
    expect(r.aluno.progresso.validou.valor).toBe(aluno.progresso.validou.valor);
    // Decidir de novo: 409 ja_decidida.
    const de2 = await ehErro(decidirAnalise(analise.id, { ...pedido(r.aluno, cp), versao: r.aluno.versao }));
    expect([de2?.status, de2?.corpo.error]).toEqual([409, "ja_decidida"]);
  });

  it("versão velha: 409 com o aluno atual, nada aplicado e a análise continua pendente", async () => {
    const { aluno, analise } = await exemplo();
    const cp = analise.analise!.checkpoints.find((c) => c.situacao === "parece_cumprido")!.id;
    const e = await ehErro(decidirAnalise(analise.id, { ...pedido(aluno, cp), versao: aluno.versao - 1 }));
    expect([e?.status, e?.corpo.error, e?.alunoAtual?.versao]).toEqual([409, "versao", aluno.versao]);
    expect((await buscarAnaliseAula(analise.id)).decidida_em).toBeNull();
    expect((await buscarAluno(aluno.id)).versao).toBe(aluno.versao);
  });

  it("corpo: nota proibida em aprovar, obrigatória em editar; pilar sem sugestão não se aprova; algum item é obrigatório", async () => {
    const { aluno, analise } = await exemplo();
    const base = { versao: aluno.versao, checkpoints: [] };
    const status = async (pilares: unknown[]) =>
      (await ehErro(decidirAnalise(analise.id, { ...base, pilares } as unknown as PedidoDecisao)))?.status;
    expect(await status([{ pilar: "entendeu", decisao: "aprovar", nota: 70 }])).toBe(400);
    expect(await status([{ pilar: "entendeu", decisao: "editar" }])).toBe(400);
    expect(await status([{ pilar: "validou", decisao: "aprovar" }])).toBe(400);
    expect(await status([])).toBe(400);
    // Só rejeitar: a análise fica decidida e a ficha não muda de versão.
    const r = await decidirAnalise(analise.id, { ...base, pilares: [{ pilar: "entendeu", decisao: "rejeitar" }] });
    expect([r.aluno.versao, Boolean(r.analise.decidida_em)]).toEqual([aluno.versao, true]);
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
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

  it("texto colado vai em JSON { aula_id, transcricao }; arquivo vai em multipart (aula_id + arquivo)", async () => {
    const api = await adapterApi();
    fetchMock.mockImplementation(async () => json({ id: "an-1", status: "processando" }, 202));
    await api.criarAnaliseAula("aula-1", { transcricao: TEXTO });
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect([url, init.method]).toEqual(["/api/educacional/analises", "POST"]);
    expect(JSON.parse(init.body as string)).toEqual({ aula_id: "aula-1", transcricao: TEXTO });
    await api.criarAnaliseAula("aula-1", { arquivo: new File([TEXTO], "aula.docx") });
    [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const fd = init.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    expect([fd.get("aula_id"), (fd.get("arquivo") as File).name]).toEqual(["aula-1", "aula.docx"]);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("503 config_ausente é reconhecido; decidir relê o aluno para a ficha", async () => {
    const api = await adapterApi();
    fetchMock.mockResolvedValueOnce(json({ error: "config_ausente" }, 503));
    const e = await ehErro(api.criarAnaliseAula("aula-1", { transcricao: TEXTO }));
    expect(api.configAusente(e)).toBe(true);
    const analise = { id: "an-1", aula_id: "aula-1", aluno_id: "al-1", status: "pronta", analise: null, decidida_em: "2026-11-16T12:00:00Z", decidida_por: "u-1" };
    fetchMock.mockResolvedValueOnce(json({ versao: 4, analise }));
    const detalhe = await buscarAluno((await buscarAlunos({})).itens[0].id);
    fetchMock.mockResolvedValueOnce(json(detalhe));
    const r = await api.decidirAnalise("an-1", { versao: 3, pilares: [{ pilar: "entendeu", decisao: "aprovar" }], checkpoints: [] });
    expect([r.aluno.id, r.analise.id]).toEqual([detalhe.id, "an-1"]);
    const chamadas = fetchMock.mock.calls.slice(1).map(([u, i]) => `${(i as RequestInit).method} ${u}`);
    expect(chamadas).toEqual(["POST /api/educacional/analises/an-1/decidir", "GET /api/educacional/alunos/al-1"]);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      versao: 3,
      pilares: [{ pilar: "entendeu", decisao: "aprovar" }],
      checkpoints: [],
    });
  });
});
