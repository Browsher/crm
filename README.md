# CRM

CRM para uma equipe de cinco vendedores por telefone. Next.js, TypeScript,
Postgres com RLS. A autoridade sobre quem vê o quê está no banco, não no código.

## Subir

```bash
npm ci
npm run db:subir                      # Postgres 17 em Docker
cp .env.example .env.local            # e ajuste a senha local
npm run db:aplicar                    # migrações + invariantes
npm run db:senha -- app_conexao <senha-local>
npm run db:seed:gestor -- "Seu Nome" voce@dominio
npm run dev
```

## Testar

```bash
npm test                # unitário + integração (precisa do container)
npm run test:unit
npm run test:integracao
npm run db:checar       # convenções das migrações, sem banco
```

Os testes de integração criam um banco por arquivo no container e o derrubam
no fim. O CI faz o mesmo com `services: postgres`.

### Navegador (Playwright)

```bash
npx playwright install chromium     # uma vez depois de npm ci
npm run db:subir
npm run test:e2e                    # build de produção + cinco jornadas
# Para repetir sem alterar código:
npm run test:e2e -- --sem-build
```

O runner usa `.env.test` (ou `DATABASE_URL_ADMIN` local explícita), cria e remove
um banco `teste_*`, aplica as migrações e conecta o Next como `app_teste`.
Hosts remotos são recusados antes de criar banco. A porta 3100 precisa estar
livre; o servidor habitual na 3000 e seu build `.next` ficam separados.
`npm run build:e2e` gera `.next-e2e` sem credenciais de banco; os cookies de
produção continuam `secure`. O runner encerra seu servidor e banco também
quando um teste falha. Uma interrupção forçada do sistema pode impedir cleanup.

Chromium verifica visitante, senha incorreta, gestor com login/logout,
vendedor sem administração e troca de senha provisória. Cada cenário recebe
contexto de navegador novo. Importação, fila e outros navegadores ainda não
estão nesta suíte. Relatórios ficam em `playwright-report`; traces de falhas,
em `test-results`. Ambos são ignorados pelo git e retidos por sete dias no CI.

## Banco na Railway

Aplicar migração em produção é manual, da sua máquina, com
`.env.railway.local` (ignorado pelo git):

```bash
ALVO=railway npm run db:pendentes     # só lê
ALVO=railway npm run db:aplicar
```

O PR roda a conferência somente-leitura contra a Railway e falha se uma
migração aplicada foi alterada.
Sem a credencial de conferência, somente PR de fork ou do autor oficial
`dependabot[bot]` pula essa consulta, com nota no resumo. PR interno comum
falha se o secret faltar. As verificações locais, inclusive Playwright,
continuam obrigatórias no job `catraca` em todos esses casos.

## Por quê

`docs/db/fundacao.md` explica a fundação: papéis, identidade por transação,
regras de migração, TLS até a Railway. Cada migração tem seu
`docs/db/NNNN.md`. A spec completa está em `docs/superpowers/specs/`.
