# Módulo Educacional — Design (frontend)

## Pastas
```
src/app/(private)/educacional/layout.tsx        guard exigirArea("educacional") + metadata neutro
src/app/(private)/educacional/page.tsx          Cockpit + Tabela tática
src/app/(private)/educacional/alunos/[id]/page.tsx   Raio-X
src/app/api/educacional/**                      proxies do modo api (desligados)
src/lib/educacional/contrato.ts                 tipos + Zod da seção 8
src/lib/educacional/apiEducacional.ts           adapter mock | api
src/lib/educacional/rotulos.ts                  enum → rótulo e cor semântica
src/lib/mock/data_educacional.json              { resumo, alunos: AlunoDetalhe[] }
src/features/educacional/*                      telas
```

## Navegação
- Guard: `exigirArea` (layout do módulo e páginas comerciais). Módulo ativo = caminho (`/educacional*`); `modulos` decide o seletor do admin.
- Sidebar: cada item tem `modulo`; o item "Saúde da Jornada" é do módulo educacional.
- Home (`/`): quem tem os dois módulos e não acabou de logar (`?entrada=login`) volta ao módulo lembrado no navegador.

## Adapter
- `buscarResumo()`, `buscarAlunos(filtros)` → `{ itens, total, descartados }`, `buscarAluno(id)`, `criarIntervencao(dados)`.
- Mock: lê o JSON; aplica filtro, ordem e página de 25 com os parâmetros da seção 8.3. Health Score, risco, sinais e dias estagnados vêm prontos.
- Intervenções do mock: registro em memória por aluno, somado ao Raio-X até recarregar.
- Api: proxies `/api/educacional/*` (Bearer da sessão, trava pela área `educacional`).
- Parâmetros: listas separadas por vírgula (`checkpoint=pendente,nao_respondeu`); `health_max` é EXCLUSIVO (`health_max=50` → Health Score abaixo de 50); `ordem` = campo, com `-` para decrescente; padrão `risco` (Risco → Atenção → Saudável, depois dias estagnados desc). **Alinhar com o backend.**

## Estado da tela
Filtros, ordem, página e Lista | Kanban na URL; os cliques do Cockpit escrevem nesses parâmetros; o Raio-X volta para a mesma URL.
