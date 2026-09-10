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

## Como o gestor define senha

`credencial_definir(usuario_id, hash)` e
`usuario_situacao_definir(usuario_id, ativo)` são funções `SECURITY DEFINER`
em `public` com `EXECUTE` só para `app_usuario`, chamadas de dentro de
`comoUsuario`. Por dentro, `eh_gestor()` e `pode_escrever()` valem porque o
GUC `app.usuario_id` é da transação, não do papel. Assim criar vendedor é uma
transação só: `INSERT` em `usuario` pela política e credencial pela função.
`app_usuario` continua sem `USAGE` em `autenticacao`; a função toca as tabelas
de lá como dona.

`sessoes_encerrar_de(usuario_id)` é interna: sem `GRANT`, chamada só por
dentro das duas acima. Perdeu o `GRANT` na 0c.1 junto com o último chamador da
aplicação, pela regra de que função exposta sem consumidor não fica (R-014).

Quem redefiniu a senha fica em `autenticacao.credencial.atualizado_por`, não
em `usuario`: igual ao `usuario_id` é troca própria, diferente é o gestor que
redefiniu, nulo é o sistema.

A conferência de permissão mora em `exigir_gestor(p_alvo)`, chamada pelas três
funções: gestor ativo, sem senha provisória pendente, e o alvo não é ele
mesmo. Ela não é definidora e não tem `GRANT`, porque só roda por dentro de
quem já é.

**Duas listas fechadas em `invariantes.ts`, com perguntas diferentes:**

| Constante | Responde |
|---|---|
| `FUNCOES_DE_ACESSO_OBRIGATORIAS` | quais funções têm que existir |
| `FUNCOES_CONCEDIDAS_A_APP_USUARIO` | quais podem ter `GRANT` para `app_usuario` |

As cinco de acesso aparecem nas duas: são definidoras concedidas como
qualquer outra, e "de acesso" é nome nosso, não do banco. Definidora concedida
fora da lista derruba `db:aplicar` e o CI, em qualquer schema, toque ou não
`autenticacao`. Uma segunda invariante barra função de schema de aplicação
executável por `PUBLIC`, que é o padrão do Postgres para função nova e por isso
exige `REVOKE` explícito em toda migração.

Nova senha provisória e desativar apagam as sessões do alvo. Mudar papel não
mexe em sessão: `sessao_atual` lê `papel` a cada requisição.

**Desativar e reativar não passam pela política.** `usuario_situacao_definir`
é definidora, e dentro de definidora com dona isenta de RLS a política não é
avaliada. A conferência de dentro é a autoridade; `usuario_alterar` continua
valendo como rede de segurança para `UPDATE` direto. Quem procurar na política
a regra de desativar não vai achar. A isenção vem de dois caminhos, dona
superusuária e dona da tabela sem `FORCE`, e `docs/db/0010.md` tem a tabela
verificada.

**Transição sem sentido é recusada, com motivo próprio.** Definir senha para
inativo, desativar quem já está inativo e reativar quem já está ativo devolvem
`alvo_inativo` ou `ja_nesse_estado`, não `nao_encontrado`. As funções de
escrita devolvem texto de vocabulário fixo, e o TypeScript lança em valor fora
do vocabulário, porque isso é defeito nosso e não estado de negócio.

**Zero gestores ativos.** Não há proteção no banco. A tela avisa quando o
gestor ativo é um só. Se acontecer (corrida entre dois gestores, ou o único
perdeu a senha), `npm run -s db:seed:gestor` cria um gestor novo: ele só
recusa quando há gestor ativo.

Detalhes em `docs/db/0011.md`, `docs/db/0012.md` e nas specs
`2026-09-08-usuarios-design.md` e `2026-09-09-usuarios-correcoes-design.md`.

## Contrato de erro para os repositórios

`comoUsuario` não traduz erro. Quem traduz para `{ ok, motivo }` é o
repositório da feature. Três casos que ele precisa distinguir:

- `INSERT` ou `WITH CHECK` recusado pela política: erro do Postgres com código
  `42501`. Uma função definidora que recusa por permissão levanta o mesmo
  código de propósito, para o repositório traduzir um só.
- `UPDATE` que não encontra a linha por causa do `USING`: `afetadas: 0`, sem
  erro.
- Restrição única violada: código `23505`, com o nome da restrição em
  `constraint` (por exemplo `usuario_email_key`). Conferir o nome, não só o
  código: outra restrição única daria o mesmo código com outro significado.

`src/features/usuarios/repositorio.ts` é o exemplo dos três juntos.

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

### O schema `extensoes` e a primeira função não-definidora concedida

A `0015` criou o schema `extensoes` só para a extensão `unaccent`, e concedeu a
`app_usuario`: `USAGE` no schema, `EXECUTE` em
`extensoes.unaccent(regdictionary, text)` e `EXECUTE` em `public.sem_acento`.

`sem_acento` é a **primeira função não-definidora concedida a `app_usuario`**.
Ela não entra em `FUNCOES_CONCEDIDAS_A_APP_USUARIO`: aquela lista é fechada
sobre definidoras. A R-014 classifica este caso como bilhete e diz por quê —
função não definidora roda como quem chama, sujeita à RLS e aos mesmos
privilégios, então não escala nada.

Os `GRANT` existem porque `sem_acento` roda como quem chama: sem eles, o corpo
dela não alcança `extensoes.unaccent` e **tanto a busca quanto o `INSERT` do
gestor falham** — a expressão da coluna gerada é avaliada com o privilégio de
quem insere. Medido em 2026-09-09; a spec não previa os dois `GRANT`.

A invariante de PUBLIC varre todo schema que não é do sistema, então `extensoes`
não escapa dela. As cinco funções (quatro da extensão e o invólucro) nascem com
`EXECUTE` para `PUBLIC` e a `0015` revoga as cinco.

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

**Recriar o banco de dev é barato em migração e caro em dado carregado.**
`DROP DATABASE crm` + `CREATE DATABASE` + `db:aplicar` reconstrói as quinze
migrações em segundos — e apaga junto **1,2 milhão de linhas de `cep`**, que
levam sete a oito minutos para voltar por `db:cep:carregar`. Aconteceu em
2026-09-09, ao corrigir a `0014` antes do merge: o banco foi recriado pensando
só nas migrações, e a base de CEP foi embora sem ninguém notar até uma
importação reportar todos os CEPs como não encontrados.

Antes de recriar, conferir o que existe além de schema:

```
docker exec crm-postgres psql -U postgres -d crm -c "SELECT count(*) FROM cep"
```

Depois de recriar, se havia dado:

```
npm run db:cep:carregar -- <caminho-do-zip>
```

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

Feito na fatia 0c (usuários): `credencial_definir` e `sessoes_encerrar_de`
(0011), e a tela `/usuarios`. Corrigido na 0c.1: `exigir_gestor`,
`usuario_situacao_definir`, auditoria em `credencial` e as duas invariantes
novas (0012).

Feito na fatia `cep`: `cep` e `cep_carga` (0013), a primeira tabela do projeto
com leitura irrestrita (`USING (true)`, justificada em `docs/db/0013.md`), a
invariante `POLITICAS_DE_LEITURA_IRRESTRITA` que a cataloga, e o carregador
operacional `db:cep:carregar`, que escreve com `DATABASE_URL_ADMIN` porque
`app_usuario` só tem `SELECT`. Desenho em
`docs/superpowers/specs/2026-09-09-cep-design.md`.

Feito na fatia `empresas`: a tabela `empresa` (0014) e a tela
`/empresas/importar`. Três coisas mudam o resumo desta página:

- **É a primeira tabela gestor-só.** `empresa_leitura` usa `USING (eh_gestor())`
  — não `pode_ler()`, como `usuario`, nem `USING (true)`, como `cep`. O vendedor
  não lê empresa nenhuma. É **provisório por desenho**: a política foi escrita
  para um mundo sem posse, e a fatia da fila vai trocá-la junto com
  `vendedor_id`. O porquê, e a lição do `crm-ch` sobre mascarar por view com
  `SELECT` revogado, estão em `docs/db/0014.md`.
- **É o primeiro `GRANT` sem `UPDATE` nem `DELETE`.** A importação ignora e
  reporta, então nada nesta fatia atualiza empresa; conceder seria superfície
  sem tela (R-014). `cep_carga`, da 0013, ganhou aqui o `GRANT SELECT` e a
  política que a spec da `cep` prometeu para quando existisse o consumidor.
- **É a primeira escrita em lote pela aplicação**, por `unnest` de nove arrays
  dentro de `comoUsuario` — e não por script com `DATABASE_URL_ADMIN`, para a
  RLS valer e `criado_por` não nascer nulo na única porta de entrada.

Desenho em `docs/superpowers/specs/2026-09-09-empresas-design.md`, que cobre
esta fatia e a `empresas.1`.

Feito na fatia `fila.1`: a tabela `empresa_fila` e as três funções de fila
(0016). Quatro coisas mudam o resumo desta página:

- **`empresa_leitura` deixou de ser gestor-só.** O vendedor lê o que está com
  ele — posse, ou reserva **vigente**. A `0014` prometeu a troca e ela aconteceu
  aqui; a política nova consulta `empresa_fila`, e por isso estreitar
  `empresa_fila_leitura` estreita `empresa_leitura` **em silêncio**.
- **É a primeira tabela cuja escrita não tem `GRANT` nenhum.** `app_usuario`
  recebe só `SELECT` em `empresa_fila`; `fila_puxar`, `empresa_assumir` e
  `empresa_devolver` escrevem como donas. É o que mantém "um dono de escrita por
  tabela" sem `GRANT` de coluna, que é onde o `crm-ch` se enforcou.
- **A trava fica numa tabela e a escrita na outra.** `FOR UPDATE` não se aplica
  ao lado anulável de um `LEFT JOIN`, então as três funções travam a linha de
  `empresa` antes de decidir e escrevem em `empresa_fila`. **Função nova que
  escreva em `empresa_fila` precisa travar `empresa` primeiro** — quem esquecer
  não recebe erro nenhum, só perde corridas em silêncio.
- **Medido em 2026-09-10 (PG 17):** `GRANT SELECT` não compra trava de linha —
  `SELECT ... FOR SHARE` já dá `permission denied for table`. Então essa lógica
  em TypeScript exigiria `GRANT UPDATE` em `empresa`, e a definidora é o que
  evita isso.

O gestor vê e usa `/fila` e `/carteira`, e é decisão: ele precisa ver a fila
para saber se está vazia e a carteira para entender o que a equipe faz. As
funções checam `pode_escrever()` e não papel, então ele também puxa e assume. Se
incomodar, a correção é na função, não na tela.

Desenho em `docs/superpowers/specs/2026-09-10-fila-design.md`; o porquê de cada
decisão em `docs/db/0016.md`.

## Feito na fatia `contato`

`contato` é a tabela de eventos que registra o que aconteceu na ligação, e ela
fecha a lacuna que a `fila.1` deixou registrada como o custo central dela:
empresa devolvida voltava à fila **indistinguível de uma nunca tocada**.

- **Uma tabela, pendurada em `empresa`, para os dois estados.** Prospecção
  (reserva) e acompanhamento (posse) são a mesma linha com `tipo` diferente. O
  `crm-ch` separava em duas tabelas por fase do funil; aqui não há funil, há
  posse e não-posse, que é estado da fila e não do relacionamento.
- **O próximo passo é derivado, não guardado.** `proximo_passo` e
  `proximo_passo_data` vivem só em `contato`, e "o que vale hoje" sai do contato
  mais recente por `LEFT JOIN LATERAL`. Não há cache: a auditoria do `crm-ch`
  apontou `cliente.proximo_passo` como problema, e a única tabela candidata aqui
  seria `empresa_fila`, que é estado de fila e não hospeda combinado.
- **O contato acompanha a empresa, não o autor.** `contato_leitura` é uma frase
  que delega para `empresa_leitura` (`EXISTS (SELECT 1 FROM empresa ...)`), e a
  RLS aninhada faz gestor, posse e reserva vigente entrarem sozinhos. Vendedor B
  lê o que o vendedor A escreveu — é o que faz o histórico atravessar a troca de
  dono. **A consequência decidida:** o autor deixa de ler o que escreveu quando a
  empresa sai da mão dele.
- **A cadeia de políticas passou a ter três elos:** `contato_leitura` →
  `empresa_leitura` → `empresa_fila_leitura`. Estreitar a última estreita as
  três, em silêncio.
- **A tabela é imutável por ausência.** `GRANT SELECT` e mais nada, e nenhuma
  função de alteração. Ausência não é observável no código: tem teste próprio.
- **`empresa_assumir` e `empresa_devolver` deixaram de ser chamáveis pela
  aplicação.** `contato_registrar` é o único caminho de desfecho, e chama as duas
  por dentro. Devolver sem registrar deixou de existir, o que começa a cobrar
  pela assimetria devolver × abandonar que a `fila.1` registrou.
- **`contato.tipo` é lista fechada em TypeScript, e o banco só exige não-vazio.**
  Ao contrário de `usuario.papel`, nenhuma função do banco lê `tipo` — o desfecho
  é parâmetro separado. A defesa é teste, e está escrito que é.
- **Nenhuma comparação de data em TypeScript.** `proximo_passo_data` é `date`, e
  "vencido" é calculado no banco com
  `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.

`/carteira` virou a agenda (ordenada por `proximo_passo_data ASC NULLS LAST`) e
ganhou `/carteira/[id]`, a ficha — que traz o **devolver da carteira**, caminho
que a `fila.1` não tinha e cuja falta prendia quem assumisse por engano.

Desenho em `docs/superpowers/specs/2026-09-10-contato-design.md`; o porquê de
cada decisão em `docs/db/0017.md`, `0018.md` e `0019.md`.

## Limitações conhecidas

- `usuario_alterar` bloqueia a pessoa de editar o próprio nome, não só papel e
  situação. Quando houver tela de perfil, a solução é política separada.
- `criado_por` anulável, sem CHECK, para o seed do primeiro gestor.
- `usuario_publico` (view com id e nome) fica fora até ter consumidor.
- Aplicação na Railway é manual.
- TLS até a Railway é trust-on-first-use (seção acima). O caminho forte é
  rodar dentro da rede da Railway.
- **O sufixo `_em` passou a ter dois significados, e não vale generalizar.** Até
  a `0015`, `_em` era instante de coisa que **aconteceu** (`criado_em`,
  `bloqueada_em`) e `_ate` era **prazo** (`reservado_ate`). A `0016` trouxe
  `empresa_fila.elegivel_em`, que é instante **futuro** — não há sufixo nosso
  para "a partir de". A regra continua valendo: `_em` é passado, `_ate` é prazo.
  `elegivel_em` é exceção **nomeada**, com o argumento em `docs/db/0016.md`, e a
  próxima coluna de instante futuro não copia o padrão sem o mesmo argumento.
  Diferente do `USING (true)` da `cep`, aqui **não existe catraca possível** —
  comparar nome de coluna não pega intenção.
- **`sem_acento` é `IMMUTABLE` por promessa, não por garantia.** Se o dicionário
  de `unaccent` mudar numa troca de versão maior do Postgres, a coluna gerada
  `empresa.busca` fica desatualizada **em silêncio**: nada dá erro, a busca só
  passa a não achar. Produção é 18.6 e os testes rodam em 17. O conserto é
  recalcular a coluna, e é barato se alguém souber que precisa.
- **`definir_auditoria` sobrescreve `criado_em` e `criado_por` no `INSERT`.**
  Linha semeada como dona, sem identidade de sessão, nasce sem autor e com o
  `now()` da semeadura — o valor passado é descartado. **Teste que dependa de
  autor ou de ordem no tempo precisa escrever pelo caminho de verdade, em
  transações separadas.** Um teste da fatia `contato` passou por sorte antes de
  isso ser entendido: duas linhas com o mesmo instante caíram no desempate por
  `id`, que é uuid aleatório.
- **Migração não se explica; o doc explica a migração.**
  `src/server/db/migracoes/checar.ts:44` recusa comentário fora da primeira
  linha do arquivo. Então raciocínio de função definidora — inclusive o motivo
  de uma ordem de travamento — mora em `docs/db/NNNN.md`, e quem for mexer no
  SQL não encontra aviso ao lado do código. A rede é o teste de corrida.
