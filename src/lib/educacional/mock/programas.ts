import { contagemDoMarco, type CheckpointModelo, type Programa, type Roteiro, type StatusCheckpoint } from "../contrato";
import { dataPrevistaDoModelo, diasEntre } from "./motor";
import type { Banco, CheckpointBanco } from "./tipos";

// ---------------------------------------------------------------------------
// Programas do modo demonstração (specs/educacional/programas): as 6 listas do
// Vata (28/10). Os roteiros são textos curtos de exemplo; os reais vêm do backend.
// ---------------------------------------------------------------------------

type Definicao = { mentoria: string; meses: number; marcos: [string, string][]; observacao?: string };

const INDICACAO = "Em que momento solicitar indicação? Idealmente após o primeiro UAU.";

const DEFINICOES: Definicao[] = [
  {
    mentoria: "Blackbelt",
    meses: 6,
    observacao: INDICACAO,
    marcos: [["Dia 0", "Boas-vindas"], ["Dia 3", "Sprint"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Reta Final"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Blackbelt",
    meses: 12,
    observacao: INDICACAO,
    marcos: [["Dia 0", "Boas-vindas"], ["Dia 3", "Onboarding"], ["Mês 1", "Revisão"], ["Mês 4", "Big Win"], ["Mês 6", "Metade"], ["Mês 12", "Fim"]],
  },
  {
    mentoria: "Prime",
    meses: 6,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Pré-fim"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Prime",
    meses: 12,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Avaliação"], ["Mês 6", "Metade"], ["Mês 9", "Big Win"], ["Mês 12", "Decisão"]],
  },
  {
    mentoria: "Private",
    meses: 6,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Pré-fim"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Private",
    meses: 12,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Avaliação"], ["Mês 6", "Metade"], ["Mês 9", "Big Win"], ["Mês 12", "Decisão"]],
  },
];

const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

function roteiroDeExemplo(nome: string, bigWin: boolean): Roteiro {
  return {
    objetivo_contato: `Exemplo (${nome}): entender como o aluno está e combinar o próximo passo.`,
    perguntas_chave: "Exemplo: O que mudou desde o último contato? O que está travando? Qual o próximo resultado que você quer?",
    sinais_upsell: bigWin
      ? "Exemplo: trouxe resultado concreto, fala em escalar, pergunta sobre a próxima turma."
      : "Exemplo: pede mais acompanhamento, cita um resultado, pergunta o que vem depois.",
    estrategia_monetizacao: bigWin
      ? "Exemplo: pedir depoimento e indicação; registrar o sinal de upgrade para o Comercial."
      : "Exemplo: registrar o sinal e acionar o Comercial com o contexto da conversa.",
  };
}

export function catalogoDeProgramas(): { programas: Programa[]; modelos: CheckpointModelo[] } {
  const programas: Programa[] = [];
  const modelos: CheckpointModelo[] = [];
  DEFINICOES.forEach((d, i) => {
    const id = `prog-${slug(d.mentoria)}-${d.meses}`;
    programas.push({
      id,
      nome: `${d.mentoria} ${d.meses} meses`,
      mentoria: d.mentoria,
      duracao_meses: d.meses,
      observacoes: d.observacao ?? null,
      ordem: i + 1,
      ativo: true,
    });
    d.marcos.forEach(([marco, nome], k) => {
      const bigWin = nome === "Big Win";
      modelos.push({
        id: `cpm-${slug(d.mentoria)}-${d.meses}-${k + 1}`,
        nome,
        ordem: k + 1,
        ...contagemDoMarco(marco)!, // exatamente uma: dias_apos_entrada OU meses_apos_inicio
        prazo_sla_dias: marco.startsWith("Dia") ? 2 : 7,
        big_win: bigWin,
        ativo: true,
        programa_id: id,
        roteiro: roteiroDeExemplo(nome, bigWin),
      });
    });
  });
  return { programas, modelos };
}

// "Mentoria Black" → Blackbelt; "Mentoria Prime" → Prime; "Mentoria Private" → Private.
function mentoriaDoPrograma(mentoria: string): string {
  const m = mentoria.toLowerCase();
  if (m.includes("black")) return "Blackbelt";
  if (m.includes("private")) return "Private";
  return "Prime";
}

// Semente v3: troca os checkpoints padrão pelos 6 programas, dá a cada aluno o
// programa pela mentoria e duração (término − entrada) e refaz os checkpoints
// dele pela lista do programa. O status de cada checkpoint que já passou vem do
// checkpoint antigo de data mais próxima, para a demonstração continuar com
// realizados, pendentes e sem resposta.
export function semearProgramas(banco: Banco, hoje: string) {
  const { programas, modelos } = catalogoDeProgramas();
  banco.config.programas = programas;
  banco.config.checkpoints_modelo = modelos;
  const novos: CheckpointBanco[] = [];
  for (const a of banco.alunos) {
    const meses = a.data_termino && diasEntre(a.data_entrada, a.data_termino) > 270 ? 12 : 6;
    const programa = programas.find((p) => p.mentoria === mentoriaDoPrograma(a.mentoria) && p.duracao_meses === meses)!;
    a.programa_id = programa.id;
    a.data_inicio_programa = a.data_entrada;
    a.mentoria = programa.mentoria;
    const antigos = banco.checkpoints.filter((c) => c.aluno_id === a.id && !c.arquivado_em && c.data_prevista);
    modelos
      .filter((m) => m.programa_id === programa.id)
      .forEach((m) => {
        const prevista = dataPrevistaDoModelo(a.data_entrada, m);
        let status: StatusCheckpoint = "previsto";
        let realizada: string | null = null;
        let observacao: string | null = null;
        if (prevista <= hoje && antigos.length) {
          const perto = [...antigos].sort(
            (x, y) => Math.abs(diasEntre(x.data_prevista!, prevista)) - Math.abs(diasEntre(y.data_prevista!, prevista)),
          )[0];
          status = perto.status === "previsto" ? "pendente" : perto.status;
          observacao = perto.observacao;
          if (status === "realizado") {
            const atraso = perto.data_realizada ? diasEntre(perto.data_prevista!, perto.data_realizada) : 0;
            const d = new Date(`${prevista}T12:00:00Z`);
            d.setUTCDate(d.getUTCDate() + atraso);
            realizada = d.toISOString().slice(0, 10) > hoje ? hoje : d.toISOString().slice(0, 10);
          }
        }
        novos.push({
          id: `cp-${a.id}-${m.ordem}`,
          aluno_id: a.id,
          modelo_id: m.id,
          nome: m.nome,
          ordem: m.ordem,
          data_prevista: prevista,
          data_realizada: realizada,
          status,
          big_win: m.big_win,
          observacao,
          arquivado_em: null,
          substituido_em: null,
        });
      });
  }
  banco.checkpoints = novos;
}
