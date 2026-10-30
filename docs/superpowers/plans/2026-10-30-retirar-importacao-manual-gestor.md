# Retirada da importação manual do gestor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Retirar o método manual de importação do gestor, mantendo as consultas, Listas e todos os dados existentes.

**Architecture:** Desativar o acesso web e sua escrita no servidor e revogar a função SQL exclusiva em uma migração nova. As origens automáticas usam caminhos separados. Substituir a preparação via formulário nos testes por fixtures administrativas do harness temporário.

**Tech Stack:** Next.js 16.4.1, TypeScript, PostgreSQL 18, Vitest e Playwright existentes.

**Spec:** `docs/superpowers/specs/2026-10-30-retirar-importacao-manual-gestor-design.md`

## Global Constraints

- Listas continua no menu e com administração disponível.
- Não apagar, arquivar nem modificar dados de produção nesta tarefa.
- Não mudar as buscas do Banco nem as entregas do Google.
- Não editar migrações existentes; próxima migração é 0059.
- Nenhuma dependência nova, segredo ou mudança de ambiente.
- Branch e PR; nenhuma integração ou publicação automática.

## Review Focus

- Cabeçalhos de erro e estados vazios também deixam de oferecer importação.
- URL digitada diretamente respeita o papel antes de redirecionar.
- Aba antiga não consegue gravar por ação remanescente ou privilégio SQL.
- Fixtures não usam produção e preservam a cobertura das jornadas ainda válidas.
- Novo SQL não toca os cadastros e não revoga funções do Banco/Google.

### Task 1: Retirar o método manual completo

**Files:** páginas `app/empresas/page.tsx`, `app/empresas/grupos/page.tsx`, rota/ação/componentes de `app/empresas/importar/`; nova migração `db/migracoes/0059_retirar_importacao_manual.sql`; catálogo e testes de invariantes; testes de páginas, integração, E2E e documentação operacional afetados.

**Interfaces:** Guardas existentes `exigir('gestor')`, redirecionamento `/empresas`, funções próprias de importação automática do Banco/Google conservadas.

- [ ] Ajustar testes existentes para o novo contrato e observar falhas esperadas antes do código.
- [ ] Retirar botões, textos e formulário; bloquear/remover ação, mantendo autorização e destino correto da rota antiga.
- [ ] Criar migração que revoga EXECUTE da função manual, ajustar invariantes e verificar negação ao papel da aplicação.
- [ ] Adaptar fixtures das jornadas de Listas/atendimento; retirar testes exclusivos da funcionalidade encerrada, preservando os demais fluxos.
- [ ] Rodar testes relevantes, tipos, lint e checagem SQL. Regenerar inventário unitário quando necessário.
- [ ] Revisão independente de conformidade e qualidade; corrigir achados materiais.
- [ ] Criar PR contra main, acompanhar CI e reportar o resultado sem integrar nem publicar.
