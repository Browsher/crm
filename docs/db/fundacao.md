# Fundação de banco

Como o CRM fala com o Postgres, e por quê. A spec completa está em
`docs/superpowers/specs/2026-09-08-fundacao-banco-design.md`; este arquivo é o
resumo para quem vai escrever a próxima migração ou o próximo repositório.

## Três ideias

**1. A autoridade está no banco.** Quem decide o que um usuário vê e altera é
a política de RLS, não o código TypeScript. O código só informa ao Postgres
quem está falando. Se uma tela tiver um bug, o banco continua negando o que
deve negar.

**2. A aplicação nunca é dona nem superusuária.** Ela conecta como
`app_conexao`, um papel sem `SUPERUSER`, sem `BYPASSRLS`, dono de nada. Dentro
de cada transação assume `app_usuario`, que é quem tem os GRANTs. Um pool
conectado como superusuário ignora toda política e nenhum teste de RLS pega
isso; por isso `pool.ts` confere o papel na primeira conexão e derruba o
processo se ele for perigoso.

**3. Migração aplicada é imutável.** Byte a byte, inclusive comentário. O
runner grava o sha256 do arquivo e recusa qualquer diferença. Corrigir é
acrescentar uma migração nova. O porquê de cada migração vive aqui em
`docs/db/`, não no `.sql`, para poder ser editado livremente.

## Como a identidade chega ao banco

`comoUsuario(usuarioId, trabalho)` em `src/server/db/como-usuario.ts` é o
único caminho para dado de domínio:

1. `BEGIN`
2. `SELECT set_config('app.usuario_id', $1, true), set_config('role', 'app_usuario', true)`
3. o seu `trabalho(executar)`
4. `COMMIT`, ou `ROLLBACK` em erro
5. `RESET ROLE; RESET ALL;` e devolve a conexão ao pool

`set_config(..., true)` é `SET LOCAL` em forma de função: vale até o fim da
transação e volta sozinho no `COMMIT` ou no `ROLLBACK`, inclusive após erro.
Como aceita parâmetro, a identidade nunca é interpolada em SQL. `role` é um
parâmetro comum, então a mesma chamada troca o papel.

`RESET ALL` não restaura `role`: o Postgres marca esse parâmetro com
`GUC_NO_RESET_ALL`, assim como `session_authorization`. Por isso o `RESET ROLE`
explícito. O teste `tests/integracao/identidade.test.ts` tem o controle
negativo que demonstra isso.

Do lado do banco, `usuario_atual()` lê `current_setting('app.usuario_id')`. É
a única função que sabe de onde a identidade vem. Trocar o mecanismo um dia é
trocar essa função.

## Contrato de erro para os repositórios

`comoUsuario` não traduz erro. Quem traduz para `{ ok, motivo }` é o
repositório da feature. Dois casos que ele precisa distinguir:

- `INSERT` ou `WITH CHECK` recusado pela política: erro do Postgres com código
  `42501`.
- `UPDATE` que não encontra a linha por causa do `USING`: `afetadas: 0`, sem
  erro.

Falha de infraestrutura (conexão, timeout) lança e não é traduzida.

## Papéis

| Papel | Atributos | Para quê |
|---|---|---|
| `app_conexao` | `LOGIN`, `NOBYPASSRLS`, dono de nada | está na `DATABASE_URL`. Herda `app_usuario`. |
| `app_usuario` | `NOLOGIN` | recebe os GRANTs. Alvo do `set_config('role', ...)`. |
| `app_conferencia` | `NOLOGIN`, criado pelo runner | `SELECT` só em `_migracao`. Usado pelo CI para conferir a Railway. |

Papel nasce sem senha e sem `LOGIN`, porque o repositório é público e a
migração é imutável. `npm run db:senha -- <papel> <senha>` faz o
`ALTER ROLE ... LOGIN PASSWORD` uma vez por ambiente.

## Regras de migração

1. Uma alteração de schema é um arquivo numerado em `db/migracoes/`. Nunca à
   mão, nunca pelo painel.
2. Somente avante. Sem arquivo de reversão.
3. Aplicada é imutável. O runner recusa qualquer diferença.
4. Comentário no `.sql`: no máximo uma linha no topo, começando com `--`, até
   120 caracteres, apontando para `docs/db/NNNN.md`.
5. `BEGIN;` na primeira linha de código, `COMMIT;` na última. Nenhum controle
   de transação no meio.
6. Apenas Postgres padrão. Nenhum schema nem papel de fornecedor.
7. PK `uuid DEFAULT gen_random_uuid()`, salvo PK que também é FK ou PK textual
   de tabela de referência.
8. Toda tabela nova entra com RLS. O runner nomeia quem ficou sem.

`npm run db:checar` confere as regras estáticas sem banco. O runner confere as
invariantes de schema depois de aplicar (`src/server/db/migracoes/invariantes.ts`).

## Como o runner aplica

O arquivo tem `BEGIN;`/`COMMIT;` para ser atômico também quando rodado à mão
pelo `psql`. O runner, porém, remove essas duas linhas e é dono da própria
transação: `BEGIN`, corpo, `INSERT INTO _migracao`, `COMMIT`. Assim o schema
muda e o registro grava juntos, ou nada acontece. A soma gravada é a do arquivo
em disco, não do corpo transformado.

## Registrado para a fatia de login

- Schema `autenticacao` com `credencial` e `sessao`, ambas com FK para
  `usuario`, não o inverso.
- `senha_provisoria_pendente` em `usuario`, junto com `pode_escrever()` e
  `ALTER POLICY` nas políticas de escrita.
- Função de consulta sem identidade, restrita a `SECURITY DEFINER`, para login
  e resolução de sessão. `app_conexao` alcança `autenticacao`, `app_usuario`
  não.
- Limite de tentativas de login. Papel anônimo só se houver requisição anônima.

## Limitações conhecidas

- `usuario_alterar` bloqueia a pessoa de editar o próprio nome, não só papel e
  situação. Quando houver tela de perfil, a solução é política separada.
- `criado_por` anulável, sem CHECK, para o seed do primeiro gestor.
- `usuario_publico` (view com id e nome) fica fora até ter consumidor.
- Aplicação na Railway é manual.
