# Setup Playwright — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Este trabalho segue na branch já preparada, com revisão independente ao final.

**Goal:** executar cinco jornadas de autenticação contra Next.js e Postgres reais e exigir o resultado no CI.

**Architecture:** um runner cria banco temporário pelo harness existente, semeia contas próprias, inicia o build de produção em porta isolada e encerra recursos no finally. Playwright usa Chromium, um worker e contexto novo por cenário. Uma função pequena decide quando a conferência externa do CI pode ser omitida.

**Tech Stack:** Next.js 16.3.4, TypeScript, npm, Vitest, Playwright Test, Postgres 17, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-setup-playwright-design.md`, aprovada em 10/09/2026.

## Restrições globais

- Banco local descartável; Next recebe apenas URL de `app_teste`.
- Não carregar `.env.railway.local`, não usar o servidor 3000 e não modificar credenciais de `app_conexao`.
- Build `.next-e2e`, Chromium, um worker, sem relaxar cookie `secure`.
- TDD para lógica nova; prova negativa para E2E de fluxos existentes.
- PR contra main, sem merge automático e sem migração de produção.
- Preservar `AGENTS.md` não versionado.

## 1. Recursos e isolamento

Arquivos: `tests/integracao/ajuda.ts`, `tests/integracao/ajuda.test.ts`, `tests/e2e/ambiente.ts`, `src/e2e-ambiente.test.ts`.

Interface existente: `criarBancoDeTeste(): Promise<BancoDeTeste>`, `BancoDeTeste.derrubar(): Promise<void>`.
Interface nova: `ambienteDoServidor(fonte: NodeJS.ProcessEnv, urlApp: string): NodeJS.ProcessEnv` e `comRecursos<T>(preparar: () => Promise<{ executar: () => Promise<T>; encerrar: () => Promise<void> }>): Promise<T>` apenas se a coordenação realmente exigir extração; preferir try/finally direto a abstração sem consumidor.

- [ ] Escrever teste que injeta falha após a criação do banco no harness e verifica que não sobra banco. Rodar vermelho antes de mudar o helper.
- [ ] Garantir DROP do banco criado se migração ou preparação de login falhar, preservando o erro original e reportando falha de limpeza se houver.
- [ ] Escrever testes para o ambiente do processo filho: URL restrita local substitui URL herdada, credenciais admin/conferência e ALVO ficam vazios, SSL remoto não vaza; host remoto é recusado.

```ts
expect(ambienteDoServidor({ DATABASE_URL_ADMIN: 'valor-herdado', ALVO: 'railway' },
  'postgres://app_teste:teste@localhost:5432/teste_0123456789ab'))
  .toMatchObject({ DATABASE_URL_ADMIN: '', DATABASE_URL_CONFERENCIA: '', ALVO: '', PG_SSL: 'off' })
```

- [ ] Rodar `npx vitest run --project unitario src/e2e-ambiente.test.ts` vermelho; implementar e rodar verde.
- [ ] Rodar integração do helper alterado para confirmar a limpeza real.

## 2. Runner e navegador

Arquivos: `scripts/e2e/build.mts`, `scripts/e2e/run.mts`, `tests/e2e/ambiente.ts`, `tests/e2e/autenticacao.spec.ts`, `playwright.config.ts`, `package.json`, `package-lock.json`, `next.config.ts`, `.gitignore`.

- [ ] Instalar `@playwright/test` como devDependency pelo npm e Chromium pelo instalador oficial.
- [ ] `CRM_E2E=1` seleciona somente `.next-e2e` em next.config.ts. Build ocorre com URLs de banco vazias, em processo separado.
- [ ] `npm run build:e2e` produz o build isolado; `npm run test:e2e` faz build e executa; `npm run test:e2e -- --sem-build` reusa explicitamente o build existente, com verificação de BUILD_ID.
- [ ] Runner carrega `.env.test`, exige host local, confere porta 3100 livre e chama o harness. Antes de iniciar o servidor, semeia contas exclusivas de gestor, vendedor, login inválido e senha provisória pelo helper `criarUsuarioComSenha`.
- [ ] Iniciar CLI Next com `process.execPath`, `windowsHide: true`, porta 3100 e URL restrita. Esperar resposta de `/login` com prazo e detectar saída prematura do processo.
- [ ] Executar CLI Playwright pelo Node; devolver o código de saída, inclusive falhas.
- [ ] Em finally: encerrar processo Next, fechar conexões e derrubar o banco temporário. Tratar interrupção e falha de inicialização. Nunca matar processos por nome/porta; apenas o PID filho criado.
- [ ] Cinco testes usam `getByRole`, `getByLabel` e asserções com espera automática; nenhum mock de login/cookie.

```ts
await page.goto('/usuarios')
await expect(page).toHaveURL(/\/login$/)
await page.getByLabel('E-mail').fill('gestore2e@teste.local')
await page.getByLabel('Senha', { exact: true }).fill('Gestor-e2e-2026')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await expect(page).toHaveURL('http://127.0.0.1:3100/')
await page.goto('/usuarios')
await expect(page.getByRole('heading', { name: 'Usuários', exact: true })).toBeVisible()
```

- [ ] Cobrir senha incorreta, gestor/login/logout, vendedor redirecionado para `/`, e troca provisória seguida de logout e tentativa com senha antiga/nova.
- [ ] Demonstrar vermelho de um cenário existente por controle negativo temporário no estado de teste, não por quebrar o produto. Restaurar e obter verde.
- [ ] Executar duas rodadas e conferir ausência de banco/servidor órfão e preservação do CRM na porta 3000.

## 3. CI, documentação e revisão

Arquivos: `.github/workflows/ci.yml`, `scripts/ci/conferencia.mts`, `scripts/ci/politica-conferencia.ts`, `src/ci-conferencia.test.ts`, `README.md`.

Interface: `decidirConferencia({ temUrl, fork, autor }): 'conferir' | 'pular' | 'falhar'`.

- [ ] Testar primeiro a matriz de decisões, com expectativas literais:

```ts
expect(decidirConferencia({ temUrl: false, fork: false, autor: 'Browsher' })).toBe('falhar')
expect(decidirConferencia({ temUrl: false, fork: false, autor: 'dependabot[bot]' })).toBe('pular')
expect(decidirConferencia({ temUrl: false, fork: true, autor: 'alguem' })).toBe('pular')
expect(decidirConferencia({ temUrl: true, fork: false, autor: 'Browsher' })).toBe('conferir')
```

- [ ] Implementar a decisão e o CLI: conferir mantém exigência de CA e chama db:pendentes; pular escreve motivo no resumo; falhar retorna código 1. Identidade vem do payload confiável do GitHub.
- [ ] CI instala Chromium, faz build isolado sem env, roda E2E sem repetir build e publica relatório/trace em falha com retenção de sete dias. Tudo permanece no job obrigatório `catraca`.
- [ ] README explica comandos, Postgres, porta/build isolados, limites da suíte e exceção de credenciais do Dependabot.
- [ ] Rodar typecheck, lint, unitários, integração, db:checar e E2E; registrar resultados reais.
- [ ] Revisão independente, correções e reteste proporcional. Commit somente após guarda explícita contra main. Push e PR contra main com resultados e limites.

## Decisões operacionais já executadas

GitHub instalado e autenticado; alertas e PRs de segurança do Dependabot habilitados. Secret scanning e push protection já estavam ativos. Estas ações não dependem do merge deste plano, mas a adaptação do CI depende.
