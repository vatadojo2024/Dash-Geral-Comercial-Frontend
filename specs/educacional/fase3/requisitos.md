# Módulo Educacional — Fase 3 — Requisitos (frontend)

Fonte da verdade: `specs/educacional/Módulo Educacional — Fase 3 — Frontend.md`.
Endereços: seções 3 (lote), 4 (alunos e opções) e 5.2 (análises) de `spec/educacional/Módulo Educacional — Fase 3 — Backend.md` (repositório do backend).
Diagnóstico de desempenho: https://claude.ai/artifact/Dx2zq5KQruFPo3MEpf7SX7 (correção 1, região `gru1`, já publicada em `2a5e0ec`).
Plano aprovado em 26/10/2026, com foco no computador: medições, regressão visual e screenshots só no desktop; telas novas com o layout responsivo do design system, sem teste extra de celular.

## Desempenho (correções aprovadas em 26/10)
- **Correção 2 —** `/api/sdr-dashboard`: as 13 chamadas saem juntas, com a mesma semântica de erro (falha SDR → 502; liderança → `lideranca_erro`; vendas → lista vazia). A Produtividade SDR só busca o pacote nas abas que o usam (Dashboard SDR, Comissões, Liderança).
- **Correção 3 —** O cliente do Supabase é carregado com a página (sem `import()` a cada chamada); o token é lido da sessão já pronta.
- ~~Correção 4 — Sob demanda~~: fora do plano (26/10).
- **Correção 6 —** Conferência de Agendamentos sai em paralelo com a fila, com **exatamente** a mesma janela e os mesmos dados de hoje.
- **Correção 7 —** Cache: leads e agendamentos valem até 1 minuto; pacote do SDR, vendas, retenção e eventos, 5 minutos; nada recarrega ao voltar o foco enquanto o dado vale; botão "Atualizar" em toda tela comercial que ainda não tem.
- **Correção 8 —** Educacional: células e cards só redesenham quando o aluno deles muda; a tabela não empurra a tela ao carregar (CLS < 0,1).
- Fora de escopo agora: rolagem virtual, gravação do `localStorage` com atraso, correção 5 (funções frias), que se decide após nova medição.
- Telas comerciais: mesmos dados e mesmo visual (regressão pixel a pixel no desktop), salvo o botão "Atualizar" novo e a melhora de carregamento.
- **Push das correções:** cada uma vai para produção só depois da regressão das telas de closer e SDR passar e do resumo enviado ao Vata. M1 a M5 ficam sem push até a verificação final.

## Menu e aba Alunos (spec 3)
- **R1** Menu do módulo: Saúde da Jornada, Alunos, Análise de aula, Configurações.
- **R2** Cockpit: KPIs, funil e sinais como hoje; a tabela sai; entra "Precisam de atenção" (até 10, faixa → dias sem atividade) com "Ver todos os alunos"; cliques levam à aba Alunos já filtrada.
- **R3** Aba Alunos (`/educacional/alunos`): busca por nome (300 ms, mín. 2 caracteres), filtros novos (etapa, faixa, status do checkpoint, status do aluno, mentoria, responsável com "Sem responsável", sinal, "Mostrar arquivados"), Lista | Kanban, ordenação e seletor de colunas da Fase 2, "+ Novo aluno", contador "N alunos" com "Limpar filtros", estado na URL e volta do Raio-X igual.

## Salvar em lote (spec 4)
- **R4** Edição na tabela e movimento no Kanban viram pendentes, sem chamar a API; marca visual (fundo amarelo claro + ponto, valor anterior ao passar o mouse); "Desfazer" no menu de contexto; vale a última alteração; campo calculado pede o motivo na hora.
- **R5** Barra fixa no rodapé: "N alterações em M alunos · Descartar · Salvar"; um único `POST /lote`; tela navegável durante o envio, só as células dos alunos em envio bloqueadas.
- **R6** Resultado por aluno: gravado troca pelo `AlunoDetalhe`; erro continua pendente com o motivo; resumo "N salvas · M com erro"; 409 com "Ver versão atual" e "Reaplicar minhas alterações"; validação marca a célula; rede não perde nada e oferece "Tentar de novo"; Descartar com confirmação; Cockpit atualizado uma vez.
- **R7** Proteção: confirmação ao sair com pendências; pendências guardadas no `sessionStorage` e recuperadas ao recarregar.
- **R8** Continuam imediatos: novo aluno, arquivar/reativar, configurações, confirmação de análise.

## Raio-X (spec 6)
- **R9** "Editar ficha": todos os blocos editáveis ao mesmo tempo; pendências com a mesma marca; "Salvar ficha" = um `POST /lote` com um aluno; "Cancelar" com confirmação; mesmo tratamento de 409/validação/rede e mesma proteção; fora do modo de edição, "Ajustar", "Voltar ao automático", "Arquivar aluno" e "Nova análise de aula" seguem imediatos.
- **R10** Abas Visão geral | Aulas | Histórico; Aulas lista as análises confirmadas (data, etapa, resumo com "ver mais", 4 notas em barras), abre a análise em leitura, "+ Nova análise de aula", vazio "Nenhuma aula analisada ainda". Progresso mostra a origem de cada nota.

## Análise de aula (spec 5)
- **R11** Lista (`/educacional/analises`) com selos de status, filtros por status e aluno ("Pronta para revisar" primeiro), "+ Nova análise", atualização a cada 5 s só enquanto houver análise na fila ou processando.
- **R12** Nova análise: aluno com busca (`alunos/opcoes`, já preenchido vindo do Raio-X), data (hoje), etapa (a atual), transcrição por arquivo (`.txt`, `.vtt`, `.srt`, `.docx`) ou texto colado, nome e tamanho antes de enviar; envio não trava; volta à lista com o aviso da spec.
- **R13** Aviso discreto "Análise de Fulana pronta para revisar", com link, em qualquer tela do módulo, vindo da mesma consulta periódica.
- **R14** Revisão (`/educacional/analises/[id]`): resumo, 4 notas (0–100, justificativa, evidências), highlights (adicionar, editar, remover, reordenar); transcrição com rolagem e busca; evidência destaca o trecho; quadro "O que vai mudar na ficha" (com aviso de ajuste manual prevalecendo); Confirmar (com `versao`, 409 recarrega e pede de novo), Descartar e Reprocessar com confirmação; erro com "Reprocessar"; confirmada/descartada só leitura.
- **R15** Modo demonstração: fila → processando → pronta com espera de alguns segundos; resultado de exemplo coerente com o texto; confirmação grava no banco do mock com as regras do backend.

## Gerais
- **R16** Contrato da seção 7 em Zod, tolerante (campos novos ausentes não derrubam a tela).
- **R17** Tudo no modo demonstração; adapter `api` pronto e desligado (inclui `POST /lote`, `alunos/opcoes`, análises e o envio multipart pelo proxy).
- **R18** Telas novas com o layout responsivo do design system (sem teste extra de celular); nenhuma rota comercial chamada pelo módulo; nada muda para papéis comerciais além das correções de desempenho.
- **R19** Commits por frente (uma correção de desempenho por commit). Push só com o ok do Vata.

## Decisões (aprovadas em 26/10)
- **D1 — Tamanho do arquivo.** A Vercel recusa corpo de requisição acima de 4,5 MB, e o envio passa pelo proxy. Aprovado: limite de **4 MB** na tela, com mensagem clara se passar.
- **D2 — Lista de mentorias para o filtro.** Nenhum endereço devolve a lista. Aprovado: `mentorias: string[]` no `GET /config` (o Vata pede ao backend; o mock já devolve). No novo aluno e na edição, o campo mentoria sugere as existentes enquanto a pessoa digita.
- **D3 — "Precisam de atenção".** A ordem faixa → dias sem atividade não existe no backend. Aprovado: `GET /alunos?ordem=atencao&por_pagina=10` = faixa efetiva (risco, atenção, saudável), depois `dias_sem_atividade` decrescente, nulos no fim (o Vata pede ao backend; o mock implementa).
- **D4 — Progresso no modo demonstração.** Hoje quase todo aluno do mock tem o progresso como ajuste manual ("Valor importado da Fase 1"), e uma análise confirmada não mudaria nada visível. Aprovado, só no modo demonstração: na semente, o progresso e os highlights da Fase 1 viram uma **análise confirmada importada** por aluno, e os ajustes de progresso saem. O banco de demonstração de quem já usou a Fase 2 é recriado uma vez.
- **D5 — Resumo do lote (aprovado).** "4 salvas · 1 com erro" conta alterações (as do aluno com erro aparecem como "com erro").
- **D6 — Trocar de rota dentro do módulo.** As pendências são do módulo inteiro (aparecem na aba Alunos e no Raio-X do mesmo aluno, e a barra acompanha). Aprovado: pedir confirmação ao **sair do módulo** (menu de outro módulo, seletor Comercial | Educacional, outra URL) e ao fechar ou recarregar a aba; entre telas do módulo nada se perde, então não pergunta. Entre telas do módulo, as pendências seguem com a barra.
