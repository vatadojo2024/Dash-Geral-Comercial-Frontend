import { beforeEach, describe, expect, it } from "vitest";
import { alteracaoDaAula, alteracaoDeCampo, aulaArquivada, aulaNova, lerDoServidor } from "@/features/educacional/lote/alteracoes";
import { aplicarResposta, comPendencias, montarPedido, paraEnviar, registrar, SEM_PENDENCIAS } from "@/features/educacional/lote/pendencias";
import {
  _simularGravacaoEmTeste,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  criarAluno,
  criarAula,
  criarItemConfig,
  definirUsuarioDaSessao,
  salvarLote,
  trocarPrograma,
} from "./apiEducacional";
import { AlunoDetalheSchema, validarAlunoDetalhe, type AlunoDetalhe } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { ROTULO_STATUS_AULA } from "./rotulos";
import { hojeBR } from "./mock/motor";

// Entrega 2, M1: aulas do aluno no modo demonstração, no contrato do plano do
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
    // Número pela ordem de data e hora (o backend calcula; o mock imita).
    expect(a.aulas.map((x) => x.numero)).toEqual(a.aulas.map((_, i) => i + 1));
    expect(a.aulas.every((x) => x.mentor?.nome)).toBe(true);
    expect(a.aulas.some((x) => x.hora) && a.aulas.some((x) => !x.hora)).toBe(true);
    const datas = a.aulas.map((x) => x.data ?? "");
    expect(datas).toEqual([...datas].sort());
  });

  it("API sem os campos novos: lista vazia e contadores sem cálculo; aula fora do contrato sai sozinha", async () => {
    const a = await comAulas();
    const { aulas: _a, total_aulas: _t, aulas_aplicadas: _p, saldo_aulas: _s, ...antigo } = a;
    const lido = AlunoDetalheSchema.parse(antigo);
    expect([lido.aulas, lido.total_aulas, lido.aulas_aplicadas, lido.saldo_aulas]).toEqual([[], null, null, null]);
    const comRuim = validarAlunoDetalhe({ ...a, aulas: [...a.aulas, { id: "x", numero: 99, data: null, mentor: null, status: "talvez" }] });
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
      aulaNova("t1", { data: HOJE, hora: "23:59", mentor_id: mentor.id, status: "feito", observacao: "Aula extra" }, { mentor }),
      alteracaoDaAula(agendada, { status: "feito" }),
      aulaArquivada(outra),
    );
    expect(pedido.alunos[0].aulas).toEqual([
      { novo: true, data: HOJE, hora: "23:59", mentor_id: mentor.id, status: "feito", observacao: "Aula extra" },
      { id: agendada.id, status: "feito" },
      { id: outra.id, arquivar: true },
    ]);
    const r = resposta.resultados[0];
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const depois = r.aluno;
    expect(depois.aulas.some((x) => x.id === outra.id)).toBe(false);
    const extra = depois.aulas.find((x) => x.observacao === "Aula extra");
    expect([extra?.mentor?.nome, extra?.hora]).toEqual([mentor.nome, "23:59"]);
    expect(depois.aulas.map((x) => x.numero)).toEqual(depois.aulas.map((_, i) => i + 1));
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
    p = registrar(p, a, aulaNova("t2", { data: HOJE, status: "agendada" }, {}));
    const tela = comPendencias(a, p[a.id]);
    expect(tela.aulas.find((z) => z.id === x.id)?.status).toBe("no_show");
    expect(tela.aulas.some((z) => z.id === y.id)).toBe(false);
    expect(tela.aulas.at(-1)).toMatchObject({ id: "novo:t2", numero: null, data: HOJE, status: "agendada" });
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

describe("lista de mentores da aula", () => {
  it("todos os responsáveis ativos, quem é Mentor primeiro; o atual inativo continua na lista", async () => {
    const { opcoesDeMentor } = await import("@/features/educacional/Aulas");
    const c = await buscarConfig();
    const r = (id: string, tipo: "mentor" | "suporte" | "comercial", ativo = true) => ({ id, nome: id, tipo, ativo });
    const config = { ...c, responsaveis: [r("sup", "suporte"), r("m1", "mentor"), r("com", "comercial"), r("m2", "mentor"), r("velho", "mentor", false)] };
    expect(opcoesDeMentor(config, null).map((x) => x.id)).toEqual(["m1", "m2", "sup", "com"]);
    expect(opcoesDeMentor(config, { id: "velho", nome: "velho", tipo: "mentor" }).map((x) => x.id)).toEqual(["m1", "m2", "velho", "sup", "com"]);
  });
});

describe("aula — contrato do backend (30/10)", () => {
  it("data obrigatória e hora no formato HH:MM, com mensagem em português", async () => {
    const a = await comAulas();
    const semData = (await salvar(a, aulaNova("t3", { status: "agendada" }, {}))).apuracao.pendencias[a.id];
    expect(semData.erro).toMatchObject({ campo: "data", mensagem: "Data é obrigatória. Informe a data." });
    const horaRuim = (await salvar(a, aulaNova("t4", { data: HOJE, hora: "25:00" }, {}))).apuracao.pendencias[a.id];
    expect(horaRuim.erro).toMatchObject({ campo: "hora", mensagem: "Use a hora no formato HH:MM (ex.: 19:30) ou deixe em branco." });
  });

  it("rota imediata (Calendário): cria a aula na hora, com a versão do aluno", async () => {
    const a = await comAulas();
    const depois = await criarAula(a.id, a.versao, { data: HOJE, hora: "08:00", status: "agendada" });
    expect(depois.versao).toBe(a.versao + 1);
    expect(depois.aulas.some((x) => x.data === HOJE && x.hora === "08:00")).toBe(true);
    const e = await criarAula(a.id, a.versao, { data: HOJE }).catch((x: unknown) => x);
    expect((e as { status?: number }).status).toBe(409);
  });

  it("texto da alteração pendente: número, data e hora, status", async () => {
    const a = await comAulas();
    const x = a.aulas.find((y) => y.hora)!;
    const alt = alteracaoDaAula(x, { status: "cancelada" });
    expect(alt.antes).toBe(`Aula ${x.numero} · ${x.data!.split("-").reverse().join("/")} · ${x.hora} · ${ROTULO_STATUS_AULA[x.status]}`);
    expect(alt.depois.endsWith("Cancelada")).toBe(true);
  });
});
