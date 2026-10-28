import type {
  AlunoDetalhe,
  CampoAjustavel,
  CampoCalculado,
  Checkpoint,
  FaixaSaude,
  Intervencao,
  AnaliseResumo,
  OrigemProgresso,
  ResumoEducacional,
  StatusCheckpoint,
  StatusFinanceiro,
} from "../contrato";
import { RE_MARCO } from "../contrato";
import { confirmadasDoAluno } from "./analises";
import type { AlunoBanco, Banco } from "./tipos";

// ---------------------------------------------------------------------------
// MOTOR DO MODO DEMONSTRAÇÃO — o ÚNICO lugar do front com regra de negócio, e
// só para o mock (spec Fase 2, seção 7.2). Imita o backend nos cálculos que ele
// faz nesta fase (seção 3 do backend): dias na etapa, última atividade, dias
// sem atividade, faixa de saúde pelo Health Score EFETIVO, Prova Social por Big
// Win, próximo checkpoint, resumo e SLA. Valor efetivo = ajuste ativo ??
// automático; o recálculo nunca apaga ajuste.
// ---------------------------------------------------------------------------

const DIA = 86_400_000;

// Hoje em Brasília, AAAA-MM-DD.
export function hojeBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function diasEntre(de: string, ate: string): number {
  const a = Date.parse(de.slice(0, 10));
  const b = Date.parse(ate.slice(0, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DIA));
}

// Faixas da seção 3 (valor padrão adotado): ≥ 70 saudável, 50–69 atenção, < 50 risco.
export function faixaDoHealth(health: number | null): FaixaSaude | null {
  if (health == null) return null;
  if (health >= 70) return "saudavel";
  if (health >= 50) return "atencao";
  return "risco";
}

export function etapasAtivas(banco: Banco) {
  return [...banco.config.etapas].filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem);
}

function ajusteAtivo(banco: Banco, alunoId: string, campo: CampoAjustavel) {
  return banco.ajustes.find((a) => a.aluno_id === alunoId && a.campo === campo && a.ativo) ?? null;
}

function campo<T>(banco: Banco, alunoId: string, nome: CampoAjustavel, automatico: T | null): CampoCalculado<T> {
  const aj = ajusteAtivo(banco, alunoId, nome);
  const ajuste = aj
    ? { valor: aj.valor as T, motivo: aj.motivo, ajustado_por: aj.ajustado_por, ajustado_em: aj.ajustado_em }
    : null;
  return { valor: ajuste ? ajuste.valor : automatico, automatico, ajuste };
}

// Datas do programa: "Dia N" = início + N dias; "Mês N" = N meses de calendário,
// caindo no último dia do mês quando o dia não existe (31/01 + 1 mês = 28/02).
export function dataDoMarco(inicio: string, marco: string): string | null {
  const m = RE_MARCO.exec(marco);
  if (!m) return null;
  const n = Number(m[2]);
  const [ano, mes, dia] = inicio.slice(0, 10).split("-").map(Number);
  if (m[1] === "Dia") {
    const d = new Date(Date.UTC(ano, mes - 1, dia + n));
    return d.toISOString().slice(0, 10);
  }
  const alvo = new Date(Date.UTC(ano, mes - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export const somarMeses = (inicio: string, meses: number) => dataDoMarco(inicio, `Mês ${meses}`) as string;

function checkpointsDoAluno(banco: Banco, alunoId: string): Checkpoint[] {
  // Roteiro e marco são REFERÊNCIA ao checkpoint padrão (editar em Configurações
  // vale para todos os alunos). Avulso: sem roteiro.
  const modelo = new Map(banco.config.checkpoints_modelo.map((m) => [m.id, m]));
  return banco.checkpoints
    .filter((c) => c.aluno_id === alunoId && !c.arquivado_em && !c.substituido_em)
    .sort((a, b) => a.ordem - b.ordem || (a.data_prevista ?? "").localeCompare(b.data_prevista ?? ""))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      ordem: c.ordem,
      data_prevista: c.data_prevista,
      data_realizada: c.data_realizada,
      status: c.status,
      big_win: c.big_win,
      observacao: c.observacao,
      marco: (c.modelo_id && modelo.get(c.modelo_id)?.marco) || null,
      roteiro: (c.modelo_id && modelo.get(c.modelo_id)?.roteiro) || null,
    }));
}

function responsavelDe(banco: Banco, id: string | null) {
  const r = id ? banco.config.responsaveis.find((x) => x.id === id) : null;
  return r ? { id: r.id, nome: r.nome, tipo: r.tipo } : null;
}

function intervencoesDoAluno(banco: Banco, alunoId: string): Intervencao[] {
  return banco.intervencoes
    .filter((i) => i.aluno_id === alunoId && !i.arquivado_em)
    .sort((a, b) => b.criada_em.localeCompare(a.criada_em))
    .map((i) => {
      const tipo = banco.config.tipos_intervencao.find((t) => t.id === i.tipo_id);
      return {
        id: i.id,
        tipo: { id: i.tipo_id, nome: tipo?.nome ?? "Tipo removido" },
        descricao: i.descricao,
        responsavel: responsavelDe(banco, i.responsavel_id),
        prazo: i.prazo,
        status: i.status,
        concluida_em: i.concluida_em,
        criada_por: i.criada_por,
        criada_em: i.criada_em,
      };
    });
}

// Próximo checkpoint: o primeiro (pela ordem) ainda não realizado.
export function proximoCheckpoint(checkpoints: Checkpoint[]) {
  const c = checkpoints.find((x) => x.status !== "realizado");
  return c ? { id: c.id, nome: c.nome, status: c.status, data_prevista: c.data_prevista } : null;
}

export function montarAluno(banco: Banco, a: AlunoBanco, hoje: string): AlunoDetalhe {
  const etapa = banco.config.etapas.find((e) => e.id === a.etapa_id);
  const checkpoints = checkpointsDoAluno(banco, a.id);
  const intervencoes = intervencoesDoAluno(banco, a.id);
  const c = <T,>(nome: CampoAjustavel, auto: T | null) => campo<T>(banco, a.id, nome, auto);
  // Fase 3: análises confirmadas (todas para a lista e a última atividade; as da
  // etapa ATUAL para o progresso automático e os highlights).
  const confirmadas = confirmadasDoAluno(banco, a.id);
  const daEtapa = confirmadas.filter((x) => x.etapa_id === a.etapa_id);
  const ultimaDaEtapa = daEtapa[0] ?? null;

  // Automáticos desta fase (seção 3 do backend).
  const diasNaEtapa = c<number>("dias_na_etapa", diasEntre(a.etapa_desde, hoje));
  const datasDeAtividade = [
    ...checkpoints.filter((x) => x.status === "realizado" && x.data_realizada).map((x) => x.data_realizada as string),
    ...intervencoes.filter((i) => i.status === "concluida" && i.concluida_em).map((i) => (i.concluida_em as string).slice(0, 10)),
    ...confirmadas.map((x) => x.data_aula),
  ].sort();
  const ultimaAtividade = c<string>("ultima_atividade", datasDeAtividade.at(-1) ?? null);
  const diasSemAtividade = c<number>(
    "dias_sem_atividade",
    ultimaAtividade.valor ? diasEntre(ultimaAtividade.valor, hoje) : null,
  );
  const health = c<number>("health_score", null); // fórmula pendente: só ajuste
  const faixa = c<FaixaSaude>("faixa_saude", faixaDoHealth(health.valor)); // pelo Health EFETIVO
  const ultimaEtapa = etapasAtivas(banco).at(-1);
  const programa = a.programa_id ? (banco.config.programas ?? []).find((p) => p.id === a.programa_id) : null;
  const bigWinRealizado = checkpoints.some((x) => x.big_win && x.status === "realizado");
  // Progresso automático = notas da análise confirmada mais recente da etapa atual
  // (sem análise na etapa: null). Ajuste manual continua prevalecendo.
  const nota = (k: "consumiu" | "entendeu" | "aplicou" | "validou") =>
    ultimaDaEtapa?.resultado_confirmado?.progresso[k].nota ?? null;
  const progresso = {
    consumiu: c<number>("progresso_consumiu", nota("consumiu")),
    entendeu: c<number>("progresso_entendeu", nota("entendeu")),
    aplicou: c<number>("progresso_aplicou", nota("aplicou")),
    validou: c<number>("progresso_validou", nota("validou")),
  };
  const origem = (n: CampoCalculado<number>): OrigemProgresso => {
    if (n.ajuste) return { tipo: "ajuste" };
    if (n.automatico != null && ultimaDaEtapa) return { tipo: "analise", analise_id: ultimaDaEtapa.id, data_aula: ultimaDaEtapa.data_aula };
    return { tipo: "nenhuma" };
  };
  // Highlights das análises da etapa atual (até 20); sem análise, os da ficha.
  const highlightsDasAnalises = daEtapa
    .flatMap((x) => (x.resultado_confirmado?.highlights ?? []).map((texto) => ({ data_aula: x.data_aula, texto })))
    .slice(0, 20);
  const nomeDaEtapa = (id: string) => banco.config.etapas.find((e) => e.id === id)?.nome ?? "Etapa removida";
  const analises: AnaliseResumo[] = confirmadas.map((x) => ({
    id: x.id,
    data_aula: x.data_aula,
    etapa: { id: x.etapa_id, nome: nomeDaEtapa(x.etapa_id) },
    resumo: x.resultado_confirmado!.resumo,
    notas: {
      consumiu: x.resultado_confirmado!.progresso.consumiu.nota,
      entendeu: x.resultado_confirmado!.progresso.entendeu.nota,
      aplicou: x.resultado_confirmado!.progresso.aplicou.nota,
      validou: x.resultado_confirmado!.progresso.validou.nota,
    },
  }));

  return {
    id: a.id,
    versao: a.versao,
    nome: a.nome,
    mentoria: a.mentoria,
    nivel_inicial: a.nivel_inicial,
    status_aluno: a.status_aluno,
    etapa: { id: a.etapa_id, nome: etapa?.nome ?? "Etapa removida" },
    proximo_checkpoint: proximoCheckpoint(checkpoints),
    dias_na_etapa: diasNaEtapa,
    dias_sem_atividade: diasSemAtividade,
    health_score: health,
    faixa_saude: faixa,
    proxima_acao: a.proxima_acao ? { descricao: a.proxima_acao, prazo: a.proxima_acao_prazo } : null,
    responsavel: responsavelDe(banco, a.responsavel_id),
    sinais: {
      upgrade: c<boolean>("sinal_upgrade", null),
      renovacao: c<boolean>("sinal_renovacao", null),
      prova_social: c<boolean>("sinal_prova_social", bigWinRealizado && a.etapa_id === ultimaEtapa?.id),
    },
    arquivado: Boolean(a.arquivado_em),
    programa: programa ? { id: programa.id, nome: programa.nome, mentoria: programa.mentoria, duracao_meses: programa.duracao_meses } : null,
    data_inicio_programa: a.data_inicio_programa ?? null,
    programa_observacao: programa?.observacao ?? null,
    data_entrada: a.data_entrada,
    data_termino: a.data_termino,
    etapa_desde: a.etapa_desde,
    objetivo: a.objetivo,
    diagnostico: a.diagnostico,
    motivo_risco: a.motivo_risco,
    observacoes: a.observacoes,
    autorizacao_prova_social: a.autorizacao_prova_social,
    ultima_atividade: ultimaAtividade,
    status_financeiro: c<StatusFinanceiro>("status_financeiro", null),
    ltv: c<number>("ltv", null),
    progresso,
    highlights: highlightsDasAnalises.length
      ? highlightsDasAnalises
      : [...a.highlights].sort((x, y) => y.data_aula.localeCompare(x.data_aula)),
    checkpoints,
    intervencoes,
    analises,
    progresso_origem: {
      consumiu: origem(progresso.consumiu),
      entendeu: origem(progresso.entendeu),
      aplicou: origem(progresso.aplicou),
      validou: origem(progresso.validou),
    },
  };
}

// Alunos da jornada: não arquivados, com status ativo ou em pausa.
export function naJornada(a: AlunoBanco): boolean {
  return !a.arquivado_em && (a.status_aluno === "ativo" || a.status_aluno === "em_pausa");
}

const SLA: readonly StatusCheckpoint[] = ["pendente", "nao_respondeu"]; // Q2

export function montarResumo(banco: Banco, hoje: string, agora: string): ResumoEducacional {
  const alunos = banco.alunos.filter(naJornada).map((a) => montarAluno(banco, a, hoje));
  const healths = alunos.flatMap((a) => (a.health_score.valor == null ? [] : [a.health_score.valor]));
  return {
    atualizado_em: agora,
    kpis: {
      health_score_medio: healths.length ? Math.round(healths.reduce((s, h) => s + h, 0) / healths.length) : null,
      alunos_ativos: alunos.length,
      intervencoes_sla: alunos.filter((a) => a.proximo_checkpoint && SLA.includes(a.proximo_checkpoint.status)).length,
      em_risco: alunos.filter((a) => a.faixa_saude.valor === "risco").length, // Q6
    },
    funil: etapasAtivas(banco).map((e) => ({
      etapa_id: e.id,
      nome: e.nome,
      alunos: alunos.filter((a) => a.etapa.id === e.id).length,
    })),
    sinais: {
      upgrade: alunos.filter((a) => a.sinais.upgrade.valor === true).length,
      renovacao: alunos.filter((a) => a.sinais.renovacao.valor === true).length,
      prova_social: alunos.filter((a) => a.sinais.prova_social.valor === true).length,
    },
  };
}
