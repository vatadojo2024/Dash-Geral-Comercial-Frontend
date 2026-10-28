# Programas e roteiros de checkpoint — Tarefas (frontend)

Plano aprovado em 28/10 (6 decisões aprovadas; filtro com vários programas agrupados por mentoria). Um commit por item. Sem push até a verificação, como M1 a M5. Desktop. Nomes finais de rotas e campos: os do plano do backend; até lá, os da proposta.

- [x] P1. Contrato (Programa, Roteiro, PreviaTroca; acréscimos em Config, CheckpointModelo, Checkpoint, Aluno) com padrões tolerantes; adapter (programas na config, `/previa`, troca, filtro `programa_id`); mock (6 programas, roteiros de exemplo, semente v3, troca) e testes.
- [x] P2. Cadastro: Programa obrigatório, término sugerido editável; mentoria exibida como hoje.
- [x] P3. Raio-X: programa e observação; painel "Roteiro do contato" (próximo checkpoint aberto); editar checkpoint pelo painel.
- [x] P4. Trocar programa: diálogo em 2 passos com prévia, motivo, 400/409.
- [x] P5. Configurações: aba Programas; Checkpoints padrão com seletor de programa, marco e roteiro.
- [x] P6. Filtro por programa, vários ao mesmo tempo, opções agrupadas por mentoria: na lista e no Kanban (componente `FiltroProgramas`, reaproveitado na aba Alunos do M2).
- [x] PV. Verificação (28/10): fluxos P2 a P6 no mock (desktop), 478 testes, nenhuma rota comercial chamada, nenhum arquivo fora do módulo alterado, screenshots. Falta conferir contra o backend quando ele publicar programas (nomes finais de rotas e campos).
