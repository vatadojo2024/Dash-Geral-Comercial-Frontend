# Programas e roteiros de checkpoint — Design (frontend)

## 1. Contrato (alinhado com o backend em 28/10)

```typescript
interface Programa {
  id: string;
  nome: string;
  mentoria: "Blackbelt" | "Prime" | "Private";
  duracao_meses: number;
  observacoes: string | null;
  ativo: boolean;
  ordem: number;
}
// GET /config devolve `programas`. Rotas: /config/programas[/:id], no mesmo
// desenho das outras tabelas de configuração. Editar duracao_meses NÃO recalcula
// o término de quem já está no programa (a tela avisa na edição).

// Checkpoint padrão: ganha programa_id; a contagem fica em EXATAMENTE uma de
//   dias_apos_entrada ("Dia N" = início + N dias)
//   meses_apos_inicio ("Mês N" = N meses de calendário; fim do mês quando o dia não existe)
// — a outra null (nunca 0); as duas ou nenhuma → 400. Roteiro: objetivo_contato,
// perguntas_chave, sinais_upsell, estrategia_monetizacao. prazo_sla_dias, big_win,
// ativo e ordem como hoje.

// Aluno: ganha programa_id, programa (aninhado, na linha e no detalhe) e
// data_inicio_programa. `mentoria` continua na resposta, mas não é editável:
// PATCH com mentoria → 400. POST /alunos: programa_id obrigatório, mentoria
// recusada, programa inativo → 400 "programa inativo" (o cadastro lista só ativos).

// Checkpoint do aluno: ganha modelo_id e roteiro (objeto aninhado, ou null quando
// o padrão não tem nenhum dos 4 textos), vindo do checkpoint padrão: editar em
// Configurações muda a resposta seguinte. Novo status `substituido` (sai da
// timeline e do SLA; fica no histórico). ?checkpoint=substituido → 400 (a tela
// não oferece esse valor).

// Troca de programa: UMA rota.
// POST /alunos/:id/programa { programa_id, data_inicio, motivo, versao, simular }
//   simular: true  → prévia, sem gravar
//   simular: false → grava; responde o AlunoDetalhe

// Filtro: GET /alunos?programa_id=uuid1,uuid2
```

**Respostas do backend (28/10, segunda rodada)**
- **Roteiro:** objeto aninhado no checkpoint do aluno (null nos antigos); em Configurações os 4 textos continuam soltos no checkpoint padrão (`corpoDaConfig` envia soltos).
- **Prévia** (`simular: true`): pedido ao backend o formato `{ programa: {id, nome}, data_inicio, data_termino_sugerida, ficam[], saem[], criados[] }` e a simulação sem motivo (o motivo só vai na confirmação). **A confirmar** quando a parte C do backend fechar.
- **Contagem no checkpoint do aluno:** pedidos `dias_apos_entrada` e `meses_apos_inicio`; a tela mostra "Dia N"/"Mês N" a partir deles (ou de `marco`); sem nenhum, mostra só o nome.

**Respostas do backend (28/10, primeira rodada)**
1. **Término na troca:** a troca grava `data_inicio_programa`, `mentoria` e `data_termino` (início + duração).
2. **"Mês N":** meses de calendário a partir do início; no fim do mês cai no último dia. **"Dia N":** início + N dias.
3. **Troca:** os realizados ficam; os não realizados do programa antigo saem da jornada sem ser apagados (status `substituido`); os do programa novo são criados a partir do início escolhido, pulando os de data igual ou anterior à do último realizado.
4. **Roteiro:** referência ao checkpoint padrão; no Raio-X só leitura.

## 2. Telas

- **Novo aluno**: o campo Mentoria vira "Programa" (lista obrigatória, só ativos). Ao escolher o programa ou mudar a entrada, o término sugerido é preenchido se a pessoa não tiver mexido nele (sugestão da tela; o backend valida). O `<datalist>` de mentorias do M1 sai daqui.
- **Raio-X — cabeçalho**: mostra Programa (com a mentoria) e, se houver, a observação num aviso discreto. Em edição, sem campo de mentoria/programa; botão **Trocar programa** ao lado (e "Definir programa" para aluno sem programa, mesmo fluxo).
- **Timeline**: clicar num checkpoint seleciona-o; abaixo da timeline, um painel **Roteiro do contato** com os 4 blocos e o botão "Editar checkpoint" (o formulário de hoje). Ao abrir o Raio-X, o painel já mostra o próximo checkpoint. Avulso: "Checkpoint avulso, sem roteiro".
- **Trocar programa** (diálogo em 2 passos): programa + início (data de entrada | começa hoje | outra data) → "Ver prévia" chama a rota da troca com `simular: true` → três listas (Ficam / Saem / Criados) + término sugerido + motivo → "Confirmar troca". Erros: 400 no campo; 409 = aviso de outra pessoa e recarrega.
- **Configurações**: aba **Programas** (lista ordenável como Etapas; colunas nome, mentoria — Blackbelt, Prime ou Private —, duração, observações; ativar/inativar com o 409 de alunos; aviso na edição: mudar a duração não recalcula o término de quem já está no programa). Aba **Checkpoints padrão**: seletor de programa no topo (filtra a lista e é o programa do item novo); colunas Marco ("Dia N"/"Mês N", validado), Nome, SLA, Big Win; o roteiro abre num diálogo de edição com 4 textos longos.
- **Lista / aba Alunos**: filtro "Programa" com vários ao mesmo tempo (ex.: Blackbelt 6 e 12 meses), opções agrupadas por mentoria. Substitui o filtro de mentoria do M1 (a mentoria sai do programa); a coluna Mentoria continua.

## 3. Modo demonstração
- `config.programas` com os 6; `checkpoints_modelo` refeito com as 6 listas (Big Win marcado no checkpoint "Big Win"); roteiros curtos de exemplo.
- Semente: cada aluno ganha o programa pela mentoria + duração (término − entrada); os checkpoints da semente são refeitos pela lista do programa, mantendo o status por posição no tempo. `VERSAO_DADOS = 3`.
- Mock da troca (regra do backend, item 3): ficam os realizados; os não realizados saem da jornada (marcados como substituídos, fora da timeline e do SLA, com linha no histórico); criados os do programa novo a partir do início, pulando os de data igual ou anterior ao último realizado. Grava início, mentoria e término (início + duração).
- Datas: "Dia N" = início + N dias; "Mês N" = início + N meses de calendário, com o último dia do mês quando o dia não existe.

## 4. O que muda no que já existe
- `dias_apos_entrada` some da tela como número solto: vira o marco "Dia N".
- Filtro de mentoria do M1 → filtro de programa; `mentorias` no `/config` continua (sem uso na tela).
- Cadastro: `mentoria` sai do corpo do POST; sem programa ativo, o campo avisa e manda para Configurações → Programas.
