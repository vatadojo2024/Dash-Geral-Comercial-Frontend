# Filtro por SDR (closers) — Design

**Projeto:** Mapa de Calor Comercial (backend na VPS + front Vercel)
**Versão:** 1.0
**Método:** SDD — deriva do `requisitos.md` (mesma pasta).

---

## 1. Visão geral

O front **deriva** as opções do filtro de SDR a partir dos leads que já carregou (SDRs distintos), filtra a lista por SDR e mostra **nome** em vez de UUID. Para isso, cada lead precisa **trazer o nome** do SDR e do closer — o backend garante isso na resposta de leads.

Resolve duas coisas com a mesma mudança: o **filtro por SDR** (pedido) e o **UUID no lugar do nome** (pendência antiga).

---

## 2. Backend (mudança mínima)

- **`GET /api/leads`** DEVE incluir, em cada lead, além de `sdr_id`/`closer_id`, os campos **`sdr_nome`** e **`closer_nome`** (o nome vindo da tabela de usuários, casado pelo id).
- **Conferir primeiro:** se a resposta já trouxer esses nomes, não mexer. Se trouxer só os UUIDs, adicionar os nomes (juntar com a tabela `users` por `sdr_id` e `closer_id`).
- Leads sem SDR individual (Hana/pool, `sdr_id` nulo): `sdr_nome` pode vir nulo — o front trata (vira "Hana"/"Sem SDR").
- **Não** alterar o motor de score nem o resto do contrato.

---

## 3. Front

### 3.1 Mostrar nome (RF-03)
- Onde hoje aparece o UUID do SDR/closer, usar `sdr_nome`/`closer_nome`. Fallback: se o nome vier vazio, mostrar o identificador (não quebrar).

### 3.2 Filtro de SDR derivado dos leads (RF-01, RF-04)
- A partir dos leads carregados, montar a lista de SDRs **distintos**: cada opção tem **valor = `sdr_id`** e **rótulo = `sdr_nome`** (fallback id).
- Incluir a opção **"Todos"** (sem filtro).
- Leads com `sdr_id` nulo (Hana/pool) viram uma opção própria: rótulo "Hana" (ou "Sem SDR" se não houver nome), valor representando "sem SDR".

### 3.3 Aplicar o filtro (RF-02)
- Selecionar um SDR filtra a lista/heatmap pelos leads daquele `sdr_id`. "Todos" remove o filtro.
- O filtro de SDR combina com os filtros que já existirem (etapa, temperatura, etc.) — não substitui.

### 3.4 Quem vê (RF-06)
- Exibir o filtro de SDR para **closer** e **admin**. Para papel **SDR**, não exibir (ele só vê os próprios leads).

---

## 4. Edge cases

- **Lead da Hana / sem SDR** (RNF-01): agrupar sob "Hana"/"Sem SDR", sem erro.
- **Nome ausente:** fallback pro identificador, nunca tela quebrada.
- **Closer sem nenhum lead:** filtro fica só com "Todos" (lista vazia de SDRs) — comportamento normal.

---

## 5. O que NÃO fazer

- NÃO criar `GET /api/usuarios` dedicado.
- NÃO consultar o servidor a cada mudança de filtro (é client-side).
- NÃO tocar no motor de score.
