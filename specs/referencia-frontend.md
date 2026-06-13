# Referência da implementação do Frontend — Dashboard Mapa de Calor

Documento de referência exaustivo da implementação atual. Pensado para reconstruir uma versão equivalente em outro ambiente sem ter que ler o código fonte. Tudo aqui é o que está no projeto neste momento.

---

## 1. Visão geral

Mesa de decisão operacional para closers priorizarem leads. Implementa a especificação `estrutura-frontend-mapa-de-calor.md` (seções 1 a 27).

### Stack

- **Next.js 15** (App Router, route handlers como BFF)
- **React 19** + **TypeScript** estrito
- **Tailwind CSS 3.4** com tema customizado
- **TanStack Query 5** para estado de servidor no client
- **Zod 3** para validação de contratos
- **lucide-react** para ícones
- **clsx** + **tailwind-merge** para composição de classes

### Arquitetura

```
CRM / WhatsApp / Calendly  →  n8n  →  Supabase/Postgres
                                          │
                                   API / BFF (route handlers Next)
                                          │
                                   Dashboard (React)
```

- O **frontend nunca fala com o banco**. Tudo passa pelo BFF em `src/app/api/*`.
- A camada `src/lib/mock/` substitui temporariamente o Supabase, com 132 leads determinísticos.
- A integração real entra trocando essa camada e mantendo os contratos Zod intactos.

### Princípios não-negociáveis

1. PII (telefone, e-mail, nome completo) **nunca** sai em payload safe.
2. Revelar contato exige endpoint separado e gera auditoria.
3. Toda mutação passa pelo BFF.
4. Sessão fica em cookie `HttpOnly`; JS do navegador não acessa.
5. Temperatura/alerta nunca dependem só de cor: cor + ícone + texto sempre.
6. UI deve mostrar quando uma ação será auditada **antes** de confirmar.
7. Closer só vê a própria carteira e leads sem responsável; coordenador/admin veem tudo.

---

## 2. Estrutura de pastas

```
src/
  app/
    layout.tsx                   raiz (Providers)
    page.tsx                     redireciona p/ /dashboard
    globals.css
    providers.tsx                QueryClient + Toast (client)
    (public)/
      login/page.tsx             tela de login
    (private)/
      layout.tsx                 exige sessão; monta AppShell
      dashboard/page.tsx
      leads/
        page.tsx
        [leadId]/page.tsx
      acoes/page.tsx
      agenda/page.tsx
      gestao/page.tsx            redirect se closer
      configuracoes/page.tsx     redirect se !admin
    api/                         BFF — route handlers
      auth/ login, logout, session
      dashboard/ priority, heatmap, summary
      leads/ list, [leadId], reveal-contact, actions
      actions/ list, [actionId]/complete
      agenda/
      management/
      audit/
  middleware.ts                  protege rotas pela presença do cookie
  components/
    layout/   AppShell, Sidebar, Topbar, PageHeader
    ui/       Button, Card, Badge, Skeleton, Table, Dialog, Drawer, Toast, States
    domain/   TemperatureBadge, LeadScoreBadge, AlertBadge, NextActionButton,
              HeatmapCell, HeatmapGrid, LeadPriorityCard, PriorityQueue,
              LeadTimeline, LeadScoreBreakdown, SensitiveDataGate
  features/
    dashboard/   DashboardSummaryCards, DashboardHeatmapSection, DashboardAlerts, DashboardView
    leads/       LeadFilters, LeadTable, LeadsView,
                 LeadDetailHeader, LeadCommercialSummary, LeadActionsPanel, LeadDetailView
    actions/     ActionExecutionDialog, ActionList, ActionsView
    agenda/      CallRiskBadge, AgendaList, AgendaView
    management/  CloserPerformanceTable, OperationMetrics, AuditTrail, ManagementView
  lib/
    api/       contracts.ts, bffClient.ts, server.ts
    auth/      session.ts, permissions.ts
    formatters/ date.ts, score.ts, mask.ts
    mock/      data.ts, users.ts, filters.ts, store.ts
    security/  piiGuards.ts
    utils/     cn.ts
```

Caminho `@/*` → `./src/*` no `tsconfig`.

---

## 3. Configuração base

### `tsconfig.json`

- `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`.
- `paths.@/*` → `./src/*`.

### `next.config.mjs`

```js
export default { reactStrictMode: true, poweredByHeader: false };
```

### `tailwind.config.ts`

Tokens customizados:

| Token | DEFAULT | soft | ink |
|---|---|---|---|
| `frio` | `#2563eb` | `#dbeafe` | `#1e3a8a` |
| `morno` | `#d97706` | `#fef3c7` | `#92400e` |
| `quente` | `#ea580c` | `#ffedd5` | `#9a3412` |
| `muito` | `#dc2626` | `#fee2e2` | `#991b1b` |

| `ink` | 950 `#0b1120` · 900 `#0f172a` · 800 `#1e293b` · 700 `#334155` |

Família `font-sans` referencia a variável CSS `--font-sans`. Animação `pulse-soft` (1.6s) declarada mas opcional.

`content: ["./src/**/*.{ts,tsx}"]`.

### `postcss.config.mjs`

`tailwindcss` + `autoprefixer`.

### `src/app/globals.css`

- `@tailwind base; components; utilities;`
- `:root { --font-sans: "Inter", system-ui, -apple-system, sans-serif }`
- `body { @apply bg-slate-100 text-slate-900 antialiased; font-family: var(--font-sans) }`
- Scrollbar fina cinza.
- `:focus-visible { @apply outline-none ring-2 ring-ink-900 ring-offset-2 ring-offset-white }`.

### `src/middleware.ts`

- Constante local `SESSION_COOKIE = "mdc_session"`.
- Rotas públicas: `["/login"]`.
- Sem cookie + rota não pública → `redirect("/login?from=<pathname>")`.
- Com cookie + `/login` → `redirect("/dashboard")`.
- `matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]`.

Importante: o middleware **só** checa presença. A checagem de perfil por rota acontece nas páginas/layout, que têm a conta completa.

---

## 4. Design system

### Faixas de score

| Faixa | Interpretação | Classe |
|---|---|---|
| 90–100 | Prioridade máxima | `text-muito` |
| 75–89 | Alta prioridade | `text-quente` |
| 50–74 | Média prioridade | `text-morno` |
| 0–49 | Baixa prioridade | `text-frio` |

### Temperatura (`TEMPERATURA_CONFIG` em `src/lib/formatters/score.ts`)

Cada entrada tem `label`, `descricao`, `ordem`, `icon` (lucide), `hex`, e quatro grupos de classes Tailwind:

- `text` → cor sólida (`text-muito`)
- `badge` → fundo suave + texto escuro (`bg-muito-soft text-muito-ink border border-muito/30`)
- `cell` → fundo de célula do heatmap (`bg-muito-soft/70 text-muito-ink`)
- `cellHover`, `dot`

Ícones: `muito_quente` Flame · `quente` ThermometerSun · `morno` Sun · `frio` Snowflake.

`TEMPERATURAS_ORDENADAS = ["muito_quente","quente","morno","frio"]`.

### Alertas (`ALERTA_CONFIG`)

| Tipo | Label | Significado | Ícone |
|---|---|---|---|
| `sla` | SLA | Sem ação dentro do tempo limite | Clock |
| `call` | Call | Reunião próxima | CalendarClock |
| `no_show` | No-show | Faltou e precisa recuperação | UserX |
| `resposta` | Resposta | Respondeu recentemente | MessageSquareReply |
| `sem_responsavel` | Sem responsável | Precisa de atribuição | UserPlus |

### Severidade (`SEVERIDADE_CLASSE`)

- `alta` → `bg-red-100 text-red-800 border border-red-200`
- `media` → `bg-amber-100 text-amber-800 border border-amber-200`
- `baixa` → `bg-slate-100 text-slate-700 border border-slate-200`

---

## 5. Contratos de dados — `src/lib/api/contracts.ts`

Todos os tipos são inferidos via `z.infer`. Listagem das chaves:

### Enums

```ts
Temperatura = "frio" | "morno" | "quente" | "muito_quente"
ETAPAS      = ["Novo Lead","Qualificado","Agendado","No-show"]   // const tuple
Severidade  = "baixa" | "media" | "alta"
AlertaTipo  = "sla" | "call" | "no_show" | "resposta" | "sem_responsavel"
Role        = "closer" | "coordenador" | "admin"
```

### `Alerta`
`{ tipo: AlertaTipo, label: string, severidade: Severidade }`

### `LeadPriorityItem`
`lead_id, closer_id, nome_exibicao, score, temperatura, etapa, motivo_curto, proxima_acao, proxima_acao_tipo, alertas[], updated_at`

> `proxima_acao_tipo` é operacional (não sensível) — orienta o canal de execução.

### `PriorityResponse`
`{ generated_at, total, items: LeadPriorityItem[] }`

### `HeatmapCell`
`{ etapa, temperatura, total_leads, score_medio, sla_critico, principal_motivo }`

### `HeatmapResponse`
`{ generated_at, cells: HeatmapCell[] }`

### `LeadDetailSafe`
```
lead_id, nome_exibicao, score, temperatura, etapa, origem, closer_id,
motivo_prioridade: string[],
score_breakdown: { peso: number, label: string }[],
resumo_comercial: { objetivo?, dor?, momento?, objecoes_provaveis?, interesse?, observacoes? },
proxima_acao: { tipo, label, recomendacao },
timeline_resumida: { event_id, tipo, label, occurred_at }[],
alertas: Alerta[],
updated_at
```

### `SummaryCard`
`{ id, label, valor, variacao?, tendencia?, filtro: Record<string,string>, destaque?: "frio"|"morno"|"quente"|"muito" }`

### `DashboardAlert`
`{ id, tipo: AlertaTipo, label, severidade, total }`

### `DashboardSummaryResponse`
`{ generated_at, cards: SummaryCard[], alertas: DashboardAlert[] }`

### `ActionItem`
`{ action_id, lead_id, nome_exibicao, horario, titulo, tipo: "whatsapp"|"ligar"|"reagendar"|"nota"|"follow_up", origem: "automatica"|"manual", prioridade: Severidade, status: "pendente"|"atrasada"|"concluida", auditada: boolean }`

### `AgendaItem`
`{ lead_id, nome_exibicao, horario, score, temperatura, status: "confirmada"|"aguardando"|"risco_no_show", sinais: string[] }`

### `CloserPerformance`
`closer_id, nome, leads_total, leads_quentes, sla_vencido, calls_hoje, primeiro_contato_min, comparecimento, conversao_parcial`

### `ManagementResponse`
`{ generated_at, closers: CloserPerformance[], metricas: { leads_sem_responsavel, leads_ignorados, score_medio_geral, distribuicao_temperatura: Record<string,number> } }`

### `SessionUser`
`{ id, nome, email, role: Role, closer_id: string | null }`

### `RevealContactResponse`
`{ lead_id, telefone, email, expira_em: number, auditoria_id }`

---

## 6. Camada mock — `src/lib/mock/`

### `users.ts`

Registry de closers:

```ts
CLOSERS = { jonas: "Jonas Almeida", pedro: "Pedro Nunes", carla: "Carla Dias" }
closerNome(id) → nome ou "Sem responsável" se id === ""
```

Contas de demonstração (`DEMO_ACCOUNTS`):

| ID | Email | Nome | Role | closer_id |
|---|---|---|---|---|
| jonas | jonas@vatadojo.com.br | Jonas Almeida | closer | jonas |
| ana | ana@vatadojo.com.br | Ana Ribeiro | coordenador | null |
| marina | marina@vatadojo.com.br | Marina Costa | admin | null |
| vata | contato@vatadojo.com.br | Conta Vata Dojo | admin | null |

`ROLE_LABEL = { closer: "Closer", coordenador: "Coordenador", admin: "Administrador" }`.

Funções: `findAccountByEmail`, `findAccountById`.

### `store.ts` — estado mutável

Singleton em `globalThis.__mdcStore = { audit: [], concluidas: Set, seq: 1 }` (sobrevive ao HMR).

- `AuditEvent`: `{ audit_id, occurred_at, actor_id, actor_nome, acao, lead_id?, detalhe }`
- `registrarAuditoria(evt)` — adiciona com id `aud_NNNNN`, retorna o evento.
- `marcarConcluida(actionId)`, `isConcluida(actionId)`.

### `data.ts` — geração de leads

- LCG seeded com `20260522`. 132 leads. `lead_id = "ld_0001"` … `"ld_0132"`.
- `LeadRecord` interno tem PII (`telefone`, `email`, `nome_completo`).
- `GENERATED_AT` é fixado no carregamento do módulo. Timestamps são offsets a partir dele.
- `LEADS` é singleton em `globalThis.__mdcLeads`.

**Pools usados na geração:**

- 35 nomes pt-BR · 24 sobrenomes
- 7 origens: Formulário, WhatsApp, Calendly, Indicação, Instagram Ads, YouTube, CRM
- `MOTIVOS` por temperatura (4 frases cada)
- `ACOES_POR_ETAPA` mapeia cada etapa para 3 ações `{label, tipo}`

**Distribuição de etapa (pesos):** Novo Lead 30 · Qualificado 30 · Agendado 22 · No-show 18.

**Probabilidade de `respondeu_min` por etapa:** Qualificado 0.55 · Agendado 0.50 · No-show 0.35 · Novo Lead 0.30. Se respondeu, `respondeu_min = round(rng*200 + 2)`.

**`no_show_count`:** etapa No-show → 1 + (rng<0.3 ? 1 : 0); senão rng<0.08 → 1.

**`sem_acao_horas`:** distribuição enviesada para baixo:
`Math.pow(rng,3)*9 + (No-show ? rng*3 : 0)`. Cerca de 30 % dos leads passam de 3h.

**`sem responsável`:** rng < 0.07 → `closer_id = ""`; senão sorteia entre `jonas/pedro/carla`.

**`score_breakdown` (somado e clampado em 4..100):**

| Componente | Pesos / probabilidade |
|---|---|
| Intenção declarada | `+50` (24%) · `+36` (30%) · `+22` (27%) · `+10` (19%) |
| Etapa | Novo Lead 8 · Qualificado 19 · Agendado 27 · No-show 15 |
| Respondeu nos últimos 30 min | `+16` |
| Respondeu recentemente | `+9` |
| Perfil aderente ao ICP | `+12` (60%) |
| Engajou com conteúdo | `+8` (44%) |
| Capacidade de investimento | `+10` (48%) |
| No-show anterior | `−5 × no_show_count` |
| Tempo de resposta acima do SLA | `−6` se `sem_acao_horas ≥ 6` |

`score → temperaturaFromScore(score)`.

**`proxima_call_at`** só para etapa Agendado: 50 % hoje · 30 % amanhã · 20 % nos próximos 2–5 dias. Hora 8–19 ou meia hora.

**`call_status`:** `risco_no_show` se `no_show_count > 0`; `confirmada` se respondeu há menos de 240 min; senão `aguardando`.

**`alertas` (montagem)**:

- `sem_responsavel` → `closer_id === ""` (severidade alta)
- `sla` → `sem_acao_horas ≥ 3` (alta se ≥6, senão média)
- `call` → etapa Agendado com `proxima_call_at` em até 24h; severidade alta <1h, média <4h, baixa caso contrário
- `no_show` → etapa No-show (alta se múltiplos no-shows)
- `resposta` → `respondeu_min ≤ 60`

**Projeções:**

- `leadsNoEscopo(closerId)`: `null` → todos; `"jonas"` → `closer_id === "jonas" || closer_id === ""`.
- `getLeadRecord(leadId, closerId)`: retorna `null` se o lead estiver fora do escopo (tratado como 404).
- `toPriorityItem(record)`: remove campos sensíveis, mantém `proxima_acao_tipo`.
- `toLeadDetailSafe(record)`: sintetiza `motivo_prioridade` (a partir de alertas/etapa), `resumo_comercial` (pools de objetivo, dor, momento, 2–3 objeções, interesse, observação fixa), e `timeline_resumida` (eventos derivados da etapa, espaçados entre `entrada_at` e `updated_at`).
- `buildHeatmap(leads)`: 4 × 4 células com `total_leads`, `score_medio`, `sla_critico` (alertas sla com severidade alta) e `principal_motivo` (motivo_curto mais frequente).

### `filters.ts`

`normalizar(s)` remove diacríticos e caixa-mistura.

`filtrarLeads(leads, URLSearchParams)` suporta:

- `busca` (nome exibido ou ID, case/acento-insensível)
- `temperatura`, `etapa`, `origem`, `closer` (CSV opcional para temperatura/etapa)
- `score_min` (número)
- `alerta` (tipo)
- `sem_acao=1` (≥3h)
- `com_alerta=1`
- `call_hoje=1`
- `sem_responsavel=1`
- `no_show=1`
- `aguardando_resposta=1` (`respondeu_min ≤ 240`)
- `respondido_recente=1` (`respondeu_min ≤ 60`)
- `no_show_quente=1` (etapa No-show + score ≥ 70)

`ordenarPorPrioridade(leads)`: score desc, em empate `updated_at` desc.

---

## 7. Camada utilitária

### `auth/session.ts`

- `SESSION_COOKIE = "mdc_session"`.
- `SESSION_COOKIE_OPTS = { httpOnly: true, secure: prod, sameSite: "lax", path: "/", maxAge: 8h }`.
- `getServerSession()` lê o cookie via `cookies()` (Next 15 async) e devolve `SessionUser | null`.

### `auth/permissions.ts`

- `NavItem = { href, label, icon: LucideIcon, roles: Role[] }`.
- `NAV_ITEMS`:

| href | label | ícone | roles |
|---|---|---|---|
| `/dashboard` | Dashboard | LayoutDashboard | closer, coordenador, admin |
| `/leads` | Leads | Users | closer, coordenador, admin |
| `/acoes` | Ações | ListChecks | closer, coordenador, admin |
| `/agenda` | Agenda | CalendarDays | closer, coordenador, admin |
| `/gestao` | Gestão | BarChart3 | coordenador, admin |
| `/configuracoes` | Configurações | Settings | admin |

- `navParaRole(role)` filtra a lista.
- `podeAcessarRota(role, pathname)` casa com a primeira correspondência por prefixo.

### `formatters/date.ts`

- `tempoRelativo(iso)` → "agora", "há 5 min", "há 2 h", "ontem", "há N dias", "há N meses".
- `horaCurta(iso)` → "14:32" (pt-BR).
- `dataCurta(iso)` → "22/05".
- `dataHora(iso)` = `${dataCurta} ${horaCurta}`.
- `minutosAte(iso)`, `quandoCall(iso)` ("em X min", "hoje 14h", "amanhã ..."), `ehHoje(iso)`.

### `formatters/score.ts`

Exporta `TEMPERATURA_CONFIG`, `TEMPERATURAS_ORDENADAS`, `faixaScore`, `ALERTA_CONFIG`, `SEVERIDADE_CLASSE` (ver seção 4).

### `formatters/mask.ts`

- `mascararTelefone("+55 11 9123-4567")` → `"+•• •• •••••-4567"`.
- `mascararEmail`, `iniciais("Maria Silva")` → `"MS"`.

### `security/piiGuards.ts`

`assertSemPII(payload, contexto)` percorre recursivamente e procura chaves proibidas: `telefone`, `email`, `nome_completo`, `cpf`, `patrimonio`, `transcricao`, `transcricao_completa`, `historico_completo`. Em dev: lança erro. Em produção: loga e segue. Aplicada apenas em payloads "safe" via `jsonSeguro`. Endpoints intencionalmente PII (reveal-contact, session) usam `NextResponse.json` direto.

### `api/server.ts`

- `requireSession()` → retorna `SessionUser` ou `NextResponse` 401 pronto.
- `jsonSeguro(payload, contexto)` → roda `assertSemPII` antes de devolver.
- `erro(msg, status)`.

### `api/bffClient.ts`

- `BffError extends Error { status }`.
- `request(path, schema, init)`: fetch para `/api${path}`, valida com Zod, devolve dado ou lança `BffError`.
- Funções tipadas:
  - Sessão: `fetchSession`, `login(email)`, `logout()`
  - Dashboard: `fetchPriority(params)`, `fetchHeatmap()`, `fetchDashboardSummary()`
  - Leads: `fetchLeads(params)`, `fetchLeadDetail(id)`, `revelarContato(id)`, `executarAcao(id, payload)`
  - Ações: `fetchActions(params)`, `concluirAcao(actionId)`
  - Agenda: `fetchAgenda()`
  - Gestão: `fetchManagement()`, `fetchAudit()`

### `utils/cn.ts`

`cn(...inputs) = twMerge(clsx(inputs))`.

---

## 8. BFF — Endpoints

Padrão: cada route handler chama `requireSession()` no topo, filtra escopo, valida payload com Zod, retorna via `jsonSeguro` (dados safe) ou `NextResponse.json` (sessão/PII).

### Autenticação

| Método | Path | Comportamento |
|---|---|---|
| POST | `/api/auth/login` | Body `{ email }`. Busca em `DEMO_ACCOUNTS`. Sucesso: registra auditoria `login`, seta cookie HttpOnly `mdc_session=<id>`, retorna o `SessionUser`. Falha: 401. |
| POST | `/api/auth/logout` | Apaga o cookie, retorna `{ ok: true }`. |
| GET | `/api/auth/session` | Retorna o `SessionUser` da sessão atual (401 se não houver). |

### Dashboard

| Path | Filtros | Retorno |
|---|---|---|
| `GET /api/dashboard/priority` | todos os filtros de `filtrarLeads` + `limit` (default 20) | `{ generated_at, total, items: LeadPriorityItem[] }` ordenado por prioridade |
| `GET /api/dashboard/heatmap` | escopo apenas | `{ generated_at, cells: HeatmapCell[] }` (16 células) |
| `GET /api/dashboard/summary` | escopo apenas | cards + alertas (ver seção 13) |

### Leads

| Path | Comportamento |
|---|---|
| `GET /api/leads` | mesmos filtros do priority, sem `limit`; ordenado por prioridade. `{ total, items }`. |
| `GET /api/leads/:leadId` | `getLeadRecord` com escopo; 404 se fora; retorna `LeadDetailSafe` (`toLeadDetailSafe`). |
| `POST /api/leads/:leadId/reveal-contact` | Registra auditoria `reveal_contact`. Retorna `{ lead_id, telefone, email, expira_em: 120, auditoria_id }`. **Único endpoint que devolve PII.** |
| `POST /api/leads/:leadId/actions` | Body `{ tipo, nota?, nova_etapa? }`. Tipos aceitos: `whatsapp, ligar, reagendar, nota, follow_up, alterar_etapa, transferir`. `transferir` exige coord/admin (403 para closer). Registra auditoria `action:<tipo>`. Retorna `{ ok, mensagem, auditoria_id }`. |

### Ações

| Path | Comportamento |
|---|---|
| `GET /api/actions` | Constrói `ActionItem[]` a partir dos leads no escopo com `score ≥ 50` OU com alertas. Filtros `filtro=hoje|atrasadas|automaticas|manuais|alta`. Ordenado por horário, concluídas no fim. |
| `POST /api/actions/:actionId/complete` | `actionId` segue o padrão `act_<lead_id>`. Valida escopo via lead. Marca em `store.concluidas`, audita. |

### Agenda

`GET /api/agenda`: filtra leads etapa `Agendado` com `proxima_call_at` hoje no escopo. Para cada, monta `sinais[]`:

- `min < 60` → "Call em X min"
- `call_status === "aguardando"` → "Ainda não confirmou"
- `no_show_count > 0` → "Já teve no-show"
- `respondeu_min ≤ 120` → "Respondeu recentemente"
- `sem_acao_horas ≥ 5` → "Sem interação há Xh"

Ordenado por horário ascendente.

### Gestão / Auditoria

| Path | Acesso | Comportamento |
|---|---|---|
| `GET /api/management` | coord/admin (403 para closer) | Agrega métricas por closer (sobre todos os leads) e gerais (`leads_sem_responsavel`, `leads_ignorados`, `score_medio_geral`, `distribuicao_temperatura`). |
| `GET /api/audit` | coord/admin | Últimos 80 eventos da `store.audit`. |

**Métricas por closer**:

- `primeiro_contato_min` ≈ média do `sem_acao_horas` dos leads "Novo Lead" × 11, clamp 18..160.
- `comparecimento %` = `agendados / (agendados + no_show)`.
- `conversao_parcial %` = `15 + (leads_quentes / total) * 65`, clamp 0..100.

---

## 9. Autenticação e perfis

### Fluxo

1. Usuário escolhe conta na tela de login → `POST /api/auth/login` → cookie `mdc_session` setado.
2. Middleware detecta cookie → permite navegação privada; redireciona `/login` se já houver sessão.
3. `(private)/layout.tsx` chama `getServerSession()` e redireciona para `/login` se ausente. Passa `user` ao `<AppShell>`.
4. Páginas restritas (`/gestao`, `/configuracoes`) checam role no servidor e redirecionam para `/dashboard` se insuficiente.
5. Logout via `Topbar` chama `POST /api/auth/logout` e força `window.location = "/login"`.

### Matriz de visibilidade

| Tela | Closer | Coordenador | Admin |
|---|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ |
| Leads | ✓ (só carteira + sem responsável) | ✓ (todos) | ✓ |
| Detalhe do lead | ✓ (se no escopo) | ✓ | ✓ |
| Ações | ✓ | ✓ | ✓ |
| Agenda | ✓ | ✓ | ✓ |
| Gestão | — | ✓ | ✓ |
| Configurações | — | — | ✓ |

### Restrições dentro das telas

- **Tela de leads**: filtro "Closer" aparece somente para coord/admin.
- **Painel de ações do lead**: botão "Transferir lead" desabilitado para closer (lock).
- **Mensagem de auditoria**: visível em ações que disparam serviço externo (whatsapp, reagendar, follow_up, nota, alterar_etapa, transferir). `ligar` é offline → sem destaque de auditoria.

---

## 10. Componentes de UI primitivos — `components/ui/`

### `Button.tsx`

`forwardRef<HTMLButtonElement>`, props: `variant: "primary"|"secondary"|"outline"|"ghost"|"danger"` (default primary), `size: "sm"|"md"` (default md), `loading: boolean`. Quando `loading`, renderiza `Loader2` animado, desabilita o botão.

- primary: `bg-ink-900 text-white`
- outline: borda slate + bg white
- ghost: text slate + hover bg
- danger: red-600
- sm: h-8 px-3 text-xs · md: h-10 px-4 text-sm

### `Card.tsx`

- `Card`: `div` com `rounded-xl border border-slate-200 bg-white shadow-sm`.
- `CardHeader({ title, subtitle?, action? })`: padding `px-4 py-3`, border-b, slot direito para ação.
- `CardContent`: padding `p-4`.

### `Badge.tsx`

`span` genérico com forma de pílula. Variantes de domínio têm componente próprio (Temperature/Alert).

### `Skeleton.tsx`

`div animate-pulse rounded-md bg-slate-200/80`. Tamanho via `className`.

### `Table.tsx`

`Table` (com `overflow-x-auto` ao redor), `THead`, `TBody`, `TR`, `TH`, `TD`. `TR` aceita `interactive` para hover + cursor pointer.

`TH`: `bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500`.

### `Dialog.tsx` (client)

Modal centralizado. Props: `open, onClose, title, description?, footer?, className?`. ESC fecha. Bloqueia scroll do body. Backdrop semi-transparente com blur. `max-w-lg` por padrão.

### `Drawer.tsx` (client)

Painel deslizante à direita. Mesma API simplificada. Largura `w-[440px] max-w-[92vw]`. ESC fecha.

### `Toast.tsx` (client)

`ToastProvider` provê função `toast({ titulo, descricao?, variante?, auditada? })`. Pilha bottom-right. Auto-dismiss 5s. Variantes `sucesso/erro/info` definem ícone e borda esquerda. Se `auditada=true`, mostra linha `ShieldCheck "Esta ação foi registrada para auditoria"`. `useToast()` lança fora do provider.

### `States.tsx`

- `EmptyState({ titulo, descricao, icon? })`: ícone redondo cinza + título + descrição.
- `ErrorState({ titulo, descricao, onRetry? })`: ícone vermelho + título + descrição + botão "Tentar novamente" (outline) se `onRetry`.

---

## 11. Layout — `components/layout/`

### `AppShell.tsx` (client)

Estado `navAberto`. Estrutura:

```
<div class="flex min-h-screen">
  <Sidebar role mobileOpen onClose />
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar user onMenu />
    <main class="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
  </div>
</div>
```

### `Sidebar.tsx` (client)

Dois modos:

- Desktop: coluna fixa `hidden md:flex w-60 bg-ink-900`.
- Mobile: overlay com backdrop + painel translate-x.

Conteúdo:

1. Marca: badge vermelho com Flame + "Mapa de Calor" / subtítulo "Mesa de decisão".
2. Nav: `navParaRole(role).map(item => Link)`. Item ativo: `bg-ink-700 text-white`; inativo: `text-slate-400 hover:bg-ink-800`. Ícone à esquerda.
3. Rodapé (desktop): "Dados sensíveis protegidos por padrão. Ações críticas são auditadas."

`usePathname()` decide o ativo (`path === item.href || startsWith(item.href + "/")`).

### `Topbar.tsx` (client)

Altura 56px, sticky top, border-b. Conteúdo da esquerda para direita:

1. Botão menu (md:hidden) → abre Sidebar mobile.
2. Form de busca rápida (Search icon + input). Submit → `router.push('/leads?busca=<v>')`.
3. Chip "Sessão segura" (oculto em xs).
4. Avatar com `iniciais(nome)` + nome + role + ChevronDown → abre dropdown:
   - cabeçalho: nome + email.
   - botão "Sair" (LogOut). Ao clicar: `logout()` + `window.location = "/login"`.

Dropdown fecha ao clicar fora (ref + listener `mousedown`).

### `PageHeader.tsx`

```
<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1>{titulo}</h1>
    {descricao}
  </div>
  <div class="flex items-center gap-3">{meta} {acoes}</div>
</div>
```

---

## 12. Componentes de domínio — `components/domain/`

### `TemperatureBadge.tsx`

Props: `temperatura, size?: "sm"|"md", showLabel?`. Renderiza span com classe `badge` da `TEMPERATURA_CONFIG`, ícone + label. `title` traz a descrição (tooltip nativo).

### `LeadScoreBadge.tsx`

Props: `score, size?: "sm"|"md"|"lg", withLabel?`. Número grande tabular-nums com cor por faixa. Se `withLabel`, mostra texto da faixa ao lado.

### `AlertBadge.tsx`

Props: `alerta, size`. Usa `ALERTA_CONFIG` para ícone + `SEVERIDADE_CLASSE` para cor. `title` com `label + significado`.

### `NextActionButton.tsx`

Wrapper de `Button` com ícone baseado em `tipo`: whatsapp→MessageCircle, ligar→Phone, reagendar→CalendarClock, nota→StickyNote, follow_up→Clock. Props: `label, tipo, onClick, loading, size, variant, fullWidth`.

### `HeatmapCell.tsx` (client)

Props: `cell: HeatmapCell, intensidade: number, selecionada, onClick`. Botão com:

- `backgroundColor: rgba(cfg.hex, 0.06 + intensidade*0.34)` via inline style (intensidade = total/maxTotal).
- Selecionada: borda `border-ink-900` + `ring-2 ring-ink-900`.
- Vazia (total=0): disabled, fundo `bg-slate-50`, texto opaco.
- Número grande + "leads" abaixo.
- Se `sla_critico > 0`: selo vermelho top-right `<n> SLA`.
- Tooltip group-hover: card escuro `bottom-[calc(100%+6px)]` com `cfg.label · etapa`, `Score médio`, `SLA crítico`, `principal_motivo`.

### `HeatmapGrid.tsx` (client)

Props: `cells, selecionada, onSelect, loading?, error?, onRetry?`. CSS grid `grid-cols-[88px_repeat(4,1fr)] gap-1.5`:

- Linha de cabeçalho: célula vazia "Temp. × Etapa" + 4 nomes de etapa.
- 4 linhas (uma por temperatura) com: rótulo + ícone à esquerda + 4 `HeatmapCell`.

Estados: loading → 25 Skeletons; error → `ErrorState`.

Rodapé: aviso "Clique numa célula para filtrar...".

### `LeadPriorityCard.tsx` (client)

Card da fila. Props: `item, rank?, onExecutar?, executando?`. Layout:

- Top: rank em chip cinza + nome + `lead_id · tempoRelativo(updated_at)` + `LeadScoreBadge` à direita.
- Linha de badges: `TemperatureBadge` + pílula com `etapa`.
- "Motivo: ..." e "Próxima ação: ..." (rótulos cinza).
- Alertas (se houver) como AlertBadge sm.
- Ações: `[Abrir]` (Link para `/leads/<id>`, outline) e `[Executar ação]` (primário, ícone Zap).

### `PriorityQueue.tsx` (client)

Lista vertical com cabeçalho "Fila recomendada" + contagem `items.length de total`. Corpo scroll com cards. Estados: loading (5 skeletons 168px), error (`ErrorState` com `onRetry`), vazio (`EmptyState`).

### `LeadTimeline.tsx`

Lista ordenada por `occurred_at` desc com linha vertical à esquerda (`border-l`). Ícone por tipo (entrada→LogIn, resposta→MessageSquareReply, qualificacao→BadgeCheck, call→CalendarClock, no_show→UserX, follow_up→Send, fallback→Circle).

### `LeadScoreBreakdown.tsx`

Topo: bloco cinza "Score total" + `LeadScoreBadge size=lg`.

Lista dividida: `label` à esquerda, peso à direita em pílula (`+N` verde se positivo, `−N` vermelho).

### `SensitiveDataGate.tsx` (client)

Dois estados:

**Bloqueado:**
- card tracejado com Lock + "Dados sensíveis bloqueados" + descrição + botão `[Solicitar exibição de contato]`.

**Revelado:**
- card amarelo com "Contato exibido — expira em Ns" + botão "Ocultar agora".
- duas linhas (Telefone, E-mail) com botão copiar (Copy → Check 1.5s) por linha.
- rodapé `Registro de auditoria: aud_NNNNN`.

Contador regressivo via `setTimeout` a cada 1s; ao zerar limpa o `contato`. Botão de copiar usa `navigator.clipboard`.

Toast informativo quando revela ("Contato exibido temporariamente, visível por Ns", `auditada: true`).

---

## 13. Features — `src/features/`

### Dashboard

#### `DashboardSummaryCards.tsx`

Grid responsiva 2 / 3 / 6 colunas. Cada card:

- Barra colorida vertical à esquerda (1px) com `ACENTO[destaque]`.
- Label cinza + valor 2xl bold tabular-nums + linha de variação com ícone tendência (`TrendingUp / TrendingDown / Minus`) e texto "+X% hoje".
- Card ativo: borda + ring `ink-900`. Skeleton enquanto carrega.

Os 6 cards padrão (ordem fixa):

| id | label | filtro aplicado | destaque |
|---|---|---|---|
| muito_quentes | Leads muito quentes | temperatura=muito_quente | muito |
| reuniao_hoje | Reunião hoje | call_hoje=1 | quente |
| sem_acao | Sem ação há +3h | sem_acao=1 | morno |
| no_show_quente | No-show com alta intenção | no_show_quente=1 | quente |
| aguardando_resposta | Aguardando resposta do closer | aguardando_resposta=1 | morno |
| sem_responsavel | Sem responsável | sem_responsavel=1 | muito |

#### `DashboardHeatmapSection.tsx`

Wrapper de Card com cabeçalho "Mapa de calor / Concentração de leads por temperatura e etapa", botão "Limpar célula" quando há seleção, corpo com `HeatmapGrid`, rodapé com legenda das 4 temperaturas (ícone + texto + cor por config).

#### `DashboardAlerts.tsx`

Card "Alertas operacionais". Cada alerta: caixa colorida com ícone do tipo + label + ChevronRight. Click → handler do orquestrador. Empty: "Nenhum alerta crítico no momento."

#### `DashboardView.tsx` (orquestrador, client)

Estado:
- `filtro: Record<string,string>`
- `cardAtivo: string | null`
- `celula: CelulaSelecionada`
- `descricaoFiltro: string | null`
- `alvo: { item, acao } | null` (para `ActionExecutionDialog`)

Queries (key, função):
- `["dashboard","summary"]` → `fetchDashboardSummary`
- `["dashboard","heatmap"]` → `fetchHeatmap`
- `["dashboard","priority", filtro]` → `fetchPriority({ ...filtro, limit:"25" })`

Handlers:
- `selecionarCard(card)`: toggle. Aplica `card.filtro`, limpa célula.
- `selecionarCelula(sel)`: filtro `{ temperatura, etapa }`, limpa cardAtivo. Se `sel=null`, limpa.
- `abrirAlerta(alerta)`: mapeia `FILTRO_ALERTA[tipo]`:
  - sla → `sem_acao=1`
  - call → `call_hoje=1`
  - no_show → `no_show=1`
  - sem_responsavel → `sem_responsavel=1`
  - resposta → `respondido_recente=1`
- `executarItem(item)` → abre `ActionExecutionDialog` com `{ tipo: item.proxima_acao_tipo, label: item.proxima_acao, descricao }`.
- `aposExecutar()` → `qc.invalidateQueries({ queryKey: ["dashboard"] })`.
- `atualizar()` → mesmo invalidate (botão "Atualizar").

Layout:
1. Barra de atualização: "Snapshot atualizado há X" + botão Atualizar.
2. Banner âmbar se `minutos desde generated_at ≥ 10`: "Última atualização há N minutos. Alguns scores podem estar desatualizados."
3. `DashboardSummaryCards`.
4. Banner de filtro ativo (slate-50 com ícone Filter) com "Limpar filtro".
5. Grid `lg:grid-cols-[1.5fr_1fr] gap-4`: heatmap à esquerda (Card flex h-full), `PriorityQueue` à direita dentro de `Card` `h-[640px]`.
6. `DashboardAlerts`.
7. `ActionExecutionDialog` controlado por `alvo`.

### Leads

#### `LeadFilters.tsx`

Barra de filtros em Card branco:

- Busca (input com Search à esquerda; bg-slate-50 → branco no focus).
- 4–5 selects: Temperatura, Etapa, Score mínimo (90+/75+/50+), Origem (7 opções), Closer (somente coord/admin, opções vindo de `CLOSERS`).
- Linha de chips (toggles): "Sem ação", "Com alerta", "No-show", "Aguardando resposta", "Respondido recentemente". Toggle: vai/volta entre "1" e ausência.
- Botão "Limpar (N)" se houver filtros ativos.

`FiltroSelect` interno: cinza quando vazio, slate-900 quando selecionado.

#### `LeadTable.tsx`

Wrapper `rounded-xl border bg-white`. Colunas: Nome (com `lead_id` em cinza), Score (LeadScoreBadge sm), Temperatura, Etapa, Motivo, Alertas (até 2 + "+N"), Ação ([Abrir]). Linha clicável (`router.push(detail)`). Botão `Abrir` faz `stopPropagation` para não duplicar navegação.

Estados: loading (8 skeletons 12), error (ErrorState), empty ("Nenhum lead para este filtro").

#### `LeadsView.tsx` (orquestrador)

Padrão **URL é a fonte de verdade dos filtros**:

- `useSearchParams()` → `filtro = Object.fromEntries(sp.entries())` via `useMemo([sp])`.
- `setParam(chave, valor)`: clona `sp`, set/delete, `router.replace('/leads?<qs>')` (sem `qs` → `/leads`).
- `onLimpar` → `router.replace('/leads')`.
- `useQuery(['leads', filtro], () => fetchLeads(filtro))`.
- Contador acima da tabela: "N leads · ordenados por prioridade recomendada".

Topbar.busca empurra para `/leads?busca=...` → como `filtro` deriva da URL, a tabela já filtra. Sem debounce — a queries são locais.

#### `LeadDetailHeader.tsx`

Card com:
- Link de volta "← Voltar para leads".
- Linha superior: nome (xl semibold) + `lead_id` em xs cinza, badges de temperatura + alertas; à direita `LeadScoreBadge size=lg withLabel`.
- Grid de 4 campos com ícone (`Etapa, Closer, Origem, Atualizado`).

`closerNome(closer_id)` resolve "Sem responsável" para id vazio.

#### `LeadCommercialSummary.tsx`

Conjunto de linhas (icon + rótulo uppercase + valor) para Objetivo, Dor, Momento, Interesse. Caso haja `objecoes_provaveis`, bloco cinza com chips. Observações em texto cinza.

#### `LeadActionsPanel.tsx` (client)

Grid 2 colunas de botões de ação:

| Tipo | Título | Auditada |
|---|---|---|
| whatsapp | Enviar WhatsApp | ✓ |
| ligar | Marcar como contatado | — |
| nota | Registrar observação | ✓ |
| alterar_etapa | Alterar etapa | ✓ |
| follow_up | Agendar follow-up | ✓ |
| reagendar | Reagendar call | ✓ |
| transferir | Transferir lead (só coord/admin) | ✓ |

Cada botão: ícone + título + descrição curta + chip `ShieldCheck "Auditada"` quando aplicável. Bloqueado (transferir + closer) com `Lock` cinza e opacidade.

Botão extra "Copiar mensagem sugerida": copia template para a próxima ação (clipboard) e dispara toast `sucesso`.

Abre `ActionExecutionDialog` interno com o tipo escolhido.

#### `LeadDetailView.tsx` (orquestrador)

`useQuery(['lead', leadId], fetchLeadDetail)`. `retry: (n,e) => !(e.status===404) && n<1`.

Estados:
- Loading: 3 skeletons (40, 10, 64).
- Error: `ErrorState`. Se 404 → "Lead não encontrado", sem retry.

Estrutura quando carregado:
1. `LeadDetailHeader`.
2. Barra de abas horizontal (5 botões com border-b-2 ativo):
   - Visão geral
   - Motivos do score
   - Resumo comercial
   - Timeline
   - Ações
3. Conteúdo da aba:
   - **Visão geral**: grid 2 colunas → card "Motivo da prioridade" (lista com CheckCircle2 verde por item) e card "Próxima melhor ação" (label + recomendação com Lightbulb âmbar + `NextActionButton`); abaixo card "Dados sensíveis" com `SensitiveDataGate`.
   - **Motivos do score**: `LeadScoreBreakdown`.
   - **Resumo comercial**: `LeadCommercialSummary`.
   - **Timeline**: `LeadTimeline`.
   - **Ações**: `LeadActionsPanel`.
4. `ActionExecutionDialog` controlado para o botão "Próxima melhor ação".

`aposAcao()` invalida `["lead", leadId]` e `["dashboard"]`.

### Actions

#### `ActionExecutionDialog.tsx` (client, reutilizável)

Diálogo de confirmação para qualquer ação. Props:

```ts
{ open, onClose, leadId, nomeExibicao, acao: { tipo, label, descricao? } | null, onExecuted? }
```

Comportamento:
- Se `acao=null` → retorna null (ainda chama hooks antes para manter ordem).
- Render: `Dialog` com título = `acao.label`, descrição = `Lead nome · lead_id`.
- Bloco cinza com `acao.descricao` se houver.
- Campo extra:
  - `tipo === "alterar_etapa"` → select com `ETAPAS`.
  - `tipo === "nota"` → textarea obrigatória (`min 3 chars`); botão Confirmar disabled se vazio.
- Rodapé com ShieldCheck: "Esta ação passa pelo backend e será registrada para auditoria." (ou variante para `ligar`).
- Botões: Cancelar (outline) e Confirmar e executar (loading durante request).
- Sucesso → `toast(sucesso, auditada=true para tipos auditados)`, reset, fecha, `onExecuted()`.
- Erro → `toast(erro)`.

#### `ActionList.tsx`

Renderiza cada `ActionItem` como linha em card:

- Coluna esquerda 12rem com horário negrito.
- Avatar de ícone (Check se concluída, senão ícone do tipo).
- Título + linha cinza: link do lead, origem (Automática/Manual), chip ShieldCheck "Auditada".
- Badge de prioridade (SEVERIDADE_CLASSE) + badge "Atrasada" se aplicável (oculto em xs).
- Botões "Executar" (Zap) + "Concluir" (Check, com loading).

Concluídas: opacidade reduzida, título com `line-through`.

#### `ActionsView.tsx` (orquestrador)

Tabs (botões pílula): Hoje / Atrasadas / Automáticas / Manuais / Alta prioridade. `filtro` controla a query `['actions', filtro]`.

Concluir → `concluirAcao(action_id)` com `ocupadoId`. Sucesso: toast `auditada: true` + invalida `["actions"]` e `["dashboard"]`.

Executar → abre `ActionExecutionDialog` com `acao = { tipo, label: titulo, descricao }`.

Contador: "N ações nesta visão".

### Agenda

#### `CallRiskBadge.tsx`

Badge com ícone + texto:
- confirmada → CheckCircle2 + verde
- aguardando → Clock + âmbar
- risco_no_show → AlertTriangle + vermelho

#### `AgendaList.tsx`

Cada item: caixa branca em row layout:
- Horário grande à esquerda.
- Nome + LeadScoreBadge + TemperatureBadge + CallRiskBadge.
- Chips de sinais cinza claro.
- Botões: `[Abrir]` (outline) e ação contextual.

Helper exportada `acaoDaCall(status)`:
- confirmada → `whatsapp`, "Enviar lembrete"
- aguardando → `whatsapp`, "Enviar confirmação"
- risco_no_show → `ligar`, "Reforçar presença"

#### `AgendaView.tsx`

`useQuery(['agenda'], fetchAgenda)`. Topo com 3 chips (calls hoje / confirmadas / em risco). `ActionExecutionDialog` invocado por `acionar(item)` usando `acaoDaCall`.

### Management

#### `CloserPerformanceTable.tsx`

Tabela com colunas: Closer, Leads, Quentes, SLA vencido, Calls hoje, 1º contato, Comparecimento, Conversão parcial. Formatação:
- 1º contato: `formataContato(min)` → "X min" / "Yh" / "YhMM".
- SLA vencido > 4 → vermelho semibold.
- Conversão parcial colorida: ≥45 verde, ≥35 âmbar, <35 vermelho.

#### `OperationMetrics.tsx`

Grid lg:3:
- 3 cards de métrica (Leads sem responsável, Leads ignorados, Score médio geral) com ícone, label, valor 3xl. Vermelho quando alerta.
- Card com largura total: "Distribuição de temperatura" — barra horizontal `h-3 rounded-full` com 4 segmentos coloridos via inline `backgroundColor: TEMPERATURA_CONFIG[t].hex` proporcionais. Legenda abaixo com contagens.

#### `AuditTrail.tsx`

`useQuery(['audit'], fetchAudit, staleTime: 5000)`.

Lista de eventos em Card "Auditoria resumida":
- Ícone ShieldCheck cinza.
- Conteúdo: `<actor_nome> · <rotuloAcao(acao)>` + detalhe abaixo.
- Direita: tempo relativo + link `[lead_id]` (se houver) com ExternalLink.

`rotuloAcao` mapeia: `login`, `reveal_contact`, `action:complete`, `action:<tipo>`.

Empty: "Nenhuma ação auditada ainda. Execute uma ação ou revele um contato para gerar registros."

#### `ManagementView.tsx`

`useQuery(['management'], fetchManagement)`.

Render:
1. `OperationMetrics` (ou skeletons).
2. Card "Performance por closer / Carteira, gargalos e qualidade da priorização" + `CloserPerformanceTable`.
3. `AuditTrail`.

---

## 14. Páginas — `src/app/(private)/.../page.tsx`

Todas as páginas são componentes de servidor finos: cabeçalho + componente View client.

### `/dashboard`

```
PageHeader "Dashboard de prioridade" / "Quem atacar agora, por qual motivo e qual ação executar."
<DashboardView />
```

### `/leads`

- `await getServerSession()` → `mostrarCloser = role !== "closer"`.
- `<Suspense>` ao redor de `<LeadsView mostrarCloser>` (requerido por `useSearchParams`).

### `/leads/[leadId]`

- `params: Promise<{leadId}>` → `await`.
- `await getServerSession()` → role.
- `<LeadDetailView leadId role={user?.role ?? "closer"} />`.

### `/acoes`

PageHeader "Centro de ações" + `<ActionsView />`.

### `/agenda`

PageHeader "Agenda do dia" + `<AgendaView />`.

### `/gestao`

```
if (!user) redirect("/login")
if (user.role === "closer") redirect("/dashboard")
```

PageHeader "Gestão da operação" + `<ManagementView />`.

### `/configuracoes`

```
if (user.role !== "admin") redirect("/dashboard")
```

Página inteiramente server (com `AuditTrail` client embutido). Estrutura:

1. Aviso âmbar: "Alterações em critérios de score devem ser versionadas..."
2. Grid lg:2:
   - **Critérios de score** (SlidersHorizontal) — 8 linhas com peso textual.
   - **Pesos de temperatura** (Thermometer) — 4 linhas com ícone + faixa.
   - **Regras de SLA** (History) — bullets explicando 3h média, 6h alta, call <1h alta.
   - **Mapeamento de etapas** (GitBranch) — chips de `ETAPAS` separados por seta.
3. Card largura total **Permissões por perfil** (KeyRound) — tabela `NAV_ITEMS × Roles` com check verde / traço.
4. Grid lg:2:
   - **Integrações** (Plug) — n8n, Evolution API, Calendly, Supabase com chip verde "Conectado".
   - **Templates de mensagens** (ScrollText) — Confirmação de call, Retomada de no-show, Primeiro contato.
5. **Auditoria e retenção** (History) — 3 bullets (toda ação gera registro; retenção 90 dias; contato exibido por 120s).
6. `<AuditTrail />`.

### `/login` (público)

`(public)/login/page.tsx`. Cliente, dentro de `<Suspense>` (usa `useSearchParams` para `from`).

Layout:
- Fundo `bg-ink-950`, centralizado.
- Logo Flame em badge vermelho + "Mapa de Calor" + subtítulo.
- Card `bg-ink-900 border border-ink-800`:
  - Título "Escolha uma conta de demonstração".
  - 4 botões (1 por conta) horizontais: iniciais + nome + chip role + descrição + ArrowRight/Loader.
  - Mensagem de erro vermelha se falhar.
  - Rodapé ShieldCheck "Sessão via cookie HttpOnly...".
- Rodapé externo "Ambiente de demonstração — dados fictícios gerados pelo BFF."

Ao clicar: `login(email)` → `router.replace(from || "/dashboard")` + `router.refresh()`.

---

## 15. Fluxos críticos

### Executar ação a partir da fila

1. Closer clica em "Executar ação" no `LeadPriorityCard`.
2. `DashboardView` define `alvo = { item, acao: { tipo: item.proxima_acao_tipo, label, descricao } }`.
3. `ActionExecutionDialog` abre. Usuário confirma (ou cancela).
4. Confirma → `executarAcao(leadId, { tipo, nota?, nova_etapa? })` → BFF audita → toast com selo "Esta ação foi registrada para auditoria".
5. `qc.invalidateQueries({ queryKey: ['dashboard'] })` recarrega cards / heatmap / fila.

Mesmo fluxo aciona-se em:
- Lista de ações (`ActionsView`).
- Lista de agenda (`AgendaView`) via `acaoDaCall`.
- Detalhe do lead → próxima ação (Visão geral) e painel de ações (aba 5).

### Revelar contato

1. Em `Visão geral`, usuário clica "Solicitar exibição de contato".
2. `revelarContato(leadId)` → endpoint POST audita e devolve `{ telefone, email, expira_em: 120, auditoria_id }`.
3. `SensitiveDataGate` substitui o card por um card amarelo, inicia contador regressivo de 120s.
4. Toast "Contato exibido temporariamente, visível por 120s" com selo de auditoria.
5. Contador chega a 0 OU usuário clica "Ocultar agora" → o componente limpa `contato` e volta ao estado bloqueado.

### Filtragem dinâmica da dashboard

- Estado único `filtro: Record<string,string>` em `DashboardView`.
- Cards, células de heatmap e alertas chamam o mesmo `setFiltro(...)`, mantendo só uma fonte ativa por vez (limpam os outros indicadores).
- A `priority` query refaz fetch automaticamente quando `filtro` muda (key inclui o objeto).
- Banner de filtro ativo mostra o que está aplicado e permite limpar.

### Sessão

1. Login → cookie HttpOnly setado pelo servidor.
2. Toda navegação privada passa pelo middleware (presença) + layout (`getServerSession`).
3. `(private)/layout.tsx` redireciona para `/login` se ausente.
4. `/gestao` e `/configuracoes` adicionam verificação de role.
5. Logout limpa cookie e força recarga em `/login`.

---

## 16. Padrões transversais

### Estados de carregamento, vazio e erro

Seguem a seção 20 do spec:

- **Loading**: skeletons; nunca tela branca. Listas mostram N skeletons da altura média do item.
- **Empty**: `EmptyState` com mensagem específica do contexto.
- **Erro**: `ErrorState` com `onRetry` invocando o `refetch` do React Query (exceto 404, que vira mensagem definitiva).
- **Dado desatualizado**: banner âmbar quando `generated_at` mais antigo que 10 min, com botão Atualizar.

### Cache e revalidação (TanStack Query)

`QueryClient` no `Providers`:

```ts
defaultOptions: {
  queries: { staleTime: 30000, gcTime: 5*60000, refetchOnWindowFocus: true, retry: 1 }
}
```

Após mutações (executar ação, concluir ação, revelar contato), invalida `['dashboard']`, `['lead', id]`, `['actions']`, `['agenda']` conforme o caso.

### Acessibilidade

- Foco visível via `:focus-visible` (`ring-ink-900`).
- Cor + ícone + texto em badges.
- `aria-label` em botões de ícone, `aria-modal` em diálogos, `role="status"` em toasts.
- Navegação por teclado preservada (filtros e botões nativos).

### URL como fonte de verdade

Em `/leads`, `filtro` deriva de `useSearchParams`. Topbar.busca, links, cards do dashboard e bookmarks usam o mesmo schema de query.

### Camadas de validação

- Entrada: Zod nos route handlers (`bodySchema.safeParse`).
- Saída: `assertSemPII` em payloads safe.
- Cliente: schemas Zod no `bffClient.request` validam todas as respostas.

---

## 17. Mensagens (microcopy)

Tom direto, sem ornamento. Exemplos vivos no código:

- "Ação recomendada: chamar agora"
- "Esta ação será registrada para auditoria."
- "Contato exibido temporariamente — visível por 120s."
- "Última atualização há 22 minutos. Alguns scores podem estar desatualizados."
- "Nenhum lead crítico agora. A fila está limpa para este filtro."
- "Não foi possível carregar a fila de prioridade. Tente novamente ou acione o suporte interno."

---

## 18. Tokens de espaçamento e raio recorrentes

| Uso | Classe |
|---|---|
| Padding de card | `p-3` (compactos) / `p-4` (padrão) |
| Padding de header de card | `px-4 py-3` |
| Gap vertical de seção | `gap-4` |
| Gap de grade de cards | `gap-3` |
| Raio padrão | `rounded-xl` (cards), `rounded-lg` (sub-componentes), `rounded-md` (badges/inputs) |
| Altura de input/select/botão md | `h-9` (inputs) · `h-10` (botões md) · `h-8` (sm) |
| Bordas | `border-slate-200` (padrão), `border-slate-100` (interno) |
| Linha sutil | `divide-slate-100` |

---

## 19. Como rodar / estender

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start
```

### Trocar mock por backend real

1. Substituir `src/lib/mock/data.ts` por chamadas ao Supabase (mantendo `leadsNoEscopo` / `getLeadRecord` / projeções `toPriorityItem` e `toLeadDetailSafe` ou equivalente).
2. Substituir `src/lib/mock/users.ts` por integração com o provider de auth real (Supabase Auth, NextAuth, etc.).
3. Substituir `src/lib/mock/store.ts` por tabelas reais de auditoria e ações.
4. Os contratos em `src/lib/api/contracts.ts` e tudo a jusante permanecem.

### Adicionar novo endpoint

1. Definir schema Zod em `contracts.ts` (request/response).
2. Criar route handler em `src/app/api/.../route.ts` com `requireSession` + escopo + `jsonSeguro`.
3. Adicionar função tipada em `bffClient.ts` (`request(path, schema, init)`).
4. Consumir com `useQuery` no componente feature.

### Adicionar um novo card do dashboard

1. Aumentar `cards` em `src/app/api/dashboard/summary/route.ts` com `{ id, label, valor, filtro, destaque, variacao, tendencia }`.
2. Se o filtro não existir em `filtrarLeads`, adicioná-lo lá.
3. O `DashboardView` automaticamente aplicará o filtro à fila ao clicar.

### Adicionar nova ação

1. Acrescentar `tipo` no `bodySchema` de `/api/leads/[leadId]/actions/route.ts` e em `LABEL`.
2. Atualizar ACOES de `LeadActionsPanel.tsx` com `{ tipo, label, descricao, icon, auditada, soGestao? }`.
3. Se o tipo precisar de campo extra, refletir em `ActionExecutionDialog` (ex.: nota/etapa).

---

## 20. Inventário rápido de arquivos por responsabilidade

| Responsabilidade | Arquivo |
|---|---|
| Tema visual | `tailwind.config.ts`, `globals.css`, `formatters/score.ts` |
| Tipos do domínio | `lib/api/contracts.ts` |
| Acesso ao BFF | `lib/api/bffClient.ts` |
| Helpers de servidor | `lib/api/server.ts` |
| Sessão | `lib/auth/session.ts`, `middleware.ts`, `app/(private)/layout.tsx`, `app/(public)/login/page.tsx` |
| Permissões e navegação | `lib/auth/permissions.ts`, `components/layout/Sidebar.tsx` |
| Dados (mock) | `lib/mock/data.ts`, `users.ts`, `filters.ts`, `store.ts` |
| Segurança PII | `lib/security/piiGuards.ts`, endpoint `reveal-contact`, `SensitiveDataGate` |
| Heatmap | `components/domain/HeatmapGrid.tsx`, `HeatmapCell.tsx`, `features/dashboard/DashboardHeatmapSection.tsx` |
| Fila recomendada | `components/domain/PriorityQueue.tsx`, `LeadPriorityCard.tsx` |
| Cards de resumo | `features/dashboard/DashboardSummaryCards.tsx` |
| Alertas operacionais | `features/dashboard/DashboardAlerts.tsx` |
| Listagem de leads | `features/leads/LeadFilters.tsx`, `LeadTable.tsx`, `LeadsView.tsx` |
| Detalhe do lead | `features/leads/LeadDetail*.tsx`, `domain/LeadTimeline.tsx`, `LeadScoreBreakdown.tsx`, `SensitiveDataGate.tsx` |
| Diálogo de ação | `features/actions/ActionExecutionDialog.tsx` |
| Centro de ações | `features/actions/ActionList.tsx`, `ActionsView.tsx` |
| Agenda | `features/agenda/*.tsx` |
| Gestão | `features/management/*.tsx` |
| Toasts | `components/ui/Toast.tsx` |

---

## 21. Resumo das regras de cor e ícones por temperatura

| Temp. | Cor base | Tailwind | Ícone | Quando usar |
|---|---|---|---|---|
| Muito quente | `#dc2626` | `muito` | Flame | Score 90+, ação imediata |
| Quente | `#ea580c` | `quente` | ThermometerSun | Score 75–89, priorizar no dia |
| Morno | `#d97706` | `morno` | Sun | Score 50–74, nutrir/acompanhar |
| Frio | `#2563eb` | `frio` | Snowflake | Score 0–49, baixa prioridade |

Cada token (`bg-muito`, `text-muito`, `bg-muito-soft`, `text-muito-ink`, `border-muito/30`) é equivalente para os quatro tokens.

---

## 22. Checklist para reconstruir uma versão equivalente

- [ ] Setup Next.js 15 + TS + Tailwind + TanStack + Zod.
- [ ] Definir tokens de cor (frio/morno/quente/muito + ink).
- [ ] Implementar `contracts.ts` Zod completos.
- [ ] Camada de mock determinística (LEADS, projeções, filtros, store).
- [ ] Sessão em cookie HttpOnly + middleware + login.
- [ ] Route handlers do BFF com `requireSession`, escopo por closer e `assertSemPII`.
- [ ] UI primitives (Button, Card, Badge, Skeleton, Table, Dialog, Drawer, Toast, States).
- [ ] Layout (AppShell + Sidebar + Topbar + PageHeader) com navegação por role.
- [ ] Componentes de domínio (TemperatureBadge, LeadScoreBadge, AlertBadge, NextActionButton, HeatmapGrid+Cell, PriorityQueue+Card, Timeline, ScoreBreakdown, SensitiveDataGate).
- [ ] Dashboard (cards + heatmap + queue + alertas + dialog de ação).
- [ ] Lista de leads com URL como fonte de verdade.
- [ ] Detalhe com 5 abas (geral, score, comercial, timeline, ações).
- [ ] Centro de ações com 5 filtros e fluxo de conclusão.
- [ ] Agenda do dia com risco de no-show.
- [ ] Gestão (metricas + tabela de closer + auditoria) restrita.
- [ ] Configurações (8 seções) restrita ao admin.
- [ ] Estados de loading/empty/error em todos os fetches.
- [ ] Toasts com selo de auditoria.

Esses 22 itens cobrem 100% da implementação atual.
