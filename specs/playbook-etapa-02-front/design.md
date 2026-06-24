# Gerador de Playbook — P2: Aba do Front — Design

**Projeto:** Chat IA-Guia — trilha do gerador de playbook
**Etapa:** P2 de 2
**Versão:** 1.0
**Método:** SDD — deriva do `requisitos.md` (mesma pasta).

---

## 1. Visão geral

Uma **aba Playbook** dentro da área do copiloto, ao lado da aba do chat. O usuário anexa a transcrição, informa e-mail/telefone, clica em **Gerar**; a tela cria o job no serviço, acompanha o **progresso por polling** e, no fim, mostra o **playbook** com botão de **baixar**. Tudo conversando com o motor da P1.

---

## 2. Onde mora

- Front do **Mapa de Calor** (Next.js/Vercel), na mesma área onde já vive o chat.
- Fala com o **serviço de chat** via `NEXT_PUBLIC_CHAT_API_URL`, com o **token de sessão** do usuário (mesmo esquema do chat).
- Sugestão de organização: `src/features/playbook/` (cliente + componentes), espelhando `src/features/chat/`.

---

## 3. Estrutura da tela

**Seletor de aba** (no topo da área do copiloto): **Copiloto** | **Playbook**. Trocar não recarrega a página (estado local).

**Aba Playbook — 3 estados:**

1. **Formulário** (inicial):
   - Anexar transcrição (`.txt`/`.docx`).
   - E-mail do lead / Telefone do lead (pelo menos um).
   - Botão **Gerar playbook**.
   - Abaixo, o **histórico** (lista dos playbooks anteriores).

2. **Processando**:
   - Barra/indicador com 3 etapas: **1 — Diagnóstico**, **2 — Estratégia**, **3 — Execução**, destacando a fase atual (lida do job).
   - Texto de apoio: "Isso leva alguns minutos."

3. **Resultado**:
   - O playbook **renderizado** (markdown com títulos/tabelas/blocos).
   - Botões: **Baixar (.md)** e **Copiar**.
   - Botão **Gerar outro** (volta ao formulário).

---

## 4. Endpoints consumidos (do motor P1)

- **POST `/playbooks`** — envio multipart: arquivo da transcrição + e-mail e/ou telefone. Resposta: `id` + `status`.
- **GET `/playbooks/{id}`** — status + fase + resultado. Usado no **polling** e para reabrir do histórico.
- **GET `/playbooks`** — lista dos jobs do usuário (histórico).
- **DELETE `/playbooks/{id}`** — apaga um do histórico.

Todas com o token de sessão no cabeçalho (mesmo do chat).

---

## 5. Fluxo de geração (polling)

1. Usuário anexa o arquivo + e-mail/telefone → **Gerar**.
2. Front faz **POST /playbooks** → recebe o `id` → entra no estado **Processando**.
3. Front consulta **GET /playbooks/{id}** a cada **~3s**:
   - `status = processando` → atualiza a fase (1/2/3) na barra.
   - `status = pronto` → vai para **Resultado** (mostra `resultado`).
   - `status = erro` → mostra mensagem + **Tentar de novo**.
4. **Limite de tempo:** após ~6–7 min sem terminar, mostra **"tempo esgotado"** + reenviar (cobre o caso de o serviço ter reiniciado no meio).

---

## 6. Resultado + download

- **Renderizar** o `resultado` como markdown (com suporte a **tabelas e blocos de código** — GFM).
- **Baixar (.md):** transformar o texto do `resultado` num arquivo `.md` e baixar no navegador (lado do cliente). Nome sugerido: `playbook_<lead-ou-data>.md`.
- **Copiar:** copia o texto do `resultado` para a área de transferência.

---

## 7. Histórico

- Lista os jobs do usuário (GET `/playbooks`), mais recente primeiro, mostrando algo identificável (lead/data/status).
- Clicar em um item **pronto** → reabre (GET `/playbooks/{id}`) e mostra o resultado.
- **Apagar** (DELETE) remove o item.

---

## 8. Segurança e segredos

- O front usa **apenas** o token de sessão do usuário. Nada de token de Clint/Supabase/Anthropic no navegador (isso vive no serviço).

---

## 9. O que NÃO fazer

- NÃO criar export .docx/.pdf (download é `.md` por ora).
- NÃO alterar o motor (P1) — só consumir os endpoints.
- NÃO editar/compartilhar o playbook na tela; sem notificações.

---

## 10. Quem vê a aba

- Por padrão, **qualquer usuário logado** vê a aba Playbook (consistente com o motor P1).
- *Opcional (decisão sua):* se quiser restringir a closers/admin, é um ajuste pequeno de visibilidade — não obrigatório nesta etapa.
