# PROGRESSO — Mapa de Calor (Frontend)

App em visual de produto final; leads/auth ainda em mock (`src/lib/mock/data_clients.json`); Dashboard SDR VALIDADO contra a API real e rodando em mock por decisão de demo (trocar `SDR_DASHBOARD_MODE` liga a API).
Fonte da verdade: `specs/roadmap_frontend.md` (v1.2 — Partes 6, 7 e 7.1). Referências: `specs/referencia-frontend.md` (protótipo anterior) e `specs/DOCUMENTACAO.md` (Dashboard SDR existente).

## Status

| Fase / Item | Descrição | Status |
| --- | --- | --- |
| F1–F4 (iteração 1) | Fundação, login mock (9 usuários), fila de prioridade com URL como fonte de verdade, dashboard + detalhe do lead (4 abas) | ✅ |
| It2 — 1. Paleta unificada | Tema dark do Dashboard SDR (§9 do DOCUMENTACAO) em TODO o app via tokens; 6 temperaturas recriadas dentro da paleta | ✅ |
| It2 — 2. Heatmap interativo | Filtros acima do mapa filtram o PRÓPRIO mapa (busca, closer/SDR p/ admin, pool); célula não navega mais | ✅ |
| It2 — 3. Listagem lateral | Clique em célula/card abre painel ao lado do mapa (nome, score, temperatura, produto, tags/alertas), fechável, com estado vazio | ✅ |
| It2 — 4. Ações recomendadas | Lista (até 6) abaixo do mapa, derivada do recorte visível: proxima_acao + nome + score + alertas, por score desc, linkando ao detalhe | ✅ |
| It2 — 5. Sales Ops | Entrada ATIVA no menu (closer/admin): metas, faturamento, cash collected, comissão progressiva/retroativa com trava do caixa + projeções; função pura + 11 testes | ✅ |
| It2 — 6. Produtividade SDR | Entrada ATIVA no menu (sdr/admin): espelho do Dashboard SDR (KPIs, bônus QC, metas 40/50/60); adapter mock/api atrás de route handler | ✅ |
| It2.1 — Produtividade SDR completa | Filtro de mês (3 meses no mock), 9 KPIs, 3 gráficos recharts, insights automáticos (função pura + 9 testes), tabela detalhada e aba Liderança Pré-venda (admin) com mês/semana, comparecimento, funil de marketing, matriz SDR×Closer e metas da equipe 150/188/225 (+ 11 testes) | ✅ |
| It3 — 1. Ações (leitura) | Saiu do "Em breve": agrega proxima_acao+alertas dos leads do papel, filtros temperatura/alerta (URL), agrupamento por tipo de ação, admin com seletor closer/SDR; SEM "concluir" | ✅ |
| It3 — 2. Agenda | Saiu do "Em breve": derivada do banco/mock (next_call_at + nº da call), agrupada por dia (Hoje/Amanhã), indicador de alerta | ✅ |
| It3 — 3. Visão Geral (admin) | Rota só-admin `/visao-geral`, home pós-login do admin: 6 chips de temperatura, score médio, parados, no-shows, top 5, blocos Closers e SDRs com links | ✅ |
| It3 — 4. Sales Ops upgrades | Nomenclatura Semestral/Anual em todos os labels + quadro "Potencial da carteira por produto" (clicável → fila filtrada) | ✅ |
| It3 — 5. Filtro por produto | produto_sugerido filtra o heatmap (como os demais filtros do mapa) e a fila (`?produto=`, URL como fonte de verdade) | ✅ |
| It3 — 6. Comissões SDR | Aba "Comissões" na Produtividade SDR: FONTE ÚNICA (mesmo agregado/mês da aba principal), 4 patamares retroativos, bônus QC, % de vendas; função pura + 16 testes; Hana informativa | ✅ |
| It3 — 7. Limpeza | Login definitivo e-mail/senha (AUTH_MODE), selos/banners de demo removidos; só Gestão segue "Em breve" | ✅ |
| It3 — 8a. SDR na API real | `SDR_DASHBOARD_MODE=api` validado contra api.infradojo.pro (divergência de campo mapeada só no route handler); demo segue em mock — base real de junho ainda rasa | ✅ |
| It3 — 8b. Leads/Auth prontos | `LEADS_MODE` mock/api via route handlers `/api/leads(/:id)` + client Supabase atrás de `AUTH_MODE` — prontos, NÃO ligados | ✅ |
| F5+ | Expansão da API real (detalhe, link_crm, next_call_at), ligar LEADS_MODE=api + AUTH_MODE=supabase, deploy Vercel | ⏳ |

## Paleta unificada (item 1)

- Tokens em `tailwind.config.ts`: fundos `noite` #0b1322 / `painel` #131d30, `borda` #30415f, `texto` #e5eefc / `texto-sec` #93a4c3; funcionais `azul` #3b82f6/`azul-claro` #5691ff, `teal` #2dd4bf, `laranja` #f59e0b, `verde` #22c55e, `rosa` #fb7185; acentos `amarelo` #facc15, `cinza` #94a3b8, `violeta` (Hana).
- **6 temperaturas dentro da paleta**: muito_quente=rosa, quente=laranja, morno_alto=amarelo, morno_baixo=teal, frio=azul-claro, congelado=cinza. Sempre cor+ícone+texto. Nenhuma cor solta em componente.

## Dashboard interativo (itens 2–4)

- Filtros do dashboard são estado local (não-URL): redesenham mapa, cards e ações na hora. A fila (`/leads`) segue com URL como fonte de verdade.
- Recorte = célula do heatmap OU card de resumo OU "fora da grade". Clicar de novo fecha. Painel lateral `RecortePanel` (max 640px, rolável). Ações recomendadas usam o recorte ativo (ou todos os visíveis) — só leads ATIVOS (fora blacklist/fechado).

## Sales Ops (item 5)

- Config em `src/lib/config/salesops.ts`: `metasPorCloser` (mudam por mês — editar lá, nunca em componente), `precosProdutos` (tabela oficial jun/2026) e `valorProjecaoPorProdutoSugerido` (à vista da variante S — conservador; lead sem produto não soma).
- Comissão em `src/lib/salesops/comissao.ts` (funções puras): 3% base · 5% retroativo ≥ Meta 1 · 7% retroativo ≥ Meta 2; trava do caixa (cash < 65% do volume → volta a 3% com aviso). Projeções assumem cash proporcional ao % atual (premissa sinalizada na tela). **11 testes** em `comissao.test.ts` (`npm run test`), incluindo o cenário retroativo do Giba (80k → 5% sobre os 80k).
- Mock de vendas em `src/lib/mock/vendas_closers.json` via adapter `src/lib/data/salesOps.ts`. Cenários cobertos: Marcio abaixo da M1 (3%), **Giba com M1 batida e cash ok (5% retroativo)**, **Aurelio com M2 batida mas trava do caixa (57,6% < 65% → 3% com aviso)**.
- Escopo: closer vê a própria página; admin alterna entre os 3 closers. SDR é redirecionado.

## Produtividade SDR (item 6 + iteração 2.1 — espelho COMPLETO do original)

- Regras do DOCUMENTACAO.md: aliases (5.1, incl. gilberto→Giba), produtos por substring (5.2), qualificados = Ninja+ + bônus ⌊QC/3⌋ (5.3), metas escalonadas 40/50/60 (5.4), metas da equipe 150/188/225 (5.5), no-show % (5.7), comparecimento até hoje (5.8), funil/tradução do marketing (5.9), matriz SDR×Closer proporcional com maiores restos (5.10), semana do mês (5.11), mês padrão (5.13). SDRs: Glaucio, Delrue, Benhur + **Hana como linha informativa sem meta**.
- Aba **Dashboard SDR**: filtro de mês, linha de contexto, **9 KPIs** (6.3), cards por SDR, **3 gráficos recharts** (funil azul/teal/laranja; no-show rosa em %; meta×qualificadas×gap composto — Hana fora), **insights automáticos** (6.4c, função pura `getInsights` com 9 testes), **tabela detalhada** de 14 colunas e rodapé com a regra de contabilização.
- Aba **Liderança Pré-venda** (só admin): filtros próprios de mês + semana ("Mês inteiro" default), 6 KPIs, comparecimento por SDR, produtos no recorte, matriz SDR×Closer (com "Sem Closer") e métricas da equipe (sempre mês inteiro; barras de progresso das 3 metas). Erro isolado (6.5g): falha da liderança não derruba a aba SDR.
- **Visibilidade (mudança It2.1):** o SDR logado vê o TIME INTEIRO (tela comparativa, como o original) com o próprio card/linha destacados ("você"); a aba Liderança fica oculta para SDR; closer segue redirecionado.
- Dados: mock `src/lib/mock/sdr_dashboard.json` **granular por dia, 3 meses (abr/mai/jun 2026; junho em andamento — realizadas até 11/06)**, regenerável com `npm run generate:sdr-mock`, espelhando os **12 endpoints** da API externa (5 SDR + marketing/leads, marketing/qualificados e 5 de closer). Route handler server-side `/api/sdr-dashboard` — modo `mock` (default) | `api` via `SDR_DASHBOARD_MODE`; no modo api busca os 12 endpoints com `X-API-Key` + `Bearer` (chave NUNCA vai ao navegador) e isola a falha da liderança em `lideranca_erro`. Nesta fase: sempre mock.
- Regras puras da liderança em `src/lib/sdr/lideranca.ts` (11 testes) e insights em `src/lib/sdr/insights.ts` (9 testes).
- `.env.example` no Git (placeholders); `.env` local com a chave real (ignorado; `.gitignore` tem `.env*` + `!.env.example`).
- **Fonte única de cores**: `src/lib/ui/cores.ts` — o `tailwind.config.ts` e os gráficos recharts importam dela (nada de hex solto).
- Detalhes completos em `PRODUTIVIDADE_SDR.md`.

## Iteração 3 (Partes 7 e 7.1 do roadmap)

### Ações, Agenda e Visão Geral

- **Ações** (`/acoes`, todos os papéis): leads ATIVOS do escopo por score desc; filtros por temperatura e TIPO de alerta (categorização por substring em `src/features/acoes/acoes.ts` — no_show/parado/cônjuge-sócio/call próxima/ciclo longo/urgência baixa) + closer/SDR para admin; agrupamento opcional pelo texto da ação (template do motor). URL como fonte de verdade. SEM "concluir" — nota "Ações geradas automaticamente pelo motor de score". 5 testes.
- **Agenda** (`/agenda`, todos os papéis): `next_call_at` + `next_call_numero` entraram no contrato (`LeadListItemSchema`) e no gerador do mock (15 calls futuras nos próximos 10 dias, 3 hoje); agrupamento por dia ("Hoje"/"Amanhã"/dia da semana) em `src/features/agenda/agenda.ts` (2 testes); item com hora, nº da call, etapa, temperatura, score, proxima_acao e indicador de alerta. **Admin e SDR veem o closer responsável pela call** (badge "Call com: X" → `closer_id`; sem closer → "Sem closer definido" em laranja). Mock tem 2 calls sem closer (ld_0007/Benhur, ld_0009/Glaucio) para exercitar o estado de atenção. O closer não vê o badge (as calls são dele).
- **Visão Geral** (`/visao-geral`, SÓ admin — outros papéis redirecionam): home pós-login do admin (`/` decide por papel; closer/SDR seguem no `/dashboard`). 6 chips de temperatura (clicáveis → fila filtrada), score médio, parados, no-shows, top 5 por score, bloco Closers (volume vs M1/M2 por closer, do mock Sales Ops) e bloco SDRs (qualificados do time vs 150/188/225), cada um linkando à seção.

### Sales Ops e filtro por produto

- **Nomenclatura (7.1.3):** `rotuloProduto()` em `src/lib/config/salesops.ts` — variantes exibem "Semestral"/"Anual" em TODOS os labels; chaves internas (`ninja_s`, "Black A") intactas nos dados.
- **Potencial por produto (7.1.1):** `src/lib/salesops/potencial.ts` (função pura, 2 testes) — por produto ativo da carteira: nº de leads, faturamento potencial (nº × valor de projeção) e comissão na taxa VIGENTE e na taxa do cenário "fechando todos"; linha de total; clique no produto filtra a fila (`/leads?produto=...`, admin leva `&closer=`).
- **Filtro por produto (7.1.2):** na fila via URL (`?produto=qc,ninja,...`, multi por vírgula) e no heatmap como os demais filtros do mapa (estado local, decisão da It2). Lista oficial em `PRODUTOS_OFICIAIS` (`src/lib/formatters/score.ts`).

### Comissões dos SDRs (7.1.4)

- **FONTE ÚNICA:** a aba Comissões consome o MESMO `agregarDashboard(payload, mes)` da aba principal (mesmo adapter, mesmo payload, mesmo filtro de mês) — mudou o mês, a comissão muda junto. Não existe mock próprio de comissão; o único dado extra é `vendas_por_sdr` no payload.
- `src/lib/salesops/comissaoSdr.ts` (função pura, **16 testes**): bônus por reunião QUALIFICADA realizada — paga sobre as qualificadas SEM o bônus de meta (`qualificadosBase`); o patamar 40/50/60 usa os qualificados COM o bônus ⌊QC/3⌋ (que segue valendo só para a META). Aceleradores RETROATIVOS: R$ 40 + 0,7% · R$ 60 + 1,2% (M1) · R$ 80 + 1,8% (M2) · R$ 100 + 2,5% (M3) sobre TODO o mês. Bônus QC: ⌊qc/3⌋ × R$ 20 com o QC real do mês. Projeção "se bater a próxima meta" recalcula as MESMAS reuniões base/vendas na taxa seguinte. Hana: `metas: null` → linha informativa, fora dos totais.
- **Validação oficial (junho do mock, coberta por teste):** Glaucio 25 base + QC 14 → 29 p/ meta (<M1) = 25×40 + 80 = **R$ 1.080** + 0,7% das vendas · Delrue 36 + QC 9 → 39 (<M1) = 36×40 + 60 = **R$ 1.500** + 0,7% · Benhur 38 + QC 12 → 42 (≥M1 RETROATIVO) = 38×60 + 80 = **R$ 2.360** + 1,2%. O junho do mock (`generate_sdr_mock.mjs`, `JUNHO_PLAN`) é ENGENHEIRADO para reproduzir exatamente esses exemplos.
- Aba **Comissões** na Produtividade SDR (`ComissoesPanel`): card por SDR (patamar com a linha "definido por X qualificados p/ meta (Y base + Z bônus QC)", reuniões × valor, bônus QC, % × vendas, TOTAL, projeção retroativa), tabela de vendas originadas; admin vê todos, SDR vê o próprio destacado. Vendas no mock: **3–6 por mês** (`VENDAS_PLAN`), valores da tabela oficial, produto já com variante Semestral/Anual.

### Limpeza e preparação para dados reais

- **Login definitivo:** e-mail/senha no visual final (`src/features/auth/LoginForm.tsx`); a página lê `AUTH_MODE` no servidor. `mock`: valida o e-mail contra a lista de usuários, qualquer senha entra. `supabase`: a MESMA tela chama `signInWithPassword` (client em `src/lib/auth/supabase.ts`, lazy). Seleção de personas REMOVIDA; banners/selos de demonstração removidos (sidebar, login, rodapés Sales Ops/SDR). Só **Gestão** permanece "Em breve".
- **Dashboard SDR VALIDADO na API real** (11/06/2026, 12 endpoints OK; histórico 2025-01→2026-06). **Divergência mapeada SÓ no route handler:** a API devolve o total com nome por endpoint (`total_agendadas`, `total_realizadas`, `total_no_show`, `total_remarcadas`, `total_leads`, `total_qualificados`; por-produto usa `total_realizadas`) → mapeado para o `total` do contrato em `/api/sdr-dashboard`. Erros da API → 502 com mensagem; falha só da liderança → `lideranca_erro` isolado. **Achado registrado:** a base real de junho/2026 está rasa e quase uniforme (≈10 qualificadas por SDR, 0 QC) — por isso a demo roda com `SDR_DASHBOARD_MODE=mock`; ligar a API real é trocar UMA linha no `.env` (mesma fonte única, números da API).
- **Leads atrás de `LEADS_MODE`** (default mock, NÃO ligado): route handlers `/api/leads` e `/api/leads/:id` decidem a fonte — mock filtra `data_clients.json` pela sessão (regras de papel em `src/lib/server/mockLeads.ts`); api repassa para `{NEXT_PUBLIC_API_URL}/api/leads` com `Authorization: Bearer` (token da sessão Supabase, anexado pelo `dataClient` quando existe). `dataClient.ts` agora só chama os handlers e valida com Zod — **trocar modos no .env muda a fonte sem tocar em componente**.

### Correções pós-iteração 3 (auditoria Vata)

- **Escopo de visibilidade centralizado (FONTE ÚNICA):** a regra de papel virou `src/lib/data/escopo.ts` (`leadNoEscopo` / `filtrarPorEscopo<T>`) — admin: tudo · closer: os dele · SDR: os dele + pool da Hana. O route handler `/api/leads` (server) e as três views **Fila, Ações e Agenda** (client, defensivamente) usam o MESMO helper, sem cópia divergente. **3 testes** cobrindo os 3 papéis (`escopo.test.ts`), incluindo o anti-vazamento: SDR NÃO vê lead de outro SDR; pool é visível a qualquer SDR; closer não herda o pool. Auditoria confirmou que a matemática do escopo já estava correta server-side (benhur 6 calls, guilherme 7, glaucio 6 — sem cruzamento), mas a regra era server-only; agora é explícita, testada e aplicada nas views.
- **Tema de TRÊS fases (azul → escuro → claro):** o botão agora cicla três temas em vez de alternar dois. O mecanismo trocou a classe `.light` toggleável por um atributo **`data-theme` sempre-presente** no `<html>` (`:root[data-theme="dark"|"light"]` em `globals.css`) — isso elimina a ambiguidade de cascata que fazia o clique "voltar pro escuro". As fases:
  - **azul** (default): a paleta original (fundo azul-marinho) — bloco `:root`.
  - **escuro**: fundo quase preto (`--c-noite: 8 9 12`); só as superfícies mudam, funcionais/temperaturas herdam do azul.
  - **claro**: **igual ao tema escuro, só o fundo muda** (decisão Vata). Fundo **BRANCO** (`--c-noite`/`--c-painel: 255 255 255`) + regra explícita `body { background:#fff }`; texto e borda escurecem (legibilidade); **funcionais e as 6 temperaturas são IDÊNTICOS ao tema azul/escuro** (vibrantes — teal #2dd4bf, laranja #f59e0b, rosa #fb7185 etc.), preservando a identidade de cor. Trade-off aceito: acentos vibrantes como texto sobre branco têm contraste menor que AA em alguns badges — mantido por decisão de identidade visual; legibilidade reforçada por ícone+label em cada badge.
  Lógica pura em `src/features/theme/tema.ts` (`TEMAS`, `proximoTema` cicla os 3, `temaValido`; **4 testes**). Botão (`ThemeToggle`) mostra ícone+nome da fase atual e três pontos de posição no ciclo. Default = **azul**; preferência persiste em `localStorage` e o script anti-flash grava `data-theme` antes da pintura (sem piscar). Cores hard-coded auditadas: só `text-white` (sobre botão azul, 5,2:1 AA ✓) e `bg-black/60` (scrim do drawer) — nenhuma quebra o claro.

### Pendências de integração (backend)

1. **`GET /api/leads` real precisa expor `next_call_at` e `next_call_numero`** — a Agenda depende deles (hoje só no mock).
2. **Vendas originadas por SDR não têm fonte real definida** — a API externa não expõe `vendas_por_sdr`; hoje o route handler serve as vendas do MOCK até em modo api (sinalizado no código). Na integração: definir a fonte (endpoint novo na API externa ou cruzamento com as vendas dos closers no Supabase).
3. `GET /api/leads/:id` (detalhe + timeline + link_crm) segue pendente (F5).
4. No `AUTH_MODE=supabase`, o papel/escopo virá de `GET /api/me`; até lá o cookie de sessão é resolvido pela lista local de usuários após o sign-in real.

### Virada para dados reais — LOCAL (13/06/2026)

- **Ligado e testado local** (`.env.local`, fora do Git, sobrepõe o `.env`): `LEADS_MODE=api`, `AUTH_MODE=supabase`, `NEXT_PUBLIC_API_URL=https://mapacalor-api.infradojo.pro`. **Voltar ao mock = trocar 2 linhas** (`LEADS_MODE=mock`/`AUTH_MODE=mock`) — validado: admin 40 leads, SDR benhur 19 (escopo), sem cookie 401.
- **Auth real:** login na MESMA tela chama `signInWithPassword` → `GET /api/me` (proxy server-side `src/app/api/me/route.ts`, normaliza id/nome/email/role com tolerância de campo) → grava o `SessionUser` real no cookie de sessão. `getServerSession` lê o JSON do cookie quando `AUTH_MODE=supabase` (o JWT segue no supabase-js/localStorage, anexado às chamadas pelo `dataClient`). Logout: `signOut` + limpa cookie. 401 em qualquer chamada → limpa cookie e volta ao `/login` (sem loop de middleware).
- **Arquitetura sem CORS no navegador:** as chamadas à API real saem dos route handlers Next (server-to-server); o navegador só fala com a própria origem (`/api/*`) e com o Supabase. Dev sobe na **:3000** nesta máquina (a API local não roda aqui).
- **Adapter do contrato real (`src/lib/server/apiLeads.ts`, 4 testes):** o `GET /api/leads` real responde um envelope `{ leads: [...] }` ENXUTO (`id`, `nome_exibicao`, `etapa_atual` [null ok], `score_final`, `temperatura`, `motivo_curto`, `proxima_acao`, `alertas`, `next_call_at` [null ok], `no_show_count`) — SEM os campos de cálculo/posse/detalhe do `LeadListItemSchema`. O route handler em modo `api` agora ADAPTA esse corpo ao contrato do app (`id→lead_id`, `score_bruto=score_final`, blocos=0, `closer_id/sdr_id=null`, `sdr_pool=false`, etapa fora do enum→null) em vez de repassar cru — antes o passe-cru fazia o Zod no client (`LeadsResponseSchema` esperava `{ total, items }`) derrubar a fila INTEIRA mesmo com 200 válido ("Não foi possível carregar a fila"). Tolerância lead-a-lead: um lead fora do formato é logado no servidor (motivo exato) e descartado, nunca derruba os demais; estado de erro só em status != 2xx. `tempoRelativo` passou a tratar timestamp ausente (mostra "—" em vez de "há NaN meses"). E-mail em `nome_exibicao` renderiza normal (card trunca).

### Correções de contrato real — detalhe e filtros (16/06/2026)

Dois bugs com a MESMA raiz do bug da fila (contrato real ≠ mock): a API responde 200 válido, o front processava errado. API agora no ar (responde 401 sem token, não mais 404).

- **BUG 1 — Detalhe do lead ("Não foi possível carregar o lead"):** o route handler `GET /api/leads/:id` em modo `api` repassava o corpo CRU (`NextResponse.json(await res.json())`); o `LeadDetailSchema` do client esperava o shape do mock e o real é outro — `link_crm: null`, `score_breakdown.blocos` como **objeto** `{fit,timing,...}` (não array), `analise_sdr` com os 3 campos null e o nome `sinais_de_risco`, `analise_call: null`, `timeline` com `event_type`/`call_at` (não `tipo`/`event_id`/`descricao`). Zod derrubava a tela. **Fix:** adapter server-side `src/lib/server/apiLeadDetail.ts` (8 testes) — valida o contrato REAL com TODOS os opcionais `.nullish()`, mapeia para o `LeadDetailSchema` (blocos-objeto→array com tetos reais e `itens:[]`; `analise_*` tudo-null→`null`; timeline real→`LeadEvent` com `event_type` coagido ao enum e descrição sintetizada). Campo opcional ausente = ausente, não quebra; erro só em status != 2xx. `link_crm` virou **nullable** no contrato e a UI esconde "Abrir na Clint" quando null; `email` relaxado para `z.string()`.
- **BUG 2 — Filtros do mapa/fila/ações zeravam a lista (produto, closer, SDR):** três causas distintas, todas "front comparando errado o dado real" (a API JÁ manda os 4 campos: `produto_sugerido` ex "prime", `closer_id`/`sdr_id` UUID, `sdr_pool`; 63/65 leads com closer, 61/65 com sdr).
  - **Produto:** o **adapter da lista** (`apiLeads.ts`), escrito para a lista enxuta antiga, **descartava** `produto_sugerido` (hardcoded `null`) — todo lead vinha sem produto → filtro zerava. **Fix:** o adapter agora LÊ `produto_sugerido`/`closer_id`/`sdr_id`/`sdr_pool`/`score_bruto`/`tier_final` da lista real quando presentes (`.nullish()` com default seguro, compatível com a enxuta). `chaveDoProduto` reduz à base canônica (ignora variante S/A e casing: "Prime Anual"/"ninja_s" → "prime"/"ninja"; "private" não colide com "prime").
  - **Closer/SDR:** os dropdowns liam de `CLOSERS`/`SDRS` (`DEMO_ACCOUNTS`), cujos `id` são **slugs do mock** ("marcio", "benhur"); os leads reais trazem **UUID** em `closer_id`/`sdr_id` → `l.closer_id === "marcio"` nunca casava → zerava. **Fix:** `src/lib/data/donos.ts` (`opcoesDeDono`) deriva as opções dos PRÓPRIOS leads (o `value` é o id real — slug no mock, UUID na API), rótulo via `nomeDoUsuario` (nome quando conhecido, id quando UUID sem fonte de nome). Aplicado em **Dashboard, Fila e Ações**. (O seletor de closer do Sales Ops/Visão Geral segue no mock de vendas — concern separado.)
  - Lead com `closer_id`/`sdr_id` null só some ao filtrar por um dono específico (correto), nunca dos demais filtros.
  - **Testes:** `filtros.test.ts` (produto canônico+variante reduz; closer/SDR por UUID reduz; null não some dos outros), `donos.test.ts` (distintos, UUID vira value exato, nome resolvido no mock), +2 no adapter da lista. **87 testes no total.**

### Hydration mismatch (React #418) no build de produção — era o TEMA, não os filtros (16/06/2026)

- **Sintoma:** ao usar o app no build de produção (Vercel), console mostrava `Minified React error #418` (mismatch de hidratação) e a tela "regenerava". Correlacionado com os filtros por coincidência de teste.
- **Causa real:** `ThemeProvider` lia `document.documentElement.dataset.theme` no INICIALIZADOR do `useState` → no servidor caía em `TEMA_PADRAO` ("azul"), no cliente lia o tema salvo (ex. "dark", que o script anti-flash do `layout.tsx` já gravara do localStorage). O `ThemeToggle` (no chrome, em TODAS as páginas) renderiza ícone + `TEMA_LABEL[tema]` + dot ativo, todos dependentes do tema → 1º render do cliente ("Escuro"/Moon) ≠ servidor ("Azul"/Droplet) → #418 (`args[]=text` no rótulo, `args[]=HTML` no ícone SVG). Só dispara para quem tem tema ≠ azul salvo — por isso não aparecia em sessão limpa. O `suppressHydrationWarning` do `<html>` só cobre o `data-theme`, não o conteúdo do botão.
- **Fix (`ThemeProvider.tsx`):** `useState(TEMA_PADRAO)` SEM ler DOM/localStorage (1º render do cliente = servidor); um `useEffect([])` pós-montagem sincroniza o estado com `data-theme` (já aplicado pelo anti-flash — sem flash de cor, no máximo o rótulo do botão acerta em 1 frame). Removido o efeito `aplicar(tema)` em `[tema]` que reescrevia o DOM; `definir`/`alternar` aplicam imperativamente.
- **Reproduzido e validado em BUILD DE PRODUÇÃO** (`next build && next start`) com browser real (Playwright): antes, #418 em `/leads` com tema dark salvo; depois, **sem #418 em azul/dark/light** e cada filtro REDUZ sem zerar (produto=black→9, ninja→14, temperatura=quente→7, closer=marcio→7 de 40). Os filtros em si já estavam corretos — não eram a causa do #418.

### Blindagem defensiva dos filtros contra campos undefined/null (16/06/2026)

- **Contexto:** relato de `Uncaught TypeError: Cannot read properties of undefined (reading 'toLowerCase')` no console de produção, atribuído aos filtros. **Reproduzido em build de produção** (`next build && next start`) com payload no contrato REAL fluindo (API falsa local + sessão forjada): closer_id/sdr_id como UUID, produto_sugerido/etapa_atual/closer/sdr = null. **Resultado: NÃO houve crash nem #418** — filtros reduzem (produto=prime→1, closer por UUID→1, sdr→1), dropdown de Closer/SDR POPULA. Razão arquitetural: o adapter server-side E o client revalidam tudo com `LeadListItemSchema` (Zod); lead inválido é DESCARTADO no servidor, nunca chega ao filtro com tipo errado — então `undefined` não alcança o código de filtro. Conclusão provável: o crash veio de um **deploy desatualizado** (anterior aos guards) ou de payload fora do envelope (→ 502, estado de erro, não crash).
- **Mesmo assim, blindado** (defesa em profundidade, caso dado não-validado chegue): os 3 helpers `normalizar` (`filtros.ts`, `acoes.ts`, `DashboardView.tsx`) passam a aceitar `string|null|undefined` → `(s ?? "")` antes de `.toLowerCase()/.normalize()`; os campos do alvo de busca usam `?? ""`; `chaveDoProduto` e `valorDeProjecao` aceitam `undefined` (já guardavam `!x`); `tiposDoLead` itera `Array.isArray(alertas) ? alertas : []`. +1 teste em `filtros.test.ts` (lead com nome/produto/closer/etapa/temperatura undefined NÃO derruba nenhum filtro). **88 testes.**
- **Pendente p/ o usuário:** se o #418/toLowerCase persistir após redeploy LIMPO do HEAD, enviar o **stack trace** (ou o "Component Stack" do overlay React) e o **JSON real de `GET /api/leads`** — sem reproduzir, não dá para apontar o campo exato, e a evidência aqui mostra o código atual robusto.

- **BLOQUEADOR (backend):** `https://mapacalor-api.infradojo.pro` respondia **404 (Go default) em TODOS** os caminhos testados — `/api/me`, `/api/leads`, `/api/leads/:id`, `/`, `/health`, `/v1/*` etc. O front está correto contra o contrato e degrada com erro claro (502 "A API respondeu 404"), mas o **load real depende das rotas existirem na API** (ou do prefixo correto). Pendente: confirmar com o backend as rotas reais + liberar `FRONT_ORIGIN` (mesmo que CORS não seja acionado pelo proxy, o Supabase precisa do projeto correto).

## Decisões de implementação (registradas, não explícitas no roadmap)

- Filtros do heatmap escolhidos: busca + closer/SDR (admin) + pool da Hana (admin/SDR) — temperatura/etapa são os próprios eixos da grade, então o "filtro fino" deles vive na fila.
- "Leads ativos" (projeções e ações recomendadas) = etapa fora de blacklist/fechado (etapa nula conta como ativo).
- `produto_sugerido` agora é **nullable** no contrato e usa os produtos oficiais sem variante (QC/Ninja/Black/Prime/Private); leads sem etapa ficam sem produto.
- Guilherme (SDR do app) não existe no Dashboard SDR (que acompanha Glaucio/Delrue/Benhur/Hana) → desde a It2.1 ele vê o time inteiro normalmente, apenas sem card destacado.
- Métricas da equipe (150/188/225) somam os qualificados de TODOS os SDRs acompanhados, incluindo a Hana (a meta conta o time inteiro de pré-venda).
- Projeção sem vendas no mês assume 100% de cash (premissa exibida).

## Camada de dados (troca mock→real)

- Leads: `src/lib/data/dataClient.ts` (`fetchLeads`, `fetchLeadDetail`) → route handlers `/api/leads(/:id)` atrás de `LEADS_MODE` — contratos em `src/lib/api/contracts.ts`; `npm run generate:mock` regenera os 40 leads (6/6 temperaturas, 12/12 etapas + 3 nulas, 5 travas, 6 pool da Hana, 15 calls futuras).
- Vendas dos closers: `src/lib/data/salesOps.ts`. Dashboard SDR (+ vendas por SDR): `src/lib/data/sdrDashboard.ts` + route handler `/api/sdr-dashboard` atrás de `SDR_DASHBOARD_MODE` (`npm run generate:sdr-mock` regenera).

## Como rodar

```bash
npm install
npm run dev    # http://localhost:3000 → /login
npm run test   # 63 testes (vitest): comissões closer/SDR, insights, liderança, ações, agenda, potencial, escopo, tema
```

Login (qualquer senha em `AUTH_MODE=mock`): **marcio/giba/aurelio@vatadojo.com.br** (closer), **benhur/guilherme/glaucio@vatadojo.com.br** (SDR), **contato (Vata)/cindy/jonas@vatadojo.com.br** (admin).

## Próximo passo

Subir a VPS (Etapa 8) → ligar `LEADS_MODE=api` + `AUTH_MODE=supabase` no `.env` (adapters já prontos), F5 (expansão da API: `GET /api/leads/:id`, timeline, link_crm, next_call_at) e deploy na Vercel.
