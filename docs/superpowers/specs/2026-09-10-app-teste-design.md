# Fatia `app_teste`: o harness para de mexer no papel da aplicação

O harness de teste reescreve a senha do `app_conexao` — papel global do cluster,
o mesmo que a aplicação usa — a cada arquivo de teste de integração. Isso derruba
a `DATABASE_URL` do ambiente de dev no meio da verificação manual.

Esta fatia dá ao harness um papel próprio, `app_teste`, que recebe os privilégios
do `app_conexao` **por herança**, não por cópia. Entrega uma migração, uma
invariante nova no checador, a troca do papel no harness, e uma conferência de
host que fecha um buraco que a própria fatia abriria.

Não entrega cobertura de TLS. Ver "O que esta fatia não muda".

## O problema, com a contagem

`criarBancoDeTeste` faz `ALTER ROLE app_conexao LOGIN PASSWORD 'teste'`
(`tests/integracao/ajuda.ts:39`). Papel é global no cluster: a senha do
`app_conexao` do banco de dev é reescrita junto, e a `DATABASE_URL` do
`.env.local` para de funcionar até alguém rodar `npm run db:senha`.

Duas contagens, medidas em condições diferentes:

- **Quatro interrupções em 2026-09-09**, durante a verificação manual da fatia
  `empresas` — a primeira fatia com verificação manual longa intercalada com
  rodadas de teste. Registrado em `docs/db/divida-tecnica.md`; é o que disparou
  o gatilho.
- **30 escritas globais por rodada cheia da suíte de integração.** Medido em
  2026-09-10 contando chamadas de `criarBancoDeTeste(` em
  `tests/integracao/**/*.test.ts`: 30 chamadas em 28 arquivos, com
  `fileParallelism: false` no projeto `integracao` (`vitest.config.mts`). Uma
  escrita por chamada, todas gravando a mesma senha.

## O que foi medido antes de decidir

Três medições. As duas primeiras derrubaram hipóteses; a terceira escolheu o
desenho.

### 1. A herança não vaza através do `NOINHERIT` da `0006`

**Condição:** container local, `postgres:17` (`PostgreSQL 17.11`), banco novo com
todas as migrações aplicadas, papel descartável `sonda_teste` criado e derrubado
na mesma execução. Elo conferido antes: `pg_auth_members` de `app_conexao` traz
`app_usuario` com `inherit_option = false` — é a `0006`.

O `GRANT` foi dado com a opção explícita nas duas rodadas, porque desde o PG 16 a
herança mora no grant e não no atributo do papel (R-010).

| Medida | `WITH INHERIT TRUE` | `WITH INHERIT FALSE` |
|---|---|---|
| `pg_has_role(…, 'app_usuario', 'USAGE')` | false | false |
| `SELECT` direto em `usuario` | erro `42501` | erro `42501` |
| `has_schema_privilege(…, 'autenticacao', 'USAGE')` | true | false |
| funções de `autenticacao` executáveis | 7 (o `app_conexao` tem 7) | 0 |
| `has_table_privilege(…, 'autenticacao.sessao', 'SELECT')` | false | false |
| `SET ROLE app_usuario` | ok | ok |
| `SELECT` em `usuario` depois do `SET ROLE` | 0 linhas (RLS vale) | 0 linhas |

Três conclusões, e as três entram no desenho:

1. **A revogação da `0006` corta a cadeia.** Quem herda o `app_conexao` não
   alcança o `app_usuario`. O `42501` dos controles negativos continua sendo
   `42501` pelo mesmo motivo de hoje. A cópia explícita de `GRANT`s — e a
   catraca de paridade que ela exigiria — sai da mesa.
2. **Tem que ser `INHERIT`.** Com `INHERIT FALSE` o papel não enxerga o schema
   `autenticacao` nem as sete funções definidoras, e o caminho de login
   (`src/server/db/sem-identidade.ts`, que roda como `app_conexao` fora de
   `comoUsuario`) não funcionaria.
3. **`SET ROLE app_usuario` funciona por membresia transitiva**, que é o que
   `comoUsuario` faz em `set_config('role', 'app_usuario', true)`.

Ressalva de ambiente, já registrada em `divida-tecnica.md`: produção roda
`PostgreSQL 18.6` e a sonda rodou contra 17.11. A semântica de `inherit_option` é
do PG 16+ e não é provável que mude entre 17 e 18, mas isto **não foi conferido
no ambiente onde o produto roda**.

### 2. O `trust` do container não alcança o harness

Hipótese levantada e derrubada em 2026-09-10: "a senha não importa no container,
porque o `pg_hba` tem `trust`". O `pg_hba` tem `trust`, e mesmo assim a senha
importa.

**Condição:** `pg_hba_file_rules` lido no container `crm-postgres` com
`docker compose exec -T postgres psql -U postgres`. Sete linhas; `trust` em três
delas — `local` (socket unix), `127.0.0.1` e `::1` —, todas de dentro do
container. A última linha é `host all all all scram-sha-256`.

O harness roda no Windows e chega pela porta publicada. Medido por conexão real
como `app_conexao` a partir do host:

| Tentativa | Resultado |
|---|---|
| senha errada | `28P01 password authentication failed for user "app_conexao"` |
| sem senha | o cliente nem monta o SASL |
| `inet_client_addr()` visto pelo servidor | `172.18.0.1` |

`172.18.0.1` não bate com nenhuma linha de `trust` e cai no `scram-sha-256`. E
`pg_authid` confirma `app_conexao` com `rolcanlogin = t` e senha definida: o
`ALTER ROLE ... PASSWORD` da `ajuda.ts` não é decorativo — tirá-lo sem papel novo
quebra a suíte inteira.

Fica escrito porque é a conclusão errada mais fácil de rederivar: quem lê o
`pg_hba` e para ali conclui `trust`; quem mede de onde o cliente conecta,
conclui `scram-sha-256`.

### 3. O que a herança não cobre

Atributo de papel não se herda. `CONNECTION LIMIT 20` e
`idle_in_transaction_session_timeout = 30s` são atributos do `app_conexao`
escritos pela `0006`; o `app_teste` nasce sem eles a menos que a migração os
escreva. Isso não é detalhe de arrumação: `tests/integracao/pool.test.ts:37`
abre conexões até estourar o limite e espera `53300`, contando
`pg_stat_activity WHERE usename = 'app_conexao'`. Com o harness conectando por
outro papel, esse teste **só continua significando alguma coisa** se o
`app_teste` tiver o mesmo limite.

## O que esta fatia entrega

| Objeto | O que é |
|---|---|
| `0021_papel_teste.sql` | cria `app_teste`, `NOLOGIN` e sem senha, membro de `app_conexao` com herança, com os atributos da `0006` repetidos |
| `docs/db/0021.md` | o documento da migração, no padrão das outras |
| invariante de paridade | `invariantes.ts` compara `app_teste` com `app_conexao` quando o papel existir |
| `tests/integracao/ajuda.ts` | conecta como `app_teste`; só escreve senha se a conexão falhar |
| conferência de host | `criarBancoDeTeste` recusa `DATABASE_URL_ADMIN` que não seja local |
| testes | os que nomeiam o papel da conexão, mais os novos da invariante e da conferência |

## O que esta fatia não muda

- **Cobertura de TLS.** Os testes continuam conectando por `scram-sha-256` pela
  URL montada em `ajuda.ts`, e `conectarVerificado`/`conferirPapel` continuam
  sendo exercitados — agora medindo o `app_teste`. Mas `.env.test` fixa
  `PG_SSL=off`, então o ramo `PG_SSL=verify` e as variáveis `PG_SSL_CA` e
  `PG_SSL_NOME_SERVIDOR`, que só existem para a Railway, continuam sem cobertura.
  É dívida independente, já registrada em `divida-tecnica.md`. **Esta fatia não
  melhora nem piora isso**, e a frase "os testes conectam como a produção" segue
  falsa nesse ponto — era falsa antes.
- **A cobertura dos scripts `db/*.mts`.** Continua onde estava.
- **`PAPEIS_APLICACAO`.** O `app_teste` **não** entra na lista. Ver a seção
  seguinte.

## A migração

```sql
-- ver docs/db/0021.md
BEGIN;
DO $$ BEGIN
  CREATE ROLE app_teste NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT app_conexao TO app_teste WITH INHERIT TRUE;
ALTER ROLE app_teste CONNECTION LIMIT 20;
ALTER ROLE app_teste SET idle_in_transaction_session_timeout = '30s';
COMMIT;
```

Quatro escolhas, cada uma com motivo:

**`WITH INHERIT TRUE` explícito.** R-010: a herança mora no grant. Escrever a
opção evita depender do `rolinherit` do papel no momento do `GRANT`.

E vale registrar a mesma armadilha do outro lado, porque ela é silenciosa:
**`ALTER ROLE app_teste NOINHERIT` depois não desliga a herança.** Medido em
2026-09-10, container local, `PostgreSQL 17.11`, papel descartável com o grant
já dado:

| depois de | `rolinherit` | `inherit_option` | `USAGE` em `autenticacao` |
|---|---|---|---|
| `GRANT app_conexao TO … WITH INHERIT TRUE` | true | true | true |
| `ALTER ROLE … NOINHERIT` | false | **true** | **true** |

O atributo muda, o grant fica, o privilégio continua inteiro, e o comando não
reclama. Quem tentar "endurecer" o `app_teste` por aí não endurece nada e não
fica sabendo. Desligar de verdade é
`REVOKE INHERIT OPTION FOR app_conexao FROM app_teste` — que é o que a `0006`
fez com o `app_conexao`, e é o que a invariante de piso confere.

**`NOLOGIN` e sem senha.** A migração roda na Railway. Senha literal em arquivo
versionado, num papel que herda os privilégios do `app_conexao` por construção,
seria credencial pública de produção — pior que a dívida que estamos pagando. Na
Railway o `app_teste` é casca inerte: existe, não loga, e nada o usa.

**Os atributos repetidos.** Pela medição 3. É cópia, e cópia apodrece — por isso
a invariante da seção seguinte confere os dois papéis em vez de confiar em quem
escreveu.

**Nada de `GRANT CONNECT`.** A sonda concedeu `CONNECT` explicitamente ao papel
descartável e por isso **não mediu** se é necessário; o padrão do Postgres é
`CONNECT` para `PUBLIC` no banco novo. O teste vermelho da fatia responde: se
conectar sem o `GRANT`, ele não entra.

## Paridade: piso por construção, teto e atributos por catraca

A paridade tem três partes, e cada uma é garantida de um jeito diferente:

| Parte | Como fica garantida |
|---|---|
| **Piso** — `app_teste` tem tudo que `app_conexao` tem | herança, medida na sonda 1; vale inclusive para `GRANT`s de migrações futuras, sem ninguém lembrar |
| **Teto** — `app_teste` não tem nada além | invariante: nenhum `GRANT` direto, nenhuma membresia além do `app_conexao`, sem `SUPERUSER`, sem `BYPASSRLS`, não é dona de tabela |
| **O próprio piso** — a herança continua ligada | invariante: a membresia em `app_conexao` tem `inherit_option = true`; ler `pg_auth_members`, nunca `pg_roles.rolinherit` (R-010) |
| **Atributos** — o que a herança não carrega | invariante: `rolconnlimit` e `setconfig` iguais aos do `app_conexao` |

A invariante mora em `src/server/db/migracoes/invariantes.ts`, roda em todo
cluster por `db:checar`, e **é condicional à existência do papel**: sem
`app_teste`, nenhuma violação. Isso é o que a mantém compatível com a decisão de
não cobrar o papel em produção. A condição é observável — o papel existe ou não
—, não é disciplina.

Por que no checador e não só num teste: se a paridade viver dentro da suíte, a
coisa que garante que a suíte significa algo depende da própria suíte. No
checador ela é conferível contra qualquer banco com um comando, antes de rodar
teste nenhum.

Por que o `app_teste` **não** entra em `PAPEIS_APLICACAO`: essa lista responde
"a fundação da aplicação está de pé", e papel de teste não é fundação da
aplicação. Cobrá-lo na Railway seria a catraca vigiando presença de uma coisa
que lá não deveria ser usada. O preço é que `app_teste` ausente só aparece
quando a suíte não roda — que é imediato e barato.

## O harness

### A conexão vem primeiro; a escrita só se falhar

Hoje o `ALTER ROLE` roda 30 vezes por rodada porque, quando o papel era o da
aplicação, alguém podia ter rodado `db:senha` no meio: reescrever a cada arquivo
era a forma barata de garantir que a senha batia com a URL. Com papel próprio,
ninguém mais mexe nele, e a repetição é herança do desenho antigo (R-014
aplicada ao harness: o que existia por um motivo que sumiu, sai).

O novo caminho: o harness tenta conectar como `app_teste`; se o erro for de
autenticação (`28P01`) ou de papel sem `LOGIN`, faz o `ALTER ROLE app_teste LOGIN
PASSWORD` uma vez e tenta de novo. Em regime — container já preparado — são
**zero escritas** por rodada. Em máquina nova, ou depois de
`docker compose down -v`, é uma.

A condição é observável (a conexão falha ou não), e cobre o caso do container
recriado que a senha-na-migração cobriria — sem pôr senha na migração.

Paralelismo não é motivo para manter a repetição: os arquivos de integração
rodam em série (`fileParallelism: false`). Banco recriado também não: papel é
global e sobrevive a `CREATE DATABASE`/`DROP DATABASE` — é exatamente a
propriedade que causou o problema todo.

### A conferência de host

O conserto preguiçoso abre um buraco que precisa fechar na mesma fatia. Hoje, um
`.env.test.local` apontando para a Railway por engano faz a suíte reescrever a
senha do `app_conexao` lá: **quebra, e alguém descobre**. Depois desta fatia, o
mesmo engano encontraria o `app_teste` inerte, falharia ao conectar, e o
consertaria — `ALTER ROLE app_teste LOGIN PASSWORD 'teste'` num papel de produção
que herda os privilégios da aplicação. **Funciona, e ninguém nota.** Papel inerte
ganhando `LOGIN` em produção é a coisa que não pode acontecer por acidente.

A conferência mora em **`criarBancoDeTeste`**, não num script de CLI. O cenário
que ela existe para impedir é a suíte inteira, e cada arquivo de teste cria o
próprio banco pela mesma função — são as 30 chamadas da primeira seção. Guarda em
`db:aplicar` ou em qualquer outro comando não seria atravessada por teste nenhum:
os testes passariam por baixo dela, que é exatamente o caminho do engano. A
função é o gargalo por onde todo arquivo passa, e é onde a recusa tem que estar.

`criarBancoDeTeste` passa a recusar `DATABASE_URL_ADMIN` cujo host não seja
local. A conferência é sobre o **host da URL** — o que se digita no `.env` —, e
não sobre o que o Postgres enxerga: a medição 2 mostra o servidor vendo
`172.18.0.1` numa conexão cujo host da URL é `localhost`, então validar o lado do
servidor seria validar a coisa errada. Como o harness é o cliente, e o cliente lê
a URL, `localhost` basta.

Lista aceita: `localhost`, `127.0.0.1` e `::1` (a forma `[::1]` na URL volta como
`::1` em `hostname`). O IP do bridge não entra: da máquina do desenvolvedor ele
não é o host que se digita. Se algum dia a suíte rodar de dentro de um container,
o endereço que ela usar entra na lista junto com o motivo.

A recusa diz o porquê, não só que recusou:

> a suíte só roda contra banco local — ela apaga bancos e altera papéis do
> cluster. `DATABASE_URL_ADMIN` aponta para `<host>`.

A validação é função pura de `string` para resultado, testável sem banco.

## O que muda nos testes que nomeiam o papel

Os testes se dividem em dois tipos, e a fatia trata cada um diferente.

**Quem é a conexão** — passa a ser `app_teste`, literalmente, sem constante
intermediária. Grep pelo nome do papel deve continuar achando o que existe:

- `tests/integracao/pool.test.ts:15` — "como app_conexao a guarda deixa passar"
- `tests/integracao/identidade.test.ts:60` — `{ id: '', papel: 'app_conexao' }`
- `tests/integracao/identidade.test.ts:87` — o `RESET ROLE` volta ao papel base

**Fatos de catálogo sobre o papel de produção** — continuam apontando para o
`app_conexao`, porque é sobre ele que a afirmação é feita:

- `tests/integracao/pool.test.ts:29` — `CONNECTION LIMIT` e timeout lidos de
  `pg_roles WHERE rolname = 'app_conexao'`

**O caso que depende da paridade** — `pool.test.ts:37`, o `53300`, passa a contar
`usename = 'app_teste'` (`pool.test.ts:40`), e só faz sentido porque a invariante garante o mesmo
limite. O comentário do teste diz isso.

Os controles negativos espalhados pela suíte ("`app_conexao` fora de
`comoUsuario` é `42501`", em `cep.test.ts:35`, `contato-politicas.test.ts:71`,
`empresas.test.ts:40`, `fila-politicas.test.ts:41`) mudam de nome no título e
continuam valendo pelo mesmo motivo — a sonda 1 mediu que o erro é o mesmo.

**O que a suíte deixa de garantir, dito em voz alta:** hoje ela exercita o papel
que a produção usa. Depois, exercita um papel cujos privilégios são os do
`app_conexao` por construção e cujos atributos a catraca confere. É mais fraco, e
é a troca que a fatia faz de propósito.

## Testes

TDD: vermelho antes de qualquer implementação, em todos os itens.

**Unitários** (`src/server/db/`):

- a conferência de host aceita `localhost`, `127.0.0.1` e `::1`
- a conferência roda dentro de `criarBancoDeTeste`, antes de qualquer
  `CREATE DATABASE` ou `ALTER ROLE` (integração: um host remoto não chega a criar
  banco nenhum)
- recusa host da Railway, e a mensagem nomeia o host recusado
- recusa host desconhecido qualquer
- `invariantes.ts`: `app_teste` ausente não gera violação
- `app_teste` com `CONNECTION LIMIT` diferente do `app_conexao` é violação única
- `app_teste` com `SUPERUSER` ou `BYPASSRLS` é violação
- `app_teste` membro de um papel além do `app_conexao` é violação
- `app_teste` com `setconfig` diferente é violação
- `app_teste` com a membresia em `app_conexao` sem `inherit_option` é violação
- `app_teste` com `rolinherit = false` e `inherit_option = true` **não** é violação
  (é o caso medido do `ALTER ROLE ... NOINHERIT` inócuo)

**Integração** (`tests/integracao/`):

- `app_teste` conecta e `current_user` é `app_teste`
- `app_teste` não alcança `app_usuario`: `SELECT` direto em `usuario` é `42501`
- `app_teste` executa as funções de `autenticacao` que o `app_conexao` executa,
  e a contagem das duas listas é igual
- `app_teste` não lê `autenticacao.sessao` direto
- controle negativo da paridade: conceder algo direto ao `app_teste` faz o
  checador acusar, e o teste desfaz o `GRANT` no `finally` (molde do
  `runner.test.ts:172`)
- o `53300` continua valendo, agora contando `app_teste`

**O que não ganha teste, e por quê:** o caminho de conserto preguiçoso
(`28P01` → `ALTER` → reconecta) não tem teste automatizado. Exercitá-lo exige
deixar o papel sem `LOGIN` no cluster no meio da suíte, que é a própria escrita
global que a fatia está tirando. Fica na verificação manual, passo 2.

## Verificação manual

Com o container de pé e o `.env.local` funcionando:

1. `npm run db:aplicar` e `npm run db:checar` — a `0021` entra, o checador passa.
2. `docker compose down -v && npm run db:subir && npm run db:aplicar`, depois a
   suíte. Ela deve passar, e o caminho de conserto roda uma vez. Rodar de novo:
   passa sem escrever.
3. **O teste da fatia:** com o `.env.local` funcionando, rodar
   `npm run test:integracao` inteiro e, sem tocar em mais nada, abrir `/usuarios`
   no `npm run dev`. Tem que funcionar. É a interrupção que aconteceu quatro
   vezes em 2026-09-09, e é o que a fatia existe para matar.
4. Apontar `DATABASE_URL_ADMIN` de um `.env.test.local` para um host remoto
   qualquer e rodar um arquivo de integração: recusa, com a mensagem que explica.
   Apagar o `.env.test.local` depois.
5. Na Railway, com `DATABASE_URL_ADMIN`, conferir que `app_teste` existe,
   `rolcanlogin = f` e `rolpassword IS NULL`.

## Dívida e gatilhos

**Fecha:**

- a linha "Harness grava senha `'teste'` em `app_conexao`, papel global do
  cluster" em `divida-tecnica.md`
- a seção "Harness com papel próprio — proposta, gatilho disparado", que vira
  ponteiro para esta spec
- a linha do gatilho na tabela: passa a **fechado em 2026-09-10**
- a menção a "nenhuma conferência de host" some junto, pela conferência da fatia
- a orientação "não rodar a suíte durante verificação manual sem avisar" sai, e
  com ela a memória que a registrou

**Continua aberto, sem mudança:**

- o ramo TLS sem cobertura
- a divergência 17 vs 18.6, que esta fatia herda: a sonda 1 rodou contra 17.11
- a observação de 2026-09-08 sem explicação (a `DATABASE_URL` que continuou
  funcionando depois da suíte). Esta fatia torna a pergunta irrelevante — o
  harness não mexe mais no `app_conexao` —, então a observação é **arquivada sem
  causa conhecida**, não resolvida.

**Gatilho novo:** nenhum. A fatia fecha o buraco em vez de registrar espera, que
foi a razão de recusar a opção de deixar a conferência de host para depois: o
gatilho seria "alguém apontar a suíte para produção", proxy de dor que erra para
tarde por definição — a dor é o estrago.

## Documentação e regras a cumprir

- `docs/db/0021.md` no padrão das outras migrações
- `docs/db/fundacao.md` ganha o `app_teste` no mapa de papéis, com a distinção
  entre papel da aplicação e papel do harness
- `docs/db/divida-tecnica.md` conforme a seção anterior
- R-010 (herança se revoga e se concede no grant) — a migração a aplica
- R-014 (o que existia por um motivo que sumiu, sai) — o `ALTER` repetido
- R-017 e R-019 (medição diz o que foi medido; valor singular é medição) — as
  três medições desta spec trazem a condição junto
- R-001 (nada entra na main sem CI verde), branch e PR
