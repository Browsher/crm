# WhatsApp piloto: leitura no CRM Implementation Plan

> **For agentic workers:** execute inline in this task. Use TDD for each code change.

**Goal:** gestor consulta no CRM as mensagens recentes da instância de teste da Evolution, sem capacidade de enviar ou marcar como lidas.

**Architecture:** `app/whatsapp` exige papel gestor antes de consultar a Evolution. Um adaptador em `src/server/whatsapp` lê uma página limitada de mensagens com chave apenas no servidor, valida e reduz o payload; a interface apresenta conversas da amostra. O número piloto não recebe vínculo de vendedor.

**Tech Stack:** Next.js 16.3.4 App Router, TypeScript, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-21-whatsapp-gestor-evolution.md`, somente a primeira fatia de leitura. Métricas, persistência, webhooks e vínculo dos vendedores são etapas posteriores dessa spec.

## Global Constraints

- `features/` não importa outra `features/`; a integração fica em `server/`.
- `gestor` somente, autorizado antes do fetch. A chave não usa prefixo `NEXT_PUBLIC_`.
- A única chamada Evolution é `POST /chat/findMessages/{instanceName}`. Nenhum endpoint de envio ou leitura de status.
- A página explicita que mostra apenas uma amostra recente e que o número é de teste.
- Não registrar conteúdo real de mensagens, chave ou payload completo nos testes/logs.

---

### Task 1: Adaptador de consulta e redução de mensagens

**Files:** `src/server/whatsapp/evolution.test.ts`, `src/server/whatsapp/evolution.ts`, `.env.example`.

**Interface:** `lerMensagensRecentes(): Promise<{ configurado: boolean; total: number; mensagens: Mensagem[] }>`; `Mensagem` tem `id`, `conversa`, `nome`, `direcao`, `texto`, `em`. Falhas de infraestrutura sobem para a página, sem revelar segredo.

- [ ] Escrever teste falhando que injeta `fetch` sintético e verifica URL codificada, `apikey`, corpo `{"page":1,"offset":50,"sort":"desc"}`, redução de mensagem recebida/enviada e ausência de leitura/escrita.
- [ ] Rodar `npm run test:unit -- src/server/whatsapp/evolution.test.ts` e observar falha do comportamento ausente.
- [ ] Implementar fetch server-only, limite de 50, validação de HTTPS/configuração e normalização de payload conhecido.
- [ ] Rodar o teste novamente até passar.
- [ ] Incluir teste de configuração ausente e payload inválido, com falha antes da implementação de cada comportamento.

### Task 2: Página autorizada e painel de leitura

**Files:** `app/whatsapp/page.test.tsx`, `app/whatsapp/page.tsx`, `app/whatsapp/layout.tsx`, `app/whatsapp/painel.tsx`, `app/whatsapp/error.test.tsx`, `app/whatsapp/error.tsx`, `app/whatsapp/whatsapp.module.css`, `src/components/crm/shell.test.tsx`, `src/components/crm/shell.tsx`.

**Interface:** rota `/whatsapp` exige `gestor`, renderiza resultado do adaptador e seleciona conversa no navegador sem enviar chamadas à Evolution. Sidebar mostra WhatsApp somente ao gestor.

- [ ] Escrever teste falhando da página: `exigir('gestor')` precede a consulta, total/amostra aparecem, nenhum formulário ou controle de envio aparece.
- [ ] Rodar `npm run test:unit -- app/whatsapp/page.test.tsx` e observar falha.
- [ ] Implementar layout guardado, página e painel de leitura usando o shell existente e CSS Module.
- [ ] Rodar o teste novamente até passar.
- [ ] Estender teste do shell com link exclusivo do gestor, observar falha, implementar link e testar novamente.

### Task 3: Verificação e entrega

**Files:** somente os arquivos da fatia e esta documentação.

- [ ] Rodar testes direcionados, `npm run typecheck`, `npm run lint` e `npm run build`.
- [ ] Revisar diff e confirmar que a chave não está em bundle, URL, log ou commit; que não há ação de envio/status.
- [ ] Conferir a branch diferente de `main`, commitar somente arquivos desta fatia e abrir PR com resultado e limitações.

## Self-review

A spec completa inclui métricas, mídia, vínculos por vendedor e sincronização contínua. Esta fatia não finge cobri-los: sua entrega testável é exclusivamente consultar e exibir uma amostra de mensagens do número piloto, cujo backend já respondeu com 590 registros. O payload exato de cada mensagem e a paginação ainda exigem validação no ambiente real; a interface não afirma completude.
