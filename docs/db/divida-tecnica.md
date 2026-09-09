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

### Auditoria pendente da 0c

- A invariante da lista fechada procura `autenticacao.` no texto da função
  (`prosrc`). Função que chega lá por outra função escapa.
- Gestor A gera nova senha para gestor B e entra como B. Mesmo poder que
  desativar ou rebaixar. Se doer: gestor não redefine senha de gestor.
- Zero gestores ativos por corrida entre dois gestores. Recuperação:
  `db:seed:gestor`.
- Sessão de gestor roubada cria e altera qualquer um (registrado na 0b).
- `app/usuarios/**` inteiro sem cobertura automática: as duas actions, os
  dois componentes cliente. Só manual.
- `agirNaLinhaAcao` com `acao` fora da lista devolve "Ação desconhecida." e
  nunca é alcançado pela tela: sem teste.

## Ferramental

- Sem projeto Vitest para React. `jsdom` e plugin instalados, não
  configurados.
- Next 16 usa `proxy.ts`, não `middleware.ts`. Portar o guarda do crm-ch,
  não copiar.
