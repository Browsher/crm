# Task 5 — implementação e verificação

Data: 2026-10-29. Branch: `codex/revisao-fluxo-comercial`. Base recebida: `2ae601b7971ffaf40a370d5fded82b28675bdb41`.

## Resultado

Jornada por `/fila/atendimento/[id]`, com empresa explícita, resumo canônico e registro direto. Abrir a página e Ver empresa apenas leem. Iniciar altera o atendimento; não cria contato, negociação ou reserva. Personal, Google, Banco e recentes reutilizam CardEmpresa/EmpresaDialogo através de Cartao. Snapshots próprios sem vínculo mantêm referência de busca, identidade/versionamento nulos e nenhuma ação comercial. Ver busca continua disponível.

O formulário persiste por empresa e por aba em sessionStorage antes de enviar. UUID, versão original e entrada normalizada sobrevivem a perda de resposta, remount e atualização; replay nunca gira chave. Falha de negócio preserva texto e exige preparação explícita para outro comando. Sucesso limpa a sessão e prepara nova versão. Um envio desconhecido não pode ser descartado pelos editores externos da Carteira/Funil; é possível fechar mantendo o rascunho e depois confirmar. Descarte explícito sem envio desconhecido limpa o store. A restauração informa o estado local do consumidor uma vez por snapshot, inclusive com callback recriado.

Bookmarks antigos são sanitizados para a consulta pessoal; atendimento antigo só recupera ID inequívoco e autorizado. Grupo não entra em serializers novos. Módulos de escolha, aquisição global, prazo e próxima empresa foram retirados; ações antigas autenticam e retornam aviso de fluxo encerrado, sem fallback para reserva. Grants antigos do banco permanecem para Task 9.

## Acréscimos expressamente autorizados pelo controlador

- `0054_resumos_empresas.sql` / `docs/db/0054.md`: wrapper autenticado estável, SECURITY DEFINER, search_path vazio, revoke PUBLIC, grant somente wrapper ao app_usuario e allowlist fechada. Seller ativo/pode_ler; IDs UUID deduplicados, máximo 100; vazio só após auth; omite alheios e inexistentes. Chama helper privado batch uma vez. Não altera SQL 0053; ponteiro R-015 em docs/db/0053.md. Aposentadoria Task 9 agora 0055; delta do controlador em `docs/superpowers/plans/2026-10-29-fluxo-comercial-unificado.md` incluído.
- `src/server/atendimento/consulta.ts`: `lerResumosEmpresas(usuarioId,empresaIds)` com contrato exato do briefing; `lerResumosBusca(usuarioId,buscaId)` resolve CNPJ do snapshot próprio somente contra vínculo atual do ator, via comoUsuario/RLS, e faz uma leitura batch. Reutilizável por Tasks 6/7/8. `app/empresas/busca/conteudo.tsx` e `detalhe-acao.tsx` propagam resumos; gestor mantém leitura anterior e não chama wrapper seller-only.
- `prepararContatoAcao(empresaId)` autentica vendedor e usa lerAtendimento existente para fase/versão canônicas. Antecipação mínima para `app/funil/modal.tsx` e `app/carteira/[id]/ficha.tsx`; não muda board, vendas, arquivo ou agenda. Mesmo se já arquivado, envio desconhecido persistido pode alcançar replay; nenhum comando novo ganha permissão. A RPC continua autorizando antes do replay e validando estado depois dele, conforme Task 3. Parser estrutural é opção interna, nunca flag do navegador.
- `src/lib/empresa-visual.ts` muda href de continuar para rota direta.
- Adapter exclusivamente de fixture `tests/integracao/fixtures/contato-legado.ts`, nome registrarContatoLegado, preserva cenários de `carteira-retornos.test.ts`, `fila-consulta.test.ts`, `funil-base.test.ts` até Tasks 7/9. Nenhum export/caller de produção recupera contrato antigo; comentário marca remoção Task 9.
- Teste real `tests/integracao/contato-replay-editor.test.ts` autorizado para replay após arquivo/retomada e recusa de novo acompanhamento inicial.

## TDD e falhas observadas

1. Testes de rota/action antes da implementação falharam por action ausente; prepararEnvio falhou por export ausente. Após implementar contrato, primeiro alvo: 3 arquivos / 5 testes verdes.
2. Wrapper batch: RED função inexistente; fixture adicional inicialmente sem telefone obrigatório corrigida. Checagem de migração também rejeitou falta de BEGIN/COMMIT; envelope adicionado antes do GREEN. Alvo SQL inicial 2/2, ampliado para 3/3 com prova de trabalho batch.
3. Varredura contratada `app/fila src/features/contato`: 97 falhas de expectativas antigas e 101 passes (`task-5-unit-red.log`). Conversão preservou cenários abaixo, retirando expectativas de reserva/devolução. GREEN intermediário: 38 arquivos / 131 testes. Falhas de mock vi.hoisted, caminho Windows e assert textual foram corrigidas, sem mudar timeouts ou skips.
4. Card com início cuja resposta se perdeu e situação já mudou: RED esperava segunda chamada, recebeu só uma (href pulava confirmação). Corrigido para resolver comando persistido antes de navegar/executar nova intenção. GREEN conjunto card/form: 2 arquivos / 9 testes.
5. Descarte externo: RED apagava estado local sem proteger comando desconhecido; `task-5-discard-red.log`. Helper e opções manter/confirmar integrados; GREEN 3 arquivos / 18 testes. Ampliação aos consumidores: 51 arquivos / 209 testes verdes.
6. Self-review encontrou preparação de editor sem props canônicas bloqueando confirmação se empresa já arquivada. Teste parametrizado RED de rota indireta (`task-5-replay-preparation-red.log`), correção restrita a envio já persistido, GREEN 8/8. Não há relaxamento da RPC. Banco real confirma replay depois de arquivo e retomada, sem contato extra, negociação ativa ou agenda; comando novo de acompanhamento é recusado.
7. E2E: primeiro RED fixture sem origem/grupo ativo; corrigido na fixture, sem mudar regra. Segundo RED nome de opção antigo; corrigido seletor para rótulo real. Terceiro RED seletor role=alert ambíguo com anunciador Next; refinado para data-slot=alert, preservando assertion. A jornada de fontes já passava. Execução final com build fresco: 2/2 em 13,6s, sem ampliar timeout.

## Mapa de cobertura antiga → atual

| Cenário preservado | Cobertura atual |
| --- | --- |
| Filtros, origem, página, retorno local, consulta vazia | localizar/navegacao.test.tsx, pessoal.dom.test.tsx, perfil.test.tsx e atendimento/page.test.tsx |
| Grupo antigo sem aquisição; recuperação inequívoca de atendimento; aposentadoria de puxar/renovar | entrada-reserva.test.tsx, entrada-sem-reserva.test.tsx, um-chamador.test.ts e E2E bookmark grupo |
| ID alheio, ator da sessão, posse/desfecho sem autoridade | atendimento/page.test.tsx, atendimento/acoes.test.tsx, contato/acao.test.ts; integração batch auth/foreign; E2E ID alheio |
| Prazo de reserva removido e registro durável | formulario.test.tsx; E2E altera iniciada_em para 2 horas atrás e registra normalmente |
| Não adquirir ao consultar detalhe; fonte/snapshot respeitados | cartao.test.tsx, buscar/resultados.test.tsx, recentes.dom.test.tsx; E2E pessoal/Google/Banco/recentes + snapshot sem vínculo |
| Rascunho separado, falha de rede, conflito, nova chave só após resolução | envio.test.ts, contato/formulario.test.tsx, formulario.dom.test.tsx e E2E duas empresas/duas abas/reload/replay |
| Back/Escape/cancelar/descartar externo, pending e foco | carteira/[id]/ficha.dom.test.tsx, funil/modal.dom.test.tsx e contato/formulario.test.tsx |
| Validação dos resultados/par data, erro legível e autoridade da fase | contato/regras.test.ts, mensagens.test.ts, acao.test.ts, repositorio.test.ts e contato-replay-editor.test.ts real |
| Ver busca e recentes paginados | buscar/empresas-recentes.dom.test.tsx, empresas/busca/detalhe-acao.test.tsx e E2E salvo/recente |

Os arquivos de teste de etapas/grupos/contexto-grupo/reservar/legado foram removidos junto dos módulos aposentados. As expectativas que exigiam lista global, reserva, timer ou devolução não são compatíveis com o novo produto; proteção/filtros/rascunhos foram remapeados acima. A contagem 97 é diagnóstico de assertions antigas, não uma alegação de equivalência numérica individual.

## Comandos e resultados

Todos executados serialmente no worktree informado. Integração/E2E usa somente PostgreSQL 18 descartável em 127.0.0.1:55432, PG_SSL=off e PG_VERSAO_ESPERADA=18. Credentials públicos de teste; nenhum env privado lido/restaurado. Nenhum fornecedor real, push, merge ou deploy.

- `npm run test:unit -- --maxWorkers=1 app/fila src/features/contato`: RED legado documentado; GREEN 38 arquivos/131 testes no primeiro fechamento.
- `npm run test:unit -- --maxWorkers=1 app/fila src/features/contato app/carteira app/funil app/empresas/busca src/lib/empresa-visual.test.ts`: GREEN 51 arquivos/209 testes (`task-5-unit-final.log`).
- `npm run test:unit -- --maxWorkers=1 src/features/contato/formulario.test.tsx 'app/carteira/[id]/ficha.dom.test.tsx' app/funil/modal.dom.test.tsx`: GREEN 3 arquivos/20 testes (`task-5-final-consumers.log`), após guarda de notificação de restauração.
- `npm run test:unit -- --maxWorkers=1 src/features/contato/formulario.test.tsx`: GREEN 8 testes (`task-5-replay-preparation-green.log`), após último ajuste de replay arquivado.
- `npm run test:integracao -- --maxWorkers=1 tests/integracao/empresas-resumos.test.ts tests/integracao/carteira-retornos.test.ts tests/integracao/fila-consulta.test.ts tests/integracao/funil-base.test.ts`: GREEN 4 arquivos/33 testes, incluindo consumidores do adapter de fixture.
- `npm run test:integracao -- --maxWorkers=1 tests/integracao/empresas-resumos.test.ts`: GREEN 3 testes (`task-5-batch-final.log`), com auth ausente/inativo/gestor, misto/foreign/missing/dedup, 100 aceitos/101 negados. Instrumentação do helper em banco temporário conta 20 expansões para 20 históricos, não N×H; restauração em finally; zero efeitos comerciais.
- `npm run test:integracao -- --maxWorkers=1 tests/integracao/contato-replay-editor.test.ts`: GREEN 1 teste (`task-5-replay-real.log`), APIs e banco reais.
- `npm run test:e2e -- tests/e2e/atendimento-direto.spec.ts`: build Next bem-sucedido e GREEN 2/2 (`task-5-e2e.log`); banco teste_d9f99dbe8bb3 removido pelo harness. Última mudança posterior foi apenas preparação de replay arquivado nos consumidores sem props; coberta pelo alvo DOM 8/8 e integração real acima.
- `npm run typecheck`, `npm run lint`, `npm run db:checar`: verdes; logs task-5-typecheck.log, task-5-lint.log, task-5-db-check.log. Última execução de tipos/lint confirmada antes do commit.
- `git diff --check`: limpo antes de staging.

Sem execução de baseline completo, nova dependência, skip novo, timeout elevado ou limpeza de processos alheios. Houve falha local de criação de temporários/execução Python sob sandbox Windows; comandos de teste e escrita focada usaram aprovação automática restrita. Não houve bypass de serviço ou acesso externo.

## Evidência visual e revisão própria

Capturas reais do último E2E, abertas com view_image e inspecionadas: `test-results/atendimento-direto-mobile.png` (390 px, nota da empresa B restaurada; assert scrollWidth <= innerWidth) e `test-results/atendimento-fontes-dialogo.png` (diálogo comum com dados Banco). Cópias locais duráveis em `evidence/task-5-atendimento-direto-mobile.png` e `evidence/task-5-atendimento-fontes-dialogo.png`, relativas a esta pasta de execução. Capturas/logs são artefatos locais ignorados; o relatório é versionado. Mobile sem transbordamento horizontal; controles e texto legíveis. Screenshot fullPage de diálogo inclui fundo da página com overlay fixo na posição de scroll; não é screenshot de viewport nem prova de todos os breakpoints.

Revisão própria: diff e consumidores, branches/índice, parser/replay/UUID, leituras sem efeitos, callback/store/restauração, tokens/componentes existentes e checklist React. Nenhum novo useEffect cria aquisição; restauração é notificada uma vez por snapshot; useSyncExternalStore tem snapshot de servidor estável. Context7 atingiu quota; usado fallback oficial https://react.dev/reference/react/useSyncExternalStore e guias Next instalados de layouts/pages e mutating data. Skill React checklist lida. Revisão independente cabe ao controlador; não foi simulada nem delegada a outro agente nesta tarefa.

## Limites e handoff

- Tasks 6/7 seguem responsáveis por board/descarte visual/agenda. Gestor mantém sua experiência atual de leitura para Task 8.
- Task 9 deve aposentar grants legados em 0055 e retirar o adapter de fixture após conversão dos três testes legados. APIs de produção não dependem dele.
- Batch limita IDs únicos a 100; não faz chunking automático. Listas atuais obedecem esse limite. O helper privado agrega histórico uma vez por leitura autorizada.
- SessionStorage é por aba/empresa; falha de armazenamento bloqueia envio para não perder identidade. Duplicação de aba pode copiar a sessão inicial do browser, preservando mesmo comando idempotente; após isso abas evoluem separadamente.
- A verificação foi focada, conforme instrução; gate completo de branch é Task 9. Não há promessa de cobertura de todos os testes antigos E2E nesta tarefa.

## Arquivos de propriedade incluídos no commit

Manifesto exato abaixo, extraído do diff e dos arquivos novos após revisão de escopo; inclui o plano editado pelo controlador e o relatório. Nenhum arquivo privado, lockfile, env ou artefato build será staged.

- app/carteira/[id]/ficha.dom.test.tsx
- app/carteira/[id]/ficha.tsx
- app/empresas/busca/conteudo.tsx
- app/empresas/busca/detalhe-acao.test.tsx
- app/empresas/busca/detalhe-acao.tsx
- app/fila/acoes.ts
- app/fila/atendimento/[id]/page.tsx
- app/fila/atendimento/acoes.test.tsx
- app/fila/atendimento/acoes.ts
- app/fila/atendimento/navegacao.test.tsx
- app/fila/atendimento/page.test.tsx
- app/fila/buscar/empresas-recentes.dom.test.tsx
- app/fila/buscar/empresas-recentes.tsx
- app/fila/buscar/page.test.tsx
- app/fila/buscar/page.tsx
- app/fila/buscar/resultados.test.tsx
- app/fila/buscar/resultados.tsx
- app/fila/campos-reserva.tsx
- app/fila/cartao.test.tsx
- app/fila/cartao.tsx
- app/fila/central.tsx
- app/fila/entrada-reserva.test.tsx
- app/fila/entrada-reserva.ts
- app/fila/entrada-sem-reserva.test.tsx
- app/fila/entrada-sem-reserva.tsx
- app/fila/etapas.test.tsx
- app/fila/etapas.tsx
- app/fila/formulario.dom.test.tsx
- app/fila/formulario.test.tsx
- app/fila/formulario.tsx
- app/fila/google/[id]/page.tsx
- app/fila/google/acoes.ts
- app/fila/google/entrega.tsx
- app/fila/google/prospectar.tsx
- app/fila/grupos.module.css
- app/fila/grupos.test.tsx
- app/fila/grupos.tsx
- app/fila/localizar/[id]/page.tsx
- app/fila/localizar/componentes.test.tsx
- app/fila/localizar/contexto-grupo.test.tsx
- app/fila/localizar/contexto-grupo.tsx
- app/fila/localizar/legado.tsx
- app/fila/localizar/navegacao.test.tsx
- app/fila/localizar/navegacao.ts
- app/fila/localizar/page.tsx
- app/fila/localizar/perfil.test.tsx
- app/fila/localizar/pessoal.dom.test.tsx
- app/fila/localizar/pessoal.tsx
- app/fila/localizar/recentes.test.tsx
- app/fila/localizar/reservar.test.tsx
- app/fila/localizar/reservar.tsx
- app/fila/localizar/resultados.tsx
- app/fila/page.tsx
- app/fila/rascunhos.tsx
- app/funil/modal.dom.test.tsx
- app/funil/modal.tsx
- db/migracoes/0054_resumos_empresas.sql
- docs/db/0053.md
- docs/db/0054.md
- docs/superpowers/plans/2026-10-29-fluxo-comercial-unificado.md
- scripts/e2e/run.mts
- src/features/contato/acao.test.ts
- src/features/contato/acao.ts
- src/features/contato/envio.test.ts
- src/features/contato/formulario.test.tsx
- src/features/contato/formulario.tsx
- src/features/contato/mensagens.test.ts
- src/features/contato/mensagens.ts
- src/features/contato/rascunho.ts
- src/features/contato/regras.test.ts
- src/features/contato/regras.ts
- src/features/contato/repositorio.test.ts
- src/features/contato/repositorio.ts
- src/features/contato/tipos.ts
- src/features/contato/um-chamador.test.ts
- src/lib/empresa-visual.test.ts
- src/lib/empresa-visual.ts
- src/server/atendimento/consulta.ts
- src/server/db/migracoes/invariantes.ts
- tests/e2e/atendimento-direto.spec.ts
- tests/e2e/dados-atendimento.ts
- tests/integracao/carteira-retornos.test.ts
- tests/integracao/contato-replay-editor.test.ts
- tests/integracao/empresas-resumos.test.ts
- tests/integracao/fila-consulta.test.ts
- tests/integracao/fixtures/contato-legado.ts
- tests/integracao/funil-base.test.ts
- .superpowers/sdd/2026-10-29-fluxo-comercial-unificado/task-5-report.md
