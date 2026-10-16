# Módulo Educacional — Especificação Frontend

Oct 9, 2026 · @Vata Dojo

## 1. Objetivo e escopo

O Mapa de Calor ganha um segundo módulo, **Educacional ("Saúde da Jornada")**, visível apenas para os papéis `educacional` e `admin`. O usuário educacional não vê nada da área comercial: leads, closers, SDRs, filas, agenda, produtividade, comissões ou dados da Clint.

O backend tem especificação própria: Módulo Educacional — Especificação Backend.

**O que o front entrega nesta fase**

- Navegação separada por papel, a partir de `modulos` em `GET /api/me`.
- As três telas do módulo (Cockpit, Tabela tática, Raio-X do aluno) funcionando com dados mockados, seguindo o contrato da seção 8.
- Adapter com modo `api` pronto e desligado, para ligar quando o backend tiver fonte de dados.

**Princípios**

- Esconder menu é experiência de uso; a proteção real é do backend. Mesmo assim, o front nunca pode buscar dado comercial para o usuário educacional.
- O front não calcula regra de negócio. Health Score, risco, sinais e dias estagnados chegam prontos no payload.

## 2. Acesso por papel, rotas e navegação

`GET /api/me` devolve o papel e a lista `modulos`. O front decide tudo de navegação a partir de `modulos`, nunca lendo tabelas do Supabase.

| role | modulos | O que vê |
| --- | --- | --- |
| admin | `["comercial", "educacional"]` | Tudo, com seletor de área |
| papéis comerciais (closer, sdr e demais) | `["comercial"]` | Exatamente o que vê hoje; nada do educacional |
| educacional | `["educacional"]` | Somente o módulo Educacional |

**Rotas**

| Rota | Conteúdo | Quem acessa |
| --- | --- | --- |
| `/educacional` | Cockpit + Tabela tática | admin, educacional |
| `/educacional/alunos/[id]` | Raio-X do aluno (página; pode abrir também como gaveta a partir da tabela) | admin, educacional |
| Rotas comerciais atuais | Sem mudança | admin, papéis comerciais |

**Comportamento**

- **Depois do login:** `modulos` só com `educacional` redireciona para `/educacional`. Só `comercial` mantém a home atual. Admin entra na home atual.
- **Menu:** renderiza apenas os itens dos módulos presentes em `modulos`.
- **Admin:** seletor de área no topo (Comercial | Educacional), lembrando a última escolha em `localStorage` com `try/catch`.
- **Guard de rota:** layout ou middleware bloqueia acesso por URL direta, antes de renderizar qualquer coisa. Educacional abrindo rota comercial vai para `/educacional`; papel comercial abrindo `/educacional` vai para a home comercial.
- **Layout compartilhado sem vazamento:** nenhum componente global (cabeçalho, badges, contadores, prefetch) busca dados comerciais quando o usuário é educacional. Ex.: o badge de agendamentos de primeira call não monta para esse papel.
- **Respostas da API:** `401` leva ao login; `403` leva à home do módulo permitido, sem exibir conteúdo.

## 3. Fonte de dados (mock-first)

Nesta fase não há fonte de dados; o front roda inteiro sobre um arquivo mock que segue o contrato da seção 8.

- Adapter `apiEducacional.ts` com modo `mock | api`, controlado por `NEXT_PUBLIC_EDU_DATA_SOURCE` (padrão `mock`).
- Modo `mock`: lê `data_educacional.json`. Mínimo de 12 alunos, cobrindo as 5 etapas, os 5 status de checkpoint, os 3 níveis de risco, alunos adimplentes e inadimplentes, alunos com e sem sinais comerciais.
- Modo `api`: chama os endpoints da seção 8.3 com o JWT. Fica pronto no código e desligado.
- Validação do contrato com Zod e tolerância aluno a aluno: registro inválido é descartado e logado, sem derrubar a tela.
- `GET /api/me` é real desde já (não é mock): a navegação depende dele.

## 4. Tela Cockpit (`/educacional`, parte superior)

Fonte: `ResumoEducacional` (seção 8.1).

**Cabeçalho**

- Kicker "EDUCACIONAL · COCKPIT", título "Saúde da Jornada", subtítulo "Visão macro da turma + operação de acompanhamento".
- Botão "Atualizar": refaz a busca no adapter.
- Botão "+ Nova intervenção": abre o modal da seção 7.

**4 cards de KPI** (rótulo, número grande, legenda)

| Card | Campo do contrato | Legenda | Clique |
| --- | --- | --- | --- |
| Health Score médio | `kpis.health_score_medio` | Saúde geral da turma | Sem ação |
| Alunos ativos | `kpis.alunos_ativos` | Na jornada atual | Limpa filtros da tabela |
| Intervenções SLA | `kpis.intervencoes_sla` | Checkpoint pendente ou sem resposta | Filtra a tabela por checkpoint Pendente + Não respondeu |
| Em risco | `kpis.em_risco` | Health Score abaixo de 50 | Filtra a tabela por Health Score < 50 |

**Funil da Jornada Educacional** (card largo à esquerda)

- 5 etapas em ordem fixa, cada uma com nome, contagem e barra horizontal. Fonte: `funil[]`.
- Contagem = alunos **atualmente** na etapa.
- Largura da barra proporcional à maior contagem do funil.
- Clique na etapa filtra a tabela por aquela etapa.

**Sinais para o Comercial** (card à direita)

- 3 sub-cards com contagem: Prontos para Upgrade, Em janela de Renovação, Potencial de Prova Social. Fonte: `sinais`.
- Clique no sinal filtra a tabela pelos alunos daquele sinal.
- Rodapé fixo: "Exemplo de regra: Big Win realizado + etapa Validação → card automático para Closers".
- Aqui aparecem só a contagem e os alunos. Nenhum dado do lado comercial (closer, status do card no comercial) é exibido.

## 5. Tabela tática (`/educacional`, parte inferior)

Título "Acompanhamento tático · clique em um aluno para abrir o raio-X". Fonte: `AlunoLinha[]` (seção 8.1).

| Coluna | Campo | Exibição |
| --- | --- | --- |
| Aluno | `nome` | Negrito |
| Nível inicial | `nivel_inicial` | Texto |
| Etapa atual | `etapa_atual` | Rótulo da etapa |
| Checkpoint | `proximo_checkpoint.status` | Badge: Realizado (verde), Pendente (âmbar), Não respondeu (vermelho), Em pausa (cinza), Previsto (cinza claro) |
| Dias estagnados | `dias_estagnados` | Número + "d", negrito |
| Risco | `risco` | Ponto colorido + texto: Saudável (verde), Atenção (âmbar), Risco (vermelho) |
| Próxima ação | `proxima_acao.descricao` | Texto truncado em 1 linha, completo no hover |
| Responsável | `responsavel` | Nome + tipo (Mentor, Suporte, Comercial) |

- **Filtros** (dropdowns combináveis): etapa, risco, status do checkpoint, responsável, sinal. Os cliques do Cockpit preenchem esses filtros e mostram um chip "Filtro ativo" com opção de limpar.
- **Ordenação** por qualquer coluna; padrão por risco (Risco, Atenção, Saudável) e depois dias estagnados decrescente.
- **Visualização:** alternância Lista | Kanban. Kanban com uma coluna por etapa e cards com nome, risco, checkpoint e dias estagnados.
- **Clique na linha ou no card** abre o Raio-X.
- **Paginação** de 25 por página.

## 6. Raio-X do aluno (`/educacional/alunos/[id]`)

Fonte: `AlunoDetalhe` (seção 8.1). Blocos, de cima para baixo:

1. **Cabeçalho:** nome, mentoria, data de entrada, data de término, objetivo, status geral.
2. **Indicadores:** Health Score (0–100) com destaque vermelho e rótulo "Risco de Evasão/Reembolso" quando abaixo de 50; termômetro de risco (verde, amarelo, vermelho); dias estagnados no formato "Há 25 dias em Construção do Operacional".
3. **Contrato:** status financeiro (Adimplente / Inadimplente, com destaque se inadimplente) e LTV em reais.
4. **Timeline de checkpoints:** linha do tempo horizontal do Dia 0 ao Mês 6, um marcador por checkpoint com nome, data prevista e status (mesmas cores da tabela). Checkpoint "Mês 3 — Big Win" com marcação visual própria.
5. **Progresso metodológico:** barra de 4 passos (Consumiu → Entendeu → Aplicou → Validou) na etapa atual, com o passo atingido destacado. Abaixo, highlights das aulas (data da aula + texto). Sem highlights: "Sem análises de aula disponíveis".
6. **Diagnóstico e próxima ação:** diagnóstico, próxima ação, responsável e prazo.
7. **Intervenções:** lista das intervenções do aluno, mais recente primeiro.
8. **Sinais ativos:** chips dos sinais comerciais em que o aluno está (Upgrade, Renovação, Prova Social).

## 7. Nova intervenção, estados e visual

**Modal "Nova intervenção"**

- Campos: aluno (busca por nome), tipo (Contato, Reunião, Ajuste de plano, Outro), responsável (tipo + nome), prazo (data), descrição.
- Obrigatórios: aluno, tipo, responsável e descrição.
- Modo `mock`: a intervenção fica em memória da sessão e aparece no Raio-X do aluno até recarregar a página.
- Modo `api`: `POST /api/educacional/intervencoes`.

**Estados**

- Cada bloco tem três estados: carregando (skeleton), vazio (mensagem curta) e erro (mensagem + botão tentar de novo).

**Visual**

- Segue o design system atual do painel.
- Cores semânticas fixas: verde = saudável/realizado, âmbar = atenção/pendente, vermelho = risco/não respondeu, cinza = em pausa, cinza claro = previsto (diferente do cinza de "Em pausa").
- Responsivo: KPIs em 4 colunas no desktop, 2 no tablet, 1 no celular; Funil e Sinais lado a lado no desktop (2/3 e 1/3), empilhados abaixo disso; tabela com rolagem horizontal no celular.

## 8. Contrato de dados

O `data_educacional.json` segue exatamente estes tipos. É o mesmo contrato que o backend vai implementar quando houver fonte de dados; mudança aqui precisa ser alinhada com o back.

### 8.1 Tipos

```typescript
type Etapa =
  | 'fundamentos_iniciais'      // Fundamentos Iniciais
  | 'tres_pilares'              // 3 Pilares
  | 'oferta_e_demanda'          // Oferta e Demanda
  | 'construcao_operacional'    // Construção do Operacional
  | 'validacao';                // Validação

type StatusCheckpoint = 'realizado' | 'pendente' | 'nao_respondeu' | 'em_pausa' | 'previsto';
// previsto: a data do checkpoint ainda não chegou. Vem pronto no payload (o front não calcula por data).
type NivelRisco = 'saudavel' | 'atencao' | 'risco';
type NivelInicial = 'iniciante' | 'intermediario' | 'avancado';
type PassoMetodologico = 'consumiu' | 'entendeu' | 'aplicou' | 'validou';
type StatusFinanceiro = 'adimplente' | 'inadimplente';
type Sinal = 'upgrade' | 'renovacao' | 'prova_social';
type TipoResponsavel = 'mentor' | 'suporte' | 'comercial';

interface Responsavel {
  tipo: TipoResponsavel;
  nome: string;
}

interface ResumoEducacional {
  atualizado_em: string;              // ISO 8601
  kpis: {
    health_score_medio: number;       // 0-100
    alunos_ativos: number;
    intervencoes_sla: number;
    em_risco: number;
  };
  funil: { etapa: Etapa; alunos: number }[];   // sempre as 5 etapas, na ordem
  sinais: { upgrade: number; renovacao: number; prova_social: number };
}

interface AlunoLinha {
  id: string;                         // uuid
  nome: string;
  nivel_inicial: NivelInicial;
  etapa_atual: Etapa;
  proximo_checkpoint: { nome: string; status: StatusCheckpoint; data_prevista: string | null };
  dias_estagnados: number;
  health_score: number;               // 0-100
  risco: NivelRisco;
  proxima_acao: { descricao: string; prazo: string | null } | null;
  responsavel: Responsavel | null;
  sinais: Sinal[];
}

interface Checkpoint {
  id: string;
  nome: string;                       // ex.: 'Dia 0', 'Mês 3 — Big Win'
  ordem: number;
  data_prevista: string | null;
  data_realizada: string | null;
  status: StatusCheckpoint;
}

interface Intervencao {
  id: string;
  tipo: 'contato' | 'reuniao' | 'ajuste_plano' | 'outro';
  descricao: string;
  responsavel: Responsavel;
  prazo: string | null;
  criada_em: string;
}

interface AlunoDetalhe extends AlunoLinha {
  mentoria: string;
  data_entrada: string;
  data_termino: string | null;
  objetivo: string | null;
  status_geral: string;
  etapa_desde: string;                // data de entrada na etapa atual
  status_financeiro: StatusFinanceiro;
  ltv: number;                        // reais
  checkpoints: Checkpoint[];
  progresso_metodologico: {
    passo_atual: PassoMetodologico | null;
    highlights: { data_aula: string; texto: string }[];
  };
  diagnostico: string | null;
  intervencoes: Intervencao[];
}
```

### 8.2 Sessão

`GET /api/me` (real nesta fase):

```json
{
  "id": "uuid",
  "nome": "Fulana",
  "email": "fulana@vatadojo.com.br",
  "role": "educacional",
  "modulos": ["educacional"]
}
```

### 8.3 Endpoints do adapter (modo `api`)

| Método e rota | Retorno | Parâmetros |
| --- | --- | --- |
| `GET /api/educacional/resumo` | `ResumoEducacional` | — |
| `GET /api/educacional/alunos` | `{ itens: AlunoLinha[]; total: number }` | `etapa`, `risco`, `checkpoint`, `responsavel`, `sinal`, `health_max`, `ordem`, `pagina` |
| `GET /api/educacional/alunos/:id` | `AlunoDetalhe` | — |
| `POST /api/educacional/intervencoes` | `Intervencao` | corpo: `aluno_id`, `tipo`, `descricao`, `responsavel`, `prazo` |

## 9. Regras para montar o mock

O mock precisa ser coerente com estas regras, que o backend vai calcular quando houver dados.

| Regra | Definição |
| --- | --- |
| Health Score | Índice 0–100 (engajamento, presença, progresso) |
| Em risco | Health Score abaixo de 50; no Raio-X aparece como "Risco de Evasão/Reembolso" |
| Intervenções SLA | Alunos com próximo checkpoint `pendente` ou `nao_respondeu` (`previsto` não conta) |
| Previsto | Checkpoint cuja data ainda não chegou; calculado pelo backend, o front só exibe |
| Funil | Alunos atualmente em cada etapa; a soma das 5 etapas é igual a `alunos_ativos` |
| Dias estagnados | Dias corridos desde `etapa_desde` até hoje |
| Termômetro de risco | Verde, amarelo ou vermelho com base nas respostas do aluno nos checkpoints |
| Big Win | Checkpoint "Mês 3 — Big Win" `realizado` + etapa Validação gera sinal para o Comercial |
| Upgrade | Só aluno `adimplente` aparece em "Prontos para Upgrade" |
| Totais | KPIs e contagens do `ResumoEducacional` batem com a lista de alunos do mock |

## 10. Critérios de pronto

Pronto quando um usuário educacional real loga, vê o módulo completo com mock e não dispara nenhuma chamada a rota comercial.

- [ ] Login redireciona por `modulos`; menu mostra só os módulos permitidos.
- [ ] Admin alterna entre Comercial e Educacional.
- [ ] Acesso por URL direta bloqueado nos dois sentidos, sem renderizar conteúdo antes da checagem.
- [ ] Nenhuma chamada a rota comercial na aba de rede do navegador quando logado como educacional.
- [ ] Cockpit, Tabela tática (lista e Kanban) e Raio-X funcionando com `data_educacional.json`.
- [ ] Cliques do Cockpit filtrando a tabela.
- [ ] Modal de Nova intervenção funcionando em modo mock.
- [ ] Estados de carregando, vazio e erro em todos os blocos.
- [ ] Adapter com modo `api` pronto e desligado.
- [ ] Papéis comerciais seguem vendo o painel exatamente como hoje (regressão).
