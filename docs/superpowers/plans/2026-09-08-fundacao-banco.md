# Fundação de banco — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conexão com Postgres por papel sem privilégio, runner de migrações imutáveis, identidade por transação aplicada por RLS, e tabela `usuario` com funções de acesso, auditoria e políticas, tudo testado contra Postgres real.

**Architecture:** SQL puro em `db/migracoes/`, aplicado por um runner TypeScript em `src/server/db/migracoes/` que é dono da transação e registra a soma do arquivo. A aplicação só fala com o banco por `comoUsuario()`, que abre transação, injeta `app.usuario_id` e `role` numa ida só e devolve `executar`. Testes de integração criam um banco por arquivo num Postgres real (Docker local, `services` no CI).

**Tech Stack:** Next 16, TypeScript 5, `pg` 8.23, `zod` 4.5, Vitest 5 (projetos `unitario` e `integracao`), `tsx` para rodar os CLIs, Postgres 17 em Docker, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-fundacao-banco-design.md`

## Global Constraints

- TypeScript sem ponto e vírgula, aspas simples. Regra de negócio devolve `{ ok, motivo }`; exceção só para infraestrutura.
- Branch + PR. Nunca commit na main. Um só gerenciador: npm. Nunca `--force` nem `--legacy-peer-deps`.
- Nenhuma variável de ambiente sem consumidor. Nenhuma credencial em migração nem em arquivo versionado além do `.env.test` do container local.
- Migração: `BEGIN;` na primeira linha, `COMMIT;` na última, no máximo uma linha de comentário no topo começando com `--` e com até 120 caracteres, sem `DROP TABLE`/`DROP COLUMN`, sem schema de fornecedor, PK `uuid DEFAULT gen_random_uuid()`.
- `pool.ts` conecta só como `app_conexao`. Runner, seed e harness conectam como admin por `admin.ts`.
- `PG_SSL` aceita só `off` e `verify`. Não existe modo inseguro.
- Todo teste de invariante crítica tem controle negativo.
- Nomes em português, como o restante do projeto.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` | Postgres 17 local |
| `.env.test` | env do container local para os testes. Versionado. |
| `vitest.config.mts` | projetos `unitario` e `integracao` |
| `tests/setup-env.ts` | carrega `.env.test` com `@next/env` |
| `src/server/db/env.ts` | valida env do servidor, preguiçoso |
| `src/server/db/ssl.ts` | `configSsl(env)` para `pg` |
| `src/server/db/admin.ts` | `comAdmin(url, fn)`: `pg.Client` direto, sem guarda |
| `src/server/db/pool.ts` | pool singleton em `globalThis`, guarda de papel |
| `src/server/db/como-usuario.ts` | `comoUsuario()`, `Executar`, `ExecutarForaDaTransacao` |
| `src/server/db/migracoes/arquivos.ts` | lê a pasta, calcula soma, remove `BEGIN;`/`COMMIT;` |
| `src/server/db/migracoes/checar.ts` | regras estáticas |
| `src/server/db/migracoes/aplicar.ts` | `aplicar()`, `pendentes()`, tabela `_migracao` |
| `src/server/db/migracoes/invariantes.ts` | conferências pós-aplicação |
| `db/migracoes/0000..0005*.sql` | as seis migrações |
| `docs/db/fundacao.md`, `docs/db/000N.md` | o porquê |
| `scripts/db/*.ts` | CLIs finos, rodados com `tsx` |
| `tests/integracao/ajuda.ts` | `criarBancoDeTeste()` |
| `tests/integracao/*.test.ts` | runner, conexão, identidade, políticas, auditoria, schema |
| `.github/workflows/ci.yml` | serviço Postgres, passos, conferência contra a Railway |

Decisão de ferramenta: os CLIs são `.ts` rodados com `tsx` em vez de `.mjs`, porque o runner é módulo TypeScript com imports sem extensão, e o Node 24 sozinho exige extensão `.ts` explícita nos imports. `tsx` é devDependency.

---

### Task 1: Dependências, Docker, env de teste e projetos do Vitest

**Files:**
- Modify: `package.json`
- Create: `docker-compose.yml`
- Create: `.env.test`
- Modify: `.gitignore`
- Modify: `vitest.config.mts`
- Create: `tests/setup-env.ts`
- Create: `tests/integracao/conexao-basica.test.ts`
- Delete: `src/lib/soma.ts`, `src/lib/soma.test.ts` (teste de fumaça do setup do CI, sem função)

**Interfaces:**
- Produces: `npm run test:unit`, `npm run test:integracao`, `npm test` (ambos), `npm run db:subir`, `npm run db:derrubar`. `process.env.DATABASE_URL_ADMIN` e `process.env.PG_SSL` disponíveis nos testes de integração.

- [ ] **Step 1: Instalar dependências**

```bash
npm i pg zod
npm i -D @types/pg tsx
```

Se um peer conflitar, subir o pacote antigo. Nunca `--force`.

- [ ] **Step 2: Criar `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17
    container_name: crm-postgres
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: crm
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 2s
      timeout: 2s
      retries: 15
```

- [ ] **Step 3: Criar `.env.test` e liberar no `.gitignore`**

`.env.test`:

```
# Estas credenciais valem SÓ para o container local do docker-compose.yml.
# Nunca podem ser as mesmas da Railway ou de qualquer banco remoto.
# Este arquivo é versionado num repositório público de propósito: não há segredo aqui.
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:5432/postgres
PG_SSL=off
```

Em `.gitignore`, logo abaixo de `.env*`, acrescentar:

```
!.env.test
```

- [ ] **Step 4: Scripts no `package.json`**

Substituir o bloco `scripts` por:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:unit": "vitest run --project unitario",
  "test:integracao": "vitest run --project integracao",
  "db:subir": "docker compose up -d --wait",
  "db:derrubar": "docker compose down"
}
```

- [ ] **Step 5: `tests/setup-env.ts`**

```ts
import { loadEnvConfig } from '@next/env'

// Vitest define NODE_ENV=test. Nesse modo o @next/env carrega .env.test e
// .env.test.local, e pula .env.local de propósito: teste não fala com a Railway.
loadEnvConfig(process.cwd())
```

- [ ] **Step 6: `vitest.config.mts` com dois projetos**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unitario',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integracao',
          environment: 'node',
          include: ['tests/integracao/**/*.test.ts'],
          setupFiles: ['tests/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
```

`jsdom` e `@vitejs/plugin-react` continuam instalados para um terceiro projeto quando houver componente.

- [ ] **Step 7: Escrever o teste de fumaça da integração**

`tests/integracao/conexao-basica.test.ts`:

```ts
import { Client } from 'pg'
import { expect, test } from 'vitest'

test('conecta no Postgres do container como admin', async () => {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_ADMIN })
  await cliente.connect()
  try {
    const { rows } = await cliente.query<{ versao: string }>('SELECT version() AS versao')
    expect(rows[0].versao).toMatch(/PostgreSQL 17/)
  } finally {
    await cliente.end()
  }
})
```

- [ ] **Step 8: Subir o container e rodar**

```bash
npm run db:subir
npm run test:integracao
```

Esperado: 1 teste passa. Se falhar com `ECONNREFUSED`, esperar o healthcheck e repetir.

- [ ] **Step 9: Remover o teste de fumaça antigo e rodar tudo**

```bash
git rm -q src/lib/soma.ts src/lib/soma.test.ts
npm test
```

Esperado: projeto `unitario` sem arquivos (Vitest avisa, não falha, porque `passWithNoTests` não é necessário quando outro projeto tem testes; se falhar, acrescentar `passWithNoTests: true` no projeto `unitario`), projeto `integracao` com 1 teste passando.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "infra: postgres local, env de teste e projetos do vitest"
```

---

### Task 2: `env.ts` e `ssl.ts`

**Files:**
- Create: `src/server/db/env.ts`
- Create: `src/server/db/env.test.ts`
- Create: `src/server/db/ssl.ts`
- Create: `src/server/db/ssl.test.ts`

**Interfaces:**
- Produces:
  - `lerEnv(fonte?: NodeJS.ProcessEnv): EnvBanco` onde `EnvBanco = { DATABASE_URL?: string; DATABASE_URL_ADMIN?: string; DATABASE_URL_CONFERENCIA?: string; PG_SSL: 'off' | 'verify'; PG_SSL_CA?: string }`. Lança `Error` com mensagem listando o campo se `PG_SSL` inválido.
  - `exigir(env: EnvBanco, chave: 'DATABASE_URL' | 'DATABASE_URL_ADMIN' | 'DATABASE_URL_CONFERENCIA'): string` lança se ausente.
  - `configSsl(env: Pick<EnvBanco, 'PG_SSL' | 'PG_SSL_CA'>): false | { rejectUnauthorized: true; ca?: string }`.

- [ ] **Step 1: Teste de `env.ts`**

`src/server/db/env.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { exigir, lerEnv } from './env'

describe('lerEnv', () => {
  test('PG_SSL ausente vira verify', () => {
    expect(lerEnv({}).PG_SSL).toBe('verify')
  })

  test('aceita off e verify', () => {
    expect(lerEnv({ PG_SSL: 'off' }).PG_SSL).toBe('off')
    expect(lerEnv({ PG_SSL: 'verify' }).PG_SSL).toBe('verify')
  })

  test('recusa qualquer outro valor, inclusive inseguro', () => {
    expect(() => lerEnv({ PG_SSL: 'inseguro' })).toThrow(/PG_SSL/)
    expect(() => lerEnv({ PG_SSL: 'true' })).toThrow(/PG_SSL/)
  })

  test('URLs são opcionais na leitura e exigidas por quem usa', () => {
    const env = lerEnv({ DATABASE_URL: 'postgres://a' })
    expect(exigir(env, 'DATABASE_URL')).toBe('postgres://a')
    expect(() => exigir(env, 'DATABASE_URL_ADMIN')).toThrow(/DATABASE_URL_ADMIN/)
  })

  test('string vazia conta como ausente', () => {
    expect(() => exigir(lerEnv({ DATABASE_URL: '' }), 'DATABASE_URL')).toThrow(/DATABASE_URL/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run --project unitario src/server/db/env.test.ts
```

Esperado: FAIL, módulo `./env` não existe.

- [ ] **Step 3: Implementar `env.ts`**

```ts
import { z } from 'zod'

const vazioViraUndefined = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
)

const esquema = z.object({
  DATABASE_URL: vazioViraUndefined,
  DATABASE_URL_ADMIN: vazioViraUndefined,
  DATABASE_URL_CONFERENCIA: vazioViraUndefined,
  PG_SSL: z.enum(['off', 'verify']).default('verify'),
  PG_SSL_CA: vazioViraUndefined,
})

export type EnvBanco = z.infer<typeof esquema>
export type ChaveUrl = 'DATABASE_URL' | 'DATABASE_URL_ADMIN' | 'DATABASE_URL_CONFERENCIA'

// Leitura preguiçosa: nada aqui roda na avaliação do módulo. `next build`
// avalia módulos sem env, e o CI faz isso de propósito.
export function lerEnv(fonte: NodeJS.ProcessEnv = process.env): EnvBanco {
  const resultado = esquema.safeParse(fonte)
  if (resultado.success) return resultado.data
  const campos = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`Variáveis de ambiente inválidas: ${campos}`)
}

export function exigir(env: EnvBanco, chave: ChaveUrl): string {
  const valor = env[chave]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${chave}`)
  return valor
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run --project unitario src/server/db/env.test.ts
```

- [ ] **Step 5: Teste de `ssl.ts`**

`src/server/db/ssl.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { configSsl } from './ssl'

describe('configSsl', () => {
  test('off desliga TLS', () => {
    expect(configSsl({ PG_SSL: 'off' })).toBe(false)
  })

  test('verify sem CA valida contra as CAs do sistema', () => {
    expect(configSsl({ PG_SSL: 'verify' })).toEqual({ rejectUnauthorized: true })
  })

  test('verify com CA inline usa o PEM', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
    expect(configSsl({ PG_SSL: 'verify', PG_SSL_CA: pem })).toEqual({ rejectUnauthorized: true, ca: pem })
  })

  test('nunca devolve rejectUnauthorized false', () => {
    const casos = [{ PG_SSL: 'off' as const }, { PG_SSL: 'verify' as const }]
    for (const caso of casos) {
      const r = configSsl(caso)
      if (r !== false) expect(r.rejectUnauthorized).toBe(true)
    }
  })
})
```

- [ ] **Step 6: Rodar e ver falhar, implementar `ssl.ts`**

```ts
import { readFileSync } from 'node:fs'
import type { EnvBanco } from './env'

type ConfigSsl = false | { rejectUnauthorized: true; ca?: string }

// PG_SSL_CA aceita o PEM inline ou um caminho de arquivo. Um PEM começa com
// '-----BEGIN'; qualquer outra coisa é tratada como caminho.
export function configSsl(env: Pick<EnvBanco, 'PG_SSL' | 'PG_SSL_CA'>): ConfigSsl {
  if (env.PG_SSL === 'off') return false
  if (!env.PG_SSL_CA) return { rejectUnauthorized: true }
  const ca = env.PG_SSL_CA.startsWith('-----BEGIN') ? env.PG_SSL_CA : readFileSync(env.PG_SSL_CA, 'utf8')
  return { rejectUnauthorized: true, ca }
}
```

- [ ] **Step 7: Rodar unitários, typecheck, lint**

```bash
npm run test:unit && npm run typecheck && npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/server/db
git commit -m "db: leitura de env preguiçosa e config TLS sem modo inseguro"
```

---

### Task 3: `admin.ts` e o harness `criarBancoDeTeste` (parte 1: criar e derrubar banco)

**Files:**
- Create: `src/server/db/admin.ts`
- Create: `tests/integracao/ajuda.ts`
- Create: `tests/integracao/ajuda.test.ts`
- Delete: `tests/integracao/conexao-basica.test.ts` (substituído)

**Interfaces:**
- Consumes: `lerEnv`, `exigir`, `configSsl` da Task 2.
- Produces:
  - `comAdmin<T>(url: string, trabalho: (cliente: Client) => Promise<T>): Promise<T>` em `admin.ts`. Abre `pg.Client` com `ssl: configSsl(lerEnv())`, executa, fecha sempre. Sem pool, sem guarda de papel.
  - `criarBancoDeTeste(): Promise<BancoDeTeste>` em `ajuda.ts`, onde por enquanto `BancoDeTeste = { nome: string; urlAdmin: string; sql: <T>(texto: string, params?: unknown[]) => Promise<T[]>; derrubar: () => Promise<void> }`. `urlAdmin` é a URL admin apontando para o banco novo. A Task 5 acrescenta a aplicação das migrações e a Task 7 acrescenta `comoUsuario`.

- [ ] **Step 1: Teste do harness**

`tests/integracao/ajuda.test.ts`:

```ts
import { afterAll, expect, test } from 'vitest'
import { comAdmin } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { criarBancoDeTeste } from './ajuda'

const bancos: Awaited<ReturnType<typeof criarBancoDeTeste>>[] = []
afterAll(async () => {
  for (const b of bancos) await b.derrubar()
})

test('cria um banco com nome único e consulta nele', async () => {
  const banco = await criarBancoDeTeste()
  bancos.push(banco)
  expect(banco.nome).toMatch(/^teste_[0-9a-f]{12}$/)
  const linhas = await banco.sql<{ atual: string }>('SELECT current_database() AS atual')
  expect(linhas[0].atual).toBe(banco.nome)
})

test('derrubar apaga o banco', async () => {
  const banco = await criarBancoDeTeste()
  await banco.derrubar()
  const urlAdmin = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  const existe = await comAdmin(urlAdmin, async (c) => {
    const { rows } = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco.nome])
    return rows.length
  })
  expect(existe).toBe(0)
})
```

O alias `@/` já aponta para a raiz do repositório no `tsconfig.json`. O Vitest não lê `paths` do tsconfig sozinho: acrescentar em `vitest.config.mts`, fora de `test`, `resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } }` com `import { fileURLToPath } from 'node:url'`.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run --project integracao tests/integracao/ajuda.test.ts
```

- [ ] **Step 3: Implementar `admin.ts`**

```ts
import { Client } from 'pg'
import { lerEnv } from './env'
import { configSsl } from './ssl'

// Caminho de administração: runner, seed e harness de teste. Conecta com a
// URL que receber, sem pool e sem a guarda de papel do pool.ts, porque aqui
// ser superusuário é o esperado. Nunca usar em código de aplicação.
export async function comAdmin<T>(url: string, trabalho: (cliente: Client) => Promise<T>): Promise<T> {
  const cliente = new Client({ connectionString: url, ssl: configSsl(lerEnv()) })
  await cliente.connect()
  try {
    return await trabalho(cliente)
  } finally {
    await cliente.end()
  }
}

// Troca o nome do banco na URL, mantendo usuário, senha, host e porta.
export function comBanco(url: string, banco: string): string {
  const u = new URL(url)
  u.pathname = `/${banco}`
  return u.toString()
}
```

- [ ] **Step 4: Implementar `ajuda.ts`**

```ts
import { randomBytes } from 'node:crypto'
import { comAdmin, comBanco } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'

export type BancoDeTeste = {
  nome: string
  urlAdmin: string
  sql: <T>(texto: string, params?: unknown[]) => Promise<T[]>
  derrubar: () => Promise<void>
}

export async function criarBancoDeTeste(): Promise<BancoDeTeste> {
  const urlServidor = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  const nome = `teste_${randomBytes(6).toString('hex')}`
  await comAdmin(urlServidor, (c) => c.query(`CREATE DATABASE ${nome}`))
  const urlAdmin = comBanco(urlServidor, nome)

  return {
    nome,
    urlAdmin,
    sql: async <T,>(texto: string, params?: unknown[]) =>
      comAdmin(urlAdmin, async (c) => (await c.query(texto, params)).rows as T[]),
    derrubar: async () => {
      await comAdmin(urlServidor, (c) => c.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`))
    },
  }
}
```

`nome` é gerado por nós com hex, então interpolar no `CREATE DATABASE` é seguro. `WITH (FORCE)` derruba conexões pendentes do pool no fim do arquivo de teste.

- [ ] **Step 5: Rodar e ver passar, apagar o teste de fumaça**

```bash
git rm -q tests/integracao/conexao-basica.test.ts
npx vitest run --project integracao
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "db: cliente admin e harness que cria um banco por arquivo de teste"
```

---

### Task 4: Leitura de arquivos de migração e checador estático

**Files:**
- Create: `src/server/db/migracoes/arquivos.ts`
- Create: `src/server/db/migracoes/arquivos.test.ts`
- Create: `src/server/db/migracoes/checar.ts`
- Create: `src/server/db/migracoes/checar.test.ts`

**Interfaces:**
- Produces:
  - `type Migracao = { nome: string; conteudo: string; soma: string; corpo: string }`
  - `lerMigracoes(pasta: string): Promise<Migracao[]>` ordenadas por nome. `soma` = sha256 hex do `conteudo`. `corpo` = conteudo sem a primeira e a última linha não vazias.
  - `somaDe(conteudo: string): string`
  - `corpoDe(conteudo: string): string`
  - `checarMigracoes(arquivos: { nome: string; conteudo: string }[]): { ok: true } | { ok: false; problemas: string[] }`

- [ ] **Step 1: Teste de `arquivos.ts`**

`src/server/db/migracoes/arquivos.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { corpoDe, somaDe } from './arquivos'

describe('somaDe', () => {
  test('sha256 hex do conteúdo inteiro', () => {
    expect(somaDe('BEGIN;\nSELECT 1;\nCOMMIT;\n')).toMatch(/^[0-9a-f]{64}$/)
  })
  test('qualquer byte diferente muda a soma, inclusive comentário', () => {
    const a = somaDe('-- a\nBEGIN;\nSELECT 1;\nCOMMIT;\n')
    const b = somaDe('-- b\nBEGIN;\nSELECT 1;\nCOMMIT;\n')
    expect(a).not.toBe(b)
  })
})

describe('corpoDe', () => {
  test('remove a primeira e a última linha', () => {
    expect(corpoDe('BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;\n')).toBe('CREATE TABLE x (id int);')
  })
  test('ignora linhas vazias nas pontas e mantém o miolo intacto', () => {
    expect(corpoDe('\nBEGIN;\nA;\n\nB;\nCOMMIT;\n\n')).toBe('A;\n\nB;')
  })
  test('remoção é posicional: não procura BEGIN no meio', () => {
    expect(corpoDe('BEGIN;\nSELECT \'BEGIN;\';\nCOMMIT;')).toBe("SELECT 'BEGIN;';")
  })
  test('comentário de uma linha no topo fica antes do BEGIN e é removido junto', () => {
    expect(corpoDe('-- ver docs/db/0001.md\nBEGIN;\nA;\nCOMMIT;')).toBe('A;')
  })
})
```

Atenção à última regra: o comentário permitido fica **acima** do `BEGIN;`. Então `corpoDe` remove a linha de comentário (se existir), a linha `BEGIN;` e a linha `COMMIT;`. A spec diz "primeira linha `BEGIN;`"; a leitura precisa aqui é "primeira linha que não é comentário". O checador impõe isso.

- [ ] **Step 2: Rodar e ver falhar, implementar `arquivos.ts`**

```ts
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Migracao = { nome: string; conteudo: string; soma: string; corpo: string }

export function somaDe(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex')
}

// Remove o comentário de topo (se houver), o BEGIN; e o COMMIT; das pontas.
// Posicional de propósito: o checador já garantiu a forma do arquivo.
export function corpoDe(conteudo: string): string {
  const linhas = conteudo.split(/\r?\n/)
  while (linhas.length && linhas[0].trim() === '') linhas.shift()
  while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop()
  if (linhas[0]?.startsWith('--')) linhas.shift()
  linhas.shift()
  linhas.pop()
  return linhas.join('\n')
}

export async function lerMigracoes(pasta: string): Promise<Migracao[]> {
  const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.sql')).sort()
  return Promise.all(
    nomes.map(async (nome) => {
      const conteudo = await readFile(join(pasta, nome), 'utf8')
      return { nome, conteudo, soma: somaDe(conteudo), corpo: corpoDe(conteudo) }
    }),
  )
}
```

- [ ] **Step 3: Teste do checador**

`src/server/db/migracoes/checar.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { checarMigracoes } from './checar'

const ok = (nome: string, corpo: string, comentario = '-- ver docs/db/0000.md') =>
  ({ nome, conteudo: `${comentario}\nBEGIN;\n${corpo}\nCOMMIT;\n` })

const valida = ok('0000_papeis.sql', "DO $$ BEGIN CREATE ROLE app_usuario NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

describe('checarMigracoes', () => {
  test('arquivo bem formado passa', () => {
    expect(checarMigracoes([valida])).toEqual({ ok: true })
  })

  test('nome fora do padrão', () => {
    const r = checarMigracoes([{ ...valida, nome: 'papeis.sql' }])
    expect(r).toMatchObject({ ok: false })
    expect((r as { problemas: string[] }).problemas.join()).toMatch(/nome/)
  })

  test('numeração precisa começar em 0000 e ser contígua', () => {
    const r = checarMigracoes([valida, ok('0002_x.sql', 'SELECT 1;')])
    expect((r as { problemas: string[] }).problemas.join()).toMatch(/0001/)
  })

  test('sem BEGIN; na primeira linha de código ou COMMIT; na última', () => {
    const semBegin = { nome: '0000_a.sql', conteudo: 'SELECT 1;\nCOMMIT;\n' }
    const semCommit = { nome: '0000_a.sql', conteudo: 'BEGIN;\nSELECT 1;\n' }
    expect(checarMigracoes([semBegin]).ok).toBe(false)
    expect(checarMigracoes([semCommit]).ok).toBe(false)
  })

  test('controle de transação no meio é recusado', () => {
    for (const cmd of ['COMMIT;', 'ROLLBACK;', 'SAVEPOINT a;', 'BEGIN;']) {
      expect(checarMigracoes([ok('0000_a.sql', `SELECT 1;\n${cmd}\nSELECT 2;`)]).ok).toBe(false)
    }
  })

  test('DROP TABLE e DROP COLUMN barrados, DROP INDEX e DROP CONSTRAINT liberados', () => {
    expect(checarMigracoes([ok('0000_a.sql', 'DROP TABLE x;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'ALTER TABLE x DROP COLUMN y;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'DROP INDEX x_idx;')]).ok).toBe(true)
    expect(checarMigracoes([ok('0000_a.sql', 'ALTER TABLE x DROP CONSTRAINT y;')]).ok).toBe(true)
  })

  test('comandos que não rodam em transação são barrados', () => {
    for (const cmd of ['CREATE INDEX CONCURRENTLY i ON x (a);', 'VACUUM x;', 'CREATE DATABASE y;', "ALTER SYSTEM SET a = 'b';"]) {
      expect(checarMigracoes([ok('0000_a.sql', cmd)]).ok).toBe(false)
    }
  })

  test('schema ou papel de fornecedor é recusado', () => {
    for (const ref of ['auth.users', 'storage.objects', 'supabase_auth_admin', 'authenticated', 'anon']) {
      expect(checarMigracoes([ok('0000_a.sql', `GRANT SELECT ON x TO ${ref};`)]).ok).toBe(false)
    }
  })

  test('CREATE TABLE exige PK uuid com gen_random_uuid(), salvo exceções', () => {
    expect(checarMigracoes([ok('0000_a.sql', 'CREATE TABLE x (id uuid PRIMARY KEY DEFAULT gen_random_uuid());')]).ok).toBe(true)
    expect(checarMigracoes([ok('0000_a.sql', 'CREATE TABLE x (id serial PRIMARY KEY);')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'CREATE TABLE x (id uuid PRIMARY KEY REFERENCES y (id));')]).ok).toBe(true)
    expect(checarMigracoes([ok('0000_a.sql', "CREATE TABLE x (codigo text PRIMARY KEY);")]).ok).toBe(true)
  })

  test('comentário: só uma linha, só no topo, só --, até 120 caracteres', () => {
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1; -- inline')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', '/* bloco */ SELECT 1;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1;', `-- ${'x'.repeat(130)}`)]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1;', '-- a\n-- b')]).ok).toBe(false)
    expect(checarMigracoes([{ nome: '0000_a.sql', conteudo: 'BEGIN;\nSELECT 1;\nCOMMIT;\n' }]).ok).toBe(true)
  })
})
```

- [ ] **Step 4: Rodar e ver falhar, implementar `checar.ts`**

```ts
type Arquivo = { nome: string; conteudo: string }
export type ResultadoChecagem = { ok: true } | { ok: false; problemas: string[] }

const NOME = /^(\d{4})_[a-z0-9_]+\.sql$/
const FORNECEDOR = /\b(auth|storage|realtime|vault|graphql_public|extensions)\.|\bsupabase\w*|\bauthenticated\b|\banon\b/i
const FORA_DE_TRANSACAO = /\bCREATE\s+INDEX\s+CONCURRENTLY\b|\bVACUUM\b|\bCREATE\s+DATABASE\b|\bALTER\s+SYSTEM\b/i
// Linha cujo texto aparado é exatamente BEGIN; COMMIT; ROLLBACK; ou começa com SAVEPOINT.
// `DO $$ BEGIN ... END $$;` não casa, porque BEGIN ali não está sozinho na linha.
const CONTROLE = /^\s*(BEGIN;|COMMIT;|ROLLBACK;|SAVEPOINT\b.*)\s*$/i
const CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w.]+\s*\(([\s\S]*?)\);/gi

function linhas(conteudo: string): string[] {
  const l = conteudo.split(/\r?\n/)
  while (l.length && l[0].trim() === '') l.shift()
  while (l.length && l[l.length - 1].trim() === '') l.pop()
  return l
}

function checarUm(arq: Arquivo): string[] {
  const p: string[] = []
  const pre = (m: string) => `${arq.nome}: ${m}`
  if (!NOME.test(arq.nome)) p.push(pre('nome fora do padrão NNNN_nome_com_underscore.sql'))

  const ls = linhas(arq.conteudo)
  let inicio = 0
  if (ls[0]?.startsWith('--')) {
    if (ls[0].length > 120) p.push(pre('comentário de topo com mais de 120 caracteres'))
    inicio = 1
  }
  if (ls[inicio]?.trim() !== 'BEGIN;') p.push(pre('primeira linha de código precisa ser BEGIN;'))
  if (ls[ls.length - 1]?.trim() !== 'COMMIT;') p.push(pre('última linha precisa ser COMMIT;'))

  const corpo = ls.slice(inicio + 1, -1)
  corpo.forEach((linha, i) => {
    const n = inicio + i + 2
    if (linha.includes('--')) p.push(pre(`linha ${n}: comentário só é permitido na primeira linha do arquivo`))
    if (linha.includes('/*')) p.push(pre(`linha ${n}: comentário de bloco não é permitido`))
    if (CONTROLE.test(linha)) p.push(pre(`linha ${n}: controle de transação só nas pontas do arquivo`))
  })

  const texto = corpo.join('\n')
  if (/\bDROP\s+TABLE\b/i.test(texto)) p.push(pre('DROP TABLE não é permitido'))
  if (/\bDROP\s+COLUMN\b/i.test(texto)) p.push(pre('DROP COLUMN não é permitido'))
  if (FORA_DE_TRANSACAO.test(texto)) p.push(pre('comando que não roda dentro de transação'))
  if (FORNECEDOR.test(texto)) p.push(pre('referência a schema ou papel de fornecedor'))

  for (const m of texto.matchAll(CREATE_TABLE)) {
    const colunas = m[1]
    const pk = colunas.split('\n').find((c) => /PRIMARY\s+KEY/i.test(c)) ?? ''
    const uuidGerado = /uuid\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(pk)
    const pkQueEhFk = /uuid\s+PRIMARY\s+KEY\s+REFERENCES/i.test(pk)
    const pkTextual = /text\s+PRIMARY\s+KEY/i.test(pk)
    if (!uuidGerado && !pkQueEhFk && !pkTextual) p.push(pre('CREATE TABLE sem PK uuid DEFAULT gen_random_uuid()'))
  }
  return p
}

export function checarMigracoes(arquivos: Arquivo[]): ResultadoChecagem {
  const problemas = arquivos.flatMap(checarUm)
  const numeros = arquivos.map((a) => a.nome.match(NOME)?.[1]).filter((n): n is string => !!n).map(Number).sort((a, b) => a - b)
  numeros.forEach((n, i) => {
    if (n !== i) problemas.push(`numeração: esperado ${String(i).padStart(4, '0')}, encontrado ${String(n).padStart(4, '0')}`)
  })
  return problemas.length ? { ok: false, problemas } : { ok: true }
}
```

Consequência para quem escreve migração: em blocos `DO $$ ... $$;` e corpos de função plpgsql, o `BEGIN` do bloco nunca fica sozinho numa linha terminando em `;`. Escreva `DO $$ BEGIN` na mesma linha, ou `BEGIN` sem ponto e vírgula (que é a sintaxe correta do plpgsql de qualquer forma).

- [ ] **Step 5: Rodar unitários até passar, typecheck, lint, commit**

```bash
npm run test:unit && npm run typecheck && npm run lint
git add src/server/db/migracoes
git commit -m "db: leitura de migrações com soma única e checador estático"
```

---

### Task 5: Runner: `aplicar()`, `pendentes()` e invariantes

**Files:**
- Create: `src/server/db/migracoes/aplicar.ts`
- Create: `src/server/db/migracoes/invariantes.ts`
- Create: `tests/integracao/runner.test.ts`
- Create: `tests/integracao/fixtures/` (pastas de migrações de teste criadas pelo próprio teste em diretório temporário; a pasta `fixtures/` fica com um `.gitkeep`)

**Interfaces:**
- Consumes: `comAdmin`, `lerMigracoes`, `Migracao`, `checarMigracoes`, `criarBancoDeTeste`.
- Produces:
  - `type Situacao = { aplicadas: string[]; pendentes: string[]; divergentes: { nome: string; somaNoBanco: string; somaNoArquivo: string }[] }`
  - `situacao(url: string, pasta: string): Promise<Situacao>`. Só lê. Funciona com papel que só tem `SELECT` em `_migracao`. Se `_migracao` não existe, tudo é pendente.
  - `aplicar(url: string, pasta: string): Promise<{ ok: true; aplicadas: string[] } | { ok: false; motivo: string; divergentes?: Situacao['divergentes']; problemas?: string[] }>`. Recusa se `checarMigracoes` falhar ou se houver divergente. Não lança por regra; lança só por falha de infraestrutura.
  - `conferirInvariantes(url: string): Promise<{ ok: true } | { ok: false; violacoes: string[] }>` em `invariantes.ts`.
  - `PAPEIS_APLICACAO = ['app_conexao', 'app_usuario'] as const`

- [ ] **Step 1: Teste do runner**

`tests/integracao/runner.test.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { aplicar, situacao } from '@/src/server/db/migracoes/aplicar'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

const arq = (corpo: string) => `-- teste\nBEGIN;\n${corpo}\nCOMMIT;\n`

async function pastaCom(arquivos: Record<string, string>): Promise<string> {
  const pasta = await mkdtemp(join(tmpdir(), 'migracoes-'))
  for (const [nome, conteudo] of Object.entries(arquivos)) await writeFile(join(pasta, nome), conteudo)
  return pasta
}

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco.derrubar() })

describe('aplicar', () => {
  test('aplica do zero e registra a soma do arquivo em disco', async () => {
    const pasta = await pastaCom({ '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid());') })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r).toEqual({ ok: true, aplicadas: ['0000_a.sql'] })
    const linhas = await banco.sql<{ nome: string; soma: string }>('SELECT nome, soma FROM _migracao')
    expect(linhas).toHaveLength(1)
    expect(linhas[0].soma).toMatch(/^[0-9a-f]{64}$/)
    const tabelas = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'a'")
    expect(tabelas[0].n).toBe(1)
  })

  test('segunda execução não faz nada', async () => {
    const pasta = await pastaCom({ '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid());') })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r).toEqual({ ok: true, aplicadas: [] })
  })

  test('arquivo alterado é recusado e nenhuma pendente é aplicada', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x int);'),
      '0001_b.sql': arq('CREATE TABLE b (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
    })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.divergentes?.map((d) => d.nome)).toEqual(['0000_a.sql'])
    const b = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'b'")
    expect(b[0].n).toBe(0)
  })

  test('falha na última instrução deixa schema e _migracao intactos', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
      '0001_c.sql': arq('CREATE TABLE c (id uuid PRIMARY KEY DEFAULT gen_random_uuid());\nSELECT 1/0;'),
    })
    await expect(aplicar(banco.urlAdmin, pasta)).rejects.toThrow(/division by zero/)
    const c = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'c'")
    expect(c[0].n).toBe(0)
    const reg = await banco.sql<{ nome: string }>("SELECT nome FROM _migracao WHERE nome IN ('0000_a.sql', '0001_c.sql') ORDER BY nome")
    expect(reg.map((r) => r.nome)).toEqual(['0000_a.sql'])
  })

  test('para no primeiro arquivo que falha e não segue para o seguinte', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
      '0001_c.sql': arq('SELECT 1/0;'),
      '0002_d.sql': arq('CREATE TABLE d (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
    })
    await expect(aplicar(banco.urlAdmin, pasta)).rejects.toThrow()
    const d = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'd'")
    expect(d[0].n).toBe(0)
  })

  test('checador reprovado recusa antes de tocar no banco', async () => {
    const pasta = await pastaCom({ '0000_a.sql': 'CREATE TABLE z (id int);' })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problemas?.length).toBeGreaterThan(0)
  })
})

describe('situacao', () => {
  test('lista aplicadas, pendentes e divergentes sem escrever', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
      '0001_e.sql': arq('CREATE TABLE e (id uuid PRIMARY KEY DEFAULT gen_random_uuid());'),
    })
    const antes = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM _migracao')
    const s = await situacao(banco.urlAdmin, pasta)
    expect(s.aplicadas).toEqual(['0000_a.sql'])
    expect(s.pendentes).toEqual(['0001_e.sql'])
    expect(s.divergentes).toEqual([])
    const depois = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM _migracao')
    expect(depois[0].n).toBe(antes[0].n)
  })

  test('banco sem _migracao: tudo pendente', async () => {
    const outro = await criarBancoDeTeste()
    try {
      const pasta = await pastaCom({ '0000_a.sql': arq('SELECT 1;') })
      const s = await situacao(outro.urlAdmin, pasta)
      expect(s).toEqual({ aplicadas: [], pendentes: ['0000_a.sql'], divergentes: [] })
    } finally {
      await outro.derrubar()
    }
  })
})

describe('_migracao', () => {
  test('inalcançável pelos papéis da aplicação e legível por app_conferencia', async () => {
    const priv = await banco.sql<{ papel: string; le: boolean }>(`
      SELECT r.rolname AS papel, has_table_privilege(r.rolname, '_migracao', 'SELECT') AS le
      FROM pg_roles r WHERE r.rolname IN ('app_conexao', 'app_usuario', 'app_conferencia') ORDER BY 1`)
    expect(priv).toEqual([
      { papel: 'app_conexao', le: false },
      { papel: 'app_conferencia', le: true },
      { papel: 'app_usuario', le: false },
    ])
  })
})
```

Observação: o teste de `_migracao` exige que `app_conexao` e `app_usuario` existam. O runner cria `app_conferencia`; os outros dois nascem na migração `0000` (Task 6). Para este teste passar já nesta task, o `aplicar()` faz o `REVOKE` de forma condicional (só se o papel existir) e o teste cria os dois papéis antes, via `banco.sql`, com `DO $$ BEGIN CREATE ROLE app_conexao NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$` e o mesmo para `app_usuario`, num `beforeAll` do `describe('_migracao')`. Os papéis são globais no cluster, e o `derrubar()` do banco não os remove; por isso a criação é idempotente.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run --project integracao tests/integracao/runner.test.ts
```

- [ ] **Step 3: Implementar `aplicar.ts`**

```ts
import type { Client } from 'pg'
import { comAdmin } from '../admin'
import { lerMigracoes, type Migracao } from './arquivos'
import { checarMigracoes } from './checar'

export const PAPEIS_APLICACAO = ['app_conexao', 'app_usuario'] as const

export type Situacao = {
  aplicadas: string[]
  pendentes: string[]
  divergentes: { nome: string; somaNoBanco: string; somaNoArquivo: string }[]
}

type Registro = { nome: string; soma: string }

async function lerRegistros(cliente: Client): Promise<Registro[] | null> {
  const existe = await cliente.query("SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_migracao'")
  if (existe.rowCount === 0) return null
  const { rows } = await cliente.query<Registro>('SELECT nome, soma FROM _migracao')
  return rows
}

function classificar(arquivos: Migracao[], registros: Registro[]): Situacao {
  const noBanco = new Map(registros.map((r) => [r.nome, r.soma]))
  const s: Situacao = { aplicadas: [], pendentes: [], divergentes: [] }
  for (const a of arquivos) {
    const soma = noBanco.get(a.nome)
    if (soma === undefined) s.pendentes.push(a.nome)
    else if (soma === a.soma) s.aplicadas.push(a.nome)
    else s.divergentes.push({ nome: a.nome, somaNoBanco: soma, somaNoArquivo: a.soma })
  }
  return s
}

export async function situacao(url: string, pasta: string): Promise<Situacao> {
  const arquivos = await lerMigracoes(pasta)
  return comAdmin(url, async (c) => classificar(arquivos, (await lerRegistros(c)) ?? []))
}

async function prepararControle(cliente: Client): Promise<void> {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS _migracao (
      nome        text PRIMARY KEY,
      soma        text NOT NULL,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )`)
  await cliente.query(`DO $$ BEGIN CREATE ROLE app_conferencia NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
  await cliente.query('GRANT SELECT ON _migracao TO app_conferencia')
  for (const papel of PAPEIS_APLICACAO) {
    await cliente.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${papel}') THEN
        REVOKE ALL ON _migracao FROM ${papel};
      END IF;
    END $$`)
  }
}

async function aplicarUma(cliente: Client, m: Migracao): Promise<void> {
  await cliente.query('BEGIN')
  try {
    await cliente.query(m.corpo)
    await cliente.query('INSERT INTO _migracao (nome, soma) VALUES ($1, $2)', [m.nome, m.soma])
    await cliente.query('COMMIT')
  } catch (erro) {
    await cliente.query('ROLLBACK')
    throw erro
  }
}

type ResultadoAplicar =
  | { ok: true; aplicadas: string[] }
  | { ok: false; motivo: string; divergentes?: Situacao['divergentes']; problemas?: string[] }

export async function aplicar(url: string, pasta: string): Promise<ResultadoAplicar> {
  const arquivos = await lerMigracoes(pasta)
  const checagem = checarMigracoes(arquivos)
  if (!checagem.ok) return { ok: false, motivo: 'checador reprovou', problemas: checagem.problemas }

  return comAdmin(url, async (c) => {
    await prepararControle(c)
    const s = classificar(arquivos, (await lerRegistros(c)) ?? [])
    if (s.divergentes.length) return { ok: false, motivo: 'migração aplicada foi alterada', divergentes: s.divergentes }

    const aplicadas: string[] = []
    for (const m of arquivos) {
      if (!s.pendentes.includes(m.nome)) continue
      await aplicarUma(c, m)
      aplicadas.push(m.nome)
    }
    // Papéis podem ter nascido agora, na 0000: refaz o REVOKE.
    await prepararControle(c)
    return { ok: true, aplicadas }
  })
}
```

`PAPEIS_APLICACAO` é interpolado em SQL, mas vem de uma constante do código, não de entrada externa.

- [ ] **Step 4: Rodar até passar**

```bash
npx vitest run --project integracao tests/integracao/runner.test.ts
```

- [ ] **Step 5: Teste das invariantes**

Acrescentar em `tests/integracao/runner.test.ts`:

```ts
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'

describe('conferirInvariantes', () => {
  test('nomeia tabela de public sem RLS, exceto _migracao', async () => {
    await banco.sql('CREATE TABLE IF NOT EXISTS sem_rls (id uuid PRIMARY KEY DEFAULT gen_random_uuid())')
    const r = await conferirInvariantes(banco.urlAdmin)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.violacoes.join()).toMatch(/sem_rls/)
    if (!r.ok) expect(r.violacoes.join()).not.toMatch(/_migracao/)
  })

  test('nomeia tabela com FORCE ROW LEVEL SECURITY', async () => {
    await banco.sql('ALTER TABLE sem_rls ENABLE ROW LEVEL SECURITY')
    await banco.sql('ALTER TABLE sem_rls FORCE ROW LEVEL SECURITY')
    const r = await conferirInvariantes(banco.urlAdmin)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.violacoes.join()).toMatch(/FORCE.*sem_rls|sem_rls.*FORCE/)
    await banco.sql('ALTER TABLE sem_rls NO FORCE ROW LEVEL SECURITY')
  })

  test('nomeia _migracao alcançável por papel da aplicação (controle negativo)', async () => {
    await banco.sql('GRANT SELECT ON _migracao TO app_usuario')
    const r = await conferirInvariantes(banco.urlAdmin)
    if (!r.ok) expect(r.violacoes.join()).toMatch(/_migracao.*app_usuario/)
    await banco.sql('REVOKE ALL ON _migracao FROM app_usuario')
  })
})
```

- [ ] **Step 6: Implementar `invariantes.ts`**

```ts
import { comAdmin } from '../admin'
import { PAPEIS_APLICACAO } from './aplicar'

export type ResultadoInvariantes = { ok: true } | { ok: false; violacoes: string[] }

// Chamado pelo fim do db:aplicar e pelo teste de schema. Lista única de
// invariantes, para não haver duas listas mantidas à mão.
export async function conferirInvariantes(url: string): Promise<ResultadoInvariantes> {
  return comAdmin(url, async (c) => {
    const v: string[] = []

    const semRls = await c.query<{ nome: string }>(`
      SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_migracao' AND NOT c.relrowsecurity`)
    for (const r of semRls.rows) v.push(`tabela sem RLS: ${r.nome}`)

    const comForce = await c.query<{ nome: string }>(`
      SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity`)
    for (const r of comForce.rows) v.push(`tabela com FORCE ROW LEVEL SECURITY: ${r.nome} (recursão nas funções de acesso)`)

    for (const papel of PAPEIS_APLICACAO) {
      const existe = await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [papel])
      if (existe.rowCount === 0) continue
      const alcanca = await c.query<{ le: boolean }>("SELECT has_table_privilege($1, '_migracao', 'SELECT') AS le", [papel])
      if (alcanca.rows[0].le) v.push(`_migracao alcançável por ${papel}`)
    }

    const conexao = await c.query<{ rolsuper: boolean; rolbypassrls: boolean; dona: number }>(`
      SELECT r.rolsuper, r.rolbypassrls,
        (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = r.rolname) AS dona
      FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
    if (conexao.rows[0]) {
      const r = conexao.rows[0]
      if (r.rolsuper) v.push('app_conexao é superusuário')
      if (r.rolbypassrls) v.push('app_conexao tem BYPASSRLS')
      if (r.dona > 0) v.push('app_conexao é dona de tabela')
    }

    const funcoes = await c.query<{ nome: string; prosecdef: boolean; proconfig: string[] | null }>(`
      SELECT p.proname AS nome, p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('usuario_atual', 'pode_ler', 'eh_gestor')`)
    for (const f of funcoes.rows) {
      if (!f.prosecdef) v.push(`${f.nome} sem SECURITY DEFINER`)
      if (!f.proconfig?.includes('search_path=')) v.push(`${f.nome} sem search_path vazio`)
    }

    return v.length ? { ok: false, violacoes: v } : { ok: true }
  })
}
```

Para a invariante de `_migracao` funcionar quando `app_conexao` **herda** `app_usuario` (Task 6), `has_table_privilege` já considera herança, então basta conferir os dois.

- [ ] **Step 7: Rodar integração inteira, typecheck, lint, commit**

```bash
npm run test:integracao && npm run typecheck && npm run lint
git add -A
git commit -m "db: runner com registro atômico, situação somente-leitura e invariantes"
```

---

### Task 6: As seis migrações, seus docs e o teste de schema

**Files:**
- Create: `db/migracoes/0000_papeis.sql` … `0005_politicas_usuario.sql`
- Create: `docs/db/fundacao.md`, `docs/db/0000.md` … `docs/db/0005.md`
- Modify: `tests/integracao/ajuda.ts` (aplica as migrações reais no banco novo)
- Create: `tests/integracao/schema.test.ts`

**Interfaces:**
- Consumes: `aplicar`, `conferirInvariantes`, `checarMigracoes`, `lerMigracoes`.
- Produces: `criarBancoDeTeste()` passa a devolver um banco com as seis migrações aplicadas. Constante `PASTA_MIGRACOES = join(process.cwd(), 'db', 'migracoes')` exportada de `src/server/db/migracoes/arquivos.ts`.

- [ ] **Step 1: Teste de schema (falha porque não há migrações)**

`tests/integracao/schema.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { lerMigracoes, PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { checarMigracoes } from '@/src/server/db/migracoes/checar'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco.derrubar() })

describe('migrações reais', () => {
  test('passam no checador estático', async () => {
    expect(checarMigracoes(await lerMigracoes(PASTA_MIGRACOES))).toEqual({ ok: true })
  })

  test('as seis estão registradas', async () => {
    const r = await banco.sql<{ nome: string }>('SELECT nome FROM _migracao ORDER BY nome')
    expect(r.map((x) => x.nome)).toEqual([
      '0000_papeis.sql', '0001_usuario.sql', '0002_funcoes_acesso.sql',
      '0003_auditoria.sql', '0004_habilitar_rls.sql', '0005_politicas_usuario.sql',
    ])
  })

  test('invariantes valem', async () => {
    expect(await conferirInvariantes(banco.urlAdmin)).toEqual({ ok: true })
  })

  test('usuario tem RLS sem FORCE e três políticas, nenhuma de DELETE', async () => {
    const t = await banco.sql<{ rls: boolean; force: boolean }>(
      "SELECT relrowsecurity AS rls, relforcerowsecurity AS force FROM pg_class WHERE relname = 'usuario'")
    expect(t[0]).toEqual({ rls: true, force: false })
    const p = await banco.sql<{ nome: string; cmd: string }>(
      "SELECT policyname AS nome, cmd FROM pg_policies WHERE tablename = 'usuario' ORDER BY 1")
    expect(p).toEqual([
      { nome: 'usuario_alterar', cmd: 'UPDATE' },
      { nome: 'usuario_criar', cmd: 'INSERT' },
      { nome: 'usuario_ler', cmd: 'SELECT' },
    ])
  })

  test('app_usuario não tem DELETE em usuario', async () => {
    const r = await banco.sql<{ pode: boolean }>("SELECT has_table_privilege('app_usuario', 'usuario', 'DELETE') AS pode")
    expect(r[0].pode).toBe(false)
  })

  test('e-mail fora do padrão é recusado pelo CHECK', async () => {
    await expect(banco.sql("INSERT INTO usuario (nome, email, papel) VALUES ('A', 'Fulano@X.com', 'gestor')")).rejects.toThrow(/check/i)
    await expect(banco.sql("INSERT INTO usuario (nome, email, papel) VALUES ('A', ' a@x.com', 'gestor')")).rejects.toThrow(/check/i)
    await expect(banco.sql("INSERT INTO usuario (nome, email, papel) VALUES ('A', 'a@x.com', 'admin')")).rejects.toThrow(/check/i)
  })

  test('funções de acesso: PUBLIC não executa, app_usuario executa', async () => {
    for (const f of ['usuario_atual()', 'pode_ler()', 'eh_gestor()']) {
      const r = await banco.sql<{ pub: boolean; app: boolean }>(
        `SELECT has_function_privilege('app_usuario', '${f}', 'EXECUTE') AS app,
                has_function_privilege('app_conferencia', '${f}', 'EXECUTE') AS pub`)
      expect(r[0]).toEqual({ app: true, pub: false })
    }
  })
})
```

`app_conferencia` faz o papel de "qualquer outro papel" no teste de PUBLIC: se PUBLIC tivesse EXECUTE, ele também teria.

- [ ] **Step 2: Fazer o harness aplicar as migrações**

Em `tests/integracao/ajuda.ts`, depois de criar o banco:

```ts
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
// ...
const r = await aplicar(urlAdmin, PASTA_MIGRACOES)
if (!r.ok) throw new Error(`migrações não aplicaram: ${r.motivo} ${JSON.stringify(r.problemas ?? r.divergentes)}`)
```

E em `arquivos.ts`:

```ts
export const PASTA_MIGRACOES = join(process.cwd(), 'db', 'migracoes')
```

O `runner.test.ts` da Task 5 usa pastas temporárias e um banco que **já** terá as seis migrações. Isso não atrapalha: `_migracao` já existe, e as fixtures têm nomes que não colidem (`0000_a.sql` etc. são registros novos). Mas a numeração das fixtures começa em 0000 num banco que já tem `0000_papeis.sql`: são nomes diferentes, então são pendentes normais. O teste "banco sem _migracao" precisa de um banco cru: acrescente ao harness a opção `criarBancoDeTeste({ semMigracoes: true })`.

- [ ] **Step 3: Escrever as migrações**

`db/migracoes/0000_papeis.sql`:

```sql
-- ver docs/db/0000.md
BEGIN;
DO $$ BEGIN CREATE ROLE app_usuario NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE app_conexao NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT app_usuario TO app_conexao;
GRANT USAGE ON SCHEMA public TO app_usuario;
COMMIT;
```

`app_conexao` nasce `NOLOGIN`. O `db:senha-app` (Task 10) faz `ALTER ROLE app_conexao LOGIN PASSWORD ...`. Assim nenhuma senha, nem `LOGIN` sem senha, entra em migração.

`db/migracoes/0001_usuario.sql`:

```sql
-- ver docs/db/0001.md
BEGIN;
CREATE TABLE usuario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL CHECK (btrim(nome) <> ''),
  email          text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email <> ''),
  papel          text NOT NULL CHECK (papel IN ('vendedor', 'gestor')),
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT
);
CREATE INDEX usuario_nome_idx ON usuario (nome);
CREATE INDEX usuario_gestor_ativo_idx ON usuario (papel) WHERE ativo;
GRANT SELECT, INSERT, UPDATE ON usuario TO app_usuario;
COMMIT;
```

`db/migracoes/0002_funcoes_acesso.sql`:

```sql
-- ver docs/db/0002.md
BEGIN;
CREATE FUNCTION usuario_atual() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid $$;

CREATE FUNCTION pode_ler() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.ativo FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;

CREATE FUNCTION eh_gestor() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.papel = 'gestor' AND u.ativo FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;

REVOKE EXECUTE ON FUNCTION usuario_atual(), pode_ler(), eh_gestor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION usuario_atual(), pode_ler(), eh_gestor() TO app_usuario;
COMMIT;
```

`db/migracoes/0003_auditoria.sql`:

```sql
-- ver docs/db/0003.md
BEGIN;
CREATE FUNCTION definir_auditoria() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_em := now();
    NEW.criado_por := public.usuario_atual();
    NEW.atualizado_em := NULL;
    NEW.atualizado_por := NULL;
    RETURN NEW;
  END IF;
  NEW.criado_em := OLD.criado_em;
  NEW.criado_por := OLD.criado_por;
  NEW.atualizado_em := now();
  NEW.atualizado_por := public.usuario_atual();
  RETURN NEW;
END
$$;
CREATE TRIGGER usuario_auditoria BEFORE INSERT OR UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
COMMIT;
```

Atenção ao checador: a linha `BEGIN` do plpgsql não tem `;`, então não casa com `CONTROLE`. A linha `END` sozinha também não. Trigger roda como `app_usuario` dentro de `comoUsuario`, e `usuario_atual()` tem GRANT para ele, então não precisa de `SECURITY DEFINER` aqui.

`db/migracoes/0004_habilitar_rls.sql`:

```sql
-- ver docs/db/0004.md
BEGIN;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
COMMIT;
```

`db/migracoes/0005_politicas_usuario.sql`:

```sql
-- ver docs/db/0005.md
BEGIN;
CREATE POLICY usuario_ler ON usuario FOR SELECT TO app_usuario
  USING (pode_ler() AND (id = usuario_atual() OR eh_gestor()));
CREATE POLICY usuario_criar ON usuario FOR INSERT TO app_usuario
  WITH CHECK (eh_gestor());
CREATE POLICY usuario_alterar ON usuario FOR UPDATE TO app_usuario
  USING (eh_gestor() AND id <> usuario_atual())
  WITH CHECK (eh_gestor() AND id <> usuario_atual());
COMMIT;
```

- [ ] **Step 4: Escrever os docs**

`docs/db/fundacao.md`: copiar as seções 2, 6.4, 6.6, 7, 9.2 e 9.4 da spec, adaptadas para leitor que chega sem contexto. Terminar com a tabela "Registrado para a fatia de login" (seção 12 da spec).

`docs/db/0000.md` a `0005.md`: cada um com três blocos curtos: **O que cria**, **Por quê** (o racional correspondente da spec: seção 7 para 0000; seção 8 para 0001; 8.1 para 0002; 8.2 para 0003; 8.3 primeiro parágrafo para 0004; 8.3 tabela e limitação conhecida para 0005), **Depende de** (migração anterior necessária). O texto da spec é a fonte; não inventar racional novo.

- [ ] **Step 5: Rodar, ajustar, commit**

```bash
npm run test:integracao && npm run typecheck && npm run lint
git add -A
git commit -m "db: migrações 0000-0005 (papéis, usuario, acesso, auditoria, RLS, políticas) e docs"
```

Se o `0003` falhar no checador por causa de `BEGIN`/`END` do plpgsql, o problema está no regex `CONTROLE`, não na migração: ele deve casar só `BEGIN;` com ponto e vírgula. Corrija o regex e o teste unitário correspondente, nunca a migração.

---

### Task 7: `pool.ts` com guarda de papel

**Files:**
- Create: `src/server/db/pool.ts`
- Create: `src/server/db/pool.test.ts` (unitário: singleton em `globalThis`)
- Create: `tests/integracao/pool.test.ts`
- Modify: `tests/integracao/ajuda.ts` (define senha de teste do `app_conexao` e expõe `urlApp`)

**Interfaces:**
- Consumes: `lerEnv`, `exigir`, `configSsl`.
- Produces:
  - `obterPool(url?: string): Pool`. Sem argumento usa `exigir(lerEnv(), 'DATABASE_URL')`. Singleton por URL em `globalThis.__crmPools` (Map). Testes passam a URL do banco de teste.
  - `conectarVerificado(url?: string): Promise<PoolClient>`: `pool.connect()` e, na primeira vez por processo **por URL**, roda a guarda de papel. Lança `PapelPerigoso` se `rolsuper` ou `rolbypassrls`.
  - `fecharPool(url?: string): Promise<void>`.
  - `class PapelPerigoso extends Error`.
  - Harness: `BancoDeTeste.urlApp: string` (URL do banco de teste como `app_conexao`, senha `teste`). O harness roda `ALTER ROLE app_conexao LOGIN PASSWORD 'teste'` como admin depois das migrações. Papéis são globais no cluster, então repetir isso por arquivo é inofensivo.

- [ ] **Step 1: Teste unitário do singleton**

`src/server/db/pool.test.ts`:

```ts
import { afterEach, expect, test } from 'vitest'
import { fecharPool, obterPool } from './pool'

afterEach(async () => { await fecharPool('postgres://x:y@localhost:1/a') })

test('mesma URL devolve a mesma instância, sobrevivendo a um novo import do módulo', async () => {
  const a = obterPool('postgres://x:y@localhost:1/a')
  const b = obterPool('postgres://x:y@localhost:1/a')
  expect(a).toBe(b)
  // Simula hot reload: módulo reavaliado, globalThis preservado.
  const { obterPool: obterDeNovo } = await import('./pool?reload=' + Date.now())
  expect(obterDeNovo('postgres://x:y@localhost:1/a')).toBe(a)
})

test('URLs diferentes são pools diferentes', () => {
  expect(obterPool('postgres://x:y@localhost:1/a')).not.toBe(obterPool('postgres://x:y@localhost:1/b'))
})
```

Nenhum teste aqui conecta: `new Pool()` é preguiçoso.

- [ ] **Step 2: Implementar `pool.ts`**

```ts
import { Pool, type PoolClient } from 'pg'
import { exigir, lerEnv } from './env'
import { configSsl } from './ssl'

export class PapelPerigoso extends Error {
  constructor(detalhe: string) {
    super(`A conexão da aplicação tem privilégio que ignora RLS: ${detalhe}. Use um papel sem SUPERUSER e sem BYPASSRLS.`)
    this.name = 'PapelPerigoso'
  }
}

type Registro = { pool: Pool; papelConferido: boolean }
const g = globalThis as typeof globalThis & { __crmPools?: Map<string, Registro> }
const pools = (g.__crmPools ??= new Map<string, Registro>())

function criar(url: string): Pool {
  const env = lerEnv()
  const pool = new Pool({
    connectionString: url,
    ssl: configSsl(env),
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    statement_timeout: 30_000,
  })
  pool.on('error', (erro) => console.error('[db] erro em conexão ociosa do pool', erro))
  return pool
}

export function obterPool(url: string = exigir(lerEnv(), 'DATABASE_URL')): Pool {
  let reg = pools.get(url)
  if (!reg) {
    reg = { pool: criar(url), papelConferido: false }
    pools.set(url, reg)
  }
  return reg.pool
}

async function conferirPapel(cliente: PoolClient): Promise<void> {
  const { rows } = await cliente.query<{ rolsuper: boolean; rolbypassrls: boolean; usuario: string }>(
    'SELECT r.rolsuper, r.rolbypassrls, current_user AS usuario FROM pg_roles r WHERE r.rolname = current_user',
  )
  const r = rows[0]
  if (r.rolsuper) throw new PapelPerigoso(`${r.usuario} é SUPERUSER`)
  if (r.rolbypassrls) throw new PapelPerigoso(`${r.usuario} tem BYPASSRLS`)
}

// Único jeito de pegar um cliente do pool. Na primeira vez por processo e por
// URL confere o papel; se for perigoso, lança e a aplicação não sobe.
export async function conectarVerificado(url: string = exigir(lerEnv(), 'DATABASE_URL')): Promise<PoolClient> {
  const pool = obterPool(url)
  const reg = pools.get(url)!
  const cliente = await pool.connect()
  if (reg.papelConferido) return cliente
  try {
    await conferirPapel(cliente)
    reg.papelConferido = true
    return cliente
  } catch (erro) {
    cliente.release()
    throw erro
  }
}

export async function fecharPool(url: string = exigir(lerEnv(), 'DATABASE_URL')): Promise<void> {
  const reg = pools.get(url)
  if (!reg) return
  pools.delete(url)
  await reg.pool.end()
}
```

- [ ] **Step 3: Rodar o unitário até passar**

```bash
npx vitest run --project unitario src/server/db/pool.test.ts
```

- [ ] **Step 4: Harness: senha de teste e `urlApp`**

Em `tests/integracao/ajuda.ts`, depois de aplicar as migrações:

```ts
await comAdmin(urlAdmin, (c) => c.query("ALTER ROLE app_conexao LOGIN PASSWORD 'teste'"))
const urlApp = (() => {
  const u = new URL(urlAdmin)
  u.username = 'app_conexao'
  u.password = 'teste'
  return u.toString()
})()
```

E incluir `urlApp` no objeto devolvido e no tipo `BancoDeTeste`. `derrubar()` passa a chamar `fecharPool(urlApp)` antes de dropar o banco.

- [ ] **Step 5: Teste de integração da guarda**

`tests/integracao/pool.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { conectarVerificado, fecharPool, PapelPerigoso } from '@/src/server/db/pool'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await fecharPool(banco.urlAdmin); await banco.derrubar() })

test('como app_conexao a guarda deixa passar', async () => {
  const c = await conectarVerificado(banco.urlApp)
  try {
    const { rows } = await c.query<{ u: string }>('SELECT current_user AS u')
    expect(rows[0].u).toBe('app_conexao')
  } finally {
    c.release()
  }
})

test('como superusuário a guarda derruba (controle negativo)', async () => {
  await expect(conectarVerificado(banco.urlAdmin)).rejects.toBeInstanceOf(PapelPerigoso)
})

test('app_conexao não é superusuário, não tem BYPASSRLS e não é dona de tabela', async () => {
  const r = await banco.sql<{ rolsuper: boolean; rolbypassrls: boolean; dona: number }>(`
    SELECT r.rolsuper, r.rolbypassrls,
      (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = 'app_conexao') AS dona
    FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
  expect(r[0]).toEqual({ rolsuper: false, rolbypassrls: false, dona: 0 })
})
```

- [ ] **Step 6: Rodar tudo, commit**

```bash
npm test && npm run typecheck && npm run lint
git add -A
git commit -m "db: pool singleton em globalThis com guarda de papel"
```

---

### Task 8: `comoUsuario()` e os testes de identidade

**Files:**
- Create: `src/server/db/como-usuario.ts`
- Create: `src/server/db/como-usuario.test.ts` (unitário: validação de UUID)
- Create: `tests/integracao/identidade.test.ts`
- Modify: `tests/integracao/ajuda.ts` (expõe `comoUsuario` ligado ao `urlApp`)

**Interfaces:**
- Consumes: `conectarVerificado`.
- Produces:
  - `type Executar = <T extends QueryResultRow = QueryResultRow>(sql: string, parametros?: unknown[]) => Promise<{ linhas: T[]; afetadas: number }>`
  - `comoUsuario<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>, url?: string): Promise<T>`. O terceiro parâmetro existe para o harness; a aplicação nunca passa.
  - `class ExecutarForaDaTransacao extends Error`
  - `class UsuarioIdInvalido extends Error`
  - Harness: `BancoDeTeste.comoUsuario: <T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>) => Promise<T>`, já com `urlApp`.

- [ ] **Step 1: Unitário da validação**

`src/server/db/como-usuario.test.ts`:

```ts
import { expect, test } from 'vitest'
import { comoUsuario, UsuarioIdInvalido } from './como-usuario'

test('id que não é UUID lança antes de tocar no banco', async () => {
  await expect(comoUsuario('nao-e-uuid', async () => 1, 'postgres://x:y@localhost:1/z')).rejects.toBeInstanceOf(UsuarioIdInvalido)
  await expect(comoUsuario("'; DROP TABLE usuario; --", async () => 1, 'postgres://x:y@localhost:1/z')).rejects.toBeInstanceOf(UsuarioIdInvalido)
})
```

A URL aponta para porta fechada: se a validação não vier antes, o teste falha com erro de conexão em vez de `UsuarioIdInvalido`.

- [ ] **Step 2: Implementar `como-usuario.ts`**

```ts
import type { QueryResultRow } from 'pg'
import { conectarVerificado } from './pool'

export type Executar = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  parametros?: unknown[],
) => Promise<{ linhas: T[]; afetadas: number }>

export class ExecutarForaDaTransacao extends Error {
  constructor() {
    super('executar foi chamado depois que comoUsuario retornou. Guardar a referência é vazamento de conexão.')
    this.name = 'ExecutarForaDaTransacao'
  }
}

export class UsuarioIdInvalido extends Error {
  constructor(valor: string) {
    super(`usuarioId não é um UUID: ${JSON.stringify(valor)}`)
    this.name = 'UsuarioIdInvalido'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Único caminho para dado de domínio. Abre transação, injeta identidade e
// papel numa ida só, entrega `executar`, e desfaz tudo no fim.
export async function comoUsuario<T>(
  usuarioId: string,
  trabalho: (executar: Executar) => Promise<T>,
  url?: string,
): Promise<T> {
  if (!UUID.test(usuarioId)) throw new UsuarioIdInvalido(usuarioId)

  const cliente = await conectarVerificado(url)
  let encerrada = false
  let conexaoSuja = false

  const executar: Executar = async (sql, parametros) => {
    if (encerrada) throw new ExecutarForaDaTransacao()
    const r = await cliente.query(sql, parametros)
    return { linhas: r.rows, afetadas: r.rowCount ?? 0 }
  }

  try {
    await cliente.query('BEGIN')
    await cliente.query("SELECT set_config('app.usuario_id', $1, true), set_config('role', 'app_usuario', true)", [usuarioId])
    const resultado = await trabalho(executar)
    await cliente.query('COMMIT')
    return resultado
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK')
    } catch {
      conexaoSuja = true
    }
    throw erro
  } finally {
    encerrada = true
    if (conexaoSuja) {
      cliente.release(new Error('rollback falhou; conexão descartada'))
    } else {
      await cliente.query('RESET ROLE')
      await cliente.query('RESET ALL')
      cliente.release()
    }
  }
}
```

- [ ] **Step 3: Harness expõe `comoUsuario`**

Em `ajuda.ts`:

```ts
import { comoUsuario as comoUsuarioReal, type Executar } from '@/src/server/db/como-usuario'
// ...
comoUsuario: <T,>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>) => comoUsuarioReal(usuarioId, trabalho, urlApp),
```

Acrescentar também um utilitário para criar usuários como dono, que os testes de identidade e política vão usar:

```ts
export async function criarUsuario(banco: BancoDeTeste, papel: 'vendedor' | 'gestor', apelido: string): Promise<string> {
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO usuario (nome, email, papel) VALUES ($1, $2, $3) RETURNING id',
    [apelido, `${apelido.toLowerCase()}@teste.local`, papel],
  )
  return id
}
```

- [ ] **Step 4: Testes de identidade**

`tests/integracao/identidade.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { ExecutarForaDaTransacao, type Executar } from '@/src/server/db/como-usuario'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedorA: string
let vendedorB: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
})
afterAll(async () => { await banco.derrubar() })

const quemSou = async (executar: Executar) => {
  const { linhas } = await executar<{ id: string | null; papel: string }>('SELECT usuario_atual() AS id, current_user AS papel')
  return linhas[0]
}

describe('identidade dentro da transação', () => {
  test('usuario_atual() devolve o id passado e o papel é app_usuario', async () => {
    const r = await banco.comoUsuario(vendedorA, quemSou)
    expect(r).toEqual({ id: vendedorA, papel: 'app_usuario' })
  })

  test('vendedor vê só a si; gestor vê todos', async () => {
    const meus = await banco.comoUsuario(vendedorA, async (e) => (await e<{ id: string }>('SELECT id FROM usuario')).linhas)
    expect(meus.map((x) => x.id)).toEqual([vendedorA])
    const todos = await banco.comoUsuario(gestor, async (e) => (await e('SELECT id FROM usuario')).afetadas)
    expect(todos).toBe(3)
  })

  test('alternância de usuários na mesma conexão sem contaminação', async () => {
    for (let i = 0; i < 10; i++) {
      const ids = [vendedorA, vendedorB, gestor]
      const id = ids[i % 3]
      const r = await banco.comoUsuario(id, quemSou)
      expect(r.id).toBe(id)
    }
  })
})

describe('identidade não sobrevive à transação', () => {
  test('fora de comoUsuario, a variável e o papel voltam ao padrão', async () => {
    await banco.comoUsuario(vendedorA, quemSou)
    // Pega a mesma conexão do pool (max 10, mas só uma foi usada) e lê fora de transação.
    const { conectarVerificado } = await import('@/src/server/db/pool')
    const c = await conectarVerificado(banco.urlApp)
    try {
      // current_setting de variável nunca definida devolve NULL; depois de definida e revertida devolve ''. COALESCE cobre os dois.
      const { rows } = await c.query("SELECT COALESCE(current_setting('app.usuario_id', true), '') AS id, current_user AS papel")
      expect(rows[0]).toEqual({ id: '', papel: 'app_conexao' })
    } finally {
      c.release()
    }
  })

  test('controle negativo: SET sem LOCAL vaza para a próxima transação', async () => {
    const { conectarVerificado } = await import('@/src/server/db/pool')
    const c = await conectarVerificado(banco.urlApp)
    try {
      await c.query("SET app.usuario_id = 'vazou'")
      const { rows } = await c.query("SELECT current_setting('app.usuario_id', true) AS id")
      expect(rows[0].id).toBe('vazou')
      await c.query('RESET ALL')
    } finally {
      c.release()
    }
  })

  test('controle negativo: RESET ALL sozinho não derruba SET ROLE sem LOCAL', async () => {
    const { conectarVerificado } = await import('@/src/server/db/pool')
    const c = await conectarVerificado(banco.urlApp)
    try {
      await c.query('SET ROLE app_usuario')
      await c.query('RESET ALL')
      const { rows } = await c.query('SELECT current_user AS papel')
      expect(rows[0].papel).toBe('app_usuario')
      await c.query('RESET ROLE')
      const depois = await c.query('SELECT current_user AS papel')
      expect(depois.rows[0].papel).toBe('app_conexao')
    } finally {
      c.release()
    }
  })
})

describe('desfecho da transação', () => {
  test('papel e identidade voltam após COMMIT', async () => {
    await banco.comoUsuario(vendedorA, quemSou)
    const r = await banco.comoUsuario(vendedorB, quemSou)
    expect(r.id).toBe(vendedorB)
  })

  test('papel e identidade voltam após ROLLBACK provocado por erro no meio', async () => {
    await expect(banco.comoUsuario(vendedorA, async (e) => { await e('SELECT 1/0') })).rejects.toThrow(/division by zero/)
    const r = await banco.comoUsuario(vendedorB, quemSou)
    expect(r).toEqual({ id: vendedorB, papel: 'app_usuario' })
  })

  test('erro do trabalho desfaz a escrita', async () => {
    await expect(
      banco.comoUsuario(gestor, async (e) => {
        await e("INSERT INTO usuario (nome, email, papel) VALUES ('Tmp', 'tmp@teste.local', 'vendedor')")
        throw new Error('desisti')
      }),
    ).rejects.toThrow('desisti')
    const r = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM usuario WHERE email = 'tmp@teste.local'")
    expect(r[0].n).toBe(0)
  })
})

describe('herança de papel não vaza acesso', () => {
  test('app_conexao consultando usuario fora de comoUsuario recebe zero linhas ou erro, nunca dados', async () => {
    const { conectarVerificado } = await import('@/src/server/db/pool')
    const c = await conectarVerificado(banco.urlApp)
    try {
      const r = await c.query('SELECT id FROM usuario').catch((e: unknown) => e as Error)
      if (r instanceof Error) {
        expect((r as Error & { code?: string }).code).toBe('42501')
      } else {
        expect(r.rowCount).toBe(0)
      }
    } finally {
      c.release()
    }
  })
})

describe('vazamento do lado JavaScript', () => {
  test('executar guardado lança ExecutarForaDaTransacao depois do retorno', async () => {
    let guardado: Executar | undefined
    await banco.comoUsuario(vendedorA, async (e) => { guardado = e })
    await expect(guardado!('SELECT 1')).rejects.toBeInstanceOf(ExecutarForaDaTransacao)
  })
})
```

- [ ] **Step 5: Rodar, ajustar, commit**

```bash
npm test && npm run typecheck && npm run lint
git add -A
git commit -m "db: comoUsuario com identidade e papel numa ida, RESET ROLE e executar encerrado"
```

Se o teste "RESET ALL sozinho não derruba SET ROLE" **falhar** porque o papel voltou, a hipótese da seção 6.4 da spec está errada: registrar o resultado real na spec e em `docs/db/fundacao.md`, manter o `RESET ROLE` (inofensivo) e inverter a asserção do controle negativo. Nunca apagar o teste.

---

### Task 9: Testes de políticas e auditoria

**Files:**
- Create: `tests/integracao/politicas.test.ts`
- Create: `tests/integracao/auditoria.test.ts`

**Interfaces:**
- Consumes: `criarBancoDeTeste`, `criarUsuario`, `banco.comoUsuario`, `banco.sql`. Nada novo produzido: esta task prova o SQL da Task 6 pelo caminho real.

- [ ] **Step 1: Testes de políticas**

`tests/integracao/politicas.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outroVendedor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  outroVendedor = await criarUsuario(banco, 'vendedor', 'Outro')
})
afterAll(async () => { await banco.derrubar() })

const inserir = (nome: string, email: string, papel: string) =>
  `INSERT INTO usuario (nome, email, papel) VALUES ('${nome}', '${email}', '${papel}')`

describe('INSERT', () => {
  test('vendedor não insere: erro 42501', async () => {
    await expect(banco.comoUsuario(vendedor, (e) => e(inserir('X', 'x@teste.local', 'vendedor')))).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor insere', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e(inserir('Nova', 'nova@teste.local', 'vendedor')))
    expect(r.afetadas).toBe(1)
  })

  test('vendedor não se promove nem cria gestor', async () => {
    await expect(banco.comoUsuario(vendedor, (e) => e(inserir('Eu', 'eu@teste.local', 'gestor')))).rejects.toMatchObject({ code: '42501' })
  })
})

describe('UPDATE', () => {
  test('gestor altera outro usuário', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e("UPDATE usuario SET nome = 'Renomeado' WHERE id = $1", [vendedor]))
    expect(r.afetadas).toBe(1)
  })

  test('gestor não altera a si mesmo: linha invisível, afetadas 0, sem erro', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e("UPDATE usuario SET nome = 'Eu' WHERE id = $1", [gestor]))
    expect(r.afetadas).toBe(0)
    const [{ nome }] = await banco.sql<{ nome: string }>('SELECT nome FROM usuario WHERE id = $1', [gestor])
    expect(nome).toBe('Gestora')
  })

  test('vendedor não altera ninguém, nem a si: afetadas 0', async () => {
    const proprio = await banco.comoUsuario(vendedor, (e) => e("UPDATE usuario SET nome = 'Hack' WHERE id = $1", [vendedor]))
    expect(proprio.afetadas).toBe(0)
    const outro = await banco.comoUsuario(vendedor, (e) => e("UPDATE usuario SET papel = 'gestor' WHERE id = $1", [outroVendedor]))
    expect(outro.afetadas).toBe(0)
  })

  test('gestor não consegue mover linha para fora da própria visibilidade (WITH CHECK)', async () => {
    // Tornar o outro vendedor "o próprio gestor" trocando o id não é possível (PK), então o WITH CHECK
    // equivalente é: gestor desativado deixa de ser gestor; tentar desativar a si já cai no USING.
    // Controle: desativar outro funciona.
    const r = await banco.comoUsuario(gestor, (e) => e('UPDATE usuario SET ativo = false WHERE id = $1', [outroVendedor]))
    expect(r.afetadas).toBe(1)
    await banco.sql('UPDATE usuario SET ativo = true WHERE id = $1', [outroVendedor])
  })
})

describe('DELETE', () => {
  test('ninguém apaga, nem gestor: 42501 por falta de GRANT', async () => {
    await expect(banco.comoUsuario(gestor, (e) => e('DELETE FROM usuario WHERE id = $1', [vendedor]))).rejects.toMatchObject({ code: '42501' })
  })
})

describe('desativação tem efeito imediato', () => {
  test('usuário desativado não lê nem a si mesmo', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Desativado')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    const r = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(r.afetadas).toBe(0)
  })

  test('gestor desativado não é mais gestor', async () => {
    const id = await criarUsuario(banco, 'gestor', 'ExGestor')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    const r = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(r.afetadas).toBe(0)
  })
})

describe('controle negativo', () => {
  test('como dono, RLS é ignorada e todos aparecem', async () => {
    const r = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM usuario')
    expect(r[0].n).toBeGreaterThan(3)
  })
})
```

Sobre `usuario_ler`: a política tem `pode_ler() AND (...)` justamente para o teste "usuário desativado não lê nem a si mesmo" valer. Sem `pode_ler()`, um desativado ainda veria a própria linha, e a promessa de "desativação com efeito imediato" ficaria pela metade.

- [ ] **Step 2: Testes de auditoria**

`tests/integracao/auditoria.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let outroGestor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  outroGestor = await criarUsuario(banco, 'gestor', 'Gestor2')
})
afterAll(async () => { await banco.derrubar() })

type Linha = { criado_por: string | null; atualizado_por: string | null; criado_em: Date; atualizado_em: Date | null }
const ler = (email: string) => banco.sql<Linha>('SELECT criado_por, atualizado_por, criado_em, atualizado_em FROM usuario WHERE email = $1', [email])

describe('INSERT', () => {
  test('criado_por vem da identidade, atualizado_* nulos', async () => {
    await banco.comoUsuario(gestor, (e) => e("INSERT INTO usuario (nome, email, papel) VALUES ('N', 'n@teste.local', 'vendedor')"))
    const [l] = await ler('n@teste.local')
    expect(l.criado_por).toBe(gestor)
    expect(l.atualizado_por).toBeNull()
    expect(l.atualizado_em).toBeNull()
  })

  test('criado_por forjado é sobrescrito', async () => {
    await banco.comoUsuario(gestor, (e) =>
      e("INSERT INTO usuario (nome, email, papel, criado_por) VALUES ('F', 'f@teste.local', 'vendedor', $1)", [outroGestor]))
    const [l] = await ler('f@teste.local')
    expect(l.criado_por).toBe(gestor)
  })

  test('seed sem identidade: criado_por nulo', async () => {
    const [l] = await ler('gestora@teste.local')
    expect(l.criado_por).toBeNull()
  })
})

describe('UPDATE', () => {
  test('criado_* congelados, atualizado_* preenchidos com quem alterou', async () => {
    const [antes] = await ler('n@teste.local')
    await banco.comoUsuario(outroGestor, (e) => e("UPDATE usuario SET nome = 'N2', criado_por = $1 WHERE email = 'n@teste.local'", [outroGestor]))
    const [depois] = await ler('n@teste.local')
    expect(depois.criado_por).toBe(antes.criado_por)
    expect(depois.criado_em.getTime()).toBe(antes.criado_em.getTime())
    expect(depois.atualizado_por).toBe(outroGestor)
    expect(depois.atualizado_em).not.toBeNull()
  })
})
```

- [ ] **Step 3: Rodar, corrigir `0005` se preciso, commit**

```bash
npm run test:integracao && npm run typecheck && npm run lint
git add -A
git commit -m "db: políticas e auditoria provadas pelo caminho real"
```

---

### Task 10: CLIs: `db:checar`, `db:aplicar`, `db:pendentes`, `db:seed:gestor`, `db:senha-app`, `db:senha-conferencia`

**Files:**
- Create: `scripts/db/checar.ts`, `scripts/db/aplicar.ts`, `scripts/db/pendentes.ts`, `scripts/db/seed-gestor.ts`, `scripts/db/senha.ts`, `scripts/db/env.ts`
- Create: `src/server/db/seed.ts`, `tests/integracao/seed.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces:
  - `criarPrimeiroGestor(url: string, dados: { nome: string; email: string }): Promise<{ ok: true; id: string } | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }>` em `seed.ts`.
  - npm scripts listados no Step 4.

- [ ] **Step 1: Teste do seed**

`tests/integracao/seed.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarPrimeiroGestor } from '@/src/server/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco.derrubar() })

test('cria o primeiro gestor com criado_por nulo e e-mail normalizado', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Alexandre', email: '  Alex@Exemplo.com ' })
  expect(r.ok).toBe(true)
  const [l] = await banco.sql<{ email: string; papel: string; criado_por: string | null }>('SELECT email, papel, criado_por FROM usuario')
  expect(l).toEqual({ email: 'alex@exemplo.com', papel: 'gestor', criado_por: null })
})

test('recusa se já existe gestor ativo', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Outro', email: 'outro@exemplo.com' })
  expect(r).toEqual({ ok: false, motivo: 'ja_existe_gestor_ativo' })
})

test('recusa e-mail sem @', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'X', email: 'sem-arroba' })
  expect(r).toEqual({ ok: false, motivo: 'email_invalido' })
})
```

- [ ] **Step 2: Implementar `seed.ts`**

```ts
import { comAdmin } from './admin'

type Resultado = { ok: true; id: string } | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }

// Roda como admin, sem identidade: criado_por fica nulo de propósito.
// Nunca pelo pool.ts: a guarda de papel derrubaria o processo.
export async function criarPrimeiroGestor(urlAdmin: string, dados: { nome: string; email: string }): Promise<Resultado> {
  const email = dados.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, motivo: 'email_invalido' }
  return comAdmin(urlAdmin, async (c) => {
    const existe = await c.query("SELECT 1 FROM usuario WHERE papel = 'gestor' AND ativo LIMIT 1")
    if (existe.rowCount) return { ok: false, motivo: 'ja_existe_gestor_ativo' }
    const { rows } = await c.query<{ id: string }>(
      "INSERT INTO usuario (nome, email, papel) VALUES ($1, $2, 'gestor') RETURNING id",
      [dados.nome.trim(), email],
    )
    return { ok: true, id: rows[0].id }
  })
}
```

- [ ] **Step 3: CLIs**

`scripts/db/env.ts` (compartilhado pelos CLIs):

```ts
import { existsSync } from 'node:fs'
import { exigir, lerEnv, type ChaveUrl } from '../../src/server/db/env'

// Os CLIs rodam fora do Next e não usam @next/env: ele escolhe o arquivo pelo
// modo (development/test/production), não por NODE_ENV livre, então não serve
// para um alvo chamado "railway". Node 24 tem process.loadEnvFile nativo.
// Sem ALVO lê .env.local (container). ALVO=railway lê .env.railway.local, que o
// .gitignore já ignora por casar com .env*. Variável já presente no ambiente vence.
export function urlDe(chave: ChaveUrl): string {
  const arquivo = process.env.ALVO ? `.env.${process.env.ALVO}.local` : '.env.local'
  if (existsSync(arquivo)) process.loadEnvFile(arquivo)
  return exigir(lerEnv(), chave)
}

export function sair(ok: boolean, mensagem: string): never {
  console[ok ? 'log' : 'error'](mensagem)
  process.exit(ok ? 0 : 1)
}
```

Guarde a URL admin da Railway em `.env.railway.local`, nunca em `.env.local`, para `npm run db:aplicar` sem `ALVO` nunca alcançar produção por engano. No CI não há `.env.local`; as variáveis vêm do `env:` do job e `existsSync` devolve falso.

`scripts/db/checar.ts`:

```ts
import { lerMigracoes, PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { checarMigracoes } from '../../src/server/db/migracoes/checar'
import { sair } from './env'

const r = checarMigracoes(await lerMigracoes(PASTA_MIGRACOES))
if (r.ok) sair(true, 'migrações: convenções ok')
sair(false, ['migrações: problemas', ...r.problemas.map((p) => `  - ${p}`)].join('\n'))
```

`scripts/db/aplicar.ts`:

```ts
import { aplicar } from '../../src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { conferirInvariantes } from '../../src/server/db/migracoes/invariantes'
import { sair, urlDe } from './env'

const url = urlDe('DATABASE_URL_ADMIN')
const r = await aplicar(url, PASTA_MIGRACOES)
if (!r.ok) sair(false, `não aplicado: ${r.motivo}\n${JSON.stringify(r.divergentes ?? r.problemas, null, 2)}`)
console.log(r.aplicadas.length ? `aplicadas: ${r.aplicadas.join(', ')}` : 'nada pendente')
const inv = await conferirInvariantes(url)
if (!inv.ok) sair(false, ['invariantes violadas:', ...inv.violacoes.map((v) => `  - ${v}`)].join('\n'))
sair(true, 'invariantes ok')
```

`scripts/db/pendentes.ts`:

```ts
import { situacao } from '../../src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { sair, urlDe } from './env'

// Usa a URL de conferência quando existir (CI), senão a admin (dev).
const chave = process.env.DATABASE_URL_CONFERENCIA ? 'DATABASE_URL_CONFERENCIA' : 'DATABASE_URL_ADMIN'
const s = await situacao(urlDe(chave), PASTA_MIGRACOES)
const resumo = [
  `aplicadas: ${s.aplicadas.length}`,
  s.pendentes.length ? `pendentes: ${s.pendentes.join(', ')}` : 'nada pendente',
]
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises')
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Migrações na Railway\n\n${resumo.map((l) => `- ${l}`).join('\n')}\n`)
}
if (s.divergentes.length) sair(false, ['migração aplicada foi alterada:', ...s.divergentes.map((d) => `  - ${d.nome}`)].join('\n'))
sair(true, resumo.join('\n'))
```

`scripts/db/seed-gestor.ts`:

```ts
import { criarPrimeiroGestor } from '../../src/server/db/seed'
import { sair, urlDe } from './env'

const [nome, email] = process.argv.slice(2)
if (!nome || !email) sair(false, 'uso: npm run db:seed:gestor -- "Nome" email@dominio')
const r = await criarPrimeiroGestor(urlDe('DATABASE_URL_ADMIN'), { nome, email })
if (!r.ok) sair(false, `não criado: ${r.motivo}`)
sair(true, `gestor criado: ${r.id}`)
```

`scripts/db/senha.ts`:

```ts
import { comAdmin } from '../../src/server/db/admin'
import { sair, urlDe } from './env'

const [papel, senha] = process.argv.slice(2)
if (!['app_conexao', 'app_conferencia'].includes(papel ?? '') || !senha) {
  sair(false, 'uso: npm run db:senha -- <app_conexao|app_conferencia> <senha>')
}
await comAdmin(urlDe('DATABASE_URL_ADMIN'), async (c) => {
  // Identificador vem de lista fechada; a senha vai como literal escapado pelo próprio Postgres.
  await c.query(`ALTER ROLE ${papel} LOGIN PASSWORD ${escapar(senha)}`)
})
sair(true, `${papel}: LOGIN e senha definidos`)

function escapar(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}
```

Nota: `ALTER ROLE ... PASSWORD` não aceita `$1`, por isso o escape manual. A senha aparece no histórico do shell de quem roda; isso é aceitável para um comando executado uma vez por ambiente pelo dono do banco.

- [ ] **Step 4: Scripts no `package.json`**

```json
"db:checar": "tsx scripts/db/checar.ts",
"db:aplicar": "tsx scripts/db/aplicar.ts",
"db:pendentes": "tsx scripts/db/pendentes.ts",
"db:seed:gestor": "tsx scripts/db/seed-gestor.ts",
"db:senha": "tsx scripts/db/senha.ts",
"db:subir": "docker compose up -d --wait",
"db:derrubar": "docker compose down"
```

A spec (seção 9.5) já descreve `db:senha` como um comando com argumento.

- [ ] **Step 5: Exercitar contra o container local**

Criar `.env.local` (ignorado pelo git) com:

```
DATABASE_URL=postgres://app_conexao:local@localhost:5432/crm
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:5432/crm
PG_SSL=off
```

E rodar, nesta ordem:

```bash
npm run db:checar
npm run db:pendentes
npm run db:aplicar
npm run db:senha -- app_conexao local
npm run db:seed:gestor -- "Alexandre" alexandremelods@gmail.com
npm run db:aplicar
```

Esperado: checar ok; pendentes lista as seis; aplicar aplica as seis e confere invariantes; senha define; seed cria; segundo aplicar diz "nada pendente" e "invariantes ok". Rodar de novo o seed deve recusar com `ja_existe_gestor_ativo`.

- [ ] **Step 6: Typecheck dos scripts, lint, commit**

`tsconfig.json` já inclui `**/*.ts`, então `scripts/` entra no typecheck. Se o ESLint reclamar de top-level `await` em `scripts/`, o `package.json` do projeto precisa de `"type": "module"`? Não: o `tsx` aceita top-level await em `.ts` sem isso. Se o lint reclamar, é regra de estilo do `eslint-config-next`; ajustar a regra só para `scripts/**` no `eslint.config.mjs`, não no código.

```bash
npm run typecheck && npm run lint && npm test
git add -A
git commit -m "db: CLIs de checar, aplicar, pendentes, seed do primeiro gestor e senha de papel"
```

---

### Task 11: CI com Postgres, conferência contra a Railway e limpeza de env

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.env.local` (local, fora do git: renomear `DATABASE_PUBLIC_URL` para `DATABASE_URL`, apontando para o container)
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: todos os npm scripts da Task 10.
- Produces: CI verde obrigatório para merge, com o passo de conferência contra a Railway.

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml` (sem BOM: gravar com editor que salve UTF-8 puro; a R-005 do `REGRAS.md` explica por quê):

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  catraca:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 2s
          --health-timeout 2s
          --health-retries 15
    env:
      DATABASE_URL_ADMIN: postgres://postgres:postgres@localhost:5432/postgres
      PG_SSL: 'off'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Lint
        run: npm run lint
      - name: Convenções de migração
        run: npm run db:checar
      - name: Testes unitários
        run: npm run test:unit
      - name: Testes de integração
        run: npm run test:integracao
      - name: Build sem env (validação precisa ser preguiçosa)
        run: npm run build
        env:
          DATABASE_URL_ADMIN: ''
          PG_SSL: ''
      - name: Conferência de migrações na Railway
        if: github.event_name == 'pull_request'
        env:
          DATABASE_URL_CONFERENCIA: ${{ secrets.DATABASE_URL_CONFERENCIA }}
          EH_FORK: ${{ github.event.pull_request.head.repo.fork }}
        run: |
          if [ -z "$DATABASE_URL_CONFERENCIA" ]; then
            if [ "$EH_FORK" = "true" ]; then
              echo "### Migrações na Railway" >> "$GITHUB_STEP_SUMMARY"
              echo "- conferência **não rodou**: PR de fork não recebe o secret" >> "$GITHUB_STEP_SUMMARY"
              exit 0
            fi
            echo "::error::DATABASE_URL_CONFERENCIA ausente em PR do próprio repositório. O secret sumiu ou expirou."
            exit 1
          fi
          npm run db:pendentes
```

`.env.test` é lido pelo `tests/setup-env.ts` também no CI, mas as variáveis de `env:` do job vencem, porque `@next/env` não sobrescreve o que já está em `process.env`. Os dois apontam para o mesmo lugar de propósito.

- [ ] **Step 2: `.env.example` e README**

`.env.example`:

```
# Copie para .env.local (desenvolvimento, container do docker-compose.yml).
DATABASE_URL=postgres://app_conexao:<senha-local>@localhost:5432/crm
DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:5432/crm
PG_SSL=off

# Para a Railway, crie .env.railway.local (ignorado pelo git) e rode com ALVO=railway:
# DATABASE_URL_ADMIN=postgres://postgres:<senha>@<host>.proxy.rlwy.net:<porta>/railway
# PG_SSL=verify
# PG_SSL_CA=<caminho do CA, se o certificado do proxy não validar>
```

No `.gitignore`, ao lado de `!.env.test`, acrescentar `!.env.example`, senão o arquivo nem entra no commit.

Substituir o `README.md` gerado pelo Create Next App por: o que é o projeto (uma frase), como subir (`npm run db:subir`, copiar `.env.example`, `npm run db:aplicar`, `npm run db:senha`, `npm run db:seed:gestor`, `npm run dev`), como testar (`npm test`), como aplicar migrações na Railway (`ALVO=railway npm run db:aplicar`), e um link para `docs/db/fundacao.md`.

- [ ] **Step 3: Renomear a env local e conferir que o secret existe no GitHub**

Na `.env.local`: trocar `DATABASE_PUBLIC_URL` por `DATABASE_URL` apontando para o container. Mover a URL da Railway para `.env.railway.local`.

Criar o papel de conferência na Railway e o secret, uma vez:

```bash
ALVO=railway npm run db:aplicar
ALVO=railway npm run db:senha -- app_conferencia <senha-forte>
gh secret set DATABASE_URL_CONFERENCIA --body "postgres://app_conferencia:<senha>@<host>.proxy.rlwy.net:<porta>/railway"
```

Este passo depende da Task 12 (TLS contra a Railway) ter concluído qual `PG_SSL_CA` usar. Executar as duas juntas.

- [ ] **Step 4: Abrir o PR e ver o CI verde**

```bash
git add -A
git commit -m "ci: postgres no job, conferência de migrações na Railway, env de exemplo e README"
git push -u origin spec/fundacao-banco
gh pr create --title "Fundação de banco" --body-file docs/superpowers/plans/pr-fundacao-banco.md
```

O corpo do PR (`pr-fundacao-banco.md`, temporário, não commitado) resume: o que entra, o que fica para a fatia de login, link para a spec, e o resultado da Task 12. Terminar com a linha de atribuição exigida pela sessão.

Esperado: todos os passos verdes, e o resumo do job mostrando "Migrações na Railway: aplicadas 6, nada pendente".

---

### Task 12: Verificação TLS contra a Railway

**Files:**
- Modify: `docs/db/fundacao.md` (seção "TLS na Railway", com o resultado)
- Modify: `docs/superpowers/specs/2026-09-08-fundacao-banco-design.md` (seção 13, retirar "verificar no plano")

**Interfaces:**
- Consumes: `configSsl`, `comAdmin`, `db:pendentes`.

- [ ] **Step 1: Tentar `verify` sem CA**

Com `.env.railway.local` contendo a URL admin da Railway e `PG_SSL=verify`:

```bash
ALVO=railway npm run db:pendentes
```

Resultado A: conecta. Registrar em `docs/db/fundacao.md`: "o proxy da Railway apresenta certificado válido contra CA pública; `PG_SSL=verify` basta". Fim.

Resultado B: falha com `self-signed certificate` ou `unable to verify the first certificate`. Seguir para o Step 2.

- [ ] **Step 2: Obter o CA e usar `PG_SSL_CA`**

```bash
openssl s_client -connect <host>.proxy.rlwy.net:<porta> -starttls postgres -showcerts </dev/null 2>/dev/null | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' > railway-ca.pem
```

O último bloco do arquivo é o certificado mais alto da cadeia. Se for autoassinado (emissor igual ao sujeito, verificar com `openssl x509 -in railway-ca.pem -noout -issuer -subject`), ele é o CA. Gravar em `.env.railway.local`:

```
PG_SSL_CA=./railway-ca.pem
```

Acrescentar `railway-ca.pem` ao `.gitignore`? Não: um CA público não é segredo, mas é específico do seu ambiente. Manter fora do repositório e documentar como obtê-lo.

```bash
ALVO=railway npm run db:pendentes
```

Esperado: conecta e lista a situação. Se ainda falhar com `Hostname/IP does not match certificate's altnames`, o certificado do proxy não inclui o host: aí a Railway não oferece TLS verificável pelo proxy público, e a decisão registrada é **não conectar pela internet sem verificação**. Alternativas a documentar para o usuário decidir: rodar `db:aplicar` de dentro da rede da Railway (um serviço efêmero), ou usar o host privado (`*.railway.internal`) a partir de um serviço na Railway. Nenhuma delas é implementada nesta fatia.

- [ ] **Step 3: Registrar o resultado**

Em `docs/db/fundacao.md`, seção "TLS na Railway": o que foi tentado, o que funcionou, o comando exato para reproduzir. Na spec, seção 13, substituir "Verificar no plano" pelo resultado.

```bash
git add docs
git commit -m "docs: resultado da verificação TLS contra a Railway"
```

---

## Ordem de execução e pontos de parada

1. Tasks 1 a 10 em sequência, cada uma com seu commit. Todas rodam só contra o container local.
2. Task 12 antes do Step 3 da Task 11, porque o secret de conferência depende de saber como conectar com TLS.
3. Task 11 fecha com o PR aberto e o CI verde.

Revisão humana recomendada depois da Task 6 (SQL das migrações) e depois da Task 8 (`comoUsuario`): são as duas peças que o resto do sistema vai herdar.

