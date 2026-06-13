# Mapa de Calor — Roadmap do Frontend

Roadmap para construir a dashboard (Next.js) em cima do **backend real** (Etapas 1–7) e subir na **Vercel**. Usa o protótipo `referencia-frontend.md` como base **visual e estrutural** — mas corrige onde ele diverge do que foi de fato construído.

Versão: 1.2 — junho/2026 (iteração pós-primeira versão: dashboard interativo, Sales Ops, Produtividade SDR, paleta unificada)

---

## PARTE 1 — O que o backend real oferece (o cardápio do front)

### 1.1 As duas rotas de leitura que JÁ existem

| Rota | O que devolve | Uso no front |
|---|---|---|
| `GET /api/me` | `id, nome, email, role` (admin/closer/sdr) | Desenhar a tela por papel; montar o menu |
| `GET /api/leads` | Lista de leads **já filtrada por papel** (admin: todos; closer: os dele; SDR: os dele + pool da Hana) e **só `visivel_ranking=true`** | A fila de prioridade / ranking |

Autenticação: o front faz login no **Supabase Auth** (e-mail/senha), recebe o crachá (JWT) e o manda no cabeçalho `Authorization: Bearer <token>` em toda chamada. CORS já configurado via `FRONT_ORIGIN`.

> **Não existe BFF próprio no front.** A API Fastify É o backend. O protótipo tinha route handlers fazendo papel de servidor — no real, o front chama a API direto (client-side com o token, ou via route handlers finos que só repassam — decisão de implementação, mas a regra mora na API).

### 1.2 Os dados que cada lead carrega (calculados pelo motor)

| Campo | O que é |
|---|---|
| `score_final` (0–100) + `score_bruto` | A nota. Bruto = antes das travas. |
| `temperatura` | **6 níveis**: muito_quente (90–100), quente (75–89), morno_alto (60–74), morno_baixo (45–59), frio (30–44), congelado (0–29) |
| `etapa_atual` | **12 etapas** do funil (enum real): 1a_call_agendada, no_show_1a, em_atendimento, 2a_call_agendada, 3a_call_agendada, 4a_call_agendada, 5a_mais_call_agendada, no-show, fup_pos_pitch, fup_infinito_perdido, blacklist, fechado — pode ser **nula** (lead recém-criado por análise) |
| `score_momento/fit/urgencia/engajamento/timing` | Os 5 blocos (tetos 25/20/25/20/10) — o breakdown REAL da nota |
| `trava_aplicada` + `score_breakdown` (jsonb) | Qual teto agiu e o detalhe completo do cálculo |
| `motivo_curto` | Por que o lead está nessa posição (template do motor) |
| `proxima_acao` | O que fazer agora (template; alerta > etapa) |
| `alertas[]` | Ex.: 2 no-shows, cônjuge/sócio, parado, 3 no-shows |
| `nome_exibicao`, `tier_final`, `produto_sugerido` | Identificação e fit |
| `closer_id`, `sdr_id`, `sdr_pool` | Donos (pool = lead da Hana, visível a todos os SDRs) |
| `score_calculated_at` | Quando a nota foi calculada (p/ banner "desatualizado") |

Tabelas de apoio (precisam de endpoint novo p/ o front ver): `lead_events` (o filme/timeline), `lead_sdr_analysis` e `lead_call_analysis` (resumo_curto, sinais_positivos/risco), `lead_score_history` (auditoria do score — hoje só backend).

### 1.3 O que o GET /api/leads NÃO devolve (de propósito)

Telefone, e-mail, renda, patrimônio e aporte ficam **fora** da listagem (decisão da Etapa 3 — lista enxuta, sem dado sensível). O detalhe do lead e a exibição de contato são endpoints a criar (Parte 3).

---

## PARTE 2 — As visões por papel (todas as visões possíveis)

A regra de visibilidade já está pronta no backend (API + RLS idênticos). O front só desenha por cima.

### 2.1 Visão do CLOSER (Marcio, Giba, Aurelio)
Vê **apenas os leads dele** (`closer_id = ele`). Telas:
- **Fila de prioridade** (a principal): leads ordenados por score, com temperatura, motivo curto, próxima ação e alertas. É a "mesa de decisão" — quem atender primeiro.
- **Detalhe do lead**: nota e os 5 blocos (por que essa nota), travas/alertas ativos, timeline (o filme), resumo das análises (SDR e call mais recente), dados financeiros/produto.
- **Mapa de calor** (grade etapa × temperatura): onde a carteira dele está concentrada.

### 2.2 Visão do SDR (Benhur, Guilherme, Glaucio) — NÃO existia no protótipo
Vê **os leads dele + o pool da Hana** (`sdr_id = ele OU sdr_pool = true`). O SDR acompanha o que agendou do início até venda/perda. Foco diferente do closer:
- **Fila dos meus agendados**: como os leads que ele mandou estão evoluindo (etapa, temperatura).
- **Recuperação**: leads em no-show (com/sem remarcação) e congelados/parados — onde o SDR atua para reaquecer.
- **Pool da Hana**: leads da IA agendadora, visíveis a todos os SDRs (com indicação de origem Hana).

### 2.3 Visão do ADMIN (Vata, Cindy, Jonas)
Vê **tudo**. Mesmas telas do closer/SDR sem filtro de dono, mais:
- **Visão geral da operação**: distribuição por temperatura/etapa, score médio, leads parados, no-shows.
- **Filtro por closer/SDR**: ver a carteira de qualquer pessoa.
- **(Futuro) Auditoria de score**: o histórico de `lead_score_history` — exige endpoint novo.

> O papel **"coordenador" do protótipo não existe** no sistema real (papéis: admin/closer/sdr). O que era do coordenador vai para o admin.

---

## PARTE 3 — O que o protótipo tem que o backend NÃO suporta (decidir: cortar ou criar endpoint)

| Item do protótipo | Situação no backend real | Caminho |
|---|---|---|
| Detalhe do lead (5 abas) | Não há `GET /api/leads/:id` | **Criar endpoint** (essencial — entra na expansão da API) |
| Heatmap / cards de resumo | Não há endpoints; mas TUDO é derivável do que `GET /api/leads` devolve | **Calcular no front** a partir da lista (sem endpoint novo) |
| Timeline do lead | O filme existe (`lead_events`) mas não é servido | **Criar endpoint** (junto do detalhe) |
| Breakdown do score | Existe (`score_breakdown` + 5 blocos) mas não é servido | **Entra no detalhe** |
| Contato (telefone/e-mail) | Fora da LISTA de propósito | **Decisão Vata: mostrar DIRETO no detalhe do lead** (sem mecanismo de revelar/auditar na V1) |
| Centro de Ações | Não existe no backend | **Menu visível, DESABILITADO com selo "Em breve"** (decisão Vata) |
| Agenda do dia | Sem endpoint | **Menu visível, DESABILITADO com selo "Em breve"** (decisão Vata — prioridade futura) |
| Gestão (performance por closer) | Sem métricas no backend | **Menu visível, DESABILITADO com selo "Em breve"** (decisão Vata — prioridade futura) |
| Auditoria de ações de usuário | Não existe (a auditoria real é de SCORE, `lead_score_history`) | Cortar da V1 |
| Etapas "Novo Lead/Qualificado/Agendado/No-show" | Eram mock — as reais são as 12 do enum | **Adotar as 12** (agrupáveis na UI) |
| 4 temperaturas | Eram mock — as reais são 6 | **Adotar as 6** (estender os tokens de cor) |
| Login por e-mail mock + cookie próprio | Real é Supabase Auth (e-mail/senha) + JWT no header | **Trocar a camada de auth** |
| `proxima_acao_tipo` (canal: whatsapp/ligar…) | Motor devolve só o texto `proxima_acao` | Cortar ou derivar do texto |

**O que aproveitar do protótipo sem mudança:** design system (tokens, badges, células do heatmap), componentes de UI (Button/Card/Badge/Skeleton/Table/Dialog/Drawer/Toast), AppShell/Sidebar/Topbar, padrões de loading/empty/error, acessibilidade (cor+ícone+texto), URL como fonte de verdade nos filtros, TanStack Query. Isso é ~60% do trabalho visual já resolvido.

---


### 3.1 Decisões fechadas (Vata, jun/2026)

1. **Ações, Agenda e Gestão:** aparecem no menu, porém **desabilitadas**, com indicação clara de "Em breve" (especialmente Agenda e Gestão). Nada clicável.
2. **Visão do SDR:** conforme proposta (fila dos agendados + recuperação + pool da Hana). Validar no uso.
3. **Contato no detalhe:** telefone e e-mail exibidos **direto** no detalhe do lead (a listagem continua enxuta).
4. **Heatmap:** etapas **agrupadas** na grade (1ª call · em atendimento · 2ª call · 3ª+ · no-show · FUP), filtro fino fora da grade.
5. **Estratégia de construção:** o front nasce em **projeto separado**, primeiro com **dados mockados** (`data_clients.json`) espelhando o contrato real — para aprovar o visual sem depender da API/VPS. Aprovado o visual, troca-se o mock pela API real (Supabase Auth + JWT + GET /api/leads) mantendo os contratos.

### 3.2 Botão "Abrir na Clint" (pendência de backend registrada)

O detalhe do lead terá um botão que abre o card do lead direto na Clint. **O campo (`link_crm`) NÃO existe hoje** no Supabase nem na ingestão. Pendência de backend (pós-aprovação do front): conferir se o payload do Clint traz a URL/ID do card; se trouxer, capturar na ingestão (Etapa 4) + migration de coluna `link_crm` em `leads` + expor no detalhe (F5). No mock, o campo já existe para o botão funcionar visualmente.

## PARTE 4 — O roadmap em fases (mesma filosofia: cada fase testável)

### Fase F1 — Fundação e design system
Projeto Next.js + TypeScript + Tailwind + TanStack Query + Zod. Tokens de cor estendidos para **6 temperaturas**. UI primitives e AppShell (aproveitando o protótipo).
*Pronto quando:* app sobe local com layout navegável e componentes base renderizando.

### Fase F2 — Login (mock primeiro, Supabase Auth depois)
**Enquanto mock:** tela de login com seleção de usuário (9 usuários reais como contas de demonstração) só para testar as 3 visões por papel. **Pós-aprovação:** troca por Supabase Auth (e-mail/senha) + JWT no header + `GET /api/me`.
*Pronto quando:* logando como cada papel, o menu e o escopo mudam corretamente.

### Fase F3 — A fila de prioridade (a tela que importa)
Consome o mock `data_clients.json` (espelho fiel do contrato de `GET /api/leads`); pós-aprovação, troca pela rota real. Ranking por score com temperatura (6), motivo curto, próxima ação, alertas, etapa (12). Filtros client-side (temperatura, etapa, busca) com URL como fonte de verdade.
*Pronto quando:* closer logado vê só os dele; SDR vê os dele + pool da Hana; admin vê tudo — contra o banco real.

### Fase F4 — Dashboard (heatmap + cards) derivados no front
Heatmap etapa × temperatura, cards de resumo (totais por temperatura, parados, no-shows) e alertas agregados — tudo **calculado da própria lista** de `GET /api/leads`, sem endpoint novo. Clicar numa célula/card filtra a fila.
*Pronto quando:* heatmap e cards refletem o banco real e filtram a fila.

### Fase F5 — Expansão da API p/ o detalhe (trabalho de BACKEND, sessão Claude Code própria)
Criar na API Fastify: `GET /api/leads/:id` (detalhe seguro: nota, 5 blocos, travas, alertas, financeiro/produto, resumo das análises) + a timeline (filme resumido). Mesmo filtro de papel das rotas atuais. (+ decisão da pergunta 3 sobre contato.)
*Pronto quando:* curl com JWT devolve o detalhe; fora do escopo → 404/403.

### Fase F6 — Tela de detalhe do lead
Consome a F5. Abas: Visão geral (nota + motivo + próxima ação + alertas) · Score (5 blocos + trava, o "porquê" da nota) · Comercial (financeiro, produto, tier, resumos das IAs) · Timeline (o filme).
*Pronto quando:* clicar num lead da fila abre o detalhe completo real.

### Fase F7 — Visões específicas por papel
SDR: aba "recuperação" (no-shows/parados) e pool da Hana destacado. Admin: filtro por closer/SDR e visão geral da operação.
*Pronto quando:* cada papel tem sua leitura própria validada com um usuário real de cada.

### Fase F8 — Deploy na Vercel
Subir o projeto na Vercel (conectar o repositório Git; a Vercel constrói e publica sozinha a cada push). Configurar as variáveis de ambiente do front (URL da API na VPS, URL/chave pública do Supabase). Ajustar o `FRONT_ORIGIN` da API (CORS) para o domínio da Vercel.
*Pronto quando:* o time acessa a dashboard pela internet, loga e vê a fila real.

> **Ordem (decisão Vata):** F1–F4 saem primeiro, em projeto separado e 100% com mock (`data_clients.json`) — sem depender de API/VPS. Vata aprova o visual. Depois: F5 (expansão da API, incl. link_crm), troca mock→API real (Supabase Auth + JWT), F6–F8. Para a Vercel enxergar a API, a Etapa 8 (VPS) precisa estar no ar.

---

## PARTE 5 — Mapa "backend → front" (cola rápida)

| O front quer mostrar | Vem de |
|---|---|
| Fila ordenada | `GET /api/leads` (já vem filtrada por papel) |
| Quem sou eu / menu por papel | `GET /api/me` |
| Temperatura/cor | `temperatura` (6 valores do enum) |
| Por que esse lead está aqui | `motivo_curto` |
| O que fazer agora | `proxima_acao` |
| Atenção/risco | `alertas[]` + `trava_aplicada` |
| O porquê da nota (gráfico) | os 5 `score_*` + `score_breakdown` (via detalhe, F5) |
| Linha do tempo | `lead_events` (via detalhe, F5) |
| Conversa resumida | `resumo_curto` das análises (via detalhe, F5) |
| Lead da Hana | `sdr_pool = true` |
| "Dado desatualizado" | `score_calculated_at` antigo |
FIM

---

## PARTE 6 — Iteração 2 (ajustes pós-primeira versão + duas seções novas)

### 6.1 Dashboard interativo (ajustes 1–3 do Vata)
1. **Filtros filtram o PRÓPRIO heatmap** (não navegam para a aba de leads): mudar um filtro redesenha a grade na hora.
2. **Listagem lateral ao lado do heatmap:** clicar numa célula/filtro (ex.: quentes) abre a lista ali do lado — nome, score, temperatura, produto sugerido, tags/alertas — com link para o detalhe.
3. **Ações recomendadas abaixo do mapa:** lista curta derivada dos leads visíveis (proxima_acao + alertas), priorizada por score (ex.: "Confirmar presença — Fulano (81, no-show remarcado)").

### 6.2 Sales Ops (closers) — seção NOVA e ativa no menu
Cada closer vê a própria; admin vê todas. Regras de comissão (doc oficial Vata):

| Closer | Meta 1 | Meta 2 |
|---|---|---|
| Aurelio (High) | R$ 260.000 | R$ 320.000 |
| Marcio (High) | R$ 260.000 | R$ 320.000 |
| Giba (Low) | R$ 75.000 | R$ 85.000 |

- Comissão **progressiva e retroativa**: até Meta 1 = **3%** (base); atingiu Meta 1 = **5% sobre TODO o volume do mês**; atingiu Meta 2 = **7% sobre todo o volume**.
- **Trava do caixa:** taxa acima de 3% só se **≥ 65% do volume vendido entrou no caixa (cash collected)** até o fim do mês.
- Metas **variam por mês** (ex. real: Marcio 230k/280k em um mês) → valores em config/mock editável, não hard-coded.
- Painel por closer (estilo do print de referência): faturamento do mês + barra de progresso vs metas, gap p/ Meta 1 e 2, cash collected (R$ e %), comissão **atual** (taxa vigente aplicada) e **projeções**: comissão se fechar os leads QUENTES da carteira (score ≥ 75) e se fechar TODOS os ativos — usando o valor do produto sugerido de cada lead.
- **Preços oficiais (Vata, jun/2026)** — config com as variantes; projeção usa por padrão o À VISTA da variante S (conservador):

| Produto | Parcelado | À vista |
|---|---|---|
| QC | 12×206 | 1.997 |
| Ninja S | 12×720 | 7.000 |
| Ninja A | 12×1.250 | 12.000 |
| Black S | 12×2.600 | 25.000 |
| Black A | 12×4.600 | 44.000 |
| Prime S | 12×6.800 | 68.000 |
| Prime A | 12×9.800 | 98.000 |
| Private S | 12×12.000 | 120.000 |
| Private A | 12×18.000 | 180.000 |

- **Nota p/ integração futura:** o backend só guarda o produto sem variante (S/A). Se a projeção precisar de precisão por variante, será uma mudança pequena no Supabase (coluna/enum) — Vata já autorizou se necessário.

### 6.3 Produtividade SDR — seção NOVA e ativa no menu (espelho do Dashboard SDR existente)
Réplica/integração do **Dashboard de Produtividade SDR** (repo Dashboard-Vendas; API externa `https://api.infradojo.pro/dashboard_comercial` JÁ FUNCIONANDO, com X-API-Key/Bearer). Cada SDR vê a própria; admin vê todos.
- KPIs por SDR: calls agendadas/realizadas/a realizar, no-show (qtde e %), produtos (QC | Ninja | Black | Prime | Private), leads qualificados (Ninja+ + bônus QC a cada 3 QC), meta escalonada 40/50/60 (M1/M2/M3) e gap.
- **Escopo COMPLETO (iteração 2.1)** — espelho FIEL do original, não só os cards: filtro de mês; os 3 gráficos Recharts (funil por SDR, taxa de no-show, atingimento de meta+gap); Insights automáticos do mês (risco/destaque/ação); tabela detalhada por SDR; e a aba LIDERANÇA PRÉ-VENDA inteira (filtros mês+semana, 6 KPIs, comparecimento por SDR, produtos no recorte, matriz SDR×Closer, metas da equipe 150/188/225 com barras) — Liderança visível só para admin.
- Visibilidade: na tela de Produtividade, SDRs veem o TIME inteiro (como no original, que é compartilhado) — os gráficos são comparativos por natureza. Se o Vata quiser privacidade entre SDRs depois, é um filtro.
- Mock-first: mock espelha o payload da API externa (incl. endpoints de marketing e closer p/ a Liderança) com 2–3 meses; adapter isolado p/ plugar a API real (env vars) na integração.

### 6.4 Paleta unificada (decisão Vata)
O Mapa de Calor e o Dashboard SDR devem ficar na MESMA paleta. Base: o tema dark do Dashboard SDR — fundos #0b1322/#131d30, bordas #30415f, texto #e5eefc/secundário #93a4c3; funcionais: azul #3b82f6/#5691ff, teal #2dd4bf, laranja #f59e0b, verde #22c55e, rosa #fb7185. As 6 temperaturas viram uma escala térmica coerente DENTRO dessa paleta (do rosa/laranja quente ao azul/cinza frio), mantendo cor+ícone+texto.

---

## PARTE 7 — Iteração 3 (Ações, Agenda, Visão Geral admin + preparação p/ dados reais)

Decisões do Vata (jun/2026):
1. **Ações** sai do "Em breve" — **modo LEITURA**: lista priorizada de proxima_acao+alertas dos leads do papel; SEM "concluir" (proxima_acao é texto recalculado pelo motor, não tarefa com estado — "concluir" exigiria tabela de tarefas no backend; fica para o futuro).
2. **Visão Geral (admin)** — painel breve consolidando: leads por temperatura, score médio, parados, no-shows, top quentes, faturamento closers vs metas, qualificados SDR vs metas de equipe; links para as seções.
3. **Agenda** sai do "Em breve" — derivada do BANCO (não Google Calendar): próximas calls dos leads do papel, ordenadas por data, agrupadas por dia. No mock: next_call_at no data_clients.json. **Pendência backend (integração):** GET /api/leads passar a expor next_call_at (a lista hoje é enxuta).
4. **Gestão** continua "Em breve" (única).
5. **Preparação para dados reais:** Dashboard SDR pode ligar AGORA (chaves reais já no .env → SDR_DASHBOARD_MODE=api, validar contra api.infradojo.pro). Leads/auth: adapter com modo mock|api pronto (route server-side; Bearer da sessão Supabase) + .env.example com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL e AUTH_MODE=mock|supabase — default mock até a VPS (Etapa 8) subir.

### 7.1 Adendos do Vata (aplicar JUNTO com a iteração 3, num lançamento único)

1. **Sales Ops — ganho por produto:** quadro "potencial da carteira por produto": p/ cada produto com leads ativos (ex.: 5 leads Black) → nº de leads, faturamento potencial (valor de tabela) e comissão potencial do closer (taxa vigente e projetada). 
2. **Filtro por produto na dash principal** (heatmap/fila): produto_sugerido vira filtro.
3. **Nomenclatura:** variantes S e A passam a exibir **Semestral** e **Anual** (S=Semestral, A=Anual) em todas as telas/labels (chaves internas podem permanecer).
4. **Comissão dos SDRs — nova aba na Produtividade SDR** (regras oficiais, imagens jun/2026): bônus base **R$ 40 por reunião qualificada realizada**; QC: **R$ 20 a cada 3 calls QC** (e a cada 3 QC = 1 qualificada p/ meta, regra já existente). **Aceleradores RETROATIVOS** por atingimento da meta (40/50/60): <M1 = R$40/reunião + **0,7%** por venda; M1 = R$60 + **1,2%**; M2 = R$80 + **1,8%**; M3 = R$100 + **2,5%** — retroativos sobre TODO o mês. OBS: bônus só se o lead **compareceu e foi qualificado**. Bônus por venda incide sobre as vendas originadas dos agendamentos do SDR (mock: vendas do mês por SDR).
5. **Limpeza de rebarbas:** remover tudo que não é do produto final — o login por seleção de personas vira a **tela de login definitiva** (e-mail/senha, visual final), mesmo que por trás ainda aceite entrar sem senha real (AUTH_MODE=mock); remover banners/selos de demonstração visíveis ao usuário.
