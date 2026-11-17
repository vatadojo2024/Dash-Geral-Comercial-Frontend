import { CHECKPOINT_PARECE_CUMPRIDO, PILARES_ANALISE, type PilarAnalise, type PropostaAnalise } from "../contrato";
import { novoId, salvarLote, type Contexto } from "./escrita";
import { montarAluno } from "./motor";
import { statusDe } from "./estadoAnalise";
import { ErroDaApi, type AnaliseAulaBanco, type Banco } from "./tipos";

// ---------------------------------------------------------------------------
// Análise de aula com IA no modo demonstração (16/11/2026). Imita o contrato do
// backend (docs/educacional-analise-aula-ia.md): cria em "processando", fica
// "pronta" alguns segundos depois com uma PROPOSTA de exemplo montada do estado
// do aluno, e "decidir" aplica o aprovado pelo mesmo caminho do "Salvar ficha"
// (lote: ajuste manual de progresso com o motivo e checkpoint realizado). A
// transcrição não é guardada nem devolvida. Nenhuma IA é chamada aqui.
// ---------------------------------------------------------------------------

export const PROCESSANDO_MS = 8000;
const MINIMO = 200;
const MAXIMO = 400_000;
const PENDENTES = ["previsto", "pendente", "nao_respondeu"];
export const ERRO_SIMULADO = "A IA não conseguiu analisar esta transcrição (erro simulado no modo demonstração).";
// .docx não é lido no navegador: no mock vale como uma transcrição de exemplo.
const TAMANHO_DOCX_EXEMPLO = 1200;

const erro400 = (campo: string, mensagem: string) => new ErroDaApi(400, { error: "validacao", campo, mensagem });
const naoEncontrada = (mensagem: string) => new ErroDaApi(404, { error: "nao_encontrado", mensagem });
const objeto = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function faixaDe(n: number): string {
  if (n <= 20) return "0-20";
  if (n <= 40) return "21-40";
  if (n <= 60) return "41-60";
  if (n <= 80) return "61-80";
  return "81-100";
}

// Proposta de exemplo a partir do estado do aluno: Entendeu e Aplicou mudam,
// Validou fica sem evidência; o primeiro checkpoint pendente "parece cumprido",
// o segundo está "em andamento".
export function propostaDeExemplo(banco: Banco, alunoId: string, hoje: string): PropostaAnalise {
  const a = banco.alunos.find((x) => x.id === alunoId)!;
  const d = montarAluno(banco, a, hoje);
  const atual = (p: PilarAnalise) => d.progresso[p].valor;
  // Sobe a nota; se ela já é alta, desce (o exemplo sempre difere da atual).
  const sugerir = (p: PilarAnalise, passo: number) => {
    const n = Math.round(atual(p) ?? 50);
    return Math.max(0, Math.min(100, n + passo > 100 ? n - passo : n + passo));
  };
  const entendeu = sugerir("entendeu", 10);
  const aplicou = sugerir("aplicou", 20);
  const pendentes = d.checkpoints.filter((c) => PENDENTES.includes(c.status));
  return {
    qualidade: "parcial",
    aviso: "Parte da transcrição está sem a identificação de quem fala; as falas do aluno foram reconhecidas pelo contexto.",
    resumo:
      "Exemplo do modo demonstração. A aula retomou a oferta do aluno e revisou a página de vendas. O aluno explicou com as próprias palavras a diferença entre a promessa e o mecanismo, e trouxe a primeira versão do roteiro de anúncio, que testou com dois contatos.",
    highlights: [
      "Reescreveu a promessa da oferta durante a aula, sem ajuda.",
      "Testou o roteiro de anúncio com dois contatos antes da aula.",
    ],
    pilares: [
      {
        pilar: "entendeu",
        notaAtual: atual("entendeu"),
        notaSugerida: entendeu,
        faixa: faixaDe(entendeu),
        confianca: "alta",
        justificativa: "Explicou a diferença entre promessa e mecanismo com exemplos próprios, sem repetir o material.",
        evidencias: [{ trecho: "a promessa é o que a pessoa ganha, o mecanismo é o porquê de funcionar comigo", momento: "00:12:40" }],
        avisos: [],
      },
      {
        pilar: "aplicou",
        notaAtual: atual("aplicou"),
        notaSugerida: aplicou,
        faixa: faixaDe(aplicou),
        confianca: "media",
        justificativa: "Montou o roteiro de anúncio e testou com dois contatos; ainda não publicou.",
        evidencias: [
          { trecho: "mandei o roteiro pra dois amigos que são do meu público", momento: "00:27:15" },
          { trecho: "ainda não subi o anúncio, quero ajustar a chamada antes", momento: "00:29:02" },
        ],
        avisos: ["movimento limitado a 20 pontos (exemplo do modo demonstração)"],
      },
      {
        pilar: "validou",
        notaAtual: atual("validou"),
        notaSugerida: null,
        faixa: null,
        confianca: null,
        justificativa: "A aula não trouxe resultado com cliente ou venda.",
        evidencias: [],
        avisos: [],
      },
    ],
    checkpoints: [
      ...(pendentes[0]
        ? [
            {
              id: pendentes[0].id,
              situacao: CHECKPOINT_PARECE_CUMPRIDO,
              justificativa: "O que o checkpoint pede foi conversado e combinado na aula.",
              evidencias: [{ trecho: "então fica combinado, semana que vem eu trago os números", momento: "00:44:30" }],
            },
          ]
        : []),
      ...(pendentes[1]
        ? [{ id: pendentes[1].id, situacao: "em_andamento", justificativa: "Começou a ser tratado, sem conclusão.", evidencias: [] }]
        : []),
    ],
    alertas: [
      {
        tipo: "risco_renovacao",
        descricao: "O aluno comentou que está avaliando se renova no fim do programa.",
        evidencia: { trecho: "no fim do ano eu vejo se continuo, depende do que der", momento: "00:41:05" },
      },
    ],
    reforcar: ["Publicar o anúncio e trazer os primeiros números.", "Revisar a chamada do roteiro com o material da aula 3."],
    descartes: ["pilar validou: trecho citado não existe na transcrição"],
  };
}

export function respostaDaAnalise(an: AnaliseAulaBanco, agora: string) {
  const status = statusDe(an, agora);
  const pronta = status === "pronta";
  return {
    id: an.id,
    aula_id: an.aula_id,
    aluno_id: an.aluno_id,
    status,
    prompt_versao: "v3",
    modelo: "demonstração",
    analise: pronta ? an.analise : null,
    descartes: pronta ? (an.analise?.descartes ?? []) : [],
    decisao: an.decisao,
    decidida_em: an.decidida_em,
    // O id e, ao lado, o nome (backend f4154a5).
    decidida_por: an.decidida_por?.id ?? null,
    decidida_por_nome: an.decidida_por?.nome ?? null,
    custo: { tokens_entrada: 0, tokens_saida: 0, chamadas: 0 },
    erro: status === "erro" ? ERRO_SIMULADO : null,
    criada_em: an.criada_em,
    concluida_em: status === "processando" ? null : an.pronta_em,
  };
}

const lista = (banco: Banco) => (banco.analises_aula ??= []);

// POST /analises: JSON { aula_id, transcricao } ou multipart (aula_id + arquivo).
export function criarAnaliseAula(banco: Banco, corpo: Record<string, unknown>, ctx: Contexto) {
  const aulaId = typeof corpo.aula_id === "string" ? corpo.aula_id : "";
  if (!aulaId) throw erro400("aula_id", "Informe a aula.");
  const aula = (banco.aulas ?? []).find((x) => x.id === aulaId && !x.arquivado_em);
  if (!aula) throw naoEncontrada("Aula não encontrada.");
  let tamanho: number;
  if (typeof corpo.arquivo_nome === "string") {
    if (/\.docx$/i.test(corpo.arquivo_nome)) tamanho = TAMANHO_DOCX_EXEMPLO;
    else if (/\.txt$/i.test(corpo.arquivo_nome)) tamanho = String(corpo.arquivo_texto ?? "").trim().length;
    else throw erro400("arquivo", "Formato não aceito. Envie .txt ou .docx.");
  } else tamanho = (typeof corpo.transcricao === "string" ? corpo.transcricao : "").trim().length;
  if (tamanho < MINIMO) throw erro400("transcricao", `A transcrição tem ${tamanho} caracteres, e o mínimo é ${MINIMO}.`);
  if (tamanho > MAXIMO) throw erro400("transcricao", "A transcrição passa de 400 mil caracteres. Envie só a transcrição desta aula.");
  const falhar = corpo.simular_erro === "1";
  const an: AnaliseAulaBanco = {
    id: novoId("ana"),
    aula_id: aula.id,
    aluno_id: aula.aluno_id,
    criada_em: ctx.agora,
    pronta_em: new Date(Date.parse(ctx.agora) + PROCESSANDO_MS).toISOString(),
    falhar,
    analise: falhar ? null : propostaDeExemplo(banco, aula.aluno_id, ctx.hoje),
    decisao: null,
    decidida_em: null,
    decidida_por: null,
  };
  lista(banco).push(an);
  return { id: an.id, status: "processando" };
}

function analiseOu404(banco: Banco, id: string) {
  const an = lista(banco).find((x) => x.id === id);
  if (!an) throw naoEncontrada("Análise não encontrada.");
  return an;
}

export const buscarAnaliseAula = (banco: Banco, id: string, agora: string) => respostaDaAnalise(analiseOu404(banco, id), agora);

export function analisesDaAula(banco: Banco, aulaId: string, agora: string) {
  if (!(banco.aulas ?? []).some((x) => x.id === aulaId)) throw naoEncontrada("Aula não encontrada.");
  const analises = lista(banco)
    .filter((x) => x.aula_id === aulaId)
    .sort((x, y) => y.criada_em.localeCompare(x.criada_em))
    .map((x) => respostaDaAnalise(x, agora));
  return { analises };
}

// POST /analises/:id/decidir { versao, pilares, checkpoints, motivo? }.
export function decidirAnalise(banco: Banco, id: string, corpo: Record<string, unknown>, ctx: Contexto) {
  const an = analiseOu404(banco, id);
  const status = statusDe(an, ctx.agora);
  if (status !== "pronta" || !an.analise) {
    throw erro400("status", status === "processando" ? "A análise ainda está em processamento." : "A análise terminou em erro.");
  }
  if (an.decidida_em) throw new ErroDaApi(409, { error: "ja_decidida", mensagem: "Esta análise já foi decidida." });
  const extra = Object.keys(corpo).find((k) => !["versao", "pilares", "checkpoints", "motivo"].includes(k));
  if (extra) throw erro400(extra, "Campo não permitido.");
  if (!Number.isInteger(corpo.versao)) throw erro400("versao", "Envie a versão do aluno.");
  const pilares = Array.isArray(corpo.pilares) ? corpo.pilares : [];
  const checkpoints = Array.isArray(corpo.checkpoints) ? corpo.checkpoints : [];
  if (!pilares.length && !checkpoints.length) throw erro400("pilares", "Decida ao menos um pilar ou checkpoint.");
  const motivo = typeof corpo.motivo === "string" && corpo.motivo.trim() ? corpo.motivo.trim() : null;

  const ajustes: { campo: string; valor: number; motivo: string }[] = [];
  for (const bruto of pilares) {
    const p = objeto(bruto) ?? {};
    const pilar = p.pilar as PilarAnalise;
    if (!PILARES_ANALISE.includes(pilar)) throw erro400("pilares", "Pilar inválido.");
    const sugerido = an.analise.pilares.find((x) => x.pilar === pilar);
    if (p.decisao === "editar") {
      if (!Number.isInteger(p.nota) || (p.nota as number) < 0 || (p.nota as number) > 100) {
        throw erro400("nota", "Em “editar”, a nota é obrigatória: um número inteiro de 0 a 100.");
      }
    } else if (p.decisao === "aprovar" || p.decisao === "rejeitar") {
      if ("nota" in p) throw erro400("nota", "A nota só vai em “editar”.");
      if (p.decisao === "aprovar" && sugerido?.notaSugerida == null) throw erro400("pilares", "Pilar sem nota sugerida não pode ser aprovado.");
    } else throw erro400("decisao", "Decisão inválida.");
    if (p.decisao === "rejeitar") continue;
    const nota = p.decisao === "editar" ? (p.nota as number) : (sugerido!.notaSugerida as number);
    const texto = `Análise de aula por IA: sugerido pela IA (nota ${sugerido?.notaSugerida ?? "—"}), aprovado por ${ctx.usuario.nome} (nota ${nota})`;
    ajustes.push({ campo: `progresso_${pilar}`, valor: nota, motivo: motivo ? `${texto} · ${motivo}` : texto });
  }
  const aluno = banco.alunos.find((x) => x.id === an.aluno_id);
  if (!aluno) throw naoEncontrada("Aluno não encontrado.");
  const cps: Record<string, unknown>[] = [];
  for (const bruto of checkpoints) {
    const c = objeto(bruto) ?? {};
    const cp = banco.checkpoints.find((x) => x.id === c.id && x.aluno_id === aluno.id);
    if (!cp) throw erro400("checkpoints", "Checkpoint inexistente ou de outro aluno.");
    if (c.decisao !== "aprovar" && c.decisao !== "rejeitar") throw erro400("decisao", "Decisão inválida.");
    if (c.decisao === "aprovar") cps.push({ id: cp.id, status: "realizado", data_realizada: ctx.hoje });
  }

  let versao = aluno.versao;
  if (ajustes.length || cps.length) {
    const r = salvarLote(banco, { alunos: [{ aluno_id: aluno.id, versao: corpo.versao, ajustes, checkpoints: cps }] }, ctx).resultados[0];
    if (!r.ok && r.error === "versao") throw new ErroDaApi(409, { error: "versao", aluno: r.aluno });
    if (!r.ok && r.error === "validacao") throw erro400(r.campo, r.mensagem);
    if (r.ok) versao = r.aluno.versao;
  } else if (corpo.versao !== aluno.versao) {
    throw new ErroDaApi(409, { error: "versao", aluno: montarAluno(banco, aluno, ctx.hoje) });
  }
  // A decisão é gravada DEPOIS de a escrita dar certo (como no backend). O lote
  // troca as tabelas do banco pela cópia gravada: a análise é relida aqui.
  const alvo = analiseOu404(banco, id);
  alvo.decisao = { pilares, checkpoints, motivo };
  alvo.decidida_em = ctx.agora;
  alvo.decidida_por = { id: ctx.usuario.id, nome: ctx.usuario.nome };
  return { versao, analise: respostaDaAnalise(alvo, ctx.agora) };
}

// Semente: uma análise PRONTA, ainda sem decisão, na aula feita mais recente do
// primeiro aluno ativo com checkpoint pendente (para a tela de revisão abrir).
export function semearAnaliseDeExemplo(banco: Banco, hoje: string) {
  const ontem = new Date(Date.parse(`${hoje}T12:00:00Z`) - 86_400_000).toISOString();
  for (const a of banco.alunos) {
    if (a.arquivado_em || a.status_aluno !== "ativo") continue;
    if (!banco.checkpoints.some((c) => c.aluno_id === a.id && PENDENTES.includes(c.status) && !c.arquivado_em)) continue;
    const aula = (banco.aulas ?? [])
      .filter((x) => x.aluno_id === a.id && x.status === "feito" && !x.arquivado_em)
      .sort((x, y) => y.data.localeCompare(x.data))[0];
    if (!aula) continue;
    lista(banco).push({
      id: "ana-exemplo",
      aula_id: aula.id,
      aluno_id: a.id,
      criada_em: ontem,
      pronta_em: ontem,
      falhar: false,
      analise: propostaDeExemplo(banco, a.id, hoje),
      decisao: null,
      decidida_em: null,
      decidida_por: null,
    });
    return;
  }
}
