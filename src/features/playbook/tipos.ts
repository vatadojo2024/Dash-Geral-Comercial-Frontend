// ---------------------------------------------------------------------------
// Contrato do gerador de playbook (P2) — espelha o que o motor (P1) devolve em
// /playbooks. Mantém os campos úteis à tela; o adaptador (playbookClient) é
// TOLERANTE: campo faltando vira null/default, sem quebrar.
// ---------------------------------------------------------------------------

// status do job no serviço.
export type PlaybookStatus = "pendente" | "processando" | "pronto" | "erro";
export const PLAYBOOK_STATUS: PlaybookStatus[] = ["pendente", "processando", "pronto", "erro"];

// fase do pipeline (1 Diagnóstico, 2 Estratégia, 3 Execução).
export type FasePlaybook = 1 | 2 | 3;

export const FASES: { numero: FasePlaybook; titulo: string }[] = [
  { numero: 1, titulo: "Diagnóstico" },
  { numero: 2, titulo: "Estratégia" },
  { numero: 3, titulo: "Execução" },
];

// Um job de playbook. `resultado` só vem no detalhe (GET /playbooks/{id}); na
// listagem é null. Datas em ISO (created_at/updated_at do serviço).
export type PlaybookJob = {
  id: string;
  status: PlaybookStatus;
  fase_atual: FasePlaybook | null;
  origem_arquivo: string | null;
  lead_email: string | null;
  lead_telefone: string | null;
  resultado: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
};
