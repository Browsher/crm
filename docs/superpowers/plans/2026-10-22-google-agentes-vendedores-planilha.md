# Agentes individuais e planilha compartilhada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox (`- [x]`) syntax.

**Goal:** Entregar agentes por vendedor, sincronização verificável e próximos cinco dias úteis, com prévia e revisão independente.

**Architecture:** PostgreSQL controla agente, revisão, pendência de sincronização e posse durável da execução compartilhada. O servidor espelha linhas identificadas em uma aba exclusiva do mesmo Sheets, com OAuth de serviço e confirmação por leitura. O coordenador reutiliza motor e validação, retomando o mesmo pedido e recusando outro executor enquanto os recursos estiverem ocupados.

**Tech Stack:** Next.js 16.3.8, React 19, PostgreSQL 18, TypeScript, Node 24 crypto/fetch, Vitest, Playwright, ponte Python existente.

**Spec:** docs/superpowers/specs/2026-10-22-google-agentes-vendedores-planilha-design.md, aprovada explicitamente para execução inline.

## Global Constraints

- Gestores compartilham equipe e planilha; um agente por vendedor, sem novos tenants.
- Rotina existente, segunda a sexta às 9h de São Paulo, até 50 leads por pedido.
- Critérios novos vazios; histórico não se move; pausa impede novas buscas e permite concluir a iniciada.
- Pedidos vencidos não iniciados ficam no histórico; execução iniciada exige reconciliação.
- Preservar CNPJ.biz, exclusividade, posse, reservas, arquivos, recibos e listas legadas.
- Nenhuma coleta, credencial, concessão de acesso, alteração de Sheets, automação ou migração remota real.
- `features/` não importa outra `features/`; shadcn, tokens e ações em botões existentes.
- Worktree codex/redesign-crm e PR #55; não tocar no checkout compartilhado.

## Review Focus

- Resposta incerta do Google seguida de nova edição ou mudança do destino não pode duplicar linhas nem confirmar a revisão errada.
- Dois executores e queda durante validação não podem iniciar outro job ou substituir a origem compartilhada.
- Pausa, desativação e mudança de papel durante espera devem obedecer à elegibilidade vigente.
- Célula ocupada por outro pedido, aba errada ou cabeçalho divergente não podem ser sobrescritos.
- Virada de dia/ano e fim de semana não podem repetir critérios nem esconder entregas históricas.

## Task 1: Banco dos agentes, espelho e coordenador

**Files:** criar db/migracoes/0041_google_agentes_planilha.sql, docs/db/0041.md, tests/integracao/google-agentes.test.ts; alterar invariantes e seus fixtures, testes de migrações e fixtures Google existentes.

**Interfaces:** google_agente(vendedor_id,pausado); google_sincronizacao(pedido_id,linha,versao,revisao,revisao_confirmada,versao_confirmada,destino,erro); google_execucao(executor_id,gestor_id,pedido_id,iniciado_em,concluido_em). `google_agente_definir(uuid,boolean)`, `google_planilha_preparar(uuid,text):jsonb`, `google_planilha_confirmar(uuid,integer,text):boolean`. Protocolo do executor passa UUID `executor`: `google_agente_proximo(uuid):jsonb`, `google_agente_etapa(uuid,text,text,uuid)`, `google_agente_entregar(uuid,jsonb,jsonb,uuid):text`. Versões internas antigas ficam privadas; chamadas antigas sem executor falham fechadas.

- [x] Escrever integração RED para perfil privado/gestores compartilhados, revisão transacional, destino durável, confirmação antiga recusada, agentes pausados, ocupado entre executores, repetição e retomada, dias vencidos e desativação.
- [x] Rodar o arquivo novo; esperado ausência dos objetos/assinaturas.
- [x] Implementar migração, triggers de perfil/revisão, exclusão global sem retomada automática por prazo, funções com permissões mínimas e bloqueios coerentes. Retomar iniciado antes de novo pedido; exigir revisão confirmada para início novo.
- [x] Adaptar testes antigos ao contrato autenticado novo, mantendo as asserções de negócio. Atualizar listas explícitas de migrações e grants.
- [x] Rodar integrações Google, invariantes e db:checar; esperado verde. Commitar fatia.

## Task 2: Cliente Sheets e sincronização durável

**Files:** criar src/server/google/planilha/{configuracao,cliente,sincronizar}.ts e testes; estender repositório Google e .env.example.

**Interfaces:** configuração privada GOOGLE_PLANILHA_ID, GOOGLE_PLANILHA_ABA_ID, GOOGLE_PLANILHA_CLIENT_EMAIL, GOOGLE_PLANILHA_PRIVATE_KEY. `criarClientePlanilha(config,fetcher?)` obtém OAuth e `gravar(payload)` valida metadados/cabeçalho/identidade, escreve RAW e confere valores. `sincronizarPedido(pedidoId)` devolve `{estado:'sincronizado'|'pendente',motivo?}`. Vincular destino em transação anterior à chamada externa; lock durável durante gravação/confirmar, prazo global inferior a 30 s. Linha fixa alocada no banco evita append após timeout.

- [x] Escrever testes RED com RSA fictícia/HTTP fake: JWT, endpoints fixos sem redirect, RAW literal, aba/cabeçalho divergente, linha de outro pedido, escrita incerta, retorno divergente e segredo não exposto.
- [x] Implementar cliente sem dependência adicional, leituras limitadas e prazo global. Não criar aba real; ativação provisiona aba/cabeçalho explícitos. Crescer somente a grade da aba autorizada quando necessário.
- [x] Testar integração serviço/DB com fornecedor controlado: erro mantém destino/pendência; retomada mesma linha; revisões concorrentes serializam; vendedor não confirma por conta própria.
- [x] Rodar unidade/integração afetadas e typecheck; esperado verde. Commitar.

## Task 3: Executor por vendedor e retomada

**Files:** alterar src/server/google/{protocolo,cliente}.ts, app/api/agente/google/route.ts, scripts/google/agente.mts, scripts/google/coletar.py e testes.

**Interfaces:** todos os comandos de agente carregam `executor` UUID persistido em pasta privada; `proximo` devolve pedido com agente/vendedor ou `ocupado`/`sincronizar`. API reconcilia sincronização antes de iniciar. Coordenador conserva propriedade até resultado conferido; devoluções repetidas usam execução original. Arquivos por pedido e vínculo ao vendedor permanecem no coletor.

- [x] Testar RED protocolo sem executor, outro executor em etapa/entrega e retorno incerto conservando identificação local.
- [x] Implementar nova API/CLI; preservar UUID antes do POST e adicionar executor na publicação sem editar recibos. Não criar outro agendamento nem executar coleta externa.
- [x] Rodar testes de protocolo/cliente/ponte, integração de disputa e typecheck; esperado verde. Commitar.

## Task 4: Agenda móvel, estado de sincronização e gestão dos agentes

**Files:** alterar src/features/google/{regras,tipos,repositorio}.ts, app/fila/google/{page,planejamento,acoes,entregas}.tsx/.ts, app/empresas/google/page.tsx; criar controles de agente/ações e testes.

**Interfaces:** `proximosDiasUteis(data:string):string[]|null` devolve cinco datas incluindo hoje útil, senão próxima segunda. Sem query de semana o planejamento usa essas datas; entregas/histórico mantêm semana. Repo expõe agentes com última execução e estado da sincronização; ações de pausa somente gestor. Salvar tenta sincronizar e informa salvo/pending/sincronizado com honestidade.

- [x] Testar RED quinta 22/10, sexta 23/10, sábado 24/10 e 31/12, sem cópia de critérios; formulário com falha de Sheets conserva plano; gestor pausa e outro vendedor não controla agente.
- [x] Implementar componentes existentes, datas explícitas, resumo próximos cinco dias, botão de semanas históricas, mensagens e configuração ausente.
- [x] Rodar testes afetados, lint e typecheck; esperado verde. Commitar.

## Task 5: Jornada completa, operação e entrega

**Files:** criar fake local Sheets/OAuth no harness e tests/e2e/google-agentes.spec.ts; atualizar fixtures, ambiente isolado, docs/operacao/agente-google-crm.md, docs/design/2026-10-22-redesign/google-agentes/ e inventário real.

- [x] Escrever jornada RED: dois agentes/gestores compartilhados, salvar e ler confirmação no fake, falha e recuperação, pausa e nova agenda, API ocupada e entrega protegida.
- [x] Implementar fake isolado por preload do subprocesso E2E (sem URL remota configurável em produção), contas sintéticas e capturas nos dois temas/390 px.
- [x] Rodar unidade completa, integração completa, build:e2e, E2E, lint/typecheck/db:checar/diff-check; esperado verde.
- [x] Atualizar prévia 3100 com build e banco fictícios, conferir no navegador; documentar configuração/ativação e limitações.
- [x] Revisão independente fresca de BASE até HEAD; uma passagem RED→GREEN para Critical/Important, suite inteira; registrar decisões e minores, sem re-review.
- [ ] Commitar, atualizar PR #55 e conferir CI da revisão final; preservar worktree e prévia, remover apenas scratch deste plano após preservar resultados.

## Execução autorizada

O usuário aprovou o desenho completo e pediu implementação inline, prévia e revisão independente. O plano deriva dessa autorização; não reabre uma confirmação já dada. BASE 7b92660.
