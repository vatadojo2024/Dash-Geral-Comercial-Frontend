# Filtro por SDR (closers) — Requisitos

**Projeto:** Mapa de Calor Comercial (backend na VPS + front Next.js na Vercel)
**Versão:** 1.0
**Método:** SDD — este documento é a fonte da verdade.

---

## Objetivo

Dar ao **closer** um filtro por **SDR** no painel — mostrando só os SDRs que **agendaram leads pra ele** — e, de quebra, exibir o **nome** do SDR/closer no lugar do identificador interno (UUID) que aparece hoje.

A lista de SDRs do filtro é **derivada dos leads que o front já carregou** (não há endpoint dedicado). Como o closer só enxerga os próprios leads, os SDRs presentes neles já são exatamente "os que agendaram pra ele".

---

## Glossário rápido

- **Identificador interno (UUID):** o código tipo `a17ff223-...` que identifica cada usuário no banco. Não serve pra mostrar na tela.
- **Derivar dos leads:** o front olha os leads que já tem em mãos e monta a lista de SDRs a partir deles, sem pedir nada novo ao servidor.

---

## Requisitos

### RF-01 — Filtro de SDR na tela do closer
- O closer DEVE ter um filtro de **SDR**, cujas opções são os **SDRs presentes nos leads que ele já carregou** (mais a opção "Todos").

### RF-02 — Filtrar a lista pelo SDR escolhido
- Selecionar um SDR DEVE filtrar a lista/heatmap para mostrar só os leads daquele SDR. "Todos" volta ao normal.

### RF-03 — Mostrar NOME, não UUID
- Onde aparece SDR (e closer) — no filtro e no resto do painel — DEVE mostrar o **nome** da pessoa, não o UUID. Se o nome faltar, cai pro identificador como último recurso (não quebra).

### RF-04 — Lista derivada dos leads (sem endpoint dedicado)
- As opções do filtro DEVEM ser montadas a partir dos leads já carregados — sem criar um endereço novo só pra isso.

### RF-05 — O lead precisa carregar o nome do SDR/closer
- Para o RF-03 e o RF-01 funcionarem, cada lead DEVE trazer o **nome** do SDR e do closer (além do identificador). Se a resposta de leads ainda não traz, o backend passa a incluir.

### RF-06 — Quem vê o filtro
- O filtro de SDR aparece para **closer** e **admin**. Para SDR não faz sentido (ele só vê os próprios leads) — não exibir, ou exibir trivialmente só ele.

---

## Requisitos não-funcionais

- **RNF-01 — Lead sem SDR não quebra:** leads agendados pela IA (Hana, sem SDR individual) DEVEM aparecer num grupo próprio no filtro (ex.: "Hana" ou "Sem SDR"), sem derrubar nada.
- **RNF-02 — Não tocar no motor de score** nem na lógica de pontuação.
- **RNF-03 — Mudança de backend mínima:** só incluir os nomes na resposta de leads; nada além disso.

---

## Fora de escopo (não fazer nesta etapa)

- Criar um endereço dedicado `GET /api/usuarios` — não é necessário com o nome vindo no lead.
- Filtro de SDR que consulta o servidor a cada mudança (é tudo client-side, sobre os leads carregados).
- Qualquer mudança no cálculo de score.
