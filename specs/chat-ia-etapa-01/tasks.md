# Etapa 1 — Tela de Chat (mock) — Tarefas

**Projeto:** Chat IA-Guia (recurso novo do painel comercial Vata Dojo)
**Etapa:** 1 de 9 (Fase A — Front, mock-first)
**Versão:** 1.0
**Método:** SDD — estas tarefas derivam do `requisitos.md` e do `design.md` (mesma pasta).

**Insumo:** os contratos de dados, o mapa papel→agente e os fluxos estão no `requisitos.md` e no `design.md` desta pasta. Autocontido — não consultar documento externo. Tudo roda no **projeto do front existente** (Next.js), reusando seus componentes e padrões.

**Como executar:** uma tarefa por vez, na ordem. Cada uma é testável isoladamente. Não partir para a próxima sem a anterior fechada. Não construir nada da lista "Fora de escopo" do `requisitos.md`.

---

## Tarefas

### T-01 — Tipos e contrato de dados
- [ ] Definir os tipos de `Conversa` e `Mensagem` exatamente como na seção 3 do `design.md` (campos e nomes; `papel` ≠ `autor`; `status` com `pendente`/`pronta`/`erro`; `anexos` previsto e vazio).
- **Cobre:** RF-07.
- **Pronto quando:** os tipos existem e refletem o contrato campo a campo, prontos para serem usados pela tela e (depois) pelo serviço real.

### T-02 — Mapa papel → agente
- [ ] Criar o objeto de configuração `papel → { id, nome_exibicao, subtitulo }` com as três entradas (admin/gestor, closer, sdr), usando os placeholders da seção 4 do `design.md`.
- **Cobre:** RF-02.
- **Pronto quando:** dado um papel, o mapa devolve a identidade do agente correspondente.

### T-03 — Fonte de respostas (mock) isolada
- [ ] Criar o módulo único "fonte de respostas": recebe a mensagem do usuário + o papel e devolve, de forma assíncrona e após um atraso simulado, um texto fictício; com a opção de simular um erro.
- **Cobre:** RF-03, RF-06 (base), e o princípio de troca futura (design seção 7).
- **Pronto quando:** chamar a função devolve uma resposta fictícia depois de um atraso, e consegue também devolver um erro quando solicitado. A tela ainda não existe; testar a função isolada.

### T-04 — Estado da conversa (hook, em memória)
- [ ] Criar o hook/estado que guarda a lista de mensagens em memória e expõe as ações: enviar (cria a mensagem do usuário `pronta` + a da IA `pendente`), concluir (mensagem da IA → `pronta` com conteúdo), falhar (→ `erro`), tentar novamente (→ `pendente` e rechama a fonte).
- **Cobre:** RF-03, RF-04, RF-06, RNF-01, RNF-02.
- **Pronto quando:** as ações alteram a lista corretamente, tudo em memória, sem armazenamento no navegador.

### T-05 — Rota/aba do chat + tela base
- [ ] Criar a rota/página do chat acessível pelo usuário logado e a tela base que junta cabeçalho, lista e barra de input, reusando os padrões visuais do front.
- **Cobre:** RF-01, RNF-03.
- **Pronto quando:** logado, é possível abrir a aba e ver a estrutura da tela.

### T-06 — Cabeçalho com identidade do agente (por papel)
- [ ] No cabeçalho, exibir `nome_exibicao` e `subtitulo` do agente conforme o papel do usuário, obtido da **mesma fonte de papel que o painel já usa**.
- **Cobre:** RF-02.
- **Pronto quando:** logado como cada papel, o cabeçalho mostra o agente certo.

### T-07 — Lista de mensagens + bolhas + estados
- [ ] Renderizar a lista em ordem cronológica (recentes embaixo) com auto-scroll; bolha distinguindo `usuario`/`ia`; tratar os estados `pendente` ("pensando…"), `pronta` (conteúdo) e `erro` (estado de erro + "tentar novamente").
- [ ] Aplicar tolerância item-a-item: mensagem malformada é descartada e registrada, sem derrubar a lista.
- **Cobre:** RF-03, RF-04, RF-06, RF-08.
- **Pronto quando:** uma conversa simulada exibe corretamente os três estados, rola sozinha e sobrevive a uma mensagem inválida.

### T-08 — Estado vazio
- [ ] Quando não houver mensagens, exibir a identidade do agente + um convite curto.
- **Cobre:** RF-05.
- **Pronto quando:** ao abrir uma conversa sem mensagens, o convite aparece.

### T-09 — Barra de input e envio ponta a ponta (mock)
- [ ] Ligar a caixa de texto + botão enviar ao fluxo: enviar dispara a sequência da seção 5 do `design.md` (usuário → pensando → resposta mock), usando a fonte (T-03) e o estado (T-04).
- [ ] Incluir o placeholder visual de anexo, **não funcional**.
- **Cobre:** RF-03, RF-04, RF-07.
- **Pronto quando:** digitar e enviar mostra a bolha do usuário, depois "pensando…", depois a resposta fictícia, em conversa contínua.

### T-10 — Seletor de papel só em desenvolvimento
- [ ] Adicionar um seletor que alterna o papel exibido, **visível apenas em ambiente de desenvolvimento** e ausente em produção.
- **Cobre:** RF-09.
- **Pronto quando:** em dev, dá para alternar entre os três agentes sem novo login; em produção, o seletor não aparece.

---

## Critério de pronto da etapa (validação final)

- [ ] Logado, abro a aba e vejo o agente do meu papel (RF-01, RF-02).
- [ ] Envio uma mensagem → minha bolha aparece na hora → "pensando…" → resposta mock aparece (RF-03).
- [ ] Várias mensagens formam uma conversa contínua que rola sozinha (RF-04).
- [ ] Conversa sem mensagens mostra o estado vazio (RF-05).
- [ ] Erro simulado mostra o estado de erro com "tentar novamente" (RF-06).
- [ ] Os dados no mock seguem o contrato do `design.md`, prontos para trocar pelo serviço real sem refazer a tela (RF-07).
- [ ] Uma mensagem inválida não derruba a lista (RF-08).
- [ ] O seletor de papel funciona em dev e some em produção (RF-09).
