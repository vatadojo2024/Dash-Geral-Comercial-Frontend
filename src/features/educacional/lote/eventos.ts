import type { AlunoDetalhe } from "@/lib/educacional/contrato";

// Aviso de "aluno gravado na hora" (useGravacao) para quem guarda pendências
// (ProvedorLote), sem um importar o outro. Vive na memória da aba: só chega
// aqui a gravação que ESTA aba fez, depois da resposta do servidor, com a
// versão que ela enviou e o aluno (com a versão nova) que voltou.
export type GravacaoDaAba = { aluno: AlunoDetalhe; versaoEnviada: number };
type Ouvinte = (g: GravacaoDaAba) => void;
const ouvintes = new Set<Ouvinte>();

export function ouvirGravacoes(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

export function avisarGravacao(g: GravacaoDaAba) {
  ouvintes.forEach((o) => o(g));
}
