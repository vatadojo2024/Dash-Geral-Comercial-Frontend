import { MENTORIA_POR_ULTIMO, type Config, type Programa, type ProgramaDoAluno } from "@/lib/educacional/contrato";

// ---------------------------------------------------------------------------
// Apoio da tela para os programas (specs/educacional/programas). Nada aqui é
// regra de negócio: a lista de escolha agrupada por mentoria e a SUGESTÃO de
// término (a pessoa pode mudar; o backend valida e grava na troca).
// ---------------------------------------------------------------------------

export type GrupoDeProgramas = { mentoria: string; programas: Programa[] };

// Programas ativos, agrupados por mentoria na ordem da configuração; a Ninja
// fica sempre por último (Entrega 1).
export function programasPorMentoria(config: Config | undefined, incluirInativos = false): GrupoDeProgramas[] {
  const grupos: GrupoDeProgramas[] = [];
  for (const p of config?.programas ?? []) {
    if (!p.ativo && !incluirInativos) continue;
    const g = grupos.find((x) => x.mentoria === p.mentoria);
    if (g) g.programas.push(p);
    else grupos.push({ mentoria: p.mentoria, programas: [p] });
  }
  const porUltimo = (g: GrupoDeProgramas) => (g.mentoria === MENTORIA_POR_ULTIMO ? 1 : 0);
  return grupos.sort((x, y) => porUltimo(x) - porUltimo(y));
}

// Programa sem acompanhamento individual (Ninja): o aluno não tem checkpoints.
export const semAcompanhamentoIndividual = (p: { acompanhamento_individual?: boolean } | null | undefined) =>
  p?.acompanhamento_individual === false;

// O aluno traz o programa aninhado; o que não vier nele sai da config (e, sem
// o aninhado, tudo sai da config pelo `programa_id`).
export function programaDoAluno(
  a: { programa_id: string | null; programa?: ProgramaDoAluno | null },
  config: Config | undefined,
): ProgramaDoAluno | null {
  const id = a.programa?.id ?? a.programa_id;
  const daConfig = (id && config?.programas.find((p) => p.id === id)) || null;
  if (!a.programa) return daConfig;
  return {
    ...a.programa,
    mentoria: a.programa.mentoria ?? daConfig?.mentoria,
    duracao_meses: a.programa.duracao_meses ?? daConfig?.duracao_meses ?? null,
    observacoes: a.programa.observacoes ?? daConfig?.observacoes ?? null,
    acompanhamento_individual: a.programa.acompanhamento_individual ?? daConfig?.acompanhamento_individual,
  };
}

export const temProgramas = (config: Config | undefined) => (config?.programas.length ?? 0) > 0;

// Marco a mostrar ao lado do nome: some quando o nome já começa por ele (os
// checkpoints de produção se chamam "Dia 0 (Boas-vindas)", "Mês 1 (Revisão)").
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function marcoVisivel(marco: string | null | undefined, nome: string): string | null {
  if (!marco) return null;
  return semAcento(nome.trim()).startsWith(semAcento(marco)) ? null : marco;
}

// Marco + nome numa linha só ("Dia 3 · Sprint"), sem repetir.
export function marcoENome(marco: string | null | undefined, nome: string): string {
  const m = marcoVisivel(marco, nome);
  return m ? `${m} · ${nome}` : nome;
}

// Início + N meses de calendário; no fim do mês cai no último dia (31/01 + 1 = 28/02).
export function sugerirTermino(inicio: string, meses: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return "";
  const [ano, mes, dia] = inicio.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}
