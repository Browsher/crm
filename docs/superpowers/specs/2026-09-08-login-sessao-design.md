# Fatia 0b — login e sessão: design

Brainstorm de 2026-09-08. Constrói sobre a fundação
(`2026-09-08-fundacao-banco-design.md`) e sobre a 0a.1
(`2026-09-08-conexao-sem-heranca-design.md`), que precisa estar aplicada:
a 0007 numera depois da 0006 e depende de `app_conexao` sem herança.

## 1. Objetivo

Uma pessoa com conta em `usuario` entra com e-mail e senha, recebe uma sessão
em cookie, e toda tela protegida sabe quem ela é. O primeiro gestor ganha
senha pelo seed. Senha provisória obriga troca no primeiro acesso. Tentativas
de login têm limite. Nada além disso.

## 2. O que já estava decidido e não se reabre

- `credencial` e `sessao` com FK para `usuario`, não o inverso.
- Funções `SECURITY DEFINER` para tudo que roda sem identidade. `app_conexao`
  alcança `autenticacao`; `app_usuario` não.
- Hash de senha com `scrypt` do `node:crypto`. Sem biblioteca de auth.
- Sem papel anônimo: login roda como `app_conexao` chamando função definidora.
- `senha_provisoria_pendente` em `usuario`, com `pode_escrever()` e
  `ALTER POLICY` nas políticas de escrita.

## 3. Decisões deste brainstorm

| Decisão | Escolha | Por quê |
|---|---|---|
| Senha do primeiro gestor | seed gera provisória, imprime uma vez, marca pendente | sem segredo em `argv`; mesmo fluxo que o gestor usará para vendedores |
| Saída do seed | senha sozinha no stdout; aviso "não será mostrada de novo" no stderr | copiar ou redirecionar pega só a senha |
| O que `sessao` guarda | `sha256(token)`, nunca o token | quem lê a tabela (`DATABASE_URL`, `RESET ROLE` por injeção) não ganha sessão utilizável |
| Por que SHA-256 e não KDF | token tem 256 bits de aleatoriedade; KDF lenta serve para entrada de baixa entropia | `scrypt` ali custaria 300ms por requisição para proteção nenhuma. **Não "melhorar" depois.** |
| Validade | 30 dias fixos, sem renovação | cinco pessoas refazem login uma vez por mês |
| Desativação | `sessao_atual` recusa usuário inativo na hora | cair no login em vez de ficar numa interface vazia |
| Troca de senha | derruba as outras sessões do usuário, mantém a atual | troca por suspeita de vazamento não pode deixar a sessão do atacante viva |
| Limite de tentativas | por e-mail (10) e por origem (30), janela de 15 min, bloqueio temporário | cada contagem sozinha é contornável; permanente vira negação de serviço |
| Acerto zera | só as falhas do e-mail, nunca da origem | conta válida não pode zerar o contador de varredura |
| Mensagem de bloqueio | explícita, com tempo restante | legítimo precisa entender; atacante já sabe pelo comportamento. **Decidido, não acidental.** |
| Existência de e-mail | indistinguível por mensagem, tempo e bloqueio | mesma mensagem; `HASH_DESCARTAVEL` iguala o tempo; contagem por string de e-mail, exista ou não |
| Proxy | só presença do cookie | autoridade fica na resolução de sessão, uma ida por requisição via `cache()` |
| Conexão sem identidade | `chamar(nome, args)` com mapa fechado; sem `executar` genérico | restrição por construção no tipo e no GRANT, não por convenção |
| `credencial_definir` | fora desta fatia | chamável por `app_conexao` sem verificação trocaria a senha de qualquer um; entra na fatia de usuários com `eh_gestor()` por dentro |
| `senha_trocar` | deriva o usuário do `token_hash` da sessão | só troca a senha de quem tem a sessão em mãos; Node exige a senha atual antes |
| Senha provisória pendente | banco nega escrita, aplicação nega tudo | banco é rede de segurança; tela dá a experiência |
| Teste de tela | actions e proxy em Node; sem teste de render | dois formulários de três campos; jsdom entra quando houver componente com lógica |

## 4. Migrações

### 4.1 `0007_autenticacao.sql`

Schema `autenticacao`. Três tabelas, todas com `ENABLE ROW LEVEL SECURITY` e
**nenhuma política**: só a dona toca nelas, por dentro das funções.

```sql
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
GRANT USAGE ON SCHEMA autenticacao TO app_conexao;
```

Nenhum privilégio de tabela para nenhum papel. `app_usuario` sem `USAGE`.

### 4.2 `0008_senha_provisoria.sql`

```sql
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
```

`FUNCOES_DE_ACESSO` em `invariantes.ts` ganha `pode_escrever`.

### 4.3 `0009_funcoes_autenticacao.sql`

Sete funções, todas `SECURITY DEFINER SET search_path = ''`,
`REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO app_conexao`. Corpo em
`plpgsql` quando precisa de lógica, `sql` quando é uma consulta. Sem
comentário no `.sql`; o porquê fica em `docs/db/0009.md`.

| Função | Volatilidade | Devolve | Faz |
|---|---|---|---|
| `credencial_por_email(p_email text)` | STABLE | `usuario_id, senha_hash, ativo, senha_provisoria_pendente` | join `credencial` × `usuario` por e-mail; zero linhas se não existe |
| `bloqueio_login(p_email text, p_origem text)` | STABLE | `bloqueado boolean, segundos_restantes int` | conta falhas na janela por e-mail e por origem; só lê |
| `registrar_tentativa_login(p_email text, p_origem text, p_sucesso boolean)` | VOLATILE | o mesmo par | insere; acerto apaga falhas **do e-mail**; devolve o bloqueio já contando esta |
| `sessao_criar(p_usuario_id uuid, p_token_hash text, p_expira_em timestamptz)` | VOLATILE | `void` | insere |
| `sessao_atual(p_token_hash text)` | STABLE | `usuario_id, nome, email, papel, ativo, senha_provisoria_pendente, expira_em` | join com `usuario`; zero linhas se expirada ou inativo |
| `sessao_encerrar(p_token_hash text)` | VOLATILE | `void` | apaga |
| `senha_trocar(p_token_hash text, p_hash_novo text)` | VOLATILE | `uuid` | deriva usuário da sessão viva; grava hash; zera a marca; apaga as outras sessões; nulo se não há sessão viva |

Constantes do bloqueio dentro das duas funções: `c_limite_email = 10`,
`c_limite_origem = 30`, `c_janela = interval '15 minutes'`. E-mail normalizado
(`lower(btrim())`) por dentro, para a contagem não depender da aplicação.
`segundos_restantes` = `max(ocorreu_em) + janela - now()`, nunca negativo.

Por que separar `bloqueio_login` de `registrar_tentativa_login`: o bloqueio
tem que ser lido **antes** do `scrypt`, e o registro só acontece **depois** de
saber o resultado. Uma função só faria as duas coisas na ordem errada.

## 5. Invariantes novas

- `app_conexao` sem privilégio de tabela em `autenticacao`. Negativo: `GRANT
  SELECT` à mão e a invariante nomeia.
- `pode_escrever` obrigatória entre as funções de acesso.
- Nenhuma política em tabela de `autenticacao`. Regra nossa: política ali
  significa que alguém abriu a tabela para um papel.

## 6. Código

```
src/server/db/sem-identidade.ts          chamar(nome, args): mapa fechado e tipado
src/server/autenticacao/senha.ts          scrypt, validação, provisória, HASH_DESCARTAVEL
src/server/autenticacao/sessao.ts         token, sha256, criar/ler/encerrar via chamar
src/server/autenticacao/entrar.ts         regra de login
src/server/autenticacao/trocar-senha.ts   regra da troca
src/server/autenticacao/acesso.ts         avaliarAcesso(sessao, exigencia), pura
src/server/autenticacao/guarda.ts         usuarioAtual() com cache(), exigirSessao/Usuario/Gestor
src/server/autenticacao/cookie.ts         nome, opções, ler/gravar/apagar via next/headers
src/server/autenticacao/origem.ts         origemDe(headers)
proxy.ts                                   só presença do cookie
app/login/page.tsx, acao.ts                formulário fino + server action
app/trocar-senha/page.tsx, acao.ts
app/sair/route.ts                          POST: encerra e redireciona
app/page.tsx                               protegida mínima: nome, papel, botão sair
```

`server/` e não `features/`: guarda e sessão são consumidos por toda tela
futura. Só `cookie.ts`, `guarda.ts` e o que está em `app/` importam de
`next/*`; o resto roda em Node puro e é o que os testes de integração cobrem.

### 6.1 `chamar`

```ts
const FUNCOES = {
  credencial_por_email: 1,
  bloqueio_login: 2,
  registrar_tentativa_login: 3,
  sessao_criar: 3,
  sessao_atual: 1,
  sessao_encerrar: 1,
  senha_trocar: 2,
} as const

function chamar<N extends keyof typeof FUNCOES, T extends QueryResultRow>(
  nome: N, args: Tupla<(typeof FUNCOES)[N]>,
): Promise<T[]>
```

Monta `SELECT * FROM autenticacao.${nome}($1..$n)` com `nome` do mapa e `n`
da aridade. Nome fora do mapa lança `FuncaoDesconhecida` antes de tocar o
pool; aridade errada também. Sem `BEGIN`, sem `set_config`: uma ida, conexão
devolvida. Usa `conectarVerificado`, então a guarda de papel continua.

Não existe `executar` neste módulo. Quem precisar de SQL livre sem identidade
está pedindo a coisa errada.

### 6.2 Senha

- `scrypt` N=2¹⁷, r=8, p=1, `maxmem = 128 * N * r * 2` explícito, senão o
  Node recusa com "Invalid scrypt params".
- NFKC antes do hash. Formato `scrypt$N=…,r=…,p=…$sal_b64$chave_b64`, para
  mudança de parâmetro não invalidar hash antigo. Sem rehash no login.
- `validarSenha`: 8 a 128 caracteres, não só espaço. O máximo existe para
  ninguém mandar um megabyte para o `scrypt`.
- `gerarSenhaProvisoria`: três blocos de quatro, alfabeto sem `0 O 1 l I`,
  `randomInt`.
- `HASH_DESCARTAVEL`: hash real de uma senha aleatória, gerado uma vez e fixo
  no código. Verificado quando o e-mail não existe, para o tempo ser o mesmo.
- `verificarSenha` com `timingSafeEqual`; devolve `boolean`.

### 6.3 Sessão e cookie

- Token: `randomBytes(32).toString('base64url')`. Banco: `sha256` em hex.
- Cookie `crm_sessao`, `httpOnly`, `sameSite=lax`, `secure` fora de
  desenvolvimento, `path=/`, `expires` igual a `expira_em`.
- Origem: primeiro endereço de `x-forwarded-for`, senão `x-real-ip`, senão
  nulo. Na Vercel o primeiro valor é o cliente.

## 7. Fluxos

**Login**, `entrar({ email, senha, origem })`:

1. Normaliza e-mail. Senha vazia ou acima de 128: `credenciais_invalidas` sem
   tocar o banco.
2. `bloqueio_login`. Bloqueado: `{ ok: false, motivo: 'bloqueado',
   segundosRestantes }`. Sem `scrypt`, sem registro.
3. `credencial_por_email`. Zero linhas: verifica contra `HASH_DESCARTAVEL` e
   segue como falha. Inativo: falha, sem mensagem própria.
4. `registrar_tentativa_login(email, origem, sucesso)`. Falha que bloqueou
   agora: `bloqueado`; senão `credenciais_invalidas`.
5. Sucesso: token, `sessao_criar(usuario_id, sha256(token), now + 30d)`.
   `{ ok: true, token, expiraEm, precisaTrocarSenha }`.

A action grava o cookie e redireciona para `/trocar-senha` ou `/`.

**Resolução**: `lerSessao(token)` → `sessao_atual(sha256(token))` → `null`
se zero linhas. `usuarioAtual()` lê o cookie, chama `lerSessao`, dentro de
`cache()`.

**Guarda**: `avaliarAcesso(sessao, 'sessao' | 'usuario' | 'gestor')`:

| Estado | Exigência | Resultado |
|---|---|---|
| sem sessão | qualquer | `sem_sessao`, destino `/login` |
| pendente | `usuario` ou `gestor` | `senha_provisoria`, destino `/trocar-senha` |
| pendente | `sessao` | ok |
| não gestor | `gestor` | `so_gestor`, destino `/` |

`exigirX` chama `redirect(destino)`. Cookie presente com sessão nula é apagado
antes do redirect, senão o proxy manda de volta para `/`.

**Troca**, `trocarSenha({ token, senhaAtual, senhaNova })`:

1. `validarSenha(senhaNova)`; igual à atual conta como falta. Falha:
   `senha_fraca` com `faltas`.
2. `sessao_atual`. Nulo: `sem_sessao`.
3. `credencial_por_email(email da sessão)`, verifica `senhaAtual`. Falha:
   `senha_atual_invalida`.
4. `senha_trocar(hash, gerarHash(senhaNova))`. Nulo: `sem_sessao`. Sucesso:
   `{ ok: true }`. A sessão atual sobrevive.

**Logout**: `POST /sair` → `sessao_encerrar`, apaga cookie, redireciona para
`/login`. POST para link de terceiro não deslogar ninguém.

**Proxy**: sem cookie e rota não pública → `/login`. Com cookie em `/login`
→ `/`. Públicas: `/login`. Matcher exclui `_next/`, `favicon.ico` e
estáticos.

**Seed**: `criarPrimeiroGestor` gera provisória, insere `usuario` com
`senha_provisoria_pendente = true` e `credencial` na mesma transação admin,
devolve `{ ok: true, id, senhaProvisoria }`. CLI: senha sozinha no stdout;
stderr: "Senha provisória do gestor. Não será mostrada de novo. O primeiro
login exige a troca."

## 8. Contrato de erro

Regra devolve `{ ok, motivo }`. Infraestrutura lança.

| Função | Motivos |
|---|---|
| `entrar` | `credenciais_invalidas`; `bloqueado` com `segundosRestantes` |
| `trocarSenha` | `senha_fraca` com `faltas`; `senha_atual_invalida`; `sem_sessao` |
| `avaliarAcesso` | `sem_sessao`, `senha_provisoria`, `so_gestor`, com `destino` |
| `criarPrimeiroGestor` | `ja_existe_gestor_ativo`, `email_invalido` |

Tela: `credenciais_invalidas` → "E-mail ou senha não conferem";
`bloqueado` → "Muitas tentativas. Tente de novo em N minutos", arredondando
para cima.

## 9. Testes

**Integração, Postgres real.** Harness ganha
`criarUsuarioComSenha(banco, papel, apelido, senha, { pendente })`.

- `autenticacao-schema.test.ts`: dez migrações; três tabelas com RLS e zero
  políticas; `app_conexao` com `USAGE`, `EXECUTE` nas sete, `42501` em
  `SELECT` direto em cada tabela; `app_usuario` sem `USAGE`;
  `app_conferencia` sem nada; invariantes valem.
- `funcoes-autenticacao.test.ts`, via `chamar`: `credencial_por_email` zero
  linhas para inexistente; `sessao_atual` nula para expirada e para inativo
  com linha viva; `senha_trocar` apaga as outras e mantém a atual, zera a
  marca, nulo para hash inválido; bloqueio no 10º erro por e-mail e no 30º
  por origem, com tentativas antigas inseridas como dona com `ocorreu_em` no
  passado para provar a janela; acerto zera e-mail e não zera origem; origem
  nula conta só por e-mail; e-mail com maiúscula e espaço conta junto.
- `entrar.test.ts`: certo; senha errada; inexistente e inativo com a mesma
  resposta; bloqueio com segundos; tempo de inexistente e de errado na mesma
  ordem de grandeza, margem larga, como controle do `HASH_DESCARTAVEL`.
- `trocar-senha.test.ts`: três motivos e sucesso; antiga não entra, nova
  entra; outra sessão do mesmo usuário morre, a atual não.
- `sem-identidade.test.ts`: nome fora do mapa e aridade errada lançam antes
  de conectar (URL de porta fechada).
- `politicas.test.ts` ganha: gestor pendente não insere nem altera, e lê.
  E a transição do primeiro acesso: o mesmo gestor, na **mesma sessão**,
  depois de `senha_trocar`, volta a inserir e alterar. `pode_escrever()`
  consulta a coluna a cada instrução, então não precisa de nova sessão nem
  de novo `comoUsuario`.
- Duas barreiras contra inativo, cada uma provada isolada, para saber qual
  quebrou se uma quebrar: (a) em `funcoes-autenticacao.test.ts`, desativar
  como dona com sessão viva e provar que `sessao_atual` devolve zero linhas,
  sem passar por `comoUsuario`; (b) em `politicas.test.ts`, já existe:
  `comoUsuario` de um inativo não lê nem a si, sem passar por sessão. Os
  dois testes nomeiam a barreira que cobrem.
- `seed.test.ts` ganha: credencial criada, pendente verdadeiro, senha
  devolvida entra no login.
- `runner.test.ts` ganha os negativos da seção 5.

**Unitário.** `senha.ts` inteiro; `avaliarAcesso` todas as combinações;
`proxy.ts` cookie presente e ausente, rota pública e protegida; `origemDe`;
`sha256` do token determinístico.

**Manual, no navegador, registrado em `docs/db/divida-tecnica.md`:** login
certo; senha errada; bloqueio; troca obrigatória no primeiro acesso; logout;
rota protegida sem cookie.

## 10. Docs

`docs/db/0007.md`, `0008.md`, `0009.md`. `fundacao.md`: seção "Como o login
chega ao banco"; "Registrado para a fatia de login" vira "feito na 0b".
`divida-tecnica.md`: lista da verificação manual, "sem teste de render", e
faxina com gatilho. `.env.example` sem mudança.

## 11. Fora de escopo

Criação de usuário pelo gestor (`credencial_definir` com `eh_gestor()`);
recuperação de senha; renovação de sessão; lista de dispositivos;
`usuario_publico`; componente com teste de render.

**Faxina de `tentativa_login` e sessões expiradas: fora, com gatilho.** As
duas tabelas crescem sem teto. Registrado em `divida-tecnica.md` com o
gatilho: primeira tela do gestor, ou `tentativa_login` acima de 50 mil
linhas, o que vier primeiro.

## 12. Limitações conhecidas

- `sessao_criar` confia no `usuario_id`, porque a senha é verificada no
  Node. Quem tem a `DATABASE_URL` cunha sessão de qualquer um, do mesmo modo
  que já afirma qualquer identidade em `comoUsuario`. É o limite do desenho
  "o banco confia na aplicação".
- `credencial_por_email` é o único ponto onde hash de senha sai do banco, e
  sai para o processo que precisa dele.
- Bloqueado responde mais rápido que o caminho normal, porque pula o
  `scrypt`. Como a mensagem já é explícita, não há o que esconder.
- Sem faxina, a Railway acumula tentativas e sessões expiradas (seção 11).
