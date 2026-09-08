# Fatia 0a.1 — conexão sem herança, invariantes honestas, limites de conexão

Correção curta sobre a fundação de banco, antes da fatia de login (0b).
Nasceu da auditoria de 2026-09-08. Spec da fundação:
`2026-09-08-fundacao-banco-design.md`.

## 1. Problemas

1. `app_conexao` herda `app_usuario` com `INHERIT`. Duas consequências: o
   Postgres aplica política por `has_privs_of_role`, então as políticas
   `TO app_usuario` valem para `app_conexao` mesmo sem `SET ROLE`; e qualquer
   `SET` sem `LOCAL` de `app.usuario_id` numa conexão do pool faz
   `app_conexao` ler domínio sem trocar de papel. O teste "herança não vaza"
   passa por falta de identidade, não por falta de privilégio.
2. `invariantes.ts` só olha `public`, tem lista fixa de funções, e as
   invariantes de existência passam com zero linhas (falso verde).
3. `app_conexao` sem `CONNECTION LIMIT` e sem
   `idle_in_transaction_session_timeout`: transação travada segura conexão
   com papel trocado até esgotar o pool.

## 2. Migração `0006_conexao_sem_heranca.sql`

```sql
-- ver docs/db/0006.md
BEGIN;
REVOKE INHERIT OPTION FOR app_usuario FROM app_conexao;
ALTER ROLE app_conexao NOINHERIT CONNECTION LIMIT 20;
ALTER ROLE app_conexao SET idle_in_transaction_session_timeout = '30s';
COMMIT;
```

Verificado em 2026-09-08 contra Postgres 17.11:

- `ALTER ROLE ... NOINHERIT` sozinho **não** altera grant existente. Desde o
  PG 16 a herança mora no grant (`pg_auth_members.inherit_option`); o atributo
  do papel só define o padrão de grants futuros. Por isso o `REVOKE INHERIT
  OPTION FOR`. O `NOINHERIT` fica para grants futuros nascerem certos.
- `set_option` continua `t`, então `set_config('role', 'app_usuario', true)`
  em `comoUsuario` segue funcionando. Sem assumir o papel,
  `has_table_privilege('app_conexao', 'usuario', 'SELECT')` é falso.
- `ALTER ROLE ... SET` entra só em sessão de `app_conexao`. Runner, seed e
  harness conectam como `postgres` e não são afetados.

Limite 20: pool com 10 por processo e mais de uma instância possível na
Vercel. Timeout 30s: espelha o `statement_timeout` do pool. Ambos são do
cluster, não do banco; os bancos de teste compartilham e o comando é
idempotente.

Efeito colateral desejado: `RESET ROLE` dentro de `comoUsuario` volta a
`app_conexao`, que passa a não ter privilégio em domínio. A fronteira vale
contra SQL, não só contra GRANT errado. Fica exposto só o que a 0b conceder
a `app_conexao` em `autenticacao`.

### 2.1 Descoberto na implementação: ouvinte de `error` em `comoUsuario`

O timeout dispara quando a sessão está sem consulta ativa. Nesse caso o `pg`
não tem consulta para rejeitar e emite `error` no cliente. Cliente retirado do
pool não tem ouvinte (o pool remove o dele no checkout), e `emit('error')` sem
ouvinte derruba o processo Node. Provado em 2026-09-08 com script
descartável: sem ouvinte, `UNCAUGHT: terminating connection due to
idle-in-transaction timeout`; com ouvinte, o `25P03` chega e as consultas
seguintes falham de forma controlada.

Ou seja, a migração sozinha criaria um caminho de crash. `comoUsuario` passa a
instalar um ouvinte enquanto segura o cliente, guardar o primeiro erro, pular
`ROLLBACK` e `RESET` quando a conexão já morreu, relançar o erro original com o
código do servidor, e descartar a conexão com `release(erro)`. O `RESET` no
`finally` também ganha `try/catch`: se falhar, a conexão é descartada em vez
de vazar sem `release`.

## 3. `invariantes.ts`

Dividido em `lerEstado(cliente)`, que consulta o catálogo, e `avaliar(estado)`,
pura, que devolve violações. `conferirInvariantes(url)` compõe as duas.
Assinatura externa não muda.

Schemas de aplicação: todos, exceto `pg_catalog`, `information_schema`,
`pg_toast` e `pg_temp*`.

| Invariante | Violação quando |
|---|---|
| tabela em schema de aplicação tem RLS | `relrowsecurity` falso, exceto `_migracao` |
| nenhuma tabela com FORCE | `relforcerowsecurity` verdadeiro |
| função `SECURITY DEFINER` tem `search_path` | `prosecdef` sem `search_path=` em `proconfig` |
| papéis existem | `app_conexao` ou `app_usuario` ausente |
| funções de acesso existem | `usuario_atual`, `pode_ler` ou `eh_gestor` ausente em `public` |
| `app_conexao` é segura | `rolsuper`, `rolbypassrls`, dona de tabela, `rolconnlimit <= 0`, ou linha em `pg_auth_members` com `inherit_option` para ela |
| `_migracao` inalcançável | `has_table_privilege` verdadeiro para `app_conexao` ou `app_usuario` |

## 4. Testes

- `identidade.test.ts`: herança exige `42501`, sem alternativa; novo teste de
  `has_table_privilege` falso. Transação ociosa: dentro de `comoUsuario`,
  `SET LOCAL idle_in_transaction_session_timeout = '200ms'`, espera 500ms,
  próxima `executar` falha com `25P03`, `comoUsuario` rejeita, chamada
  seguinte funciona. Exercita o ramo `conexaoSuja`.
- `tests/integracao/pool.test.ts`: conta conexões de `app_conexao` em
  `pg_stat_activity`, abre clientes até o limite, o seguinte falha com
  `53300`; fecha todos no `finally`. Conferência de catálogo do `30s` e do
  `rolconnlimit`.
- `src/server/db/migracoes/invariantes.test.ts`: unitário sobre `avaliar`,
  uma violação por caso, inclusive papel e função ausentes.
- `runner.test.ts`: schema novo sem RLS; função definidora sem `search_path`;
  ambos nomeados.
- `schema.test.ts`: sete migrações.

## 5. Docs

`docs/db/0006.md`; tabela de papéis em `docs/db/fundacao.md`; R-010 em
`REGRAS.md`; `docs/db/divida-tecnica.md` com o resto da auditoria.

## 6. Fora de escopo

Tudo o que está em `docs/db/divida-tecnica.md`.
