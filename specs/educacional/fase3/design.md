# Módulo Educacional — Fase 3 — Design (frontend)

## Correções de desempenho (uma por commit)
- **Correção 2 — `sdr-dashboard`** — `src/app/api/sdr-dashboard/route.ts`: as três cargas (5 SDR, 7 liderança, vendas) saem num único `Promise.allSettled`; a montagem do payload mantém a regra de hoje (falha SDR → 502 com a mesma mensagem; liderança → `lideranca_erro`; vendas → `[]` e log). `SdrView`: `enabled` do `["sdr-dashboard"]` só em Dashboard SDR, Comissões e Liderança. Teste com API simulada: payload idêntico ao de hoje em sucesso e em cada falha, e as 13 chamadas iniciadas antes de qualquer resposta.
- **Correção 3 — sessão** — `src/lib/auth/supabase.ts` passa a ser importado de forma estática por `dataClient.ts` e `apiEducacional.ts` (sai o `await import()` por chamada). O chunk do Supabase vem junto com a página, em paralelo, em vez de depois do primeiro pedido de dados. Medir de novo para separar o que era Supabase e o que era JavaScript da página.
- ~~Correção 4 — sob demanda~~: fora do plano (26/10).
- **Correção 6 — conferência** — `useConferencia` deixa de esperar a fila: começa com a janela `hoje..hoje+13`, que é exatamente a de hoje quando nenhuma call da fila passa disso. Quando a fila chega e tem call depois de `hoje+13`, a janela (já calculada pela mesma função `janelaDaConferencia`) cresce e a consulta é refeita, como hoje. A chave do cache é a própria janela, então os dados exibidos são sempre os da janela final, idênticos aos de hoje. Teste: janela e dados iguais com fila vazia, fila até `hoje+13` e fila além disso.
- **Correção 7 — cache** — `staleTime` por consulta. 1 min: `["leads",…]`, `["lead",…]`, fila, calendário, conferência e histórico de Agendamentos, Calls por Ciclo. 5 min: `["sdr-dashboard"]`, `["vendas",…]`, `["sdr-comissoes",…]`, `["retencao",…]` e eventos (oportunidades, inscritos, recortes, descartes). `usuarios` segue com 10 min. `refetchOnWindowFocus` fica ligado: no React Query ele só recarrega o que já venceu, o que atende "nada recarrega enquanto o dado vale". "Atualizar" (Button do DS, `secondary sm`, ícone `RefreshCw`, igual ao do Educacional) no cabeçalho de Visão Geral, Dashboard, Leads, detalhe do lead, Agendamentos (fila, calendário e histórico), Sales Ops, Dashboard SDR, Calls por Ciclo, Comissões e Liderança. Ele invalida só as consultas da tela. Oportunidades e Retenção já têm o botão.
- **Correção 8 — Educacional** — linha da tabela e card do Kanban viram componentes `memo` com props estáveis (`useCallback` e funções de gravação estáveis). O esqueleto da tabela ocupa a mesma altura das linhas, e o Cockpit reserva a altura dos blocos.
- **Regressão**: mock local, antes e depois de cada correção, com as mesmas 8 telas de closer e SDR, **só no desktop**, comparadas pixel a pixel (o botão "Atualizar" novo é a única diferença esperada, mostrada lado a lado). Teste unitário de dados iguais em P2 e P6. Cada correção vai para produção só depois de a regressão passar e do resumo enviado ao Vata; os números de produção (desktop) saem depois de cada publicação.

## Contrato (seção 7)
- `contrato.ts`: `PedidoLote`, `ResultadoLoteAluno`, `RespostaLote`, `OpcaoAluno`, `StatusAnalise`, `NotaProgresso`, `ResultadoAnalise`, `AnaliseResumo`, `AnaliseItemLista`, `AnaliseDetalhe`. `AlunoDetalhe` ganha `analises` e `progresso_origem`, com valor padrão (`[]` e `{tipo:"nenhuma"}`) quando a API ainda não manda.
- `apiEducacional.ts`: `salvarLote`, `buscarOpcoesAlunos`, `listarAnalises`, `buscarAnalise`, `enviarAnalise` (multipart), `confirmarAnalise`, `descartarAnalise`, `reprocessarAnalise`. Filtros novos: `busca`, `mentoria`, `faixa_saude`, `responsavel_id` (com `sem`), `status_aluno` múltiplo. O mock aceita também os nomes antigos.
- Proxy `[...caminho]`: repassa o corpo multipart como veio (bytes e `Content-Type` originais), sem forçar JSON. A trava de caminho não muda.

## Mock (único lugar com regra de negócio)
- `servidor.ts`: rotas `lote`, `alunos/opcoes`, `analises`, `analises/:id`, `analises/:id/confirmar|descartar|reprocessar`; `ordem=atencao` (D3); `mentorias` no `/config` (D2).
- **Lote** (`escrita.ts`): cada aluno roda numa cópia do banco. Confere a versão uma vez, aplica campos, ajustes (motivo próprio ou `motivo_padrao`, senão erro de validação), checkpoints e intervenções, incrementa a versão uma vez e grava o histórico com o mesmo `lote_id`. Erro descarta só a cópia daquele aluno. Resposta sempre com o resultado de cada aluno, na ordem do pedido. 400 só para corpo inválido ou mais de 100 alunos.
- **Análise**: o status é derivado do tempo desde o envio (ou reprocessamento): menos de 3 s na fila, menos de 8 s processando, depois pronta. Assim funciona depois de recarregar. Resultado de exemplo determinístico a partir do texto: resumo com as 3 primeiras frases, notas fixas 70/55/40/20, highlights com as 5 frases mais longas, e evidências tiradas do próprio texto. Texto com `#erro` (ou `?simular_analise=erro`) termina em erro, para ver esse caminho. Limpeza de `.vtt`/`.srt` igual à do backend (remove números e marcações de tempo). `.docx` no mock vira um texto de exemplo.
- **Confirmação** (`motor.ts`): progresso automático = notas da análise confirmada mais recente da etapa atual; highlights das análises da etapa atual (até 20); `ultima_atividade` considera a `data_aula`; `analises` e `progresso_origem` no `AlunoDetalhe`. Ajuste manual continua prevalecendo.
- **`/config`** devolve `mentorias` (lista distinta e ordenada das mentorias dos alunos). **Campo mentoria** no novo aluno e na edição (Raio-X e tabela): `<input list>` com as mentorias do `/config`, que sugere enquanto digita e aceita valor novo.
- **Semente (D4, só demonstração)**: uma análise confirmada importada por aluno, com o progresso e os highlights da Fase 1; os ajustes de progresso saem. `VERSAO_DADOS` sobe para 2.

## Alterações pendentes (como são guardadas e marcadas)
- **Onde ficam** — `src/features/educacional/lote/pendencias.ts`: um armazém puro (testável sem React), exposto por `useSyncExternalStore` num provedor da casca do módulo (`ModuloEducacional`). Uma entrada por aluno:
  `{ versao, nome, campos: {campo: {valor, anterior}}, ajustes: {campo: {valor, motivo, anterior} | {remover: true, anterior}}, checkpoints: {id ou temp: {...mudanças} | {novo, ...} | {arquivar}}, intervencoes: {idem}, estado: "pendente" | "salvando" | "erro" | "revisar", erro?: {tipo: "versao", atual} | {tipo: "validacao", campo, mensagem} | {tipo: "rede"} }`.
  `anterior` é o valor do servidor na primeira edição. Editar de novo troca só o `valor` (vale a última). Se o valor voltar a ser igual ao `anterior`, a pendência some.
- **Persistência** — `sessionStorage` (`mdc_edu_pendencias_v1`, com `try/catch`), gravado a cada mudança, com o id do usuário e a versão do formato. Ao abrir o módulo, é validado com Zod, e item inválido é descartado. Pendências de outro usuário no mesmo navegador são ignoradas.
- **Exibição** — a tela não recalcula nada: `comPendencias(aluno, entrada)` só sobrepõe os valores digitados ao aluno do servidor (por exemplo, a etapa nova no card do Kanban). Os calculados do servidor ficam como estão até salvar.
- **Marca** — célula ou card pendente com fundo amarelo claro (token do DS `amarelo` com transparência) e um ponto; ao passar o mouse, um `Balao` com "Antes: X". Menu de contexto (botão direito ou tecla Menu/Shift+F10) com "Desfazer". Bloqueada durante o envio: indicador de "Salvando" e edição desligada.
- **Barra** — fixa no rodapé da casca do módulo: "N alterações em M alunos · Descartar · Salvar"; "Salvando…" durante o envio; depois, "N salvas · M com erro" com "Ver erros", que abre a lista de alunos com erro e as ações de cada um.
- **Envio sem travar** — "Salvar" fotografa as pendências do momento, marca esses alunos como `salvando` e dispara o `POST /lote` sem esperar na tela; a navegação e a edição de outros alunos continuam. O resultado volta pela mesma gravação no cache da Fase 2 (detalhe e listas), e o resumo é invalidado uma única vez no fim.
- **Proteção (D6, aprovada)** — `beforeunload` com pendências; captura de cliques em links que saem do módulo e no seletor Comercial | Educacional, com o diálogo de confirmação do módulo. O seletor fica na Topbar, componente compartilhado: muda uma linha para consultar a guarda, e aviso antes. Voltar pelo navegador para fora do módulo não pode ser bloqueado de forma confiável, mas nada se perde: as pendências continuam no `sessionStorage` e a barra reaparece ao voltar.

## "Reaplicar minhas alterações" (409)
1. O lote devolve `{ error: "versao", aluno: atual }` para aquele aluno. A pendência fica em `erro`, com o `atual` guardado, e a barra mostra "Este aluno foi alterado por outra pessoa" com duas ações.
2. **Ver versão atual**: grava o `atual` no cache (Raio-X e listas) e apaga as pendências do aluno.
3. **Reaplicar minhas alterações**:
   - grava o `atual` no cache;
   - troca a `versao` da pendência pela do `atual`;
   - recalcula o `anterior` de cada campo a partir do `atual`;
   - remove o que já ficou igual ao servidor;
   - remove itens de checkpoint ou intervenção que o servidor arquivou, com aviso;
   - deixa o aluno em `revisar`, com a marca de pendente e um contorno de atenção, até a pessoa clicar em Salvar de novo.
   Nada é enviado sozinho.

## Aviso de análise pronta, sem consulta constante
- Um observador na casca do módulo: consulta `["edu","analises","pendentes"]` = `GET /analises?status=na_fila,processando`, com `refetchInterval` de 5 s **só enquanto a resposta tiver itens**. Sem pendentes, para; o React Query também não consulta com a aba em segundo plano.
- Ele roda uma vez ao abrir o módulo, para recuperar algo enviado antes de recarregar, e volta a rodar quando alguém envia ou reprocessa uma análise (invalidação no próprio envio).
- Quando um id sai do conjunto pendente, uma única leitura de `GET /analises/:id` diz se ficou pronta (aviso "Análise de Fulana pronta para revisar", com link) ou deu erro (aviso de erro).
- A lista de análises não tem consulta própria periódica: quando o observador vê mudança, invalida a lista. É a mesma consulta, como a spec pede.

## Telas

Layout responsivo do design system, sem trabalho nem teste extra para celular (foco no computador).

- **Menu**: Sidebar com os 4 itens (componente compartilhado, só itens do módulo Educacional).
- **Cockpit** (`/educacional`): `Cockpit` atual + `PrecisamDeAtencao` (lista compacta de até 10, mesma `Faixa`, checkpoint e responsável). Os links usam `hrefDoFiltro` apontando para `/educacional/alunos`.
- **Alunos** (`/educacional/alunos`): `TabelaTatica` vira `AbaAlunos`, com busca no padrão do `LeadFilters` (300 ms, mín. 2), filtros novos, contador, Lista | Kanban, pendências e barra. `estado.ts` ganha `busca`, `mentoria`, `faixa_saude`, `responsavel_id`, `status_aluno` múltiplo e mantém os nomes antigos como leitura para links salvos.
- **Raio-X**: `RaioXAluno` com "Editar ficha" (blocos em modo edição ao mesmo tempo, gravando no armazém de pendências; `FormAjuste` em modo "pendente" devolve valor e motivo em vez de gravar), "Salvar ficha" e "Cancelar"; abas Visão geral | Aulas | Histórico; origem de cada nota no progresso. O `useBloco` da Fase 2 sai.
- **Análises**: limite de 4 MB por arquivo na tela, com mensagem clara se passar (D1). `/educacional/analises` (lista), `/educacional/analises/nova?aluno=` (envio), `/educacional/analises/[id]` (revisão ou leitura). Componentes do módulo: `ZonaDeArquivo` (arrastar ou escolher, tipo e tamanho), `NotaEditavel` (faixa 0–100 + número + justificativa + evidências), `ListaDeHighlights` (com o `@dnd-kit/sortable` já aprovado e setas), `Transcricao` (busca e destaque do trecho), `QuadroMudancas`.

## O que reaproveita do design system
- `Card`, `CardHeader`, `CardContent`, `Button`, `Alternador`, `Skeleton`, `EmptyState`, `ErrorState`, `Balao` (antes e depois da pendência, explicações), `KpiChip` (Cockpit) e os tokens de cor (`amarelo`, `sucesso`, `aviso`, `erro`, `cinza`, `cinza-claro`) e de vidro.
- Do próprio módulo (Fase 2): `Dialogo`/`Campo`, `ConfirmarAcao`, `Avisos`, `CelulaEditavel` e editores, `FormAjuste`, `SeletorColunas`, `Faixa`, `BadgeCheckpoint`, `NomeResponsavel`, `EtiquetaDemonstracao`, `useGravacao`.
- Padrões do comercial: busca com espera do `LeadFilters` e estado na URL como na aba Leads.
- Componentes compartilhados alterados: **Sidebar** (itens do módulo) e **Topbar** (seletor de módulo consulta a guarda de saída). Nenhum outro.
