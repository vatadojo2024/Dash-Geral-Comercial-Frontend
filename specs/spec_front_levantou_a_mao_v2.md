# Levantou a Mão — Front V2

**Coluna dono · Agrupamento por SDR · Link para a Clint · KPI de desqualificados** — setembro/2026

Repositório: front Next.js, deploy automático na Vercel.
Base: a aba "Levantou a Mão" já existe dentro de Produtividade SDR, em `/produtividade-sdr/levantou-a-mao`. Este documento especifica os acréscimos da V2.

---

## 1. Contrato consumido

```
GET /api/eventos/oportunidades?de=YYYY-MM-DD&ate=YYYY-MM-DD
Authorization: Bearer <jwt>
```

Resposta:

```json
{
  "de": "...", "ate": "...",
  "eventos": ["WG - 08.09.26"],
  "totais": {
    "no_evento": 412,
    "desqualificados": 23,
    "levantaram_mao": 81,
    "agendaram": 29,
    "pendentes": 52
  },
  "por_dono": [
    { "dono_id": "...", "dono_nome": "Benhur Ramos", "pendentes": 14, "alto_valor": 5 },
    { "dono_id": null, "dono_nome": "Sem dono", "pendentes": 3, "alto_valor": 0 }
  ],
  "leads": [
    {
      "clint_contact_id": "...",
      "clint_deal_id": "...",
      "url_clint": "https://app.clint.digital/deal/...",
      "nome": "...", "telefone": "...", "email": "...",
      "tier": "HMQL", "tier_rank": 4,
      "evento_tag": "WG - 08.09.26",
      "etapa": "Prospecção",
      "dono": { "id": "...", "nome": "Benhur Ramos", "email": "..." },
      "tags": [...], "created_at": "..."
    }
  ],
  "gerado_em": "...", "cache": "hit|miss"
}
```

`leads` contém apenas os pendentes, já ordenados. `dono` e `url_clint` podem vir nulos.

---

## 2. Mudança 1 — KPI de desqualificados

A linha de KPIs passa a ter seis cards:

| Card | Valor | Detalhe |
|---|---|---|
| No evento | `totais.no_evento` | contatos com a tag do ciclo, já sem desqualificados |
| Desqualificados | `totais.desqualificados` | tom neutro, cinza — é conferência, não alerta |
| Levantaram a mão | `totais.levantaram_mao` | % sobre no_evento |
| Agendaram | `totais.agendaram` | % sobre levantaram_mao — taxa de conversão do SDR |
| Pendentes | `totais.pendentes` | destaque visual, é o número que gera ação |
| Alto valor pendente | UMQL+/UMQL/HMQL entre os pendentes | derivado no cliente |

O card de desqualificados não entra no funil nem na tabela: aqueles contatos já saíram da base.

---

## 3. Mudança 2 — coluna dono

Nova coluna "Dono" na tabela de pendentes, entre "MQL" e "Telefone", ordenável por `dono.nome`.

- `dono: null` → badge neutro com o texto "Sem dono"
- Ordenação alfabética, com "Sem dono" sempre no fim, independente da direção

---

## 4. Mudança 3 — filtro e agrupamento por SDR

### 4.1 Chips de dono

Linha de chips multi-seleção logo abaixo dos chips de MQL, mesmo componente e mesmo comportamento client-side.

- Um chip por dono, com a contagem vinda de `totais.por_dono`
- "Sem dono" como último chip
- Nenhum selecionado = todos aparecem
- Combina com o filtro de MQL: os dois se aplicam em série sobre `leads`

### 4.2 Alternador de visão

Controle "Lista | Por SDR" acima da tabela. Padrão: Lista.

**Por SDR:** uma seção por dono, cada uma com cabeçalho contendo nome, total de pendentes e quantos são de alto valor. Seções ordenadas por `pendentes` desc, "Sem dono" por último. Dentro de cada seção, a ordenação padrão da tabela (tier desc).

O filtro de chips continua ativo nesta visão: dono não selecionado não gera seção.

---

## 5. Mudança 4 — botão "Abrir na Clint"

Em cada linha da tabela, ao lado do botão de WhatsApp.

- Ícone com tooltip "Abrir na Clint"
- Abre `lead.url_clint` em nova aba, com `rel="noopener noreferrer"`
- `url_clint` nulo → o botão não é renderizado
- O front **nunca** monta a URL: usa exatamente o valor recebido

Na visão em cards (telas estreitas), o botão fica na mesma linha do WhatsApp.

---

## 6. Export CSV

O CSV do recorte filtrado passa a incluir, na ordem:

```
nome, mql, dono, etapa, telefone, email, evento, entrou_em, url_clint, tags
```

---

## 7. O que permanece da V1

Nada abaixo muda:

- Filtro de data em dois modos: ciclo semanal terça→segunda (componente reaproveitado de "Calls por Ciclo") e intervalo com dois date pickers, máximo 90 dias
- Chips de MQL: UMQL+ | UMQL | HMQL | SMQL | MQL+ | MQL | Sem classificação, com contagem e atalho "Só alto valor"
- Funil horizontal de três blocos com as taxas de passagem
- Barras horizontais de pendentes por tier, clicáveis para filtrar
- Busca por nome, e-mail ou telefone
- Rodapé com `gerado_em`, botão Atualizar e indicação discreta quando `cache: "hit"`
- Sem escopo por papel: todo usuário autenticado vê o time inteiro
- Responsivo: KPIs em grade, funil vertical, tabela em cards

---

## 8. Estados

| Estado | Tratamento |
|---|---|
| Carregando | skeleton nos KPIs e na tabela |
| Zero pendentes | estado positivo: "Todos que levantaram a mão já agendaram" |
| Zero contatos no evento | mensagem + a tag consultada, para conferir se existe na Clint |
| Todos desqualificados | "Nenhum lead ativo neste ciclo" + o número de desqualificados |
| `502 clint_auth` | "Integração com a Clint indisponível. Avise o time técnico." |
| `502 clint_indisponivel` | mesma mensagem + botão "Tentar de novo" |
| `422 intervalo_muito_grande` | "Período muito amplo. Reduza o intervalo." |
| `400` | destacar o campo de data inválido |

---

## 9. Reuso

Sem reescrever: componente de seleção de ciclo, client de API e hook de auth, tokens do tema dark, componentes de KPI card, badge, chip, tabela e tooltip.

Nenhuma cor solta em componente — tudo via tokens.

---

## 10. Critério de pronto

- Build e lint limpos
- Lead com `dono: null` aparece como "Sem dono" na coluna, no chip e como última seção
- Lead com `url_clint: null` não mostra o botão da Clint
- Chips de MQL e de dono combinados filtram corretamente
- "Por SDR" respeita o filtro de chips e a ordenação por tier dentro de cada seção
- CSV exportado contém dono, etapa e url_clint
