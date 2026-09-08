# Login e sessão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma pessoa com conta em `usuario` entra com e-mail e senha, recebe sessão em cookie, toda tela protegida sabe quem ela é, o primeiro gestor ganha senha provisória pelo seed, senha provisória obriga troca, e tentativas de login têm limite.

**Architecture:** Schema `autenticacao` com três tabelas sem política nenhuma, tocadas só por sete funções `SECURITY DEFINER` que `app_conexao` chama por `chamar(nome, args)`, um mapa fechado e tipado em `src/server/db/sem-identidade.ts`. Regras de login, troca de senha e acesso vivem em `src/server/autenticacao/` como funções Node puras que devolvem `{ ok, motivo }`, testadas contra Postgres real. Só `guarda.ts`, `proxy.ts` e o que está em `app/` tocam `next/*`.

**Tech Stack:** Next 16.3 (App Router, `proxy.ts`, server actions), React 19, TypeScript 5, `pg` 8.23, `node:crypto` (`scrypt`, `sha256`), Vitest 5 (projetos `unitario` e `integracao`), Postgres 17.

**Spec:** `docs/superpowers/specs/2026-09-08-login-sessao-design.md`

## Global Constraints

- TypeScript sem ponto e vírgula, aspas simples. Regra de negócio devolve `{ ok, motivo }`; exceção só para infraestrutura.
- Branch `fatia/0b-login-sessao`, PR para `main`. Nunca commit na main.
- TDD: teste falhando primeiro, em toda tarefa.
- Migração: `-- ver docs/db/NNNN.md` na primeira linha, `BEGIN;` na segunda, `COMMIT;` na última, **nenhum outro comentário** (o checador recusa `--` e `/* */` no corpo), sem linha que seja exatamente `BEGIN;`/`COMMIT;` no meio (o `BEGIN` sem ponto e vírgula do plpgsql é aceito), LF, sem `PASSWORD`. `npm run db:checar` confere.
- Todas as funções `SECURITY DEFINER` com `SET search_path = ''` e nomes qualificados (`public.usuario`, `autenticacao.sessao`). A invariante confere.
- Nenhum privilégio de tabela em `autenticacao` para nenhum papel. `app_conexao` só tem `USAGE` no schema e `EXECUTE` nas sete funções.
- `sem-identidade.ts` não exporta `executar`. Só `chamar`.
- Só `cookie.ts`, `rota.ts` (constantes puras), `guarda.ts`, `proxy.ts` e `app/**` podem importar `next/*`. O resto de `src/server/autenticacao/` roda em Node puro.
- `cookies().set/delete` só em server action e route handler. Nunca em página.
- Nomes em português. Sem biblioteca nova: `package.json` não muda.
- Harness de teste define `process.env.DATABASE_URL` com a URL de `app_conexao` do banco de teste, para `chamar` e o pool usarem o caminho padrão.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `db/migracoes/0007_autenticacao.sql` | schema, três tabelas, RLS, `USAGE` para `app_conexao` |
| `db/migracoes/0008_senha_provisoria.sql` | coluna, `pode_escrever()`, `ALTER POLICY` |
| `db/migracoes/0009_funcoes_autenticacao.sql` | as sete funções e seus GRANTs |
| `docs/db/0007.md`, `0008.md`, `0009.md` | o porquê |
| `src/server/db/sem-identidade.ts` | `chamar(nome, args)`, `FUNCOES`, erros |
| `src/server/db/migracoes/invariantes.ts` | três invariantes novas |
| `src/server/autenticacao/linhas.ts` | tipos das linhas que as funções devolvem |
| `src/server/autenticacao/senha.ts` | scrypt, validação, provisória, `hashDescartavel()` |
| `src/server/autenticacao/sessao.ts` | token, `hashDoToken`, criar/ler/encerrar |
| `src/server/autenticacao/entrar.ts` | regra de login |
| `src/server/autenticacao/trocar-senha.ts` | regra da troca |
| `src/server/autenticacao/acesso.ts` | `avaliarAcesso` pura |
| `src/server/autenticacao/rota.ts` | `decidirRota` pura, `ROTAS_PUBLICAS` |
| `src/server/autenticacao/cookie.ts` | `COOKIE_SESSAO`, `opcoesCookie` |
| `src/server/autenticacao/origem.ts` | `origemDe(headers)` |
| `src/server/autenticacao/mensagens.ts` | texto de tela por motivo |
| `src/server/autenticacao/guarda.ts` | `usuarioAtual()` com `cache()`, `exigir()` |
| `src/server/db/seed.ts`, `scripts/db/seed-gestor.mts` | gestor com senha provisória |
| `proxy.ts` | presença do cookie |
| `app/login/{page,formulario,acao}.tsx` | tela e action de login |
| `app/trocar-senha/{page,formulario,acao}.tsx` | tela e action de troca |
| `app/sair/route.ts` | POST de logout |
| `app/page.tsx`, `app/layout.tsx` | tela protegida mínima |
| `tests/integracao/ajuda.ts` | `criarUsuarioComSenha`, env `DATABASE_URL` |
| `tests/integracao/{autenticacao-schema,funcoes-autenticacao,entrar,trocar-senha}.test.ts` | integração nova |

---

### Task 1: Migrações 0007 e 0008, invariantes novas, testes de schema e de política

**Files:**
- Create: `db/migracoes/0007_autenticacao.sql`, `db/migracoes/0008_senha_provisoria.sql`
- Create: `docs/db/0007.md`, `docs/db/0008.md`
- Modify: `src/server/db/migracoes/invariantes.ts`, `src/server/db/migracoes/invariantes.test.ts`
- Modify: `tests/integracao/schema.test.ts`, `tests/integracao/runner.test.ts`, `tests/integracao/politicas.test.ts`
- Create: `tests/integracao/autenticacao-schema.test.ts`

**Interfaces:**
- Consumes: `criarBancoDeTeste`, `criarUsuario`, `conferirInvariantes`, `avaliar`, `Estado`.
- Produces: schema `autenticacao` com `credencial`, `sessao`, `tentativa_login`; coluna `usuario.senha_provisoria_pendente`; função `pode_escrever()`; `Estado` ganha `privilegiosDeConexaoEmAutenticacao: string[]` e `politicasEmAutenticacao: string[]`; `FUNCOES_DE_ACESSO` ganha `pode_escrever`.

- [ ] **Step 1: Testes unitários das invariantes novas**

Em `src/server/db/migracoes/invariantes.test.ts`, no `sao()`:

```ts
  funcoesDefinidoras: [
    { schema: 'public', nome: 'usuario_atual', temSearchPath: true },
    { schema: 'public', nome: 'pode_ler', temSearchPath: true },
    { schema: 'public', nome: 'eh_gestor', temSearchPath: true },
    { schema: 'public', nome: 'pode_escrever', temSearchPath: true },
  ],
  funcoesDeAcesso: ['usuario_atual', 'pode_ler', 'eh_gestor', 'pode_escrever'],
  papeis: ['app_conexao', 'app_usuario'],
  conexao: { rolsuper: false, rolbypassrls: false, rolconnlimit: 20, dona: 0, herdaDe: [] },
  migracaoAlcancavelPor: [],
  privilegiosDeConexaoEmAutenticacao: [],
  politicasEmAutenticacao: [],
```

E três testes novos no `describe('avaliar')`:

```ts
  test('pode_escrever ausente é violação', () => {
    const e = sao()
    e.funcoesDeAcesso = ['usuario_atual', 'pode_ler', 'eh_gestor']
    umaViolacao(e, /função de acesso ausente: pode_escrever/)
  })

  test('app_conexao com privilégio de tabela em autenticacao', () => {
    const e = sao()
    e.privilegiosDeConexaoEmAutenticacao = ['sessao']
    umaViolacao(e, /app_conexao alcança autenticacao\.sessao/)
  })

  test('política em tabela de autenticacao', () => {
    const e = sao()
    e.politicasEmAutenticacao = ['sessao_ler']
    umaViolacao(e, /política em autenticacao: sessao_ler/)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --project unitario src/server/db/migracoes/invariantes.test.ts`
Expected: FAIL, três testes novos, e os antigos falhando por `pode_escrever` faltar em `funcoesDeAcesso` esperado.

- [ ] **Step 3: Invariantes**

`src/server/db/migracoes/invariantes.ts`: `FUNCOES_DE_ACESSO` vira

```ts
export const FUNCOES_DE_ACESSO = ['usuario_atual', 'pode_ler', 'eh_gestor', 'pode_escrever'] as const
```

`Estado` ganha, no fim:

```ts
  privilegiosDeConexaoEmAutenticacao: string[]
  politicasEmAutenticacao: string[]
```

Em `lerEstado`, depois de `migracao`:

```ts
  const privilegios = conexao.rows[0]
    ? await c.query<{ nome: string }>(`
        SELECT c.relname AS nome FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'autenticacao' AND c.relkind = 'r'
          AND (has_table_privilege('app_conexao', c.oid, 'SELECT') OR has_table_privilege('app_conexao', c.oid, 'INSERT')
            OR has_table_privilege('app_conexao', c.oid, 'UPDATE') OR has_table_privilege('app_conexao', c.oid, 'DELETE'))
        ORDER BY 1`)
    : { rows: [] as { nome: string }[] }
  const politicas = await c.query<{ nome: string }>(
    "SELECT policyname AS nome FROM pg_policies WHERE schemaname = 'autenticacao' ORDER BY 1",
  )
```

e no `return`:

```ts
    privilegiosDeConexaoEmAutenticacao: privilegios.rows.map((r) => r.nome),
    politicasEmAutenticacao: politicas.rows.map((r) => r.nome),
```

Em `avaliar`, antes do `return v`:

```ts
  for (const t of e.privilegiosDeConexaoEmAutenticacao) {
    v.push(`app_conexao alcança autenticacao.${t} direto; só função definidora pode tocar a tabela`)
  }
  for (const p of e.politicasEmAutenticacao) {
    v.push(`política em autenticacao: ${p} (tabela de autenticacao não tem política; alguém abriu para um papel)`)
  }
```

- [ ] **Step 4: Rodar unitário e ver passar**

Run: `npx vitest run --project unitario src/server/db/migracoes/invariantes.test.ts`
Expected: PASS.

- [ ] **Step 5: Testes de integração de schema**

`tests/integracao/schema.test.ts`: o teste "as sete estão registradas" vira "as dez" com a lista até `'0009_funcoes_autenticacao.sql'` (a 0009 entra na Task 2; até lá este arquivo falha, e isso é esperado). O teste "funções de acesso: PUBLIC não executa" inclui `'pode_escrever()'` na lista.

`tests/integracao/runner.test.ts`, no `describe('conferirInvariantes')`, dois negativos:

```ts
  test('nomeia app_conexao com privilégio de tabela em autenticacao (controle negativo)', async () => {
    await banco.sql('GRANT SELECT ON autenticacao.sessao TO app_conexao')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/app_conexao alcança autenticacao\.sessao/)
    } finally {
      await banco.sql('REVOKE ALL ON autenticacao.sessao FROM app_conexao')
    }
  })

  test('nomeia política em tabela de autenticacao (controle negativo)', async () => {
    await banco.sql('CREATE POLICY aberta ON autenticacao.sessao FOR SELECT TO app_conexao USING (true)')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/política em autenticacao: aberta/)
    } finally {
      await banco.sql('DROP POLICY aberta ON autenticacao.sessao')
    }
  })
```

Novo `tests/integracao/autenticacao-schema.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

const TABELAS = ['credencial', 'sessao', 'tentativa_login']

describe('schema autenticacao', () => {
  test('três tabelas com RLS e nenhuma política', async () => {
    const t = await banco.sql<{ nome: string; rls: boolean }>(`
      SELECT c.relname AS nome, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'autenticacao' AND c.relkind = 'r' ORDER BY 1`)
    expect(t).toEqual(TABELAS.map((nome) => ({ nome, rls: true })))
    const p = await banco.sql("SELECT 1 FROM pg_policies WHERE schemaname = 'autenticacao'")
    expect(p).toEqual([])
  })

  test('app_conexao tem USAGE no schema e nenhum privilégio de tabela; app_usuario e app_conferencia nada', async () => {
    const usage = await banco.sql<{ papel: string; usa: boolean }>(`
      SELECT r.rolname AS papel, has_schema_privilege(r.rolname, 'autenticacao', 'USAGE') AS usa
      FROM pg_roles r WHERE r.rolname IN ('app_conexao', 'app_usuario', 'app_conferencia') ORDER BY 1`)
    expect(usage).toEqual([
      { papel: 'app_conexao', usa: true },
      { papel: 'app_conferencia', usa: false },
      { papel: 'app_usuario', usa: false },
    ])
    for (const tabela of TABELAS) {
      const r = await banco.sql<{ le: boolean; escreve: boolean }>(
        `SELECT has_table_privilege('app_conexao', 'autenticacao.${tabela}', 'SELECT') AS le,
                has_table_privilege('app_conexao', 'autenticacao.${tabela}', 'INSERT, UPDATE, DELETE') AS escreve`,
      )
      expect(r[0]).toEqual({ le: false, escreve: false })
    }
  })

  test('SELECT direto em cada tabela como app_conexao é 42501', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      for (const tabela of TABELAS) {
        await expect(c.query(`SELECT 1 FROM autenticacao.${tabela}`)).rejects.toMatchObject({ code: '42501' })
      }
    } finally {
      c.release()
    }
  })

  test('usuario.senha_provisoria_pendente existe, NOT NULL, default false', async () => {
    const r = await banco.sql<{ nulo: string; padrao: string }>(`
      SELECT is_nullable AS nulo, column_default AS padrao FROM information_schema.columns
      WHERE table_name = 'usuario' AND column_name = 'senha_provisoria_pendente'`)
    expect(r).toEqual([{ nulo: 'NO', padrao: 'false' }])
  })
})
```

`tests/integracao/politicas.test.ts`, `describe` novo no fim:

```ts
describe('senha provisória pendente', () => {
  test('gestor pendente lê normalmente e não insere nem altera: barreira do banco', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Pendente')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    const le = await banco.comoUsuario(id, (e) => e('SELECT id FROM usuario'))
    expect(le.afetadas).toBeGreaterThan(1)
    await expect(
      banco.comoUsuario(id, (e) => e(inserir('P', 'p@teste.local', 'vendedor'))),
    ).rejects.toMatchObject({ code: '42501' })
    const altera = await banco.comoUsuario(id, (e) => e("UPDATE usuario SET nome = 'X' WHERE id = $1", [vendedor]))
    expect(altera.afetadas).toBe(0)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm run test:integracao`
Expected: FAIL em `autenticacao-schema.test.ts` (schema não existe), `politicas.test.ts` (coluna não existe), `runner.test.ts` (tabela não existe), `schema.test.ts` (sete registradas, não dez).

- [ ] **Step 7: Migração 0007**

`db/migracoes/0007_autenticacao.sql`:

```sql
-- ver docs/db/0007.md
BEGIN;
CREATE SCHEMA autenticacao;
CREATE TABLE autenticacao.credencial (
  usuario_id     uuid PRIMARY KEY REFERENCES usuario (id) ON DELETE RESTRICT,
  senha_hash     text NOT NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE autenticacao.sessao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  token_hash  text NOT NULL UNIQUE,
  expira_em   timestamptz NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessao_usuario_idx ON autenticacao.sessao (usuario_id);
CREATE TABLE autenticacao.tentativa_login (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  origem      text,
  sucesso     boolean NOT NULL,
  ocorreu_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentativa_login_email_idx ON autenticacao.tentativa_login (email, ocorreu_em DESC);
CREATE INDEX tentativa_login_origem_idx ON autenticacao.tentativa_login (origem, ocorreu_em DESC) WHERE origem IS NOT NULL;
ALTER TABLE autenticacao.credencial ENABLE ROW LEVEL SECURITY;
ALTER TABLE autenticacao.sessao ENABLE ROW LEVEL SECURITY;
ALTER TABLE autenticacao.tentativa_login ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA autenticacao TO app_conexao;
COMMIT;
```

- [ ] **Step 8: Migração 0008**

`db/migracoes/0008_senha_provisoria.sql`:

```sql
-- ver docs/db/0008.md
BEGIN;
ALTER TABLE usuario ADD COLUMN senha_provisoria_pendente boolean NOT NULL DEFAULT false;
CREATE FUNCTION pode_escrever() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT u.ativo AND NOT u.senha_provisoria_pendente FROM public.usuario u WHERE u.id = public.usuario_atual()), false) $$;
REVOKE EXECUTE ON FUNCTION pode_escrever() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pode_escrever() TO app_usuario;
ALTER POLICY usuario_criar ON usuario WITH CHECK (pode_escrever() AND eh_gestor());
ALTER POLICY usuario_alterar ON usuario
  USING (pode_escrever() AND eh_gestor() AND id <> usuario_atual())
  WITH CHECK (pode_escrever() AND eh_gestor() AND id <> usuario_atual());
COMMIT;
```

- [ ] **Step 9: Docs**

`docs/db/0007.md`:

```markdown
# 0007 — schema `autenticacao`

**O que cria.** Schema `autenticacao` com `credencial` (uma por usuário, PK
que é FK), `sessao` (`token_hash` único, `expira_em`) e `tentativa_login`
(e-mail, origem anulável, sucesso, quando). RLS habilitada nas três, **sem
política nenhuma**. `USAGE` no schema para `app_conexao`, e mais nada para
ninguém.

**Por quê.** Credencial e sessão apontam para `usuario`, não o inverso: quem
manda é o usuário do domínio; login é detalhe. Sem política, só a dona toca
as tabelas, e ela toca por dentro das funções `SECURITY DEFINER` da 0009. Se
um dia aparecer política aqui, alguém abriu a tabela para um papel, e a
invariante nomeia.

`sessao.token_hash` guarda `sha256(token)`, nunca o token. Quem lê a tabela
não ganha sessão utilizável. SHA-256 puro, sem KDF: o token tem 256 bits de
aleatoriedade, e KDF lenta serve para entrada de baixa entropia. Não
"melhorar" depois.

`tentativa_login` não guarda senha nem hash. Só que houve tentativa, de quem
e de onde. Os índices são parciais por janela recente: a tabela cresce e as
consultas só olham os últimos 15 minutos. Faxina é dívida com gatilho em
`docs/db/divida-tecnica.md`.

**Depende de.** 0001 (`usuario`).
```

`docs/db/0008.md`:

```markdown
# 0008 — senha provisória e `pode_escrever()`

**O que faz.** `usuario.senha_provisoria_pendente boolean NOT NULL DEFAULT
false`. `pode_escrever()` = ativo e sem senha provisória pendente, no mesmo
molde das outras funções de acesso. `usuario_criar` e `usuario_alterar`
passam a exigir `pode_escrever()` além do que já exigiam. `usuario_ler` não
muda.

**Por quê.** Banco nega escrita, aplicação nega tudo. A tela manda quem está
pendente para a troca de senha; se a tela falhar, o banco ainda impede que
uma senha provisória, que passou por e-mail ou por um papel impresso, escreva
no domínio. Leitura continua permitida porque a resolução de sessão e a tela
de troca precisam ler o próprio usuário, e uma leitura permitida custa nada
quando a aplicação nem monta a tela.

A marca cai dentro de `senha_trocar` (0009), como consequência da troca
real, e não por chamada separada que qualquer código poderia fazer.

**Depende de.** 0005 (políticas) e 0002 (funções).
```

- [ ] **Step 10: Checador, integração**

Run: `npm run db:checar && npm run test:integracao`
Expected: `db:checar` ok. Integração: tudo passa exceto `schema.test.ts` (as dez, que só fecha na Task 2). Se `runner.test.ts` reclamar de `autenticacao.sessao` inexistente, a 0007 não aplicou: ver a mensagem do runner.

- [ ] **Step 11: Commit**

```bash
git add db/migracoes/0007_autenticacao.sql db/migracoes/0008_senha_provisoria.sql docs/db/0007.md docs/db/0008.md src/server/db/migracoes/invariantes.ts src/server/db/migracoes/invariantes.test.ts tests/integracao/schema.test.ts tests/integracao/runner.test.ts tests/integracao/politicas.test.ts tests/integracao/autenticacao-schema.test.ts
git commit -m "0007 e 0008: schema autenticacao, senha provisória, pode_escrever, invariantes"
```

---

### Task 2: `chamar` sem identidade, migração 0009 e testes das funções

**Files:**
- Create: `src/server/db/sem-identidade.ts`, `src/server/db/sem-identidade.test.ts`
- Create: `src/server/autenticacao/linhas.ts`
- Create: `db/migracoes/0009_funcoes_autenticacao.sql`, `docs/db/0009.md`
- Modify: `tests/integracao/ajuda.ts`
- Create: `tests/integracao/funcoes-autenticacao.test.ts`

**Interfaces:**
- Consumes: `conectarVerificado(url?)`, `criarBancoDeTeste`, `criarUsuario`.
- Produces:
  - `FUNCOES` (mapa nome → aridade), `type NomeFuncao`, `type Args<N>`, `chamar<N, T>(nome: N, args: Args<N>): Promise<T[]>`, `FuncaoDesconhecida`, `AridadeInvalida`.
  - `linhas.ts`: `LinhaCredencial`, `LinhaBloqueio`, `LinhaSessao`, `LinhaSenhaTrocar`.
  - Harness: `process.env.DATABASE_URL` apontando para `urlApp` enquanto o banco de teste vive.
  - As sete funções em `autenticacao`.

- [ ] **Step 1: Teste unitário de `chamar`**

`src/server/db/sem-identidade.test.ts`:

```ts
import { expect, test } from 'vitest'
import { AridadeInvalida, chamar, FUNCOES, FuncaoDesconhecida } from './sem-identidade'

// Sem DATABASE_URL no ambiente unitário: se a validação não vier antes da
// conexão, o teste falha com "Variável de ambiente ausente" em vez do erro nomeado.

test('nome fora do mapa lança antes de tocar no banco', async () => {
  await expect(chamar('drop_tudo' as never, [] as never)).rejects.toBeInstanceOf(FuncaoDesconhecida)
})

test('aridade errada lança antes de tocar no banco', async () => {
  await expect(chamar('sessao_atual', ['a', 'b'] as never)).rejects.toBeInstanceOf(AridadeInvalida)
})

test('o mapa tem exatamente as sete funções da spec', () => {
  expect(Object.keys(FUNCOES).sort()).toEqual([
    'bloqueio_login',
    'credencial_por_email',
    'registrar_tentativa_login',
    'senha_trocar',
    'sessao_atual',
    'sessao_criar',
    'sessao_encerrar',
  ])
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --project unitario src/server/db/sem-identidade.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: `sem-identidade.ts`**

```ts
import type { QueryResultRow } from 'pg'
import { conectarVerificado } from './pool'

// Único caminho para o banco sem identidade: chamar uma função SECURITY
// DEFINER de `autenticacao` como app_conexao. Não existe `executar` aqui, de
// propósito. Quem precisar de SQL livre sem identidade está pedindo a coisa
// errada; o mapa abaixo é a lista fechada, e o GRANT no banco é a mesma lista.
export const FUNCOES = {
  credencial_por_email: 1,
  bloqueio_login: 2,
  registrar_tentativa_login: 3,
  sessao_criar: 3,
  sessao_atual: 1,
  sessao_encerrar: 1,
  senha_trocar: 2,
} as const

export type NomeFuncao = keyof typeof FUNCOES
type Tupla<N extends number, R extends unknown[] = []> = R['length'] extends N ? R : Tupla<N, [...R, unknown]>
export type Args<N extends NomeFuncao> = Tupla<(typeof FUNCOES)[N]>

export class FuncaoDesconhecida extends Error {
  constructor(nome: string) {
    super(`função fora do mapa de sem-identidade: ${JSON.stringify(nome)}`)
    this.name = 'FuncaoDesconhecida'
  }
}

export class AridadeInvalida extends Error {
  constructor(nome: string, esperada: number, recebida: number) {
    super(`autenticacao.${nome} recebe ${esperada} argumento(s), recebeu ${recebida}`)
    this.name = 'AridadeInvalida'
  }
}

export async function chamar<N extends NomeFuncao, T extends QueryResultRow = QueryResultRow>(
  nome: N,
  args: Args<N>,
): Promise<T[]> {
  if (!Object.hasOwn(FUNCOES, nome)) throw new FuncaoDesconhecida(String(nome))
  const aridade: number = FUNCOES[nome]
  const valores = args as unknown[]
  if (valores.length !== aridade) throw new AridadeInvalida(nome, aridade, valores.length)
  const marcadores = Array.from({ length: aridade }, (_, i) => `$${i + 1}`).join(', ')
  const cliente = await conectarVerificado()
  try {
    // `nome` vem do mapa, nunca de fora. Os valores vão sempre como parâmetro.
    const r = await cliente.query<T>(`SELECT * FROM autenticacao.${nome}(${marcadores})`, valores)
    return r.rows
  } finally {
    cliente.release()
  }
}
```

`src/server/autenticacao/linhas.ts`:

```ts
// Forma das linhas que as funções de `autenticacao` devolvem. Uma fonte só,
// para `entrar`, `trocarSenha` e `sessao` não repetirem o tipo.
export type Papel = 'vendedor' | 'gestor'

export type LinhaCredencial = {
  usuario_id: string
  senha_hash: string
  ativo: boolean
  senha_provisoria_pendente: boolean
}

export type LinhaBloqueio = { bloqueado: boolean; segundos_restantes: number }

export type LinhaSessao = {
  usuario_id: string
  nome: string
  email: string
  papel: Papel
  senha_provisoria_pendente: boolean
  expira_em: Date
}

export type LinhaSenhaTrocar = { senha_trocar: string | null }
```

- [ ] **Step 4: Unitário passa**

Run: `npx vitest run --project unitario src/server/db/sem-identidade.test.ts`
Expected: PASS.

- [ ] **Step 5: Harness define `DATABASE_URL`**

Em `tests/integracao/ajuda.ts`, depois de `const urlApp = u.toString()`:

```ts
  // `chamar` e o pool usam o caminho padrão (DATABASE_URL). Definir aqui
  // exercita o caminho que a aplicação usa; `derrubar` limpa.
  process.env.DATABASE_URL = urlApp
```

E em `derrubar`, antes do `fecharPool`:

```ts
      delete process.env.DATABASE_URL
```

- [ ] **Step 6: Testes de integração das funções**

`tests/integracao/funcoes-autenticacao.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { LinhaBloqueio, LinhaCredencial, LinhaSenhaTrocar, LinhaSessao } from '@/src/server/autenticacao/linhas'
import { chamar } from '@/src/server/db/sem-identidade'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string

const FUTURO = new Date(Date.now() + 60 * 60 * 1000)
const PASSADO = new Date(Date.now() - 60 * 1000)

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [vendedor, 'hash-qualquer'])
})
afterAll(async () => {
  await banco.derrubar()
})

// Insere falhas como dona, com data controlada, para provar janela e limites sem esperar.
const falhas = (n: number, email: string, origem: string | null, quando: Date) =>
  banco.sql(
    `INSERT INTO autenticacao.tentativa_login (email, origem, sucesso, ocorreu_em)
     SELECT $1, $2, false, $3 FROM generate_series(1, $4)`,
    [email, origem, quando, n],
  )

describe('credencial_por_email', () => {
  test('devolve a credencial com a situação do usuário; normaliza o e-mail por dentro', async () => {
    const r = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', ['  Vendedor@Teste.local '])
    expect(r).toEqual([{ usuario_id: vendedor, senha_hash: 'hash-qualquer', ativo: true, senha_provisoria_pendente: false }])
  })

  test('zero linhas para e-mail inexistente', async () => {
    expect(await chamar('credencial_por_email', ['ninguem@teste.local'])).toEqual([])
  })
})

describe('sessão', () => {
  test('criar e resolver', async () => {
    await chamar('sessao_criar', [vendedor, 'h1', FUTURO])
    const r = await chamar<'sessao_atual', LinhaSessao>('sessao_atual', ['h1'])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ usuario_id: vendedor, nome: 'Vendedor', papel: 'vendedor', senha_provisoria_pendente: false })
  })

  test('expirada devolve zero linhas', async () => {
    await chamar('sessao_criar', [vendedor, 'h-expirada', PASSADO])
    expect(await chamar('sessao_atual', ['h-expirada'])).toEqual([])
  })

  test('barreira da sessão: usuário desativado com sessão viva devolve zero linhas, sem passar por comoUsuario', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Demitido')
    await chamar('sessao_criar', [id, 'h-demitido', FUTURO])
    expect(await chamar('sessao_atual', ['h-demitido'])).toHaveLength(1)
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    expect(await chamar('sessao_atual', ['h-demitido'])).toEqual([])
  })

  test('encerrar apaga', async () => {
    await chamar('sessao_criar', [vendedor, 'h-fim', FUTURO])
    await chamar('sessao_encerrar', ['h-fim'])
    expect(await chamar('sessao_atual', ['h-fim'])).toEqual([])
  })
})

describe('senha_trocar', () => {
  test('grava o hash, zera a marca, apaga as outras sessões e mantém a atual', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Trocador')
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'antigo'])
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    await chamar('sessao_criar', [id, 'atual', FUTURO])
    await chamar('sessao_criar', [id, 'outra', FUTURO])
    const r = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', ['atual', 'novo'])
    expect(r).toEqual([{ senha_trocar: id }])
    const [c] = await banco.sql<{ senha_hash: string }>('SELECT senha_hash FROM autenticacao.credencial WHERE usuario_id = $1', [id])
    expect(c.senha_hash).toBe('novo')
    const [u] = await banco.sql<{ p: boolean }>('SELECT senha_provisoria_pendente AS p FROM usuario WHERE id = $1', [id])
    expect(u.p).toBe(false)
    expect(await chamar('sessao_atual', ['atual'])).toHaveLength(1)
    expect(await chamar('sessao_atual', ['outra'])).toEqual([])
  })

  test('hash de sessão inválido devolve nulo e não muda nada', async () => {
    const r = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', ['nao-existe', 'x'])
    expect(r).toEqual([{ senha_trocar: null }])
  })
})

describe('limite de tentativas', () => {
  const RECENTE = new Date(Date.now() - 60 * 1000)
  const VELHO = new Date(Date.now() - 16 * 60 * 1000)

  test('sem tentativas, não bloqueia', async () => {
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['limpo@teste.local', '10.0.0.1'])
    expect(r).toEqual([{ bloqueado: false, segundos_restantes: 0 }])
  })

  test('10 falhas do e-mail na janela bloqueiam, com segundos restantes até 15 minutos', async () => {
    await falhas(9, 'alvo@teste.local', null, RECENTE)
    const antes = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['alvo@teste.local', null])
    expect(antes[0].bloqueado).toBe(false)
    const decima = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', ['alvo@teste.local', null, false])
    expect(decima[0].bloqueado).toBe(true)
    expect(decima[0].segundos_restantes).toBeGreaterThan(14 * 60)
    expect(decima[0].segundos_restantes).toBeLessThanOrEqual(15 * 60)
  })

  test('falhas fora da janela não contam', async () => {
    await falhas(10, 'velho@teste.local', null, VELHO)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['velho@teste.local', null])
    expect(r[0].bloqueado).toBe(false)
  })

  test('e-mail com maiúscula e espaço conta junto', async () => {
    await falhas(10, 'caixa@teste.local', null, RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['  Caixa@Teste.local ', null])
    expect(r[0].bloqueado).toBe(true)
  })

  test('30 falhas da origem, em e-mails diferentes, bloqueiam a origem', async () => {
    for (let i = 0; i < 30; i++) await falhas(1, `v${i}@teste.local`, '10.0.0.9', RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['novo@teste.local', '10.0.0.9'])
    expect(r[0].bloqueado).toBe(true)
  })

  test('acerto zera as falhas do e-mail e não zera as da origem', async () => {
    await falhas(5, 'zera@teste.local', '10.0.0.7', RECENTE)
    await falhas(30, 'outro@teste.local', '10.0.0.7', RECENTE)
    const acerto = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', ['zera@teste.local', '10.0.0.7', true])
    expect(acerto).toEqual([{ bloqueado: false, segundos_restantes: 0 }])
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'zera@teste.local' AND NOT sucesso",
    )
    expect(n).toBe(0)
    const origem = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['qualquer@teste.local', '10.0.0.7'])
    expect(origem[0].bloqueado).toBe(true)
  })

  test('origem nula conta só por e-mail', async () => {
    await falhas(30, 'so-email@teste.local', null, RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['outro-email@teste.local', null])
    expect(r[0].bloqueado).toBe(false)
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run --project integracao tests/integracao/funcoes-autenticacao.test.ts`
Expected: FAIL, `function autenticacao.credencial_por_email(text) does not exist`.

- [ ] **Step 8: Migração 0009**

`db/migracoes/0009_funcoes_autenticacao.sql`:

```sql
-- ver docs/db/0009.md
BEGIN;
CREATE FUNCTION autenticacao.credencial_por_email(p_email text)
RETURNS TABLE (usuario_id uuid, senha_hash text, ativo boolean, senha_provisoria_pendente boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.usuario_id, c.senha_hash, u.ativo, u.senha_provisoria_pendente
  FROM autenticacao.credencial c JOIN public.usuario u ON u.id = c.usuario_id
  WHERE u.email = lower(btrim(p_email))
$$;
CREATE FUNCTION autenticacao.bloqueio_login(p_email text, p_origem text)
RETURNS TABLE (bloqueado boolean, segundos_restantes integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c_limite_email constant integer := 10;
  c_limite_origem constant integer := 30;
  c_janela constant interval := interval '15 minutes';
  v_email text := lower(btrim(p_email));
  v_falhas_email integer;
  v_falhas_origem integer := 0;
  v_ultima timestamptz;
  v_ultima_origem timestamptz;
BEGIN
  SELECT count(*), max(t.ocorreu_em) INTO v_falhas_email, v_ultima
  FROM autenticacao.tentativa_login t
  WHERE t.email = v_email AND NOT t.sucesso AND t.ocorreu_em > now() - c_janela;
  IF p_origem IS NOT NULL THEN
    SELECT count(*), max(t.ocorreu_em) INTO v_falhas_origem, v_ultima_origem
    FROM autenticacao.tentativa_login t
    WHERE t.origem = p_origem AND NOT t.sucesso AND t.ocorreu_em > now() - c_janela;
    v_ultima := GREATEST(v_ultima, v_ultima_origem);
  END IF;
  IF v_falhas_email >= c_limite_email OR v_falhas_origem >= c_limite_origem THEN
    RETURN QUERY SELECT true, GREATEST(0, EXTRACT(EPOCH FROM (v_ultima + c_janela - now()))::integer);
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END
$$;
CREATE FUNCTION autenticacao.registrar_tentativa_login(p_email text, p_origem text, p_sucesso boolean)
RETURNS TABLE (bloqueado boolean, segundos_restantes integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
BEGIN
  INSERT INTO autenticacao.tentativa_login (email, origem, sucesso) VALUES (v_email, p_origem, p_sucesso);
  IF p_sucesso THEN
    DELETE FROM autenticacao.tentativa_login t WHERE t.email = v_email AND NOT t.sucesso;
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  RETURN QUERY SELECT b.bloqueado, b.segundos_restantes FROM autenticacao.bloqueio_login(v_email, p_origem) b;
END
$$;
CREATE FUNCTION autenticacao.sessao_criar(p_usuario_id uuid, p_token_hash text, p_expira_em timestamptz)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO autenticacao.sessao (usuario_id, token_hash, expira_em) VALUES (p_usuario_id, p_token_hash, p_expira_em)
$$;
CREATE FUNCTION autenticacao.sessao_atual(p_token_hash text)
RETURNS TABLE (usuario_id uuid, nome text, email text, papel text, senha_provisoria_pendente boolean, expira_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.nome, u.email, u.papel, u.senha_provisoria_pendente, s.expira_em
  FROM autenticacao.sessao s JOIN public.usuario u ON u.id = s.usuario_id
  WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND u.ativo
$$;
CREATE FUNCTION autenticacao.sessao_encerrar(p_token_hash text)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM autenticacao.sessao WHERE token_hash = p_token_hash
$$;
CREATE FUNCTION autenticacao.senha_trocar(p_token_hash text, p_hash_novo text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT s.usuario_id INTO v_usuario
  FROM autenticacao.sessao s JOIN public.usuario u ON u.id = s.usuario_id
  WHERE s.token_hash = p_token_hash AND s.expira_em > now() AND u.ativo;
  IF v_usuario IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE autenticacao.credencial SET senha_hash = p_hash_novo, atualizado_em = now() WHERE usuario_id = v_usuario;
  UPDATE public.usuario SET senha_provisoria_pendente = false WHERE id = v_usuario AND senha_provisoria_pendente;
  DELETE FROM autenticacao.sessao WHERE usuario_id = v_usuario AND token_hash <> p_token_hash;
  RETURN v_usuario;
END
$$;
REVOKE EXECUTE ON FUNCTION
  autenticacao.credencial_por_email(text),
  autenticacao.bloqueio_login(text, text),
  autenticacao.registrar_tentativa_login(text, text, boolean),
  autenticacao.sessao_criar(uuid, text, timestamptz),
  autenticacao.sessao_atual(text),
  autenticacao.sessao_encerrar(text),
  autenticacao.senha_trocar(text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  autenticacao.credencial_por_email(text),
  autenticacao.bloqueio_login(text, text),
  autenticacao.registrar_tentativa_login(text, text, boolean),
  autenticacao.sessao_criar(uuid, text, timestamptz),
  autenticacao.sessao_atual(text),
  autenticacao.sessao_encerrar(text),
  autenticacao.senha_trocar(text, text)
TO app_conexao;
COMMIT;
```

Atenção ao checador: nenhuma linha do corpo pode ser exatamente `BEGIN;`. O `BEGIN` do plpgsql não tem ponto e vírgula e passa. `END` com ponto e vírgula dentro de `IF ... END IF;` também passa.

- [ ] **Step 9: Doc 0009**

`docs/db/0009.md`:

```markdown
# 0009 — funções de autenticação

**O que cria.** Sete funções `SECURITY DEFINER SET search_path = ''` em
`autenticacao`, com `EXECUTE` só para `app_conexao`:

| Função | Faz |
|---|---|
| `credencial_por_email(email)` | hash e situação do usuário; único ponto onde hash sai do banco |
| `bloqueio_login(email, origem)` | conta falhas na janela; só lê |
| `registrar_tentativa_login(email, origem, sucesso)` | insere; acerto apaga as falhas do e-mail; devolve o bloqueio já contando esta |
| `sessao_criar(usuario_id, token_hash, expira_em)` | insere |
| `sessao_atual(token_hash)` | join com `usuario`; nada se expirada ou inativo |
| `sessao_encerrar(token_hash)` | apaga |
| `senha_trocar(token_hash, hash_novo)` | deriva o usuário da sessão; grava; zera a marca; apaga as outras sessões; nulo se não há sessão viva |

**Por quê.**

*Bloqueio separado do registro.* O bloqueio é lido **antes** do `scrypt`, e
a tentativa só é registrada **depois** de saber o resultado. Uma função só
faria as duas coisas na ordem errada. Limites: 10 por e-mail, 30 por origem,
15 minutos. Acerto zera só o e-mail: conta válida não pode zerar o contador
de varredura da própria origem.

*`sessao_atual` recusa inativo.* É a segunda barreira contra usuário
desativado; a primeira é `pode_ler()`. Cada uma tem teste isolado. Não
devolve `ativo` porque seria sempre verdadeiro.

*`senha_trocar` deriva o usuário do hash da sessão.* Se aceitasse
`usuario_id`, quem chama trocaria a senha de qualquer um. O Node exige a
senha atual antes de chamar. As outras sessões morrem porque troca por
suspeita de vazamento não pode deixar a sessão do atacante viva. O
`UPDATE public.usuario` roda como dona, então `atualizado_por` fica nulo:
foi o sistema, não um gestor.

*`sessao_criar` confia no `usuario_id`.* A senha é verificada no Node, e o
banco não tem como verificar por ele. Quem tem a `DATABASE_URL` cunha sessão
de qualquer um, do mesmo modo que já afirma identidade em `comoUsuario`. É
limitação conhecida, não descuido.

*`credencial_definir` não existe ainda.* Chamável por `app_conexao` sem
verificação, trocaria a senha de qualquer um. Entra na fatia de usuários,
com `eh_gestor()` por dentro. O seed grava a credencial direto, como admin.

**Depende de.** 0007 (tabelas) e 0008 (coluna).
```

- [ ] **Step 10: Checador e integração**

Run: `npm run db:checar && npm run test:integracao`
Expected: tudo PASS, inclusive `schema.test.ts` com as dez.

- [ ] **Step 11: Commit**

```bash
git add src/server/db/sem-identidade.ts src/server/db/sem-identidade.test.ts src/server/autenticacao/linhas.ts db/migracoes/0009_funcoes_autenticacao.sql docs/db/0009.md tests/integracao/ajuda.ts tests/integracao/funcoes-autenticacao.test.ts
git commit -m "0009 e chamar: funções de autenticação por mapa fechado"
```

---

### Task 3: Transição do primeiro acesso nas políticas

**Files:**
- Modify: `tests/integracao/politicas.test.ts`

**Interfaces:**
- Consumes: `chamar`, `criarUsuario`, `banco.comoUsuario`, `inserir`.

- [ ] **Step 1: Teste da transição**

No `describe('senha provisória pendente')` de `politicas.test.ts`, adicionar import `import { chamar } from '@/src/server/db/sem-identidade'` no topo e:

```ts
  test('transição do primeiro acesso: depois de senha_trocar, o mesmo gestor volta a escrever sem nova sessão', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Primeiro')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'provisoria'])
    await chamar('sessao_criar', [id, 'h-primeiro', new Date(Date.now() + 60_000)])
    await expect(
      banco.comoUsuario(id, (e) => e(inserir('Antes', 'antes@teste.local', 'vendedor'))),
    ).rejects.toMatchObject({ code: '42501' })
    await chamar('senha_trocar', ['h-primeiro', 'definitiva'])
    const depois = await banco.comoUsuario(id, (e) => e(inserir('Depois', 'depois@teste.local', 'vendedor')))
    expect(depois.afetadas).toBe(1)
    const altera = await banco.comoUsuario(id, (e) => e("UPDATE usuario SET nome = 'Alterado' WHERE id = $1", [vendedor]))
    expect(altera.afetadas).toBe(1)
  })
```

- [ ] **Step 2: Rodar**

Run: `npx vitest run --project integracao tests/integracao/politicas.test.ts`
Expected: PASS de primeira, porque `pode_escrever()` consulta a coluna a cada instrução. Se falhar no INSERT "Depois" com 42501, `senha_trocar` não zerou a marca: conferir a 0009.

- [ ] **Step 3: Commit**

```bash
git add tests/integracao/politicas.test.ts
git commit -m "teste: transição do primeiro acesso volta a escrever sem nova sessão"
```

---

### Task 4: `senha.ts`

**Files:**
- Create: `src/server/autenticacao/senha.ts`, `src/server/autenticacao/senha.test.ts`

**Interfaces:**
- Produces: `MINIMO = 8`, `MAXIMO = 128`, `gerarHash(senha): Promise<string>`, `verificarSenha(senha, hash): Promise<boolean>`, `type Falta = 'minimo' | 'maximo' | 'so_espaco' | 'igual_atual'`, `validarSenha(senha, atual?): { ok: true } | { ok: false; faltas: Falta[] }`, `gerarSenhaProvisoria(): string`, `hashDescartavel(): Promise<string>`.

- [ ] **Step 1: Testes**

`src/server/autenticacao/senha.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { gerarHash, gerarSenhaProvisoria, hashDescartavel, MAXIMO, validarSenha, verificarSenha } from './senha'

describe('gerarHash e verificarSenha', () => {
  test('formato scrypt$N=131072,r=8,p=1$sal$chave e verificação confere', async () => {
    const hash = await gerarHash('correta-123')
    expect(hash).toMatch(/^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    expect(await verificarSenha('correta-123', hash)).toBe(true)
    expect(await verificarSenha('errada-123', hash)).toBe(false)
  })

  test('mesma senha gera hashes diferentes (sal aleatório)', async () => {
    expect(await gerarHash('abcdefgh')).not.toBe(await gerarHash('abcdefgh'))
  })

  test('NFKC: formas Unicode equivalentes conferem', async () => {
    const hash = await gerarHash('café-senha')
    expect(await verificarSenha('café-senha', hash)).toBe(true)
  })

  test('hash malformado ou de algoritmo desconhecido não confere e não lança', async () => {
    expect(await verificarSenha('x', 'lixo')).toBe(false)
    expect(await verificarSenha('x', 'bcrypt$a$b$c')).toBe(false)
    expect(await verificarSenha('x', 'scrypt$N=abc,r=8,p=1$AAAA$BBBB')).toBe(false)
  })

  test('hashDescartavel é um hash real, reusado, que não confere com nada', async () => {
    const a = await hashDescartavel()
    expect(a).toBe(await hashDescartavel())
    expect(a).toMatch(/^scrypt\$/)
    expect(await verificarSenha('qualquer', a)).toBe(false)
  })
})

describe('validarSenha', () => {
  test('8 a 128 caracteres, não só espaço, diferente da atual', () => {
    expect(validarSenha('12345678')).toEqual({ ok: true })
    expect(validarSenha('1234567')).toEqual({ ok: false, faltas: ['minimo'] })
    expect(validarSenha('x'.repeat(MAXIMO + 1))).toEqual({ ok: false, faltas: ['maximo'] })
    expect(validarSenha('        ')).toEqual({ ok: false, faltas: ['so_espaco'] })
    expect(validarSenha('mesma-senha', 'mesma-senha')).toEqual({ ok: false, faltas: ['igual_atual'] })
    expect(validarSenha('       ', 'x')).toEqual({ ok: false, faltas: ['minimo', 'so_espaco'] })
  })
})

describe('gerarSenhaProvisoria', () => {
  test('três blocos de quatro, alfabeto sem 0 O 1 l I, passa na validação', () => {
    for (let i = 0; i < 50; i++) {
      const s = gerarSenhaProvisoria()
      expect(s).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
      expect(validarSenha(s)).toEqual({ ok: true })
    }
  })
})
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project unitario src/server/autenticacao/senha.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implementação**

`src/server/autenticacao/senha.ts`:

```ts
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt do node:crypto, sem biblioteca. Mínimos OWASP: N=2^17, r=8, p=1.
// maxmem PRECISA ser explícito: o padrão do Node é 32 MiB e estes parâmetros
// exigem 128 MiB; sem ele a chamada falha com "Invalid scrypt params".
const N = 2 ** 17
const R = 8
const P = 1
const maxmemPara = (n: number, r: number) => 128 * n * r * 2
const BYTES_SAL = 16
const BYTES_CHAVE = 32

export const MINIMO = 8
// O máximo existe para ninguém mandar um megabyte para o scrypt.
export const MAXIMO = 128

function derivar(senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, opcoes, (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)))
  })
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(BYTES_SAL)
  const chave = await derivar(senha.normalize('NFKC'), sal, BYTES_CHAVE, { N, r: R, p: P, maxmem: maxmemPara(N, R) })
  return `scrypt$N=${N},r=${R},p=${P}$${sal.toString('base64')}$${chave.toString('base64')}`
}

// Formato com parâmetros dentro: mudar N depois não invalida hash antigo.
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const [algoritmo, parametros, salB64, chaveB64] = hash.split('$')
  if (algoritmo !== 'scrypt' || !parametros || !salB64 || !chaveB64) return false
  const p: Record<string, number> = {}
  for (const par of parametros.split(',')) {
    const [k, v] = par.split('=')
    p[k] = Number(v)
  }
  if (!Number.isInteger(p.N) || !Number.isInteger(p.r) || !Number.isInteger(p.p) || p.N <= 0) return false
  const sal = Buffer.from(salB64, 'base64')
  const esperada = Buffer.from(chaveB64, 'base64')
  if (esperada.length === 0) return false
  let obtida: Buffer
  try {
    obtida = await derivar(senha.normalize('NFKC'), sal, esperada.length, { N: p.N, r: p.r, p: p.p, maxmem: maxmemPara(p.N, p.r) })
  } catch {
    return false
  }
  return obtida.length === esperada.length && timingSafeEqual(obtida, esperada)
}

export type Falta = 'minimo' | 'maximo' | 'so_espaco' | 'igual_atual'

export function validarSenha(senha: string, atual?: string): { ok: true } | { ok: false; faltas: Falta[] } {
  const faltas: Falta[] = []
  if (senha.length < MINIMO) faltas.push('minimo')
  if (senha.length > MAXIMO) faltas.push('maximo')
  if (senha.trim().length === 0) faltas.push('so_espaco')
  if (atual !== undefined && senha === atual) faltas.push('igual_atual')
  return faltas.length ? { ok: false, faltas } : { ok: true }
}

// Sem 0 O 1 l I, para ler de um papel sem confundir.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function gerarSenhaProvisoria(): string {
  const bloco = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
  return `${bloco()}-${bloco()}-${bloco()}`
}

// Hash real de uma senha aleatória, gerado uma vez por processo. Verificado
// quando o e-mail não existe, para o tempo ser o mesmo de uma senha errada.
let descartavel: Promise<string> | undefined
export function hashDescartavel(): Promise<string> {
  descartavel ??= gerarHash(randomBytes(16).toString('hex'))
  return descartavel
}
```

- [ ] **Step 4: Ver passar**

Run: `npx vitest run --project unitario src/server/autenticacao/senha.test.ts`
Expected: PASS. Cada `gerarHash` custa ~300ms; o arquivo leva alguns segundos.

- [ ] **Step 5: Commit**

```bash
git add src/server/autenticacao/senha.ts src/server/autenticacao/senha.test.ts
git commit -m "senha: scrypt, validação, provisória, hash descartável"
```

---

### Task 5: `sessao.ts` e harness com senha

**Files:**
- Create: `src/server/autenticacao/sessao.ts`, `src/server/autenticacao/sessao.test.ts`
- Modify: `tests/integracao/ajuda.ts`
- Create: `tests/integracao/sessao.test.ts`

**Interfaces:**
- Consumes: `chamar`, `LinhaSessao`, `Papel`, `gerarHash`.
- Produces: `DIAS_VALIDADE = 30`, `type Sessao = { usuarioId: string; nome: string; email: string; papel: Papel; senhaProvisoriaPendente: boolean; expiraEm: Date }`, `gerarToken(): string`, `hashDoToken(token): string`, `criarSessao(usuarioId): Promise<{ token: string; expiraEm: Date }>`, `lerSessao(token): Promise<Sessao | null>`, `encerrarSessao(token): Promise<void>`. Harness: `criarUsuarioComSenha(banco, papel, apelido, senha, opcoes?: { pendente?: boolean }): Promise<{ id: string; email: string }>`.

- [ ] **Step 1: Unitário**

`src/server/autenticacao/sessao.test.ts`:

```ts
import { expect, test } from 'vitest'
import { gerarToken, hashDoToken } from './sessao'

test('token: 32 bytes em base64url, sem padding, sempre diferente', () => {
  const a = gerarToken()
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(gerarToken()).not.toBe(a)
})

test('hash do token é sha256 hex, determinístico', () => {
  expect(hashDoToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(hashDoToken('abc')).toBe(hashDoToken('abc'))
})
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project unitario src/server/autenticacao/sessao.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: `sessao.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto'
import { chamar } from '../db/sem-identidade'
import type { LinhaSessao, Papel } from './linhas'

export const DIAS_VALIDADE = 30

export type Sessao = {
  usuarioId: string
  nome: string
  email: string
  papel: Papel
  senhaProvisoriaPendente: boolean
  expiraEm: Date
}

export function gerarToken(): string {
  return randomBytes(32).toString('base64url')
}

// SHA-256 puro, sem KDF, de propósito. O token tem 256 bits de aleatoriedade;
// KDF lenta (scrypt) serve para entrada de baixa entropia, que é senha humana.
// Aqui só se precisa que ler o hash não dê o token: resistência a pré-imagem.
// scrypt custaria 300ms por requisição para proteção nenhuma. Não "melhorar".
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function criarSessao(usuarioId: string): Promise<{ token: string; expiraEm: Date }> {
  const token = gerarToken()
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 60 * 60 * 1000)
  await chamar('sessao_criar', [usuarioId, hashDoToken(token), expiraEm])
  return { token, expiraEm }
}

export async function lerSessao(token: string): Promise<Sessao | null> {
  const [l] = await chamar<'sessao_atual', LinhaSessao>('sessao_atual', [hashDoToken(token)])
  if (!l) return null
  return {
    usuarioId: l.usuario_id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    senhaProvisoriaPendente: l.senha_provisoria_pendente,
    expiraEm: l.expira_em,
  }
}

export async function encerrarSessao(token: string): Promise<void> {
  await chamar('sessao_encerrar', [hashDoToken(token)])
}
```

- [ ] **Step 4: Unitário passa**

Run: `npx vitest run --project unitario src/server/autenticacao/sessao.test.ts`
Expected: PASS.

- [ ] **Step 5: Harness**

Em `tests/integracao/ajuda.ts`, import `import { gerarHash } from '@/src/server/autenticacao/senha'` e no fim:

```ts
// Usuário com credencial, criado como dona. Para testes de login e troca.
export async function criarUsuarioComSenha(
  banco: BancoDeTeste,
  papel: 'vendedor' | 'gestor',
  apelido: string,
  senha: string,
  opcoes: { pendente?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const email = `${apelido.toLowerCase()}@teste.local`
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, $3, $4) RETURNING id',
    [apelido, email, papel, opcoes.pendente ?? false],
  )
  await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, await gerarHash(senha)])
  return { id, email }
}
```

- [ ] **Step 6: Integração de sessão**

`tests/integracao/sessao.test.ts`:

```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarSessao, encerrarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let id: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  ;({ id } = await criarUsuarioComSenha(banco, 'gestor', 'Gestora', 'senha-forte-1'))
})
afterAll(async () => {
  await banco.derrubar()
})

test('criar, ler e encerrar; o banco guarda o hash, não o token', async () => {
  const { token, expiraEm } = await criarSessao(id)
  const s = await lerSessao(token)
  expect(s).toMatchObject({ usuarioId: id, nome: 'Gestora', email: 'gestora@teste.local', papel: 'gestor', senhaProvisoriaPendente: false })
  expect(s?.expiraEm.getTime()).toBe(expiraEm.getTime())
  const linhas = await banco.sql<{ token_hash: string }>('SELECT token_hash FROM autenticacao.sessao WHERE usuario_id = $1', [id])
  expect(linhas).toHaveLength(1)
  expect(linhas[0].token_hash).not.toBe(token)
  expect(linhas[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
  await encerrarSessao(token)
  expect(await lerSessao(token)).toBeNull()
})

test('token desconhecido resolve nulo', async () => {
  expect(await lerSessao('nao-existe')).toBeNull()
})
```

- [ ] **Step 7: Rodar**

Run: `npx vitest run --project integracao tests/integracao/sessao.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/autenticacao/sessao.ts src/server/autenticacao/sessao.test.ts tests/integracao/ajuda.ts tests/integracao/sessao.test.ts
git commit -m "sessão: token, hash e ciclo de vida via chamar"
```

---

### Task 6: `entrar.ts`

**Files:**
- Create: `src/server/autenticacao/entrar.ts`
- Create: `tests/integracao/entrar.test.ts`

**Interfaces:**
- Consumes: `chamar`, `LinhaBloqueio`, `LinhaCredencial`, `hashDescartavel`, `MAXIMO`, `verificarSenha`, `criarSessao`, `criarUsuarioComSenha`.
- Produces: `normalizarEmail(email): string`, `type ResultadoEntrar = { ok: true; token: string; expiraEm: Date; precisaTrocarSenha: boolean } | { ok: false; motivo: 'credenciais_invalidas' } | { ok: false; motivo: 'bloqueado'; segundosRestantes: number }`, `entrar({ email, senha, origem }): Promise<ResultadoEntrar>`.

- [ ] **Step 1: Testes**

`tests/integracao/entrar.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { lerSessao } from '@/src/server/autenticacao/sessao'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  await criarUsuarioComSenha(banco, 'vendedor', 'Ana', 'senha-da-ana')
  await criarUsuarioComSenha(banco, 'gestor', 'Novo', 'provisoria-1', { pendente: true })
  const inativo = await criarUsuarioComSenha(banco, 'vendedor', 'Saiu', 'senha-do-saiu')
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [inativo.id])
})
afterAll(async () => {
  await banco.derrubar()
})

const INVALIDAS = { ok: false, motivo: 'credenciais_invalidas' }

describe('entrar', () => {
  test('senha certa: sessão criada e precisaTrocarSenha falso', async () => {
    const r = await entrar({ email: ' Ana@Teste.local ', senha: 'senha-da-ana', origem: '10.0.0.1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.precisaTrocarSenha).toBe(false)
    expect(r.expiraEm.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
    expect(await lerSessao(r.token)).toMatchObject({ nome: 'Ana' })
  })

  test('senha provisória pendente: entra e precisaTrocarSenha verdadeiro', async () => {
    const r = await entrar({ email: 'novo@teste.local', senha: 'provisoria-1', origem: null })
    expect(r).toMatchObject({ ok: true, precisaTrocarSenha: true })
  })

  test('senha errada, e-mail inexistente e usuário inativo respondem o mesmo', async () => {
    expect(await entrar({ email: 'ana@teste.local', senha: 'errada-123', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'ninguem@teste.local', senha: 'qualquer-1', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'saiu@teste.local', senha: 'senha-do-saiu', origem: null })).toEqual(INVALIDAS)
  })

  test('senha vazia ou longa demais: inválida sem tocar o banco (nenhuma tentativa registrada)', async () => {
    expect(await entrar({ email: 'ana@teste.local', senha: '', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'ana@teste.local', senha: 'x'.repeat(129), origem: null })).toEqual(INVALIDAS)
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'ana@teste.local' AND NOT sucesso",
    )
    expect(n).toBe(1)
  })

  test('tempo de e-mail inexistente e de senha errada na mesma ordem de grandeza (hash descartável roda)', async () => {
    const medir = async (email: string) => {
      const t = performance.now()
      await entrar({ email, senha: 'senha-errada-9', origem: null })
      return performance.now() - t
    }
    await medir('ana@teste.local')
    const errada = await medir('ana@teste.local')
    const inexistente = await medir('fantasma@teste.local')
    expect(inexistente).toBeGreaterThan(errada / 4)
    expect(inexistente).toBeLessThan(errada * 4)
  })

  test('décima falha bloqueia com segundos; bloqueado não roda scrypt nem registra', async () => {
    await criarUsuarioComSenha(banco, 'vendedor', 'Alvo', 'senha-do-alvo')
    let ultimo: Awaited<ReturnType<typeof entrar>> = INVALIDAS as never
    for (let i = 0; i < 10; i++) ultimo = await entrar({ email: 'alvo@teste.local', senha: 'errada-000', origem: '10.0.0.5' })
    expect(ultimo).toMatchObject({ ok: false, motivo: 'bloqueado' })
    if (ultimo.ok || ultimo.motivo !== 'bloqueado') return
    expect(ultimo.segundosRestantes).toBeGreaterThan(14 * 60)
    const t = performance.now()
    const certa = await entrar({ email: 'alvo@teste.local', senha: 'senha-do-alvo', origem: '10.0.0.5' })
    expect(performance.now() - t).toBeLessThan(150)
    expect(certa).toMatchObject({ ok: false, motivo: 'bloqueado' })
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'alvo@teste.local'",
    )
    expect(n).toBe(10)
  })
})
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project integracao tests/integracao/entrar.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: `entrar.ts`**

```ts
import { chamar } from '../db/sem-identidade'
import type { LinhaBloqueio, LinhaCredencial } from './linhas'
import { hashDescartavel, MAXIMO, verificarSenha } from './senha'
import { criarSessao } from './sessao'

export type ResultadoEntrar =
  | { ok: true; token: string; expiraEm: Date; precisaTrocarSenha: boolean }
  | { ok: false; motivo: 'credenciais_invalidas' }
  | { ok: false; motivo: 'bloqueado'; segundosRestantes: number }

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

const INVALIDAS: ResultadoEntrar = { ok: false, motivo: 'credenciais_invalidas' }
const bloqueado = (b: LinhaBloqueio): ResultadoEntrar => ({ ok: false, motivo: 'bloqueado', segundosRestantes: b.segundos_restantes })

// Ordem importa: bloqueio antes do scrypt; registro depois de saber o resultado.
// E-mail inexistente, senha errada e usuário inativo respondem o mesmo, no
// mesmo tempo: o hash descartável roda quando não há credencial.
export async function entrar(dados: { email: string; senha: string; origem: string | null }): Promise<ResultadoEntrar> {
  const email = normalizarEmail(dados.email)
  const { senha, origem } = dados
  if (!email || !senha || senha.length > MAXIMO) return INVALIDAS

  const [antes] = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', [email, origem])
  if (antes.bloqueado) return bloqueado(antes)

  const [credencial] = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', [email])
  const confere = await verificarSenha(senha, credencial?.senha_hash ?? (await hashDescartavel()))
  const sucesso = confere && credencial !== undefined && credencial.ativo

  const [depois] = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', [email, origem, sucesso])
  if (!sucesso || !credencial) return depois.bloqueado ? bloqueado(depois) : INVALIDAS

  const { token, expiraEm } = await criarSessao(credencial.usuario_id)
  return { ok: true, token, expiraEm, precisaTrocarSenha: credencial.senha_provisoria_pendente }
}
```

- [ ] **Step 4: Ver passar**

Run: `npx vitest run --project integracao tests/integracao/entrar.test.ts`
Expected: PASS. O teste de tempo é o mais sensível: se falhar por margem, o `hashDescartavel` não está sendo verificado no caminho de e-mail inexistente.

- [ ] **Step 5: Commit**

```bash
git add src/server/autenticacao/entrar.ts tests/integracao/entrar.test.ts
git commit -m "entrar: regra de login com bloqueio, hash descartável e sessão"
```

---

### Task 7: `trocar-senha.ts`

**Files:**
- Create: `src/server/autenticacao/trocar-senha.ts`
- Create: `tests/integracao/trocar-senha.test.ts`

**Interfaces:**
- Consumes: `chamar`, `LinhaCredencial`, `LinhaSenhaTrocar`, `validarSenha`, `verificarSenha`, `gerarHash`, `Falta`, `lerSessao`, `hashDoToken`, `entrar`, `criarSessao`.
- Produces: `type ResultadoTrocar = { ok: true } | { ok: false; motivo: 'senha_fraca'; faltas: Falta[] } | { ok: false; motivo: 'senha_atual_invalida' } | { ok: false; motivo: 'sem_sessao' }`, `trocarSenha({ token, senhaAtual, senhaNova }): Promise<ResultadoTrocar>`.

- [ ] **Step 1: Testes**

`tests/integracao/trocar-senha.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { criarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
import { trocarSenha } from '@/src/server/autenticacao/trocar-senha'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let id: string
let token: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  ;({ id } = await criarUsuarioComSenha(banco, 'gestor', 'Gestora', 'provisoria-1', { pendente: true }))
  ;({ token } = await criarSessao(id))
})
afterAll(async () => {
  await banco.derrubar()
})

describe('trocarSenha', () => {
  test('senha fraca: faltas nomeadas, sem tocar a credencial', async () => {
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'curta' })).toEqual({ ok: false, motivo: 'senha_fraca', faltas: ['minimo'] })
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'provisoria-1' })).toEqual({ ok: false, motivo: 'senha_fraca', faltas: ['igual_atual'] })
  })

  test('sem sessão', async () => {
    expect(await trocarSenha({ token: 'nao-existe', senhaAtual: 'provisoria-1', senhaNova: 'definitiva-1' })).toEqual({ ok: false, motivo: 'sem_sessao' })
  })

  test('senha atual errada', async () => {
    expect(await trocarSenha({ token, senhaAtual: 'errada-123', senhaNova: 'definitiva-1' })).toEqual({ ok: false, motivo: 'senha_atual_invalida' })
  })

  test('sucesso: nova entra, antiga não, marca cai, outra sessão morre e a atual vive', async () => {
    const outra = await criarSessao(id)
    expect(await trocarSenha({ token, senhaAtual: 'provisoria-1', senhaNova: 'definitiva-1' })).toEqual({ ok: true })
    expect(await lerSessao(token)).toMatchObject({ senhaProvisoriaPendente: false })
    expect(await lerSessao(outra.token)).toBeNull()
    expect(await entrar({ email: 'gestora@teste.local', senha: 'provisoria-1', origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
    expect(await entrar({ email: 'gestora@teste.local', senha: 'definitiva-1', origem: null })).toMatchObject({ ok: true, precisaTrocarSenha: false })
  })
})
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project integracao tests/integracao/trocar-senha.test.ts`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: `trocar-senha.ts`**

```ts
import { chamar } from '../db/sem-identidade'
import type { LinhaCredencial, LinhaSenhaTrocar } from './linhas'
import { gerarHash, validarSenha, verificarSenha, type Falta } from './senha'
import { hashDoToken, lerSessao } from './sessao'

export type ResultadoTrocar =
  | { ok: true }
  | { ok: false; motivo: 'senha_fraca'; faltas: Falta[] }
  | { ok: false; motivo: 'senha_atual_invalida' }
  | { ok: false; motivo: 'sem_sessao' }

// A senha atual é exigida para uma sessão roubada não virar troca de senha.
// O banco deriva o usuário da sessão: só troca a senha de quem a tem em mãos.
export async function trocarSenha(dados: { token: string; senhaAtual: string; senhaNova: string }): Promise<ResultadoTrocar> {
  const validacao = validarSenha(dados.senhaNova, dados.senhaAtual)
  if (!validacao.ok) return { ok: false, motivo: 'senha_fraca', faltas: validacao.faltas }

  const sessao = await lerSessao(dados.token)
  if (!sessao) return { ok: false, motivo: 'sem_sessao' }

  const [credencial] = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', [sessao.email])
  if (!credencial || !(await verificarSenha(dados.senhaAtual, credencial.senha_hash))) {
    return { ok: false, motivo: 'senha_atual_invalida' }
  }

  const [r] = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', [hashDoToken(dados.token), await gerarHash(dados.senhaNova)])
  if (!r.senha_trocar) return { ok: false, motivo: 'sem_sessao' }
  return { ok: true }
}
```

- [ ] **Step 4: Ver passar**

Run: `npx vitest run --project integracao tests/integracao/trocar-senha.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/autenticacao/trocar-senha.ts tests/integracao/trocar-senha.test.ts
git commit -m "trocar senha: exige a atual, deriva o usuário da sessão"
```

---

### Task 8: Seed com senha provisória

**Files:**
- Modify: `src/server/db/seed.ts`, `scripts/db/seed-gestor.mts`
- Modify: `tests/integracao/seed.test.ts`

**Interfaces:**
- Consumes: `comAdmin`, `gerarHash`, `gerarSenhaProvisoria`, `entrar`.
- Produces: `criarPrimeiroGestor(urlAdmin, { nome, email }): Promise<{ ok: true; id: string; senhaProvisoria: string } | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }>`.

- [ ] **Step 1: Teste**

`tests/integracao/seed.test.ts`, o primeiro teste vira:

```ts
test('cria o primeiro gestor com credencial provisória; a senha devolvida entra e exige troca', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Alexandre', email: '  Alex@Exemplo.com ' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.senhaProvisoria).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
  const [l] = await banco.sql<{ email: string; papel: string; criado_por: string | null; pendente: boolean }>(
    'SELECT email, papel, criado_por, senha_provisoria_pendente AS pendente FROM usuario',
  )
  expect(l).toEqual({ email: 'alex@exemplo.com', papel: 'gestor', criado_por: null, pendente: true })
  const cred = await banco.sql('SELECT 1 FROM autenticacao.credencial WHERE usuario_id = $1', [r.id])
  expect(cred).toHaveLength(1)
  const login = await entrar({ email: 'alex@exemplo.com', senha: r.senhaProvisoria, origem: null })
  expect(login).toMatchObject({ ok: true, precisaTrocarSenha: true })
})
```

Com `import { entrar } from '@/src/server/autenticacao/entrar'` no topo. Os outros dois testes ficam.

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project integracao tests/integracao/seed.test.ts`
Expected: FAIL, `senhaProvisoria` indefinida.

- [ ] **Step 3: `seed.ts`**

```ts
import { gerarHash, gerarSenhaProvisoria } from '../autenticacao/senha'
import { comAdmin } from './admin'

type Resultado =
  | { ok: true; id: string; senhaProvisoria: string }
  | { ok: false; motivo: 'ja_existe_gestor_ativo' | 'email_invalido' }

// Roda como admin, sem identidade: criado_por fica nulo de propósito.
// Nunca pelo pool.ts: a guarda de papel derrubaria o processo.
// Grava a credencial direto na tabela: credencial_definir só entra na fatia
// de usuários, com eh_gestor() por dentro.
export async function criarPrimeiroGestor(urlAdmin: string, dados: { nome: string; email: string }): Promise<Resultado> {
  const email = dados.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, motivo: 'email_invalido' }
  const senhaProvisoria = gerarSenhaProvisoria()
  const hash = await gerarHash(senhaProvisoria)
  return comAdmin(urlAdmin, async (c) => {
    const existe = await c.query("SELECT 1 FROM usuario WHERE papel = 'gestor' AND ativo LIMIT 1")
    if (existe.rowCount) return { ok: false, motivo: 'ja_existe_gestor_ativo' }
    await c.query('BEGIN')
    try {
      const { rows } = await c.query<{ id: string }>(
        "INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, 'gestor', true) RETURNING id",
        [dados.nome.trim(), email],
      )
      await c.query('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [rows[0].id, hash])
      await c.query('COMMIT')
      return { ok: true, id: rows[0].id, senhaProvisoria }
    } catch (erro) {
      await c.query('ROLLBACK')
      throw erro
    }
  })
}
```

- [ ] **Step 4: CLI**

`scripts/db/seed-gestor.mts`:

```ts
import { criarPrimeiroGestor } from '../../src/server/db/seed'
import { sair, urlDe } from './env.mts'

const [nome, email] = process.argv.slice(2)
if (!nome || !email) sair(false, 'uso: npm run db:seed:gestor -- "Nome" email@dominio')
const r = await criarPrimeiroGestor(urlDe('DATABASE_URL_ADMIN'), { nome, email })
if (!r.ok) sair(false, `não criado: ${r.motivo}`)
// A senha vai SOZINHA no stdout, para copiar ou redirecionar sem arrastar nada.
// Tudo o mais vai no stderr.
console.error(`gestor criado: ${r.id}`)
console.error('Senha provisória abaixo. Não será mostrada de novo. O primeiro login exige a troca.')
process.stdout.write(`${r.senhaProvisoria}\n`)
process.exit(0)
```

- [ ] **Step 5: Ver passar**

Run: `npx vitest run --project integracao tests/integracao/seed.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/seed.ts scripts/db/seed-gestor.mts tests/integracao/seed.test.ts
git commit -m "seed: gestor com senha provisória, senha sozinha no stdout"
```

---

### Task 9: Módulos puros de borda: acesso, rota, cookie, origem, mensagens

**Files:**
- Create: `src/server/autenticacao/acesso.ts`, `acesso.test.ts`
- Create: `src/server/autenticacao/rota.ts`, `rota.test.ts`
- Create: `src/server/autenticacao/cookie.ts`
- Create: `src/server/autenticacao/origem.ts`, `origem.test.ts`
- Create: `src/server/autenticacao/mensagens.ts`, `mensagens.test.ts`

**Interfaces:**
- Consumes: `Sessao`, `ResultadoEntrar`, `ResultadoTrocar`.
- Produces:
  - `type Exigencia = 'sessao' | 'usuario' | 'gestor'`, `type Acesso = { ok: true; usuario: Sessao } | { ok: false; motivo: 'sem_sessao' | 'senha_provisoria' | 'so_gestor'; destino: string }`, `avaliarAcesso(sessao: Sessao | null, exigencia: Exigencia): Acesso`.
  - `ROTAS_PUBLICAS = ['/login']`, `decidirRota(caminho: string, temCookie: boolean): string | null`.
  - `COOKIE_SESSAO = 'crm_sessao'`, `opcoesCookie(expiraEm: Date)`.
  - `origemDe(headers: Headers): string | null`.
  - `mensagemDeLogin(r: ResultadoEntrar & { ok: false }): string`, `mensagemDeTroca(r: ResultadoTrocar & { ok: false }): string`.

- [ ] **Step 1: Testes**

`acesso.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { avaliarAcesso } from './acesso'
import type { Sessao } from './sessao'

const sessao = (extra: Partial<Sessao> = {}): Sessao => ({
  usuarioId: 'u', nome: 'N', email: 'n@x', papel: 'vendedor', senhaProvisoriaPendente: false, expiraEm: new Date(), ...extra,
})

describe('avaliarAcesso', () => {
  test('sem sessão: /login em qualquer exigência', () => {
    for (const ex of ['sessao', 'usuario', 'gestor'] as const) {
      expect(avaliarAcesso(null, ex)).toEqual({ ok: false, motivo: 'sem_sessao', destino: '/login' })
    }
  })

  test('pendente: só "sessao" passa; o resto vai para /trocar-senha', () => {
    const s = sessao({ senhaProvisoriaPendente: true, papel: 'gestor' })
    expect(avaliarAcesso(s, 'sessao')).toEqual({ ok: true, usuario: s })
    expect(avaliarAcesso(s, 'usuario')).toEqual({ ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' })
    expect(avaliarAcesso(s, 'gestor')).toEqual({ ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' })
  })

  test('vendedor em exigência gestor vai para /', () => {
    expect(avaliarAcesso(sessao(), 'gestor')).toEqual({ ok: false, motivo: 'so_gestor', destino: '/' })
  })

  test('gestor sem pendência passa em tudo', () => {
    const g = sessao({ papel: 'gestor' })
    for (const ex of ['sessao', 'usuario', 'gestor'] as const) expect(avaliarAcesso(g, ex)).toEqual({ ok: true, usuario: g })
  })
})
```

`rota.test.ts`:

```ts
import { expect, test } from 'vitest'
import { decidirRota } from './rota'

test('sem cookie: rota protegida vai para /login; pública passa', () => {
  expect(decidirRota('/', false)).toBe('/login')
  expect(decidirRota('/usuarios/abc', false)).toBe('/login')
  expect(decidirRota('/login', false)).toBeNull()
  expect(decidirRota('/login/', false)).toBeNull()
  expect(decidirRota('/loginx', false)).toBe('/login')
})

test('com cookie: nunca redireciona; quem decide é a página', () => {
  expect(decidirRota('/', true)).toBeNull()
  expect(decidirRota('/login', true)).toBeNull()
})
```

`origem.test.ts`:

```ts
import { expect, test } from 'vitest'
import { origemDe } from './origem'

test('primeiro endereço de x-forwarded-for, senão x-real-ip, senão nulo', () => {
  expect(origemDe(new Headers({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' }))).toBe('203.0.113.9')
  expect(origemDe(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  expect(origemDe(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  expect(origemDe(new Headers())).toBeNull()
})
```

`mensagens.test.ts`:

```ts
import { expect, test } from 'vitest'
import { mensagemDeLogin, mensagemDeTroca } from './mensagens'

test('login: inválidas e bloqueado com minutos arredondados para cima', () => {
  expect(mensagemDeLogin({ ok: false, motivo: 'credenciais_invalidas' })).toBe('E-mail ou senha não conferem.')
  expect(mensagemDeLogin({ ok: false, motivo: 'bloqueado', segundosRestantes: 61 })).toBe('Muitas tentativas. Tente de novo em 2 minutos.')
  expect(mensagemDeLogin({ ok: false, motivo: 'bloqueado', segundosRestantes: 30 })).toBe('Muitas tentativas. Tente de novo em 1 minuto.')
})

test('troca: faltas em texto, senha atual, sem sessão', () => {
  expect(mensagemDeTroca({ ok: false, motivo: 'senha_fraca', faltas: ['minimo', 'igual_atual'] })).toBe(
    'A nova senha precisa ter pelo menos 8 caracteres e ser diferente da atual.',
  )
  expect(mensagemDeTroca({ ok: false, motivo: 'senha_atual_invalida' })).toBe('A senha atual não confere.')
  expect(mensagemDeTroca({ ok: false, motivo: 'sem_sessao' })).toBe('Sua sessão acabou. Entre de novo.')
})
```

- [ ] **Step 2: Ver falhar**

Run: `npx vitest run --project unitario src/server/autenticacao`
Expected: FAIL nos quatro arquivos novos, módulo não existe.

- [ ] **Step 3: Implementações**

`acesso.ts`:

```ts
import type { Sessao } from './sessao'

export type Exigencia = 'sessao' | 'usuario' | 'gestor'
export type Acesso =
  | { ok: true; usuario: Sessao }
  | { ok: false; motivo: 'sem_sessao' | 'senha_provisoria' | 'so_gestor'; destino: string }

// Pura: quem redireciona é guarda.ts. `sessao` aceita pendente, para a
// própria tela de troca; `usuario` e `gestor` não.
export function avaliarAcesso(sessao: Sessao | null, exigencia: Exigencia): Acesso {
  if (!sessao) return { ok: false, motivo: 'sem_sessao', destino: '/login' }
  if (exigencia === 'sessao') return { ok: true, usuario: sessao }
  if (sessao.senhaProvisoriaPendente) return { ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' }
  if (exigencia === 'gestor' && sessao.papel !== 'gestor') return { ok: false, motivo: 'so_gestor', destino: '/' }
  return { ok: true, usuario: sessao }
}
```

`rota.ts`:

```ts
export const ROTAS_PUBLICAS = ['/login']

// Só presença do cookie. Cookie inválido passa e a página resolve; o proxy
// nunca manda /login para /, senão cookie inválido vira loop.
export function decidirRota(caminho: string, temCookie: boolean): string | null {
  const publica = ROTAS_PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`))
  if (!temCookie && !publica) return '/login'
  return null
}
```

`cookie.ts`:

```ts
export const COOKIE_SESSAO = 'crm_sessao'

export function opcoesCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraEm,
  }
}
```

`origem.ts`:

```ts
// Na Vercel o primeiro valor de x-forwarded-for é o cliente. Sem cabeçalho,
// nulo: o limite de tentativas conta só por e-mail.
export function origemDe(headers: Headers): string | null {
  const encaminhado = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (encaminhado) return encaminhado
  const real = headers.get('x-real-ip')?.trim()
  return real || null
}
```

`mensagens.ts`:

```ts
import type { ResultadoEntrar } from './entrar'
import type { Falta } from './senha'
import type { ResultadoTrocar } from './trocar-senha'

export function mensagemDeLogin(r: Extract<ResultadoEntrar, { ok: false }>): string {
  if (r.motivo === 'credenciais_invalidas') return 'E-mail ou senha não conferem.'
  const minutos = Math.max(1, Math.ceil(r.segundosRestantes / 60))
  return `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`
}

const TEXTO_DA_FALTA: Record<Falta, string> = {
  minimo: 'ter pelo menos 8 caracteres',
  maximo: 'ter no máximo 128 caracteres',
  so_espaco: 'ter algum caractere que não seja espaço',
  igual_atual: 'ser diferente da atual',
}

export function mensagemDeTroca(r: Extract<ResultadoTrocar, { ok: false }>): string {
  if (r.motivo === 'senha_atual_invalida') return 'A senha atual não confere.'
  if (r.motivo === 'sem_sessao') return 'Sua sessão acabou. Entre de novo.'
  const partes = r.faltas.map((f) => TEXTO_DA_FALTA[f])
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
  return `A nova senha precisa ${lista}.`
}
```

- [ ] **Step 4: Ver passar**

Run: `npx vitest run --project unitario src/server/autenticacao`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/autenticacao/acesso.ts src/server/autenticacao/acesso.test.ts src/server/autenticacao/rota.ts src/server/autenticacao/rota.test.ts src/server/autenticacao/cookie.ts src/server/autenticacao/origem.ts src/server/autenticacao/origem.test.ts src/server/autenticacao/mensagens.ts src/server/autenticacao/mensagens.test.ts
git commit -m "acesso, rota, cookie, origem e mensagens: módulos puros da borda"
```

---

### Task 10: Guarda, proxy, telas e actions

**Files:**
- Create: `src/server/autenticacao/guarda.ts`
- Create: `proxy.ts`
- Create: `app/login/page.tsx`, `app/login/formulario.tsx`, `app/login/acao.ts`
- Create: `app/trocar-senha/page.tsx`, `app/trocar-senha/formulario.tsx`, `app/trocar-senha/acao.ts`
- Create: `app/sair/route.ts`
- Modify: `app/page.tsx`, `app/layout.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 5 a 9.
- Produces: `usuarioAtual(): Promise<Sessao | null>`, `exigir(exigencia: Exigencia): Promise<Sessao>`; `entrarAcao`, `trocarSenhaAcao` como server actions com estado `{ erro: string | null }`.

Sem teste automatizado nesta tarefa, por decisão da spec (seção 3). O que garante é `npm run typecheck`, `npm run lint`, `npm run build`, e a verificação manual da Task 11.

- [ ] **Step 1: `guarda.ts`**

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { avaliarAcesso, type Exigencia } from './acesso'
import { COOKIE_SESSAO } from './cookie'
import { lerSessao, type Sessao } from './sessao'

// Uma ida ao banco por requisição: cache() do React deduplica dentro do render.
export const usuarioAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) return null
  return lerSessao(token)
})

// Não apaga cookie inválido: página não pode mexer em cookie. O próximo login
// sobrescreve, ou /sair apaga.
export async function exigir(exigencia: Exigencia): Promise<Sessao> {
  const acesso = avaliarAcesso(await usuarioAtual(), exigencia)
  if (acesso.ok) return acesso.usuario
  redirect(acesso.destino)
}
```

- [ ] **Step 2: `proxy.ts`** na raiz do projeto

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { decidirRota } from '@/src/server/autenticacao/rota'

export function proxy(request: NextRequest) {
  const destino = decidirRota(request.nextUrl.pathname, request.cookies.has(COOKIE_SESSAO))
  if (!destino) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = destino
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
```

- [ ] **Step 3: Login**

`app/login/acao.ts`:

```ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESSAO, opcoesCookie } from '@/src/server/autenticacao/cookie'
import { entrar } from '@/src/server/autenticacao/entrar'
import { mensagemDeLogin } from '@/src/server/autenticacao/mensagens'
import { origemDe } from '@/src/server/autenticacao/origem'

export type EstadoLogin = { erro: string | null }

export async function entrarAcao(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const r = await entrar({
    email: String(form.get('email') ?? ''),
    senha: String(form.get('senha') ?? ''),
    origem: origemDe(await headers()),
  })
  if (!r.ok) return { erro: mensagemDeLogin(r) }
  ;(await cookies()).set(COOKIE_SESSAO, r.token, opcoesCookie(r.expiraEm))
  redirect(r.precisaTrocarSenha ? '/trocar-senha' : '/')
}
```

`app/login/formulario.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { entrarAcao, type EstadoLogin } from './acao'

const inicial: EstadoLogin = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(entrarAcao, inicial)
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input name="email" type="email" autoComplete="username" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input name="senha" type="password" autoComplete="current-password" required className="rounded border px-3 py-2" />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pendente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

`app/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'

// Usuário logado não vê o login. É a página, não o proxy, que decide: cookie
// inválido cai aqui e o formulário sobrescreve.
export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect('/')
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <Formulario />
    </main>
  )
}
```

- [ ] **Step 4: Troca de senha**

`app/trocar-senha/acao.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { mensagemDeTroca } from '@/src/server/autenticacao/mensagens'
import { trocarSenha } from '@/src/server/autenticacao/trocar-senha'

export type EstadoTroca = { erro: string | null }

export async function trocarSenhaAcao(_anterior: EstadoTroca, form: FormData): Promise<EstadoTroca> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) redirect('/login')
  const r = await trocarSenha({
    token,
    senhaAtual: String(form.get('senhaAtual') ?? ''),
    senhaNova: String(form.get('senhaNova') ?? ''),
  })
  if (!r.ok) {
    if (r.motivo === 'sem_sessao') redirect('/login')
    return { erro: mensagemDeTroca(r) }
  }
  redirect('/')
}
```

`app/trocar-senha/formulario.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { trocarSenhaAcao, type EstadoTroca } from './acao'

const inicial: EstadoTroca = { erro: null }

export function Formulario() {
  const [estado, acao, pendente] = useActionState(trocarSenhaAcao, inicial)
  return (
    <form action={acao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Senha atual
        <input name="senhaAtual" type="password" autoComplete="current-password" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nova senha
        <input name="senhaNova" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className="rounded border px-3 py-2" />
      </label>
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
      <button type="submit" disabled={pendente} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pendente ? 'Trocando…' : 'Trocar senha'}
      </button>
    </form>
  )
}
```

`app/trocar-senha/page.tsx`:

```tsx
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'

export default async function PaginaTrocarSenha() {
  const eu = await exigir('sessao')
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Trocar senha</h1>
      {eu.senhaProvisoriaPendente && <p className="text-sm">Sua senha é provisória. Escolha uma definitiva para continuar.</p>}
      <Formulario />
    </main>
  )
}
```

- [ ] **Step 5: Logout e tela protegida**

`app/sair/route.ts`:

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { encerrarSessao } from '@/src/server/autenticacao/sessao'

// POST, não GET: link de terceiro não desloga ninguém.
export async function POST(request: Request) {
  const armazem = await cookies()
  const token = armazem.get(COOKIE_SESSAO)?.value
  if (token) await encerrarSessao(token)
  armazem.delete(COOKIE_SESSAO)
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
```

`app/page.tsx`:

```tsx
import { exigir } from '@/src/server/autenticacao/guarda'

export default async function Inicio() {
  const eu = await exigir('usuario')
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CRM</h1>
        <form action="/sair" method="post">
          <button type="submit" className="rounded border px-3 py-1 text-sm">
            Sair
          </button>
        </form>
      </header>
      <p>
        Olá, {eu.nome}. Você é {eu.papel}.
      </p>
    </main>
  )
}
```

`app/layout.tsx`: `lang="pt-BR"`, `metadata` com `title: 'CRM'` e `description: 'CRM'`. O resto igual.

- [ ] **Step 6: Typecheck, lint, build, suíte**

Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: tudo limpo. O `build` roda sem env, como no CI; nenhum módulo pode ler env na avaliação. Se o build reclamar de `proxy.ts` importando algo com `pg`, o import de `cookie.ts` ou `rota.ts` puxou `sessao.ts` por engano: esses dois módulos não podem importar nada de `../db`.

- [ ] **Step 7: Commit**

```bash
git add src/server/autenticacao/guarda.ts proxy.ts app/login app/trocar-senha app/sair app/page.tsx app/layout.tsx
git commit -m "telas: login, troca de senha, sair, guarda e proxy"
```

---

### Task 11: Docs, verificação manual e PR

**Files:**
- Modify: `docs/db/fundacao.md`, `docs/db/divida-tecnica.md`

- [ ] **Step 1: `fundacao.md`**

Depois da seção "Como a identidade chega ao banco", nova seção:

```markdown
## Como o login chega ao banco

Antes de haver identidade, a aplicação fala com o banco por
`chamar(nome, args)` em `src/server/db/sem-identidade.ts`: um mapa fechado
com as sete funções `SECURITY DEFINER` de `autenticacao`, que `app_conexao`
chama sem trocar de papel. Não existe `executar` ali. No banco, `app_conexao`
tem `USAGE` no schema e `EXECUTE` nas sete, e nenhum privilégio de tabela.
As duas listas são a mesma, e a invariante confere a do banco.

Verificação de senha é no Node (`scrypt`), então `credencial_por_email` é o
único ponto onde hash sai do banco, e `sessao_criar` confia no `usuario_id`
que o Node verificou. Quem tem a `DATABASE_URL` cunha sessão de qualquer um,
do mesmo modo que afirma identidade em `comoUsuario`. É o limite do desenho.

Sessão: token de 32 bytes no cookie `crm_sessao`, `sha256` no banco, 30 dias
fixos. `sessao_atual` recusa expirada e inativo. Troca de senha derruba as
outras sessões. Limite de login: 10 falhas por e-mail, 30 por origem, 15
minutos, temporário. Tudo em `docs/db/0007.md`, `0008.md`, `0009.md` e na
spec `docs/superpowers/specs/2026-09-08-login-sessao-design.md`.
```

E a seção "Registrado para a fatia de login" vira "Feito na fatia 0b", com os quatro itens marcados como feitos e uma linha: "`credencial_definir` com `eh_gestor()` por dentro fica para a fatia de usuários."

- [ ] **Step 2: Verificação manual**

Pré-requisito: `.env.local` com `DATABASE_URL_ADMIN` do container e `DATABASE_URL` de `app_conexao` (senha definida por `npm run db:senha -- app_conexao <senha>`).

```bash
npm run db:subir
npm run db:aplicar
npm run db:seed:gestor -- "Alexandre" alexandre@exemplo.com
npm run dev
```

Anotar a senha impressa. No navegador, percorrer e marcar:

1. `/` sem cookie → redireciona para `/login`.
2. Login com senha errada → "E-mail ou senha não conferem."
3. Login com a provisória → cai em `/trocar-senha` com o aviso de provisória.
4. Trocar para definitiva → cai em `/` com "Olá, Alexandre. Você é gestor."
5. Sair → volta para `/login`; `/` de novo redireciona.
6. Errar a senha 10 vezes → "Muitas tentativas. Tente de novo em 15 minutos." Login certo em seguida também bloqueado.

- [ ] **Step 3: `divida-tecnica.md`**

Seção nova, antes de "Ferramental":

```markdown
## Fatia 0b: verificado à mão, sem teste de render

Os formulários de `app/login` e `app/trocar-senha` não têm teste de render
(decisão da spec, seção 3). O que garante a passagem do `<form>` para a
action é a verificação manual abaixo, feita em 2026-09-08 no navegador contra
o container local. Refazer quando mexer em qualquer arquivo de `app/`.

| Caminho | Verificado |
|---|---|
| rota protegida sem cookie redireciona para /login | sim |
| senha errada mostra "E-mail ou senha não conferem." | sim |
| bloqueio na 10ª falha mostra "Muitas tentativas…" e bloqueia a senha certa | sim |
| primeiro acesso com provisória cai em /trocar-senha e obriga a troca | sim |
| depois da troca, / mostra nome e papel | sim |
| sair volta para /login e / redireciona de novo | sim |
```

Marcar `não` no que não passou, com uma linha do motivo, e não abrir o PR até ser tudo `sim`.

- [ ] **Step 4: Suíte inteira e commit**

Run: `npm run db:checar && npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add docs/db/fundacao.md docs/db/divida-tecnica.md
git commit -m "docs: login na fundação, verificação manual registrada"
```

- [ ] **Step 5: PR**

```bash
git push -u origin fatia/0b-login-sessao
gh pr create --base main --title "Fatia 0b: login e sessão" --body-file - <<'EOF'
## O que muda

Login com e-mail e senha, sessão em cookie, guarda de rota, senha provisória com troca obrigatória, limite de tentativas. Spec: `docs/superpowers/specs/2026-09-08-login-sessao-design.md`.

- **0007** schema `autenticacao`: `credencial`, `sessao`, `tentativa_login`, RLS sem política.
- **0008** `senha_provisoria_pendente`, `pode_escrever()`, `ALTER POLICY` nas escritas.
- **0009** sete funções `SECURITY DEFINER`, `EXECUTE` só para `app_conexao`.
- `chamar(nome, args)`: conexão sem identidade restrita por construção, no tipo e no GRANT.
- `senha.ts` (scrypt), `sessao.ts` (sha256 do token, 30 dias), `entrar`, `trocarSenha`, `avaliarAcesso`, `proxy.ts` só presença de cookie.
- Seed imprime senha provisória sozinha no stdout.

## Aplicar na Railway depois do merge

`ALVO=railway npm run db:aplicar`, depois `ALVO=railway npm run db:seed:gestor -- "Nome" email` se ainda não houver gestor com credencial.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

---

## Autorrevisão do plano

**Cobertura da spec.** Seção 4 (migrações): Tasks 1 e 2. Seção 5 (invariantes): Task 1. Seção 6 (código): `chamar` Task 2, `senha` Task 4, `sessao` Task 5, `entrar` Task 6, `trocar-senha` Task 7, `acesso`/`rota`/`cookie`/`origem`/`mensagens` Task 9, `guarda`/`proxy`/`app` Task 10, seed Task 8. Seção 7 (fluxos): Tasks 6, 7, 10. Seção 8 (contrato): Tasks 6, 7, 9. Seção 9 (testes): cada item tem teste nomeado nas Tasks 1 a 8; transição do primeiro acesso na Task 3; as duas barreiras contra inativo na Task 2 (sessão) e no `politicas.test.ts` já existente (banco); manual na Task 11. Seção 10 (docs): Tasks 1, 2, 11. Seção 11 e 12: nada a implementar.

**Tipos.** `LinhaSessao.papel: Papel` e `Sessao.papel: Papel` batem; `senha_trocar` devolve `{ senha_trocar: string | null }` em `LinhaSenhaTrocar` e é lido assim na Task 7; `Args<N>` com aridade do mapa; `ResultadoEntrar` e `ResultadoTrocar` usados em `mensagens.ts` por `Extract`.

**Ordem.** Task 3 depende da 2; Task 5 da 4 (harness usa `gerarHash`); Task 6 das 2, 4, 5; Task 7 das 5, 6; Task 8 das 4, 6; Task 10 de todas; Task 11 da 10.
