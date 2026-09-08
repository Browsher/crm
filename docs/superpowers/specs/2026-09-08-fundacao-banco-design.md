# Fundação de banco — design

Data: 2026-09-08
Fatia: 1 de N do CRM para cinco vendedores por telefone
Referência primária: `C:\Users\ADM\projetos\crm-ch` (projeto anterior, do mesmo autor). Referência visual, mais tarde: `crm-disable/shadcn-admin`.

## 1. Objetivo

Entregar a base sobre a qual todas as features vão escrever e ler dado:

1. conexão com Postgres pela aplicação, com papel sem privilégio
2. runner de migrações somente-avante, com soma imutável
3. identidade por transação, aplicada pelo Postgres via RLS
4. tabela `usuario`, com funções de acesso, políticas e auditoria

Fora de escopo: UI, login, sessão, backup, seed além do primeiro gestor.

## 2. O que se mantém do `crm-ch` e o que se corta

O núcleo do `crm-ch` provou funcionar em produção e fica:

- papel de conexão sem `BYPASSRLS`, com guarda em runtime
- uma única função TypeScript abre transação com identidade e é o único caminho para dado de domínio
- funções de acesso `STABLE SECURITY DEFINER SET search_path = ''` com `COALESCE(..., false)`
- migrações SQL numeradas, imutáveis, com `BEGIN`/`COMMIT` nas pontas
- RLS habilitada em migração própria antes de qualquer política
- testes com controle negativo para cada invariante crítica

Dívidas do `crm-ch` cortadas desde o arquivo 0000:

| Dívida | Decisão aqui |
|---|---|
| Prosa dentro dos `.sql`, que virou estado divergente do banco e exigiu analisador léxico e soma dupla | Comentário no `.sql` limitado a uma linha de referência. O porquê vive em `docs/db/`. Soma única do arquivo inteiro. Sem léxico. |
| TLS com `rejectUnauthorized: false` | `PG_SSL` com dois valores, `off` e `verify`. Certificado que não valida se resolve com `PG_SSL_CA`. Não existe modo inseguro. |
| Detecção de ambiente por `url.includes('localhost')` em dois lugares com listas diferentes | `PG_SSL` explícito. Uma função monta a configuração para pool e runner. |
| Pool singleton em `let` de módulo, órfão no hot reload | Singleton em `globalThis` em desenvolvimento. |
| Papéis `authenticated` e `anon` herdados do Supabase | `app_conexao` e `app_usuario`. Sem papel anônimo nesta fatia. |
| `AUTH_SECRET` obrigatória sem consumidor | Não existe. Nenhuma variável de ambiente sem consumidor. |
| Concorrência sem cobertura, PGlite como único substrato | Postgres real em todo lugar: container local e `services: postgres` no CI. |
| Nenhuma verificação automática pega divergência com o banco real | O PR roda `db:pendentes` somente-leitura contra a Railway. |

Motivo do recomeço, registrado: o `crm-ch` foi abandonado porque o CI não bloqueava merge (repositório privado em plano gratuito) e o projeto foi ficando pesado sem confiança para mexer. Aqui a main é protegida e o CI verde é obrigatório.

## 3. Estrutura

```
db/migracoes/NNNN_nome.sql          SQL puro, imutável depois de aplicado
docs/db/fundacao.md                 porquê da fundação
docs/db/NNNN.md                     porquê de cada migração
src/server/db/env.ts                lê e valida env do servidor, preguiçoso
src/server/db/ssl.ts                monta config TLS a partir de PG_SSL e PG_SSL_CA
src/server/db/pool.ts               pool pg, singleton em globalThis, guarda de papel
src/server/db/como-usuario.ts       transação com identidade
src/server/db/migracoes/            runner como módulo testável: aplicar, pendentes, checar, invariantes
src/server/db/admin.ts              cliente pg direto para DATABASE_URL_ADMIN: runner, seed, harness. Sem pool, sem guarda de papel
scripts/db/*.mjs                    CLIs finos que chamam o módulo
tests/integracao/                   contra Postgres real
docker-compose.yml                  postgres:17 local
.env.test                           versionado, só valores do container local
```

`server/` e não `lib/` porque nada disso pode ser importado por componente cliente. `pool.ts` é só da aplicação e conecta sempre como `app_conexao`. Runner, seed e harness de teste conectam como admin por `admin.ts`, um `pg.Client` direto por operação: a guarda de papel do `pool.ts` derrubaria qualquer processo conectado como superusuário, e é isso que ela deve fazer. O runner não depende de Next, para rodar em Node puro. Os `.mjs` só fazem parse de argumentos.

Fronteira do projeto: `features/` não importa de outra `features/`. O que é comum sobe para `lib/` ou `server/`.

## 4. Variáveis de ambiente

| Variável | Quem usa | Papel no banco |
|---|---|---|
| `DATABASE_URL` | aplicação | `app_conexao` |
| `DATABASE_URL_ADMIN` | runner, seed, harness de teste. Só máquina do dev e CI local. Nunca na Vercel, nunca em secret do GitHub. | superusuário ou dono |
| `DATABASE_URL_CONFERENCIA` | CI, passo de leitura contra a Railway. Secret do GitHub. | `app_conferencia`, só `SELECT` em `_migracao` |
| `PG_SSL` | pool e runner | `off` (container local) ou `verify` (padrão) |
| `PG_SSL_CA` | pool e runner | caminho ou conteúdo PEM do CA, quando o servidor não usa CA pública |

Validação com Zod, preguiçosa: na primeira chamada, não na avaliação do módulo, porque `next build` avalia módulos sem env. O CI roda `next build` sem nenhuma env de propósito. Exceção registrada: se um dia entrar variável `NEXT_PUBLIC_*`, ela valida na avaliação do módulo, porque build sem ela produz artefato quebrado em vez de erro.

A `.env.local` atual tem `DATABASE_PUBLIC_URL`, nome da Railway. Passa a `DATABASE_URL`.

## 5. Conexão

`pg.Pool` com `max: 10`, `connectionTimeoutMillis: 10000`, `idleTimeoutMillis: 30000`, `keepAlive: true`, `statement_timeout: 30000`. Valores que sobreviveram à produção do `crm-ch`.

Singleton em `globalThis` em desenvolvimento, para sobreviver ao hot reload sem pool órfão. `fecharPool()` para testes e desligamento.

Guarda de papel, uma vez por processo, na primeira conexão:

```sql
SELECT r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user
```

Se qualquer um for verdadeiro, lança e derruba a aplicação. Um pool conectado como superusuário ignora toda política e nenhum teste de RLS pega isso.

TLS: `PG_SSL=off` desliga. `PG_SSL=verify` valida contra CAs do sistema, ou contra `PG_SSL_CA` quando informado. Ponto a verificar no plano: se o proxy público da Railway não validar contra CA pública nem oferecer CA para baixar, a solução é `PG_SSL_CA`, nunca desligar verificação em conexão remota.

## 6. Identidade por transação

### 6.1 Assinatura

```ts
type Executar = <T extends QueryResultRow>(sql: string, parametros?: unknown[]) => Promise<{ linhas: T[]; afetadas: number }>

function comoUsuario<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T>
```

### 6.2 Sequência, no mesmo cliente do pool

1. Valida `usuarioId` como UUID por regex. Inválido lança: é falha de programação, não regra de negócio.
2. `connect()`. Guarda de papel na primeira vez do processo.
3. `BEGIN`.
4. `SELECT set_config('app.usuario_id', $1, true), set_config('role', 'app_usuario', true)`. Uma ida só. Identidade como parâmetro, nunca interpolada. `role` é parâmetro de configuração comum, e `SET ROLE` é só açúcar sobre ele.
5. Executa `trabalho(executar)`. Cada `executar` roda no mesmo cliente.
6. `COMMIT`. Em erro, `ROLLBACK` e relança.
7. `finally`: liga a flag `encerrada`, `RESET ROLE`, `RESET ALL`, `release()`. Se o `ROLLBACK` também falhou, `release(erro)` para o pool descartar a conexão.

### 6.3 Regras

- É o único caminho para dado de domínio. Não existe consulta sem identidade nesta fatia. Quando a fatia de login precisar, ela ganha função própria restrita a chamar funções `SECURITY DEFINER`.
- `trabalho` recebe só `executar`, nunca o cliente. Ninguém dá `COMMIT` ou `SET ROLE` por dentro.
- `executar` chamado depois que `comoUsuario` retornou lança erro nomeado (`ExecutarForaDaTransacao`) antes de tocar no cliente. É o vazamento do lado JavaScript, equivalente ao `SET` sem `LOCAL`.
- Nada de `SET` sem `LOCAL` em código de aplicação.

### 6.4 Por que `set_config(..., true)` e por que `RESET ROLE`

`is_local = true` equivale a `SET LOCAL`: o valor vale até o fim da transação e volta ao anterior tanto no `COMMIT` quanto no `ROLLBACK`, inclusive após erro no meio. Fora de transação explícita, o valor se aplica à transação implícita daquele comando e morre no mesmo instante, por isso tem que rodar no mesmo cliente, depois do `BEGIN`, nunca via `pool.query`.

`RESET ALL` não restaura `role`: o parâmetro é marcado no Postgres com `GUC_NO_RESET_ALL`, assim como `session_authorization`. O `RESET ALL` do `crm-ch` nunca protegeu o papel; não deu problema porque `SET LOCAL ROLE` já voltava sozinho. O cinto e suspensório de verdade é `RESET ROLE` explícito.

Isso é hipótese até o teste confirmar contra o container. Se o teste contradisser, esta seção muda, não o teste.

### 6.5 Do lado do banco

```sql
CREATE FUNCTION usuario_atual() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT NULLIF(current_setting('app.usuario_id', true), '')::uuid $$;
```

É a única função que sabe de onde a identidade vem. Trocar o mecanismo um dia é trocar essa função.

### 6.6 Contrato de erro para as próximas fatias

Falha de infraestrutura lança. Violação de política aparece de dois jeitos que a camada acima precisa distinguir:

- `INSERT` ou `WITH CHECK` recusado: erro do Postgres com código `42501`.
- `UPDATE` que não encontra a linha por causa do `USING`: `afetadas: 0`, sem erro.

`comoUsuario` não traduz nenhum dos dois. Quem traduz para `{ ok, motivo }` é o repositório da feature.

## 7. Papéis de banco

| Papel | Atributos | Função |
|---|---|---|
| `app_conexao` | `LOGIN NOBYPASSRLS`, dono de nada | está na `DATABASE_URL`. Herda `app_usuario`. |
| `app_usuario` | `NOLOGIN` | recebe os GRANTs nas tabelas de domínio. Alvo do `set_config('role', ...)`. |
| `app_conferencia` | `NOLOGIN`, criado pelo runner, não por migração | `SELECT` só em `_migracao`. |

Sem papel anônimo: não há requisição anônima nesta fatia. Os dois papéis de aplicação já entram agora porque a fatia de login precisa exatamente dessa fronteira: `app_conexao` alcançará `autenticacao`, `app_usuario` não. Introduzir depois seria reescrever `comoUsuario` e revisar todo GRANT.

Senha nunca vai em migração: o repositório é público e a migração é imutável. Papel nasce sem senha; `db:senha-app` e `db:senha-conferencia` fazem `ALTER ROLE ... LOGIN PASSWORD` à mão, uma vez por ambiente.

## 8. Tabela `usuario`

```sql
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
```

Decisões:

- `id` gerado pelo banco, independente de credencial. A fatia de login cria `autenticacao.credencial` e `autenticacao.sessao` com FK apontando para `usuario`, não o inverso. Quem manda é o usuário do domínio; login é detalhe que aponta para ele. Some o trigger do `crm-ch` que criava usuário a partir de credencial.
- Sem `senha_provisoria_pendente`. Entra na fatia de login, junto com `pode_escrever()`, seu consumidor.
- E-mail normalizado por CHECK, não pela aplicação. A regra tem um dono só. A aplicação normaliza antes de inserir; se não normalizar, recebe erro de constraint em vez de aceitar em silêncio.
- Dois papéis de domínio em CHECK: gestor acumula admin. Para cinco pessoas, três níveis é ruído.
- `ativo`: conta desativa, nunca apaga. As políticas consultam a coluna a cada consulta, então desativação tem efeito imediato.
- `criado_por` anulável de propósito, sem CHECK exigindo preenchimento, para o seed do primeiro gestor funcionar.
- Nenhuma política de DELETE em tabela nenhuma.

Índices: `usuario_nome_idx (nome)`, `usuario_gestor_ativo_idx (papel) WHERE ativo`.

### 8.1 Funções de acesso

Todas `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''`, `REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO app_usuario`:

- `usuario_atual() → uuid`
- `pode_ler() → boolean`: `COALESCE(u.ativo, false)` para `u.id = usuario_atual()`
- `eh_gestor() → boolean`: `COALESCE(u.papel = 'gestor' AND u.ativo, false)`

Sem `pode_escrever()`: sem a marca de senha provisória seria idêntica a `pode_ler()`. A fatia de login cria a função e faz `ALTER POLICY` nas políticas de escrita.

Por que assim: `SECURITY DEFINER` roda como dono de `usuario`, para quem RLS não vale, evitando recursão de política que consulta a própria tabela. `STABLE` evita reavaliação por linha. `search_path = ''` obriga qualificar `public.usuario` e fecha sequestro de esquema. `COALESCE(..., false)` porque NULL em política não nega. Precondição: `usuario` nunca recebe `FORCE ROW LEVEL SECURITY`, sob pena de recursão infinita. É invariante automatizada em 9.7.

### 8.2 Auditoria

Função `definir_auditoria()` e trigger `BEFORE INSERT OR UPDATE ON usuario`:

- INSERT: `criado_em = now()`, `criado_por = usuario_atual()`. Valor vindo de fora é sobrescrito. Sem identidade (seed como admin), `criado_por` fica nulo.
- UPDATE: `criado_em` e `criado_por` congelados no valor antigo. `atualizado_em = now()`, `atualizado_por = usuario_atual()`.

É o consumidor natural de `usuario_atual()` e a prova de que a identidade chegou ao banco.

### 8.3 RLS e políticas

`ENABLE ROW LEVEL SECURITY` em migração própria, antes de qualquer política. Política criada sobre tabela sem RLS é aceita e fica inerte, sem erro. Sem `FORCE`. Estado intermediário, RLS sem política, nega tudo, e isso é correto.

`GRANT SELECT, INSERT, UPDATE ON usuario TO app_usuario`. Sem DELETE.

| Política | Comando | Expressão |
|---|---|---|
| `usuario_ler` | SELECT | USING `pode_ler() AND (id = usuario_atual() OR eh_gestor())` |
| `usuario_criar` | INSERT | WITH CHECK `eh_gestor()` |
| `usuario_alterar` | UPDATE | USING e WITH CHECK `eh_gestor() AND id <> usuario_atual()` |

As três condições de `usuario_alterar`: vendedor não escala papel; gestor não se rebaixa nem se desativa; sem troca de papel no meio da transação. USING e WITH CHECK iguais porque USING sem WITH CHECK permite mover a linha para fora da própria visibilidade.

**Limitação conhecida**: `usuario_alterar` impede a pessoa de editar o próprio nome, não só papel e situação. Quando houver tela de perfil, a solução é uma política separada que permite alterar o próprio nome com WITH CHECK que congela `papel` e `ativo`.

`usuario_publico` (view com `id` e `nome`) fica fora até ter consumidor.

## 9. Migrações

### 9.1 Arquivos desta fatia

| Arquivo | Conteúdo |
|---|---|
| `0000_papeis.sql` | `app_conexao`, `app_usuario`, `GRANT app_usuario TO app_conexao`, `GRANT USAGE ON SCHEMA public TO app_usuario`. Criação idempotente. |
| `0001_usuario.sql` | tabela, índices, GRANTs |
| `0002_funcoes_acesso.sql` | `usuario_atual`, `pode_ler`, `eh_gestor`, REVOKE e GRANT |
| `0003_auditoria.sql` | `definir_auditoria()` e trigger |
| `0004_habilitar_rls.sql` | `ENABLE ROW LEVEL SECURITY` em `usuario`, nada mais |
| `0005_politicas_usuario.sql` | as três políticas |

Cada `docs/db/NNNN.md` correspondente carrega o porquê.

### 9.2 Regras

1. Uma alteração de schema é um arquivo numerado. Nunca à mão, nunca pelo painel.
2. Somente avante. Sem arquivo de reversão. Corrigir é acrescentar migração nova.
3. Migração aplicada é imutável, byte a byte, inclusive comentário. O runner recusa qualquer diferença.
4. Comentário no `.sql`: no máximo uma linha no topo, começando com `--`, até 120 caracteres, apontando para `docs/db/NNNN.md`.
5. `BEGIN;` na primeira linha, `COMMIT;` na última. Nenhum controle de transação no meio.
6. Apenas Postgres padrão. Nenhum schema nem papel de fornecedor.
7. PK `uuid DEFAULT gen_random_uuid()`, salvo PK que também é FK ou PK textual de tabela de referência.
8. Toda tabela nova entra com RLS na mesma migração ou na seguinte. O runner nomeia quem ficou sem.

### 9.3 Tabela de controle

Criada pelo runner, não por migração:

```sql
CREATE TABLE IF NOT EXISTS _migracao (
  nome        text PRIMARY KEY,
  soma        text NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now()
);
```

`soma` = `sha256` do arquivo inteiro, em hex. `REVOKE ALL` de `app_conexao` e `app_usuario`. `GRANT SELECT TO app_conferencia`. O runner confere ao fim que `app_conexao` e `app_usuario` não alcançam a tabela, porque `_migracao` é a única tabela excluída da conferência de RLS, e a exclusão só é honesta se ela for inalcançável.

### 9.4 Aplicação atômica

O registro em `_migracao` acontece na mesma transação da migração, e o runner é dono dessa transação:

1. Calcula a soma do arquivo em disco. É essa que vai para `_migracao` e que a próxima execução compara.
2. Remove a primeira e a última linha, que o `db:checar` garantiu serem exatamente `BEGIN;` e `COMMIT;`. Remoção posicional, sem parse de SQL.
3. `BEGIN` próprio. Corpo como um bloco só. `INSERT INTO _migracao` parametrizado, mesmo cliente. `COMMIT`.

DDL é transacional no Postgres: ou schema mudou e registro gravou, ou nada aconteceu. O arquivo mantém `BEGIN;`/`COMMIT;` para ser atômico também quando rodado à mão pelo `psql`.

### 9.5 Comandos

| Comando | Faz |
|---|---|
| `db:aplicar` | Compara com `_migracao`. Qualquer aplicada com soma diferente: lista e sai com 1 sem aplicar nada. Pendentes em ordem, atômicas. Falha em um arquivo para tudo ali. Ao fim, roda as invariantes. |
| `db:pendentes` | Mesma leitura, sem escrever. Sai com 1 se há divergência de soma. Sai com 0 se há pendentes, imprimindo quais. Funciona com `DATABASE_URL_CONFERENCIA`. |
| `db:checar` | Estático, sem banco. Ver 9.6. |
| `db:seed:gestor` | Cria o primeiro gestor com `DATABASE_URL_ADMIN` via `admin.ts`, nunca pelo `pool.ts`. `criado_por` nulo. Recusa se já existe gestor ativo. |
| `db:senha -- <app_conexao\|app_conferencia> <senha>` | `ALTER ROLE ... LOGIN PASSWORD`, à mão, uma vez por ambiente. Um comando com argumento, para não duplicar código. |
| `db:subir`, `db:derrubar` | `docker compose up -d` e `down` do Postgres local. |

Aplicar na Railway é manual, com `DATABASE_URL_ADMIN` da máquina do dev. Migrar para o CI aplicar quando entrar mais gente no projeto.

### 9.6 Checador estático

- Nome `NNNN_nome_com_underscore.sql`, numeração contígua a partir de `0000`, sem repetição.
- Primeira linha `BEGIN;`, última `COMMIT;`.
- `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` só na primeira e na última linha. Um `COMMIT` no meio encerraria a transação do runner e reabriria a janela.
- Sem `DROP TABLE` nem `DROP COLUMN`. `DROP INDEX` e `DROP CONSTRAINT` são permitidos.
- Sem comandos que o Postgres recusa em transação: `CREATE INDEX CONCURRENTLY`, `VACUUM`, `CREATE DATABASE`, `ALTER SYSTEM`.
- Sem referência a schema ou papel de fornecedor. Lista de exceções vazia.
- PK com `gen_random_uuid()` fora das exceções reconhecidas.
- Comentário limitado a uma linha curta no topo. Busca textual simples, sem léxico, porque a regra anterior garante que não há outro comentário.

### 9.7 Invariantes pós-aplicação

Módulo único, chamado pelo fim do `db:aplicar` e pelo teste de schema:

- toda tabela de `public` exceto `_migracao` tem `relrowsecurity`
- nenhuma tabela tem `relforcerowsecurity`: `FORCE ROW LEVEL SECURITY` em `usuario` causa recursão infinita nas funções de acesso (seção 8.1), e isso quebra em produção, não no lint
- `_migracao` inalcançável por `app_conexao` e `app_usuario`
- `app_conexao` existe, sem `rolsuper`, sem `rolbypassrls`, dono de nenhuma tabela
- funções de acesso com `prosecdef` e `search_path` vazio em `proconfig`

## 10. Testes

### 10.1 Substrato

Postgres real em todo lugar. `docker-compose.yml` com `postgres:17`, porta 5432, usuário e senha `postgres`, banco `crm`. No CI, `services: postgres:17` com health check.

`.env.test` versionado com `DATABASE_URL_ADMIN` do container e `PG_SSL=off`. Comentário no topo do arquivo: **estas credenciais valem só para o container local e nunca podem ser as mesmas da Railway ou de qualquer banco remoto**. O `.gitignore` ganha exceção `!.env.test`.

### 10.2 Configuração

Vitest com projetos:

- `unitario`: `src/**/*.test.ts`, ambiente node, sem banco.
- `integracao`: `tests/integracao/**/*.test.ts`, **serial** (`fileParallelism: false`), `testTimeout` 30s, `hookTimeout` 60s. Serial porque papéis são globais no cluster e dois arquivos criando `app_conexao` ao mesmo tempo disputam `pg_authid`.

jsdom e plugin React ficam para um terceiro projeto quando houver componente.

### 10.3 Harness

`criarBancoDeTeste()` conecta como admin no banco `postgres`, cria `teste_<hex>`, roda o runner real, define senha de teste para `app_conexao`, e devolve:

- `sql(texto, params)`: como dono, RLS ignorada. Preparar cenário e controles negativos.
- `comoUsuario`: o módulo real de `src/server/db`, pool apontando para o banco de teste como `app_conexao`. RLS vale.
- `derrubar()`: fecha pool e apaga o banco.

Dois modos. Um modo "identidade sem RLS" só entra se um teste concreto precisar.

### 10.4 Cobertura de integração

- **Runner**: aplica do zero; segunda execução não faz nada; arquivo alterado recusado sem aplicar pendentes; falha na última instrução deixa schema e `_migracao` intactos; `pendentes` não escreve; `_migracao` inalcançável.
- **Conexão**: guarda derruba quando conectado como superusuário (controle negativo com URL admin).
- **Identidade**: vendedor vê só a si; gestor vê todos; identidade não sobrevive à transação; alternância de usuários na mesma conexão sem contaminação; `SET` sem `LOCAL` vaza (negativo); papel volta após `COMMIT`; papel volta após `ROLLBACK` por erro no meio; `RESET ALL` sozinho não derruba `SET ROLE` sem `LOCAL` (negativo); `executar` guardado lança `ExecutarForaDaTransacao` após o retorno.
- **Políticas**: vendedor não insere; gestor insere; gestor não altera a si mesmo; vendedor não altera ninguém; ninguém apaga; `UPDATE` invisível dá `afetadas: 0` sem erro.
- **Auditoria**: `criado_por` vem da identidade; valor forjado no INSERT é sobrescrito; `criado_por` congelado no UPDATE; `atualizado_por` preenchido.
- **Schema**: invariantes de 9.7; e-mail fora do padrão recusado.

### 10.5 Cobertura unitária

Regras do `db:checar` contra arquivos em memória; cálculo da soma; remoção posicional de `BEGIN;`/`COMMIT;`; validação de UUID; montagem da config TLS a partir de `PG_SSL` e `PG_SSL_CA`; validação de env.

## 11. CI

Um job com `services: postgres:17`. Passos:

1. `npm ci`
2. typecheck
3. lint
4. `db:checar`
5. testes, unitário e integração, com `DATABASE_URL_ADMIN` apontando para o serviço
6. `next build` sem nenhuma env, para garantir que a validação continua preguiçosa
7. `db:pendentes` contra a Railway com `DATABASE_URL_CONFERENCIA` de secret

Regra do passo 7:

- PR de fork: secret não existe por padrão do GitHub. Pula, e escreve no resumo do job (`GITHUB_STEP_SUMMARY`) que a conferência não rodou e por quê.
- PR do próprio repositório sem secret: **falha**. Só acontece se o secret sumiu ou expirou, e falhar é a única forma de isso não passar despercebido.
- Quando roda: escreve no resumo do job a lista de pendentes ou "nada pendente", para o resultado ser visível sem abrir o log.

## 12. O que esta fatia entrega para as próximas

- `comoUsuario` como único ponto de entrada para dado de domínio. Repositórios de feature recebem `executar`, nunca o pool.
- Contrato de erro da seção 6.6.
- Convenção de migração da seção 9.2.
- `docs/db/` com o porquê.

Registrado para a fatia de login:

- Schema `autenticacao` com `credencial` e `sessao`, ambas com FK para `usuario`.
- `senha_provisoria_pendente` em `usuario`, junto com `pode_escrever()` e `ALTER POLICY` nas políticas de escrita.
- Função de consulta sem identidade, restrita a `SECURITY DEFINER`, para login e resolução de sessão. `app_conexao` alcança `autenticacao`, `app_usuario` não.
- Limite de tentativas de login. Papel anônimo só se houver requisição anônima.

## 13. Limitações conhecidas

- `usuario_alterar` bloqueia edição do próprio nome (seção 8.3).
- `criado_por` anulável, sem CHECK (seção 8).
- `usuario_publico` fora até ter consumidor.
- Aplicação na Railway manual.
- Sem teste de corrida nesta fatia: não há operação concorrente ainda. Entra com a primeira fila.
- Comportamento de `RESET ALL` sobre `role` é hipótese até o teste confirmar (seção 6.4).
- TLS contra a Railway: `verify` pode exigir `PG_SSL_CA`. Verificar no plano.
