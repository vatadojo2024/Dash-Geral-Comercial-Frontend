import { beforeEach, describe, expect, it } from "vitest";
import { alteracaoDaAula, alteracaoDeCampo, aulaArquivada, aulaNova, lerDoServidor } from "@/features/educacional/lote/alteracoes";
import { aplicarResposta, comPendencias, montarPedido, paraEnviar, registrar, SEM_PENDENCIAS } from "@/features/educacional/lote/pendencias";
import {
  _simularGravacaoEmTeste,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  criarAluno,
  criarItemConfig,
  definirUsuarioDaSessao,
  salvarLote,
  trocarPrograma,
} from "./apiEducacional";
import { AlunoDetalheSchema, validarAlunoDetalhe, type AlunoDetalhe } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { hojeBR } from "./mock/motor";

// Entrega 2, M1: aulas do aluno no modo demonstração (nomes provisórios até o
// plano do backend). Gravam pelo lote, como checkpoints e intervenções.

const HOJE = hojeBR();
const CONTATO = { email: "ana@exemplo.com", telefone: "(11) 91234-5678", discord: "ana_edu" };

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

async function comAulas(): Promise<AlunoDetalhe> {
  const { itens } = await buscarAlunos({ por_pagina: "todos" });
  for (const l of itens) {
    const a = await buscarAluno(l.id);
    if (a.aulas.length >= 3 && a.total_aulas != null) return a;
  }
  throw new Error("semente sem aluno com aulas");
}

async function salvar(a: AlunoDetalhe, ...alts: Parameters<typeof registrar>[2][]) {
  let p = SEM_PENDENCIAS;
  for (const alt of alts) p = registrar(p, a, alt);
  const enviar = paraEnviar(p);
  const resposta = await salvarLote(montarPedido(enviar));
  return { pedido: montarPedido(enviar), resposta, apuracao: aplicarResposta(p, enviar, resposta) };
}

describe("aulas — leitura", () => {
  it("semente: aulas com mentor, total do programa, aplicadas = Feito e saldo = total − aplicadas", async () => {
    const a = await comAulas();
    const feitas = a.aulas.filter((x) => x.status === "feito").length;
    expect(a.aulas_aplicadas).toBe(feitas);
    expect(a.saldo_aulas).toBe((a.total_aulas ?? 0) - feitas);
    expect(a.aulas.every((x) => x.nome.startsWith("Aula ") && x.mentor?.nome)).toBe(true);
    const datas = a.aulas.map((x) => x.data ?? "");
    expect(datas).toEqual([...datas].sort());
  });

  it("API sem os campos novos: lista vazia e contadores sem cálculo; aula fora do contrato sai sozinha", async () => {
    const a = await comAulas();
    const { aulas: _a, total_aulas: _t, aulas_aplicadas: _p, saldo_aulas: _s, ...antigo } = a;
    const lido = AlunoDetalheSchema.parse(antigo);
    expect([lido.aulas, lido.total_aulas, lido.aulas_aplicadas, lido.saldo_aulas]).toEqual([[], null, null, null]);
    const comRuim = validarAlunoDetalhe({ ...a, aulas: [...a.aulas, { id: "x", nome: "Aula X", data: null, mentor: null, status: "talvez" }] });
    expect(comRuim?.aulas).toHaveLength(a.aulas.length);
  });
});

describe("aulas — gravação pela ficha (lote)", () => {
  it("criar, mudar status e arquivar no mesmo salvar; aplicadas e saldo voltam recalculados", async () => {
    const a = await comAulas();
    const c = await buscarConfig();
    const mentor = c.responsaveis.find((r) => r.ativo)!;
    const agendada = a.aulas.find((x) => x.status !== "feito")!;
    const outra = a.aulas.find((x) => x.id !== agendada.id && x.status === "feito")!;
    const { pedido, resposta } = await salvar(
      a,
      aulaNova("t1", { nome: "Aula extra", data: HOJE, mentor_id: mentor.id, status: "feito" }, { mentor }),
      alteracaoDaAula(agendada, { status: "feito" }),
      aulaArquivada(outra),
    );
    expect(pedido.alunos[0].aulas).toEqual([
      { novo: true, nome: "Aula extra", data: HOJE, mentor_id: mentor.id, status: "feito" },
      { id: agendada.id, status: "feito" },
      { id: outra.id, arquivar: true },
    ]);
    const r = resposta.resultados[0];
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const depois = r.aluno;
    expect(depois.aulas.some((x) => x.id === outra.id)).toBe(false);
    expect(depois.aulas.find((x) => x.nome === "Aula extra")?.mentor?.nome).toBe(mentor.nome);
    // +1 nova feita, +1 que virou feita, −1 feita arquivada.
    expect(depois.aulas_aplicadas).toBe((a.aulas_aplicadas ?? 0) + 1);
    expect(depois.saldo_aulas).toBe((a.saldo_aulas ?? 0) - 1);
    expect(depois.versao).toBe(a.versao + 1);
  });

  it("total de aulas é campo do aluno, editável sem motivo; inválido volta em português", async () => {
    const a = await comAulas();
    const ok = (await salvar(a, alteracaoDeCampo(a, "total_aulas", 60))).resposta.resultados[0];
    expect(ok.ok && [ok.aluno.total_aulas, ok.aluno.saldo_aulas]).toEqual([60, 60 - (a.aulas_aplicadas ?? 0)]);
    const atual = await buscarAluno(a.id);
    const ruim = (await salvar(atual, alteracaoDeCampo(atual, "total_aulas", 2.5))).apuracao.pendencias[a.id];
    expect(ruim.erro).toMatchObject({
      tipo: "validacao",
      campo: "total_aulas",
      chave: "campo:total_aulas",
      mensagem: "Total de aulas: use um número inteiro de aulas, 0 ou mais, ou deixe em branco.",
    });
  });

  it("mentor inativo ou inexistente: erro marcado na linha da aula", async () => {
    const a = await comAulas();
    const x = a.aulas[0];
    const { apuracao } = await salvar(a, alteracaoDaAula(x, { mentor_id: "nao-existe" }));
    expect(apuracao.pendencias[a.id].erro).toMatchObject({ campo: "mentor_id", chave: `aula:${x.id}` });
  });

  it("na tela: a pendência aparece por cima (nova no fim, status trocado, arquivada some)", async () => {
    const a = await comAulas();
    const [x, y] = a.aulas;
    let p = registrar(SEM_PENDENCIAS, a, alteracaoDaAula(x, { status: "no_show" }));
    p = registrar(p, a, aulaArquivada(y));
    p = registrar(p, a, aulaNova("t2", { nome: "Aula nova", status: "agendada" }, {}));
    const tela = comPendencias(a, p[a.id]);
    expect(tela.aulas.find((z) => z.id === x.id)?.status).toBe("no_show");
    expect(tela.aulas.some((z) => z.id === y.id)).toBe(false);
    expect(tela.aulas.at(-1)).toMatchObject({ id: "novo:t2", nome: "Aula nova", status: "agendada" });
    // Voltar ao valor do servidor desfaz a alteração.
    expect(registrar(p, a, alteracaoDaAula(x, { status: x.status }))[a.id].alteracoes[`aula:${x.id}`]).toBeUndefined();
  });

  it("reaplicar depois do 409: relê a aula do servidor; aula arquivada por outro sai", async () => {
    const a = await comAulas();
    const x = a.aulas[0];
    expect(lerDoServidor(alteracaoDaAula(x, { status: "cancelada" }), a)).toEqual({ anterior: { status: x.status }, antes: expect.any(String) });
    expect(lerDoServidor(alteracaoDaAula(x, { status: "cancelada" }), { ...a, aulas: [] })).toBeNull();
  });
});

describe("total de aulas do programa", () => {
  it("cadastro e troca copiam o total do programa", async () => {
    const c = await buscarConfig();
    const bb12 = c.programas.find((p) => p.nome === "Blackbelt 12 meses")!;
    const prime6 = c.programas.find((p) => p.nome === "Prime 6 meses")!;
    expect([bb12.total_aulas, prime6.total_aulas]).toEqual([53, 12]);
    const novo = await criarAluno({ ...CONTATO, nome: "Ana", programa_id: bb12.id, data_entrada: HOJE, nivel_inicial: "iniciante", etapa_id: c.etapas[0].id });
    expect([novo.total_aulas, novo.aulas_aplicadas, novo.saldo_aulas, novo.aulas]).toEqual([53, 0, 53, []]);
    const trocado = await trocarPrograma(novo.id, novo.versao, { programa_id: prime6.id, data_inicio: HOJE, motivo: "Mudou de programa" });
    expect(trocado.total_aulas).toBe(12);
  });

  it("Configurações → Programas aceita o total (vazio = sem total)", async () => {
    const config = await criarItemConfig("programas", { nome: "TESTE — programa", mentoria: "Prime", duracao_meses: 3, total_aulas: 10 });
    expect(config.programas.find((p) => p.nome === "TESTE — programa")?.total_aulas).toBe(10);
    const sem = await criarItemConfig("programas", { nome: "TESTE — sem total", mentoria: "Prime", duracao_meses: 3 });
    expect(sem.programas.find((p) => p.nome === "TESTE — sem total")?.total_aulas).toBeNull();
  });
});
