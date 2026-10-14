# Módulo Educacional — Requisitos (frontend)

Fonte da verdade: `specs/educacional_frontend.md`. Plano aprovado em 14/10/2026.

## Navegação e acesso
- **R1** A sessão ganha `modulos` (`comercial` | `educacional`), lido de `GET /api/me`. Sem o campo (API antiga ou cookie antigo), é deduzido das `areas` vindas do servidor, nunca do papel.
- **R2** Nova área `educacional` (admin e educacional), rota `/educacional`. Na lista do admin entra por último: a home dele continua a Visão Geral.
- **R3** Pós-login: só `educacional` → `/educacional`; os demais, home atual.
- **R4** Menu só com os itens do módulo ativo; para closer/SDR/marketing, nada muda.
- **R5** Admin: seletor Comercial | Educacional na barra superior, leva à home do módulo e lembra a escolha em `localStorage` (try/catch).
- **R6** Guard nos dois sentidos, no servidor, antes de renderizar: `/educacional/*` exige a área `educacional`; as páginas comerciais seguem com `exigirArea`.
- **R7** Nenhuma busca de dado comercial para o educacional (menu sem links comerciais → sem prefetch; busca de lead escondida).
- **R8** Textos neutros no módulo educacional (inclusive admin quando alternar para ele): subtítulo da Sidebar "Saúde da Jornada"; título e descrição próprios nas páginas do módulo. Área comercial sem mudança.
- **R9** Mock do `/api/me` só local: `ME_MOCK_EDUCACIONAL=1` (ignorado na Vercel) completa `modulos` e a área `educacional` quando a API ainda não os manda.
- **R10** No módulo: 401 → login; 403 → home do módulo permitido, sem exibir conteúdo. Telas comerciais ficam como estão.

## Dados e telas
- **R11** Adapter `apiEducacional.ts`, modo `mock | api` via `NEXT_PUBLIC_EDU_DATA_SOURCE` (padrão `mock`); modo `api` pronto e desligado.
- **R12** Contrato da seção 8 em Zod, tolerância aluno a aluno (e checkpoint/intervenção a item no Raio-X).
- **R13** `data_educacional.json` com 14 alunos cobrindo 5 etapas, 4 status de checkpoint, 3 riscos, adimplentes e inadimplentes, com e sem sinais; teste automático das regras da seção 9.
- **R14** Telas das seções 4–7 com carregando/vazio/erro por bloco, responsivas, cores semânticas fixas.
- **R15** Modo mock mostra a etiqueta "Dados de demonstração" no cabeçalho do módulo; some no modo `api`.

## Decisões
- **D1** Login sempre leva à home comercial do admin; a memória do seletor vale ao reabrir o painel já logado pela página inicial.
- **D2** Raio-X só como página (`/educacional/alunos/[id]`), com voltar preservando os filtros. Gaveta fica para depois.
- Backend fica para depois. Push para a `main` só com ok, depois dos screenshots.
