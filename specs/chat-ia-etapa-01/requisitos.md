# Etapa 1 — Tela de Chat (mock) — Requisitos

**Projeto:** Chat IA-Guia (recurso novo do painel comercial Vata Dojo)
**Etapa:** 1 de 9 (Fase A — Front, mock-first)
**Versão:** 1.0
**Método:** SDD (Spec-Driven Development) — este documento é a fonte da verdade. O código é derivado dele.

---

## Objetivo da etapa

Entregar a **tela de chat funcionando visualmente**, dentro do projeto do front que já existe, com respostas **fictícias** (mock). A tela mostra o agente certo conforme o **papel** de quem logou, simula o fluxo de resposta que pode demorar (bolha do usuário → "pensando…" → resposta) e guarda os dados num **formato que espelha o contrato real** que o serviço de IA vai devolver nas etapas seguintes.

Esta etapa **não** tem backend, banco, login no serviço novo, leitura de arquivo nem consulta ao Clint. Ela existe para validar o visual e o fluxo antes de construir as partes caras.

---

## Glossário rápido (em português claro)

- **Front:** a interface que roda no navegador (o painel que closers, SDRs e admins já abrem hoje).
- **Mock:** dado fictício, "de mentira", usado para montar a tela sem precisar do sistema real por trás.
- **Agente / IA-guia:** o assistente de IA daquele papel. Cada papel (admin, closer, SDR) tem o seu, com técnica de venda diferente.
- **Papel:** a função do **usuário** logado — `admin`, `closer` ou `sdr`. Define qual agente aparece.
- **Autor:** quem escreveu **a mensagem** — o `usuario` ou a `ia`. (Termo separado de "papel" de propósito, para não confundir os dois.)
- **Assíncrono:** o jeito de tratar uma resposta que pode demorar — manda a pergunta, libera a tela e a resposta aparece quando ficar pronta, sem travar.
- **Estado React (em memória):** os dados ficam guardados só enquanto a página está aberta; ao recarregar, somem. Aceitável nesta etapa (a persistência de verdade vem depois, com o banco).
- **Contrato:** o formato combinado dos dados (campos e nomes). O mock precisa usar o mesmo contrato que o serviço real vai usar, para que trocar um pelo outro depois não exija refazer a tela.

---

## Requisitos

### RF-01 — A aba de chat existe e abre

**Como** usuário logado no painel,
**quero** abrir uma aba de chat com a IA,
**para** conversar com o guia do meu papel.

Critérios de aceite:
- QUANDO eu estiver logado e acessar a aba de chat ENTÃO o sistema DEVE exibir a tela de chat.
- QUANDO a tela abrir sem nenhuma mensagem ainda ENTÃO o sistema DEVE exibir o estado vazio (RF-05).

### RF-02 — O agente exibido corresponde ao papel do usuário

**Como** usuário,
**quero** ver o agente certo para o meu papel,
**para** receber a orientação adequada à minha função.

Critérios de aceite:
- QUANDO um usuário com papel `admin` (ou `gestor`) abrir o chat ENTÃO o sistema DEVE exibir a identidade do guia de Vata/Cindy.
- QUANDO um usuário com papel `closer` abrir o chat ENTÃO o sistema DEVE exibir a identidade do guia do closer.
- QUANDO um usuário com papel `sdr` abrir o chat ENTÃO o sistema DEVE exibir a identidade do guia do SDR.
- O sistema DEVE obter o papel da **mesma fonte de papel que o painel já usa hoje** (não inventar uma nova).

### RF-03 — Enviar mensagem com fluxo assíncrono simulado

**Como** usuário,
**quero** enviar uma mensagem e ver que a IA está processando,
**para** entender que a resposta está a caminho mesmo que demore.

Critérios de aceite:
- QUANDO eu digitar um texto e enviar ENTÃO o sistema DEVE exibir imediatamente a minha mensagem como uma bolha de `autor: usuario`.
- QUANDO a minha mensagem for enviada ENTÃO o sistema DEVE criar uma mensagem de `autor: ia` com `status: pendente` e exibir o indicador "pensando…".
- QUANDO o atraso simulado terminar ENTÃO o sistema DEVE preencher a mensagem da IA com um conteúdo fictício e mudar o `status` para `pronta`, removendo o "pensando…".
- ENQUANTO a mensagem da IA estiver `pendente` o sistema DEVE manter o indicador "pensando…" visível.
- QUANDO uma resposta estiver sendo processada o sistema DEVE permitir que a tela continue utilizável (não travar).

### RF-04 — Conversa contínua

**Como** usuário,
**quero** que minhas mensagens e as respostas fiquem em sequência,
**para** acompanhar a conversa como um chat de verdade.

Critérios de aceite:
- QUANDO houver mais de uma troca ENTÃO o sistema DEVE exibir todas as mensagens em ordem cronológica, as mais recentes embaixo.
- QUANDO uma nova mensagem chegar ENTÃO o sistema DEVE rolar a lista automaticamente até a mensagem mais recente.

### RF-05 — Estado vazio

**Como** usuário que abre o chat pela primeira vez,
**quero** um ponto de partida claro,
**para** saber que posso começar a conversar.

Critérios de aceite:
- QUANDO não houver nenhuma mensagem na conversa ENTÃO o sistema DEVE exibir a identidade do agente e um convite curto (ex.: "Como posso te ajudar?").

### RF-06 — Estado de erro (simulável) com tentar novamente

**Como** usuário,
**quero** saber quando a resposta falhou e poder tentar de novo,
**para** não ficar travado achando que está carregando.

Critérios de aceite:
- QUANDO uma resposta da IA falhar (erro simulado) ENTÃO o sistema DEVE marcar a mensagem da IA com `status: erro` e exibir um estado de erro no lugar do conteúdo.
- QUANDO o estado de erro for exibido ENTÃO o sistema DEVE oferecer uma ação de "tentar novamente".

### RF-07 — Dados no formato do contrato (mock espelha o real)

**Como** desenvolvedor,
**quero** que o mock use o mesmo formato do serviço real,
**para** que a troca do mock pelo serviço, mais à frente, não exija refazer a tela.

Critérios de aceite:
- O sistema DEVE representar cada conversa e cada mensagem **exatamente** com os campos definidos na seção "Modelo de dados" do `design.md`.
- O sistema DEVE separar `papel` (do usuário) de `autor` (da mensagem) conforme o contrato.
- O sistema DEVE prever o campo `anexos` na mensagem, **vazio** nesta etapa, sem implementar upload.

### RF-08 — Tolerância item-a-item na lista

**Como** usuário,
**quero** que um problema em uma mensagem não derrube a conversa inteira,
**para** continuar usando o chat mesmo se um item vier estranho.

Critérios de aceite:
- QUANDO uma mensagem estiver malformada ENTÃO o sistema DEVE descartar apenas aquela mensagem, registrar o ocorrido e continuar exibindo as demais.
- O sistema NÃO DEVE quebrar a tela inteira por causa de uma única mensagem inválida.

### RF-09 — Seletor de papel apenas em desenvolvimento (apoio a teste)

**Como** desenvolvedor,
**quero** pré-visualizar os três agentes sem precisar de três logins,
**para** validar a apresentação de cada um rapidamente.

Critérios de aceite:
- QUANDO o ambiente for de desenvolvimento ENTÃO o sistema PODE exibir um seletor para alternar o papel exibido.
- QUANDO o ambiente for de produção ENTÃO o sistema NÃO DEVE exibir esse seletor.

---

## Requisitos não-funcionais

- **RNF-01 — Sem persistência:** os dados ficam em memória (estado React). Recarregar a página zera a conversa. (A persistência vem com o banco, em etapa futura.)
- **RNF-02 — Sem armazenamento no navegador:** não usar `localStorage`/`sessionStorage`; estado em memória apenas.
- **RNF-03 — Consistência visual:** seguir o design system e os componentes que o front já usa nas outras telas.
- **RNF-04 — Sem dependências do serviço real:** nenhuma chamada de rede ao serviço de IA, ao Supabase ou ao Clint nesta etapa.

---

## Fora de escopo (não fazer nesta etapa)

- Backend, banco de dados, serviço Python, autenticação do serviço novo.
- Upload e leitura de arquivo (apenas placeholder visual, se houver — não funcional).
- Leitura do Clint, resumo rolante, memória de longo prazo.
- Persistência da conversa entre recarregamentos.
