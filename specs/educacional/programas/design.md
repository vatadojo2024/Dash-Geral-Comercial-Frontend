# Programas e roteiros de checkpoint — Design (frontend)

## 1. Contrato proposto ao backend

Acréscimos. Nada do que existe muda de formato, exceto onde indicado.

```typescript
interface Programa {
  id: string;
  nome: string;              // "Blackbelt 6 meses"
  mentoria: string;          // "Blackbelt" — é o que a tela mostra como mentoria
  duracao_meses: number;     // 6 | 12
  observacao: string | null; // "Em que momento solicitar indicação? ..."
  ordem: number;
  ativo: boolean;
}

interface Roteiro {
  objetivo: string | null;
  perguntas_chave: string | null;
  sinais_upsell_renovacao: string | null;
  estrategia_monetizacao: string | null;
}

// Config: ganha `programas: Programa[]`.
// CheckpointModelo: ganha
//   programa_id: string;
//   marco: string;          // "Dia 0", "Dia 3", "Mês 1"… — substitui `dias_apos_entrada` na tela
//   roteiro: Roteiro;
// (`dias_apos_entrada` pode continuar na resposta; a tela deixa de editá-lo.)

// Checkpoint (do aluno): ganha
//   marco: string | null;   // null no checkpoint avulso
//   roteiro: Roteiro | null;// lido do checkpoint padrão (referência); null no avulso

// AlunoLinha: ganha `programa: { id, nome, mentoria, duracao_meses } | null`
//   (null = aluno antigo, sem programa). `mentoria` continua vindo (= programa.mentoria).
// AlunoDetalhe: ganha `data_inicio_programa: string | null` e
//   `programa_observacao: string | null`.

// Escritas
// POST /alunos: `programa_id` obrigatório; `mentoria` sai do corpo (o backend preenche).
// PATCH /alunos/:id: `programa_id` NÃO é aceito (troca só pela rota abaixo).
// POST /alunos/:id/programa/previa  { programa_id, inicio }            → PreviaTroca
// POST /alunos/:id/programa         { programa_id, inicio, motivo, versao } → AlunoDetalhe

interface PreviaTroca {
  programa: { id: string; nome: string };
  inicio: string;
  data_termino_sugerida: string;
  ficam: { id: string; nome: string; marco: string | null; status: StatusCheckpoint; data_prevista: string | null }[];
  saem:  { id: string; nome: string; marco: string | null; status: StatusCheckpoint; data_prevista: string | null }[];
  criados: { nome: string; marco: string; data_prevista: string }[];
}

// Configuração: POST/PATCH /config/programas[/:id] (como as outras coleções,
// devolvem a config inteira). Inativar programa com alunos: 409
// { error: "programa_com_alunos", alunos: N } (igual à etapa).
// GET /alunos?programa_id=a,b (lista por vírgula).
```

**Respostas do backend (28/10)** — os nomes finais de rotas e campos virão do plano do backend; até lá o front segue com os desta proposta e ajusta depois.
1. **Término na troca:** a troca grava `data_inicio_programa`, `mentoria` e `data_termino` (início + duração). Por isso o aluno usa o nome `data_inicio_programa` (e não `programa_inicio`).
2. **"Mês N":** meses de calendário a partir do início; no fim do mês cai no último dia (31/01 + 1 mês = 28/02). **"Dia N":** início + N dias.
3. **Troca:** os realizados ficam; os não realizados do programa antigo saem da jornada sem ser apagados (o backend vai propor um status, ex.: `substituido`) — não aparecem na timeline nem contam no SLA, mas ficam no histórico; os do programa novo são criados a partir do início escolhido, pulando os que caem em data igual ou anterior à do último realizado. A tela tolera um checkpoint `substituido` que chegue na lista: ele é retirado sem aviso.
4. **Roteiro:** é referência, não cópia. O backend devolve os 4 textos junto com o checkpoint do aluno, lidos do checkpoint padrão. No Raio-X o roteiro é só leitura; a edição fica em Configurações.

## 2. Telas

- **Novo aluno**: o campo Mentoria vira "Programa" (lista obrigatória, só ativos). Ao escolher o programa ou mudar a entrada, o término sugerido é preenchido se a pessoa não tiver mexido nele (sugestão da tela; o backend valida). O `<datalist>` de mentorias do M1 sai daqui.
- **Raio-X — cabeçalho**: mostra Programa (com a mentoria) e, se houver, a observação num aviso discreto. Em edição, sem campo de mentoria/programa; botão **Trocar programa** ao lado (e "Definir programa" para aluno sem programa, mesmo fluxo).
- **Timeline**: clicar num checkpoint seleciona-o; abaixo da timeline, um painel **Roteiro do contato** com os 4 blocos e o botão "Editar checkpoint" (o formulário de hoje). Ao abrir o Raio-X, o painel já mostra o próximo checkpoint. Avulso: "Checkpoint avulso, sem roteiro".
- **Trocar programa** (diálogo em 2 passos): programa + início (data de entrada | começa hoje | outra data) → "Ver prévia" chama `/previa` → três listas (Ficam / Saem / Criados) + término sugerido + motivo → "Confirmar troca". Erros: 400 no campo; 409 = aviso de outra pessoa e recarrega.
- **Configurações**: aba **Programas** (lista ordenável como Etapas; colunas nome, mentoria, duração, observação; ativar/inativar com o 409 de alunos). Aba **Checkpoints padrão**: seletor de programa no topo (filtra a lista e é o programa do item novo); colunas Marco ("Dia N"/"Mês N", validado), Nome, SLA, Big Win; o roteiro abre num diálogo de edição com 4 textos longos.
- **Lista / aba Alunos**: filtro "Programa" com vários ao mesmo tempo (ex.: Blackbelt 6 e 12 meses), opções agrupadas por mentoria. Substitui o filtro de mentoria do M1 (a mentoria sai do programa); a coluna Mentoria continua.

## 3. Modo demonstração
- `config.programas` com os 6; `checkpoints_modelo` refeito com as 6 listas (Big Win marcado no checkpoint "Big Win"); roteiros curtos de exemplo.
- Semente: cada aluno ganha o programa pela mentoria + duração (término − entrada); os checkpoints da semente são refeitos pela lista do programa, mantendo o status por posição no tempo. `VERSAO_DADOS = 3`.
- Mock da troca (regra do backend, item 3): ficam os realizados; os não realizados saem da jornada (marcados como substituídos, fora da timeline e do SLA, com linha no histórico); criados os do programa novo a partir do início, pulando os de data igual ou anterior ao último realizado. Grava início, mentoria e término (início + duração).
- Datas: "Dia N" = início + N dias; "Mês N" = início + N meses de calendário, com o último dia do mês quando o dia não existe.

## 4. O que muda no que já existe
- `dias_apos_entrada` some da tela (coluna e formulário).
- Filtro de mentoria do M1 → filtro de programa; `mentorias` no `/config` continua (sem uso na tela).
- Cadastro: `mentoria` sai do corpo do POST quando a API tiver programas.
