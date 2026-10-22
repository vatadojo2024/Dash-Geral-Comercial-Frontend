# Módulo Educacional — Fase 2 — Design (frontend)

## Contrato e mock
- `src/lib/educacional/contrato.ts` reescrito na v2 (seção 2). Etapas vêm da `Config`.
- `src/lib/mock/data_educacional.json` guarda o "banco" (config, alunos com `etapa_id`/`etapa_desde`/`versao`, checkpoints, intervenções, ajustes, histórico). As respostas são montadas pelo motor, como o backend faz.
- `src/lib/educacional/mock/motor.ts`: ÚNICO lugar do front com regra de negócio (7.2): dias na etapa, última atividade, dias sem atividade, faixa pelo Health efetivo (≥70/50–69/<50), Prova Social por Big Win na última etapa ativa, próximo checkpoint, resumo, SLA; versão, histórico, ajuste que sobrevive ao recálculo, geração de checkpoints.
- `src/lib/educacional/mock/banco.ts`: estado no `localStorage` (`mdc_edu_demo_v2`, try/catch, cai para memória), versão dos dados, restaurar.
- Desenvolvimento (só mock): `?simular_gravacao=409|400|rede` força a resposta das escritas.
- Alunos considerados no resumo: não arquivados com status `ativo` ou `em_pausa` (suposição do mock; alinhar com o back).

## Adapter e proxy
- `apiEducacional.ts`: leitura e escrita (seção 4 do backend); toda escrita devolve `AlunoDetalhe` (menos config).
- `/api/educacional/[...caminho]` (GET/POST/PATCH/PUT/DELETE) com trava de área e validação de caminho.
- Filtro `responsavel` passa a ser o `id` do responsável; `risco` filtra pela faixa efetiva.

## Gravação
- `useGravacao`: aplica na hora (aluno, listas, Kanban), troca pela resposta, desfaz no erro com aviso (400 mensagem, 409 texto da spec + recarrega, rede com "Tentar de novo"), "Salvo" no sucesso, invalida resumo quando afeta totais.

## Componentes novos (dentro do módulo, sem tocar no design system)
CelulaEditavel, FormAjuste, CampoCalculadoView, BlocoEditavel, SeletorColunas, MenuMoverPara, Abas, ConfirmarAcao, Avisos.
Fora do módulo: só o item "Configurações" no menu (Sidebar) e a regra de item ativo pelo caminho mais específico.
