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
explícito. Confirmado em 2026-09-08 contra Postgres 17: o controle negativo em
`tests/integracao/identidade.test.ts` faz `SET ROLE` sem `LOCAL`, `RESET ALL`,
e o papel continua trocado; só `RESET ROLE` devolve.

Herança é revogada no grant, não no papel: no PG 16+ `ALTER ROLE NOINHERIT`
não muda grant existente (R-010, `docs/db/0006.md`). Por isso `RESET ROLE`
dentro da transação, que é sempre permitido, volta para um `app_conexao` que
não alcança nada de domínio.

Enquanto segura o cliente, `comoUsuario` instala um ouvinte de `error`.
Cliente fora do pool não tem ouvinte, e se o servidor encerrar a sessão sem
consulta ativa (timeout de transação ociosa, `pg_terminate_backend`,
failover), o `pg` emite `error` e o Node derrubaria o processo. Com o
ouvinte, `comoUsuario` rejeita com o erro original do servidor (por exemplo
`25P03`), descarta a conexão com `release(erro)` e o pool abre outra.

Do lado do banco, `usuario_atual()` lê `current_setting('app.usuario_id')`. É
a única função que sabe de onde a identidade vem. Trocar o mecanismo um dia é
trocar essa função.

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

Primeiro gestor: `npm run -s db:seed:gestor -- "Nome" email`. O `-s` importa:
a senha provisória sai sozinha no stdout do script, mas sem `-s` o próprio npm
imprime o banner do comando antes dela, e um redirecionamento leva os dois.

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
| `app_conexao` | `LOGIN`, `NOBYPASSRLS`, `NOINHERIT`, `CONNECTION LIMIT 20`, `idle_in_transaction_session_timeout = 30s`, dono de nada | está na `DATABASE_URL`. Membro de `app_usuario` **sem herança**: só tem os privilégios ao assumir o papel. Fora de `comoUsuario`, `usuario` dá `42501`. |
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

**Sobre `FORCE ROW LEVEL SECURITY`, corrigindo a spec da fundação.** A spec
dizia que `FORCE` em `usuario` causaria recursão infinita nas funções de
acesso. Verificado em 2026-09-08 (`docs/db/0010.md`): com dona superusuária,
que é o caso de `postgres` no container e na Railway, `FORCE` não muda nada.
Com dona comum, as funções definidoras passam a estar sujeitas a RLS, não há
política para a dona, e elas devolvem nulo: tudo é negado para todo mundo.
Bloqueio total, não recursão. A invariante que barra `FORCE` continua valendo,
pelo motivo certo.

## Como o runner aplica

O arquivo tem `BEGIN;`/`COMMIT;` para ser atômico também quando rodado à mão
pelo `psql`. O runner, porém, remove essas duas linhas e é dono da própria
transação: `BEGIN`, corpo, `INSERT INTO _migracao`, `COMMIT`. Assim o schema
muda e o registro grava juntos, ou nada acontece. A soma gravada é a do arquivo
em disco, não do corpo transformado.

## TLS na Railway

Verificado em 2026-09-08 contra o banco novo da Railway.

**O que a Railway oferece.** O proxy público (`*.proxy.rlwy.net`) repassa o
certificado do próprio Postgres, que é autoassinado e gerado junto com o banco:

```
subject: CN=localhost
issuer:  CN=root-ca (autoassinado)
SAN:     DNS:localhost, DNS:postgres.railway.internal
```

`PG_SSL=verify` sem CA falha com `SELF_SIGNED_CERT_IN_CHAIN`. Com o CA pinado
mas sem nome, falha com `ERR_TLS_CERT_ALTNAME_INVALID`, porque o host público
não está no SAN. Ou seja, a Railway não oferece TLS verificável pelo host
público sem ajuda.

**O que fazemos.** Pinar o CA e o nome interno. Em `.env.railway.local`:

```
PG_SSL=verify
PG_SSL_CA=./railway-ca.pem
PG_SSL_NOME_SERVIDOR=postgres.railway.internal
```

O Node valida a cadeia contra o `root-ca` pinado e o nome contra
`postgres.railway.internal` (via `checkServerIdentity`, porque o `pg`
sobrescreve `servername` com o host). Um atacante no meio precisaria da chave
privada desse `root-ca`. Se a Railway rotacionar o certificado, a conexão falha
alto, que é o comportamento certo. Nunca desligar a verificação para conexão
remota.

**Como reextrair o CA** (`railway-ca.pem` fica fora do repositório; o
`.gitignore` ignora `*.pem`):

```bash
openssl s_client -connect <host>.proxy.rlwy.net:<porta> -starttls postgres -showcerts </dev/null 2>/dev/null \
  | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' \
  | awk 'BEGIN{n=0} /BEGIN CERTIFICATE/{n++} n==2{print}' > railway-ca.pem
openssl x509 -in railway-ca.pem -noout -fingerprint -sha256 -subject -dates
```

O segundo certificado da cadeia é o `root-ca`. Compare o fingerprint com o
registrado aqui antes de confiar:

```
sha256 Fingerprint=16:BF:BC:9C:50:04:BE:A0:BD:E9:34:65:A9:A5:BE:17:AE:25:A3:89:57:7A:F1:45:54:2B:17:9D:BB:EF:44:90
subject=CN=root-ca
notBefore=Sep  8 15:34:59 2026 GMT
notAfter=Dec  6 15:34:59 2028 GMT
```

Se o fingerprint mudou sem você ter recriado o banco, pare e investigue antes
de atualizar o arquivo.

**Limitação: trust-on-first-use.** O CA veio do próprio servidor na primeira
conexão. Não há canal independente da Railway para conferir que aquele
`root-ca` é o legítimo. O fingerprint acima protege contra mudança futura, não
contra a primeira extração ter sido interceptada. O caminho forte é não
atravessar a internet até o banco: aplicação e migrações rodando dentro da
rede da Railway, conectando por `postgres.railway.internal`, onde o nome bate
com o SAN sem pinagem. Fica para quando a infraestrutura permitir.

## Feito na fatia 0b (login e sessão)

O que a fundação tinha reservado para o login, e onde ficou:

- Schema `autenticacao` com `credencial` e `sessao`, FK para `usuario`: 0007.
- `senha_provisoria_pendente`, `pode_escrever()` e `ALTER POLICY`: 0008.
- Funções `SECURITY DEFINER` para login e sessão, só `app_conexao`: 0009 e
  `chamar` em `sem-identidade.ts`.
- Limite de tentativas: `bloqueio_login` e `registrar_tentativa_login`. Sem
  papel anônimo, porque não houve requisição anônima.

Fica para a fatia de usuários: `credencial_definir` com `eh_gestor()` por
dentro, para o gestor criar vendedor com senha provisória.

## Limitações conhecidas

- `usuario_alterar` bloqueia a pessoa de editar o próprio nome, não só papel e
  situação. Quando houver tela de perfil, a solução é política separada.
- `criado_por` anulável, sem CHECK, para o seed do primeiro gestor.
- `usuario_publico` (view com id e nome) fica fora até ter consumidor.
- Aplicação na Railway é manual.
- TLS até a Railway é trust-on-first-use (seção acima). O caminho forte é
  rodar dentro da rede da Railway.
