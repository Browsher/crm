# Dívida técnica da fundação

Achados da auditoria de 2026-09-08 que não entraram na fatia 0a.1. Pegar
quando doer. Ao resolver, apagar daqui.

## Invariantes sem teste

- `PG_SSL=off` é aceito para qualquer host. Nada impede desligar TLS contra
  a Railway. Com login, expõe token de sessão, não só a senha do papel.
- Checador não procura `PASSWORD` nem `ALTER ROLE ... LOGIN` em migração.
- Guarda de `BYPASSRLS` em `pool.ts` sem controle negativo.
- CHECK de `nome` não vazio, UNIQUE de `email`, `atualizado_por` forjado no
  INSERT: sem teste.
- Nenhum teste chama `obterPool()` ou `conectarVerificado()` sem argumento.
  O caminho que a aplicação usa nunca rodou.

## Código sem cobertura

- `scripts/db/*.mts` inteiros. O CI roda `db:checar` e `db:pendentes`, nunca
  `db:aplicar`, `db:seed:gestor` ou `db:senha`.
- `ssl.ts` com `PG_SSL_CA` como caminho de arquivo. Nenhum handshake TLS de
  verdade acontece em teste.
- `seed.ts`: e-mail repetido estoura `23505` como exceção, fora do contrato
  `{ ok, motivo }`.
- `situacao` com divergentes nunca é asserido.

## Segurança e operação

- `db:senha` recebe a senha em `argv`: visível em histórico e `ps`. Não
  repetir o padrão no seed com senha.
- Harness grava senha `'teste'` em `app_conexao`, papel global do cluster.
  Se `.env.test.local` apontar para a Railway, roda lá. Nenhuma conferência
  de host. Consequência concreta, vista em 2026-09-08: toda rodada de
  integração troca a senha de `app_conexao` do container, e a `DATABASE_URL`
  do `.env.local` para de funcionar até rodar `npm run db:senha` de novo.
  Caminho provável: harness com papel próprio (`app_conexao_teste`) ou senha
  do harness igual à do `.env.local`.
  Observação da 0c (2026-09-08): depois de rodar a suíte inteira, a
  `DATABASE_URL` do `.env.local` **continuou funcionando** contra o
  container. Só o fato está registrado; a causa não foi investigada, e o
  risco de o harness apontar para a Railway continua igual.
- Não existe primitiva de conexão sem identidade; `obterPool` e
  `conectarVerificado` são exportados. A fronteira `comoUsuario` é convenção,
  sem lint.
- "Gestor não se rebaixa" tem contorno: gestor cria segundo gestor, que
  altera o primeiro. **Decidido na 0c: não importa.** É o mesmo poder que um
  gestor já tem sobre outro (desativar, rebaixar, redefinir senha). Gestor
  confia em quem promove. Fica como limitação conhecida, não como falha.
- Catálogo (`pg_proc.prosrc`, `pg_policies`) legível por qualquer papel.
  Normal no Postgres; registrado como reconhecimento possível.

## Gatilho disparado, esperando fatia

- **Faxina de `autenticacao.tentativa_login` e de sessões expiradas.** As
  duas tabelas crescem sem teto: nada apaga tentativa antiga nem sessão
  vencida (a fatia 0b só as ignora na consulta). O gatilho era "a primeira
  tela do gestor, ou 50 mil linhas em `tentativa_login`". **A primeira tela
  do gestor entrou na 0c (2026-09-08), então o gatilho disparou.** Não foi
  feito nesta fatia: faxina é escopo próprio, com decisão sobre onde roda
  (cron do banco, rota agendada, ou no caminho de login). Antes de começar,
  conferir o tamanho com
  `SELECT count(*) FROM autenticacao.tentativa_login` na Railway.
  A 0c não piorou o quadro: `credencial_definir` e `sessoes_encerrar_de`
  **apagam** sessões, não criam.

## Fatia 0b: verificado à mão, sem teste de render

Os formulários de `app/login` e `app/trocar-senha` não têm teste de render
(decisão da spec, seção 3). O que garante a passagem do `<form>` para a
action é a verificação manual abaixo, feita em 2026-09-08 pelo usuário no
navegador contra o container local, depois de `db:aplicar` e
`db:seed:gestor`. Refazer quando mexer em qualquer arquivo de `app/`.

| Caminho | Verificado |
|---|---|
| rota protegida sem cookie redireciona para /login | sim |
| senha errada mostra "E-mail ou senha não conferem." | sim |
| primeiro acesso com provisória cai em /trocar-senha e obriga a troca | sim |
| depois da troca, / mostra nome e papel | sim |
| sair volta para /login e / redireciona de novo | sim |
| bloqueio na 10ª falha mostra "Muitas tentativas…" e a senha certa em seguida também é recusada | sim |

- `npm run db:seed:gestor` sem `-s` deixa o banner do npm no stdout antes da
  senha provisória. Documentado em `fundacao.md`. Se doer, o script pode
  gravar a senha num arquivo `0600` em vez de stdout.

## Fatia 0b: auditoria de 2026-09-08

Do que a auditoria da 0b apontou, a 0b.1 resolveu: marca provisória
congelada para o gestor, teste das três listas de funções, hash memoizado no
harness. O resto está aqui.

### Invariantes sem teste

- Bloqueio para e-mail inexistente: 10 falhas num e-mail que não existe
  devem dar `bloqueado`, e a tentativa deve ser registrada. Sem teste.
- Restrição "no tipo" de `chamar`: só a checagem em runtime tem teste. Um
  `@ts-expect-error` provaria que o TypeScript recusa aridade e nome errados.
- `sem-identidade` não exporta `executar`: sem teste de exports.
- `cookie.ts` inteiro: `httpOnly`, `sameSite`, `secure` fora de dev, `expires`.
- `segundos_restantes` nunca negativo; segundos no bloqueio só por origem.
- Fronteira "só `cookie`, `rota`, `guarda`, `proxy` e `app/**` importam
  `next/*`": convenção sem lint.
- Troca de senha de usuário sem pendência só coberta indiretamente.

### Código sem cobertura

- `guarda.ts` inteiro; `proxy.ts` (o embrulho e o `matcher`); `cookie.ts`;
  `app/**` inteiro; `scripts/db/seed-gestor.mts`. Só manual.
- `trocarSenhaAcao` sem cookie e com `sem_sessao` no meio: nem manual.
- `verificarSenha`: o `catch` quando o `scrypt` lança (`N=3`).
- `mensagens.ts`: textos de `maximo` e `so_espaco`, junção com três faltas.
- `trocar-senha.ts`: `sem_sessao` final, por corrida.
- `sem-identidade.ts`: `release` quando a função lança no banco.

### Atacante só com navegador

- CPU sem teto: cada tentativa custa um `scrypt` (~800ms, 128 MiB), inclusive
  e-mail inexistente. Limite é por e-mail e por origem; com muitos IPs e
  e-mails inventados, não há limite global.
- `tentativa_login` cresce 30 linhas por IP a cada 15 minutos até o bloqueio.
  Já tem gatilho de faxina acima.
- Quem divide IP com a equipe (CGNAT, escritório) bloqueia a origem da equipe
  com 30 falhas, sem conhecer senha.
- `x-forwarded-for` confiável só se o host sobrescrever. A Vercel sobrescreve;
  não foi verificado nesta fatia. Em dev e em outro host, o cliente forja a
  origem: escapa do limite por origem e bloqueia o IP que quiser.
- Sem CSP nem `frame-ancestors`: o login pode ser emoldurado.
- Primeira tentativa com e-mail inexistente num processo novo custa dois
  `scrypt` (`hashDescartavel` gera na hora). Sinal fraco em cold start.

### Sessão roubada

- Vale por até 30 dias, sem vínculo a IP ou navegador, sem lista de
  dispositivos, sem "sair de todos". Só a troca de senha derruba.
- Sessão de gestor roubada é gestor. Na fatia de usuários isso passa a
  significar criar e alterar qualquer um.

### Acesso à aplicação

- Documentado: cunha sessão de qualquer um, lê hashes por e-mail, desbloqueia
  com `registrar_tentativa_login(..., true)`, `RESET ROLE` chega às funções.

### Herança para a fatia de usuários

- `chamar<'nome', Linha>` não amarra o tipo de retorno ao nome. Um mapa nome
  → linha fecharia.
- `senhaAtual` sem limite de tamanho em `trocarSenha`.
- Matcher do proxy exclui por extensão: `/relatorio.csv` não passa pelo
  proxy. Route handler sem `exigir` fica aberta.
- `atualizado_por` nulo quando o sistema altera `usuario`: seed e
  `senha_trocar` ficam indistinguíveis de bug na auditoria.

## Fatia 0c: verificado à mão, sem teste de render

Mesma regra da 0b: actions finas e JSX sem teste automático. Verificação
manual feita em 2026-09-08 pelo usuário no navegador contra o container
local, com a 0011 aplicada. Refazer quando mexer em `app/usuarios/**` ou em
`app/page.tsx`.

| Caminho | Verificado |
|---|---|
| home mostra o link "Usuários" para gestor | sim |
| criar vendedor: senha aparece com a instrução ao lado | sim |
| recarregar depois de criar: senha some; a lista mostra "senha provisória pendente" | sim |
| e-mail repetido: mensagem de e-mail em uso | sim |
| vendedor entra com a provisória e cai em `/trocar-senha` | sim |
| vendedor em `/usuarios` cai em `/` | sim |
| vendedor em outra aba; gestor gera nova senha; próxima navegação do vendedor cai em `/login` (delete dentro de `credencial_definir`) | sim |
| a senha anterior do vendedor não entra; a nova provisória entra | sim |
| vendedor em outra aba; gestor desativa; próxima navegação cai em `/login` (`sessoes_encerrar_de`) | sim |
| desativar deixa só "Reativar"; reativar traz as três ações de volta | sim |
| mudar papel: o alvo vê o papel novo na próxima página, sem relogar | sim |
| aviso de único gestor aparece com um e some ao promover outro; gestor pendente em `/usuarios` vai para `/trocar-senha` | sim |

Sobre a linha do `sessoes_encerrar_de`: `sessao_atual` já recusaria o
inativo, então a tela cairia no `/login` mesmo sem o delete. Quem prova o
delete é `funcoes-usuario.test.ts`, contando linhas em `sessao` como dona.

**Gatilho para jsdom:** primeiro componente cliente que decide algo sozinho
no cliente. `useActionState` devolvendo estado da action não conta.

## Fatia 0c: auditoria de 2026-09-08

Achados marcados **(verificado)** foram rodados contra o Postgres 17 local,
em transação com `ROLLBACK`. O resto é leitura de código.

### Vai para a 0c.1

- **`atualizado_por` mente na segunda redefinição de senha (verificado).** O
  `AND NOT senha_provisoria_pendente` no `UPDATE` de `credencial_definir`
  evita carimbo à toa no caminho de criar, mas quando o alvo já está pendente
  o `UPDATE` afeta zero linhas, o gatilho não roda, e `atualizado_por`
  continua apontando para quem redefiniu da primeira vez. Provado com dois
  gestores em sequência: o segundo trocou o hash e a linha seguiu nomeando o
  primeiro. Como `autenticacao.credencial` não guarda quem, não existe
  registro nenhum. Decisão: `credencial` ganha `atualizado_por`; quem
  redefiniu senha não é informação que `usuario` deva carregar.
- **A máquina de estados não é enforçada por ninguém.** `acoesDe` decide o
  que a tela mostra e o servidor nunca reconfere. Verificado: definir senha
  provisória para usuário **inativo** funciona e sobe a marca; desativar quem
  já está inativo dá `UPDATE 1`; reativar quem já está ativo dá `UPDATE 1`.
  A autorização é enforçada pelo banco, a transição não. Decisão: recusar
  transição sem sentido, com motivo próprio, não `nao_encontrado`.
- **Conferência de permissão duplicada verbatim nas duas funções SQL.** A
  terceira copia de novo. Decisão: `exigir_gestor()` compartilhada.
- **A invariante da lista fechada só varre `public` (verificado no código).**
  Definidora em outro schema, com `EXECUTE` para `app_usuario`, tocando
  `autenticacao`, escapa. Decisão: varrer todos os schemas.

### Invariantes sem teste

- `sessoes_encerrar_de` com gestor pendente e com gestor inativo.
  `credencial_definir` tem os dois; a irmã só tem vendedor e gestor-sobre-si.
- `app_conexao` tentando **executar** as duas: só há conferência de catálogo
  (`has_function_privilege`), não uma chamada real devolvendo `42501`, como a
  0b fez para as tabelas.
- Alvo inativo em `credencial_definir`: nenhum teste diz qual é o esperado.
- O `AND NOT senha_provisoria_pendente`: nenhum teste cobre duas redefinições
  seguidas.
- Erro de infraestrutura atravessando `traduzir`: nada prova que erro
  desconhecido sobe em vez de virar `{ ok: false }`.
- `gestorUnico` com lista vazia (o teste de "zero gestores" usa lista com um
  vendedor).
- Fronteira "`features/` não importa de outra `features/`": convenção sem
  lint, agora com a primeira pasta existindo.

### Código sem cobertura

- `app/usuarios/**` inteiro: as duas actions e os dois componentes cliente.
  Três ramos que nem o teste nem a verificação manual tocaram: `limpar` em
  `criarUsuarioAcao`, `'Ação desconhecida.'` em `agirNaLinhaAcao`, e a
  coerção do `papel` vindo do formulário.
- `repositorio.ts`: **o retorno de `credencial_definir` é ignorado dentro de
  `criar`**. Hoje inalcançável (id recém-nascido). Se um dia for `false`,
  `criar` devolve `{ ok: true }` com usuário sem credencial, que não entra e
  só se conserta gerando nova senha.
- `alterar(id, {})` (verificado): faz `UPDATE 1`, dispara o gatilho e carimba
  auditoria sem nada ter mudado. A interface permite; o serviço nunca chama.
- `servico.ts` com repositório falso: só `criarUsuario`. As outras quatro só
  aparecem no teste de integração.
- `mensagens.ts`: `junta` com **duas** faltas (o teste cobre uma e três).
  Com lista vazia produziria " e undefined"; inalcançável, mas frágil.

### Atacante com sessão de gestor

Sem sessão e com sessão de vendedor não há nada novo: a aplicação redireciona
e o banco recusa, duas barreiras independentes. Com gestor:

- **Negação de serviço por `scrypt`.** Cada nova senha e cada criação custa
  ~800ms e 128 MiB. Não há limite na tela: nem por gestor, nem por minuto.
  É pior que o login, que tem limite por e-mail e por origem.
- Crescimento sem teto de `usuario` e `credencial`: nada limita criação.
- E-mail quase sem validação: `includes('@')` aceita `a@`.
- Redefinir senha de outro gestor e entrar como ele: escalada total e
  silenciosa. Aceito como limitação; ganha rastro com o `atualizado_por` da
  0c.1.
- Os três estados sem sentido da seção da 0c.1.

Com acesso à aplicação não há poder novo além do que a 0b registrou, mas o
caminho ficou mais curto: afirmar o id de qualquer gestor ativo no GUC e
chamar `credencial_definir`, em vez de forjar sessão e chamar `senha_trocar`.

### Herdado, sem gatilho

- `repositorioPostgres(gestorId)` confia no id que recebe. O único elo com a
  sessão real é o `exigir` logo acima, em `acoes.ts`. Nada no tipo impede uma
  feature futura de montar o repositório com id arbitrário.
- `traduzir` casa com o nome `usuario_email_key`, gerado pelo Postgres e
  nomeado por nenhuma migração. Migração que recrie a restrição com outro
  nome degrada a tradução para exceção, em silêncio.
- `agirNaLinhaAcao` despacha quatro verbos por string de formulário. O
  `Exclude<Acao, 'nova_senha'>` já é sinal de que a forma não escala.
- `listar()` traz tudo, sem paginação nem busca. A primeira entidade com
  volume real não pode copiar este repositório.
- **O gatilho do jsdom pode nunca disparar.** A condição é "componente
  cliente que decide algo sozinho", e o padrão adotado empurra toda decisão
  para o servidor. Na prática `app/` pode crescer indefinidamente sem teste
  automático. Reconsiderar a condição, não só esperar por ela.
- Zero gestores ativos por corrida entre dois gestores. Recuperação:
  `db:seed:gestor`.
- A invariante procura `autenticacao.` no texto da função (`prosrc`): função
  que chega lá por outra função, ou por SQL dinâmico, escapa. A 0c.1 amplia o
  escopo de schemas, não esse limite.

## Ferramental

- Sem projeto Vitest para React. `jsdom` e plugin instalados, não
  configurados.
- Next 16 usa `proxy.ts`, não `middleware.ts`. Portar o guarda do crm-ch,
  não copiar.
