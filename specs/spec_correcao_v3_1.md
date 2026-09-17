# Levantou a Mão — Correção V3.1

**A busca não pode usar tags sem data** — setembro/2026

Corrige a V3. Aplica-se ao backend; o front recebe dois ajustes menores de exibição.

---

## 1. Diagnóstico

A V3 incluiu `Participou`, `Levantou a mão` e `Preencheu Aplicação - Replay` no `tag_names` enviado à Clint.

Como `tag_names` opera em OR e essas três tags são acumuladas historicamente, sem vínculo com ciclo, a consulta deixou de retornar os inscritos do ciclo e passou a retornar toda a base que já teve qualquer uma delas.

Efeito observado no ciclo WG - 15.09.26:

| Métrica | Exibido | Esperado |
|---|---|---|
| Inscritos | 171 | 171 |
| Assistiram (ao vivo) | 1292 | ≤ 171 |
| Levantaram a mão (total) | 819 | ≤ 171 |
| Sem origem | 588 | próximo de 0 |
| Pendentes | 699 | ≤ 171 |

Consequências secundárias: donos de negócios antigos entrando nos filtros (incluindo pessoas fora da empresa) e taxas de passagem acima de 100% no funil.

---

## 2. Correção 1 — busca apenas por tags datadas

O CSV enviado em `tag_names`, tanto para `/contacts` quanto para `/deals`, contém **somente** as tags datadas do ciclo:

```
WG - DD.MM.AA
Participou WG - DD.MM.AA
Convite Resgate WG - DD.MM.AA
Acessou Replay WG - DD.MM.AA
Assistiu Replay WG - DD.MM.AA
Levantou a mão WG - DD.MM.AA
Preencheu Aplicação - Replay WG - DD.MM.AA
```

As três tags sem data **nunca** entram no `tag_names`. Elas são lidas do array `tags` que cada contato retornado já traz.

Isso restaura o comportamento da V1: a base é o conjunto de inscritos do ciclo mais os convidados da campanha de resgate.

---

## 3. Correção 2 — papel das tags sem data

Substitui integralmente a regra 2.2 da spec V3.

As três tags têm naturezas diferentes e não podem receber o mesmo tratamento.

### 3.1 Presença ao vivo — sem fallback

`Participou` sem data não informa nada sobre o ciclo consultado: um inscrito de hoje pode ter participado de um evento de meses atrás.

- `participou_ao_vivo` só é verdadeiro com `Participou WG - DD.MM.AA`
- Quando nenhum contato da base tem a tag datada do ciclo, o sinal é **indisponível**: `matriz.ao_vivo.assistiram = null`, e a resposta traz `sinais_indisponiveis: ["participou"]`
- Nunca derivar presença ao vivo da tag sem data

### 3.2 Aplicação — fallback permitido

`Levantou a mão` e `Preencheu Aplicação - Replay` sem data sustentam o relatório desde a V1, e dentro de uma base restrita ao ciclo a distorção é pequena.

- Usar a tag datada quando existir no contato
- Na ausência dela, aceitar a versão sem data
- Sempre que qualquer contato for classificado pelo fallback, `atribuicao_parcial: true`

A regra "só vale com um evento no intervalo" deixa de existir: com a base restrita, o fallback é aceitável em qualquer intervalo, desde que sinalizado.

### 3.3 Sinal auxiliar

Contato cuja aplicação veio só da tag sem data recebe `aplicacao_por_fallback: true` no payload, para o front poder marcá-lo se quiser.

---

## 4. Correção 3 — travas de sanidade

Validações no fim do cálculo, antes de responder. Cada uma acrescenta uma entrada em `avisos: string[]`:

| Condição | Aviso |
|---|---|
| `matriz.total.assistiram > totais.inscritos` | `"assistiram_acima_de_inscritos"` |
| `matriz.total.aplicaram > totais.inscritos + resgate.convidados` | `"aplicaram_acima_da_base"` |
| `totais.sem_origem > totais.inscritos * 0.5` | `"sem_origem_elevado"` |
| qualquer taxa calculada > 1 | `"taxa_acima_de_100"` |

Os avisos não bloqueiam a resposta. Servem para que um erro de base apareça como erro, e não como número plausível.

---

## 5. Correção 4 — coerência de exibição (front)

- Quando `matriz.replay` está inteiramente indisponível, `acessaram` no Total mostra travessão, não `0`
- `matriz.ao_vivo.assistiram = null` mostra travessão na célula e, no lugar da taxa do funil, o rótulo "sem dado"
- Taxa de passagem acima de 100% no funil não é exibida como porcentagem: mostra alerta discreto em âmbar com o texto "verificar base"
- `avisos` não vazio → faixa cinza acima da matriz listando os avisos em linguagem direta

---

## 6. Campos novos ou alterados na resposta

```json
{
  "atribuicao_parcial": true,
  "sinais_indisponiveis": ["participou"],
  "avisos": [],
  "matriz": {
    "ao_vivo": { "assistiram": null, "...": "..." }
  },
  "leads": [ { "...": "...", "aplicacao_por_fallback": true } ]
}
```

`assistiram` passa a aceitar `null`. O schema Zod precisa refletir isso.

---

## 7. Testes a acrescentar

- CSV de `tag_names` enviado à Clint **não contém** `Participou`, `Levantou a mão` nem `Preencheu Aplicação - Replay` — verificar por asserção no mock do client
- contato com `Participou` sem data e sem a datada → `participou_ao_vivo: false`
- nenhum contato com `Participou WG - DD.MM.AA` → `matriz.ao_vivo.assistiram: null` e `sinais_indisponiveis: ["participou"]`
- contato com `Levantou a mão` sem data → conta, `aplicacao_por_fallback: true`, `atribuicao_parcial: true`
- contato com a datada e a sem data → conta uma vez, `aplicacao_por_fallback: false`
- base com `assistiram > inscritos` → aviso `"assistiram_acima_de_inscritos"`
- taxa calculada acima de 1 → aviso `"taxa_acima_de_100"`
- regressão: identidade `ao_vivo + replay + sem_origem = total` continua válida com `assistiram: null`

---

## 8. Validação contra dado real

Antes de considerar pronto, com o token no ambiente local, rodar o ciclo WG - 15.09.26 e conferir:

- `totais.inscritos` próximo de 171
- `matriz.total.aplicaram` menor ou igual a `inscritos + resgate.convidados`
- `totais.sem_origem` próximo de zero
- nenhum dono de negócio fora da equipe atual nos filtros
- `avisos` vazio

Se `sem_origem` continuar alto com a base corrigida, o próximo suspeito é a campanha de resgate trazendo contatos legitimamente sem tag do ciclo — o que é esperado e não é erro.
