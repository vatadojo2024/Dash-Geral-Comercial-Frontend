import type { AlunoDetalhe } from "@/lib/educacional/contrato";

// Aviso de "aluno gravado na hora" (useGravacao) para quem guarda pendências
// (ProvedorLote), sem um importar o outro.
type Ouvinte = (aluno: AlunoDetalhe) => void;
const ouvintes = new Set<Ouvinte>();

export function ouvirGravacoes(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

export function avisarGravacao(aluno: AlunoDetalhe) {
  ouvintes.forEach((o) => o(aluno));
}
