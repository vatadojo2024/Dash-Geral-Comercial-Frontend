# Spec Frontend — Módulo Agendamentos de Primeira Call

Fila + visão de calendário dos agendamentos de primeira call, no painel do Mapa de Calor.

Versão: 1.0 — setembro/2026
Padrão: SDD (requisitos → referências → design → tasks → testes)
Depende de: backend já entregue (`GET /api/agendamentos/primeira-call`)

---

## 0. Regra inegociável de design

**Seguir o design system já aplicado no painel atual.** O Vata personalizou o visual recentemente. Esta tela NÃO inventa estética própria: reutiliza os tokens, componentes, tipografia, espaçamento, cores e padrões de layout que já existem no projeto.

- Antes de escrever qualquer componente, **inspecione o que já existe**: tema/tokens (Tailwind config, CSS vars, tema do design system), componentes compartilhados (botões, cards, tabelas, badges, tabs, estados de loading/vazio) e a estrutura de página das telas atuais (ex: a fila de leads, o detalhe do lead).
- Reutilize os componentes existentes. Só crie um componente novo quando não houver equivalente — e, quando criar, siga o mesmo padrão visual dos vizinhos.
- Nada de biblioteca de UI nova (nada de MUI, Chakra, etc.) se o projeto não usa. Herdar o que já está lá.
- Cor nunca é o único indicador de status (acessibilidade): sempre cor + texto ou ícone.

Se algo do design system atual estiver ambíguo ou faltando um componente necessário, PARE e pergunte antes de improvisar.

---

## 1. Requisitos

### 1.1 Objetivo
Dar a cada closer a fila e o calendário das suas primeiras calls agendadas, dentro do painel, com cada closer vendo só as próprias (a API já filtra por closer). Resolve o vazamento que hoje acontece no Discord.

### 1.2 Escopo desta entrega
- Nova aba/página "Agendamentos" (ou nome alinhado às abas atuais) no painel.
- Duas visões alternáveis: **fila** (lista) e **calendário**.
- Consumo do endpoint `GET /api/agendamentos/primeira-call`.

### 1.3 Fora de escopo
- Alerta/notificação no site (fase posterior — badge primeiro, push depois).
- Qualquer escrita: a tela é somente leitura. Não cria, edita ou cancela agendamento.
- Discord.

---

## 2. Referências de padrão (o "como", não a estética)

Padrões consolidados de fila+calendário para times comerciais, a adaptar ao design system atual:

- **Toggle de visões** fila/calendário (e, no calendário, semana/mês). Flexibilidade de visão é esperada nesse tipo de tela.
- **Fila = lista escaneável**, ordenada por data/hora da call, com o próximo agendamento no topo. Cada linha diz de relance: quem, quando, e o essencial pra preparar a call.
- **Calendário** com os agendamentos como eventos posicionados por data/hora; clicar num evento abre o detalhe. Bibliotecas maduras: FullCalendar ou react-big-calendar — **mas só se o projeto já não tiver um componente de calendário**; conferir antes.
- **Status por cor + rótulo**, nunca só cor.
- **Clareza sobre densidade**: tela calma, hierarquia clara, sem "salada de cores".

---

## 3. Design da tela

### 3.1 Estrutura
```
Página "Agendamentos — Primeira Call"
├── Cabeçalho: título + toggle [ Fila | Calendário ]
├── (Fila)
│     lista ordenada por next_call_at ↑ (próxima call primeiro)
│     cada item = card/linha no padrão da fila de leads atual
└── (Calendário)
      grade semana/mês, eventos por data/hora
      clique no evento → mesmo detalhe do item da fila
```

### 3.2 Conteúdo de cada agendamento (vem todo da API)
Campos confirmados que a fila exibe:
- **Lead** (nome)
- **Closer** (nome)
- **Data da call** + **Hora da call**
- **Urgência** (texto — ex: "9/10 - 52 anos, mora nos EUA...")
- **Patrimônio** (faixa)
- **Renda** (faixa)
- **Produto indicado** (ex: "Prime Semestral")
- **SDR** (nome)
- **Link da call** (abrir a sala)
- **Link Clint** (botão "Abrir na Clint", só se `link_crm` existir — pode vir nulo)

### 3.3 Estados
- **Loading**: usar o mesmo padrão de loading das telas atuais (skeleton/spinner que já existir).
- **Vazio**: mensagem clara "Nenhuma primeira call agendada" no padrão de estado-vazio atual.
- **Erro de carga**: mensagem no padrão atual; não quebrar a tela inteira.
- **Item com dado faltando** (ex: sem link_crm): esconder só aquele elemento, não o item.

### 3.4 Ordenação e destaque
- Ordenar por `next_call_at` ascendente (próxima primeiro).
- Destacar visualmente calls de **hoje** e diferenciar as **já passadas** (que ainda aparecem até sair da janela), usando o padrão de destaque do design system — cor + rótulo.

### 3.5 Responsivo
- Funciona no computador e no celular (closers usam ambos). No celular, a visão fila é a principal; o calendário degrada para lista/agenda se a grade não couber. Seguir o comportamento responsivo das telas atuais.

---

## 4. Integração com a API

- Fonte única: `GET /api/agendamentos/primeira-call` (autenticado via JWT Supabase, já filtra por closer no backend).
- Reusar o mesmo padrão de adapter/contrato das telas atuais (`apiLeads.ts` / `apiLeadDetail.ts`): validar o contrato real com tolerância item-a-item — um agendamento com dado inválido é descartado e logado, não derruba a fila.
- Modo mock-first se o projeto usa: espelhar o contrato num JSON de mock antes de ligar na API real, controlado pela variável de ambiente de modo (mock|api).

---

## 5. Tasks (ordem)

1. **Reconhecimento do design system**: mapear tokens, componentes reutilizáveis e estrutura de página das telas existentes. Anotar o que dá pra reusar.
2. **Rota/aba nova** "Agendamentos", encaixada na navegação atual do painel.
3. **Adapter** do endpoint, no padrão dos adapters atuais, com validação tolerante item-a-item (+ mock se aplicável).
4. **Visão Fila**: lista ordenada reusando o card/linha da fila de leads.
5. **Visão Calendário**: conferir se há componente de calendário no projeto; se não, avaliar FullCalendar/react-big-calendar. Eventos por data/hora, clique abre detalhe.
6. **Toggle** entre as duas visões.
7. **Estados** loading/vazio/erro no padrão atual.
8. **Responsivo** + revisão visual no celular.

---

## 6. Cenários de teste

1. Closer logado vê só as próprias 1ª calls (a API já filtra; conferir que o front não vaza nada de outro closer).
2. Fila ordenada corretamente: próxima call no topo.
3. Alternar Fila ↔ Calendário mantém os mesmos dados.
4. Clicar num evento do calendário abre o mesmo detalhe do item da fila.
5. Agendamento sem `link_crm` → esconde o botão "Abrir na Clint", resto intacto.
6. Estado vazio (closer sem agendamentos) → mensagem clara, sem erro.
7. Erro da API → mensagem no padrão atual, tela não quebra.
8. Item com dado inválido → descartado e logado, fila segue.
9. Call de hoje destacada; call passada diferenciada.
10. Revisão visual: a tela é indistinguível em estética das telas atuais (mesmo design system).
