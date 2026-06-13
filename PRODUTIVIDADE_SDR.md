# Produtividade SDR — Documentação detalhada

Documentação completa da tela **Produtividade SDR** do Mapa de Calor (item 6 da iteração 2 + iteração 2.1 do roadmap). Esta tela é um **espelho fiel** do _Dashboard de Produtividade SDR_ já existente da Vata Dojo (descrito em `specs/DOCUMENTACAO.md`), reconstruído dentro deste projeto com a mesma paleta e as mesmas regras de negócio, em **mock-first**: hoje lê dados fictícios, e a troca para a API real acontece só na camada de dados, sem tocar na UI.

> **Resumo em uma linha:** mostra, por SDR e por mês, calls agendadas/realizadas, no-shows, produtos ofertados, leads qualificados (Ninja+ com bônus de QC) e a distância da meta escalonada (40/50/60) — com gráficos, insights automáticos, tabela detalhada e uma aba de Liderança Pré-venda para o admin.

---

## 1. Para que serve e quem vê

A tela acompanha o desempenho da equipe de **Pré-Venda (SDRs)**. Cada SDR é avaliado pela quantidade de **leads qualificados** que gera no mês, contra uma **meta escalonada individual**.

### Escopo por papel (quem enxerga o quê)

| Papel | O que vê na tela |
| --- | --- |
| **SDR** (Glaucio, Benhur, Guilherme…) | **O time inteiro** — a tela é comparativa por natureza (como o original, que é compartilhado). O card e a linha do próprio SDR ganham **destaque visual** (borda azul + selo "você"). Não vê a aba Liderança. |
| **Admin** (Vata, Cindy, Jonas) | Tudo: a aba **Dashboard SDR** completa + a aba **Liderança Pré-venda**. |
| **Closer** (Marcio, Giba, Aurelio) | **Não acessa** — ao tentar abrir `/sdr` é redirecionado para `/dashboard`. |

O item de menu "Produtividade SDR" só aparece para **sdr** e **admin** (`src/components/layout/Sidebar.tsx`). O redirecionamento de proteção fica em `src/app/(private)/sdr/page.tsx` (lado servidor).

> Guilherme (SDR do app que não existe no Dashboard SDR oficial) vê o time normalmente — apenas não tem card próprio destacado.

---

## 2. As pessoas acompanhadas

| SDR | Tem meta? | Observação |
| --- | --- | --- |
| **Glaucio** | Sim (40/50/60) | — |
| **Delrue** | Sim (40/50/60) | — |
| **Benhur** | Sim (40/50/60) | — |
| **Hana** | **Não** (`metas: null`) | É a **IA agendadora**. Aparece como **linha informativa** (ícone de robô, selo "Sem meta"). Conta nos volumes (calls, produtos) e fica **fora** do gráfico de meta/gap e do gap consolidado. |

Ordem fixa de exibição: **Glaucio → Delrue → Benhur → Hana**. Nomes que não casam com os aliases são descartados. **Closers**: `giba`/`gilberto` → **Giba**; demais mantidos como vieram.

---

## 3. A aba "Dashboard SDR" (de cima para baixo)

### 3.1 Abas + filtro de mês

No topo: o seletor de abas ("Dashboard SDR" | "Liderança Pré-venda" — a segunda só para admin) e o **filtro por mês (data da call)**, com todos os meses disponíveis no payload. **Default (regra 5.13):** o mês corrente se houver dados; senão, o mais recente. O mock atual traz **abril, maio e junho/2026** (junho é "mês em andamento": calls realizadas só até 11/06).

### 3.2 Linha de contexto

Período (ex.: "01/06/2026 a 30/06/2026") + a regra fixa **"contabilização pelo mês da data da call, não pela data de agendamento"** + lembrete da meta 40/50/60.

### 3.3 Grade de KPIs — os 9 cartões do original (6.3)

Agregados de **todos os SDRs exibidos** (Hana entra nos volumes; o gap consolidado só conta quem tem meta):

1. **Calls Agendadas** · 2. **Calls Realizadas** · 3. **Leads Qualificados** (base + bônus) · 4. **No-show (Total)** · 5. **QC (Reuniões)** · 6. **Bônus QC (+1/3)** · 7. **Gap Consolidado** · 8. **No-show Médio** (ponderado pelas agendadas) · 9. **Taxa de Qualificação** (qualificados ÷ realizadas × 100).

### 3.4 Cards por SDR (6.4a)

Um card por SDR: nome (+ robô para a Hana), nota de progresso ("M1 batida", "M1/M2 batidas"…), selo da meta atual ("Meta 2: 50" ou "Sem meta") e as métricas: calls agendadas/realizadas, **leads qualificados** no formato `total (base+bônus)`, bônus QC, linha de produtos `QC n | Ninja n | Black n | Prime n | Private n`, **gap p/ meta** (cor) e **no-show** `contagem (percentual%)` (cor). O card do SDR logado ganha borda azul + selo "você".

### 3.5 Gráficos (6.4b — recharts, tema dark)

1. **Funil de Conversão por SDR** — barras agrupadas: Agendadas (azul) · Realizadas (teal) · Qualificadas (laranja).
2. **Taxa de No-Show por SDR** — barras rosa, eixo em %, tooltip `contagem (percentual%)`.
3. **Atingimento de Meta e Gap** (largura total) — composto: barras Meta (azul) e Qualificadas (verde) + área Gap (laranja). **Hana fora** (não tem meta).

Tooltips customizados no tema dark; todas as cores vêm de `src/lib/ui/cores.ts` (fonte única, compartilhada com o `tailwind.config.ts`).

### 3.6 Insights do Mês (6.4c)

Lista automática com marcador colorido por tipo — **risco** (rosa), **destaque** (verde), **ação** (laranja). Regras exatas do original, em função pura testada (`src/lib/sdr/insights.ts`):

- **Risco:** SDR com no-show ≥ 20%.
- **Destaque:** SDR mais próximo da meta (menor gap).
- **Destaque:** líder em leads qualificados (se > 0).
- **Destaque:** melhor eficiência de qualificação (qualificados/realizadas, mín. 5 realizadas).
- **Ação:** taxa de realização < 70% (mín. 5 agendadas) — reforçar confirmação pré-call.
- **Ação:** SDR a 1 ou 2 QC do próximo bônus.
- **Ação/Destaque:** taxa de realização geral < 80% (alerta) ou ≥ 80% ("operação saudável").

### 3.7 Visão Detalhada por SDR (6.4d)

Tabela com wrapper rolável no mobile. Colunas: SDR, Meta (40/50/60), Estágio (M1/M2/M3), Calls Agendadas, Calls Realizadas, QC, Ninja, Black, Prime, Private, Bônus QC, Leads Qualificados, **Gap p/ Meta** (cor) e **No-Show** `contagem (%)` (cor). A linha do SDR logado fica destacada.

### 3.8 Rodapé

Nota fixa da regra de contabilização + aviso de que os dados estão mockados nesta fase.

### 3.9 Estados

Loading (skeletons), erro (`ErrorState` com retry e a mensagem do adapter) e vazio (payload sem meses).

---

## 4. A aba "Liderança Pré-venda" (6.5 — só admin)

### a) Filtros próprios

**Mês** (independente do filtro do topo; default = regra 5.13) e **Semana do mês** ("Mês inteiro" default, ou Semana 1..N — semanas "de calendário", regra 5.11). Tudo abaixo respeita o recorte, **exceto** as métricas da equipe (sempre mês inteiro).

### b) 6 KPIs

**Leads que entraram** (marketing) · **Leads qualificados** (marketing) · **Leads desqualificados** (`max(entraram − qualificados, 0)`) · **Ocorridas** · **No-show** · **Taxa de comparecimento geral** (`ocorridas ÷ agendadas até hoje`).

### c) Comparecimento por SDR (5.8)

Tabela: Agendadas (até hoje — **calls futuras não contam**), Ocorridas, No-show, % de Comparecimento. Fallback (estado vazio) quando não há calls no recorte.

### d) Produtos no Recorte (5.9)

Distribuição dos leads qualificados do marketing por produto/perfil, **traduzida** e em ordem decrescente:

| Valor na origem | Exibido como |
| --- | --- |
| sem qualificacao | Masterclass |
| qualificado qc | QC |
| possivel ninja | QC/Ninja |
| mql | Ninja |
| mql+ | Black |
| smql | Prime |
| hmql | Prime/Private |
| umql | Private |
| (outros) | valor original / "Nao informado" |

### e) Matriz SDR × Closer (5.10)

Linhas = SDRs; colunas = Closers (Marcio, Giba, Aurelio + **"Sem Closer"** quando aplicável) + Total por SDR. Como a API não traz o vínculo direto, as calls de cada SDR são **distribuídas proporcionalmente** à participação de cada closer no mesmo dia, com **arredondamento por maiores restos** (`allocateIntegersWithTarget`) para a soma bater exatamente com o total do SDR. A nota do método aparece no subtítulo do card.

### f) Métricas da Equipe (5.5 — sempre mês inteiro)

**Reuniões qualificadas no mês** (mesma regra individual Ninja+ + bônus QC, somada por SDR — **inclui a Hana**, pois a meta da equipe conta o time inteiro de pré-venda), **meta atual da equipe** (150 → 188 → 225), **barras de progresso** das 3 metas (verde quando batida, destaque na atual, "Faltam X") e **tabela-resumo** (Meta, Objetivo, Realizado, Status).

### g) Erro isolado

Se só a carga da liderança falhar (modo api), a aba SDR continua funcionando e **apenas esta aba** mostra "Falha ao carregar dados da liderança" — implementado via campos opcionais no payload + `lideranca_erro`.

---

## 5. As regras de negócio (funções puras)

Todas seguem o `specs/DOCUMENTACAO.md` (numeração entre parênteses):

| Regra | Onde vive | Testes |
| --- | --- | --- |
| Aliases de SDR (5.1) e produtos por substring (5.2) | `src/lib/data/sdrDashboard.ts` | indiretos |
| Qualificados = Ninja+ + ⌊QC/3⌋ (5.3); metas 40/50/60, estágio e gap (5.4); no-show % (5.7); mês padrão (5.13) | `src/lib/data/sdrDashboard.ts` (`agregarDashboard`) | indiretos |
| Aliases de closer (5.1), semana do mês (5.11), tradução de qualificação (5.9), maiores restos e matriz (5.10), comparecimento (5.8), metas da equipe (5.5) | `src/lib/sdr/lideranca.ts` (`agregarLideranca`) | **11 testes** em `lideranca.test.ts` |
| Insights do mês (6.4c) | `src/lib/sdr/insights.ts` (`getInsights`) | **9 testes** em `insights.test.ts` |

Cores de status (sempre cor + número): **Gap** verde ≤ 1 · amarelo ≤ 2 · vermelho > 2. **No-show %** verde < 12 · amarelo 12–20 · vermelho > 20.

`qualificados = (Ninja + Black + Prime + Private) + floor(QC / 3)` — ex.: 36 Ninja+ e 11 QC → 36 + 3 = **39**.

---

## 6. Arquitetura — como os dados chegam na tela

```
            (browser)                          (servidor Next.js)               (futuro)
SdrView ──▶ fetchSdrPayload() ──▶ GET /api/sdr-dashboard ──┬─ modo "mock" ─▶ sdr_dashboard.json
  │            Zod valida           route handler           │
  │                                 (a chave fica AQUI)      └─ modo "api"  ─▶ api.infradojo.pro
  ├─ agregarDashboard(payload, mes)      → aba Dashboard SDR     (12 endpoints, X-API-Key+Bearer)
  ├─ getInsights(sdrs)                   → Insights
  └─ LeadershipPanel ─ agregarLideranca(payload, mes, semana, hoje) → aba Liderança
```

A busca é **uma só** (payload completo); o filtro de mês/semana é recálculo **puro e client-side** — trocar o mês não refaz fetch.

### 6.1 Arquivos envolvidos

| Arquivo | Papel |
| --- | --- |
| `src/app/(private)/sdr/page.tsx` | Página (servidor). Redireciona closer e não-logado. |
| `src/features/sdr/SdrView.tsx` | Orquestrador: abas, filtro de mês, 9 KPIs, cards (com destaque "você") e estados. |
| `src/features/sdr/ChartsPanel.tsx` | Os 3 gráficos recharts com tooltips dark. |
| `src/features/sdr/InsightsPanel.tsx` | Lista de insights com marcador por tipo. |
| `src/features/sdr/PerformanceTable.tsx` | Tabela detalhada (14 colunas), rolável. |
| `src/features/sdr/LeadershipPanel.tsx` | Aba Liderança completa (filtros, KPIs, tabelas, matriz, equipe). |
| `src/lib/data/sdrDashboard.ts` | Adapter: schema Zod do payload, aliases, agregação da aba SDR, meses disponíveis, `fetchSdrPayload`. |
| `src/lib/sdr/lideranca.ts` | Regras puras da liderança (`agregarLideranca` etc.). |
| `src/lib/sdr/insights.ts` | `getInsights` (regras 6.4c). |
| `src/app/api/sdr-dashboard/route.ts` | Route handler server-side: mock vs API real; **a chave mora só aqui**; erro da liderança isolado. |
| `src/lib/mock/sdr_dashboard.json` | Mock granular **por dia**, 3 meses, espelhando os 12 endpoints. |
| `scripts/generate_sdr_mock.mjs` | Gerador determinístico do mock (`npm run generate:sdr-mock`). |
| `src/lib/ui/cores.ts` | Fonte única dos hex da paleta (tailwind + gráficos). |

### 6.2 O contrato de dados (payload)

Validado por `SdrDashboardPayloadSchema`. Linhas granulares por dia; o adapter agrega:

```jsonc
{
  // Aba SDR (5 endpoints)
  "agendadas":   [ { "sdr": "Glaucio", "data_referencia": "2026-06-02", "total": 3 }, … ],
  "realizadas":  [ … ], "no_show": [ … ], "remarcadas": [ … ],
  "por_produto": [ { "sdr": "Glaucio", "data_referencia": "2026-06-02", "produto": "Ninja", "total": 2 }, … ],
  // Liderança (7 endpoints) — OPCIONAIS: se faltarem, só a aba Liderança mostra erro
  "marketing_leads":        [ { "data_referencia": "2026-06-02", "total": 11 }, … ],
  "marketing_qualificados": [ { "data_referencia": "2026-06-02", "qualificacao": "mql", "total": 3 }, … ],
  "closer_agendadas":  [ { "closer": "Marcio", "data_referencia": "2026-06-02", "total": 3 }, … ],
  "closer_realizadas": [ … ], "closer_no_show": [ … ], "closer_por_produto": [ … ], "closer_remarcadas": [ … ],
  "lideranca_erro": null
}
```

### 6.3 O route handler e os dois modos

`GET /api/sdr-dashboard` lê `SDR_DASHBOARD_MODE`:

- **`mock`** (padrão): devolve o `sdr_dashboard.json`.
- **`api`**: busca em paralelo os **5 endpoints SDR** (falha → 502, tela inteira mostra erro) e depois os **7 da liderança** (falha → `lideranca_erro` no payload; só a aba Liderança mostra erro). Cabeçalhos no modo "auto": **`X-API-Key`** _e_ **`Authorization: Bearer`**.

> **Por que server-side?** Para a chave **nunca** chegar ao navegador. **Nesta fase o modo é sempre `mock`.**

### 6.4 Variáveis de ambiente

| Variável | Para quê | Default |
| --- | --- | --- |
| `SDR_DASHBOARD_MODE` | `mock` ou `api` | `mock` |
| `SDR_DASHBOARD_API_URL` | URL base da API externa | `https://api.infradojo.pro/dashboard_comercial` |
| `SDR_DASHBOARD_API_KEY` | chave enviada em `X-API-Key` e `Bearer` | — |

`.env.example` (placeholders) vai ao Git; `.env` (chave real) é ignorado (`.env*` + `!.env.example`).

---

## 7. Como ligar a API real depois (sem mexer na UI)

1. Chave real em `.env` (`SDR_DASHBOARD_API_KEY`).
2. `SDR_DASHBOARD_MODE=api`.
3. Conferir se os 12 endpoints devolvem linhas `{ sdr|closer, data_referencia, total[, produto|qualificacao] }`. Se os nomes diferirem, ajustar **só** o `route.ts` — view e regras intactos.

---

## 8. O que (ainda) difere do Dashboard SDR original

Após a iteração 2.1, a tela cobre as duas abas do original (cards, 9 KPIs, 3 gráficos, insights, tabela detalhada, liderança completa com filtros de mês/semana). Diferenças restantes, conscientes:

- **`callsRealizar`** (calls futuras pendentes) existe no modelo original mas fica 0 no fluxo da API externa — não exibido aqui.
- **Regra de agendamentos compartilhados com a Hana** (5.1 da liderança: call dividida `SDR/Hana` conta só para o outro SDR) não se aplica ao mock atual (linhas já vêm com um único nome); ao ligar a API real, se vierem nomes compostos, tratar no adapter.
- O original abre com **duas cargas separadas** (`Promise.allSettled`); aqui é uma carga única com campos opcionais — o comportamento visível (erro isolado da liderança) é o mesmo.

---

## 9. Conferência dos números do mock (3 meses)

Gerados por `npm run generate:sdr-mock` (seed fixa; junho é mês em andamento — realizadas só até 11/06):

| Mês | SDR | Agendadas | Realizadas | No-show |
| --- | --- | --- | --- | --- |
| Abril | Glaucio / Delrue / Benhur / Hana | 44 / 43 / 54 / 19 | 38 / 36 / 47 / 19 | 6 / 6 / 2 / 0 |
| Maio | Glaucio / Delrue / Benhur / Hana | 50 / 56 / 66 / 27 | 44 / 48 / 52 / 26 | 5 / 5 / 7 / 1 |
| Junho | Glaucio / Delrue / Benhur / Hana | 55 / 67 / 76 / 27 | 20 / 19 / 26 / 9 | 2 / 3 / 4 / 1 |

Marketing: ~203/223/105 leads (abr/mai/jun) com ~46% qualificados. Closers granulares por dia (com linhas "Gilberto" ocasionais para exercitar o alias → Giba).

---

## 10. Glossário rápido

| Termo | Significado |
| --- | --- |
| **SDR** | Pré-vendedor que agenda e realiza calls de qualificação. |
| **Call agendada / realizada** | Reunião marcada / que de fato aconteceu. |
| **No-show** | Lead que não compareceu à call. |
| **QC** | Produto "Quebrando Código" — não qualifica direto; gera +1 a cada 3. |
| **Ninja+** | Ninja, Black, Prime, Private — produtos que qualificam direto. |
| **Lead qualificado** | Call realizada com produto Ninja+ (+ bônus de QC). |
| **Meta escalonada** | Individual: 40/50/60 · Equipe: 150/188/225. |
| **Gap** | Quanto falta para a meta atual. |
| **Recorte** | Período selecionado na liderança (semana ou mês inteiro). |
| **Hana** | IA agendadora — acompanhada como apoio, sem meta. |
