import type { Config, Programa } from "@/lib/educacional/contrato";

// ---------------------------------------------------------------------------
// Apoio da tela para os programas (specs/educacional/programas). Nada aqui é
// regra de negócio: a lista de escolha agrupada por mentoria e a SUGESTÃO de
// término (a pessoa pode mudar; o backend valida e grava na troca).
// ---------------------------------------------------------------------------

export type GrupoDeProgramas = { mentoria: string; programas: Programa[] };

// Programas ativos, agrupados por mentoria na ordem da configuração.
export function programasPorMentoria(config: Config | undefined, incluirInativos = false): GrupoDeProgramas[] {
  const grupos: GrupoDeProgramas[] = [];
  for (const p of config?.programas ?? []) {
    if (!p.ativo && !incluirInativos) continue;
    const g = grupos.find((x) => x.mentoria === p.mentoria);
    if (g) g.programas.push(p);
    else grupos.push({ mentoria: p.mentoria, programas: [p] });
  }
  return grupos;
}

// Com a API ainda sem programas, o cadastro volta ao texto livre de mentoria.
export const temProgramas = (config: Config | undefined) => (config?.programas.length ?? 0) > 0;

// Início + N meses de calendário; no fim do mês cai no último dia (31/01 + 1 = 28/02).
export function sugerirTermino(inicio: string, meses: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return "";
  const [ano, mes, dia] = inicio.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}
