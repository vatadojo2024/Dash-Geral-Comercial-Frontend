import { describe, expect, it } from "vitest";
import { EducacionalError } from "@/lib/educacional/apiEducacional";
import type { PropostaAnalise } from "@/lib/educacional/contrato";
import { mensagemDoEnvio } from "./AnaliseAula";
import {
  checkpointsInformativos,
  corpoDaDecisao,
  pendenciasDaRevisao,
  pilaresDaProposta,
  podeAplicar,
  lembrarResumos,
  resumoNaTela,
  ROTULO_SITUACAO_ANALISE,
  SEM_DECISOES,
  situacaoDoResumo,
  textoDaDecisao,
  type Decisoes,
} from "./revisaoAnalise";

// Revisão da análise de aula com IA: o que precisa de decisão, quando aplicar
// fica ativo e o corpo do "decidir" (nota só em "editar").

const pilar = (p: string, sugerida: number | null) => ({
  pilar: p,
  notaAtual: 50,
  notaSugerida: sugerida,
  faixa: null,
  confianca: null,
  justificativa: "",
  evidencias: [],
  avisos: [],
});
const proposta = (over: Partial<PropostaAnalise> = {}): PropostaAnalise => ({
  qualidade: "boa",
  aviso: null,
  resumo: "",
  highlights: [],
  pilares: [pilar("validou", null), pilar("consumiu", 90), pilar("aplicou", 60), pilar("entendeu", 70)],
  checkpoints: [
    { id: "cp-1", situacao: "parece_cumprido", justificativa: "", evidencias: [] },
    { id: "cp-2", situacao: "em_andamento", justificativa: "", evidencias: [] },
  ],
  alertas: [],
  reforcar: [],
  descartes: [],
  ...over,
});

describe("revisão da análise", () => {
  it("pilares na ordem da ficha, sem Consumiu; só os com nota pedem decisão; checkpoint em andamento é informativo", () => {
    const p = proposta();
    expect(pilaresDaProposta(p).map((x) => x.pilar)).toEqual(["entendeu", "aplicou", "validou"]);
    expect(pendenciasDaRevisao(p, SEM_DECISOES)).toEqual(["pilar:entendeu", "pilar:aplicou", "checkpoint:cp-1"]);
    expect(checkpointsInformativos(p).map((c) => c.id)).toEqual(["cp-2"]);
  });

  it("aplicar só com tudo decidido; editar exige nota inteira de 0 a 100", () => {
    const p = proposta();
    const d: Decisoes = { pilares: { entendeu: { decisao: "aprovar" }, aplicou: { decisao: "editar", nota: "" } }, checkpoints: { "cp-1": "rejeitar" } };
    expect(podeAplicar(p, d)).toBe(false);
    for (const ruim of ["101", "6.5", "-1", "abc"]) expect(podeAplicar(p, { ...d, pilares: { ...d.pilares, aplicou: { decisao: "editar", nota: ruim } } })).toBe(false);
    const ok = { ...d, pilares: { ...d.pilares, aplicou: { decisao: "editar" as const, nota: " 65 " } } };
    expect(podeAplicar(p, ok)).toBe(true);
    expect(corpoDaDecisao(p, ok, 7, "  ")).toEqual({
      versao: 7,
      pilares: [
        { pilar: "entendeu", decisao: "aprovar" },
        { pilar: "aplicou", decisao: "editar", nota: 65 },
      ],
      checkpoints: [{ id: "cp-1", decisao: "rejeitar" }],
    });
    expect(corpoDaDecisao(p, ok, 7, " ok ").motivo).toBe("ok");
  });

  it("sem nada a decidir, aplicar fica desligado", () => {
    const p = proposta({ pilares: [pilar("entendeu", null)], checkpoints: [] });
    expect(podeAplicar(p, SEM_DECISOES)).toBe(false);
  });

  it("quem decidiu: o nome que vem ao lado do id; sem nome, 'alguém da equipe' (o id nunca aparece)", () => {
    const base = { id: "a", aula_id: "x", aluno_id: "y", analise: null, descartes: [], prompt_versao: null, modelo: null, erro: null, criada_em: null, concluida_em: null };
    const decidida = { ...base, status: "pronta" as const, decidida_em: "2026-11-16T15:30:00Z", decidida_por: "3f1c0d2e-1111-4a2b-9c3d-123456789abc" };
    expect(textoDaDecisao({ ...decidida, decidida_por_nome: "Mari" })).toBe("Análise decidida por Mari em 16/11/2026, 12:30");
    expect(textoDaDecisao({ ...decidida, decidida_por_nome: null })).toBe("Análise decidida por alguém da equipe em 16/11/2026, 12:30");
    expect(textoDaDecisao({ ...decidida, decidida_por_nome: "  " })).not.toMatch(/3f1c0d2e/);
  });

  it("situação na linha da aula: Analisando, Aguardando decisão, Decidida ou Erro", () => {
    const r = (status: string, decidida = false) => ROTULO_SITUACAO_ANALISE[situacaoDoResumo({ id: "a", status, decidida })!];
    expect([r("processando"), r("pronta"), r("pronta", true), r("erro")]).toEqual(["Analisando", "Aguardando decisão", "Decidida", "Erro"]);
    expect(situacaoDoResumo(null)).toBeNull();
    expect(situacaoDoResumo(undefined)).toBeNull();
  });

  it("chave ausente não mexe no que a tela tem; null diz que a aula não tem análise", () => {
    const pronta = { id: "an-1", status: "pronta", decidida: false };
    let m = lembrarResumos(new Map(), [{ id: "x", analise: pronta }, { id: "y", analise: null }], 1);
    expect([m.get("x")?.resumo, m.get("y")?.resumo, m.has("z")]).toEqual([pronta, null, false]);
    // Resposta sem a chave (calendário, planilha): nada muda.
    m = lembrarResumos(m, [{ id: "x" }, { id: "y" }], 2);
    expect([m.get("x"), m.get("y")]).toEqual([{ resumo: pronta, em: 1 }, { resumo: null, em: 1 }]);
    // Com a chave, vale o novo, inclusive o null.
    m = lembrarResumos(m, [{ id: "x", analise: null }], 3);
    expect(m.get("x")).toEqual({ resumo: null, em: 3 });
  });

  it("vale o mais novo entre o resumo da ficha e a lista da aula já buscada", () => {
    const ficha = { resumo: { id: "an-1", status: "pronta", decidida: false }, em: 10 };
    const analise = { id: "an-2", aula_id: "x", aluno_id: "y", status: "processando" as const, analise: null, descartes: [], prompt_versao: null, modelo: null, erro: null, criada_em: null, concluida_em: null, decidida_em: null, decidida_por: null, decidida_por_nome: null };
    expect(resumoNaTela(ficha, { analises: undefined, em: 0 })).toEqual(ficha.resumo);
    expect(resumoNaTela(ficha, { analises: [analise], em: 20 })).toEqual({ id: "an-2", status: "processando", decidida: false });
    expect(resumoNaTela(ficha, { analises: [analise], em: 5 })).toEqual(ficha.resumo);
    expect(resumoNaTela(undefined, { analises: undefined, em: 0 })).toBeNull();
  });

  it("mensagens do envio: 503 config_ausente, 413, rede e o texto do 400", () => {
    expect(mensagemDoEnvio(new EducacionalError("x", 503, { error: "config_ausente" }))).toBe("Análise com IA não configurada");
    expect(mensagemDoEnvio(new EducacionalError("x", 413))).toMatch(/passa do limite/);
    expect(mensagemDoEnvio(new EducacionalError("x", 0))).toMatch(/Sem conexão/);
    expect(mensagemDoEnvio(new EducacionalError("x", 400, { error: "validacao", mensagem: "A transcrição tem 10 caracteres, e o mínimo é 200." }))).toBe(
      "A transcrição tem 10 caracteres, e o mínimo é 200.",
    );
  });
});
