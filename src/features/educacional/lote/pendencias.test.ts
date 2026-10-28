import { beforeEach, describe, expect, it } from "vitest";
import { buscarAluno, buscarAlunos, buscarConfig, atualizarAluno, definirUsuarioDaSessao, salvarLote } from "@/lib/educacional/apiEducacional";
import { linhaDoDetalhe, type AlunoDetalhe, type AlunoLinha } from "@/lib/educacional/contrato";
import { _zerarMemoria } from "@/lib/educacional/mock/banco";
import {
  alteracaoDaAcao,
  alteracaoDaEtapa,
  alteracaoDaIntervencao,
  alteracaoDeCampo,
  alteracaoDoAjuste,
  alteracaoDoCheckpoint,
  alteracaoDoNome,
  alteracaoDoProximoCheckpoint,
  alteracaoDoResponsavel,
  checkpointArquivado,
  checkpointNovo,
  intervencaoNova,
  lerDoServidor,
} from "./alteracoes";
import {
  aplicarFalha,
  aplicarResposta,
  comPendencias,
  contar,
  descartar,
  desfazer,
  lerGuardado,
  marcarSalvando,
  montarPedido,
  paraEnviar,
  reaplicar,
  rebasear,
  registrar,
  serializar,
  SEM_PENDENCIAS,
  type Pendencias,
} from "./pendencias";

const USUARIO = { id: "u1", nome: "Vata" };

beforeEach(() => {
  _zerarMemoria();
  definirUsuarioDaSessao(USUARIO);
});

async function doisAlunos(): Promise<[AlunoLinha, AlunoLinha]> {
  const { itens } = await buscarAlunos({ por_pagina: "todos", ordem: "nome" });
  const com = itens.filter((a) => a.proximo_checkpoint && !a.arquivado);
  return [com[0], com[1]];
}

describe("alterações pendentes (armazém puro)", () => {
  it("vale a última; o anterior é o do servidor; voltar ao valor do servidor tira a alteração", async () => {
    const [a] = await doisAlunos();
    let p: Pendencias = registrar(SEM_PENDENCIAS, a, alteracaoDoNome(a, "Nome 1"));
    p = registrar(p, a, alteracaoDoNome(comPendencias(a, p[a.id]), "Nome 2"));
    const alt = p[a.id].alteracoes["campo:nome"];
    expect([alt.valor, alt.anterior, alt.antes]).toEqual(["Nome 2", a.nome, a.nome]);
    expect(comPendencias(a, p[a.id]).nome).toBe("Nome 2");
    expect(contar(p)).toEqual({ alteracoes: 1, alunos: 1 });
    p = registrar(p, a, alteracaoDoNome(comPendencias(a, p[a.id]), a.nome));
    expect(p).toEqual({});
  });

  it("sem pendência a linha é o MESMO objeto (as linhas memorizadas não redesenham)", async () => {
    const [a] = await doisAlunos();
    expect(comPendencias(a, undefined)).toBe(a);
  });

  it("desfazer, descartar (menos o que está em envio) e aluno em envio não aceita edição", async () => {
    const [a, b] = await doisAlunos();
    let p = registrar(SEM_PENDENCIAS, a, alteracaoDoNome(a, "X"));
    p = registrar(p, a, alteracaoDaAcao(a, "Ligar", null));
    p = registrar(p, b, alteracaoDoNome(b, "Y"));
    p = desfazer(p, a.id, "campo:nome");
    expect(Object.keys(p[a.id].alteracoes)).toEqual(["campo:proxima_acao"]);
    p = marcarSalvando(p, [b.id]);
    expect(registrar(p, b, alteracaoDoNome(b, "Z"))).toBe(p);
    expect(desfazer(p, b.id, "campo:nome")).toBe(p);
    expect(Object.keys(descartar(p))).toEqual([b.id]);
    expect(paraEnviar(p).map((e) => e.aluno_id)).toEqual([a.id]);
  });

  it("monta um aluno por entrada: campos juntos, ajustes e checkpoints", async () => {
    const [a] = await doisAlunos();
    const c = await buscarConfig();
    const outra = c.etapas.find((e) => e.ativo && e.id !== a.etapa.id)!;
    let p = registrar(SEM_PENDENCIAS, a, alteracaoDaEtapa(a, outra));
    p = registrar(p, a, alteracaoDoResponsavel(a, null));
    p = registrar(p, a, alteracaoDoAjuste(a, "health_score", { valor: 33, motivo: "Conversa difícil" }, USUARIO)!);
    p = registrar(p, a, alteracaoDoProximoCheckpoint(a, { status: a.proximo_checkpoint!.status === "realizado" ? "pendente" : "realizado" })!);
    const [pedido] = montarPedido(paraEnviar(p)).alunos;
    expect(pedido.aluno_id).toBe(a.id);
    expect(pedido.versao).toBe(a.versao);
    expect(pedido.campos).toEqual(a.responsavel ? { etapa_id: outra.id, responsavel_id: null } : { etapa_id: outra.id });
    expect(pedido.ajustes).toEqual([{ campo: "health_score", valor: 33, motivo: "Conversa difícil" }]);
    expect(pedido.checkpoints).toHaveLength(1);
    // Sobreposição: etapa nova e health score ajustado aparecem; o resto é do servidor.
    const linha = comPendencias(a, p[a.id]);
    expect([linha.etapa.id, linha.health_score.valor, linha.health_score.ajuste?.motivo]).toEqual([outra.id, 33, "Conversa difícil"]);
    expect(linha.dias_sem_atividade).toBe(a.dias_sem_atividade);
  });

  it("guardado no sessionStorage: valida, ignora outro usuário e volta o envio interrompido para pendente", async () => {
    const [a, b] = await doisAlunos();
    let p = registrar(SEM_PENDENCIAS, a, alteracaoDoNome(a, "X"));
    p = registrar(p, b, alteracaoDoNome(b, "Y"));
    p = marcarSalvando(p, [b.id]);
    const texto = serializar(p, "u1");
    const lido = lerGuardado(texto, "u1");
    expect(lido[a.id].alteracoes["campo:nome"].valor).toBe("X");
    expect(lido[b.id].estado).toBe("pendente");
    expect(lerGuardado(texto, "outra-pessoa")).toEqual({});
    expect(lerGuardado("{quebrado", "u1")).toEqual({});
    const bruto = JSON.parse(texto);
    bruto.entradas[a.id].versao = "x"; // inválida: sai só ela
    expect(Object.keys(lerGuardado(JSON.stringify(bruto), "u1"))).toEqual([b.id]);
  });
});

describe("salvar em lote no modo demonstração", () => {
  it("resultado parcial: gravado sai; 409 fica com o atual; rede não perde nada", async () => {
    const [a, b] = await doisAlunos();
    let p = registrar(SEM_PENDENCIAS, a, alteracaoDaAcao(a, "Ligar amanhã", null));
    p = registrar(p, b, alteracaoDoNome(b, "Nome Novo"));
    // Outra pessoa grava o aluno B antes do lote.
    await atualizarAluno(b.id, b.versao, { objetivo: "Mudou por outra pessoa" });
    const enviar = paraEnviar(p);
    p = marcarSalvando(p, enviar.map((e) => e.aluno_id));
    const r = aplicarResposta(p, enviar, await salvarLote(montarPedido(enviar)));
    expect([r.salvas, r.comErro]).toEqual([1, 1]);
    expect(r.gravados[0].proxima_acao?.descricao).toBe("Ligar amanhã");
    expect(r.pendencias[a.id]).toBeUndefined();
    const eb = r.pendencias[b.id];
    expect(eb.estado).toBe("erro");
    expect(eb.erro?.tipo).toBe("versao");
    // 409 espera a escolha: não entra no próximo "Salvar".
    expect(paraEnviar(r.pendencias)).toEqual([]);
    // Rede: tudo volta como erro de rede, com as alterações.
    const falhou = aplicarFalha(marcarSalvando(registrar(SEM_PENDENCIAS, a, alteracaoDoNome(a, "Q")), [a.id]), [a.id], "Sem conexão");
    expect(falhou[a.id]).toMatchObject({ estado: "erro", erro: { tipo: "rede" } });
    expect(falhou[a.id].alteracoes["campo:nome"].valor).toBe("Q");
    expect(paraEnviar(falhou)).toHaveLength(1);
  });

  it("reaplicar depois do 409: versão atual, anterior relido, o que ficou igual sai; aluno em revisar", async () => {
    const [, b] = await doisAlunos();
    let p = registrar(SEM_PENDENCIAS, b, alteracaoDoNome(b, "Nome Meu"));
    p = registrar(p, b, alteracaoDaAcao(b, "Minha ação", null));
    // Outra pessoa grava a MESMA ação e muda o nome para outro valor.
    const atual: AlunoDetalhe = await atualizarAluno(b.id, b.versao, { proxima_acao: "Minha ação", proxima_acao_prazo: null, nome: "Nome Dela" });
    const enviar = paraEnviar(p);
    const r = aplicarResposta(marcarSalvando(p, [b.id]), enviar, await salvarLote(montarPedido(enviar)));
    const { pendencias, removidas } = reaplicar(r.pendencias, b.id, lerDoServidor);
    const e = pendencias[b.id];
    expect(e.estado).toBe("revisar");
    expect(e.versao).toBe(atual.versao);
    expect(Object.keys(e.alteracoes)).toEqual(["campo:nome"]); // a ação já está igual no servidor
    expect(e.alteracoes["campo:nome"]).toMatchObject({ valor: "Nome Meu", anterior: "Nome Dela", antes: "Nome Dela" });
    expect(removidas).toEqual([]);
    // Salvando de novo, grava.
    const r2 = aplicarResposta(marcarSalvando(pendencias, [b.id]), paraEnviar(pendencias), await salvarLote(montarPedido(paraEnviar(pendencias))));
    expect(r2.salvas).toBe(1);
    expect((await buscarAluno(b.id)).nome).toBe("Nome Meu");
  });

  it("erro de validação marca a célula do campo devolvido", async () => {
    const [a] = await doisAlunos();
    const p = registrar(SEM_PENDENCIAS, a, alteracaoDoAjuste(a, "health_score", { valor: 50, motivo: "ok" }, USUARIO)!);
    // Fura a validação da tela: motivo curto chega ao servidor do mock.
    const enviar = paraEnviar(p);
    const r = aplicarResposta(marcarSalvando(p, [a.id]), enviar, await salvarLote(montarPedido(enviar)));
    expect(r.pendencias[a.id].erro).toMatchObject({ tipo: "validacao", chave: "ajuste:health_score" });
    // Editar a célula de novo tira o erro.
    const linha = linhaDoDetalhe(await buscarAluno(a.id));
    const corrigido = registrar(r.pendencias, linha, alteracaoDoAjuste(linha, "health_score", { valor: 50, motivo: "Motivo completo" }, USUARIO)!);
    expect(corrigido[a.id]).toMatchObject({ estado: "pendente" });
    expect(corrigido[a.id].erro).toBeUndefined();
  });
});

describe("ficha do Raio-X (M4)", () => {
  async function detalhe(): Promise<AlunoDetalhe> {
    const [a] = await doisAlunos();
    return buscarAluno(a.id);
  }

  it("dois ajustes no mesmo grupo (sinais) e dois checkpoints não se apagam na tela", async () => {
    const d = await detalhe();
    let p = registrar(SEM_PENDENCIAS, d, alteracaoDoAjuste(d, "sinal_upgrade", { valor: true, motivo: "Pediu proposta" }, USUARIO)!);
    p = registrar(p, d, alteracaoDoAjuste(comPendencias(d, p[d.id]), "sinal_renovacao", { valor: true, motivo: "Fim do ciclo" }, USUARIO)!);
    const [c1, c2] = d.checkpoints;
    p = registrar(p, d, alteracaoDoCheckpoint(c1, { observacao: "Primeira" }));
    p = registrar(p, d, alteracaoDoCheckpoint(c2, { observacao: "Segunda" }));
    p = registrar(p, d, alteracaoDoCheckpoint(c1, { nome: "Renomeado" }, p[d.id].alteracoes[`checkpoint:${c1.id}`]));
    const tela = comPendencias(d, p[d.id]);
    expect([tela.sinais.upgrade.valor, tela.sinais.renovacao.valor]).toEqual([true, true]);
    const t1 = tela.checkpoints.find((c) => c.id === c1.id)!;
    expect([t1.nome, t1.observacao]).toEqual(["Renomeado", "Primeira"]);
    expect(tela.checkpoints.find((c) => c.id === c2.id)?.observacao).toBe("Segunda");
    // O anterior soma os campos editados depois (o nome do servidor).
    expect(p[d.id].alteracoes[`checkpoint:${c1.id}`].anterior).toMatchObject({ observacao: c1.observacao ?? null, nome: c1.nome });
    // Desfazer o 1º checkpoint não leva junto o 2º.
    const sem1 = comPendencias(d, desfazer(p, d.id, `checkpoint:${c1.id}`)[d.id]);
    expect(sem1.checkpoints.find((c) => c.id === c1.id)?.observacao).toBe(c1.observacao);
    expect(sem1.checkpoints.find((c) => c.id === c2.id)?.observacao).toBe("Segunda");
  });

  it("checkpoint avulso novo, arquivar checkpoint e intervenção nova/concluída vão num lote só", async () => {
    const d = await detalhe();
    const c = await buscarConfig();
    const cp = d.checkpoints[0];
    let p = registrar(SEM_PENDENCIAS, d, checkpointNovo("t1", { nome: "Conversa extra", data_prevista: "2026-12-01", status: "previsto" }));
    p = registrar(p, d, checkpointArquivado(cp));
    const tipo = c.tipos_intervencao.find((t) => t.ativo)!;
    const resp = c.responsaveis.find((r) => r.ativo)!;
    p = registrar(
      p,
      d,
      intervencaoNova("i1", { tipo_id: tipo.id, descricao: "Ligar", responsavel_id: resp.id, prazo: null }, { tipo, responsavel: resp }, USUARIO),
    );
    const tela = comPendencias(d, p[d.id]);
    expect(tela.checkpoints.some((x) => x.id === cp.id)).toBe(false);
    expect(tela.checkpoints.at(-1)?.nome).toBe("Conversa extra");
    expect(tela.intervencoes.at(-1)).toMatchObject({ descricao: "Ligar", tipo: { nome: tipo.nome } });
    const [pedido] = montarPedido(paraEnviar(p)).alunos;
    expect(pedido.checkpoints).toEqual(
      expect.arrayContaining([expect.objectContaining({ novo: true, nome: "Conversa extra" }), { id: cp.id, arquivar: true }]),
    );
    expect(pedido.intervencoes).toEqual([expect.objectContaining({ novo: true, descricao: "Ligar" })]);
    const r = aplicarResposta(marcarSalvando(p, [d.id]), paraEnviar(p), await salvarLote(montarPedido(paraEnviar(p))));
    expect(r.salvas).toBe(3);
    const depois = await buscarAluno(d.id);
    expect(depois.checkpoints.some((x) => x.id === cp.id)).toBe(false);
    expect(depois.checkpoints.some((x) => x.nome === "Conversa extra")).toBe(true);
    expect(depois.intervencoes.some((x) => x.descricao === "Ligar")).toBe(true);
    // Concluir uma intervenção existente.
    const i = depois.intervencoes.find((x) => x.descricao === "Ligar")!;
    const q = registrar(SEM_PENDENCIAS, depois, alteracaoDaIntervencao(i, { status: "concluida" }));
    expect(comPendencias(depois, q[d.id]).intervencoes.find((x) => x.id === i.id)?.status).toBe("concluida");
    expect(registrar(q, depois, alteracaoDaIntervencao(i, { status: "aberta" }, {}, q[d.id].alteracoes[`intervencao:${i.id}`]))).toEqual({});
  });

  it("ação imediata da própria pessoa sobre a versão das pendências: elas seguem na versão nova", async () => {
    const d = await detalhe();
    let p = registrar(SEM_PENDENCIAS, d, alteracaoDeCampo(d, "diagnostico", "Novo diagnóstico"));
    const gravado = await atualizarAluno(d.id, d.versao, { objetivo: "Mudou na hora" }); // ex.: trocar programa, arquivar
    p = rebasear(p, gravado, lerDoServidor);
    expect(p[d.id]).toMatchObject({ versao: gravado.versao, estado: "pendente" });
    // Salto maior (outra pessoa no meio): não mexe; o 409 decide.
    const outro = await atualizarAluno(d.id, gravado.versao, { objetivo: "Outra pessoa" });
    const depois = await atualizarAluno(d.id, outro.versao, { objetivo: "De novo" });
    expect(rebasear(p, depois, lerDoServidor)).toBe(p);
  });
});
