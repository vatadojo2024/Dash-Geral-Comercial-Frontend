# Módulo Educacional — Fase 2 (Edição) — Requisitos (frontend)

Fonte da verdade: `specs/educacional/Módulo Educacional — Fase 2 (Edição) — Frontend.md`.
Endpoints: seção 4 de `spec/educacional/Módulo Educacional — Fase 2 (Edição) — Backend.md` (repositório do backend).
Plano aprovado em 22/10/2026.

- **R1** Contrato da seção 2 em Zod (substitui o da Fase 1), tolerante aluno a aluno e item a item.
- **R2** Kanban: arrastar e soltar entre etapas ativas + "Mover para…"; otimista com volta e aviso; dias na etapa zeram; ordem faixa → dias; filtros da tabela; sem paginação (`por_pagina=todos`).
- **R3** Tabela: edição na linha nas 8 colunas (Enter/clique entra, Enter/clique fora salva, Esc cancela); calculado abre ajuste; seletor de colunas lembrado no navegador; "Mostrar arquivados" com "Reativar"; "+ Novo aluno".
- **R4** Raio-X: os 8 blocos com Editar/Salvar/Cancelar; Arquivar aluno; abas Visão geral | Histórico.
- **R5** Ajuste manual: valor + motivo (mín. 5); selo "Ajustado"; "Automático: X"/"sem cálculo"; "Voltar ao automático" com confirmação.
- **R6** Histórico paginado, mais recente primeiro, filtro por entidade.
- **R7** Checkpoints: editar, adicionar avulso, arquivar. **R8** Intervenções: criar, editar, concluir, reabrir, arquivar.
- **R9** Novo aluno → Raio-X com checkpoints gerados pelo modelo.
- **R10** Configurações (`/educacional/configuracoes`): 4 abas; etapas reordenáveis; inativos só ali; erro de etapa com alunos; aviso "só alunos novos"; aviso da planilha.
- **R11** Gravação (7.1): otimista; resposta substitui; 400/409/rede; "Salvo"; Cockpit recarrega quando afeta totais.
- **R12** Demonstração (7.2): escrita completa, persistência no navegador, "Restaurar dados de demonstração"; mock imita o backend só no que a 7.2 lista.
- **R13** Adapter `api` pronto e desligado. **R14** Celular em 390 px; nada muda para papéis comerciais.

## Definições (22/10)
- **Q1** Valores sem cálculo automático (Health Score, financeiro, LTV, progresso, Upgrade, Renovação) entram no mock como ajuste manual com motivo "Valor importado da Fase 1".
- **Q2** Intervenções SLA = próximo checkpoint `pendente` ou `nao_respondeu`.
- **Q3** Kanban: `GET /alunos?por_pagina=todos`.
- **Q4** Erros: 400 `{ error: "validacao", campo, mensagem }`; 409 `{ error: "versao", aluno }`; 409 `{ error: "etapa_com_alunos", alunos: N }`. Histórico `{ itens, total }` com `?pagina=N&entidade=...`.
- **Q5** Toda escrita em aluno, checkpoint e intervenção envia a `versao` do aluno.
- **Q6** "Em risco" = faixa de saúde efetiva = risco.
- Checkpoints padrão (mock e semente do backend): Dia 0 (0), Semana 1 (7), Mês 1 (30), Mês 2 (60), Mês 3 (90, Big Win), Mês 4 (120), Mês 5 (150), Mês 6 (180); prazo de SLA nulo.
- Arrastar e soltar: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.
- Proxy único `/api/educacional/[...caminho]`: só repassa para `/api/educacional/` no backend; rejeita com 400 `..`, barra dupla e caminho codificado que saia do prefixo (testado).
