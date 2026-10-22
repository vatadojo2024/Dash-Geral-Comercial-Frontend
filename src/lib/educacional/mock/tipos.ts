import type {
  AutorizacaoProvaSocial,
  CampoAjustavel,
  Config,
  EntidadeHistorico,
  NivelInicial,
  StatusAluno,
  StatusCheckpoint,
  Usuario,
} from "../contrato";

// ---------------------------------------------------------------------------
// O "banco" do modo demonstração: as mesmas tabelas da seção 2 do backend da
// Fase 2 (edu_alunos, edu_checkpoints, edu_intervencoes, edu_ajustes_manuais,
// edu_historico), guardadas no navegador. As respostas da API são MONTADAS a
// partir daqui pelo motor (motor.ts), como o backend faz.
// ---------------------------------------------------------------------------

export type AlunoBanco = {
  id: string;
  nome: string;
  mentoria: string;
  data_entrada: string;
  data_termino: string | null;
  objetivo: string | null;
  nivel_inicial: NivelInicial;
  status_aluno: StatusAluno;
  etapa_id: string;
  etapa_desde: string;
  responsavel_id: string | null;
  proxima_acao: string | null;
  proxima_acao_prazo: string | null;
  diagnostico: string | null;
  motivo_risco: string | null;
  autorizacao_prova_social: AutorizacaoProvaSocial;
  observacoes: string | null;
  highlights: { data_aula: string; texto: string }[];
  arquivado_em: string | null;
  versao: number;
};

export type CheckpointBanco = {
  id: string;
  aluno_id: string;
  modelo_id: string | null;
  nome: string;
  ordem: number;
  data_prevista: string | null;
  data_realizada: string | null;
  status: StatusCheckpoint;
  big_win: boolean;
  observacao: string | null;
  arquivado_em: string | null;
};

export type IntervencaoBanco = {
  id: string;
  aluno_id: string;
  tipo_id: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: "aberta" | "concluida";
  concluida_em: string | null;
  criada_por: Usuario;
  criada_em: string;
  arquivado_em: string | null;
};

export type AjusteBanco = {
  id: string;
  aluno_id: string;
  campo: CampoAjustavel;
  valor: unknown;
  motivo: string;
  ajustado_por: Usuario;
  ajustado_em: string;
  ativo: boolean;
};

export type HistoricoBanco = {
  id: string;
  aluno_id: string;
  entidade: EntidadeHistorico;
  entidade_id: string;
  campo: string;
  valor_antes: unknown;
  valor_depois: unknown;
  motivo: string | null;
  usuario: Usuario;
  em: string;
};

export type Banco = {
  versao_dados: number;
  config: Config;
  alunos: AlunoBanco[];
  checkpoints: CheckpointBanco[];
  intervencoes: IntervencaoBanco[];
  ajustes: AjusteBanco[];
  historico: HistoricoBanco[];
};

// Erro com o mesmo corpo que a API devolve (seção 4 do backend + definições Q4).
export class ErroDaApi extends Error {
  constructor(
    public readonly status: number,
    public readonly corpo: { error: string; campo?: string; mensagem?: string; aluno?: unknown; alunos?: number },
  ) {
    super(corpo.mensagem ?? corpo.error);
  }
}
