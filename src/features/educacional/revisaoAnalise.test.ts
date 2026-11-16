import { describe, expect, it } from "vitest";
import { EducacionalError } from "@/lib/educacional/apiEducacional";
import type { AnaliseAula, PropostaAnalise } from "@/lib/educacional/contrato";
import { mensagemDoEnvio } from "./AnaliseAula";
import {
  checkpointsInformativos,
  corpoDaDecisao,
  pendenciasDaRevisao,
  pilaresDaProposta,
  podeAplicar,
  quemDecidiu,
  situacaoDaAnalise,
  SEM_DECISOES,
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

  it("quem decidiu: nome, 'você' ou 'alguém da equipe' (nunca o id cru); situação da aula", () => {
    const eu = { id: "u-1" };
    expect(quemDecidiu({ id: "u-2", nome: "Mari" }, eu)).toBe("Mari");
    expect(quemDecidiu("u-1", eu)).toBe("você");
    expect(quemDecidiu("3f1c0d2e-1111-4a2b-9c3d-123456789abc", eu)).toBe("alguém da equipe");
    const base = { id: "a", aula_id: "x", aluno_id: "y", analise: null, descartes: [], prompt_versao: null, modelo: null, erro: null, criada_em: null, concluida_em: null, decidida_por: null, decidida_em: null };
    expect(situacaoDaAnalise({ ...base, status: "processando" } as AnaliseAula, eu)).toBe("Analisando a aula…");
    expect(situacaoDaAnalise({ ...base, status: "pronta" } as AnaliseAula, eu)).toBe("Análise pronta para revisar");
    expect(situacaoDaAnalise({ ...base, status: "pronta", decidida_em: "2026-11-16T15:30:00Z", decidida_por: { id: "u-2", nome: "Mari" } } as AnaliseAula, eu)).toBe(
      "Análise decidida por Mari em 16/11/2026, 12:30",
    );
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
