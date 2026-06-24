# Gerador de Playbook — P2: Aba do Front — Tarefas

**Projeto:** Chat IA-Guia — trilha do gerador de playbook
**Etapa:** P2 de 2
**Versão:** 1.0
**Método:** SDD — deriva do `requisitos.md` e do `design.md` (mesma pasta).

**Onde:** front do Mapa de Calor (Next.js/Vercel), na área do copiloto. Espelhar `src/features/chat/`.
**Como executar:** T-01 → T-06 em ordem, cada uma testável. Não construir nada de "Fora de escopo".

---

## Tarefas

### T-01 — Cliente da API do playbook
- [ ] Criar `src/features/playbook/playbookClient.ts` com as chamadas: criar (POST multipart com arquivo + e-mail/telefone), consultar um (GET /playbooks/{id}), listar (GET /playbooks), apagar (DELETE), usando `NEXT_PUBLIC_CHAT_API_URL` + token de sessão (mesmo padrão do chat).
- **Cobre:** RF-02, RF-06, RNF-01, RNF-04.
- **Pronto quando:** as 4 chamadas existem e mandam o token.

### T-02 — Seletor de aba (Copiloto | Playbook)
- [ ] Na área do copiloto, adicionar o seletor que alterna entre o chat (existente) e a aba Playbook, sem recarregar a página.
- **Cobre:** RF-01.
- **Pronto quando:** dá pra trocar de aba e voltar, mantendo o estado.

### T-03 — Formulário de geração
- [ ] Campo de anexo (`.txt`/`.docx`), campos e-mail/telefone (pelo menos um obrigatório), botão **Gerar playbook** → faz o POST e entra no estado "processando".
- **Cobre:** RF-02.
- **Pronto quando:** anexar + preencher + gerar dispara o POST e muda de estado.

### T-04 — Progresso por polling
- [ ] Estado "processando" com indicador de 3 fases (1 Diagnóstico, 2 Estratégia, 3 Execução); consultar GET /playbooks/{id} a cada ~3s; atualizar a fase; ir para "resultado" quando `pronto`, mostrar erro quando `erro`.
- [ ] Limite ~6–7 min → "tempo esgotado" + reenviar.
- **Cobre:** RF-03, RF-05, RNF-03.
- **Pronto quando:** a barra reflete a fase e a tela reage a pronto/erro/tempo esgotado.

### T-05 — Resultado: render + baixar + copiar
- [ ] Renderizar o `resultado` como markdown com **tabelas e blocos de código** (GFM); botão **Baixar (.md)** (download no cliente); botão **Copiar**; botão **Gerar outro**.
- **Cobre:** RF-04, RNF-02.
- **Pronto quando:** o playbook aparece formatado, baixa como `.md` e copia.

### T-06 — Histórico
- [ ] Lista dos playbooks do usuário (GET /playbooks), mais recente primeiro; clicar num **pronto** reabre o resultado; **apagar** (DELETE) remove.
- **Cobre:** RF-06.
- **Pronto quando:** o histórico lista, reabre e apaga.

---

## Como testar (pré-requisitos)

- O **motor (P1) rodando** (local ou na VPS) e acessível pelo `NEXT_PUBLIC_CHAT_API_URL`.
- **Migration `playbook_jobs` aplicada** no Supabase — sem ela, o POST não grava e o ciclo não fecha.
- Login como qualquer usuário (a aba não depende de papel).
- Uma transcrição `.txt`/`.docx` + e-mail/telefone de um lead real (para a busca no Clint).

> Dica de teste local: rode o front em **`http://localhost:3000`** (a origem liberada no CORS), não pelo IP da rede.

---

## Critério de pronto da etapa (validação final)

- [ ] Aba Playbook alterna com o Copiloto (RF-01).
- [ ] Enviar transcrição + e-mail/telefone gera o job (RF-02).
- [ ] Progresso mostra a fase 1→2→3 (RF-03).
- [ ] Resultado aparece formatado, com baixar `.md` e copiar (RF-04).
- [ ] Erro e "tempo esgotado" tratados (RF-05).
- [ ] Histórico lista, reabre e apaga (RF-06).
- [ ] Tudo sob login, sem segredo no front (RF-07, RNF-04).
