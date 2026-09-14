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
- [x] RED: arquivo XLSX real (modelo gerado), zeros, linha vazia numerada, fórmula/corrupção, limite e CSV legado.
- [x] Conferir documentação oficial e dependência; implementar mínimo para GREEN. Não escolher silenciosamente uma entre várias abas de dados.
- [x] RED/GREEN da action: guarda antes da leitura, erro recuperável, reanálise na confirmação. Atualizar texto e accept do input e testes que usam label.
- [x] Auto-revisar; registrar comandos/resultados e limites; revisão independente antes da tarefa seguinte.

### Task 2: Filtros de Empresas

**Files:** src/features/empresas/consulta.ts e consulta.test.ts, listagem.ts; app/empresas/page.tsx, formulario.tsx (novo), empresas.module.css, paginacao.tsx e testes; tests/integracao/empresas-listagem.test.ts e tests/e2e/empresas-visual.spec.ts.
**Interfaces:** Consulta preserva termo/padrao/cnpjPrefixo/pagina e adiciona filtros validados. Resultado de parsing inválido explícito. Endereço canônico e paginação compartilham montagem para não perder selects.
- [x] RED: parsing/dependências/inválidos; canonicalização q vazio conserva filtros; paginação conserva todos; limpar/new search reinicia.
- [x] GREEN: filtro AND no SQL parametrizado e leitura de opções no contexto gestor. Conferir contrato empresa_filtros e CEP ibge nos arquivos SQL.
- [x] RED/GREEN: selects acessíveis com dependências iguais à Prospecção; busca mantém nome/CNPJ.
- [x] Integração real com fixtures distinguindo cada filtro e interseção, Não informado e vendedor negado.
- [x] Auto-revisar e revisão independente.

### Task 3: Verificação e PR

**Files:** testes E2E de Empresas, inventário unitário, documentação de execução.
- [x] E2E XLSX real com conferência sem gravação, confirmação e CSV regressivo; filtros dependentes, vazio, limpar, paginação.
- [x] Typecheck, lint, db:checar, unitários/inventário, integração, build e E2E local. Usar harness local.
- [x] Capturas reais em três tamanhos e dois temas; revisão final independente e correções pertinentes.
- [ ] Commit na branch existente, atualizar título/corpo do PR38 e conferir CI no SHA final. Entregar para aprovação visual sem merge.

## Registro de execução em 14/09/2026

- Excel direto implementado em 811b526; filtros em d398014; jornadas em 4b8d557; proteção final de caminhos XLSX em dbc44e6.
- Unitários: 838 passaram, 1 pulado; inventário 839. Integração local: 429 passaram, 1 pulado. Build E2E, typecheck, lint e convenções de migração passaram.
- Navegador no build final: 32 passaram. Modelo XLSX baixado pela interface foi conferido sem escrita e importado ao confirmar. Filtros combinados, dependências, paginação e rascunhos não enviados foram exercitados.
- Capturas em 390/820/1280, claro/escuro. Banco temporário final teste_3974ec9c461b removido pelo harness. Nenhuma migração nova.
- Revisão independente fechou os achados de expansão estrutural, zeros em máscaras, controles após paginação e caminhos alternativos/normalizados no ZIP. Regressões do leitor interceptam a expansão perigosa para comprovar a recusa antes de consumir memória.
- PR38 permanece sem merge. Conferir CI no SHA enviado e solicitar validação visual dos ajustes.

### Decisões durante a execução

1. Usar a aprovação já dada para registrar a especificação e implementar os dois ajustes, sem repetir a mesma pergunta. Se o entendimento divergir, o custo é revisar o escopo antes do merge.
2. Conservar branch e PR existentes, conforme solicitado, preservando arquivos pessoais. A alteração será revisada junto da tabela/importação original.
3. Usar carregamento determinístico do ExcelJS com fiscalização estrutural prévia; a tentativa de leitura streaming apresentou corrida de inicialização. Estruturas incomuns são recusadas e seus dados devem ser copiados para o modelo.
4. Completar a correção do residual de normalização de caminhos encontrado na revisão final, apesar do limite de uma onda do roteiro de revisão. Publicar com a falha estrutural aberta não era aceitável; o custo foi uma rodada adicional de testes e revisão focada, sem nova funcionalidade.