# Alinhamento da prévia de Prospecção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execução inline já escolhida pelo usuário; revisão independente final.

**Goal:** Aplicar ao CRM todas as telas da central de Prospecção aprovadas no mockup v10.
**Architecture:** Central de navegação, consulta pessoal autorizada no Postgres e formulário do banco ligado ao contrato oficial. Editor legado preservado por URL explícita.
**Tech Stack:** Next 16.3.8, React 19.2.8, TypeScript, Postgres, shadcn, Vitest e Playwright existentes.
**Spec:** docs/superpowers/specs/2026-10-23-alinhamento-previa-prospeccao-design.md

## Global Constraints

- Branch codex/redesign-crm e PR #55; nunca editar o checkout principal.
- Não ativar integrações reais ou aplicar migrações remotas.
- Preservar RLS, quotas, UUID idempotente, rascunho e histórico.
- Sem dependência nova ou importação entre features.
- A prévia aprovada é a direção visual; não redesenhar novamente.

## Review Focus

- Origem ou nicho de outro vendedor não pode vazar por opções de filtros.
- Empresa em duas origens aparece uma vez, com ambas as origens.
- Pesquisa sem resultados e navegação após reserva não devem perder rascunho.
- Filtro extra não pode ser ignorado silenciosamente pela API ou banco.
- Consulta antiga e importação repetida preservam o mesmo contrato e quota.

### Task 1: Central e consulta pessoal

**Files:** app/fila/page.tsx, central.tsx, central.module.css; app/fila/localizar/{page,legado,pessoal}.tsx; src/server/prospeccao-pessoal.ts; src/lib/prospeccao-pessoal.ts; db/migracoes/0043_prospeccao_pessoal.sql; tests/integracao/prospeccao-pessoal.test.ts.
**Interfaces:** produz `lerEmpresasPessoais(usuarioId,filtros)` com empresas únicas, opções de nicho/bairro e situações autorizadas; consome dados Google/CNPJ e fila existentes.

- [ ] Escrever testes de união, isolamento, filtros nicho/bairro/origem e carteira trabalhada; executar e observar RED.
- [ ] Criar leitura no banco, parser de filtros e repositório; central com botões e consulta com filtros recolhíveis, tags e paginação de 20. Ler Reservar e Formulario existentes antes de compor ações.
- [ ] Executar testes de integração e componentes até GREEN; typecheck.
- [ ] Conferir branch exata antes de commit `feat: alinhar central e consulta pessoal à prévia`.

### Task 2: Banco de empresas completo

**Files:** app/fila/buscar/{page,formulario,acoes}.tsx/ts; src/features/busca-empresas/{tipos,filtros}.ts; src/server/cnpj-biz/cliente.ts; db/migracoes/0044_busca_filtros_completos.sql; testes vizinhos e doc de migração.
**Interfaces:** produz filtros adicionais opcionais versionados compatíveis com FiltrosBusca antigos; consome consulta pessoal da Task 1 após importação.

- [ ] Testar RED para múltiplas regiões/CNAEs, faixas e deduplicação fixa no pedido HTTP; SQL recusa adulteração e conserva idempotência.
- [ ] Implementar seis cartões, sugestões de nome, multisseleção e mapeamento exato do OpenAPI oficial. Adicionar contagem somente pelo endpoint oficial e sem repetir consulta paga.
- [ ] Rodar unidade, integração CNPJ e db:checar até GREEN.
- [ ] Conferir branch e commit `feat: aplicar filtros completos do banco de empresas`.

### Task 3: Planejamento e jornadas integradas

**Files:** app/fila/google/page.tsx, google.module.css; tests/e2e/prospeccao-previa.spec.ts; dados de prévia existentes e docs/design.
**Interfaces:** navega da central para planejamento/banco/consulta e desta para o atendimento existente; consome Tasks 1 e 2.

- [ ] Testar RED para os acessos e filtros do fluxo aprovado, incluindo recolher ao pesquisar e endereço dependente do nicho.
- [ ] Ajustar navegação do Google, espaçamento/tokens e estados de carregamento conforme mockup. Atualizar fixtures fictícias para mostrar ambas as origens.
- [ ] Executar lint, typecheck, build, unidades, integrações afetadas e jornadas. Comparar quatro telas em desktop/celular nos dois temas. Atualizar servidor 3100 e capturas.
- [ ] Conferir branch e commit `test: validar telas integradas da prévia`.

### Task 4: Revisão independente e entrega

**Files:** pacote de revisão e ledger próprios deste plano; ajustes importantes encontrados com testes RED→GREEN.
**Interfaces:** consome diff completo e evidências Tasks 1–3; produz PR atualizado e prévia navegável.

- [ ] Revisor novo lê spec, plano, diff e telas comparadas; verificar explicitamente Review Focus e cobertura visual do v10.
- [ ] Corrigir Critical/Important numa passagem com teste falhando primeiro e verificações verdes; registrar limites reais.
- [ ] Atualizar PR #55 e mostrar prévia real. Manter evidências locais conforme decisão anterior da revisão automática.
