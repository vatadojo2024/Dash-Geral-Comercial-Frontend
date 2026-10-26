# Módulo Educacional — Fase 3 — Tasks (frontend)

Um commit por item. Correções de desempenho: push só depois da regressão de closer e SDR passar e do resumo enviado ao Vata. M1 a M5: sem push até a verificação final. Medições, regressão e screenshots só no desktop.

## Desempenho
- [x] Correção 1 — Região `gru1` (`vercel.json`) — publicada em `2a5e0ec`, medida antes e depois.
- [x] Correção 2 — `sdr-dashboard` numa onda só + pacote só nas abas que usam. Teste de payload idêntico.
- [x] Correção 3 — Cliente do Supabase carregado com a página (fim do `import()` por chamada).
- ~~Correção 4 — Sob demanda~~: fora do plano (26/10).
- [x] Correção 6 — Conferência de Agendamentos em paralelo com a fila, mesma janela e mesmos dados (teste).
- [x] Correção 7 — Cache por tipo de dado (1 min / 5 min), sem recarga com dado válido, botão "Atualizar" nas telas comerciais.
- [x] Correção 8 — Educacional: linhas e cards memorizados, tabela sem empurrar a tela.
- Regressão de cada uma: 8 telas de closer e SDR, desktop, pixel a pixel no mock local; resumo ao Vata antes do push.

## Módulo
- [ ] M1. Contrato da seção 7, adapter (lote, opções, análises, filtros novos), proxy multipart, mock (lote, opções, `ordem=atencao`, mentorias no `/config`, análises, semente D4) e testes. Campo mentoria com sugestões (novo aluno e edição).
- [ ] M2. Menu com 4 itens, Cockpit com "Precisam de atenção" e aba Alunos (busca, filtros, contador, URL).
- [ ] M3. Salvar em lote na aba Alunos: armazém de pendências, marca e "Desfazer", barra, envio sem travar, resultado parcial, 409 com "Ver versão atual" e "Reaplicar", rede, `sessionStorage`, guarda de saída.
- [ ] M4. Raio-X com "Editar ficha" e "Salvar ficha" em lote.
- [ ] M5. Análise de aula: lista, nova análise, revisão e confirmação, observador e aviso de pronta, aba Aulas e origem das notas.

## Verificação
- [ ] V1. Todas as funções como educacional e como admin; lote com sucesso, erro parcial, 409 e rede; pendências após recarregar; análise completa no mock; nenhuma rota comercial; regressão comercial (desktop); números antes e depois em produção (desktop); relatório com screenshots e checklist da seção 8.
