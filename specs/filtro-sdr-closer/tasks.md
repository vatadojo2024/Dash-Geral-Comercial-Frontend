# Filtro por SDR (closers) — Tarefas

**Projeto:** Mapa de Calor Comercial (backend na VPS + front Vercel)
**Versão:** 1.0
**Método:** SDD — deriva do `requisitos.md` e do `design.md` (mesma pasta).

**Como executar:** T-01 (backend) primeiro; T-02→T-05 (front) depois; T-06 valida. Não construir nada de "Fora de escopo".

---

## Tarefas

### T-01 — Backend: nome do SDR/closer no GET /api/leads
- [ ] Conferir se a resposta de `GET /api/leads` já traz `sdr_nome` e `closer_nome` por lead.
- [ ] Se NÃO trouxer: incluir os dois, casando `sdr_id`/`closer_id` com a tabela `users` (nome legível). `sdr_id` nulo → `sdr_nome` nulo (ok).
- **Cobre:** RF-05, RNF-03.
- **Pronto quando:** cada lead na resposta tem `sdr_nome` e `closer_nome` (ou null quando não há). **Não tocar no motor de score.** Aplicar/subir o backend antes de testar o front.

### T-02 — Front: nome no lugar do UUID
- [ ] Onde o painel mostra SDR/closer, exibir `sdr_nome`/`closer_nome`. Fallback pro identificador se o nome vier vazio.
- **Cobre:** RF-03.
- **Pronto quando:** nenhum UUID de SDR/closer aparece na tela (aparece o nome).

### T-03 — Front: filtro de SDR derivado dos leads
- [ ] Montar as opções do filtro a partir dos leads carregados: SDRs distintos, valor = `sdr_id`, rótulo = `sdr_nome` (fallback id). Incluir "Todos".
- [ ] Leads com `sdr_id` nulo → opção "Hana"/"Sem SDR".
- **Cobre:** RF-01, RF-04, RNF-01.
- **Pronto quando:** o filtro lista os SDRs presentes nos leads do closer, com nomes legíveis.

### T-04 — Front: aplicar o filtro
- [ ] Selecionar um SDR filtra a lista/heatmap pelos leads daquele `sdr_id`; "Todos" remove. Combina com os outros filtros existentes.
- **Cobre:** RF-02.
- **Pronto quando:** escolher um SDR mostra só os leads dele; "Todos" volta ao normal.

### T-05 — Front: visibilidade do filtro
- [ ] Mostrar o filtro de SDR para **closer** e **admin**; ocultar para papel **SDR**.
- **Cobre:** RF-06.
- **Pronto quando:** closer e admin veem o filtro; SDR não.

### T-06 — Validar
- [ ] Logado como **closer**: o filtro lista só os SDRs que agendaram leads pra ele, com nome; filtrar funciona; sem UUID na tela.
- [ ] Logado como **admin**: o filtro lista os SDRs presentes; filtrar funciona.
- [ ] Lead da Hana aparece no grupo certo; closer sem leads → filtro só "Todos".
- **Cobre:** todos os RF.
- **Pronto quando:** o ciclo funciona pros dois papéis.

---

## Como testar (pré-requisitos)

- Backend da T-01 **no ar** (a resposta de leads traz os nomes).
- Front rodando — em **`http://localhost:3000`** se for local (origem liberada).
- Logins de teste: um **closer** (ex.: Marcio) e o **admin**.

---

## Critério de pronto da etapa

- [ ] Closer tem filtro de SDR com os SDRs dos próprios leads (RF-01, RF-04).
- [ ] Filtrar por SDR funciona (RF-02).
- [ ] Nome no lugar do UUID em todo o painel (RF-03).
- [ ] Lead da Hana/sem SDR tratado (RNF-01); filtro só p/ closer e admin (RF-06).
- [ ] Motor de score intocado (RNF-02).
