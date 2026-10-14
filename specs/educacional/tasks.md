# Módulo Educacional — Tasks (frontend)

- [x] 1. Spec e plano no git.
- [x] 2. Sessão e áreas: `modulos` + área `educacional` (contrato, `/api/me`, cookie, mock `ME_MOCK_EDUCACIONAL`), testes.
- [x] 3. Navegação: guard do layout, menu por módulo, seletor do admin, textos neutros, home.
- [x] 4. Dados: contrato Zod, adapter, JSON mock, testes da seção 9 e de tolerância.
- [x] 5. Telas: Cockpit, Tabela (Lista/Kanban), Raio-X, modal, estados, responsivo, etiqueta de demonstração.
- [x] 6. Proxies do modo api (desligados).
- [x] 7. Verificação: rede como educacional, URL direta nos dois sentidos, alternância do admin, regressão closer/SDR, screenshots.
- [x] 8. Typecheck, testes, commits por etapa.
- [ ] 9. Push para a main — aguardando o ok depois dos screenshots.

## Verificação (14/10/2026, login de demonstração, adapter em mock)
- Educacional: navegou Cockpit, filtros, ordenação, Kanban, modal e Raio-X — 22 requisições, nenhuma a rota comercial.
- Educacional abrindo 11 rotas comerciais por URL direta → /educacional (redirect no servidor, sem conteúdo).
- Closer e SDR abrindo /educacional → home deles.
- Admin: login → Visão Geral; seletor alterna as áreas; reabrir pela home volta ao módulo lembrado; login sempre na home comercial (D1).
- Regressão: 8 telas de closer e SDR idênticas pixel a pixel à versão anterior ao módulo (58100bd).
