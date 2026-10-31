import { beforeEach, describe, expect, it } from "vitest";
import {
  _simularGravacaoEmTeste,
  arquivarComentario,
  buscarAlunos,
  buscarMural,
  comentar,
  definirUsuarioDaSessao,
  EducacionalError,
  editarComentario,
  enviarImagemDoMural,
  erroDaImagemDoMural,
  salvarLote,
  TAMANHO_PAGINA_MURAL,
} from "./apiEducacional";
import { ItemMuralSchema } from "./contrato";
import { _zerarMemoria } from "./mock/banco";

// Entrega 2, M2: mural do aluno no modo demonstração (rotas provisórias até o
// plano do backend). Comentários e histórico juntos, mais recente primeiro.

const EU = { id: "u-edu", nome: "Equipe Teste" };
const OUTRA = { id: "u-outra", nome: "Outra Pessoa" };

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao(EU);
});

async function erroDe(p: Promise<unknown>): Promise<EducacionalError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof EducacionalError) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

async function primeiroAluno() {
  return (await buscarAlunos({ por_pagina: "todos" })).itens[0];
}

// O comentário como a tela recebe: a escrita devolve só o id.
async function comentarioNoMural(alunoId: string, texto: string) {
  const { itens } = await buscarMural(alunoId, { tipo: "comentario" });
  const c = itens.find((x) => x.tipo === "comentario" && x.texto === texto);
  if (c?.tipo !== "comentario") throw new Error(`comentário "${texto}" não apareceu no mural`);
  return c;
}

// Aluno com comentários da semente (com imagem).
async function alunoComComentarios() {
  for (const a of (await buscarAlunos({ por_pagina: "todos" })).itens) {
    const { itens } = await buscarMural(a.id, { tipo: "comentario" });
    if (itens.some((x) => x.tipo === "comentario" && x.imagens.length)) return a;
  }
  throw new Error("semente sem comentários");
}

const png = (nome = "print.png", bytes = 64, tipo = "image/png") => new File([new Uint8Array(bytes)], nome, { type: tipo });

describe("mural — leitura", () => {
  it("comentários e alterações juntos, do mais recente ao mais antigo; os da semente não são editáveis", async () => {
    const a = await alunoComComentarios();
    const { itens } = await buscarMural(a.id);
    expect(itens.some((x) => x.tipo === "comentario")).toBe(true);
    expect(itens.some((x) => x.tipo === "historico")).toBe(true);
    const datas = itens.map((x) => x.em);
    expect(datas).toEqual([...datas].sort().reverse());
    const comImagem = itens.find((x) => x.tipo === "comentario" && x.imagens.length);
    expect(comImagem && comImagem.tipo === "comentario" && [comImagem.pode_editar, comImagem.imagens[0].nome]).toEqual([false, "funil-da-semana.svg"]);
  });

  it("“Mostrar mais”: o cursor continua de onde parou, sem repetir", async () => {
    const a = await primeiroAluno();
    // Histórico suficiente para duas páginas.
    for (let i = 0; i < TAMANHO_PAGINA_MURAL; i += 1) await comentar(a.id, { texto: `Nota ${i}`, imagens: [] });
    const p1 = await buscarMural(a.id);
    expect(p1.itens).toHaveLength(TAMANHO_PAGINA_MURAL);
    expect(p1.proximo).toEqual(expect.any(String));
    const p2 = await buscarMural(a.id, { cursor: p1.proximo });
    const ids1 = new Set(p1.itens.map((x) => x.id));
    expect(p2.itens.length).toBeGreaterThan(0);
    expect(p2.itens.some((x) => ids1.has(x.id))).toBe(false);
    expect(p2.itens[0].em <= p1.itens.at(-1)!.em).toBe(true);
  });

  it("filtro: só comentários, ou só um tipo de alteração", async () => {
    const a = await alunoComComentarios();
    const so = await buscarMural(a.id, { tipo: "comentario" });
    expect(so.itens.length).toBeGreaterThan(0);
    expect(so.itens.every((x) => x.tipo === "comentario")).toBe(true);
    const alunoSo = await buscarMural(a.id, { tipo: "aluno" });
    expect(alunoSo.itens.every((x) => x.tipo === "historico" && x.tipos.includes("aluno"))).toBe(true);
  });

  it("item fora do contrato sai sozinho, sem derrubar o mural", () => {
    expect(ItemMuralSchema.safeParse({ tipo: "comentario", id: "c", em: "2026-10-30T10:00:00Z", texto: "oi" }).success).toBe(false);
    expect(ItemMuralSchema.safeParse({ tipo: "reacao", id: "r", em: "2026-10-30T10:00:00Z" }).success).toBe(false);
    const ok = ItemMuralSchema.parse({ tipo: "comentario", id: "c", em: "2026-10-30T10:00:00Z", texto: "oi", autor: EU });
    expect(ok.tipo === "comentario" && [ok.imagens, ok.editado_em, ok.pode_editar]).toEqual([[], null, false]);
  });

  it("um “Salvar” de vários campos vira um cartão só, com o total e os tipos", async () => {
    const a = await primeiroAluno();
    await salvarLote({ alunos: [{ aluno_id: a.id, versao: a.versao, campos: { objetivo: "Novo objetivo", observacoes: "Nova observação" } }] });
    const { itens } = await buscarMural(a.id, { tipo: "aluno" });
    const cartao = itens[0];
    if (cartao.tipo !== "historico") throw new Error("esperava o cartão do histórico");
    expect(cartao.id).toMatch(/^lote:/);
    expect([cartao.titulo, cartao.total_mudancas, cartao.tipos, cartao.autor]).toEqual(["2 alterações na ficha", 2, ["aluno"], EU]);
    expect(cartao.mudancas.map((m) => m.campo).sort()).toEqual(["objetivo", "observacoes"]);
    expect(itens.filter((x) => x.id === cartao.id)).toHaveLength(1);
  });

  it("aceita o cartão no formato do backend, e um tipo novo não derruba o cartão", () => {
    const r = ItemMuralSchema.safeParse({
      tipo: "historico",
      id: "lote:9f3e",
      em: "2026-10-31T14:32:00.000Z",
      autor: EU,
      origem: "planilha",
      lote_id: "9f3e",
      tipos: ["aluno", "config"],
      titulo: "60 alterações na ficha",
      total_mudancas: 60,
      mudancas: [{ entidade: "config", entidade_id: null, campo: "x", rotulo: "X", de: null, para: 1, motivo: null }],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.tipo === "historico" && [r.data.origem, r.data.total_mudancas]).toEqual(["planilha", 60]);
  });
});

describe("mural — comentários", () => {
  it("comentar grava na hora e não muda a versão do aluno; o autor edita e arquiva", async () => {
    const a = await primeiroAluno();
    await comentar(a.id, { texto: "  Primeira conversa ótima.  ", imagens: [] });
    const c = await comentarioNoMural(a.id, "Primeira conversa ótima.");
    expect([c.pode_editar, c.editado_em, c.autor]).toEqual([true, null, EU]);
    expect((await buscarMural(a.id)).itens[0].id).toBe(c.id);
    expect((await buscarAlunos({ por_pagina: "todos" })).itens[0].versao).toBe(a.versao);
    // A ficha continua salvando com a mesma versão.
    const r = await salvarLote({ alunos: [{ aluno_id: a.id, versao: a.versao, campos: { objetivo: "Depois do comentário" } }] });
    expect(r.resultados[0].ok).toBe(true);
    await editarComentario(c.id, { texto: "Primeira conversa excelente." });
    expect((await comentarioNoMural(a.id, "Primeira conversa excelente.")).editado_em).toEqual(expect.any(String));
    await arquivarComentario(c.id);
    expect((await buscarMural(a.id)).itens.some((x) => x.id === c.id)).toBe(false);
  });

  it("de outra pessoa: aparece sem editar; editar ou arquivar é recusado em português", async () => {
    const a = await primeiroAluno();
    definirUsuarioDaSessao(OUTRA);
    await comentar(a.id, { texto: "Comentário dela", imagens: [] });
    definirUsuarioDaSessao(EU);
    const dela = await comentarioNoMural(a.id, "Comentário dela");
    expect(dela.pode_editar).toBe(false);
    const e = await erroDe(editarComentario(dela.id, { texto: "Mudei" }));
    expect([e.status, e.message]).toEqual([403, "Só quem escreveu o comentário pode editar ou arquivar."]);
    expect((await erroDe(arquivarComentario(dela.id))).status).toBe(403);
  });

  it("vazio é recusado; só imagem vale", async () => {
    const a = await primeiroAluno();
    const e = await erroDe(comentar(a.id, { texto: "   ", imagens: [] }));
    expect([e.status, e.corpo.campo, e.message]).toEqual([400, "texto", "Escreva um comentário ou anexe uma imagem."]);
    const img = await enviarImagemDoMural(png());
    await comentar(a.id, { texto: "", imagens: [img.id] });
    expect((await comentarioNoMural(a.id, "")).imagens).toEqual([{ id: img.id, url: expect.stringMatching(/^data:image\/png;base64,/), nome: "print.png" }]);
  });
});

describe("mural — imagens", () => {
  it("formato e tamanho conferidos antes de enviar, com o nome do arquivo", async () => {
    expect(erroDaImagemDoMural(png("foto.bmp", 10, "image/bmp"))).toBe("“foto.bmp”: formato não aceito. Envie PNG, JPG, WEBP ou GIF.");
    expect(erroDaImagemDoMural({ name: "grande.jpg", type: "image/jpeg", size: 5.2 * 1024 * 1024 })).toBe(
      "“grande.jpg” tem 5,2 MB e o limite é 4 MB por imagem.",
    );
    expect(erroDaImagemDoMural(png())).toBeNull();
    const e = await erroDe(enviarImagemDoMural(png("doc.pdf", 10, "application/pdf")));
    expect([e.status, e.corpo.campo]).toEqual([400, "arquivo"]);
  });

  it("imagem de outra pessoa ou inexistente não entra no comentário; no máximo 5", async () => {
    const a = await primeiroAluno();
    definirUsuarioDaSessao(OUTRA);
    const dela = await enviarImagemDoMural(png("dela.png"));
    definirUsuarioDaSessao(EU);
    const e = await erroDe(comentar(a.id, { texto: "Com a imagem dela", imagens: [dela.id] }));
    expect([e.corpo.campo, e.message]).toEqual(["imagens", "Uma das imagens não foi encontrada. Anexe de novo."]);
    const minhas = await Promise.all(Array.from({ length: 6 }, (_, i) => enviarImagemDoMural(png(`p${i}.png`))));
    const muitas = await erroDe(comentar(a.id, { texto: "Muitas", imagens: minhas.map((x) => x.id) }));
    expect(muitas.message).toBe("No máximo 5 imagens por comentário.");
    await comentar(a.id, { texto: "Cinco", imagens: minhas.slice(0, 5).map((x) => x.id) });
    expect((await comentarioNoMural(a.id, "Cinco")).imagens).toHaveLength(5);
  });

  it("editar troca as imagens (tirar uma, pôr outra)", async () => {
    const a = await primeiroAluno();
    const [i1, i2] = [await enviarImagemDoMural(png("um.png")), await enviarImagemDoMural(png("dois.png"))];
    await comentar(a.id, { texto: "Prints", imagens: [i1.id] });
    await editarComentario((await comentarioNoMural(a.id, "Prints")).id, { imagens: [i2.id] });
    expect((await comentarioNoMural(a.id, "Prints")).imagens.map((x) => x.nome)).toEqual(["dois.png"]);
  });
});
