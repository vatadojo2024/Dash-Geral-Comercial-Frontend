# Módulo Educacional — Fase 3 — Tasks (frontend)

Um commit por item. Correções de desempenho: push só depois da regressão de closer e SDR passar e do resumo enviado ao Vata. M1 a M5: sem push até a verificação final. Medições, regressão e screenshots só no desktop.

## Desempenho
- [x] Correção 1 — Região `gru1` (`vercel.json`) — publicada em `2a5e0ec`, medida antes e depois.
- [x] Correção 2 — `sdr-dashboard` numa onda só + pacote só nas abas que usam. Teste de payload idêntico.
- ~~Correção 3 — Cliente do Supabase carregado com a página~~: revertida em 26/10 (não reduziu de forma clara o tempo até a 1ª chamada em produção; First Load JS +60 kB).
- ~~Correção 4 — Sob demanda~~: fora do plano (26/10).
- [x] Correção 6 — Conferência de Agendamentos em paralelo com a fila, mesma janela e mesmos dados (teste).
- [x] Correção 7 — Cache por tipo de dado (1 min / 5 min), sem recarga com dado válido, botão "Atualizar" nas telas comerciais.
- [x] Correção 8 — Educacional: linhas e cards memorizados, tabela sem empurrar a tela.
- Regressão de cada uma: 8 telas de closer e SDR, desktop, pixel a pixel no mock local; resumo ao Vata antes do push.

## Módulo
- [x] M1. Contrato da seção 7, adapter (lote, opções, análises, filtros novos), proxy multipart, mock (lote, opções, `ordem=atencao`, mentorias no `/config`, análises, semente D4) e testes. Campo mentoria com sugestões (novo aluno e edição).
  - Alinhar com o backend quando ele publicar a Fase 3: corpo de `POST /analises/:id/confirmar` (o front manda `{ versao, resultado }`) e a resposta de `descartar`/`reprocessar` (o front não depende dela).
  - Filtro de SLA (dois status de checkpoint): voltou para a API em 28/10 (`checkpoint=pendente,nao_respondeu`, backend `a971add`). Conferir contra a API real antes do push.
- [x] M2. Menu com 4 itens, Cockpit com "Precisam de atenção" e aba Alunos (busca, filtros, contador, URL).
  - O filtro de mentoria virou o filtro de programa (decisão dos programas, 28/10). Faixa de saúde segue em `risco` (aceito pela API hoje).
  - "Análise de aula" abre um marcador até o M5. Link salvo da Fase 2 (`/educacional?filtros`) vai para a aba Alunos; o Raio-X volta para a tela de origem (`?voltar=` com o caminho).
- [x] M3. Salvar em lote na aba Alunos: armazém de pendências, marca e "Desfazer", barra, envio sem travar, resultado parcial, 409 com "Ver versão atual" e "Reaplicar", rede, `sessionStorage`, guarda de saída.
  - `lote/pendencias.ts` (puro), `lote/alteracoes.ts` (uma alteração por célula), `ProvedorLote` na casca do módulo, `BarraDeAlteracoes`, `MarcaPendente`. "Antes: X" no `title` da célula. O 409 fica fora do próximo "Salvar" até a escolha.
  - Topbar (compartilhado): o seletor de módulo passa por `navegarComGuarda` (`src/lib/navegacao/guardaDeSaida.ts`); sem pendências, segue igual.
  - Mock: `simular_gravacao=409` no lote sobe a versão do primeiro aluno; `400` devolve validação só para ele.
- [x] M4. Raio-X com "Editar ficha" e "Salvar ficha" em lote.
  - Mesmo armazém da aba Alunos: o que foi editado na tabela aparece no Raio-X, que já abre em edição. Checkpoints (editar, avulso, arquivar) e intervenções (nova, editar, concluir/reabrir, arquivar) também viram pendências da ficha. `useBloco`/`BlocoEditavel` saíram.
  - Sobreposição na tela por operações (campo, dentro de grupo, item, novo, remover): duas edições no mesmo grupo não se apagam.
  - Ação imediata da própria pessoa sobre a versão das pendências (ex.: arquivar) faz as pendências seguirem na versão nova; qualquer outro salto vai para o 409.
  - Aba Aulas e origem das notas ficam no M5 (dependem das análises).
- [ ] M5. Análise de aula: lista, nova análise, revisão e confirmação, observador e aviso de pronta, aba Aulas e origem das notas.

## Verificação
- [ ] V1. Todas as funções como educacional e como admin; lote com sucesso, erro parcial, 409 e rede; pendências após recarregar; análise completa no mock; nenhuma rota comercial; regressão comercial (desktop); números antes e depois em produção (desktop); relatório com screenshots e checklist da seção 8.
