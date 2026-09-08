# Fatia 0c — usuários: design

Brainstorm de 2026-09-08. Constrói sobre a 0b
(`2026-09-08-login-sessao-design.md`) e sobre a 0b.1, que precisam estar
aplicadas: a 0011 numera depois da 0010 e depende da marca provisória
congelada.

## 1. Objetivo

O gestor cria vendedor com senha provisória, gera nova senha provisória,
muda papel, desativa e reativa. Tudo por uma tela, `/usuarios`. Nada além
disso: sem editar nome ou e-mail, sem excluir, sem busca, sem paginação.

## 2. O que já estava decidido e não se reabre

- A autoridade está no banco. Identidade chega por `comoUsuario`
  (`set_config('app.usuario_id')` + `SET ROLE app_usuario`), e a RLS de
  `usuario` decide o que o gestor pode.
- `app_usuario` não tem `USAGE` em `autenticacao`. Só função definidora toca
  as tabelas de lá.
- A marca `senha_provisoria_pendente` está congelada na política (0010):
  só função definidora sobe ou zera.
- `sem-identidade.ts` é um mapa fechado. Não ganha função nesta fatia.
- Sem teste de render (0b). Verificação manual registrada na dívida técnica.

## 3. Decisões deste brainstorm

| Decisão | Escolha | Por quê |
|---|---|---|
| Canal de identidade para `credencial_definir` | função em `public`, `GRANT EXECUTE TO app_usuario`, chamada de dentro de `comoUsuario` | GUC não pertence ao papel: `usuario_atual()` funciona por dentro da definidora. Criar vendedor vira uma transação só. Um canal de identidade, não dois. Passar `p_gestor_id` ou `token_hash` via `chamar` deixaria `usuario` e `credencial` em transações separadas |
| Lista fechada com invariante | constante `FUNCOES_DE_USUARIO_EM_AUTENTICACAO` em TypeScript, invariante lê `pg_proc`, teste espelho no molde da 0b.1 | função definidora que escreve em `autenticacao` sem registro derruba `db:aplicar` e o CI |
| Sessões do alvo | nova senha provisória e desativar apagam todas | reativar dentro de 30 dias não pode reviver cookie antigo; nova senha por suspeita de vazamento tem que matar a sessão do atacante, como `senha_trocar` já faz |
| Mudar papel e sessão | não mexe | `sessao_atual` lê `papel` a cada requisição |
| Último gestor ativo | sem proteção no banco; aviso na tela; recuperação pelo seed | `db:seed:gestor` só recusa com gestor ativo, então com zero ele cria um novo. Trigger seria código protegendo cenário que a corrida quase nunca produz |
| Uma função para criar e substituir credencial | `INSERT ... ON CONFLICT DO UPDATE` numa função só | criar e "nova senha" são o mesmo poder ("gestor define provisória para outro"), mesma conferência, mesma consequência. No caminho de criar o conflito é impossível (id novo). O `ON CONFLICT` também é a recuperação para usuário sem credencial |
| Ordem em desativar | `UPDATE` primeiro, `sessoes_encerrar_de` depois | dentro da transação nada é visível até o `COMMIT`, então a ordem não muda o que outra conexão vê. O `UPDATE` é a instrução governada pela política e `afetadas: 0` é o único sinal de "não existe ou não posso"; com ele na frente, o repositório devolve `nao_encontrado` sem rodar a função |
| `scrypt` fora da transação | hash gerado antes do `BEGIN` | 800ms segurando conexão do pool. Se o processo morre entre o hash e o `BEGIN`, o desfecho é nenhum usuário e nenhuma credencial; o gestor tenta de novo. **Não mover para dentro**: não muda o desfecho, só segura conexão |
| Senha provisória na tela | action devolve no estado (`useActionState`), sem redirecionar | mesmo molde do login. Vive só na memória da página; recarregar zera. Nenhum cookie, nunca na URL |
| Instrução ao lado da senha | "Anote agora e entregue a [nome]. A senha não fica guardada; se perder, gere uma nova senha provisória na lista." | dar a saída, não só o risco |
| Teste de tela | regra da 0b mantida: lógica em função pura, actions em integração, JSX manual | jsdom com Next 16 é fatia própria. **Gatilho para configurar**: primeiro componente cliente que decide algo sozinho no cliente (`useActionState` devolvendo estado da action não conta) |
| Confirmação em desativar | nenhuma | reversível, sem perda de dado; confirmação viria com o gatilho acima |
| Gestor cria gestor | permitido | a política permite e não há motivo para a aplicação negar |

## 4. Migração `0011_funcoes_usuario.sql`

Duas funções em `public`, `plpgsql`, `SECURITY DEFINER SET search_path = ''`,
`REVOKE EXECUTE FROM PUBLIC`, `GRANT EXECUTE TO app_usuario`. Sem comentário
no `.sql`; o porquê fica em `docs/db/0011.md`.

| Função | Devolve | Faz |
|---|---|---|
| `credencial_definir(p_usuario_id uuid, p_hash text)` | `boolean` | confere `pode_escrever() AND eh_gestor()` e `p_usuario_id <> usuario_atual()`, senão `RAISE` com `ERRCODE = '42501'`; alvo inexistente em `usuario` devolve `false`; `INSERT INTO autenticacao.credencial ... ON CONFLICT (usuario_id) DO UPDATE SET senha_hash, atualizado_em = now()`; `UPDATE public.usuario SET senha_provisoria_pendente = true WHERE id = p_usuario_id`; `DELETE FROM autenticacao.sessao WHERE usuario_id = p_usuario_id`; devolve `true` |
| `sessoes_encerrar_de(p_usuario_id uuid)` | `integer` | mesmas conferências e o mesmo `RAISE`; apaga as sessões do alvo; devolve quantas apagou |

Por que `RAISE 42501` e não `false` para falta de permissão: é o código que a
política de `usuario` já produz, então o repositório traduz um código só. E
permissão negada aborta a transação; `false` fica para "alvo não existe", que
é dado, não permissão.

O `UPDATE` da marca dentro de `credencial_definir` roda como dona e ignora a
política, que é o previsto na 0010. O gestor pendente não chega aqui:
`pode_escrever()` já o barra.

O `UPDATE public.usuario` da marca dispara `definir_auditoria`, que grava
`atualizado_por = usuario_atual()`: o gestor, porque o GUC continua na
transação. Isso é o comportamento desejado, e diferente do `senha_trocar`
(que roda via `chamar`, sem identidade, e deixa nulo).

### 4.1 Invariante nova

`FUNCOES_DE_USUARIO_EM_AUTENTICACAO = ['credencial_definir', 'sessoes_encerrar_de'] as const`
em `invariantes.ts`.

`lerEstado` ganha `funcoesDeUsuarioEmAutenticacao`: nomes de toda função de
`public` com `prosecdef`, cujo `prosrc` contém `autenticacao.`, e que
`app_usuario` pode executar (`has_function_privilege('app_usuario', p.oid,
'EXECUTE')`). Ganha também `funcoesDeUsuarioSemExecute`: nomes da constante
que existem em `public` mas `app_usuario` não executa.

`avaliar` acusa:
- nome em `funcoesDeUsuarioEmAutenticacao` fora da constante: "função
  definidora de public escreve em autenticacao com EXECUTE para app_usuario e
  não está registrada: X";
- nome da constante ausente de `funcoesDeUsuarioEmAutenticacao`: "função de
  usuário registrada e ausente ou sem EXECUTE para app_usuario: X".

Limite conhecido: a busca em `prosrc` é por substring. Uma função que chega a
`autenticacao` por outra função, sem escrever o nome, escapa. O que fecha o
resto: `chamar` é mapa fechado, e `USAGE` em `autenticacao` é só de
`app_conexao`.

O que não muda: `sem-identidade.ts`, o `USAGE`, as políticas de `usuario`.
Desativar, reativar e mudar papel são `UPDATE` pela política que já existe.

## 5. Código

```
src/features/usuarios/regras.ts        puras: acoesDe(linha, eu), gestorUnico(lista), validarNovoUsuario
src/features/usuarios/repositorio.ts   interface RepositorioUsuarios + repositorioPostgres(gestorId)
src/features/usuarios/servico.ts       criarUsuario, novaSenhaProvisoria, mudarPapel, desativar, reativar
src/features/usuarios/mensagens.ts     motivo → texto
app/usuarios/page.tsx                  exigir('gestor'), lista, aviso de gestor único
app/usuarios/acoes.ts                  cinco server actions, revalidatePath('/usuarios')
app/usuarios/formulario-criar.tsx      cliente, useActionState, bloco de senha com instrução
app/usuarios/linha.tsx                 cliente, botões da linha, useActionState para nova senha
app/page.tsx                           link "Usuários" só para gestor
```

Primeira pasta em `features/`. Importa de `server/` (`comoUsuario`,
`senha.ts`, `linhas.ts`) e nunca de outra `features/`.

### 5.1 Repositório

```ts
type Usuario = { id, nome, email, papel, ativo, senhaProvisoriaPendente }
interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>
  criar(dados: { nome, email, papel }, hash: string): Promise<Resultado<{ id }>>
  definirCredencial(id: string, hash: string): Promise<Resultado<void>>
  alterar(id: string, campos: { papel?: Papel; ativo?: boolean }): Promise<Resultado<void>>
  desativar(id: string): Promise<Resultado<void>>
}
```

`repositorioPostgres(gestorId)` faz cada operação num `comoUsuario` próprio:

- `criar`: `INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES (..., true) RETURNING id`,
  depois `SELECT credencial_definir($1, $2)`. Mesma transação.
- `definirCredencial`: `SELECT credencial_definir($1, $2)`; `false` → `nao_encontrado`.
- `alterar`: `UPDATE usuario SET papel = COALESCE($2, papel), ativo = COALESCE($3, ativo) WHERE id = $1`;
  `afetadas: 0` → `nao_encontrado`.
- `desativar`: `UPDATE usuario SET ativo = false WHERE id = $1`; `afetadas: 0` →
  `nao_encontrado`; depois `SELECT sessoes_encerrar_de($1)`. Mesma transação.
- `listar`: `SELECT ... FROM usuario ORDER BY ativo DESC, nome`.

O `INSERT` com `senha_provisoria_pendente = true` passa por `usuario_criar`,
que a 0010 não congelou (o congelamento é no `WITH CHECK` de
`usuario_alterar`), e `credencial_definir` sobe a marca de qualquer jeito. Os
dois concordam; o teste confirma o estado final.

Por que `credencial_definir` não falha por permissão depois de o `INSERT`
passar: `usuario_criar` é `pode_escrever() AND eh_gestor()`, e a função
confere as mesmas duas mais `p_usuario_id <> usuario_atual()`, que nunca
falha para id recém-gerado. Mesma transação, mesmo GUC. A única divergência
possível é outra transação desativar ou rebaixar este gestor entre as duas
instruções e dar `COMMIT` (`READ COMMITTED` faz a segunda instrução ver o
novo estado). Aí a função levanta `42501`, o rollback desfaz o `INSERT`, e o
repositório devolve `sem_permissao`. Nada foi criado e o chamador de fato
não é mais gestor: o motivo está certo.

Tradução de erro, no repositório:

| Sinal | Motivo |
|---|---|
| `42501` | `sem_permissao` |
| `afetadas: 0`, `credencial_definir` → `false` | `nao_encontrado` |
| `23505` em `usuario_email_key` | `email_em_uso` |
| outro erro | lança (infraestrutura) |

Isso quita da dívida "contrato cobre só 42501 e afetadas 0".

### 5.2 Serviço

Recebe o repositório por parâmetro. Devolve `{ ok, motivo }`.

- `criarUsuario(repo, { nome, email, papel })`: `validarNovoUsuario`
  (nome não vazio após `trim`; e-mail com `@`, normalizado `lower(trim)`;
  papel em `vendedor | gestor`), senão `dados_invalidos` com `faltas`.
  `gerarSenhaProvisoria()` e `gerarHash` fora da transação. `repo.criar`.
  Sucesso: `{ ok: true, id, senhaProvisoria }`.
- `novaSenhaProvisoria(repo, id)`: gera e faz hash fora; `repo.definirCredencial`.
  Sucesso: `{ ok: true, senhaProvisoria }`.
- `mudarPapel(repo, id, papel)`: `repo.alterar(id, { papel })`.
- `desativar(repo, id)`: `repo.desativar(id)`.
- `reativar(repo, id)`: `repo.alterar(id, { ativo: true })`.

Motivos: `dados_invalidos`, `email_em_uso`, `sem_permissao`, `nao_encontrado`.

### 5.3 Regras puras

- `acoesDe(linha, eu)`: própria linha → `[]`; ativo → `['nova_senha',
  'mudar_papel', 'desativar']`; inativo → `['reativar']`.
- `gestorUnico(lista)`: verdadeiro quando exatamente um da lista é gestor
  ativo.
- `validarNovoUsuario(dados)`: acima.

## 6. Tela

`/usuarios`, `exigir('gestor')`. Uma página.

- **Topo**: título, link para `/`, e quando `gestorUnico(lista)`: "Você é o
  único gestor ativo. Se perder o acesso, a recuperação é pelo seed." Só
  informa; nada é bloqueado.
- **Criar**: nome, e-mail, papel (`vendedor` marcado). Em sucesso, no lugar
  do formulário, bloco com o nome, a senha em fonte mono e a instrução da
  seção 3. Botão "criar outro" limpa o bloco.
- **Lista**: nome, e-mail, papel, situação, marca "senha provisória pendente"
  quando verdadeira, botões de `acoesDe`. A própria linha mostra "você" e
  nada de botão. Ativos primeiro, depois por nome.
- **Nova senha provisória**: botão na linha; sucesso mostra o bloco de senha
  dentro da linha, com a mesma instrução.
- **Mudar papel**: um botão, "tornar gestor" ou "tornar vendedor".
- **Desativar** e **reativar**: botão, sem confirmação.
- **Erro**: `role="alert"` na linha ou no formulário, texto de `mensagens.ts`.
- `app/page.tsx`: link "Usuários" quando `eu.papel === 'gestor'`.

As actions leem `usuarioAtual()`, montam `repositorioPostgres(eu.usuario_id)`,
chamam o serviço, `revalidatePath('/usuarios')`, devolvem o estado.

## 7. Testes

**Integração, Postgres real.**

- `funcoes-usuario.test.ts`, via `comoUsuario`: gestor define credencial de
  vendedor: marca sobe, hash entra no login, sessões do alvo somem (contadas
  como dona); gestor pendente `42501`; vendedor `42501`; gestor sobre si
  `42501`; alvo inexistente `false`; segunda chamada substitui o hash e a
  antiga não entra; `sessoes_encerrar_de` apaga só do alvo e devolve a
  contagem; vendedor com sessão viva, gestor desativa: `sessao_atual` zero
  linhas e zero linhas em `sessao`.
- `usuarios.test.ts`, serviço com repositório real: criar devolve senha que
  entra no login e cai em pendente; e-mail repetido dá `email_em_uso` e não
  deixa usuário pela metade; nova senha; desativar; reativar; mudar papel;
  vendedor em qualquer operação recebe `sem_permissao`; alvo inexistente
  `nao_encontrado`; **0010 pelo caminho da fatia**: gestor cria vendedor e,
  em seguida, `UPDATE usuario SET senha_provisoria_pendente = false` direto
  pela `comoUsuario` do gestor recebe `42501`.
- `runner.test.ts` ganha os negativos da invariante: função definidora em
  `public` tocando `autenticacao` com `EXECUTE` para `app_usuario` fora da
  lista é nomeada; nome da lista sem `EXECUTE` é nomeado.
- `invariantes.test.ts` (unitário) ganha os dois casos sobre `Estado`.
- Teste das listas, molde da 0b.1: constante e `lerEstado` são o mesmo
  conjunto.

**Unitário.** `regras.ts` inteiro (`acoesDe` nas combinações; `gestorUnico`
com zero, um, dois gestores ativos e gestor inativo não contando;
`validarNovoUsuario`). `mensagens.ts`: um texto por motivo. Serviço com
repositório falso para `dados_invalidos`.

**Harness.** `criarSessao(banco, usuarioId)` insere em `sessao` como dona e
devolve o token, para contar e provar morte de sessão sem passar pelo login.

**Manual, no navegador, registrado em `divida-tecnica.md`:**

| Caminho |
|---|
| vendedor em `/usuarios` cai em `/` |
| gestor pendente em `/usuarios` cai em `/trocar-senha` |
| criar vendedor: senha aparece com a instrução ao lado |
| recarregar depois de criar: senha some; a lista mostra o vendedor com "pendente" |
| gerar nova senha: a nova aparece; a antiga não entra |
| vendedor entra com a provisória e cai em `/trocar-senha` |
| e-mail repetido: mensagem de e-mail em uso |
| desativar: some das ações; reativar volta |
| mudar papel: o alvo vê o papel novo na próxima página, sem relogar |
| aviso de único gestor aparece com um e some ao promover outro |
| vendedor logado em outra aba; gestor gera nova senha; a próxima navegação do vendedor cai em `/login` (delete dentro de `credencial_definir`) |
| vendedor logado em outra aba; gestor desativa; a próxima navegação do vendedor cai em `/login` (`sessoes_encerrar_de`; note que `sessao_atual` já recusaria inativo, então quem prova o delete é o teste de integração) |

## 8. Docs

`docs/db/0011.md`. `fundacao.md`: seção "Como o gestor define senha" com o
canal (definidora em `public` chamada por `comoUsuario`), a lista fechada, e
a recuperação de "zero gestores ativos" pelo seed; "Fica para a fatia de
usuários" vira "feito na 0c". `divida-tecnica.md`: apagar o item de
`credencial_definir` e o de contrato de erro; adicionar a tabela manual;
marcar `exigir('gestor')` como usado. `CLAUDE.md`, "Contexto de domínio":
primeira entrada (papéis, senha provisória, quem faz o quê).

## 9. Fora de escopo

Editar nome e e-mail (esbarra em `usuario_alterar` bloquear a própria linha;
tela de perfil, outra fatia); excluir; busca e paginação; `usuario_publico`;
recuperação de senha pelo próprio usuário; jsdom (gatilho na seção 3).

## 10. Limitações conhecidas

- Gestor A pode gerar nova senha para gestor B e entrar como B. É o mesmo
  poder que A já tem de desativar ou rebaixar B. Gestor confia em quem
  promove. Se doer, uma linha a mais na conferência: gestor não redefine
  senha de gestor.
- Zero gestores ativos é possível por corrida entre dois gestores ou por
  perda de senha do único. Recuperação: `db:seed:gestor`.
- A invariante da lista fechada procura `autenticacao.` no texto da função.
- Sessão de gestor roubada agora cria e altera qualquer um (já registrado na
  dívida da 0b).
