import { beforeEach, describe, expect, it } from "vitest";
import { erroDoContato } from "@/features/educacional/contato";
import { programasPorMentoria, programaDoAluno, semAcompanhamentoIndividual } from "@/features/educacional/programas";
import {
  _simularGravacaoEmTeste,
  atualizarAluno,
  buscarAluno,
  buscarAlunos,
  buscarConfig,
  criarAluno,
  definirUsuarioDaSessao,
  EducacionalError,
  previaTrocaPrograma,
  trocarPrograma,
} from "./apiEducacional";
import { AlunoLinhaSchema, type Config } from "./contrato";
import { _zerarMemoria } from "./mock/banco";
import { hojeBR } from "./mock/motor";

// Entrega 1: contato do aluno, "Não solicitado" e mentoria Ninja (programa sem
// acompanhamento individual), no modo demonstração.

const HOJE = hojeBR();
const CONTATO = { email: "rui@exemplo.com", telefone: "(11) 91234-5678", discord: "rui_edu" };

async function erroDe(p: Promise<unknown>): Promise<EducacionalError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof EducacionalError) return e;
    throw e;
  }
  throw new Error("esperava erro");
}

beforeEach(() => {
  _zerarMemoria();
  _simularGravacaoEmTeste(null);
  definirUsuarioDaSessao({ id: "u-edu", nome: "Equipe Teste" });
});

describe("contato", () => {
  it("cadastro exige e-mail, número e Discord, com mensagem em português", async () => {
    const c = await buscarConfig();
    const base = { nome: "Rui", programa_id: c.programas[0].id, data_entrada: HOJE, nivel_inicial: "iniciante" as const, etapa_id: c.etapas[0].id };
    const semEmail = await erroDe(criarAluno({ ...base, ...CONTATO, email: "" }));
    expect([semEmail.status, semEmail.corpo.campo, semEmail.corpo.mensagem]).toEqual([400, "email", "E-mail é obrigatório. Preencha o campo."]);
    const emailRuim = await erroDe(criarAluno({ ...base, ...CONTATO, email: "rui@" }));
    expect(emailRuim.corpo.mensagem).toBe("E-mail inválido. Use o formato nome@dominio.com.");
    const numero = await erroDe(criarAluno({ ...base, ...CONTATO, telefone: "1234" }));
    expect(numero.corpo.campo).toBe("telefone");
    const novo = await criarAluno({ ...base, ...CONTATO });
    expect([novo.email, novo.telefone, novo.discord, novo.avisos]).toEqual([...Object.values(CONTATO), []]);
  });

  it("aluno sem contato tem o aviso e continua editável; completar o contato tira o aviso", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    const incompletos = itens.filter((a) => a.avisos.includes("contato_incompleto"));
    expect(incompletos.length).toBeGreaterThanOrEqual(1);
    const semNada = incompletos.find((a) => !a.email && !a.telefone && !a.discord)!;
    expect(semNada).toBeTruthy();
    const editado = await atualizarAluno(semNada.id, semNada.versao, { objetivo: "Outra edição, sem contato" });
    expect([editado.objetivo, editado.avisos]).toEqual(["Outra edição, sem contato", ["contato_incompleto"]]);
    const completo = await atualizarAluno(editado.id, editado.versao, CONTATO);
    expect(completo.avisos).toEqual([]);
    // Apagar o contato não vale: é obrigatório.
    expect((await erroDe(atualizarAluno(completo.id, completo.versao, { discord: "" }))).corpo.campo).toBe("discord");
  });

  it("avisos vêm como lista de códigos; sem o campo, lista vazia", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    const { avisos: _fora, ...semAvisos } = itens[0];
    expect(AlunoLinhaSchema.parse(semAvisos).avisos).toEqual([]);
    expect(AlunoLinhaSchema.parse({ ...semAvisos, avisos: ["contato_incompleto", "outro_aviso"] }).avisos).toEqual([
      "contato_incompleto",
      "outro_aviso",
    ]);
    expect(AlunoLinhaSchema.safeParse({ ...semAvisos, avisos: true }).success).toBe(false);
  });

  it("formato mínimo na tela, antes de enviar", () => {
    expect(erroDoContato("email", "")).toBe("Informe o e-mail.");
    expect(erroDoContato("email", "a@b")).toBe("E-mail inválido. Use o formato nome@dominio.com.");
    expect(erroDoContato("email", "a@b.com")).toBeNull();
    expect(erroDoContato("telefone", "")).toBe("Informe o número, com DDD.");
    expect(erroDoContato("telefone", "9123-4567")).toBe("Número inválido. Use DDD e número, de 10 a 15 dígitos.");
    expect(erroDoContato("telefone", "+55 (11) 91234-5678")).toBeNull();
    expect(erroDoContato("discord", "  ")).toBe("Informe o usuário do Discord.");
  });
});

describe("Ninja (sem acompanhamento individual)", () => {
  it("aluno novo na Ninja não tem checkpoints; o programa aninhado diz isso", async () => {
    const c = await buscarConfig();
    const ninja = c.programas.find((p) => p.nome === "Ninja 6 meses")!;
    expect(ninja.acompanhamento_individual).toBe(false);
    const novo = await criarAluno({
      ...CONTATO,
      nome: "Nina Ninja",
      programa_id: ninja.id,
      data_entrada: HOJE,
      nivel_inicial: "iniciante",
      etapa_id: c.etapas[0].id,
    });
    expect(novo.mentoria).toBe("Ninja");
    expect(novo.checkpoints).toEqual([]);
    expect(novo.proximo_checkpoint).toBeNull();
    expect(semAcompanhamentoIndividual(programaDoAluno(novo, c))).toBe(true);
  });

  it("troca para a Ninja: os não realizados saem e nada é criado", async () => {
    const c = await buscarConfig();
    const { itens } = await buscarAlunos({ por_pagina: "todos" });
    const a = await buscarAluno(itens.find((x) => x.mentoria === "Prime")!.id);
    const ninja = c.programas.find((p) => p.nome === "Ninja 12 meses")!;
    const previa = await previaTrocaPrograma(a.id, null, { programa_id: ninja.id, data_inicio: HOJE });
    expect(previa.criados).toEqual([]);
    expect(previa.saem.length + previa.ficam.length).toBe(a.checkpoints.length);
    const depois = await trocarPrograma(a.id, a.versao, { programa_id: ninja.id, data_inicio: HOJE, motivo: "Mudou para a Ninja" });
    expect(depois.checkpoints.every((x) => x.status === "realizado")).toBe(true);
  });

  it("a Ninja fica por último nas listas, mesmo vindo antes na configuração", () => {
    const programa = (id: string, mentoria: string, ordem: number) => ({
      id,
      nome: `${mentoria} 6 meses`,
      mentoria,
      duracao_meses: 6,
      observacoes: null,
      ordem,
      ativo: true,
      acompanhamento_individual: mentoria !== "Ninja",
    });
    const config = { programas: [programa("n", "Ninja", 1), programa("b", "Blackbelt", 2), programa("p", "Prime", 3)] } as unknown as Config;
    expect(programasPorMentoria(config).map((g) => g.mentoria)).toEqual(["Blackbelt", "Prime", "Ninja"]);
  });

  it("semente: dois alunos na Ninja, sem checkpoints", async () => {
    const { itens } = await buscarAlunos({ por_pagina: "todos", incluir_arquivados: true });
    const ninjas = itens.filter((a) => a.mentoria === "Ninja");
    expect(ninjas).toHaveLength(2);
    for (const n of ninjas) expect((await buscarAluno(n.id)).checkpoints).toEqual([]);
  });
});
