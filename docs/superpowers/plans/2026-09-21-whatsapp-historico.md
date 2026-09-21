# Histórico armazenado do WhatsApp Implementation Plan

> **For agentic workers:** executar inline com superpowers:executing-plans; não delegar.

**Goal:** consultar no CRM as páginas anteriores já armazenadas na Evolution, mantendo leitura exclusiva de gestor e atualização automática.

**Architecture:** ampliar o adaptador com paginação de 50 e limite temporal estável; uma Server Action autorizada carrega as próximas páginas. O painel acumula registros por conversa/ID, preserva seleção e funde novas amostras com o histórico carregado.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-21-whatsapp-gestor-evolution.md`, seção Histórico armazenado.

## Restrições

- Somente leitura, instância e chave definidas no servidor, papel gestor conferido a cada requisição.
- Reutilizar `findMessages` com `page`, `offset: 50` e filtro `where.messageTimestamp.gte/lte` do código oficial 2.3.7 já consultado.
- Molde para action: `app/meu-dia/historico-acao.ts`; não exportar valores de módulo `use server`.
- Nenhuma mudança no Sync Full History, banco do CRM ou associação a vendedores.

## Tarefas e validação

1. Adaptador (`src/server/whatsapp/evolution.ts` e teste): teste vermelho de segunda página com limite temporal fixo; implementar `lerPaginaMensagens(pagina, limiteHistorico)` e retornar `temMais`/`limiteHistorico`. Testar primeira página e fim do histórico.
2. Action (`app/whatsapp/historico-acao.ts` e teste): teste vermelho para recusa de usuário/página/data antes de consulta; implementar guarda de gestor, validação e erro explícito sem detalhes internos.
3. Painel (`app/whatsapp/painel.tsx`, `painel.dom.test.tsx`, `page.tsx`, `page.test.tsx`, CSS): testar carga, preservação em refresh, deduplicação, seleção, clique duplo, fim e repetição após erro. Implementar botão e estado acumulado após os testes vermelhos.
4. Rodar testes de WhatsApp e diretivas, typecheck e lint. Validar paginação real retornando somente contagens, sem imprimir mensagens ou chave. Revisar diff e commitar apenas esta fatia na branch existente. O push permanece bloqueado pela revisão automática anterior até autorização específica do remoto.

## Limites

Histórico disponível é o armazenado pela Evolution. A ação não garante recuperar conteúdo antigo do celular. Paginação com limite temporal evita deslocamento por mensagens novas, mas não fornece isolamento de importações tardias/exclusões na origem.

## Verificação executada

- Testes escritos e observados falhando antes da implementação do adaptador, action e botão.
- 175 testes passaram: WhatsApp, diretivas de servidor e documentação. Typecheck e lint dos arquivos WhatsApp passaram.
- Leitura real pelo adaptador em 21/09/2026, usando a instância piloto e um único limite temporal: total informado 592, 12 páginas, 592 registros normalizados e 592 pares conversa/ID únicos. A saída da verificação continha apenas contagens, sem conteúdo das mensagens ou credenciais.
- Essa leitura valida o histórico armazenado na instância no momento da consulta, não a totalidade do histórico do celular.
