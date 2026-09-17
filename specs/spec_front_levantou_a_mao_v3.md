# Levantou a Mão — Front V3

**Matriz ao vivo / replay / total · Funil da base convidada** — setembro/2026

Repositório: front Next.js, deploy automático na Vercel.
Base: a aba "Levantou a Mão" está em `/produtividade-sdr/levantou-a-mao` com a V2 (coluna dono, agrupamento por SDR, link da Clint, KPI de desqualificados).

---

## 1. Contrato consumido

Mesma rota, resposta ampliada:

```json
{
  "de": "...", "ate": "...",
  "eventos": ["WG - 08.09.26"],
  "atribuicao_parcial": false,
  "totais": { "inscritos": 412, "desqualificados": 23, "sem_origem": 4, "pendentes": 52 },
  "matriz": {
    "ao_vivo": { "acessaram": null, "assistiram": 138, "aplicaram": 61,
                 "agendaram": 24, "taxa_agendamento": 0.393,
                 "pendentes": 37, "alto_valor_pendente": 12 },
    "replay":  { "acessaram": 96, "assistiram": 54, "aplicaram": 16,
                 "agendaram": 5, "taxa_agendamento": 0.3125,
                 "pendentes": 11, "alto_valor_pendente": 3 },
    "total":   { "acessaram": 96, "assistiram": 192, "aplicaram": 81,
                 "agendaram": 29, "taxa_agendamento": 0.358,
                 "pendentes": 52, "alto_valor_pendente": 15 }
  },
  "resgate": {
    "convidados": 2600, "assistiram": 180, "aplicaram": 42,
    "agendaram": 15, "pendentes": 27,
    "taxa_retorno": 0.069, "taxa_aplicacao": 0.233, "taxa_agendamento": 0.357
  },
  "por_dono": [...],
  "leads": [ { ..., "origem": "ao_vivo", "convidado_resgate": false,
               "acessou_replay": false, "assistiu_replay": false } ],
  "gerado_em": "...", "cache": "hit|miss"
}
```

`resgate` pode vir `null`. `taxa_agendamento` pode vir `null`. `origem` pode ser `"ao_vivo"`, `"replay"` ou `null`.

---

## 2. Mudança 1 — matriz de três linhas

Substitui a linha de KPIs atual. Fica no container existente:

```
p-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center
```

Em telas largas (`sm:`) a matriz ocupa a faixa inteira como tabela compacta. Em telas estreitas, cada linha vira um card empilhado, mantendo o comportamento de `flex-col` do container.

### 2.1 Colunas

| Coluna | Ao vivo | Replay | Total |
|---|---|---|---|
| Acessaram | — | valor | valor |
| Assistiram | valor | valor | valor |
| Levantaram a mão | valor | valor | valor |
| Agendaram | valor + % | valor + % | valor + % |
| Pendentes | valor | valor | valor |

Célula sem dado exibe travessão, não zero. `taxa_agendamento: null` exibe travessão no lugar da porcentagem.

A linha Total recebe peso visual maior (fundo sutil ou borda superior). As linhas Ao vivo e Replay são neutras.

### 2.2 Interação

Clicar numa linha filtra a tabela de pendentes por `origem`. Linha ativa fica destacada; clicar de novo limpa. O filtro combina com os chips de MQL e de dono já existentes.

A linha Total não filtra — ela é o estado sem filtro.

### 2.3 Aviso de atribuição parcial

Quando `atribuicao_parcial: true`, exibir junto à matriz um aviso discreto: "Períodos com mais de um evento podem subcontar aplicações antigas, pois parte das tags não tem data."

Tom informativo, cinza, sem ícone de erro.

---

## 3. Mudança 2 — funil da base convidada

Bloco separado, **abaixo** do funil do ciclo, com título próprio: "Campanha de resgate".

Quando `resgate` vier `null`, o bloco inteiro não é renderizado.

Cinco degraus horizontais:

```
Convidados → Assistiram → Levantaram a mão → Agendaram → Pendentes
```

Com as taxas de passagem entre eles, vindas prontas do backend: `taxa_retorno`, `taxa_aplicacao`, `taxa_agendamento`.

**Escala própria.** Este funil não compartilha eixo nem largura com o funil do ciclo: os denominadores são diferentes e sobrepor as duas leituras confunde. Deixar separação visual clara entre os dois blocos.

Nota discreta sob o bloco: "Convidados voltam a aparecer nas métricas do ciclo acima — são recortes distintos, não parcelas de uma soma."

---

## 4. Mudança 3 — sinais na tabela

Nova coluna "Origem", entre "MQL" e "Dono":

- `ao_vivo` → badge "Ao vivo"
- `replay` → badge "Replay"
- `null` → badge neutro "Sem origem"

Marcadores adicionais na mesma célula, como ícones pequenos com tooltip:

- `convidado_resgate: true` → marcador "Resgate"
- `assistiu_replay: true` em lead de origem ao vivo → marcador "Viu o replay também"

Ordenável por origem, com "Sem origem" sempre no fim.

---

## 5. Mudança 4 — filtros

Nova linha de chips, abaixo dos chips de dono:

```
[Ao vivo] [Replay] [Sem origem] [Convidados de resgate]
```

Multi-seleção, client-side, cada chip com sua contagem. "Convidados de resgate" é um filtro independente dos outros três — pode ser combinado com qualquer um.

Os três conjuntos de chips (MQL, dono, origem) aplicam-se em série sobre `leads`.

---

## 6. Export CSV

Colunas, nesta ordem:

```
nome, mql, origem, resgate, dono, etapa, telefone, email, evento, entrou_em, url_clint, tags
```

`resgate` como "sim" ou vazio.

---

## 7. O que permanece da V2

- Filtro de data em dois modos: ciclo terça→segunda e intervalo com máximo de 90 dias
- Chips de MQL com contagem e atalho "Só alto valor"
- Chips de dono com contagem, "Sem dono" por último
- Alternador "Lista | Por SDR"
- Barras horizontais de pendentes por tier, clicáveis
- Botão "Abrir na Clint" por linha, escondido quando `url_clint` é nulo
- Busca por nome, e-mail ou telefone
- Rodapé com `gerado_em`, botão Atualizar e indicação de cache
- Sem escopo por papel
- Tokens do tema dark, nenhuma cor solta

O KPI "Desqualificados" sai da linha de cards e passa a ser exibido como nota ao lado da matriz, junto com `sem_origem` — os dois são números de conferência, não de ação.

---

## 8. Estados

| Estado | Tratamento |
|---|---|
| Carregando | skeleton na matriz, nos funis e na tabela |
| Zero pendentes | "Todos que levantaram a mão já agendaram" |
| Zero inscritos no ciclo | mensagem + a tag consultada |
| Todos desqualificados | "Nenhum lead ativo neste ciclo" + o número de desqualificados |
| Sem dados de replay no ciclo | linha Replay com travessões, sem mensagem de erro |
| `resgate: null` | bloco não renderizado |
| `502 clint_auth` | "Integração com a Clint indisponível. Avise o time técnico." |
| `502 clint_indisponivel` | mesma mensagem + "Tentar de novo" |
| `422 intervalo_muito_grande` | "Período muito amplo. Reduza o intervalo." |
| `400` | destacar o campo de data inválido |

---

## 9. Reuso

Sem reescrever: componente de seleção de ciclo, client de API e hook de auth, tokens do tema dark, KPI card, badge, chip, tabela, tooltip, componente de funil (reaproveitado com escala própria para o bloco de resgate).

---

## 10. Critério de pronto

- Build e lint limpos
- A linha Total bate com a soma de Ao vivo + Replay + Sem origem na coluna Levantaram a mão
- Clicar em Ao vivo filtra a tabela; clicar de novo limpa
- `resgate: null` não renderiza o bloco nem deixa espaço vazio
- `taxa_agendamento: null` exibe travessão, nunca 0%
- Matriz legível em tela estreita, com as linhas empilhadas
- CSV contém origem e resgate
