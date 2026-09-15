# Front Mapa de Calor — Spec de planejamento

**Aba "Levantou a Mão" + ajustes gerais** — versão 1.0 — setembro/2026

Repositório: front Next.js (deploy automático na Vercel). Backend já entregue: `GET /api/eventos/oportunidades`.

---

## Parte 1 — Nova sub-aba "Levantou a Mão"

### 1.1 Onde fica

Dentro de **Produtividade SDR**, como quarta sub-aba:

```
Dashboard SDR | Calls por Ciclo | Levantou a Mão | Comissões
```

Posição depois de "Calls por Ciclo" — as duas compartilham o conceito de ciclo semanal e se leem em sequência: quantas calls foram agendadas → quem levantou a mão e ficou de fora.

Rota: `/produtividade-sdr/levantou-a-mao`

### 1.2 O que a aba responde

Uma pergunta só: **quem aplicou no webinar e não agendou call** — com informação suficiente para o SDR agir sem sair da tela.

### 1.3 Fonte de dados

```
GET /api/eventos/oportunidades?de=YYYY-MM-DD&ate=YYYY-MM-DD
Authorization: Bearer <jwt>
```

Resposta:

```json
{
  "de": "...", "ate": "...",
  "eventos": ["WG - 01.09.26", "WG - 08.09.26"],
  "totais": { "no_evento": 412, "levantaram_mao": 87, "agendaram": 31, "pendentes": 56 },
  "leads": [{ "clint_contact_id", "nome", "telefone", "email",
              "tier", "tier_rank", "evento_tag", "tags", "created_at" }],
  "gerado_em": "...", "cache": "hit|miss"
}
```

`leads` traz **só os pendentes**. Todo filtro de MQL e busca acontece no cliente, sobre esse array — sem ida extra ao servidor.

### 1.4 Filtro de data

Dois modos, no mesmo controle:

**Modo ciclo (padrão).** Dropdown de ciclos semanais terça→segunda, **reaproveitando o componente de "Calls por Ciclo"**. Abre no ciclo corrente. Rótulo: `WG - 08.09.26 (08/09 a 14/09)`.

**Modo intervalo.** Dois date pickers, para consolidar várias semanas. Validação no cliente: máximo 90 dias (o backend rejeita acima disso).

Quando o intervalo abrange mais de um evento, a tabela ganha a coluna "Evento" e um agrupador opcional.

### 1.5 Filtro por MQL

Grupo de chips multi-seleção, na ordem hierárquica:

```
[UMQL+] [UMQL] [HMQL] [SMQL] [MQL+] [MQL] [Sem classificação]
```

- Nenhum selecionado = todos aparecem.
- Cada chip mostra a contagem: `HMQL (12)`.
- Atalho **"Só alto valor"** seleciona UMQL+, UMQL e HMQL de uma vez — é o recorte que o SDR mais usa.
- Cor do chip segue a escala de temperatura já existente no tema (tokens, nada de cor solta).

### 1.6 Conteúdo da tela, de cima para baixo

**a) Linha de KPIs — 5 cards**

| Card | Valor | Detalhe |
|---|---|---|
| No evento | `totais.no_evento` | contatos com a tag do ciclo |
| Levantaram a mão | `totais.levantaram_mao` | % sobre no_evento |
| Agendaram | `totais.agendaram` | % sobre levantaram_mao — **é a taxa de conversão do SDR** |
| Pendentes | `totais.pendentes` | destaque visual, é o número que gera ação |
| Alto valor pendente | contagem de UMQL+/UMQL/HMQL entre os pendentes | derivado no cliente |

**b) Funil horizontal**
Três blocos proporcionais: no evento → levantou a mão → agendou. Com as taxas de passagem entre eles.

**c) Distribuição por MQL**
Barras horizontais dos pendentes por tier, do maior para o menor. Clicar numa barra aplica o filtro correspondente.

**d) Tabela de pendentes**

| Coluna | Conteúdo | Comportamento |
|---|---|---|
| Nome | `nome` | ordenável |
| MQL | badge do `tier` | ordenável por `tier_rank` |
| Evento | `evento_tag` | só quando o intervalo tem mais de um evento |
| Telefone | `telefone` | botão copiar + link `wa.me` que abre a conversa |
| E-mail | `email` | botão copiar |
| Entrou em | `created_at` | formato relativo (`há 3 dias`) com data no tooltip |
| Tags | `tags` | as 3 primeiras + `+N` com o resto no tooltip |

- Ordenação padrão: `tier_rank` desc → `evento_tag` desc → nome asc (a mesma que o backend já entrega).
- Busca por nome/e-mail/telefone acima da tabela.
- **Exportar CSV** do recorte filtrado — o SDR leva a lista para a rotina dele.
- Paginação só acima de 50 linhas.

**e) Rodapé da tela**
`Atualizado em <gerado_em>` + botão "Atualizar". Se `cache: "hit"`, indicar discretamente que o dado pode ter até 5 minutos.

### 1.7 Estados

| Estado | Tratamento |
|---|---|
| Carregando | skeleton nos KPIs e na tabela |
| Zero pendentes | estado positivo: "Todos que levantaram a mão já agendaram" |
| Zero contatos no evento | "Nenhum contato com a tag deste ciclo" + a tag consultada, para conferir se ela existe na Clint |
| `502 clint_auth` | "Integração com a Clint indisponível. Avise o time técnico." |
| `502 clint_indisponivel` | mesma mensagem + botão "Tentar de novo" |
| `422 intervalo_muito_grande` | "Período muito amplo. Reduza o intervalo." |
| `400` | destacar o campo de data inválido |

### 1.8 Escopo de acesso

Sem escopo por papel, igual às outras sub-abas de Produtividade SDR: todo usuário autenticado vê o time inteiro. É relatório de operação, não fila pessoal.

### 1.9 Responsivo

Em telas estreitas: KPIs em grade 2×3, funil vira vertical, tabela vira cards empilhados (nome + badge MQL + botão WhatsApp em destaque).

---

## Parte 2 — Ajustes gerais

### 2.1 Remover Ações, Agenda e Gestão do menu

As três entradas estão no menu desabilitadas com selo "Em breve" desde junho. Decisão: **remover do menu**.

- Tirar os itens da navegação.
- Remover as rotas correspondentes (ou redirecionar para a home, se houver link antigo).
- Limpar componentes e ícones que ficarem órfãos.
- Não apagar nada do backend — não existe backend para elas.

### 2.2 Resetar a visão da dashboard

**Esta parte é backend/banco, não front. E é destrutiva — precisa de decisão antes de executar.**

Objetivo declarado: a dashboard passa a mostrar só leads que entrarem a partir de agora.

Dois caminhos:

**Opção A — cutoff reversível (recomendada).**
Marcar os leads atuais como fora do ranking, sem apagar:

```sql
update leads
set visivel_ranking = false
where created_at < now();
```

Vantagens: reversível com um update; preserva `lead_events`, `lead_score_history` e as análises de IA; o histórico de Produtividade SDR e Calls por Ciclo continua funcionando, porque lê `lead_events`, não o ranking.

**Opção B — truncate (o que foi feito em setembro).**

```sql
truncate lead_score_history, lead_call_analysis, lead_sdr_analysis,
         lead_events, leads restart identity cascade;
```

Irreversível. E apaga `lead_events` — o que **zera as abas Calls por Ciclo e Dashboard SDR**, já que elas se alimentam desses eventos. Quem olhar ciclos anteriores vai ver zero.

Se a intenção é "limpar a fila dos closers", a Opção A entrega isso sem colateral. Se a intenção é apagar mesmo tudo, a B faz — mas o histórico de agendamento por SDR vai junto.

**Pendente de decisão antes de rodar qualquer coisa.**

---

## Parte 3 — Ordem de execução

1. Backend já está pronto (endpoint entregue, suíte verde). Falta deploy: `git pull` + `docker compose up -d --build` na VPS, com `CLINT_API_TOKEN` no `.env`.
2. Front: construir a aba mock-first com `data_clients.json`, validar o visual, depois ligar no endpoint real.
3. Remoção das três entradas do menu — pode ir no mesmo commit.
4. Reset do banco — só depois da decisão A ou B, e depois de a aba nova estar funcionando (para não debugar duas coisas ao mesmo tempo).
