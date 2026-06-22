# Etapa 1 — Tela de Chat (mock) — Design

**Projeto:** Chat IA-Guia (recurso novo do painel comercial Vata Dojo)
**Etapa:** 1 de 9 (Fase A — Front, mock-first)
**Versão:** 1.0
**Método:** SDD — este design deriva do `requisitos.md` (mesma pasta) e orienta o `tasks.md`.

---

## 1. Visão geral

A tela de chat vive no **projeto do front** (Next.js) que já existe, como uma aba/rota a mais. Nesta etapa ela é **100% mock**: toda resposta da IA é fictícia e gerada no próprio front, com um atraso simulado para imitar o comportamento real (que pode levar minutos). A organização do código deve isolar a "fonte das respostas" num único lugar, para que na Etapa 5 essa fonte seja trocada pelo serviço real **sem mexer na tela**.

Princípio que guia o design: **mock-first com contrato fiel**. O formato dos dados é o mesmo que o serviço Python vai devolver; só a origem é falsa.

---

## 2. Onde mora no projeto (estrutura sugerida)

Seguir os padrões de pasta que o front já usa. Estrutura de referência (nomes podem se adaptar à convenção do repositório):

- **Rota/página do chat** — a aba acessível pelo usuário logado.
- **Componente da tela de chat** — orquestra cabeçalho, lista e barra de input.
- **Componente da lista de mensagens** — renderiza as bolhas em ordem, com auto-scroll.
- **Componente da bolha de mensagem** — uma mensagem (trata `usuario`/`ia`, `pendente`/`pronta`/`erro`).
- **Componente da barra de input** — caixa de texto, botão enviar, placeholder de anexo (não funcional).
- **Mapa de agentes** (`config`) — `papel → { id, nome_exibicao, subtitulo }`.
- **Fonte de respostas (mock)** — módulo único que recebe a mensagem do usuário e devolve, após atraso, a resposta fictícia. **É o ponto que será trocado pelo serviço real depois.**
- **Hook/estado da conversa** — guarda a lista de mensagens em memória e expõe as ações (enviar, marcar pendente/pronta/erro, tentar novamente).

---

## 3. Modelo de dados (o contrato — CRÍTICO)

Este é o coração da etapa. O mock deve usar exatamente estes campos. Nomes em português, separando `papel` (do usuário) de `autor` (da mensagem).

### Conversa
- `id` — string
- `papel` — `admin` | `closer` | `sdr` (define o agente da conversa)
- `titulo` — string, opcional (pode ser derivado da 1ª mensagem)
- `criada_em` — ISO (data/hora)
- `atualizada_em` — ISO

### Mensagem
- `id` — string
- `conversa_id` — string
- `autor` — `usuario` | `ia`
- `conteudo` — string
- `status` — `pendente` | `pronta` | `erro`
- `criada_em` — ISO
- `anexos` — array, **vazio nesta etapa** (campo já previsto para a etapa de arquivo)

Observações de contrato:
- O `status` é o que habilita o "pensando…" (`pendente`) e o estado de erro (`erro`). Uma mensagem de `autor: usuario` nasce sempre `pronta`.
- O campo `anexos` existe desde já para que a entrada de arquivo, lá na frente, **não** mude o contrato (e não force refazer a tela).

---

## 4. Mapa papel → agente

Um objeto de configuração único, fácil de ajustar:

| `papel` | `id` do agente | `nome_exibicao` (placeholder) | `subtitulo` (placeholder) |
|---|---|---|---|
| `admin` / `gestor` | `guia_gestao` | Guia Vata/Cindy | Estratégia comercial |
| `closer` | `guia_closer` | Guia do Closer | Condução e fechamento |
| `sdr` | `guia_sdr` | Guia do SDR | Qualificação e agendamento |

Os textos de exibição são placeholders a confirmar com o Vata. A estrutura é o que importa. O papel vem da mesma fonte que o painel já usa hoje.

---

## 5. Fluxo de envio (sequência)

1. Usuário digita e envia.
2. Cria mensagem `autor: usuario`, `status: pronta` → some na lista na hora.
3. Cria mensagem `autor: ia`, `status: pendente`, `conteudo` vazio → a UI mostra "pensando…".
4. A **fonte de respostas (mock)** é chamada e, após um atraso fictício (ex.: alguns segundos), devolve um texto.
5. A mensagem da IA recebe o texto e muda para `status: pronta` → "pensando…" some, resposta aparece, lista rola.
6. **Caminho de erro (simulado):** a fonte mock pode, opcionalmente, sinalizar falha → a mensagem da IA vira `status: erro` → a UI mostra o estado de erro + "tentar novamente". O "tentar novamente" repõe a mensagem para `pendente` e chama a fonte de novo.

Este desenho é deliberadamente igual ao assíncrono real: na Etapa 5, o passo 4 deixa de ser "atraso fictício" e passa a ser "gravar pendente no banco e buscar a resposta quando ficar pronta", sem alterar os passos 1–3, 5 e 6 nem a tela.

---

## 6. Estados da tela

- **Vazio:** sem mensagens → identidade do agente + convite curto.
- **Pensando:** bolha do usuário + indicador "pensando…" enquanto a mensagem da IA está `pendente`.
- **Lista:** conversa em ordem, recentes embaixo, auto-scroll.
- **Erro:** mensagem da IA com `status: erro` → bolha de erro + "tentar novamente".

---

## 7. Camada de mock (como isolar para trocar depois)

- Toda geração de resposta fictícia fica **num módulo só** (a "fonte de respostas").
- A tela e o hook de estado **não sabem** que a resposta é falsa — eles só chamam a fonte e reagem ao `status`.
- A fonte expõe uma função simples (recebe a mensagem do usuário + o papel; devolve, de forma assíncrona, o texto da resposta — ou um erro).
- Na Etapa 5, **só essa função** é reimplementada para falar com o serviço real. Tela, bolhas, estados e contrato permanecem.

---

## 8. Decisões técnicas e o que NÃO fazer

- **Estado em memória (React).** Sem `localStorage`/`sessionStorage`; recarregar zera (esperado).
- **Sem rede.** Nenhuma chamada ao serviço de IA, Supabase ou Clint nesta etapa.
- **Tolerância item-a-item.** Renderização de cada mensagem protegida: item malformado é descartado e registrado, sem derrubar a lista.
- **Consistência visual.** Reusar componentes e tokens de design do front; o chat não é uma ilha visual.
- **Anexo é só visual.** O botão de anexo pode existir no layout, mas não faz nada nesta etapa.
- **Seletor de papel só em dev** (RF-09): nunca em produção.
