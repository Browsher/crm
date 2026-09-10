# Setup de qualidade: GitHub e primeiros testes Playwright

Status: aprovada em 10/09/2026; implementada e validada localmente, aguardando CI e integração por PR.
Base: `061bb2c`, PR #22. Branch: `codex/setup-playwright`.

## Objetivo

Adicionar proteção de dependências e uma primeira verificação automática do
caminho navegador → Next.js → Postgres. A suíte atual verifica módulos e banco,
mas não executa o formulário de login, o cookie e os redirecionamentos juntos.

Esta entrega configura ferramentas de desenvolvimento. Os quatro defeitos da
auditoria continuam separados; o P1 de emissão de sessão já foi reproduzido,
mas sua implementação ainda não começou.

## Estado conferido e ações já concluídas

Em 10/09/2026, consultas à API do GitHub confirmaram:

- `secret_scanning`: já habilitado;
- `secret_scanning_push_protection`: já habilitado;
- `catraca` obrigatória na main, inclusive para administradores;
- alertas do Dependabot e atualizações de segurança: estavam desabilitados,
  foram habilitados e a leitura posterior confirmou o estado;
- plugin GitHub instalado; a consulta de perfil autenticou como `Browsher`.

Context7 foi configurado anteriormente no modo local utilizado pelo Claude,
com consulta pública de documentação bem-sucedida. Esses conectores são
configuração do Codex, não dependências nem código do CRM.

## Alternativas e escolha recomendada

1. **Playwright Test no projeto, com dados descartáveis e CI obrigatório.**
   Recomendado: produz testes repetíveis e falha verificável no PR.
2. Somente controle de navegador pelo agente. Útil para exploração e revisão
   manual, mas não cria uma suíte que rode em cada PR.
3. Cobrir imediatamente todos os fluxos e navegadores. Adia a entrega e aumenta
   o custo de manutenção antes de validar a infraestrutura de E2E.

A primeira entrega usa Chromium e uma suíte pequena de autenticação e acesso.
Importação, fila e outros navegadores ficam para ampliações com cenários próprios.

## Cenários iniciais

1. Pessoa sem sessão visita `/usuarios` e chega a `/login`.
2. Login com senha incorreta exibe o erro e não permite abrir a página protegida.
3. Gestor com senha definitiva entra pelo formulário, acessa `/usuarios`, sai
   pelo fluxo de logout e deixa de conseguir acessar a página protegida.
4. Vendedor entra pelo formulário e, ao visitar `/usuarios`, é redirecionado
   para `/`, conforme `src/server/autenticacao/acesso.ts`.
5. Usuário com senha provisória entra, é encaminhado para `/trocar-senha`,
   permanece impedido de acessar páginas que exigem troca concluída, realiza
   a troca pelo formulário e consegue prosseguir. Depois de sair, a senha antiga
   falha e a nova permite entrar.

Cada cenário usa um contexto de navegador novo e contas de teste próprias.
O login não será substituído por injeção de cookie ou mock: testar a emissão,
o transporte e o uso do cookie é parte da finalidade desta entrega.

## Execução e isolamento

- Dependência de desenvolvimento `@playwright/test`, com npm e package-lock.
- Configuração `playwright.config.ts`, testes sob `tests/e2e/` e comando
  `npm run test:e2e`.
- Postgres real, com banco temporário de nome gerado para a execução. Reusar
  o caminho de migração e o papel `app_teste` existentes, sem copiar privilégios.
- Conferir host local antes de criar ou apagar qualquer banco. A URL admin
  prepara dados; o Next.js recebe somente a URL restrita de `app_teste`.
- Não carregar `.env.railway.local`. O runner carrega a configuração local de
  testes e recusa host remoto; variáveis herdadas não podem fazê-lo usar produção.
- Aplicação de teste em porta própria, sem reusar o servidor do usuário na 3000.
  Se a porta de teste estiver ocupada, falhar, em vez de testar outra aplicação.
- Exercitar build de produção. Usar diretório de saída próprio `.next-e2e`
  para não interferir no servidor de desenvolvimento. A opção de configuração
  deve alterar somente o diretório de build; não relaxar cookies ou autorização.
- Chromium deve exercitar o cookie real de produção no endereço local escolhido.
  Confirmar essa compatibilidade na primeira execução; não remover `secure`
  do produto para fazer o teste passar.
- Um worker inicialmente. A concorrência de operações no banco continua sendo
  responsabilidade dos testes de integração específicos.
- Encerrar servidor e conexões antes de remover o banco temporário. Cobrir
  falha de inicialização e falha de teste, não apenas a execução verde.
- Ignorar `.next-e2e/`, resultados, relatórios e estado de navegador no Git.

## CI e Dependabot

Manter o job obrigatório `catraca` e seus checks existentes. Instalar Chromium
com as dependências necessárias no runner Linux, executar E2E e anexar relatório
e trace de falhas com retenção curta. E2E deve falhar a catraca quando falhar.

Preservar a prova de build sem credenciais. Planejar a reutilização do build
isolado na etapa E2E para evitar dois builds idênticos no CI.

PRs do Dependabot não recebem os mesmos secrets de Actions. Hoje o workflow
recusa qualquer PR interno sem `DATABASE_URL_CONFERENCIA`; isso faria um PR
de dependência falhar mesmo com testes verdes.

Recomendação: permitir a ausência da conferência externa apenas para PRs de
fork e PRs cujo autor seja o bot oficial `dependabot[bot]`, registrando o motivo
no resumo do job. Manter a falha por secret ausente em PR interno comum. A suíte
local de migração e os demais checks rodam em todos os casos. Não usar
`pull_request_target` para executar código do PR com secrets.

O Dependabot abre PRs de segurança; esta entrega não habilita merge automático
nem atualização irrestrita de versões. Caso o CI gere uma proposta de mudança
de migração feita pelo bot, ela continua exigindo revisão humana e conferência
antes de aplicação; a exceção não é evidência sobre o estado da Railway.

Fonte: https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-on-actions

## Validação e entrega

- TDD nos componentes novos do runner: começar por testes que falhem pela
  ausência das garantias de isolamento/limpeza, depois implementar.
- Como os fluxos do produto já existem, um E2E correto pode nascer verde;
  demonstrar que ele detecta uma falha com um controle negativo temporário
  e restaurado, sem mudar a regra do produto para encaixar no teste.
- Testar a decisão de conferência externa: PR comum sem secret falha; fork e
  Dependabot sem secret deixam nota; credenciais disponíveis permitem conferir.
- Rodar typecheck, lint, testes unitários, integração, convenções de migração
  e Playwright. Repetir E2E para conferir independência entre execuções.
- Revisão independente dos testes, do isolamento e da alteração no CI.
- Branch e PR contra main; não aplicar migração de produção nesta entrega.

Arquivos previstos: package.json/package-lock.json, playwright.config.ts,
tests/e2e, scripts de suporte de teste se necessários, next.config.ts,
.gitignore, .github/workflows/ci.yml e documentação de execução.

Documentação da versão instalada consultada:
`node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`.
Documentação do Playwright: https://playwright.dev/docs/test-webserver e
https://playwright.dev/docs/auth.
