# Google: critérios opcionais e rodadas complementares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para a execução inline escolhida pelo usuário. Steps use checkbox (`- [ ]`) syntax for tracking. Revisão independente ao final.

**Goal:** Aplicar o planejamento aprovado ao CRM e ao executor, com verificações opcionais, coleta às 17h para o próximo dia útil e até 3 lotes/150 candidatas para entregar até 50 empresas.

**Architecture:** O banco mantém plano versionado, execução imutável, lotes, contadores e exclusividade. O executor reutiliza o motor e os arquivos existentes. Um único workflow n8n executa etapas condicionais para as regras selecionadas e devolve evidências por critério. Sem verificações necessárias, o executor entrega diretamente ao CRM. Interface e planilha mostram o plano atual e o estado real da execução, sem substituir o histórico.

**Tech Stack:** Next.js 16.3.8, React 19.2.8, TypeScript, PostgreSQL/RLS, Vitest, Playwright, Python padrão e n8n. Reutilizar shadcn/ui e o kit local; não atualizar dependências como parte desta mudança.

**Spec:** `docs/superpowers/specs/2026-10-23-google-criterios-rodadas-design.md`

## Global Constraints

- Branch `codex/`, PR e TDD; preservar mudanças de outros chats. Executar neste worktree, não no checkout principal.
- `features/` não importa outra `features/`; contratos comuns ficam em `src/lib/google/` ou `src/server/google/`.
- Horário America/Sao_Paulo: segunda a quinta 17h prepara amanhã; sexta 17h prepara segunda; sem novo agendamento no fim de semana.
- Meta 50 entregues, até 3 lotes de 50, até 150 candidatas distintas por vendedor/data planejada; retomada não renova limite.
- Plano vazio não coleta; nicho/cidade/UF exigidos apenas em dia programado; bairro opcional.
- Hoje/passado bloqueados pelo banco; futuro editável sem alterar execução já iniciada.
- Sem filtros: entrega direta sem n8n/WhatsApp obrigatório, inclusive sem contato; não falsificar validação.
- CNPJ.biz, cadastros manuais, responsáveis, carteira, reservas, contatos protegidos e exclusividade existentes são preservados.
- Migrações existentes não se editam. Não ativar motor, workflows, serviços pagos, agenda, planilha ou banco de produção durante a implementação/testes.
- Texto da interface em português, empresas em vez de leads, sem travessões. Reutilizar componentes existentes.

## Review Focus

- Sexta-feira na fronteira 16:59/17:00, virada de mês/ano e datas UTC: uma execução para a segunda correta, nunca para sábado.
- Edição de segunda depois da reserva na sexta: plano novo salvo, snapshot e orçamento do pedido antigo intactos.
- Telefone ausente e fixo sem WhatsApp no caminho direto: cadastro visível com ausência honesta, demais origens ainda exigem seus contatos.
- Resposta perdida entre entrega de lote e confirmação: zero repetição de efeitos e contadores, sem quarto lote nem 51ª entrega.
- Dois vendedores e duas publicações concorrentes: um destinatário por empresa e nenhuma sobrescrita da planilha de outro lote.

## Base conferida e nomes novos

O checkout tem migrações até `0041_google_agentes_planilha.sql`. Reservar
`0042_google_criterios_rodadas.sql`, conferindo novamente a numeração imediatamente
antes de criá-la. Atualmente `empresa.telefone` é NOT NULL na 0014, `lerComando`
exige `validacao_conferida:true`, o CLI exige arquivo final, a ponte chama o filtro
legado de armarinhos e o coordenador usa 09:00/dia atual. Esses comportamentos
precisam ser alterados de forma explícita, não contornados no navegador.

O desenho visual está na prévia `prospeccao-google-espelhar-v10.html` deste chat.
Os exemplos de duas semanas passadas são fictícios e não devem virar seed de produção.

### Task 1: Contrato dos critérios, combinações e calendário

**Files:** Create `src/lib/google/criterios.ts`, `src/lib/google/criterios.test.ts`, `src/lib/google/calendario.ts`, `src/lib/google/calendario.test.ts`; Modify `src/features/google/tipos.ts`, `src/features/google/regras.ts`, `src/features/google/regras.test.ts`.

**Interfaces:** Produzir `CriteriosGoogle`, `VerificacaoGoogle = 'dados_google'|'presenca_digital'|'perfil_comercial'|'whatsapp'|'fixo'`, `criteriosVazios(): CriteriosGoogle`, `normalizarCriterios(entrada: unknown): Resultado<CriteriosGoogle>`, `verificacoesNecessarias(c: CriteriosGoogle): VerificacaoGoogle[]`, `dataPlanejadaDaRotina(agora: Date): string|null`. `Resultado<T>` é `{ok:true;valor:T}|{ok:false;motivo:string}`. Datas de saída são YYYY-MM-DD.

- [ ] **Step 1: Escrever testes falhando** que exijam: campos neutros e só termos adicionais produzem `[]`; WhatsApp+fixo produz as duas verificações; Com+Sem site/e-mail neutraliza o respectivo campo; demais filtros combinam E e canais alternativos OU; prioridades não eliminam empresas. Nota aceita 0 e 5, rejeita -1/5.1; avaliações rejeitam fração/negativo. Rejeitar enums, chaves ou tipos desconhecidos, sem completar dado ausente com fato inventado.
- [ ] **Step 2: Rodar** `npm run test:unit -- src/lib/google src/features/google/regras.test.ts`; confirmar falha nas funções novas.
- [ ] **Step 3: Implementar o contrato** com os 13 campos da spec/diálogo: termos, produtos, tipos, atendimento, excluir, situacao, site, email, telefone, nota, avaliacoes, prioridades, observacoes. Texto até 2.000 caracteres por critério, nicho/região até os 100 já adotados. Ausência numérica é null, não zero. Incluir snapshot completo no tipo de pedido; conservar leitura de registros legados sem critérios.
- [ ] **Step 4: Testar o calendário** com 23/10/2026 16:59-03→null, 17:00-03→26/10; 22/10 17h→23/10; sábado/domingo→null; sexta 30/10→02/11. Não tratar feriado como regra nova. Rodar novamente e confirmar PASS.
- [ ] **Step 5: Commit** `feat: definir criterios e calendario do agente Google`.

### Task 2: Persistência, cópia de dias, snapshots e orçamento no banco

**Files:** Create `db/migracoes/0042_google_criterios_rodadas.sql`, `docs/db/0042.md`, `tests/integracao/google-criterios-rodadas.test.ts`; Modify `src/server/db/migracoes/invariantes.ts`, `tests/integracao/google-planejamento.test.ts`, `tests/integracao/google-agentes.test.ts`, `src/features/google/repositorio.ts`.

**Interfaces:** Adicionar `google_planejamento_salvar_semana(jsonb) RETURNS jsonb`, `google_planejamento_copiar(uuid,integer,date[],text[]) RETURNS jsonb`, `google_agente_reservar_lote(uuid,uuid,jsonb) RETURNS jsonb`, `google_agente_concluir(uuid,uuid,text) RETURNS jsonb`. Manter as assinaturas externas existentes de proximo/etapa/entregar para compatibilidade, com contrato novo versionado. Repositório expõe `salvarSemana(dias)`, `copiarDia(origem,revisao,destinos,campos)`, `reservarLote(pedido,executor,candidatas)`, `concluir(pedido,executor,motivo)`, sempre com identidade autenticada.

- [ ] **Step 1: Escrever testes falhando em PostgreSQL descartável** para salvar cinco dias com vazios, rejeitar dia parcial, bloquear hoje/passado, permitir editar futuro iniciado sem alterar snapshot. Espelhar de duas semanas atrás apenas região, apenas critérios e apenas nicho; manter os não marcados e rejeitar atomicamente origem alheia, revisão trocada ou destino passado.
- [ ] **Step 2: Rodar** `npm run test:integracao -- tests/integracao/google-criterios-rodadas.test.ts`; conferir falha nas funções/colunas novas.
- [ ] **Step 3: Implementar migração e repositório**: critérios canônicos/versionados no plano; execução com revisão/snapshot próprios; lotes duráveis com ordinal 1..3, identidade de candidatas, recibos e publicações por lote. Contadores reservados/confirmados e unicidade por vendedor/data planejada ficam no banco. Preservar as publicações antigas, RLS, locks e legado em andamento. Nova programação usa 17h/próximo dia útil. Incluir novas definidoras na lista fechada de invariantes, com search_path vazio e sem EXECUTE público.
- [ ] **Step 4: Acrescentar testes**: 3 lotes de 50 esgotam 150; quarto lote recusado; repetir reserva/publicação não conta duas vezes; confirmar 49 entregues permite só mais uma; sexta agenda uma segunda e não sábado. Duas sessões concorrentes não excedem quota nem distribuem mesma empresa. Rodar `npm run db:checar` e os três arquivos de integração desta tarefa.
- [ ] **Step 5: Commit** `feat: persistir revisoes e lotes do planejamento Google`.

### Task 3: Entrega direta e recibos das verificações selecionadas

**Files:** Create `src/lib/google/entrega.ts`, `src/lib/google/entrega.test.ts`, `tests/integracao/google-entrega-direta.test.ts`; Modify `src/server/google/protocolo.ts`, `src/server/google/protocolo.test.ts`, `src/server/google/cliente.ts`, `src/server/google/cliente.test.ts`, `app/api/agente/google/route.ts`, `src/features/google/repositorio.ts`, migração nova da Task 2 antes de seu primeiro uso fora do banco descartável.

**Interfaces:** Produzir `ReciboGoogleV2` com versao=2, pedido_id, execucao_id, lote_id, revisao, snapshot_sha256, origem_sha256, resultado_sha256, verificacoes_requeridas e evidencias. Cada evidência identifica candidata, critério/opção, estado aprovado/reprovado/nao_confirmado, motivo, fonte e horário. `avaliarEntrega(criterios,evidencias)` retorna decisão explícita. Novos comandos `reservar_lote` e `concluir` transportam os argumentos da Task 2, sem aceitar destinatário informado pelo executor.

- [ ] **Step 1: Escrever testes falhando**: plano neutro aceita recibo V2 sem WhatsApp; plano WhatsApp exige evidência positiva para o telefone/candidata exatos; fixo sem WhatsApp é aceito na rota fixo; falsificar lista requerida ou usar recibo de outra revisão/lote é recusado. Com site E e-mail E (WhatsApp OU fixo) deve ter casos negativos independentes.
- [ ] **Step 2: Rodar** `npm run test:unit -- src/lib/google/entrega.test.ts src/server/google/protocolo.test.ts`; confirmar falha pelo contrato antigo.
- [ ] **Step 3: Implementar parser, decisões e entrega transacional**. Requeridas são recalculadas pelo servidor a partir do snapshot, nunca aceitas como autoridade do cliente. Suportar legado somente para execuções legadas. Ausência de verificação não vira validacao_conferida=true. Revalidar exclusividade e limite acumulado na entrega, registrar resultado e resposta idempotente por lote.
- [ ] **Step 4: Suportar ausência de telefone para Google** na migração nova, preservando validação obrigatória das funções de cadastro/importação manual e CNPJ.biz. Usar null, nunca número fictício; manter identificação por nome e Place ID/CNPJ. Ajustar consultas/tipos que leem telefone nas Tasks 4/7. Testar Google sem telefone/site/endereço, fechado sem filtro de situação, vendedor inativo, conflito de identidade e CNPJ existente com campos manuais. Rodar unidade desta tarefa, `tests/integracao/google-entrega-direta.test.ts` e testes existentes de busca-empresas.
- [ ] **Step 5: Commit** `feat: entregar empresas Google conforme verificacoes requeridas`.

### Task 4: Aplicar a tabela, diálogos e espelhamento ao CRM

**Files:** Create `app/fila/google/criterios.tsx`, `app/fila/google/espelhar.tsx`; Modify `app/fila/google/page.tsx`, `planejamento.tsx`, `google.module.css`, `acoes.ts`, `planejamento.dom.test.tsx`, `acoes.test.tsx`; Test `tests/e2e/google-planejamento.spec.ts`.

**Interfaces:** `DialogoCriterios` recebe dia/rascunho/onAplicar, sem persistir por conta própria. `EspelharPlanejamento` usa origem id/revisão, datas destino e `('nicho'|'criterios'|'regiao')[]`. Actions de semana/cópia autenticam vendedor e chamam as operações da Task 2. `PlanoGoogle` distingue revisão atual da usada na execução.

- [ ] **Step 1: Escrever testes falhando** da jornada: abrir semana atual e Hoje; editar próximos dias na tabela; diálogo com quatro grupos e caixas Com/Sem para site/e-mail e WhatsApp/Fixo; cancelar/Esc restaura rascunho; aplicar só se torna persistente no salvar da semana. Não exigir preencher os cinco dias.
- [ ] **Step 2: Rodar** `npm run test:unit -- app/fila/google/planejamento.dom.test.tsx app/fila/google/acoes.test.tsx` e registrar falha no comportamento antigo.
- [ ] **Step 3: Implementar com os componentes UI existentes**, lendo antes `src/components/ui/dialog.tsx`, `button.tsx`, `input.tsx` e `native-select.tsx`. Antes de editar código Next, ler os guias pertinentes em `node_modules/next/dist/docs/`; consultar Context7 para a API efetivamente usada. Manter a tela 1920x1080, foco/restauração, mensagens e rolagem interna. Não importar ou incorporar o HTML fictício como página de produção.
- [ ] **Step 4: Implementar/testar espelhamento** do histórico real do vendedor, apenas campos marcados, região como conjunto e destinos futuros. Remover o bloco de resumo antigo. Testar revisão atual diferente da execução, cópia sem campo/dia, origem alheia e corrida com virada do dia. Rodar os testes desta tarefa e a jornada Playwright existente com os mocks atualizados.
- [ ] **Step 5: Commit** `feat: aplicar planejamento semanal e espelhamento do novo visual`.

### Task 5: Sincronizar critérios e manter a planilha como espelho

**Files:** Modify `src/server/google/planilha/cliente.ts`, `cliente.test.ts`, `sincronizar.ts`, `db/migracoes/0042_google_criterios_rodadas.sql`, `tests/integracao/google-planilha.test.ts`, `tests/e2e/google-planilha-mock.ts`, `scripts/e2e/google-planilha-preload.mjs`.

**Interfaces:** Estender `PayloadPlanilha.dados` com criterios canônicos e revisão; manter as 13 colunas atuais na ordem e acrescentar N=`Critérios de busca`, como JSON textual canônico. `celulasDoPedido` produz exatamente 14 strings no contrato novo. A configuração reconhece explicitamente a versão da aba; legado pendente conserva seu contrato anterior até reconciliação.

- [ ] **Step 1: Escrever teste falhando** de ida/volta exata dos critérios, fórmula como texto, campos neutros e revisão alterada entre preparação e envio. Nenhuma escrita incerta permite append, troca de aba ou coleta com revisão divergente.
- [ ] **Step 2: Rodar** `npm run test:unit -- src/server/google/planilha/cliente.test.ts` e `npm run test:integracao -- tests/integracao/google-planilha.test.ts`; conferir falha esperada da coluna nova.
- [ ] **Step 3: Atualizar cliente, funções definidoras e mocks** preservando intenção durável, linha alocada, locks e conferência de retorno. Snapshot da execução não é substituído pela última edição espelhada; raw/resultado de cada lote carregam identidade e hash da revisão usada. Documentar extensão da aba apenas para ativação, sem fazê-la no arquivo real nesta tarefa.
- [ ] **Step 4: Rodar novamente** e verificar dois vendedores concorrentes, envio concluído com resposta perdida, revisão nova pendente e pedido legado ainda não reconciliado.
- [ ] **Step 5: Commit** `feat: sincronizar criterios versionados com a planilha compartilhada`.

### Task 6: Executor com lotes, coleta neutra e retomada

**Files:** Create `scripts/google/rodadas.py`, `scripts/google/test_rodadas.py`; Modify `scripts/google/coletar.py`, `scripts/google/test_coletar.py`, `scripts/google/agente.mts`, `src/google-coordenador.test.ts`, `src/google-agente-python.test.ts`.

**Interfaces:** `selecionar_lote(candidatas,vistas,restante)` retorna no máximo 50 identidades distintas, preservando dados brutos; `decidir_continuacao(entregues,analisadas,lotes,novidades)` retorna continuar ou um motivo de parada. CLI reserva lote antes de verificar, publica/recebe confirmação e só então decide a próxima etapa. Caminhos privados incluem vendedor/pedido/lote e os recibos persistem antes de chamadas externas.

- [ ] **Step 1: Escrever testes Python falhando** de 18+22+10 entregues em 3 lotes, terceira rodada sem aprovadas, lote só com repetidas e teto de 150. Simular criação de job com resposta perdida, resposta de entrega perdida e retomada do mesmo executor/lote sem consumir orçamento novamente.
- [ ] **Step 2: Rodar** `python -B -m unittest discover -s scripts/google -p 'test_*.py'`; confirmar falha nas funções novas, sem carregar motor real.
- [ ] **Step 3: Implementar seleção neutra no CRM**, preservando o coletor legado em Desktop. Não chamar sua classificação fixa para as novas entregas. Conservar --full, originais, IDs, endereços reais, e-mails publicados e sociais desligadas. Reutilizar o pool não processado; uma consulta complementar é finita, persistida e compatível com o mesmo plano. Interromper sem novidades, sem expandir região/nicho ou presumir paginação disponível.
- [ ] **Step 4: Atualizar CLI e recibos** para caminho direto e verificado, sem exigir arquivo final de WhatsApp em toda entrega. Manter arquivo original/resultado e respectivos hashes mesmo quando nenhum filtro foi executado. Legado retoma seus arquivos; falha geral mantém pendência. Rodar os testes Python, `src/google-coordenador.test.ts` e `src/google-agente-python.test.ts`.
- [ ] **Step 5: Commit** `feat: coordenar lotes complementares do agente Google`.

### Task 7: Workflows opcionais e transparência da entrega

**Files:** Create `workflows/n8n/google/verificar-empresas.json`, `README.md`; Create `src/server/google/verificacoes/cliente.ts`, `cliente.test.ts`, `contrato.test.ts`; Modify `app/empresas/google/page.tsx`, `app/empresas/google/[id]/page.tsx`, `app/fila/google/entrega.tsx`, `src/components/crm/historico-google.tsx`, `src/features/empresas/perfil.ts`, `src/features/empresas/listagem.ts`, `src/features/empresas/formato.ts`, `src/features/fila/consulta.ts`, `src/lib/whatsapp-empresa.ts` e seus consumidores de contato.

**Interfaces:** `executarVerificacoes(contexto,candidatas,fetcher)` faz zero chamadas se `verificacoesNecessarias` estiver vazio e uma chamada ao workflow único nos demais casos. Recebe respostas identificadas por pedido/lote/candidata e retorna evidências para o recibo V2. O workflow executa apenas etapas selecionadas, recebe somente dados do lote e regras necessárias e devolve estado/motivo/fonte/horário por regra; nenhum callback decide o vendedor. Exportar JSON sem segredos e com ativação desabilitada.

- [ ] **Step 1: Escrever testes falhando** dos contratos: zero chamadas externas no plano neutro; um workflow compartilhado para nota+avaliações; tipo de contato OU e demais filtros E; preferências ordenam sem excluir; timeout vira não confirmado/pendência, não Sem e-mail; fonte de página não altera regras. Fixo verifica formato e não inventa estado de linha ativa.
- [ ] **Step 2: Rodar** `npm run test:unit -- src/server/google/verificacoes`; conferir falha pelos arquivos/contratos ausentes.
- [ ] **Step 3: Preparar templates e adaptador** com as APIs documentadas da versão n8n existente, consultando Context7; reutilizar o serviço Evolution/configuração já usada pelo usuário. Configuração ausente de verificação requerida é erro visível, nunca aprovação silenciosa. Documentar conexão do qualificador de perfil, sem contratar provedor ou publicar workflows reais. Evitar leituras repetidas de site/telefone no mesmo pedido e manter o transporte serial da planilha.
- [ ] **Step 4: Expor auditoria e contato opcional**: rodadas, critérios usados, motivos, não confirmados, meta e causa de parada. Telefone null mostra Sem telefone informado e desabilita apenas a ação que exige número; WhatsApp não testado mostra Não verificado. Não criar link inválido ou expor telefone protegido. Antes de editar cada consumidor, localizar suas referências e adicionar teste do caso null; manter funções de entrada manual/CNPJ exigindo telefone.
- [ ] **Step 5: Rodar unidade desta tarefa e regressões** de empresa/fila/contatos/WhatsApp. Confirmar que as cinco verificações desativadas não impedem entrega direta. Commit `feat: preparar verificacoes opcionais e auditoria Google`.

### Task 8: Verificação completa, revisão independente e entrega revisável

**Files:** Modify `docs/operacao/agente-google-crm.md`, testes e dados fictícios em `tests/e2e/google-agentes.spec.ts`, `tests/e2e/google-planejamento.spec.ts`, `tests/e2e/dados-google.ts`; Create `tests/e2e/google-criterios-rodadas.spec.ts`.

**Interfaces:** Jornada completa usa apenas scraper/n8n/Sheets/Drive/Evolution simulados e PostgreSQL descartável. A configuração de ativação identifica versões, pendências legadas, migração e destino existentes sem executar ações reais.

- [ ] **Step 1: Escrever jornada falhando**: vendedor salva plano, usa espelhamento histórico seletivo, sexta 17h gera segunda, altera futuro sem mudar snapshot, recebe sem filtros e com filtros, até 3 lotes, zero duplicação e gestor vê auditoria. Outro vendedor não lê ou copia o plano e não recebe a mesma empresa.
- [ ] **Step 2: Rodar a jornada e confirmar falha**, depois ajustar apenas lacunas reais encontradas. Usar o harness existente de `scripts/e2e/run.mts`, não inventar variáveis de produção para simular.
- [ ] **Step 3: Atualizar operação e textos de agenda/limites**, registrar passagem do contrato antigo para V2, ausência de necessidade de n8n no caminho direto, preparo da coluna N e pendências de ativação. Nenhum teste deve acessar serviços reais.
- [ ] **Step 4: Rodar** `npm run db:checar`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integracao`, `npm run build` e `npm run test:e2e`. Registrar contagens reais, sem reutilizar os números da entrega anterior. Inspecionar a tela em 1920x1080, mobile, teclado e modo escuro; corrigir defeitos encontrados.
- [ ] **Step 5: Solicitar revisão independente do diff inteiro**, corrigir achados relevantes e repetir somente verificações afetadas. Conferir branch imediatamente antes de cada commit com uma guarda que aborte na main. Atualizar/ligar a PR da branch, preservar a prévia, registrar riscos materiais e estado de ativação. Commit final de documentação e correções.

## Auto-revisão do plano

Os oito blocos cobrem calendário, critérios e combinações, interface, cópia,
persistência, quotas, opcionalidade real do workflow, planilha, executor,
templates, histórico e ativação. Os cinco focos de revisão estão exercitados
explicitamente nas Tasks 1/2/3/5/6/8. A revisão independente da spec não
identificou questões importantes em aberto. O usuário já escolheu execução
inline nesta conversa, com revisão independente ao final; não reapresentar
opções de método de execução.
