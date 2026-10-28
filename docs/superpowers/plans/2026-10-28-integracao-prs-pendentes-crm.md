# Integração das PRs pendentes do CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execução sequencial, com implementador e revisor distintos por PR. Steps use checkbox syntax for tracking.

**Goal:** atualizar e validar as PRs de dependências 59, 58, 57 e 54 para integração na main, e concluir a avaliação separada das funcionalidades 56 e 53.

**Architecture:** preservar as PRs existentes e seu histórico. Cada atualização incorpora a main vigente, mantém somente seu delta necessário e passa por revisão independente e CI completo antes da integração; só então a seguinte usa a nova main. A produção publicada permanece no commit 186d217, pois o gatilho Git da main continua desabilitado.

**Tech Stack:** npm/package-lock.json, Node.js 24.x, Next.js 16, React 19.2.8, Zod 4, Vitest 5, Vite 8, jsdom 29, Undici 7 e PostgreSQL local descartável.

**Spec:** instrução humana Segue, após o roteiro apresentado; PRs https://github.com/Browsher/crm/pull/59, /58, /57 e /54 com os alvos abaixo; REGRAS.md (R-001, R-002, R-003, R-013, R-017, R-020, R-021, R-022). As PRs 53/56 são avaliadas separadamente, sem supor autorização para ativar automações externas ou descartar requisitos.

**Baseline medido:** main 186d217a4900e5fc71f4e89f8e89a4685deddf69, tree df7091b25e034e61c0a93fe90dc17b28678b00aa. CI211/run40734984781 aprovado: 1793 unidades/2 skips, 724 integrações e 104 jornadas. Esta evidência é da baseline, não dos novos heads. Documento registra o roteiro; resultados efetivos ficam nas PRs, CI e ledger de execução.

## Global Constraints

- Toda mudança passa por branch e PR. Merge só com CI verde (R-001). Sem commits/push na main local e sem atalhos de admin ou mudança na proteção.
- package-lock.json manda: npm em tudo (R-002). Nunca --force nem --legacy-peer-deps para esconder conflito de peers (R-003).
- Conferir e bloquear branch main imediatamente antes de cada commit; conferir HEAD e CI exatos antes de push/merge (R-013/R-022).
- Não empilhar PRs: todas continuam contra main, incorporando a main vigente após a integração anterior (R-021). Sem force-push de branches existentes.
- Preservar APIs e comportamento do CRM, tipos, regras de negócio, permissões, RLS, UI aprovada e correções de foco. Sem reintroduzir código antigo no merge das branches.
- Manter Node.js 24.x, React/ReactDOM 19.2.8, scripts e workflows existentes. Não atualizar outros pacotes diretos salvo necessidade concreta de compatibilidade documentada e revisada.
- Não criar testes que apenas afirmem versões. Usar contratos existentes; uma regressão real exige reprodução antes da correção.
- Testes somente com .env.test, serviços simulados e DB local descartável. Não acessar produção ou executar aquisição, envios, vínculos, consultas pagas, workflow ou planilha real.
- Configuração local .env.local criada pelo link da publicação fica em quarentena ignorada, sem leitura/exposição dos valores. Restaurar no fim se o caminho original permanecer livre.
- Antes de todo processo de testes local, esvaziar GOOGLE_PLANILHA_N8N_URL, GOOGLE_PLANILHA_N8N_TOKEN, GOOGLE_VERIFICACOES_URL e GOOGLE_VERIFICACOES_TOKEN no ambiente do processo. Não confiar no mock de Sheets para conter n8n herdado.
- Não modificar serviços, credenciais, configuração externa, SQL/migrações, limites, ações comerciais nem a publicação. vercel.json git.deploymentEnabled.main=false e o procedimento manual permanecem intactos.
- Artefatos e logs ficam no workspace ignorado deste plano; não incluir .superpowers nem dados privados em commits.
- Produção está READY em dpl_BimuCSSbkLyiCP3hG2P5Z7a92mQQ, commit186d217. A autorização anterior de publicação pertence a essa versão; novas publicações são uma etapa separada.

## Review Focus

1. Importar main sem desfazer o design system: provar app/src/tests/SQL/config idênticos à main, salvo adaptação mínima demonstrada como necessária.
2. Lockfile cumulativo: confirmar versões anteriores já integradas, peers, integridades, registries e justificar entradas opcionais do oxide; nenhum downgrade ou pacote direto incidental.
3. Next/App Router/Server Actions: preservar autenticação, redirects, permissões, formulários e renderização; CI completo com build e jornadas existentes.
4. Zod: preservar parsing, aceitação/rejeição e transporte dos contratos existentes; unidades correspondentes e integrações do CI.
5. Undici/jsdom/Vite: preservar DOM, FormData, fetch, mídia, foco e transformação de módulos; unidades no Windows e CI completo no Linux.

## Verificação comum e limites

- Local: npm ci, npm run typecheck, npm run lint e npm run test:unit, com o ambiente isolado acima. O executor pode escolher um subconjunto focado somente quando demonstrar quais contratos do pacote cobre; registrar comando e resultado completos.
- Não repetir integração/E2E/build completos localmente: o CI remoto obrigatório já executa tipos, lint, convenções, unidade, integração, build e jornadas no Linux. Novo erro concreto pode justificar reprodução local focada.
- Comparar árvore contra a main vigente. Allowlist usual: package.json e package-lock.json; somente a primeira PR leva também este plano. Ajustes fora disso exigem motivo, teste e revisão próprios.
- Instalação consistente e testes verdes não demonstram ausência de toda vulnerabilidade. Ler notas/advisories primários pertinentes; não concluir exposição em produção por mera versão.
- Análises e revisões são somente leitura; revisor não repete suítes já executadas, salvo dúvida específica que a evidência não responda.

### Task 1: PR59 — Next 16.4.1

**Files:** Modify package.json e package-lock.json; incorporar este plano como documentação de execução. Test: projetos unitario/integracao e tests/e2e existentes.
**Interfaces:** consome main186d + head912c4fddb1387ec910b9da95f807b51eecdd1a9e; produz PR59 atualizada com next16.4.1 e nova evidência de integração.

- [ ] Ler a documentação atual e os advisories primários da PR; conferir engines/peers e manter React19.2.8.
- [ ] Criar branch codex própria a partir do head da PR, incorporar origin/main por merge e o commit deste plano; preservar o head original como ancestral.
- [ ] Validar manifest Next16.4.1 e lock coerente. Não alterar eslint-config-next16.3.8 só por simetria; compatibilidade real pode justificar alinhamento documentado, sem force/legacy-peer-deps.
- [ ] Instalar e executar os checks locais comuns no ambiente isolado; registrar qualquer falha com causa e correção mínima.
- [ ] Commit na branch correta; gerar pacote da diferença inteira contra a main; revisão de spec e qualidade independente.
- [ ] Atualizar a branch remota da PR existente por fast-forward, após conferir que o head remoto não mudou; CI completo no novo HEAD.
- [ ] Integrar na main somente com revisão aprovada, CI exato verde e autorização aplicável; registrar SHA e gates antes da próxima PR. Se a revisão automática negar a operação, não contornar por CLI/UI/API alternativos.

### Task 2: PR58 — Undici 7.30.1

**Files:** Modify package-lock.json. Test: unidades DOM/fetch existentes e CI completo.
**Interfaces:** consome main após Task1 + head7a6508d13d9b60b9def8a12a806b47afb937d556; produz Undici7.30.1 transitivo de desenvolvimento pelo jsdom, preservando Next integrado.

- [ ] Ler notas/advisories primários, conferir caminho jsdom e range compatível; não adicionar dependência direta nem override desnecessário.
- [ ] Atualizar a PR existente com a main vigente, resolver somente o lock necessário e verificar o alvo exato7.30.1.
- [ ] Checks locais comuns, com foco DOM/fetch; commit, revisão independente, push fast-forward e CI completo exato.
- [ ] Integrar apenas após os gates e registrar a nova main para Task3.

### Task 3: PR57 — Zod 4.6.6

**Files:** Modify package.json e package-lock.json. Test: unidades dos quatro módulos consumidores e CI completo.
**Interfaces:** consome main após Task2 + head271fe26fe84577c599b3277e8f3a144b41447ff6; produz manifest ^4.6.6/lock4.6.6, preservando Next/Undici integrados.

- [ ] Ler orientação atual de compatibilidade4.x e conferir os consumidores reais; preservar as entradas e os resultados existentes.
- [ ] Atualizar a PR existente com a main vigente; instalar o alvo exato sem elevar outros pacotes por resolução ampla.
- [ ] Checks locais comuns, contratos de parsing e transporte; commit, revisão independente, push fast-forward e CI completo exato.
- [ ] Integrar apenas após os gates e registrar a nova main para Task4.

### Task 4: PR54 — Vite 8.3.5

**Files:** Modify package-lock.json. Test: unidade completa/Vitest/DOM no Windows e CI completo no Linux.
**Interfaces:** consome main após Task3 + head7b4fe9daff274af94619f73b73ad220ecedeff98; produz Vite8.3.5 transitivo, preservando os três alvos integrados.

- [ ] Conferir engines/peers de Vitest, mocker e plugin-react e notas oficiais do8.3.5; revisar Rolldown e opcionais que acompanham a atualização.
- [ ] Atualizar a PR existente com a main vigente e manter o alvo exato8.3.5; não criar dependência direta de Vite.
- [ ] Checks locais comuns, unidade completa e prova de lock cumulativo; commit, revisão independente, push fast-forward e CI completo exato.
- [ ] Integrar após os gates; revisão final do delta cumulativo por agente mais capaz, sem reauditar produto byte a byte idêntico à baseline.

### Task 5: Avaliação conclusiva da PR56

**Files:** nenhuma alteração de produto nesta tarefa; relatório ignorado do requisito exclusivo.
**Interfaces:** consome inventário comprovado de17blobs idênticos/46diferentes e evolução pela PR55; produz matriz de requisitos já entregues, alterações intencionais e pendências exclusivas verificadas.

- [ ] Confrontar os requisitos originais com a main atual, sem repetir o inventário de blobs.
- [ ] Propor patch mínimo para requisito exclusivo ainda necessário ou encerramento como substituída; apresentar evidência e impacto antes de qualquer descarte ou reintrodução de fornecedor/cota antiga.

### Task 6: Avaliação conclusiva da PR53

**Files:** nenhuma alteração de produto/automação externa nesta tarefa; relatório ignorado de compatibilidade e escopo.
**Interfaces:** consome inventário86/92caminhos ausentes, draft e conflitos; produz escopo executável que preserve Google/Casa dos Dados e discrimine validações locais e externas necessárias.

- [ ] Inspecionar os cinco caminhos compartilhados e os contratos novos; não confundir biblioteca CNPJ compartilhada com a automação integrada.
- [ ] Separar código que pode ser validado com mocks de ativações/credenciais/workflow/Drive reais. Nenhum envio, coleta paga ou mutação externa é feito nesta avaliação.
- [ ] Entregar decisão concreta de prontidão e próximos ajustes, sem transformar sinal verde histórico em certificação atual.

## Checkpoints

Método de agentes separados e execução já escolhidos pelo usuário. Este roteiro concretiza a instrução Segue dentro do escopo apresentado; não reabre seleção de método nem cria autorização de publicação. Cada integração exige os gates acima; decisões de escopo não triviais e custos são preservados no ledger.
