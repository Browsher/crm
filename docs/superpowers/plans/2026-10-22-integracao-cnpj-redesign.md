# Integração CNPJ.biz no redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir e operar CNPJ.biz e redesign juntos na prévia local.
**Architecture:** Merge local das branches existentes, adaptação visual e harness isolado com fornecedor simulado; nenhuma mudança das regras do fornecedor ou do banco.
**Tech Stack:** Next.js 16.3.8, React 19, shadcn existente, PostgreSQL local, Vitest e Playwright.
**Spec:** docs/superpowers/specs/2026-10-22-integracao-cnpj-redesign-design.md

## Global Constraints

- Preservar todas as regras de servidor, UUID, cota, importação, RLS e dados manuais descritas na spec.
- Não modificar o checkout compartilhado nem ativar integração em produção.
- Reutilizar os componentes e tokens aprovados; não instalar novas dependências.
- Testes falhando antes das alterações correspondentes; revisão independente ao final.

## Review Focus

- Remontagem do formulário em refresh/navegação não deve criar cobrança repetida; conferir UUID e consulta persistida.
- Telefone cadastral não pode vazar para vendedor fora de posse/reserva; conferir limites de autorização nas fichas combinadas.
- Fonte Google deve continuar navegável com limite zero/pausa do CNPJ.biz; conferir fontes e listas.
- Nomes e endereços longos devem permanecer legíveis em 390 px e nos dois temas.
- Simulação deve ser exclusiva do harness, sem aceitar chave real ou banco remoto e sem interceptação em produção.

### Task 1: Combinar branches e adaptar telas

**Files:** cabeçalho app/fila/page.tsx; app/fila/buscar/page.tsx; app/empresas/busca/page.tsx; fichas de gestor/Carteira; src/components/crm/caminho.tsx, busca-empresas.module.css e dados-cadastrais.tsx; tests/e2e/busca-redesign.spec.ts.
**Interfaces:** Consome PR56 b4ea0a2 e redesign 4b50b43. Produz rotas de busca e metadados dentro das abas autorizadas, com navegação comum.

- [ ] Escrever teste de acesso pelos dois atalhos de Prospecção e executar contra a prévia anterior. Expected: FAIL, Buscar empresas ausente.
- [ ] Incorporar origin/codex/campanhas-email com merge sem commit; resolver somente conflitos reais combinando funcionalidades.
- [ ] Aplicar cabeçalho, superfícies, grade responsiva, links de fonte e estilos de metadados. Preservar handlers e estado dos formulários.
- [ ] Validar unitários relevantes, typecheck e lint. Expected: PASS. Commit da integração.

### Task 2: Prévia funcional e regressões integradas

**Files:** scripts/e2e/run.mts; testes e fixtures novos em tests/e2e/; preload restrito ao harness; src/e2e-ambiente.test.ts.
**Interfaces:** Consome rotas e ambiente sanitizado. Produz vendedor redesigne2e com limite e resultados fictícios, fonte Google e mock local exclusivo do processo de teste.

- [ ] Acrescentar teste de consulta real do formulário contra fornecedor simulado, retorno persistido, refresh sem outra cobrança, importação e dados nas abas. Executar antes do mock/fixture. Expected: FAIL por bloqueio de consulta sem configuração.
- [ ] Implementar fixture e mock com guarda de banco descartável e chave fictícia; integrar ao harness junto do mock WhatsApp existente. Não criar endpoint de configuração na aplicação.
- [ ] Rodar jornadas de busca e redesign nos temas e em 390/1440 px. Expected: PASS. Commit.

### Task 3: Verificação, revisão e entrega da prévia

**Files:** docs/design/2026-10-22-redesign/integracao-cnpj-biz.md e relatório de validação; PR55.
**Interfaces:** Consome implementação combinada. Produz evidência, revisão independente e servidor local persistente de demonstração.

- [ ] Rodar unitários, integração, build, typecheck, lint, db:checar e jornadas do navegador apropriadas. Expected: PASS.
- [ ] Preparar pacote do delta desde 4b50b43 e despachar revisor independente com spec, plano e rulings; corrigir achados materiais com RED→GREEN.
- [ ] Atualizar documentação/PR55 sem integrar à main; publicar commits na branch do redesign.
- [ ] Atualizar a prévia local com banco descartável e simulação, validar entrada como vendedor e gestor e deixar Buscar empresas aberto. Expected: consulta, resultados, importação e gestão visíveis, sem fornecedor real.
