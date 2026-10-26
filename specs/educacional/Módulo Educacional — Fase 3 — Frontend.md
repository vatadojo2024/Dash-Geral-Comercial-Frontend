# Módulo Educacional — Fase 3 — Frontend

Oct 22, 2026 · @Vata Dojo

## 1. Objetivo e ordem de entrega

A Fase 3 deixa o módulo pronto para uso real. Entram quatro frentes no front, nesta ordem:

1. **Desempenho:** o painel está lento. Primeiro medir, depois corrigir, com antes e depois.
2. **Salvar em lote:** as alterações ficam pendentes e vão todas juntas ao clicar em "Salvar". Menos requisições, nada gravado pela metade, a tela não trava.
3. **Aba Alunos:** lista completa de alunos, como a aba Leads do comercial.
4. **Análise de aula:** enviar a transcrição, acompanhar a análise da IA, revisar, editar e confirmar na ficha do aluno.

**Princípios mantidos**

- Só admin e educacional. Nada muda para os papéis comerciais, exceto as melhorias de desempenho, sempre com regressão comprovada.
- O front não calcula regra de negócio. Exibe o que a API devolve. O modo demonstração continua imitando o backend.
- Os endereços do backend estão na spec do backend da Fase 3.

## 2. Desempenho

O painel está lento na navegação. Antes de corrigir, entregar um diagnóstico com números, em produção (Vercel) e no celular.

### 2.1 Diagnóstico (entregar antes de mudar código)

| O que medir | Como |
| --- | --- |
| Tempo de carregamento e de troca de tela das rotas principais (Visão Geral, Dashboard, Leads, Agendamentos, Sales Ops, Produtividade SDR e o módulo Educacional) | Lighthouse e Web Vitals (LCP, INP, CLS), desktop e celular |
| Quanto cada página baixa de JavaScript | Analisador de bundle do Next |
| Sequência de chamadas por tela (o que espera o quê) | Aba de rede, procurando chamadas em fila que poderiam ser paralelas |
| Tempo das rotas `/api/*` do front até a API da VPS | Log de duração no proxy |
| Regiões | Região das funções da Vercel, da VPS e do Supabase; distância entre elas |
| Componentes que redesenham sem necessidade | React Profiler na tabela, no Kanban e no Raio-X |
| Modo demonstração | Custo de ler e gravar o "banco" no `localStorage` a cada alteração |

### 2.2 Correções candidatas

Só as que o diagnóstico justificar:

- Alinhar a região das funções da Vercel com a da VPS e do Supabase.
- Paralelizar chamadas em sequência.
- Ajustar o cache do React Query: tempo de validade e não recarregar o que não mudou.
- Carregar sob demanda as partes pesadas (Kanban, biblioteca de arrastar, telas pouco usadas).
- Lista longa com rolagem virtual.
- Memorizar componentes que redesenham à toa.
- No modo demonstração, gravar no `localStorage` com atraso e agrupado.

### 2.3 Entrega

- Relatório com os números antes e depois, por tela.
- Cada correção num commit separado, para poder reverter uma sem perder as outras.
- Regressão visual das telas comerciais.

## 3. Menu e aba Alunos

### 3.1 Menu do módulo

| Item | Rota | Conteúdo |
| --- | --- | --- |
| Saúde da Jornada | `/educacional` | Cockpit: KPIs, funil, sinais e a lista "Precisam de atenção" |
| Alunos | `/educacional/alunos` | Lista completa, Kanban, busca e filtros |
| Análise de aula | `/educacional/analises` | Envio e revisão das transcrições |
| Configurações | `/educacional/configuracoes` | Sem mudança |

### 3.2 Cockpit (Saúde da Jornada)

- KPIs, funil e sinais continuam como estão.
- A tabela completa sai do Cockpit e vai para a aba Alunos.
- No lugar dela entra **"Precisam de atenção"**: até 10 alunos, ordenados por faixa de saúde (risco primeiro) e depois por dias sem atividade, com o link "Ver todos os alunos".
- Os cliques nos KPIs, no funil e nos sinais levam à aba Alunos com o filtro correspondente já aplicado.

### 3.3 Aba Alunos

Funciona como a aba Leads do comercial.

- **Busca por nome** no topo, com espera de 300 ms ao digitar e mínimo de 2 caracteres (`busca`).
- **Filtros:** etapa, faixa de saúde, status do checkpoint, status do aluno, mentoria, responsável (inclusive "Sem responsável"), sinal e "Mostrar arquivados".
- **Visualização:** Lista ou Kanban, com o mesmo funcionamento da Fase 2 e os mesmos filtros.
- **Ordenação e seletor de colunas** da Fase 2.
- **Botão "+ Novo aluno".**
- **Estado na URL:** filtros, busca, ordem, página e visualização. O botão voltar do Raio-X devolve a lista como estava.
- **Contador:** "N alunos" conforme os filtros, com "Limpar filtros".

## 4. Salvar em lote

Na aba Alunos (lista e Kanban), as alterações deixam de ser gravadas uma a uma. Elas ficam **pendentes** até a pessoa clicar em "Salvar".

### 4.1 Alterações pendentes

- **Edição na tabela e movimento no Kanban** viram alterações pendentes, sem chamar a API.
- **Marca visual:** a célula ou o card alterado ganha um fundo amarelo claro e um ponto, mostrando o valor novo. Passar o mouse mostra o valor anterior.
- **Campo calculado:** o formulário de ajuste pede o motivo na hora da edição, como hoje. O motivo vai junto com a alteração pendente.
- **Desfazer uma alteração:** cada célula ou card pendente tem "Desfazer" no menu de contexto.
- **Mais de uma alteração no mesmo campo:** vale a última. O valor anterior continua sendo o do servidor.

### 4.2 Barra de alterações

Aparece fixa no rodapé quando há alguma alteração pendente:

> **5 alterações em 3 alunos** · Descartar · **Salvar**

- **Salvar** envia tudo num único `POST /api/educacional/lote`.
- **Durante o envio:**
  - a barra mostra "Salvando…";
  - a tela continua navegável;
  - as células dos alunos que estão sendo salvos ficam bloqueadas para edição;
  - nada mais trava.
- **Resultado:**
  - alunos gravados trocam para o `AlunoDetalhe` devolvido e perdem a marca de pendente;
  - alunos com erro continuam pendentes, com o erro ao lado;
  - a barra resume: "4 salvas · 1 com erro".
- **Erro de versão (`409`) num aluno:** o aviso "Este aluno foi alterado por outra pessoa" aparece com duas opções:
  - **Ver versão atual:** descarta as alterações dele e carrega o que está no servidor.
  - **Reaplicar minhas alterações:** carrega a versão atual e reaplica as alterações pendentes por cima, para revisar antes de salvar de novo.
- **Erro de validação:** marca a célula errada com a mensagem.
- **Erro de rede:** nada é perdido. As alterações continuam pendentes, com "Tentar de novo".
- **Descartar** pede confirmação e apaga todas as alterações pendentes.
- **Sucesso:** o Cockpit e os totais são atualizados uma vez, depois do lote.

### 4.3 Proteção contra perda

- Sair do módulo, trocar de rota ou fechar a aba com alterações pendentes pede confirmação.
- As alterações pendentes ficam guardadas no navegador (`sessionStorage`, com `try/catch`). Se a página recarregar por acidente, elas voltam e a barra reaparece.

### 4.4 O que continua imediato

Novo aluno, arquivar e reativar, configurações e confirmação de análise de aula. São ações explícitas, com botão e confirmação próprios, e gravam na hora.

## 5. Análise de aula

Tela nova em `/educacional/analises`, no mesmo espírito do playbook do comercial.

### 5.1 Lista de análises

- Tabela com aluno, data da aula, etapa, status, criada por e data de envio.
- Os status aparecem como selos:
  - Na fila;
  - Processando;
  - Pronta para revisar (em destaque);
  - Erro;
  - Confirmada;
  - Descartada.
- Filtros por status e por aluno. Padrão: "Pronta para revisar" primeiro.
- Botão **"+ Nova análise"**.
- Enquanto houver análise na fila ou processando, a lista se atualiza sozinha a cada 5 segundos. Para quando não houver nenhuma.

### 5.2 Nova análise

1. **Aluno:** campo com busca (`alunos/opcoes`). Quando a tela é aberta pelo Raio-X, o aluno já vem preenchido.
2. **Data da aula:** padrão hoje.
3. **Etapa:** padrão a etapa atual do aluno; pode trocar.
4. **Transcrição:** arrastar o arquivo (`.txt`, `.vtt`, `.srt`, `.docx`, até 5 MB) ou colar o texto. Mostra o nome do arquivo e o tamanho antes de enviar.
5. **Enviar para análise:** a análise entra na fila e a tela volta para a lista com o aviso "Análise enviada. Você pode continuar usando o painel; avisamos quando estiver pronta."

Quando uma análise fica pronta, aparece um aviso discreto em qualquer tela do módulo: "Análise de Fulana pronta para revisar", com link. Ele vem da mesma consulta periódica da lista, que só roda enquanto houver análises pendentes.

### 5.3 Revisão e confirmação

Tela da análise (`/educacional/analises/[id]`), com duas colunas no desktop e empilhada no celular:

| Esquerda: resultado editável | Direita: transcrição |
| --- | --- |
| Resumo (texto editável) | Transcrição completa, com rolagem e busca |
| 4 notas (Consumiu, Entendeu, Aplicou, Validou), cada uma com controle de 0 a 100, justificativa editável e as evidências | Clicar numa evidência destaca o trecho na transcrição |
| Highlights: lista editável (adicionar, editar, remover, reordenar) | — |

No rodapé:

- **Antes de confirmar**, um quadro "O que vai mudar na ficha" mostra o progresso atual de cada nota contra o novo, os highlights que entram e a nova última atividade. Se algum campo de progresso tiver ajuste manual, o quadro avisa que o ajuste continua prevalecendo.
- **Confirmar e gravar na ficha:** envia o resultado revisado e a `versao` do aluno. Com sucesso, mostra o aviso e oferece "Abrir Raio-X do aluno". Com `409`, recarrega o aluno, atualiza o quadro e pede para confirmar de novo.
- **Descartar** (com confirmação).
- **Reprocessar:** gera um novo resultado da IA. Avisa que as edições feitas na tela serão perdidas.

Uma análise com erro mostra a mensagem e o botão "Reprocessar". Uma análise confirmada ou descartada abre só para leitura.

### 5.4 Modo demonstração

No mock, a análise passa por "Na fila" e "Processando" com alguns segundos de espera e devolve um resultado de exemplo coerente com o texto enviado (resumo com as primeiras frases, notas fixas de exemplo, highlights das frases mais longas). A confirmação grava no "banco" do mock com as mesmas regras do backend.

## 6. Raio-X: ficha em lote e aba Aulas

### 6.1 Ficha em lote

O Raio-X passa a ter um único modo de edição para a ficha inteira, em vez de bloco por bloco.

- O botão **"Editar ficha"** no topo deixa todos os blocos editáveis ao mesmo tempo: cabeçalho, indicadores, contrato, progresso, checkpoints, diagnóstico e próxima ação, intervenções, sinais e prova social.
- As alterações ficam pendentes, com a mesma marca visual da aba Alunos.
- Campo calculado alterado pede o motivo na hora, como na tabela.
- **"Salvar ficha"** envia tudo num único `POST /lote` com um aluno. **"Cancelar"** descarta, com confirmação se houver alteração.
- O tratamento de `409`, validação e rede é o mesmo da seção 4.2.
- A proteção contra sair com alterações pendentes (seção 4.3) também vale aqui.
- **Fora do modo de edição:** os botões "Ajustar" e "Voltar ao automático" dos campos calculados, "Arquivar aluno" e "Nova análise de aula" continuam como ações imediatas.

### 6.2 Aba Aulas

O Raio-X ganha uma terceira aba: **Visão geral | Aulas | Histórico**.

- Lista das análises confirmadas do aluno (`analises` no `AlunoDetalhe`), mais recente primeiro, com data da aula, etapa, resumo (com "ver mais") e as 4 notas em barras pequenas.
- Clicar numa análise abre a tela da seção 5.3 em modo leitura.
- Botão **"+ Nova análise de aula"**, que abre a seção 5.2 com o aluno preenchido.
- Sem análises: "Nenhuma aula analisada ainda", com o mesmo botão.

No bloco de progresso da Visão geral, cada nota mostra a origem: "Análise de 20/10", "Ajustado por Fulana" ou "Sem análise nesta etapa".

## 7. Contrato: tipos novos

Acréscimos ao contrato da Fase 2. Nada do que existe muda de formato.

```typescript
// ---------- lote ----------
interface PedidoLote {
  motivo_padrao?: string;
  alunos: {
    aluno_id: string;
    versao: number;
    campos?: Record<string, unknown>;
    ajustes?: ({ campo: string; valor: unknown; motivo?: string } | { campo: string; remover: true })[];
    checkpoints?: Record<string, unknown>[];      // { id, ...mudanças } | { novo: true, ... } | { id, arquivar: true }
    intervencoes?: Record<string, unknown>[];     // idem
  }[];
}

type ResultadoLoteAluno =
  | { aluno_id: string; ok: true; aluno: AlunoDetalhe }
  | { aluno_id: string; ok: false; error: 'versao'; aluno: AlunoDetalhe }
  | { aluno_id: string; ok: false; error: 'validacao'; campo: string; mensagem: string };

interface RespostaLote { lote_id: string; resultados: ResultadoLoteAluno[] }

// ---------- aluno: acréscimos ----------
interface AlunoDetalhe {
  // ...tudo da Fase 2, mais:
  analises: AnaliseResumo[];                       // confirmadas, mais recente primeiro
  progresso_origem: Record<'consumiu' | 'entendeu' | 'aplicou' | 'validou',
    { tipo: 'analise'; analise_id: string; data_aula: string }
    | { tipo: 'ajuste' }
    | { tipo: 'nenhuma' }>;
}

interface OpcaoAluno { id: string; nome: string; mentoria: string; etapa: { id: string; nome: string } }

// ---------- análise de aula ----------
type StatusAnalise = 'na_fila' | 'processando' | 'pronta' | 'erro' | 'confirmada' | 'descartada';

interface NotaProgresso { nota: number; justificativa: string; evidencias: string[] }

interface ResultadoAnalise {
  resumo: string;
  progresso: { consumiu: NotaProgresso; entendeu: NotaProgresso; aplicou: NotaProgresso; validou: NotaProgresso };
  highlights: string[];
}

interface AnaliseResumo {
  id: string; data_aula: string; etapa: { id: string; nome: string };
  resumo: string; notas: { consumiu: number; entendeu: number; aplicou: number; validou: number };
}

interface AnaliseItemLista {
  id: string;
  aluno: { id: string; nome: string };
  data_aula: string;
  etapa: { id: string; nome: string };
  status: StatusAnalise;
  criada_por: { id: string; nome: string };
  criada_em: string;
}

interface AnaliseDetalhe extends AnaliseItemLista {
  arquivo_nome: string | null;
  transcricao: string;
  resultado_ia: ResultadoAnalise | null;
  resultado_confirmado: ResultadoAnalise | null;
  erro: string | null;
  confirmada_por: { id: string; nome: string } | null;
  confirmada_em: string | null;
}
```

Endereços: seção 3 (lote), seção 4 (alunos e opções) e seção 5.2 (análises) da spec do backend da Fase 3.

## 8. Critérios de pronto

**Desempenho**

- [ ] Relatório de diagnóstico entregue antes das correções.
- [ ] Relatório final com números antes e depois por tela, no desktop e no celular.
- [ ] Cada correção num commit separado.
- [ ] Regressão visual das telas comerciais idêntica, salvo melhoria de carregamento.

**Menu e aba Alunos**

- [ ] Menu com os quatro itens.
- [ ] Cockpit com "Precisam de atenção", com cliques levando à aba Alunos filtrada.
- [ ] Aba Alunos com busca, filtros novos, Lista e Kanban, estado na URL.

**Salvar em lote**

- [ ] Edição na tabela e movimento no Kanban viram alterações pendentes, com marca visual e "Desfazer".
- [ ] Barra com contagem, Salvar e Descartar.
- [ ] Salvar envia um único lote. A tela não trava durante o envio.
- [ ] Resultado parcial: alunos com erro continuam pendentes, com "Ver versão atual" e "Reaplicar minhas alterações" no 409.
- [ ] Erro de rede não perde nada.
- [ ] Aviso ao sair com pendências; pendências recuperadas depois de recarregar.
- [ ] Raio-X com "Editar ficha" e "Salvar ficha" em lote.

**Análise de aula**

- [ ] Lista com atualização automática só enquanto houver pendentes.
- [ ] Nova análise com arquivo ou texto colado, e aviso de análise pronta em qualquer tela do módulo.
- [ ] Revisão com edição de tudo, evidências destacando a transcrição e o quadro "O que vai mudar na ficha".
- [ ] Confirmar, descartar e reprocessar, com tratamento de `409`.
- [ ] Aba Aulas no Raio-X e origem de cada nota no bloco de progresso.
- [ ] Tudo funcionando no modo demonstração, com o adapter `api` pronto e desligado.

**Geral**

- [ ] Celular em 390 px em todas as telas novas.
- [ ] Nenhuma rota comercial chamada pelo módulo.
- [ ] Commits por frente. Push só com o ok do Vata.
