# Dívida técnica da fundação

Achados da auditoria de 2026-09-08 que não entraram na fatia 0a.1. Pegar
quando doer. Ao resolver, apagar daqui.

O que tem gatilho próprio está na seção "Gatilhos", com o tipo de cada um.
Leia a lição de lá antes de registrar gatilho novo em qualquer lugar.

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

- **Produção roda Postgres 18.6; os testes rodam 17.** Medido em 2026-09-09
  contra a Railway (`SELECT version()`): `PostgreSQL 18.6 (Debian
  18.6-1.pgdg13+2)`. O `docker-compose.yml` fixa `postgres:17`, então toda a
  suíte de integração e todas as verificações da fundação valeram contra 17 —
  inclusive as que `fundacao.md` registra como "confirmado em 2026-09-08 contra
  Postgres 17": `RESET ALL` não restaurando `role` (R-007), a isenção de RLS da
  dona, o comportamento de `FORCE`. Nada quebrou até hoje e nenhuma dessas
  conclusões é provável de mudar entre 17 e 18, mas **nenhuma foi conferida no
  ambiente onde o produto roda**. É divergência de ambiente não registrada, e
  foi achada por acaso, medindo espaço em disco para a fatia `cep`.
  Caminho provável: subir o container para 18 e rodar a suíte, que é barato e
  torna a pergunta desnecessária.
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

## Gatilhos

Lição de 2026-09-09, do gatilho da faxina que disparou sem problema:
**gatilho é medição ou é proxy, e proxy tem que dizer para que lado erra.**
Medição conta a coisa com que você se importa. Proxy conta outra coisa,
apostando que anda junto com ela. Num produto que ainda não tem uso, todo
proxy de uso anda solto: ou dispara cedo, e gatilho que dispara sem problema
treina a ignorar gatilho, ou não dispara nunca, e a dívida fica invisível.
Gatilho novo nasce com o tipo escrito e com o lado do erro esperado. Virou
**R-016** em `REGRAS.md`; a tabela abaixo é a aplicação dela a esta página.

| Gatilho | Tipo | Erra para | Situação |
|---|---|---|---|
| `tentativa_login` acima de 10 mil linhas, ou a fatia de limite global de login | medição | — | **novo em 2026-09-09**; 0 linhas hoje |
| mil linhas na tabela da entidade, ou a primeira reclamação de tela lenta (paginação de `listar()`) | medição | — | **novo em 2026-09-09** |
| "refazer quando mexer em `app/**`" (conferência manual das fatias 0b e 0c) | evento observável | — | ativo e confiável: a condição sai no `git diff` |
| "primeiro componente cliente que decide algo sozinho" (jsdom) | proxy de complexidade | nunca | ativo, com substituto candidato em "Fatia 0c: auditoria" |
| "pegar quando doer" (o padrão desta página) | proxy de dor | tarde | ativo, e é o padrão de tudo que não tem gatilho próprio |
| "primeira tela do gestor" (faxina) | proxy de uso | cedo | **aposentado em 2026-09-09**: disparou com a tabela vazia |
| "primeira entidade com volume real" (paginação de `listar()`) | proxy de uso | cedo | **aposentado em 2026-09-09**: `empresas` o dispararia sem volume nenhum |

Só a linha de `app/**` se cobra sozinha: a condição aparece no `git diff` sem
ninguém procurar. As duas de medição são confiáveis mas mudas — respondem
quando perguntadas, e ninguém as pergunta sozinho, então a conta entra na
revisão de dívida, não na espera. As duas de proxy ativas precisam ser
**relidas**: "pegar quando doer" porque a dor chega depois do estrago, e o do
jsdom porque o padrão adotado empurra toda decisão para o servidor e ele pode
nunca falar.

Os dois aposentados eram o mesmo erro escrito duas vezes: proxy de uso num
produto sem uso. Um disparou cedo e quase custou uma fatia inteira; o outro
dispararia na fatia seguinte, `empresas`, pelo mesmo motivo.

### Medição de 2026-09-09 (Railway, `DATABASE_URL_ADMIN`, leitura pura)

| Tabela | Linhas | Falhas / vencidas | Mais antiga | Tamanho |
|---|---|---|---|---|
| `autenticacao.tentativa_login` | 0 | 0 | — | 32 kB |
| `autenticacao.sessao` | 0 | 0 | — | 32 kB |
| `public.usuario` | 1 (o gestor semeado) | — | — | — |

O banco de produção nunca recebeu um login. O gatilho "primeira tela do
gestor" era proxy para "o produto está em uso", e o produto não está.
Proxy de uso não substitui contagem de uso.

### Faxina de `autenticacao.tentativa_login` — esperando fatia

A tabela cresce por INSERT em toda tentativa e só perde linha quando alguém
acerta a senha daquele e-mail: `registrar_tentativa_login` apaga as falhas do
e-mail no sucesso. Tentativa em e-mail que não existe nunca é apagada, e é
justamente a que um atacante produz de graça.

**Gatilho novo:** `tentativa_login` acima de 10 mil linhas, **ou** a fatia de
limite global de login, o que vier primeiro. Conferir com
`SELECT count(*) FROM autenticacao.tentativa_login` na Railway.

Dez mil não é limite de desempenho — os índices `(email, ocorreu_em DESC)` e
`(origem, ocorreu_em DESC)` aguentam ordens de grandeza mais, e as consultas
só olham 15 minutos. É o número que separa "ninguém usa isto" de "isto está
em uso ou sob ataque".

O "ou" com a fatia de limite global não é conveniência: faxinar sozinho é
enxugar gelo. Quem consegue encher a tabela derruba a CPU antes, porque cada
tentativa custa um `scrypt` de ~800ms e 128 MiB sem teto global (ver
"Atacante só com navegador"). As duas andam na mesma fatia ou nenhuma resolve.

Quando a fatia vier, ela carrega uma decisão que hoje não tem resposta: onde
a faxina roda. Cron do banco supõe `pg_cron` e um papel para ele; rota
agendada supõe um agendador da plataforma; no caminho de login supõe que
alguém faz login. `fundacao.md` fecha com "Aplicação na Railway é manual", ou
seja, a forma do deploy ainda não está decidida. Decidir onde a faxina roda
antes disso é chutar e refazer.

### Sessões vencidas — limitação conhecida, sem gatilho

Estava empacotada com a faxina acima por conveniência de anotação, não por
desenho. São problemas diferentes:

- `sessao` cresce **uma linha por login**, não por tentativa. Não há caminho
  adversarial barato para inflá-la.
- A linha vencida é inerte: `sessao_atual` filtra por `expira_em > now()`,
  então o `token_hash` guardado não abre nada.
- `sessao_encerrar`, `senha_trocar`, `credencial_definir` e
  `sessoes_encerrar_de` **apagam** linhas. Só o vencimento por tempo deixa
  resto.

Para uma equipe pequena são dezenas de linhas por mês, inertes. Fica como
limitação conhecida. Se um dia entrar uma tela de "meus dispositivos" ou
"sair de todos", a faxina de vencidas entra junto, de graça, porque a tela já
vai varrer a tabela por usuário.

## Fatia cep: verificado à mão, sem teste automático

A carga completa não roda em teste — o automático usa
`tests/fixtures/cep-mini.zip`, com doze entradas. O que garante o arquivo real
de 326 MB é a verificação abaixo, feita em 2026-09-09 contra o container local.
Refazer quando mexer em `src/server/cep/**` ou em `scripts/db/cep-carregar.mts`.

| Caminho | Verificado |
|---|---|
| `db:cep:carregar` com o zip real termina com 1.209.313 linhas | sim |
| `cep` ocupa 156 MB (tabela + índice) | sim |
| `cep_carga` tem uma linha: `opencep 2.0.1 2024-07-08`, soma `cffa3378…` | sim |
| `01310100` resolve para Avenida Paulista, Bela Vista, São Paulo, SP | sim |
| 10.392 sem logradouro, 7.200 sem bairro, 1.012.043 sem faixa, 27 UFs | sim |
| soma errada no manifesto para antes de tocar no banco, e sai com código 1 | sim |
| rodar de novo mantém 1.209.313 linhas e acrescenta linha em `cep_carga` | **não** |

Os seis primeiros reproduzem exatamente os números do spike, através do pipeline
inteiro: a transformação não perde nem inventa linha.

A última não foi feita à mão — custa mais seis minutos e o caminho de código é o
mesmo que `tests/integracao/cep-carregar.test.ts` já exercita contra o fixture
(`TRUNCATE`, recarga, segunda linha em `cep_carga`). **O que fica sem prova em
escala real é o `TRUNCATE` de 1,2 milhão de linhas dentro de transação** —
travamento e WAL. Registrado como o que é: buraco conhecido, não conferido.

**Tempo real da carga: 352,5 s (5m53s).**

**O CEP de teste é `01310100`, não o primeiro que vier à cabeça.** A base está
parada em julho de 2024; um CEP recente cai em não encontrado e parece bug numa
carga que funcionou.

### O tempo caiu na faixa do meio da tabela de decisão

A spec previu três faixas para a conversão em Node, medida agora pela primeira
vez. Os 352,5 s caem em "3 a 10 minutos", cuja consequência escrita é: **o
script passa a imprimir progresso.** Sem isso o operador não distingue
"trabalhando" de "travado" por quase seis minutos, e a reação natural é `Ctrl+C`
no meio — a transação faria `ROLLBACK`, então não corrompe, mas desperdiça a
rodada inteira.

Comparação honesta: o mesmo trabalho em Python levou 77 s no spike. Node com
`yauzl` levou 4,6× mais. A causa provável é um fluxo de leitura por entrada,
1,2 milhão de vezes, mas **isso não foi medido** — está escrito como suspeita,
não como diagnóstico.

## Fonte externa: a base de CEP do OpenCEP

Registrado em 2026-09-09, ao desenhar a fatia `cep`. Não é dívida de código: é
uma afirmação de terceiro que aceitaríamos sem conferir.

O README do <https://github.com/SeuAliado/OpenCEP> diz "Atualizamos
frequentemente a base de dados junto com os Correios!". **É falso.** O
repositório tem uma release única, `2.0.1`, de **2024-07-08**, e o último push é
do mesmo dia — 26 meses de silêncio. A frase do README foi o que quase entrou na
spec como "a base envelhece com o tempo", quando o certo é "a base já nasce com
dois anos".

Fica aqui pelo padrão, não pelo caso: **afirmação de manutenção feita pelo
próprio mantenedor é conferível em dois comandos** (`gh api repos/<x>
--jq .pushed_at` e a lista de releases), e não conferir é aceitar o marketing de
um repositório como medição. A decisão de usar a base assim mesmo está
justificada em `docs/superpowers/specs/2026-09-09-cep-design.md`, com gatilho de
medição e saída mapeada.

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
  Gatilho da faxina na seção "Gatilhos", amarrado a esta CPU sem teto: as duas
  andam na mesma fatia.
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
| **0c.1 (2026-09-09):** criar, nova senha, desativar, reativar e mudar papel refeitos contra o servidor da 0012, sem nenhuma mensagem de transição inválida | sim |

Sobre a linha do `sessoes_encerrar_de`: `sessao_atual` já recusaria o
inativo, então a tela cairia no `/login` mesmo sem o delete. Quem prova o
delete é `funcoes-usuario.test.ts`, contando linhas em `sessao` como dona.

Sobre a linha da 0c.1: nenhum arquivo de `app/` mudou naquela fatia, mas o
servidor por baixo mudou (funções novas, retorno em texto, transição
recusada). O critério da conferência era negativo: se a tela mostrasse
"Esse usuário já está nesse estado" ou "Não dá para definir senha de um
usuário desativado" num fluxo normal, seria bug, porque `acoesDe` não deveria
oferecer a ação naquele estado. Nenhuma apareceu. As duas mensagens existem
para requisição forjada e para corrida entre duas abas.

**Gatilho para jsdom:** primeiro componente cliente que decide algo sozinho
no cliente. `useActionState` devolvendo estado da action não conta. É proxy
de complexidade e erra para "nunca" — ver a seção "Gatilhos" e o achado da
auditoria da 0c logo abaixo.

## Fatia 0c: auditoria de 2026-09-08

Achados marcados **(verificado)** foram rodados contra o Postgres 17 local,
em transação com `ROLLBACK`. O resto é leitura de código.

### Resolvido na 0c.1

`atualizado_por` mentindo na segunda redefinição, máquina de estados sem
enforcement, conferência duplicada e escopo da invariante. Ver `docs/db/0012.md`
e a spec `2026-09-09-usuarios-correcoes-design.md`.

### Invariantes sem teste

- `app_conexao` tentando **executar** as duas: só há conferência de catálogo
  (`has_function_privilege`), não uma chamada real devolvendo `42501`, como a
  0b fez para as tabelas.
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

Com acesso à aplicação não há poder novo além do que a 0b registrou, mas o
caminho ficou mais curto: afirmar o id de qualquer gestor ativo no GUC e
chamar `credencial_definir`, em vez de forjar sessão e chamar `senha_trocar`.

### Herdado, sem gatilho

Duas exceções ao título, marcadas no lugar: `listar()` e o jsdom ganharam
gatilho na revisão de 2026-09-09. Estão aqui porque foi aqui que nasceram.

- `repositorioPostgres(gestorId)` confia no id que recebe. O único elo com a
  sessão real é o `exigir` logo acima, em `acoes.ts`. Nada no tipo impede uma
  feature futura de montar o repositório com id arbitrário.
- `traduzir` casa com o nome `usuario_email_key`, gerado pelo Postgres e
  nomeado por nenhuma migração. Migração que recrie a restrição com outro
  nome degrada a tradução para exceção, em silêncio.
- `agirNaLinhaAcao` despacha quatro verbos por string de formulário. O
  `Exclude<Acao, 'nova_senha'>` já é sinal de que a forma não escala.
- `listar()` traz tudo, sem paginação nem busca. O gatilho registrado era "a
  primeira entidade com volume real não pode copiar este repositório", e ele é
  **proxy de uso, do mesmo tipo que o da faxina**: erra para cedo. `empresas` é
  a próxima fatia e vai parecer que dispara, mas um CRM que ainda não teve um
  login não tem entidade com volume real — vai ter dezenas de linhas, que
  `listar()` serve sem reclamar. Copiar o repositório na `empresas` está
  liberado; o que não pode é copiá-lo **e** apagar este item. Gatilho de
  medição no lugar: **mil linhas na tabela da entidade, ou a primeira
  reclamação de tela lenta.**
- **O gatilho do jsdom pode nunca disparar.** A condição é "componente
  cliente que decide algo sozinho", e o padrão adotado empurra toda decisão
  para o servidor. Na prática `app/` pode crescer indefinidamente sem teste
  automático. Reconsiderar a condição, não só esperar por ela. É o proxy que
  erra para o outro lado: o da faxina disparou cedo e fez barulho; este fica
  mudo e a dívida some de vista. Substituto candidato, de medição: **arquivos
  em `app/**` acima de vinte, ou a segunda verificação manual seguida que
  passar de dez linhas na tabela.**
- Zero gestores ativos por corrida entre dois gestores. Recuperação:
  `db:seed:gestor`.
- A invariante cataloga só definidoras. Função **não** definidora com `GRANT`
  para `app_usuario` fica fora, por decisão: roda como quem chama, sujeita a
  RLS e aos mesmos privilégios, então não escala nada.
- Continua sem catraca o desuso: "concedida e ninguém chama" exigiria cruzar
  o catálogo com o TypeScript.
- A conferência de permissão é redundante entre `usuario_situacao_definir` e
  `sessoes_encerrar_de`: quatro leituras de `usuario` por desativação onde
  duas bastariam, todas por chave primária. Escolha, não descuido
  (`docs/db/0012.md`).
- O teste da isenção de dono detecta menos do que parece: fica vermelho só se
  a dona virar papel comum **e** `FORCE` for ligado, ou se a função deixar de
  ser definidora. Com dona superusuária, `FORCE` sozinho não muda nada.

## Ferramental

- Sem projeto Vitest para React. `jsdom` e plugin instalados, não
  configurados.
- Next 16 usa `proxy.ts`, não `middleware.ts`. Portar o guarda do crm-ch,
  não copiar.
