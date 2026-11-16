import type { AnaliseBanco, Banco } from "./tipos";

// ---------------------------------------------------------------------------
// Análises confirmadas do modo demonstração (spec Fase 3, seção 5.4): hoje só as
// importadas do progresso da Fase 1 (semente D4), que alimentam o progresso e a
// origem dele no Raio-X. A análise de aula com IA (16/11/2026) está em
// analiseAula.ts, com o contrato novo do backend.
// ---------------------------------------------------------------------------

// Confirmadas do aluno, mais recente primeiro (data da aula, depois confirmação).
export function confirmadasDoAluno(banco: Banco, alunoId: string): AnaliseBanco[] {
  return (banco.analises ?? [])
    .filter((x) => x.aluno_id === alunoId && x.estado === "confirmada" && x.resultado_confirmado)
    .sort((a, b) => b.data_aula.localeCompare(a.data_aula) || (b.confirmada_em ?? "").localeCompare(a.confirmada_em ?? ""));
}
