# Gerador de Playbook — P2: Aba do Front — Requisitos

**Projeto:** Chat IA-Guia — trilha do gerador de playbook
**Etapa:** P2 de 2 (a aba; o motor é a P1, já pronto)
**Versão:** 1.0
**Método:** SDD — este documento é a fonte da verdade. O código deriva dele.

---

## Objetivo da etapa

Criar a **aba do gerador de playbook** no front do Mapa de Calor (Next.js/Vercel), **alternando com a aba do chat**. O usuário envia a **transcrição + e-mail/telefone do lead**, acompanha o **progresso (fase 1→2→3)** e recebe o **playbook na tela** com **botão de baixar**.

O motor (P1) já existe e responde nos endpoints `/playbooks`. Esta etapa é só a **tela**.

---

## Glossário rápido

- **Aba que alterna:** dentro da área do copiloto, um seletor troca entre **Copiloto** (chat) e **Playbook** (gerador).
- **Polling:** a tela pergunta ao serviço, de tempos em tempos, "já ficou pronto?" — porque o playbook leva alguns minutos.

---

## Requisitos

### RF-01 — Aba Playbook alternando com o Chat
- A área do copiloto DEVE ter um seletor entre **Copiloto** (o chat atual) e **Playbook** (a nova aba). Trocar de aba não recarrega a página.

### RF-02 — Enviar transcrição + identificar o lead
- A aba DEVE ter: um campo para **anexar a transcrição** (`.txt` ou `.docx`), campos para **e-mail e/ou telefone** do lead, e um botão **Gerar playbook**.
- Ao gerar, a tela chama o serviço (POST) e passa a acompanhar o job.

### RF-03 — Mostrar o progresso (fase 1→2→3)
- Enquanto processa, a tela DEVE mostrar em qual **fase** está: **1 — Diagnóstico**, **2 — Estratégia**, **3 — Execução** (lendo o status + fase do job por polling).
- O usuário entende que leva alguns minutos (não é instantâneo).

### RF-04 — Mostrar o resultado + baixar
- Quando ficar **pronto**, a tela DEVE **exibir o playbook** (markdown renderado, com títulos e tabelas) e oferecer um botão **Baixar (.md)**.
- Botão **Copiar** (para a área de transferência) é desejável.

### RF-05 — Tratar erro e demora
- Se o job der **erro**, a tela mostra uma mensagem clara e permite **tentar de novo**.
- Se passar do tempo esperado sem terminar (limitação do processo longo), a tela mostra **"tempo esgotado"** e permite reenviar.

### RF-06 — Histórico dos playbooks
- A aba DEVE listar os **playbooks anteriores do usuário** (mais recente primeiro); clicar em um **reabre** (mostra o resultado); e permite **apagar**.

### RF-07 — Restrito ao login
- A aba usa o **login** já existente (mesmo token de sessão do chat). Só aparece para usuário logado.

---

## Requisitos não-funcionais

- **RNF-01 — Mesmo front, mesmo endereço:** vive no front do Mapa de Calor; fala com o serviço via `NEXT_PUBLIC_CHAT_API_URL` (o mesmo do chat).
- **RNF-02 — Markdown com tabelas e blocos:** o playbook usa títulos, tabelas e blocos de código (scripts) — o renderizador precisa suportar isso (GFM).
- **RNF-03 — Polling tolerante:** intervalo de ~3s, com limite generoso (cobrindo ~6–7 min) antes de "tempo esgotado".
- **RNF-04 — Sem segredo no front:** nada de token de Clint/Supabase no navegador; o front só usa o token de sessão do usuário.

---

## Fora de escopo (não fazer nesta etapa)

- **Export bonito** (.docx/.pdf) — por ora o download é `.md`. Formatado fica para depois.
- **Mudar o motor (P1)** — a aba só consome os endpoints.
- Edição do playbook na tela, compartilhamento por link, notificações.
