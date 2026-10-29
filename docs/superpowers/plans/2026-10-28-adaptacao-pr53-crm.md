# Adaptação da PR 53 ao CRM atual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar as ferramentas legadas da PR 53 com testes offline e compatibilidade com a main atual, sem reativar operação antiga.

**Architecture:** A main aeccc1b é autoridade da árvore final; o head original 61a374b permanece ancestral. Transportar somente a allowlist, extrair helpers puros mantendo reexports e conservar a fronteira Google V2. As correções funcionais tratam o lock portátil, a contagem de ocorrências de pendência descoberta na revisão e a faixa de horário descoberta pela suíte; uma fixture real da ponte e um wrapper Vitest tornam a compatibilidade verificável na CI existente.

**Tech Stack:** Node 24, TypeScript/tsx/Vitest existentes; Python 3.12+ para suíte completa (coletor isolado 3.10+) e stdlib; PostgreSQL 18 e Playwright já configurados. Nenhuma dependência nova.

**Spec:** docs/superpowers/specs/2026-10-28-adaptacao-pr53-design.md

## Global Constraints

- Preservar Google V2 atual, planejamento por vendedor e rotina das 17h; não alterar scripts/google/ nem os contratos Google de produção.
- Não instalar, ativar ou modificar n8n, Drive, Sheets, Evolution, prompts, agenda, credenciais ou kit externo; não executar coleta, importação, reserva ou envio real; não publicar produção.
- Não alterar package.json, package-lock.json, UI, SQL, migrações, RLS, arquivos .env, configuração CI ou Vercel.
- Omitir scripts/prospeccao-base/instalar.mts; preservar a biblioteca histórica sem generalizar seu alvo.
- Preservar src/features/empresas/cnpj.ts exatamente como main; os outros três consumidores compartilhados recebem somente extrações mecânicas com reexports.
- Suíte completa Python exige 3.12+; coletor isolado exige 3.10+.
- Testes Python usam somente stdlib, fixtures públicas e diretórios temporários; não ler configuração instalada ou dados privados.
- Antes de testes locais, isolar .env.local sem ler valores; limpar GOOGLE_PLANILHA_N8N_URL, GOOGLE_PLANILHA_N8N_TOKEN, GOOGLE_VERIFICACOES_URL e GOOGLE_VERIFICACOES_TOKEN de cada processo operacional. Testes de banco usam somente o banco local descartável, sem herdar DATABASE_URL_ADMIN externo.
- Não executar scripts com configuração operacional nem criar marcador de confirmação de backup; preservar VITEST, LOCALAPPDATA, TEMP/TMP e PATH nos testes Windows existentes.
- Nenhum commit na main, nenhuma alteração no checkout principal, nenhum force-push; atualizar a PR 53 existente por fast-forward e exigir revisão independente e CI verde no head exato.


## Review Focus

- Dois processos disputam a campanha: o segundo falha sem espera e sem alterar estado; o SO libera o lock após saída, exceção ou morte. Task 2 cobre com subprocessos e arquivo persistente.
- Módulo legado presente durante pedido Google V2 sem telefone: importar e coletar pelo caminho neutro mantém candidata/endereço/CSV sem invocar process/profile nem kit real. Task 2 cobre com fixture integrada.
- Exportação nos limites de bytes e com BOM/CRLF/Unicode: parser real aceita 1.500.000 e recusa 1.500.001 bytes; Task 1 reutiliza exportar-crm.test.ts e testes públicos atuais.
- Guia ou prompt antigo reaplicado por engano: Task 1 revisa os sete avisos, retira o CLI antigo e separa geração offline de operação histórica; ausência do CLI é verificada pelo diff, sem teste espelhado.
- Recibo/repetição/resposta incerta: Task 1 mantém e roda testes legados de identidade, backup, reconciliação e retenção desligada; Task 2 roda Google atual intacto e não afirma rejeição bilateral universal V1/V2.

## Arquivos e responsabilidades

A allowlist abaixo autoriza somente transporte do head original e as adaptações descritas na spec. As duas novas fontes são test_integracao_crm.py e src/prospeccao-base-python.test.ts. Além desta lista, apenas esta spec e este plano são novos. Os documentos antigos de desenho/plano que não estão na main não serão transportados; continuam no histórico original da PR.

```text
.gitignore
src/lib/arquivo-empresas.ts
src/lib/cep.ts
src/lib/cnae.ts
src/features/empresas/arquivo.ts
src/features/empresas/cnae.ts
src/server/cep/resolver.ts
src/lib/prospeccao-base/abas.ts
src/lib/prospeccao-base/arquivos-drive.ts
src/lib/prospeccao-base/arquivos-drive.test.ts
src/lib/prospeccao-base/automatico.ts
src/lib/prospeccao-base/automatico.test.ts
src/lib/prospeccao-base/backup-telefones.ts
src/lib/prospeccao-base/backup-telefones.test.ts
src/lib/prospeccao-base/consolidar.ts
src/lib/prospeccao-base/consolidar.test.ts
src/lib/prospeccao-base/entrada-sheets.ts
src/lib/prospeccao-base/entrada-sheets.test.ts
src/lib/prospeccao-base/exportar-crm.ts
src/lib/prospeccao-base/exportar-crm.test.ts
src/lib/prospeccao-base/modelo.ts
src/lib/prospeccao-base/sheets-simples.ts
src/lib/prospeccao-base/sheets-simples.test.ts
src/lib/prospeccao-base/simples-modelo.ts
src/lib/prospeccao-base/telefone.ts
src/lib/prospeccao-base/telefone.test.ts
src/lib/prospeccao-base/whatsapp.ts
src/lib/prospeccao-base/whatsapp.test.ts
src/server/prospeccao-base/codigo-n8n.ts
src/server/prospeccao-base/codigo-n8n.test.ts
src/server/prospeccao-base/codigo-simples.ts
src/server/prospeccao-base/codigo-simples.test.ts
src/server/prospeccao-base/entrada.ts
src/server/prospeccao-base/entrada.test.ts
src/server/prospeccao-base/instalar.ts
src/server/prospeccao-base/instalar.test.ts
src/server/prospeccao-base/preparar-cli.test.ts
src/server/prospeccao-base/semente.ts
src/server/prospeccao-base/semente.test.ts
src/server/prospeccao-base/workflow.ts
src/server/prospeccao-base/workflow.test.ts
src/server/prospeccao-base/workflow-simples.ts
src/server/prospeccao-base/workflow-simples.test.ts
src/server/prospeccao-base/workflow-simples-cli.test.ts
src/server/prospeccao-base/workflow-backup.ts
src/server/prospeccao-base/workflow-backup.test.ts
src/server/prospeccao-base/workflow-backup-cli.test.ts
src/server/prospeccao-base/workflow-drive.ts
src/server/prospeccao-base/workflow-drive.test.ts
src/server/prospeccao-base/workflow-drive-cli.test.ts
src/server/prospeccao-base/workflow-automatico.ts
src/server/prospeccao-base/workflow-automatico.test.ts
src/server/prospeccao-base/workflow-automatico-cli.test.ts
scripts/prospeccao-base/preparar.mts
scripts/prospeccao-base/gerar-workflow.mts
scripts/prospeccao-base/gerar-workflow-simples.mts
scripts/prospeccao-base/gerar-workflow-backup.mts
scripts/prospeccao-base/gerar-workflow-drive.mts
scripts/prospeccao-base/gerar-workflow-automatico.mts
scripts/prospeccao-campanha/.gitignore
scripts/prospeccao-campanha/README.md
scripts/prospeccao-campanha/INSTRUCOES.txt
scripts/prospeccao-campanha/campanha.exemplo.json
scripts/prospeccao-campanha/coletor.py
scripts/prospeccao-campanha/arquivo_drive.py
scripts/prospeccao-campanha/disparar_workflow.py
scripts/prospeccao-campanha/verificar_coleta.py
scripts/prospeccao-campanha/test_arquivo_drive.py
scripts/prospeccao-campanha/test_coletor.py
scripts/prospeccao-campanha/test_disparar_workflow.py
scripts/prospeccao-campanha/test_regioes.py
scripts/prospeccao-campanha/test_suporte.py
scripts/prospeccao-campanha/test_integracao_crm.py
src/prospeccao-base-python.test.ts
docs/operacao/base-prospeccao-n8n.md
docs/operacao/validacao-whatsapp-sheets.md
docs/operacao/prospeccao-fila-backup.md
docs/operacao/prospeccao-arquivos-drive.md
docs/operacao/prospeccao-automatica.md
tests/inventario-unitario.txt
```

**Compartilhamento sequencial:** Task 1 é dona de toda a reconciliação e dos sete documentos legados; Task 2 modifica somente coletor.py, test_coletor.py, arquivo_drive.py, test_arquivo_drive.py, novo test_integracao_crm.py, novo wrapper, inventário e README da campanha (requisitos Python/testes). O revisor de cada tarefa recebe seu diff completo; a revisão final compara toda a branch com a main.

## Preparação do controlador

- [ ] Registrar a resposta “Segue” e a escolha anterior de agentes separados. As escolhas técnicas desta spec concretizam esse recorte; não há nova mudança de produto dependente de resposta.
- [ ] Executar builder check da spec, resolver lacunas significativas, fazer auto revisão deste plano (cobertura, passos, tipos, cinco riscos e proporção).
- [ ] Salvar e commitar apenas spec/plano na branch codex/pr53-plano, nunca main. Manter a branch anterior e o checkout principal intactos.
- [ ] Criar workspace SDD pelo script sdd-workspace; cada implementador lê só seu task-brief e os Global Constraints. Registrar BASE antes de cada tarefa, identidade do agente, relatórios, diff e dois vereditos de revisão.
- [ ] Isolar .env.local em pasta ignorada deste plano, sem ler valores. Verificar apenas presença de .env.test.local e isolar também se existir. Não transportar esses arquivos para fonte, relatório ou commit. Restaurar ao fim se o destino estiver livre.
- [ ] Confirmar versões de Python, Node e Docker/possível Linux isolado sem ler credenciais. Aplicar os quatro env vazios a cada teste/check local; usar banco descartável para integração/E2E.

### Task 1: Reconciliar o legado com a main e qualificar a documentação

**Files:** Todos os arquivos da allowlist que já existem no head original, exceto o inventário que será regenerado em Task 2. Novos helpers puros da PR e somente hunks mecânicos nos três consumidores atuais. O CLI instalar.mts fica ausente; cnpj.ts igual à main. Spec/plano já salvos pelo controlador permanecem.

**Interfaces:**
- Consome main aeccc1bc84363fc6dac49ec500054b7d8afba41a, fonte original 61a374bc54d415b15569ff04a44c452f75524597 e commit de documentos fornecido no despacho.
- Produz branch local codex/pr53-adaptacao com ambos como ancestrais, árvore autorizada e APIs públicas dos helpers preservadas. Os geradores/exportador legados continuam offline e a biblioteca histórica de instalação permanece com HTTP injetado.
- Task 2 usará campaign_lock existente sem mudança nesta tarefa e a importação de carregar_coletor da main sem alteração.

- [ ] **Step 1: Criar candidato sem reescrever histórico.** Guardar o HEAD de documentos, criar codex/pr53-adaptacao a partir do head original e fazer merge normal da branch de documentos (descende da main). Resolver apenas a união de .gitignore e preservar cnpj.ts da main. Antes de concluir o merge, impor a árvore main + allowlist + spec/plano: para cada diferença fora desse conjunto, restaurar a versão da main ou retirar o arquivo ausente na main, com paths explícitos. Não restaurar consumidores atuais inteiros de um snapshot antigo.
- [ ] **Step 2: Reconciliar helpers.** Manter tamanho 1.500.000, validação exata de CNAE e CEP, reexports e assinaturas públicas. Comparar os hunks com main; reaproveitar os testes existentes do parser e consumidores. É transporte de código previamente testado, não criação de comportamento; não fabricar RED para extração idêntica.
- [ ] **Step 3: Qualificar os sete documentos legados.** Aviso uniforme em cinco docs/operacao da allowlist e README/INSTRUCOES. Identificar 09h/fila global/WhatsApp obrigatório/CRM_DRIVE_V1 como V1 histórico. Remover recomendação de executar o instalador omitido. Não transformar relatos de 16/10 em status atual nem recomendar importação/reinstalação como próximo passo. Referenciar os dois guias Google vigentes por links relativos válidos. Declarar fronteiras externas Node/exportar_csv/kit sem copiá-las.
- [ ] **Step 4: Executar testes focados existentes com env isolado.** npm run test:unit -- src/lib/prospeccao-base src/server/prospeccao-base src/features/empresas/arquivo.test.ts src/features/empresas/cnae.test.ts src/server/cep/resolver.test.ts. Confirmar parser real/limites; mocks de instalação não fazem HTTP real. Rodar npm run typecheck e npm run lint. Não rodar coletor operacional, piloto nem comando de instalação. A suíte Python integral será gate de Task 2, pois o lock POSIX defeituoso é conhecido e ainda não corrigido.
- [ ] **Step 5: Auto revisar e commitar.** Guardar branch codex/pr53-adaptacao antes de cada commit; estágio explícito. Conferir ancestralidade original/main e diff da allowlist, CLI ausente, package/lock/scripts/google/cnpj sem delta. Registrar comandos, resultados e qualquer falha literal no task-1-report.md. Nenhum push ou merge remoto pelo implementador. Revisor independente deve dar conformidade e qualidade antes de Task 2.

### Task 2: Corrigir lock portátil e tornar compatibilidade offline um gate da CI

**Files:** Modify scripts/prospeccao-campanha/coletor.py, test_coletor.py, arquivo_drive.py e test_arquivo_drive.py. Create scripts/prospeccao-campanha/test_integracao_crm.py e src/prospeccao-base-python.test.ts. Modify scripts/prospeccao-campanha/README.md para Python/testes; regenerate tests/inventario-unitario.txt. Nenhum outro arquivo de produto.

**Interfaces:**
- Consome campaign_lock() como context manager e o padrão portátil de disparar_workflow.py, carregar_coletor/carregar_motor da ponte scripts/google/coletar.py intacta, e test_suporte.py com campanha temporária.
- Produz campaign_lock() com mesma interface e semântica, testes entre processos reais, fixture integrada com fonte versionada e um teste Vitest que chama unittest discover da campanha. Sem novo job, dependência ou produtor operacional.

- [ ] **Step 1: Escrever teste de lock com processos reais.** Em test_coletor.py provar: dono adquire e sinaliza; concorrente não entra e não altera estado; saída normal, exceção e encerramento liberam para terceiro processo; arquivo de lock persiste. Usar timeouts e limpeza determinística. Não usar mocks para esconder o lock. Rodar os casos contra coletor original e registrar RED POSIX pelo import msvcrt ou falha concreta. Windows pode já passar. Se Linux local não estiver disponível, pedir ao controlador um primeiro push draft somente após revisão estática para obter RED na CI; não mudar implementação antes dessa evidência.
- [ ] **Step 2: Corrigir somente campaign_lock().** Windows usa msvcrt; POSIX fcntl.flock com LOCK_EX | LOCK_NB. Fechar handle/liberar em finally e manter arquivo de lock. Reexecutar os mesmos casos para GREEN, sem enfraquecer assertions, aumentar timeout global ou pular plataforma. Preservar comportamento de erro da campanha.
- [ ] **Step 2b: Corrigir faixa explícita de horário.** O teste existente test_arquivo_drive.ArquivoDrive.test_region_collection_date_batch_and_time_must_be_explicit_and_valid mostrou RED no caso 24:00:00 (aceito pelo time.fromisoformat do runtime). Corrigir somente _erro_contexto em arquivo_drive.py para garantir hora < 24, preservando formato, intervalo de minuto/segundo e asserções existentes. Rodar esse caso em isolamento e a suíte completa; não permitir saída inválida contaminar casos subsequentes. Ownership do teste correspondente ampliado somente se necessário para isolar saídas.
- [ ] **Step 3: Acrescentar test_integracao_crm.py.** Montar campanha temporária com coletor versionado e campanha.exemplo.json; patch.dict para PROSPECCAO_CAMPANHA_DIR e carregar_motor fictício. Invocar carregar_coletor real da ponte atual e conferir HERE/histórico isolados/interface/origem do motor. Proibir API/subprocesso/coleta ao importar. Reusar cenário neutro do Google test_coletar.py:181–194 com process/profile sentinelas, candidata sem telefone, endereço e CSV bruto idênticos. Sem modificar scripts/google/ nem carregar kit real. Este teste pode já passar; registrar compatibilidade, sem RED artificial.
- [ ] **Step 4: Acrescentar wrapper e documentação de testes.** Seguir src/google-agente-python.test.ts: Windows python, demais python3; argumentos -B -m unittest discover -s scripts/prospeccao-campanha -p test_*.py, encoding utf8/PYTHONDONTWRITEBYTECODE=1, status zero obrigatório e timeout limitado medido. Documentar Python 3.12+ para suíte completa e 3.10+ para coletor isolado, stdlib e comandos offline, distinguindo dependências externas de operação. Não alterar wrapper Google existente.
- [ ] **Step 5: Verificar e inventariar.** Rodar Python da campanha e Google atuais, npm run test:unit -- src/prospeccao-base-python.test.ts src/google-agente-python.test.ts, npm run typecheck e npm run lint. Executar npm run test:inventario uma vez: ele já executa a suíte unitária inteira; conservar relatório/resultado e não repetir unidade sem nova falha/mudança. Reportar contagens Python e Vitest separadas. Se o gerador abortar após uma falha de asserção, pode reutilizar o MESMO JSON completo com algoritmo/header/locale originais, sem repetir a suíte: conferir numTotalTests igual à soma de assertions, ausência de arquivos vazios/falhas de import, preservar log/hash e exigir CI exata. A execução desta tarefa comprovou cinco nomes stale do inventário anterior em quatro arquivos idênticos à main; retirar somente esses registros, sem fabricar nomes ou remover testes. Preservar os dois espaços finais produzidos por títulos parametrizados vazios como exceção de dado gerado, sem editar títulos/gerador para ocultá-los. Se falha de import frio Windows conhecida reaparecer, preservar falha, diagnosticar o arquivo isolado e exigir CI Linux completo; não mudar testes nem timeout para mascarar.
- [ ] **Step 6: Auto revisar, commitar e relatar.** Branch guard, paths explícitos, task-2-report.md com RED/GREEN, comando/saída, suites e limites. Revisor independente de concorrência e compatibilidade antes dos gates finais. Nenhum push remoto pelo implementador.

## Gates finais do controlador

- [ ] Conformidade e qualidade aprovadas nas duas tarefas, pendências resolvidas/registradas. Conferir todo delta contra main, allowlist e ancestralidade original; package/lock/configuração operacional sem delta.
- [ ] Rodar npm run db:checar; integração em banco local descartável por npm run test:integracao; build sem env por npm run build:e2e e jornadas npm run test:e2e -- --sem-build. Não herdar DATABASE_URL_ADMIN externo. Conferir inventário e resultados de unidade sem repetição desnecessária.
- [ ] Revisão final da branch inteira em agente novo do modelo mais capaz, com pacote de diff main..HEAD, relatórios e ledger. Corrigir achados materiais com implementador e revisão do fix.
- [ ] Atualizar a PR 53 por push fast-forward somente se seu remoto continuar no head original ou no último head publicado por esta execução; main deve permanecer na base registrada, ou adaptar/retestar nova base. Atualizar título/corpo para escopo final e marcar ready somente após gates.
- [ ] CI Linux completo verde no head exato, main fresca, revisão final aprovada; squash merge da PR existente sem bypass. Verificar resultado na main e CI push pós-merge. Nenhuma publicação/ativação externa.
- [ ] Restaurar env se destino livre, arquivar artefatos ignorados em .superpowers/sdd/completed e entregar resultado, links e limites.

## Descobertas incorporadas durante execução

- Task1: a revisão encontrou várias ocorrências de pendência por empresa; cliente Python corrigido com RED/GREEN e contrato do exportador real, guardas numéricas e demais contagens preservadas.
- Task2: suíte existente mostrou aceitação indevida de 24:00:00 no runtime; ampliar apenas para arquivo_drive.py/test_arquivo_drive.py, ambos já na allowlist. Path.is_junction confirma floor preexistente3.12 para suíte inteira; documentação corrigida, sem nova dependência.
- São correções necessárias aos gates de integração aprovados pelo usuário; não mudam operação instalada nem os contratos Google atuais.

## Auto revisão do plano

Cobertura da spec: transporte/documentação/helpers em Task 1; portabilidade/fronteira/gate Python em Task 2; integração e CI pelo controlador. Todos os cinco riscos têm cobertura ou verificação de diff própria. Não há mudança de API do CRM nem dependência entre implementações paralelas. Escolha preservada: agentes separados, execução sequencial e revisão final independente. Decisões de exclusão e risco preexistente permanecem rastreadas na spec.
