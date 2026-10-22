# Módulo Educacional — Fase 2 (Edição) — Frontend

Oct 20, 2026 · @Vata Dojo

## 1. Objetivo e princípios

Na Fase 2, a equipe do educacional edita absolutamente tudo pelo módulo: Kanban arrastável, edição direto na tabela, todos os campos do Raio-X, checkpoints, intervenções, cadastro de alunos e configurações. Cada mudança é gravada no banco pelo backend, que também espelha os dados numa planilha de backup.

**Princípios**

- **Tudo editável, inclusive os campos calculados.** Campo calculado editado vira ajuste manual, com motivo obrigatório e opção de voltar ao automático.
- **O front não calcula regra de negócio.** Depois de cada gravação, exibe o aluno que a API devolve, já recalculado.
- **Experiência rápida:** a tela muda na hora (atualização otimista) e desfaz a mudança, com aviso, se a gravação falhar.
- **Mesmo controle de acesso da Fase 1.** Só admin e educacional; nada muda para os papéis comerciais.
- **Nada se apaga pela tela.** O que sai das listas é arquivado e pode ser reativado.
- **O contrato da seção 2 substitui o contrato da Fase 1.**

## 2. Contrato de dados

Este contrato vale para o mock e para a API. As mudanças em relação à Fase 1:

- Etapas deixam de ser fixas: vêm da configuração, com `id`, `nome` e `ordem`.
- Campos calculados passam a usar `CampoCalculado`.
- Progresso metodológico vira 4 notas de 0 a 100.
- O aluno ganha `versao` e vários campos novos.

```typescript
// ---------- domínios ----------
type StatusCheckpoint = 'previsto' | 'pendente' | 'realizado' | 'nao_respondeu' | 'em_pausa';
type FaixaSaude = 'saudavel' | 'atencao' | 'risco';
type NivelInicial = 'iniciante' | 'intermediario' | 'avancado';
type StatusAluno = 'ativo' | 'em_pausa' | 'concluido' | 'cancelado' | 'reembolsado';
type StatusFinanceiro = 'adimplente' | 'inadimplente';
type AutorizacaoProvaSocial = 'sim' | 'nao' | 'pendente';
type TipoResponsavel = 'mentor' | 'suporte' | 'comercial';

// ---------- campo calculado com ajuste manual ----------
interface Ajuste<T> {
  valor: T;
  motivo: string;
  ajustado_por: { id: string; nome: string };
  ajustado_em: string;               // ISO 8601
}
interface CampoCalculado<T> {
  valor: T | null;                   // efetivo: ajuste ?? automatico
  automatico: T | null;              // null = ainda sem cálculo
  ajuste: Ajuste<T> | null;
}

// ---------- configuração ----------
interface Etapa { id: string; nome: string; ordem: number; ativo: boolean }
interface CheckpointModelo {
  id: string; nome: string; ordem: number;
  dias_apos_entrada: number; prazo_sla_dias: number | null;
  big_win: boolean; ativo: boolean;
}
interface TipoIntervencao { id: string; nome: string; ativo: boolean }
interface Responsavel { id: string; nome: string; tipo: TipoResponsavel; ativo: boolean }
interface Config {
  etapas: Etapa[];
  checkpoints_modelo: CheckpointModelo[];
  tipos_intervencao: TipoIntervencao[];
  responsaveis: Responsavel[];
  sync_planilha_erros: number;       // itens que falharam 5 vezes (só informativo)
}

// ---------- resumo ----------
interface ResumoEducacional {
  atualizado_em: string;
  kpis: { health_score_medio: number | null; alunos_ativos: number; intervencoes_sla: number; em_risco: number };
  funil: { etapa_id: string; nome: string; alunos: number }[];   // etapas ativas, na ordem
  sinais: { upgrade: number; renovacao: number; prova_social: number };
}

// ---------- aluno ----------
interface AlunoLinha {
  id: string;
  versao: number;
  nome: string;
  mentoria: string;
  nivel_inicial: NivelInicial;
  status_aluno: StatusAluno;
  etapa: { id: string; nome: string };
  proximo_checkpoint: { id: string; nome: string; status: StatusCheckpoint; data_prevista: string | null } | null;
  dias_na_etapa: CampoCalculado<number>;
  dias_sem_atividade: CampoCalculado<number>;
  health_score: CampoCalculado<number>;
  faixa_saude: CampoCalculado<FaixaSaude>;
  proxima_acao: { descricao: string; prazo: string | null } | null;
  responsavel: { id: string; nome: string; tipo: TipoResponsavel } | null;
  sinais: {
    upgrade: CampoCalculado<boolean>;
    renovacao: CampoCalculado<boolean>;
    prova_social: CampoCalculado<boolean>;
  };
  arquivado: boolean;
}

interface Checkpoint {
  id: string; nome: string; ordem: number;
  data_prevista: string | null; data_realizada: string | null;
  status: StatusCheckpoint; big_win: boolean; observacao: string | null;
}

interface Intervencao {
  id: string; tipo: { id: string; nome: string }; descricao: string;
  responsavel: { id: string; nome: string; tipo: TipoResponsavel } | null;
  prazo: string | null; status: 'aberta' | 'concluida';
  concluida_em: string | null; criada_por: { id: string; nome: string }; criada_em: string;
}

interface AlunoDetalhe extends AlunoLinha {
  data_entrada: string;
  data_termino: string | null;
  etapa_desde: string;
  objetivo: string | null;
  diagnostico: string | null;
  motivo_risco: string | null;
  observacoes: string | null;
  autorizacao_prova_social: AutorizacaoProvaSocial;
  ultima_atividade: CampoCalculado<string>;     // data
  status_financeiro: CampoCalculado<StatusFinanceiro>;
  ltv: CampoCalculado<number>;                    // reais
  progresso: {
    consumiu: CampoCalculado<number>;             // 0-100
    entendeu: CampoCalculado<number>;
    aplicou: CampoCalculado<number>;
    validou: CampoCalculado<number>;
  };
  highlights: { data_aula: string; texto: string }[];
  checkpoints: Checkpoint[];
  intervencoes: Intervencao[];
}

interface ItemHistorico {
  id: string; em: string; usuario: { id: string; nome: string };
  entidade: 'aluno' | 'checkpoint' | 'intervencao' | 'ajuste';
  campo: string; valor_antes: unknown; valor_depois: unknown; motivo: string | null;
}
```

Os endpoints estão na seção 4 do doc do backend da Fase 2. Toda escrita em aluno envia `versao`. Toda resposta de escrita devolve o `AlunoDetalhe` atualizado.

## 3. Kanban funcional

O Kanban é a forma principal de mover alunos entre etapas.

- **Colunas:** uma por etapa ativa, na ordem da configuração, com nome e contagem no topo.
- **Card do aluno:** nome, faixa de saúde, status do próximo checkpoint, dias na etapa e responsável. Um ícone pequeno indica quando algum campo do card tem ajuste manual.
- **Arrastar e soltar:** move o aluno para outra coluna e grava a nova etapa (`PATCH /alunos/:id` com `etapa_id`).
  - O card muda de coluna na hora.
  - Se a gravação falhar, volta para a coluna original com aviso.
  - Depois de gravar, os dias na etapa zeram.
- **Ordem dentro da coluna:** por faixa de saúde (risco primeiro) e depois dias na etapa decrescente.
- **Alternativa sem arrastar:** cada card tem um menu "Mover para…" com a lista de etapas. Isso também atende teclado e celular.
- **Celular:** colunas com rolagem horizontal e arrasto por toque. O menu "Mover para…" é o caminho garantido.
- **Clique no card:** abre o Raio-X.
- **Filtros da tabela** valem também para o Kanban.
- **Sem paginação no Kanban.** Com muitos alunos, cada coluna rola na vertical.

## 4. Tabela editável

Toda célula da tabela tática é editável direto na linha.

| Coluna | Editor | Grava em |
| --- | --- | --- |
| Aluno | Texto | `nome` |
| Nível inicial | Lista | `nivel_inicial` |
| Etapa atual | Lista de etapas ativas | `etapa_id` |
| Checkpoint | Lista de status (e data, ao marcar realizado) | checkpoint próximo |
| Dias na etapa | Número → ajuste manual com motivo | ajuste `dias_na_etapa` |
| Faixa de saúde | Lista → ajuste manual com motivo | ajuste `faixa_saude` |
| Próxima ação | Texto + data de prazo | `proxima_acao`, `proxima_acao_prazo` |
| Responsável | Lista de responsáveis ativos | `responsavel_id` |

**Comportamento**

- **Entrar em edição:** clique na célula, ou Enter com a célula em foco.
- **Salvar:** Enter, ou clique fora.
- **Cancelar:** Esc.
- **Gravando:** indicador discreto na célula. Erro: a célula volta ao valor anterior e um aviso explica o motivo.
- **Campo calculado:** a edição abre um pequeno formulário com o valor e o motivo (obrigatório). A célula ajustada mostra um ícone; ao passar o mouse, aparece quem ajustou e quando.
- **Colunas visíveis:** o usuário escolhe quais colunas aparecem. Também ficam disponíveis Health Score, Dias sem atividade, Status do aluno e Mentoria. A escolha fica lembrada no navegador.
- **Linha arquivada:** só aparece com o filtro "Mostrar arquivados", em cinza, com o botão "Reativar".
- **Botão "+ Novo aluno"** no cabeçalho da tabela (seção 6).

## 5. Raio-X editável, ajuste manual e histórico

Todos os blocos do Raio-X têm um botão "Editar". O bloco entra em modo de edição, com "Salvar" e "Cancelar".

| Bloco | O que se edita |
| --- | --- |
| Cabeçalho | Nome, mentoria, data de entrada, data de término, objetivo, status do aluno, nível inicial, etapa |
| Indicadores | Health Score, faixa de saúde, dias na etapa, última atividade, dias sem atividade (todos por ajuste manual); motivo do risco (texto) |
| Contrato | Status financeiro e LTV (por ajuste manual) |
| Progresso metodológico | Consumiu, Entendeu, Aplicou e Validou, de 0 a 100 cada (por ajuste manual), em 4 barras |
| Timeline de checkpoints | Por checkpoint: nome, data prevista, data realizada, status, observação. Também adicionar checkpoint avulso e arquivar checkpoint |
| Diagnóstico e próxima ação | Diagnóstico, próxima ação, prazo, responsável |
| Intervenções | Criar, editar, concluir, reabrir, arquivar |
| Sinais e prova social | Upgrade, Renovação, Prova Social (por ajuste manual); autorização de prova social; observações |

### 5.1 Ajuste manual em campo calculado

- O campo mostra o valor efetivo.
- Se houver ajuste ativo, aparece um selo "Ajustado" com nome, data e motivo, e o valor automático logo abaixo ("Automático: 62" ou "Automático: sem cálculo").
- **Ajustar** abre um formulário com o novo valor e o motivo (obrigatório, mínimo 5 caracteres). Grava com `PUT /alunos/:id/ajustes/:campo`.
- **Voltar ao automático** pede confirmação e grava com `DELETE /alunos/:id/ajustes/:campo`. Some quando não há ajuste.

### 5.2 Aba Histórico

- Lista de `GET /alunos/:id/historico`, mais recente primeiro, paginada.
- Cada linha mostra data e hora, usuário, o que mudou (campo e entidade), valor antes → valor depois e motivo, quando houver.
- Filtro por tipo: aluno, checkpoint, intervenção, ajuste.

## 6. Cadastro, arquivamento e configurações

### 6.1 Novo aluno

- O botão "+ Novo aluno" abre um formulário.
- **Obrigatórios:** nome, mentoria, data de entrada, nível inicial e etapa (padrão: a primeira etapa ativa).
- **Opcionais:** data de término, objetivo, responsável, status do aluno (padrão: ativo), autorização de prova social (padrão: pendente) e observações.
- Depois de criar, abre o Raio-X do aluno novo, já com os checkpoints gerados pelo backend a partir do modelo.

### 6.2 Arquivar e reativar

- "Arquivar aluno" fica no Raio-X, com confirmação.
- Aluno arquivado some do Cockpit, do Kanban e da tabela padrão.
- O filtro "Mostrar arquivados" traz os alunos arquivados de volta à tabela, com o botão "Reativar".

### 6.3 Tela de configurações (`/educacional/configuracoes`)

O item "Configurações" fica no menu do módulo, visível para admin e educacional. São quatro abas:

| Aba | O que se edita |
| --- | --- |
| Etapas | Nome, ordem (arrastar para reordenar), ativar ou inativar |
| Checkpoints padrão | Nome, ordem, dias após a entrada, prazo de SLA em dias, marca de Big Win, ativar ou inativar |
| Tipos de intervenção | Nome, ativar ou inativar |
| Responsáveis | Nome, tipo (Mentor, Suporte, Comercial), ativar ou inativar |

- Itens inativos aparecem na tela de configurações, mas não nas listas de escolha.
- Inativar uma etapa que ainda tem alunos mostra o erro da API com a quantidade de alunos afetados.
- Mudança nos checkpoints padrão vale só para alunos novos. A tela avisa isso.
- Se `sync_planilha_erros` for maior que zero, o admin vê um aviso no topo das configurações: "N alunos não foram copiados para a planilha de backup".

## 7. Comportamento de gravação e modo demonstração

### 7.1 Gravação

- **Atualização otimista:** a tela reflete a mudança na hora. Ao receber a resposta, troca pelo `AlunoDetalhe` devolvido pela API, que já vem recalculado.
- **Erro `400`:** desfaz a mudança e mostra a mensagem do campo.
- **Erro `409` (outra pessoa alterou o aluno):** desfaz a mudança e mostra "Este aluno foi alterado por outra pessoa. Os dados foram atualizados; refaça sua alteração." Depois, recarrega o aluno.
- **Erros `401` e `403`:** mesmo comportamento da Fase 1.
- **Erro de rede:** desfaz a mudança e mostra aviso com o botão "Tentar de novo".
- **Sucesso:** confirmação discreta ("Salvo"). Nada de modal.
- **Cockpit e funil:** recarregam depois de cada gravação que afete totais (etapa, checkpoint, faixa de saúde, sinais, arquivar).

### 7.2 Modo demonstração (`NEXT_PUBLIC_EDU_DATA_SOURCE=mock`)

- Todas as operações de escrita funcionam também no mock, para validar a experiência antes do backend.
- O adapter mock imita o backend:
  - versão;
  - `409` simulado (dá para forçar por um parâmetro de desenvolvimento);
  - histórico;
  - ajuste manual sobrevivendo a "recálculo";
  - geração de checkpoints para aluno novo.
- O mock calcula só o que o backend calcula nesta fase: dias na etapa, dias sem atividade, faixa de saúde a partir do Health Score, SLA e Prova Social por Big Win. É o único lugar do front com essa lógica, e ela existe só para o modo demonstração.
- As mudanças ficam salvas no navegador (`localStorage`, com `try/catch`) e sobrevivem ao recarregar a página.
- Botão "Restaurar dados de demonstração" nas configurações, visível só no modo mock.
- A etiqueta "Dados de demonstração" continua no cabeçalho.

## 8. Critérios de pronto

Pronto quando, no modo demonstração, a equipe consegue fazer qualquer edição pelo painel, a mudança sobrevive ao recarregar a página e aparece no histórico do aluno.

- [ ] Contrato da seção 2 em Zod, com o mock migrado para ele.
- [ ] Kanban: arrastar e soltar entre colunas, menu "Mover para…", desfazer com aviso em caso de erro e dias na etapa zerando.
- [ ] Tabela: edição na linha em todas as colunas, com Enter, Esc e clique fora; seleção de colunas visíveis.
- [ ] Raio-X: edição de todos os blocos da seção 5.
- [ ] Ajuste manual: ajustar com motivo, selo "Ajustado", valor automático visível e voltar ao automático.
- [ ] Aba Histórico com filtro.
- [ ] Checkpoints: editar, adicionar avulso, arquivar.
- [ ] Intervenções: criar, editar, concluir, reabrir, arquivar.
- [ ] Novo aluno com checkpoints gerados pelo modelo.
- [ ] Arquivar e reativar aluno.
- [ ] Tela de configurações com as quatro abas.
- [ ] Tratamento de `400`, `409`, erro de rede e sucesso, como na seção 7.1.
- [ ] Persistência no navegador no modo mock e botão "Restaurar dados de demonstração".
- [ ] Adapter com modo `api` pronto para os endpoints do backend da Fase 2, desligado.
- [ ] Celular: Kanban com "Mover para…" e edição funcionando em 390 px.
- [ ] Regressão: papéis comerciais idênticos.
- [ ] Commits por etapa. Push só com o ok do Vata.
