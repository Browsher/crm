# Empresas Excel e filtros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. TDD em cada tarefa.

**Goal:** importar o modelo XLSX diretamente e filtrar Empresas como Prospecção.
**Architecture:** adaptador de arquivo reaproveita análise de domínio; consulta SQL de Empresas ganha interseção de filtros e opções existentes. Sem dependências entre features.
**Tech Stack:** Next.js, React, TypeScript, PostgreSQL, Vitest, Playwright; leitor XLSX escolhido após documentação oficial.
**Spec:** docs/superpowers/specs/2026-09-14-empresas-excel-filtros-design.md

## Global Constraints

- Branch codex/empresas-visual, PR38 aberto. Sem merge. Preservar PREFERENCIAS.md, AGENTS.md, CONTINUIDADE-CODEX.md locais.
- Gestor obrigatório, conferência sem gravação, confirmação reanalisa arquivo original. Sem migração ou Railway.
- TDD real e revisão por tarefa. Não refazer Fila, Carteira ou Meu dia.

### Task 1: XLSX direto

**Files:** src/features/empresas/arquivo.ts (novo) e arquivo.test.ts; planilha.ts (extrair análise de linhas se preciso), servico.ts e testes relacionados; app/empresas/importar/acao.ts e testes, formulario.tsx e testes; package.json/package-lock.json. Testes de navegador da importação podem ser atualizados nesta tarefa; não alterar listagem/filtros.
**Interfaces:** entrada File na action, bytes no serviço existente. Definir adaptador explícito de formato preservando compatibilidade dos chamadores CSV. Resultado reaproveita relatório atual, erros de arquivo tipados e mensagens.
- [ ] RED: arquivo XLSX real (modelo gerado), zeros, linha vazia numerada, fórmula/corrupção, limite e CSV legado.
- [ ] Conferir documentação oficial e dependência; implementar mínimo para GREEN. Não escolher silenciosamente uma entre várias abas de dados.
- [ ] RED/GREEN da action: guarda antes da leitura, erro recuperável, reanálise na confirmação. Atualizar texto e accept do input e testes que usam label.
- [ ] Auto-revisar; registrar comandos/resultados e limites; revisão independente antes da tarefa seguinte.

### Task 2: Filtros de Empresas

**Files:** src/features/empresas/consulta.ts e consulta.test.ts, listagem.ts; app/empresas/page.tsx, formulario.tsx (novo), empresas.module.css, paginacao.tsx e testes; tests/integracao/empresas-listagem.test.ts e tests/e2e/empresas-visual.spec.ts.
**Interfaces:** Consulta preserva termo/padrao/cnpjPrefixo/pagina e adiciona filtros validados. Resultado de parsing inválido explícito. Endereço canônico e paginação compartilham montagem para não perder selects.
- [ ] RED: parsing/dependências/inválidos; canonicalização q vazio conserva filtros; paginação conserva todos; limpar/new search reinicia.
- [ ] GREEN: filtro AND no SQL parametrizado e leitura de opções no contexto gestor. Conferir contrato empresa_filtros e CEP ibge nos arquivos SQL.
- [ ] RED/GREEN: selects acessíveis com dependências iguais à Prospecção; busca mantém nome/CNPJ.
- [ ] Integração real com fixtures distinguindo cada filtro e interseção, Não informado e vendedor negado.
- [ ] Auto-revisar e revisão independente.

### Task 3: Verificação e PR

**Files:** testes E2E de Empresas, inventário unitário, documentação de execução.
- [ ] E2E XLSX real com conferência sem gravação, confirmação e CSV regressivo; filtros dependentes, vazio, limpar, paginação.
- [ ] Typecheck, lint, db:checar, unitários/inventário, integração, build e E2E local. Usar harness local.
- [ ] Capturas reais em três tamanhos e dois temas; revisão final independente e correções pertinentes.
- [ ] Commit na branch existente, atualizar título/corpo do PR38 e conferir CI no SHA final. Entregar para aprovação visual sem merge.
