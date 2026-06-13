# Documentação Completa — Dashboard de Produtividade SDR (Vata Dojo)

> Documento gerado em 11/06/2026. Descreve em detalhes todas as funcionalidades, recursos, visões, regras de negócio, arquitetura e estrutura do projeto.

---

## 1. Visão Geral

O projeto é uma **dashboard de produtividade da equipe de Pré-Venda (SDRs) da Vata Dojo**. Ele acompanha o desempenho dos SDRs (Sales Development Representatives) em relação a calls agendadas, realizadas, no-show, produtos ofertados e metas escalonadas de leads qualificados, além de oferecer uma visão gerencial para a liderança de pré-venda com métricas de marketing, comparecimento e relação SDR × Closer.

O sistema é composto por:

| Camada | Tecnologia | Papel |
|---|---|---|
| **Frontend** | React 18 + Vite 5 + Recharts + Lucide Icons | SPA que consome a API externa, calcula métricas no cliente e renderiza a dashboard |
| **API externa (produção)** | `https://api.infradojo.pro/dashboard_comercial` | Fonte de dados real consumida pelo frontend (dados agregados de SDR, Closer e Marketing) |
| **Backend local (legado/alternativo)** | FastAPI + pandas + gspread (pasta `backend/`) | API que lê diretamente o Google Sheets e monta o dataset da dashboard — usado em desenvolvimento/versões anteriores |
| **Repositório de referência** | `_reference_repo/` | Cópia do projeto `dashboard_comercial` (ETL + API + PostgreSQL) que serve de base para as regras de tratamento dos dados |

**Idioma:** toda a interface é em português brasileiro (pt-BR).

**Pessoas acompanhadas:**
- **SDRs:** Glaucio, Delrue, Benhur e Hana (Fernanda existiu e foi removida da exibição).
- **Closers:** dinâmicos, vindos da API (ex.: Giba/Gilberto, normalizados para "Giba").

---

## 2. Estrutura do Projeto

```
v1/
├── .env                      # Variáveis de ambiente (Sheets, PostgreSQL, API keys, frontend)
├── index.html                # Entrada HTML (título "Dashboard SDR | Vata Dojo", favicon SVG)
├── package.json              # Scripts e dependências do frontend
├── vite.config.js            # Configuração do Vite (apenas plugin React)
├── public/
│   └── favicon.svg
├── src/                      # FRONTEND React
│   ├── main.jsx              # Bootstrap (ReactDOM + StrictMode + global.css)
│   ├── App.jsx               # Componente raiz: carregamento, abas, ordenação, estados
│   ├── layout/
│   │   └── Header.jsx        # Cabeçalho + filtro de mês
│   ├── components/
│   │   ├── KPIGrid.jsx       # Grade de KPIs agregados do mês
│   │   ├── SDRCard.jsx       # Card individual por SDR
│   │   ├── ChartsPanel.jsx   # 3 gráficos (Recharts)
│   │   ├── InsightsPanel.jsx # Lista de insights automáticos
│   │   ├── PerformanceTable.jsx # Tabela detalhada por SDR
│   │   └── LeadershipPanel.jsx  # Aba "Liderança Pré-venda" completa
│   ├── services/
│   │   └── dashboardApi.js   # Cliente da API externa + TODA a lógica de agregação
│   ├── utils/
│   │   └── metrics.js        # Totais agregados, insights e classes de status
│   ├── data/
│   │   └── dashboardData.js  # Dados estáticos de exemplo (mock, não usado em produção)
│   └── styles/
│       └── global.css        # Tema dark completo da aplicação
├── backend/                  # BACKEND FastAPI (leitura direta do Google Sheets)
│   ├── README.md
│   ├── requirements.txt      # fastapi, uvicorn, pandas, gspread, google-auth, python-dotenv
│   └── src/
│       ├── api.py            # FastAPI: /api/health e /api/dashboard/sdr
│       ├── config.py         # Variáveis de ambiente, produtos, metas e aliases de SDR
│       ├── sheets.py         # Autenticação Service Account + leitura da planilha por GID
│       ├── transform.py      # Normalização de colunas, datas, flags e produtos
│       └── dashboard_metrics.py # Montagem do payload mensal por SDR
└── _reference_repo/          # Projeto "dashboard_comercial" de referência (ETL + PostgreSQL + API)
```

---

## 3. Como Executar

Scripts do `package.json`:

| Script | Comando | Descrição |
|---|---|---|
| `npm run dev` | `vite` | Sobe o frontend em modo desenvolvimento |
| `npm run build` | `vite build` | Build de produção (gera `dist/`) |
| `npm run preview` | `vite preview` | Serve o build de produção localmente |
| `npm run api:install` | `pip install -r backend/requirements.txt` | Instala dependências do backend Python |
| `npm run api:dev` | `uvicorn src.api:app --app-dir backend --host 0.0.0.0 --port 8000 --reload` | Sobe o backend FastAPI local na porta 8000 |

### Variáveis de ambiente (`.env`)

| Grupo | Variável | Uso |
|---|---|---|
| Google Sheets | `GOOGLE_SHEET_ID` | ID da planilha de origem (backend) |
| Google Sheets | `GOOGLE_SHEET_GID` | GID da aba da planilha (backend) |
| Google Sheets | `GOOGLE_CREDENTIALS_JSON` | JSON da Service Account inline (alternativa: `GOOGLE_CREDENTIALS_PATH`, default `./credentials.json`) |
| PostgreSQL | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Banco usado pelo projeto de referência (ETL) |
| API | `API_KEYS` | Chaves aceitas pela API (múltiplas separadas por vírgula) |
| Frontend | `VITE_API_BASE_URL` | URL base da API externa (default: `https://api.infradojo.pro/dashboard_comercial`) |
| Frontend | `VITE_API_KEY` (ou `VITE_DASHBOARD_API_KEY`) | Chave de autenticação enviada nas requisições |
| Frontend | `VITE_API_AUTH_MODE` | `auto` (default, envia `X-API-Key` **e** `Authorization: Bearer`), `bearer` ou `x-api-key` |

---

## 4. Fluxo de Dados

```
Google Sheets (planilha comercial)
        │
        ▼
ETL dashboard_comercial (a cada 30 min, incremental últimos 10 dias)  [projeto de referência]
        │
        ▼
PostgreSQL ──▶ API REST (api.infradojo.pro/dashboard_comercial)
        │
        ▼
Frontend React (dashboardApi.js)
  ├── fetchDashboardData()   → aba "Dashboard SDR"
  └── fetchLeadershipData()  → aba "Liderança Pré-venda"
```

### Endpoints consumidos pelo frontend

**Aba SDR (5 endpoints):**
- `GET /api/sdr/agendadas` — total de calls agendadas por SDR/dia
- `GET /api/sdr/realizadas` — total de calls realizadas por SDR/dia
- `GET /api/sdr/no-show` — total de no-shows por SDR/dia
- `GET /api/sdr/por-produto` — calls realizadas por SDR/dia/produto
- `GET /api/sdr/remarcadas` — total de calls remarcadas por SDR/dia

**Aba Liderança (12 endpoints — os 5 acima mais):**
- `GET /api/marketing/leads` — leads que entraram (por dia)
- `GET /api/marketing/qualificados` — leads qualificados pelo marketing (com qualificação)
- `GET /api/closer/agendadas`, `/api/closer/realizadas`, `/api/closer/no-show`, `/api/closer/por-produto`, `/api/closer/remarcadas` — equivalentes para Closers

**Autenticação:** cabeçalhos montados por `buildHeaders()` conforme `VITE_API_AUTH_MODE`. Em caso de 401/403 sem chave configurada, a mensagem de erro orienta a configurar `VITE_API_KEY`.

**Tratamento de falha:** as duas cargas (`fetchDashboardData` e `fetchLeadershipData`) são feitas com `Promise.allSettled`. Se a carga SDR falha, a tela inteira mostra erro; se apenas a de liderança falha, a aba SDR continua funcionando e a aba Liderança mostra a mensagem de erro específica.

---

## 5. Regras de Negócio (Coração do Sistema)

### 5.1 Identificação de pessoas (aliases)

- **SDRs** — normalização case-insensitive com busca por substring:
  - `glaucio` → **Glaucio**
  - `delrue` → **Delrue**
  - `ben` / `benhur` → **Benhur**
  - `hana` → **Hana**
  - Nomes que não casam com nenhum alias são descartados (não entram na dashboard).
- **Closers** — `giba`/`gilberto` → **Giba**; demais nomes mantidos como vieram.
- **Regra de liderança para agendamentos compartilhados:** quando o campo de SDR contém mais de um nome separado por `/ | , & ; +` e um deles é a Hana, a call conta **apenas para o outro SDR** (Hana é apoio).

### 5.2 Produtos

Cinco produtos canônicos, detectados por substring no nome (sem acento, case-insensitive):

| Chave interna | Rótulo | Conta como qualificado? |
|---|---|---|
| `quebrandoCodigo` | Quebrando Código (QC) | Não diretamente — gera **bônus** |
| `ninja` | Ninja | ✅ Sim ("Ninja+") |
| `black` | Black | ✅ Sim |
| `prime` | Prime | ✅ Sim |
| `private` | Private | ✅ Sim |

### 5.3 Leads Qualificados e Bônus QC

```
leadsQualificadas = leadsQualificadasBase + bonusQuebrando
  onde:
  leadsQualificadasBase = Σ calls realizadas com produto Ninja, Black, Prime ou Private
  bonusQuebrando        = floor(total de QC realizadas / 3)   ← "a cada 3 QC, +1 qualificado"
```

### 5.4 Metas escalonadas (individuais)

Cada SDR com meta possui **3 estágios**: `[40, 50, 60]` (Glaucio, Delrue e Benhur; **Hana não tem meta** — `meta: null`).

- **Meta atual** = primeiro estágio ainda não batido (ou o último, se todos batidos).
- **Nível atual** (M1/M2/M3) e **metas batidas** são exibidos no card e na tabela.
- **Gap p/ Meta** = `max(metaAtual − leadsQualificadas, 0)`.

### 5.5 Metas da equipe (liderança)

Três estágios para a equipe inteira no mês: **`[150, 188, 225]`** reuniões qualificadas. O total da equipe usa a mesma regra individual (Ninja+ + bônus QC por SDR, somado).

### 5.6 Contabilização por mês

**Regra exibida no rodapé da dashboard:** *"contabilização pelo mês da data da call, não pela data de agendamento"*. No backend local isso é implementado com a `data_call_efetiva`:

```
data_call_efetiva = data_call_remarcada  (se Remarcou == "Sim" e a data remarcada existe)
                  = data_call            (caso contrário)
```

No frontend, a chave de mês (`YYYY-MM`) vem de `data_referencia` (ou `data`, `date`, `data_call`, `created_at`, nessa ordem de prioridade).

### 5.7 No Show

- **Por SDR:** `noShow% = (noShowCount / callsAgendadas) × 100` (1 casa decimal).
- **No Show Médio (KPI geral):** média **ponderada** pelas calls agendadas de cada SDR.
- Classificação visual: `< 12%` verde (bom), `12–20%` amarelo (atenção), `> 20%` vermelho (perigo).

### 5.8 Comparecimento (liderança)

- **Agendadas (até hoje):** apenas calls com data ≤ hoje entram na base (futuras não contam).
- **Ocorridas:** linhas de `/sdr/realizadas` com `status_call` contendo "realizada" (ou sem o campo) e data ≤ hoje.
- **No Show:** linhas de `/sdr/no-show` com flag verdadeira ("sim", "true", "yes", "1") ou sem o campo, e data ≤ hoje.
- **Taxa de comparecimento** = `ocorridas / agendadas (até hoje) × 100`.

### 5.9 Funil de marketing (liderança)

- **Leads que entraram** = soma de `/marketing/leads` (campos `total_leads | leads | quantidade | total`; se a linha não tem campo agregado, cada linha conta 1).
- **Leads qualificados** = soma de `/marketing/qualificados` (todo lead deste endpoint é considerado qualificado).
- **Leads desqualificados** = `max(entraram − qualificados, 0)`.
- **Tradução de qualificação** para nome de produto/perfil:

| Valor na origem | Exibido como |
|---|---|
| sem qualificacao | Masterclass |
| qualificado qc | QC |
| possivel ninja | QC/Ninja |
| mql | Ninja |
| mql+ | Black |
| smql | Prime |
| hmql | Prime/Private |
| umql | Private |
| (outros) | valor original / "Nao informado" |

### 5.10 Relação SDR × Closer (estimativa)

A API não fornece o vínculo direto SDR→Closer, então o frontend **estima**:

1. Monta mapas diários: agendadas por SDR e agendadas por Closer no mesmo dia.
2. Distribui as calls de cada SDR **proporcionalmente** à participação de cada Closer naquele dia.
3. Se não há Closer no dia, tudo vai para a coluna **"Sem Closer"**.
4. Arredondamento com método de **maiores restos** (`allocateIntegersWithTarget`) para que a soma por SDR bata exatamente com o total real de calls do SDR.

### 5.11 Semana do mês

`weekOfMonth = floor((dia + diaDaSemanaDoPrimeiroDia − 1) / 7) + 1` — semanas "de calendário" dentro do mês. O seletor da liderança oferece "Mes inteiro" (agregado via `mergeWeeks`) ou cada semana individual.

### 5.12 Ordenação e exibição de SDRs

- Ordem fixa: **Glaucio, Delrue, Benhur, Hana** (desconhecidos vão para o fim, em ordem alfabética pt-BR).
- **Fernanda é filtrada/removida** da exibição (`App.jsx`).
- O grid de cards adapta o layout para 4 ou 5 SDRs (classes `sdr-grid--four` / `sdr-grid--five`).

### 5.13 Mês padrão ao abrir

Ao carregar, a dashboard tenta abrir no **mês corrente** (`YYYY-MM` de hoje); se não houver dados para ele, cai para o **último mês disponível**. Na liderança, o padrão é o mês mais recente (opções ordenadas decrescentemente).

---

## 6. Visões / Telas

A aplicação é uma única página com **duas abas**, mais estados de carregamento/erro/vazio.

### 6.1 Estados globais

- **Carregando:** card "Carregando dados da API...".
- **Erro:** card "Falha ao carregar dados da API: {mensagem}".
- **Sem dados:** card "Nenhum dado disponível para exibição.".

### 6.2 Cabeçalho (sempre visível)

- Marca "Vata Dojo" (ícone de lua) + título **"Dashboard de Produtividade SDR"**.
- Rótulo do período selecionado (ex.: "01/06/2026 a 30/06/2026").
- **Filtro por mês** (select) — "Filtrar por mês (data da call)" com todos os meses disponíveis na API.

### 6.3 Grade de KPIs (sempre visível, dados do mês selecionado)

9 cartões agregados de todos os SDRs exibidos:

1. **Calls Agendadas (Total)**
2. **Calls Realizadas (Total)**
3. **Leads Qualificados (Total)** — base + bônus
4. **No Show (Total)** — contagem absoluta
5. **Quebrando Código (Reuniões)** — total de QC
6. **Bônus Quebrando (+1/3)** — bônus acumulado
7. **Gap Consolidado** — soma dos gaps individuais
8. **No Show Médio** — % ponderado
9. **Taxa de Qualificação** — `qualificados / realizadas × 100`

(Também são calculados, mas não exibidos como KPI: taxa de realização e totais por produto.)

### 6.4 Aba "Dashboard SDR"

#### a) Cards por SDR (`SDRCard`)
Um card por SDR com:
- Nome + nota de progresso de metas ("M1 batida", "M1/M2 batidas", "M1/M2/M3 batidas").
- Pill da meta atual ("Meta 2: 50") ou "Sem meta" (Hana).
- Métricas: Calls Agendadas; Calls Realizadas; **Leads Qualificados (base + bônus QC)** no formato `total (base+bônus)`; Bônus QC; resumo de produtos (`QC | Ninja | Black | Prime | Private`); **Gap p/ Meta** (verde ≤1, amarelo ≤2, vermelho >2); **No Show** `contagem (percentual%)` com cor por faixa.

#### b) Gráficos (`ChartsPanel`, Recharts)
1. **Funil de Conversão por SDR** — barras agrupadas: Agendadas (azul), Realizadas (teal), Qualificadas (laranja).
2. **Taxa de No Show por SDR** — barras (rosa), eixo em %, tooltip mostra `contagem (percentual%)`.
3. **Atingimento de Meta e Gap** (largura total) — composto: barras Meta (azul) e Qualificadas (verde) + área Gap (laranja).

#### c) Insights do Mês (`InsightsPanel` + `getInsights`)
Lista gerada automaticamente, com 3 tipos (marcador colorido): **risco**, **destaque**, **ação**:
- Risco: SDR com no-show ≥ 20%.
- Destaque: SDR mais próximo da meta (menor gap).
- Destaque: líder em leads qualificados (se > 0).
- Destaque: melhor eficiência de qualificação (qualificados/realizadas, mínimo 5 calls realizadas).
- Ação: SDR com taxa de realização < 70% (mínimo 5 agendadas) — sugere reforçar confirmação pré-call.
- Ação: SDR a 1 ou 2 QC do próximo bônus.
- Ação/Destaque: taxa de realização geral < 80% (alerta) ou ≥ 80% ("operação saudável").

#### d) Visão Detalhada por SDR (`PerformanceTable`)
Tabela com colunas: SDR, Meta, Estágio (M1/M2/M3), Calls Agendadas, Calls Realizadas, QC, Ninja, Black, Prime, Private, Bônus QC, Leads Qualificados, Gap p/ Meta (com cor), No Show `contagem (%)` (com cor).

#### e) Rodapé
Nota fixa: "Regra aplicada: contabilização pelo mês da data da call, não pela data de agendamento."

### 6.5 Aba "Liderança Pré-venda" (`LeadershipPanel`)

#### a) Filtros próprios
- **Mês** (independente do filtro do topo) — default: mês mais recente.
- **Semana do mês** — "Mes inteiro" (default) ou Semana 1..N. Tudo abaixo (exceto métricas da equipe) respeita esse recorte.

#### b) KPIs da liderança (6 cartões)
1. **Leads que entraram** (marketing)
2. **Leads qualificados** (marketing)
3. **Leads desqualificados** (entraram − qualificados)
4. **Ocorridas** (reuniões realizadas no recorte)
5. **No Show** (total no recorte)
6. **Taxa de comparecimento (geral)** — `ocorridas / agendadas até hoje`

#### c) Comparecimento por SDR (tabela)
Por SDR: Agendadas (até hoje), Ocorridas, No Show, % de Comparecimento. Linha de fallback quando não há dados.

#### d) Produtos no Recorte (tabela)
Distribuição dos leads qualificados do marketing por produto/perfil (já traduzidos — Masterclass, QC, Ninja, Black, Prime, Private etc.), ordenada por quantidade decrescente.

#### e) Relação SDR × Closer — Calls Marcadas (matriz)
Linhas = SDRs; colunas = Closers (+ "Sem Closer" quando aplicável) + Total por SDR. Mostra o total de calls marcadas no recorte e nota explicando o método (distribuição proporcional por dia com arredondamento por SDR).

#### f) Métricas da Equipe (Mês) — *sempre do mês inteiro, ignora o filtro de semana*
- **Reuniões qualificadas no mês** (soma da equipe, mesma regra Ninja+ + bônus QC).
- **Meta atual da equipe** (150 → 188 → 225).
- **Barras de progresso** das 3 metas: preenchimento %, verde quando batida, destaque na meta atual, "Faltam X" quando pendente.
- **Tabela-resumo**: Meta, Objetivo, Realizado (mês), Status (Batida / Faltam X).

#### g) Erro isolado
Se a carga da liderança falhar, apenas esta aba mostra "Falha ao carregar dados da lideranca: {mensagem}".

---

## 7. Backend Local (FastAPI — `backend/`)

API alternativa que lê o Google Sheets **diretamente** (sem PostgreSQL), com as regras herdadas do `dashboard_comercial`:

### Endpoints
- `GET /api/health` → `{"status": "ok"}`
- `GET /api/dashboard/sdr` → `{ months: [...], dashboardData: { "YYYY-MM": { label, periodLabel, sdrs: [...] } } }`

CORS liberado para qualquer origem (somente GET). Erros viram HTTP 500 com detalhe da exceção.

### Pipeline interno
1. **`sheets.py`** — autentica com Service Account (JSON inline via `GOOGLE_CREDENTIALS_JSON` — com saneamento de e-mails colados como `[mailto:...]` e URLs com colchetes — ou arquivo via `GOOGLE_CREDENTIALS_PATH`), abre a planilha por `GOOGLE_SHEET_ID`, localiza a aba pelo `GOOGLE_SHEET_GID` e retorna um DataFrame.
2. **`transform.py`** — renomeia colunas (mapeia variantes com encoding quebrado, ex.: `MÃªs`, `HorÃ¡rio Call`), garante todas as colunas, converte datas `DD/MM/YYYY`, cria flags `is_realizada` (Status Call == "realizada") e `is_no_show` (No Show == "sim"), extrai lista de produtos por substring e calcula `data_call_efetiva` (remarcação).
3. **`dashboard_metrics.py`** — filtra SDRs canônicos (apenas Glaucio/Delrue/Benhur, meta fixa 40), agrupa por mês da `data_call_efetiva` e monta por SDR: `callsAgendadas`, `callsRealizadas`, `callsRealizar` (não realizadas com data ≥ hoje), `leadsQualificadas` (realizadas com produto Ninja+ — **sem bônus QC nesta versão**), `gapMeta`, `noShow` (%). Labels de mês em pt-BR.

> **Nota:** este backend é uma versão mais simples/antiga das regras — o frontend em produção usa a API externa e implementa as regras mais recentes (metas escalonadas, bônus QC, Hana, liderança) no cliente.

### Colunas esperadas da planilha de origem
Mês, Data, SDR, Funil, Data do Evento, E-mail Cliente, Nome Cliente, Número, Closer, Data Call, Horário Call, Status Call, No Show, Remarcou, Data Call Remarcada, Horário Call Remarcada, Produto ofertado.

---

## 8. Repositório de Referência (`_reference_repo/`)

Cópia do projeto **dashboard_comercial** (ETL + API). Características:
- ETL executado via cron a cada 30 minutos, atualização **incremental dos últimos 10 dias** (DELETE + INSERT no PostgreSQL).
- Pipeline: `sheets.py → transform.py → metrics.py → database.py`, com log de execução.
- API FastAPI que **não calcula nada** — apenas filtra e entrega dados já agregados do PostgreSQL (ex.: `GET /api/sdr/agendadas?periodo=semanal`).
- Contém `sql/create_tables.sql` (DDL das tabelas) e `.env.example`.
- É a implementação que está por trás da API externa `api.infradojo.pro/dashboard_comercial` consumida pelo frontend.

---

## 9. Design / Estilo (global.css)

- **Tema dark** corporativo: fundo `#0b1322`/`#131d30`, cards com borda `#30415f`, texto `#e5eefc`, secundário `#93a4c3`.
- Paleta funcional: azul `#5691ff`/`#3b82f6` (agendadas/meta), teal `#2dd4bf` (realizadas), laranja `#f59e0b` (qualificadas/gap), verde `#22c55e` (atingido), rosa `#fb7185` (no-show).
- Classes de status semânticas: `is-good` (verde), `is-warning` (amarelo), `is-danger` (vermelho).
- Componentes estilizados: cards, pills de meta, grade de KPIs, abas (`tab-btn` com estado `is-active`), tabelas com wrapper rolável (`table-wrap`), barras de progresso das metas da equipe (`team-target-*`), grids responsivos para 4/5 SDRs.
- Ícones: **lucide-react** (CalendarDays, PhoneCall, Target, UserCheck2, UserX, Percent, Sparkles, BookOpenCheck, MoonStar, Lightbulb, BarChart3, Filter, Users, Boxes etc.).
- Gráficos: **Recharts 2** (BarChart, ComposedChart com Area, ResponsiveContainer, tooltips customizados no tema dark).

---

## 10. Detalhes Técnicos Relevantes

- **Parsing de datas robusto** (`parseDate`): aceita `DD/MM/YYYY` e `YYYY-MM-DD`/ISO, com proteção contra deslocamento de fuso horário em datas ISO puras.
- **Leitura tolerante de payloads** (`pickNumber`, `countFromRow`, `dateRef`, `sdrNameFromRow`, `sellerFromRow`): cada métrica aceita múltiplos nomes de campo; linhas sem campo agregado contam como 1.
- **`callsRealizar`** existe no modelo (calls futuras pendentes) mas atualmente fica 0 no fluxo da API externa (calculado apenas no backend local).
- **`inferOpportunityType`** (oportunidade real / fora do perfil / não classificado) existe no código mas não é usado na UI atual — a classificação de leads passou a ser `qualificados` vs `leads − qualificados`.
- **`src/data/dashboardData.js`** é um mock estático (Janeiro/2026) remanescente — a aplicação real carrega tudo da API.
- **Memoização** (`useMemo`) para ordenação de SDRs, totais, insights, agregado do mês e métricas da equipe.
- **Histórico recente (git):** remoção da Fernanda da dash; abertura no mês atual; correção dos dados de comparecimento; mais dados de liderança; ajuste do bônus QC.

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **SDR** | Sales Development Representative — pré-vendedor que agenda e realiza calls de qualificação |
| **Closer** | Vendedor que recebe a call marcada pelo SDR para fechar a venda |
| **Call Agendada** | Reunião marcada pelo SDR |
| **Call Realizada** | Reunião que aconteceu (Status Call = "Realizada") |
| **No Show** | Lead que não compareceu à call (No Show = "Sim") |
| **Remarcada** | Call que teve a data alterada — conta no mês da nova data |
| **QC** | Produto "Quebrando Código" — não qualifica direto, gera bônus a cada 3 |
| **Ninja+** | Conjunto de produtos que qualificam: Ninja, Black, Prime, Private |
| **Lead Qualificado** | Call realizada com produto Ninja+ (+ bônus de QC) |
| **Gap** | Quanto falta para a meta atual |
| **Meta escalonada** | Sequência de metas M1/M2/M3 (individual: 40/50/60; equipe: 150/188/225) |
| **Recorte** | Período selecionado na liderança (semana específica ou mês inteiro) |
