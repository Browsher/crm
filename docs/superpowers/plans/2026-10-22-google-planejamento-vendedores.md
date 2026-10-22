# Planejamento Google por vendedor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar planejamento semanal, coleta identificada por pedido, leads exclusivos e auditoria do gestor, com prévia integrada.

**Architecture:** O banco é a autoridade para planos, snapshots, publicação idempotente e exclusividade. A integração do agente usa uma API autenticada, a identidade de um gestor configurado no servidor e o motor/validador existentes. As novas listas pessoais têm registros próprios, sem virar grupos públicos de importação.

**Tech Stack:** Next.js 16.3.8, React 19, TypeScript, PostgreSQL, Vitest, Playwright, Python padrão, componentes shadcn já instalados.

**Spec:** docs/superpowers/specs/2026-10-22-google-planejamento-vendedores-design.md (aprovada pelo usuário nesta conversa).

## Global Constraints

- Segunda a sexta às 9h de São Paulo, uma região por pedido e até 50 empresas.
- Semana nova começa vazia; sem coleta instantânea, repetição automática ou novo agendamento.
- Primeiro vendedor a receber tem exclusividade, separada da carteira e da reserva temporária.
- Preservar cadastro manual, CNPJ.biz, dados/arquivos operacionais, validação e retomada do agente.
- Nenhuma coleta real, migração remota ou ativação de rotina nesta entrega.
- `features/` não importa de outra `features/`; estado comum em `server/` ou `lib/`.
- TDD, branch codex/redesign-crm, PR #55 existente; não tocar no checkout compartilhado.
- Usar o visual aprovado, ações em botões, teclado e 390 px.

## Review Focus

- Empresas com CNPJ e Place ID apontando para cadastros diferentes: conservar como conflito para o gestor, sem atribuir identidade errada.
- Vendedor desativado depois do início: conservar lote e histórico, impedir nova entrega.
- Retorno desconhecido, divergente ou fora de ordem: recusar publicação e retomar o mesmo lote.
- Exclusividade reaparecendo por CNPJ.biz, busca direta ou lista antiga: impedir reserva por outro vendedor no banco.
- Rotina atrasada ou sem execução: mostrar situação real, sem copiar critérios da semana anterior.

## Task 1: Banco, identidade e isolamento

**Files:** criar `db/migracoes/0040_google_planejamento.sql`, `docs/db/0040.md`, `tests/integracao/google-planejamento.test.ts`; alterar `src/server/db/migracoes/invariantes.ts` e ponteiros dos docs de objetos modificados.

**Interfaces:** tabelas `google_planejamento`, `google_rotina`, `google_resultado`, `google_exclusividade`; funções `google_planejar(date,text,text,text,text)`, `google_agente_proximo()`, `google_agente_etapa(uuid,text,text)`, `google_agente_entregar(uuid,jsonb,jsonb)`. Retorno de próximo inclui id, vendedor, dia, critérios e estado. Exclusividade participa dos auxiliares de disponibilidade e de um gatilho em empresa_fila.

- [ ] Escrever testes reais de RLS, alteração antes/depois do snapshot, semanas distintas, primeira entrega, concorrência, repetição divergente, conflito CNPJ/Place ID, sem telefone, desativação e reserva por outra fonte.
- [ ] Rodar `npm run test:integracao -- tests/integracao/google-planejamento.test.ts --maxWorkers=1`, observar ausência das funções.
- [ ] Implementar migração com grants mínimos, revogação PUBLIC, dados brutos separados e publicação atômica serializada com importações existentes.
- [ ] Rodar o arquivo de integração e `npm run db:checar`; resultado esperado verde.
- [ ] Commitar a fatia.

## Task 2: Domínio, API restrita e ponte do agente

**Files:** criar `src/features/google/{regras,tipos,repositorio}.ts`, `src/server/google/{autenticacao,protocolo}.ts`, `app/api/agente/google/route.ts`, `scripts/google/agente.mts`, `scripts/google/coletar.py`; testes unitários e Python com fornecedor falso.

**Interfaces:** `semanaDe(data:string):string[]`, `validarPlano(entrada:unknown)`; `repositorioGoogle(usuarioId)` expõe planejar, semana, entregas, detalhe e operações de agente. API POST aceita apenas próximo, etapa e entregar; destinatário é obtido do pedido no servidor. CLI lê token do ambiente e mantém pedido/recibo em disco, sem token em argumentos. Ponte Python usa configuração de nicho e estado por pedido, conserva motor e exportadores externos.

- [ ] Testar primeiro data/UF/textos inválidos, semana civil, segredo ausente/incorreto, corpo excessivo, recibo incompleto, HTTP incerto e critérios tratados como dados.
- [ ] Rodar testes unitários novos e Python, observar RED.
- [ ] Implementar autenticação constante, limite real de bytes, schema de protocolo, persistência do lote e entrada isolada no coletor; não executar rede real nos testes.
- [ ] Ler docs locais `route.md`, `use-server.md`, guias de formulários e consulta Context7 antes das APIs novas.
- [ ] Rodar testes novos e typecheck; resultado esperado verde; commit.

## Task 3: Planejamento e leads do vendedor

**Files:** criar `app/fila/google/{page,planejamento,acoes,entregas,entrega}.tsx` (actions em `.ts`), `google.module.css`, páginas de detalhe e testes; alterar `app/fila/buscar/page.tsx`.

**Interfaces:** `/fila/buscar?fonte=google` apresenta a nova área; `/fila/google?semana=YYYY-MM-DD&aba=...` e `/fila/google/[id]` são destinos estáveis. Formulário por dia usa `useActionState`, ação autenticada e revalidação. Prospectar reserva explicitamente a empresa usando a função existente e redireciona para atendimento somente em sucesso.

- [ ] Usar como molde `app/usuarios/acoes.ts`, `formulario-criar.tsx` e `app/fila/acoes.ts`, já lidos.
- [ ] Testar dias não planejados, sucesso/erro/pendência, bloqueio após snapshot, navegação de semanas, destinatário e botão de reserva antes do código.
- [ ] Implementar cinco registros editáveis, duas abas com aparência de botão, listas por entrega, histórico seguro e estados vazios úteis.
- [ ] Rodar testes da área e lint/typecheck; resultado esperado verde; commit.

## Task 4: Gestor, listas e ações explícitas

**Files:** criar `app/empresas/google/page.tsx`; alterar shell/caminho, telas e apresentação de grupos, catálogo da fila e histórico CNPJ. Criar consultas do gestor e testes.

**Interfaces:** `/empresas/google?semana=...&vendedor=...&estado=...` mostra planos, resultados e utilização real. A métrica usa contato.criado_por do destinatário, posterior à entrega, sem contar abertura ou contato alheio. Detalhe por lote conserva cada ocorrência e acesso à ficha central.

- [ ] Testar visão completa do gestor e métrica com contato anterior/alheio; testar navegação por botões.
- [ ] Implementar filtros, contagens, histórico e nomes visíveis “Listas”; conservar URLs antigas.
- [ ] Rodar testes afetados e lint/typecheck; resultado esperado verde; commit.

## Task 5: Jornada integrada, operação e prévia

**Files:** criar `tests/e2e/dados-google.ts`, `google-planejamento.spec.ts`, `docs/operacao/agente-google-crm.md`, evidências em `docs/design/2026-10-22-redesign/google/`; alterar harness e inventário conforme resultados reais.

- [ ] Adicionar jornada RED com planejamento, entrega simulada, isolamento e acompanhamento do gestor.
- [ ] Preparar fixtures por chamadas reais do banco e fake de agente; nenhum crédito ou coleta externos.
- [ ] Rodar unidade inteira, integração inteira, build, E2E, lint, typecheck e db:checar. Corrigir falhas com causa identificada.
- [ ] Atualizar a prévia local 3100 com dados sintéticos, conferir desktop/390 px e temas; guardar capturas.
- [ ] Documentar contrato operacional, comandos e reconciliação, critérios genéricos, arquivo/recibo, ativação posterior e limites observáveis; regenerar inventário de relatório real.
- [ ] Fazer revisão independente com contexto novo, corrigir Critical/Important por RED/GREEN; registrar minores e decisões.
- [ ] Commitar, atualizar PR existente e conferir CI pelo tool code_review; não fazer merge.

## Execução

O usuário aprovou o desenho e pediu explicitamente implementação nesta conversa, prévia e revisão final. Esse pedido preserva o modo inline e autoriza a execução contínua deste plano derivado, sem outra rodada de confirmação.
