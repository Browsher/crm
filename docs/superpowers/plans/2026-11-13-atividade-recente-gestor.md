# Plano de implementação de Atividade recente

- [x] Escrever a regressão de integração para entregas confirmadas, buscas antigas ou incompletas, filtros, escopo e eventos comerciais. Implementar a consulta em `src/features/gestao/atividade.ts` com ordenação e paginação no servidor.
- [x] Escrever regressões do painel lateral. Criar o componente em `app/gestao`, com estado de carregamento, filtros, detalhes e restauração do foco. Aplicar os tokens, controles e painel lateral já usados no CRM.
- [x] Integrar a Gestão e o perfil em `app/gestao/page.tsx` e `app/usuarios/vendedores/[id]/page.tsx`. Validar acesso e filtros na ação de consulta. Preservar os indicadores e os painéis existentes.
- [x] Validar com dados sintéticos no navegador e no PostgreSQL isolado. Executar lint, tipos e revisão independente.
- [ ] Verificar o CI da PR.
