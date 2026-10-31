import { contagemDoMarco, type CheckpointModelo, type Programa, type Roteiro, type StatusAula, type StatusCheckpoint } from "../contrato";
import { dataPrevistaDoModelo, diasEntre } from "./motor";
import type { AulaBanco, Banco, CheckpointBanco, ComentarioBanco, ImagemBanco } from "./tipos";

// ---------------------------------------------------------------------------
// Programas do modo demonstração (specs/educacional/programas): as 6 listas do
// Vata (28/10). Os roteiros são textos curtos de exemplo; os reais vêm do backend.
// ---------------------------------------------------------------------------

type Definicao = {
  mentoria: string;
  meses: number;
  marcos: [string, string][];
  observacao?: string;
  individual?: false;
  aulas?: number; // Entrega 2 (M1): total de aulas do programa (exemplo)
};

const INDICACAO = "Em que momento solicitar indicação? Idealmente após o primeiro UAU.";

const DEFINICOES: Definicao[] = [
  {
    mentoria: "Blackbelt",
    meses: 6,
    aulas: 26,
    observacao: INDICACAO,
    marcos: [["Dia 0", "Boas-vindas"], ["Dia 3", "Sprint"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Reta Final"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Blackbelt",
    meses: 12,
    aulas: 53,
    observacao: INDICACAO,
    marcos: [["Dia 0", "Boas-vindas"], ["Dia 3", "Onboarding"], ["Mês 1", "Revisão"], ["Mês 4", "Big Win"], ["Mês 6", "Metade"], ["Mês 12", "Fim"]],
  },
  {
    mentoria: "Prime",
    meses: 6,
    aulas: 12,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Pré-fim"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Prime",
    meses: 12,
    aulas: 24,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Avaliação"], ["Mês 6", "Metade"], ["Mês 9", "Big Win"], ["Mês 12", "Decisão"]],
  },
  {
    mentoria: "Private",
    meses: 6,
    aulas: 24,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Revisão"], ["Mês 3", "Big Win"], ["Mês 5", "Pré-fim"], ["Mês 6", "Fim"]],
  },
  {
    mentoria: "Private",
    meses: 12,
    aulas: 48,
    marcos: [["Dia 0", "Welcome"], ["Dia 3", "Check-in"], ["Mês 1", "Avaliação"], ["Mês 6", "Metade"], ["Mês 9", "Big Win"], ["Mês 12", "Decisão"]],
  },
  // Entrega 1: Ninja, sem acompanhamento individual (sem checkpoints).
  { mentoria: "Ninja", meses: 6, marcos: [], individual: false },
  { mentoria: "Ninja", meses: 12, marcos: [], individual: false },
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
      acompanhamento_individual: d.individual ?? true,
      total_aulas: d.aulas ?? null,
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

// Semente v4 (Entrega 1), só demonstração: contato de exemplo para quase todos
// (um sem Discord e um sem nenhum contato, para o aviso "Contato incompleto"),
// "Não solicitado" em metade das autorizações pendentes e dois alunos na Ninja
// (sem checkpoints).
const SEM_DISCORD = 3;
const SEM_CONTATO = 11;
const NINJA: Record<number, number> = { 12: 6, 13: 12 };
// Veio da planilha sem programa: aviso "Programa não definido", sem checkpoints.
const SEM_PROGRAMA = 10;

export function semearEntrega1(banco: Banco) {
  banco.alunos.forEach((a, i) => {
    const usuario = slug(a.nome).replace(/-/g, ".");
    const temContato = i !== SEM_CONTATO;
    a.email = temContato ? `${usuario}@exemplo.com.br` : null;
    a.telefone = temContato ? `(11) 9${String(8000 + i * 37).padStart(4, "0")}-${String(1000 + i * 113).slice(-4)}` : null;
    a.discord = temContato && i !== SEM_DISCORD ? usuario.replace(/\./g, "_") : null;
    if (a.autorizacao_prova_social === "pendente" && i % 2 === 1) a.autorizacao_prova_social = "nao_solicitado";
    if (i === SEM_PROGRAMA) {
      a.programa_id = null;
      a.data_inicio_programa = null;
      banco.checkpoints = banco.checkpoints.filter((c) => c.aluno_id !== a.id);
    }
    const meses = NINJA[i];
    const ninja = meses ? banco.config.programas.find((p) => p.mentoria === "Ninja" && p.duracao_meses === meses) : null;
    if (ninja) {
      a.programa_id = ninja.id;
      a.mentoria = ninja.mentoria;
      banco.checkpoints = banco.checkpoints.filter((c) => c.aluno_id !== a.id);
    }
  });
}

// Semente v5 (Entrega 2, M1), só demonstração: o total de aulas do programa em
// cada aluno e uma aula por semana desde o início do programa (até o total),
// com Feito na maioria das que passaram, alguns NoShow, Remarcada e Cancelada,
// e Agendada nas próximas 3 semanas. Mentor: o responsável, se for mentor.
function statusDeExemplo(n: number, passou: boolean): StatusAula {
  if (!passou) return "agendada";
  if (n % 7 === 0) return "noshow";
  if (n % 11 === 0) return "remarcada";
  if (n % 13 === 0) return "cancelada";
  return "feito";
}

export function semearEntrega2(banco: Banco, hoje: string) {
  const mentores = banco.config.responsaveis.filter((r) => r.tipo === "mentor" && r.ativo);
  const aulas: AulaBanco[] = [];
  banco.alunos.forEach((a, i) => {
    const programa = banco.config.programas.find((p) => p.id === a.programa_id);
    a.total_aulas = programa?.total_aulas ?? null;
    if (!a.total_aulas || !a.data_inicio_programa) return;
    const responsavel = mentores.find((r) => r.id === a.responsavel_id);
    const limite = new Date(`${hoje}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 21);
    for (let n = 1; n <= a.total_aulas; n += 1) {
      const d = new Date(`${a.data_inicio_programa}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7 * n);
      if (d > limite) break;
      const dia = d.toISOString().slice(0, 10);
      const mentor = responsavel ?? mentores[(i + n) % mentores.length] ?? null;
      const status = statusDeExemplo(n + i, dia <= hoje);
      aulas.push({
        id: `aula-${a.id}-${n}`,
        aluno_id: a.id,
        data: dia,
        hora: (n + i) % 3 === 0 ? null : ["09:00", "14:30", "19:00"][(n + i) % 3],
        mentor_id: mentor?.id ?? null,
        status,
        observacao: status === "noshow" ? "Não entrou na sala. Remarcar." : null,
        criada_em: `${dia}T12:00:00.000Z`,
        arquivado_em: null,
      });
    }
  });
  banco.aulas = aulas;
}

// Semente v6 (Entrega 2, M2), só demonstração: alguns comentários no mural, de
// outras pessoas da equipe (não editáveis por quem está usando a demonstração),
// um deles com imagem. Datas relativas a hoje.
const QUADRO_DE_EXEMPLO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="640" height="360" fill="#1d1a24"/>' +
      '<text x="32" y="56" fill="#f5f3f7" font-family="sans-serif" font-size="26" font-weight="700">Funil da semana (exemplo)</text>' +
      '<rect x="32" y="96" width="520" height="44" rx="8" fill="#3b82f6"/>' +
      '<rect x="32" y="156" width="380" height="44" rx="8" fill="#22c55e"/>' +
      '<rect x="32" y="216" width="220" height="44" rx="8" fill="#eab308"/>' +
      '<rect x="32" y="276" width="96" height="44" rx="8" fill="#ef4444"/>' +
      "</svg>",
  );

const COMENTARIOS_DE_EXEMPLO: { aluno: number; dias: number; hora: string; autor: number; texto: string; imagem?: true }[] = [
  { aluno: 0, dias: 1, hora: "14:20", autor: 0, texto: "Call ótima hoje. Ele fechou o primeiro cliente do novo nicho e quer acelerar a prospecção.", imagem: true },
  { aluno: 0, dias: 6, hora: "10:05", autor: 1, texto: "Mandou o print do funil no grupo. Combinamos revisar a oferta na próxima aula." },
  { aluno: 1, dias: 3, hora: "16:40", autor: 0, texto: "Faltou na aula de ontem. Já mandei mensagem no Discord; aguardando retorno." },
  { aluno: 2, dias: 2, hora: "09:15", autor: 1, texto: "Pediu para trocar o horário das aulas para terça à noite.\nAvisei o mentor." },
];
const AUTORES = [
  { id: "u-carla", nome: "Carla Mendes" },
  { id: "u-rafael", nome: "Rafael Souza" },
];

export function semearMural(banco: Banco, hoje: string) {
  const comentarios: ComentarioBanco[] = [];
  const imagens: ImagemBanco[] = [];
  COMENTARIOS_DE_EXEMPLO.forEach((c, i) => {
    const a = banco.alunos[c.aluno];
    if (!a) return;
    const d = new Date(`${hoje}T${c.hora}:00-03:00`);
    d.setUTCDate(d.getUTCDate() - c.dias);
    const em = d.toISOString();
    const autor = AUTORES[c.autor];
    const ids: string[] = [];
    if (c.imagem) {
      imagens.push({ id: `img-exemplo-${i}`, url: QUADRO_DE_EXEMPLO, nome: "funil-da-semana.svg", tipo: "image/svg+xml", tamanho: 0, autor_id: autor.id, em });
      ids.push(`img-exemplo-${i}`);
    }
    comentarios.push({ id: `com-exemplo-${i}`, aluno_id: a.id, autor, texto: c.texto, imagens: ids, em, editado_em: null, arquivado_em: null });
  });
  banco.comentarios = comentarios;
  banco.imagens = imagens;
}
