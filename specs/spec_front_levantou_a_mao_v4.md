# Levantou a Mão — Front V4

**Dois funis, matriz sem "sem origem"** — setembro/2026

Repositório: front Next.js, deploy automático na Vercel.
Substitui as specs V3 e V3.1 do front. A V2 (coluna dono, agrupamento por SDR, link da Clint) permanece.

---

## 1. Contrato consumido

```json
{
  "de": "...", "ate": "...", "eventos": ["WG - 15.09.26"],
  "totais": { "inscritos": 171, "desqualificados": 64, "pendentes": 9 },
  "matriz": {
    "ao_vivo": { "acessaram": null, "assistiram": 58, "aplicaram": 20, "agendaram": 11,
                 "taxa_agendamento": 0.55, "pendentes": 9, "alto_valor_pendente": 2 },
    "replay":  { "acessaram": 40, "assistiram": 22, "aplicaram": 6, "agendaram": 2,
                 "taxa_agendamento": 0.333, "pendentes": 4, "alto_valor_pendente": 1 },
    "total":   { "acessaram": 40, "assistiram": 76, "aplicaram": 26, "agendaram": 13,
                 "taxa_agendamento": 0.5, "pendentes": 13, "alto_valor_pendente": 3 }
  },
  "funis": {
    "ao_vivo": { "degraus": [ { "nome": "inscritos", "valor": 171 }, ... ] },
    "replay":  { "degraus": [ { "nome": "acessaram", "valor": 40 }, ... ] }
  },
  "resgate": { "convidados": 2600, "assistiram": 180, "aplicaram": 42,
               "agendaram": 15, "pendentes": 27 } ,
  "por_dono": [...],
  "avisos": [],
  "leads": [ { ..., "origem": "ao_vivo", "assistiu_ao_vivo": true,
               "acessou_replay": false, "assistiu_replay": false,
               "convidado_resgate": false } ]
}
```

`resgate` pode vir `null`. `taxa_agendamento` pode vir `null`. `origem` é sempre `"ao_vivo"` ou `"replay"` em `leads` — não existe terceiro valor.

Campos que deixam de existir e devem ser removidos do front com seus testes: `sem_origem`, `sinais_indisponiveis`, `atribuicao_parcial`, `aplicacao_por_fallback`, o aviso de atribuição parcial, o chip "Sem origem", o badge "Sem origem", e a leitura de `totais.no_evento`, `totais.assistiram`, `totais.levantaram_mao`, `totais.agendaram`.

---

## 2. Matriz

Mesmo container e mesmo layout da V3, com duas mudanças:

- A coluna "Assistiram" passa a ter valor sempre — não há mais travessão por sinal indisponível
- As notas laterais ficam só com Inscritos e Desqualificados

Colunas: Acessaram | Assistiram | Levantaram a mão | Agendaram (valor + %) | Pendentes.
Linhas: Ao vivo | Replay | Total, com Total em destaque.

Travessão apenas onde o dado não se aplica por definição: "Acessaram" na linha Ao vivo, e a porcentagem quando `taxa_agendamento` é `null`.

Clicar em Ao vivo ou Replay filtra a tabela por origem; clicar de novo limpa. Total não filtra.

---

## 3. Dois funis

Mesmo componente `FunilBlocos`, dois blocos empilhados, cada um com escala própria e título:

**Ao vivo**
```
Inscritos → Assistiram → Levantaram a mão → Agendaram → Pendentes
```

**Replay**
```
Acessaram → Assistiram → Aplicaram → Agendaram → Pendentes
```

As taxas de passagem são calculadas no front entre degraus consecutivos: `degrau[i] / degrau[i-1]`. Degrau anterior igual a zero → travessão no lugar da taxa.

Os degraus vêm prontos em `funis.ao_vivo.degraus` e `funis.replay.degraus`, com `nome` e `valor`. O front mapeia `nome` para o rótulo exibido:

| nome | rótulo |
|---|---|
| inscritos | Inscritos |
| acessaram | Acessaram |
| assistiram | Assistiram |
| aplicaram | Levantaram a mão (ao vivo) / Aplicaram (replay) |
| agendaram | Agendaram |
| pendentes | Pendentes |

Ciclo sem nenhum dado de replay (todos os degraus zero): o funil do replay é renderizado com zeros e a nota "Sem replay neste ciclo" — não é escondido, para o time ver que o dado não chegou.

---

## 4. Campanha de resgate

Bloco separado abaixo dos dois funis, título "Campanha de resgate", com o mesmo `FunilBlocos`:

```
Convidados → Assistiram → Levantaram a mão → Agendaram → Pendentes
```

Taxas calculadas no front. `resgate: null` → bloco não renderizado, sem deixar espaço.

Nota discreta: "Convidados que voltaram aparecem também nas métricas do ciclo acima."

---

## 5. Tabela

Coluna "Origem" entre MQL e Dono, com dois badges possíveis: "Ao vivo" e "Replay". Marcadores com tooltip na mesma célula:

- `convidado_resgate` → "Resgate"
- `origem: "ao_vivo"` e `assistiu_replay` → "Viu o replay também"
- `origem: "replay"` e `assistiu_ao_vivo` → "Esteve ao vivo também"

Uma linha por (contato, evento): com intervalo de dois eventos, o mesmo nome pode aparecer duas vezes, diferenciado pela coluna Evento — que passa a ser sempre visível quando `eventos.length > 1`.

Painel lateral do pendente: remover a linha "aplicação identificada por tag sem data".

---

## 6. Chips de origem

```
[Ao vivo] [Replay] [Convidados de resgate]
```

"Sem origem" sai. "Convidados de resgate" continua independente e combinável.

---

## 7. Avisos

Faixa cinza acima da matriz quando `avisos` não vazio, com tradução dos três códigos:

| Código | Frase |
|---|---|
| `assistiram_acima_da_base` | "Assistiram supera a base de inscritos e convidados — verificar tags." |
| `aplicaram_acima_de_assistiram` | "Aplicaram supera assistiram — inconsistência de cálculo, avise o time técnico." |
| `taxa_acima_de_100` | "Há taxa acima de 100% — verificar base." |

Código desconhecido cai numa frase genérica. A chave crua nunca vai para a tela.

A pílula âmbar "verificar base" da V3.1 permanece para taxas de passagem acima de 100% nos funis.

---

## 8. Export CSV

```
nome, mql, origem, resgate, dono, etapa, telefone, email, evento, entrou_em, url_clint, tags
```

---

## 9. O que permanece

Filtro de data em dois modos, chips de MQL com "Só alto valor", chips de dono, alternador "Lista | Por SDR", barras de pendentes por tier, botão "Abrir na Clint", busca, rodapé com `gerado_em` e cache, sem escopo por papel, tokens do tema dark.

Tolerância de contrato: sem `matriz` na resposta, a aba cai nos KPIs da V2.

---

## 10. Critério de pronto

- Build e typecheck limpos
- Nenhuma referência a `sem_origem`, `sinais_indisponiveis`, `atribuicao_parcial` ou `aplicacao_por_fallback` no código
- Os dois funis renderizam com escalas independentes
- Cada funil é monotônico na tela — se um degrau subir, a pílula "verificar base" aparece
- `resgate: null` não deixa espaço vazio
- Mock atualizado: cenário padrão, cenário sem replay, cenário com dois eventos (mesmo lead em duas linhas)
