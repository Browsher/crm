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
  de host. **Ver "Harness com papel próprio" abaixo: o gatilho disparou.**
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
| "primeiro componente cliente que decide algo sozinho" (jsdom) | proxy de complexidade | nunca | **aposentado em 2026-09-09**: disparou tarde, depois do bug — ver "Fatia empresas: o estado inicial" |
| primeiro `.tsx` em `app/` com ramo condicional no corpo do componente | evento observável | — | **novo em 2026-09-09**; a condição aparece no `git diff` |
| precisar corrigir dado de empresa já cadastrada (sem tela de edição) | proxy de dor | tarde | **novo em 2026-09-09** |
| 8% dos CEPs distintos de uma importação real não encontrados | medição | — | **novo em 2026-09-09**; fecha o X que a spec da `cep` deixou aberto |
| a base de empresas voltar a vir da Receita (`empresas_no_endereco`) | evento observável | — | **novo em 2026-09-09** |
| o vendedor precisar filtrar ou priorizar por atividade (CNAE e `atividade_categoria` ausentes) | proxy de dor | tarde | **novo em 2026-09-09**; a premissa que os cortou é falsa — ver "Fatia empresas: a coluna Atividade existe na planilha real" |
| a própria fatia `empresas.1` (empresa cadastrada só visível por `psql`) | evento observável | — | **fechado em 2026-09-09 pela fatia `empresas.2`**: a listagem `/empresas` existe. Durou duas fatias, porque a `empresas.1` entrou entre uma e outra |
| `EXPLAIN ANALYZE` da busca de `/empresas` acima de 300 ms, ou `empresa` acima de 20 mil linhas (índice GIN em `busca`) | medição | — | **novo em 2026-09-09**; 300 ms medidos no banco, não na requisição (R-017) |
| troca de versão maior do Postgres (`sem_acento` `IMMUTABLE` pode mentir) | evento observável | — | **novo em 2026-09-09** |
| `empresa` acima de 500 mil linhas quando a `0015` for aplicada | medição | — | **novo em 2026-09-09**; a reescrita do `ADD COLUMN GENERATED` vira janela de manutenção |
| senha de `app_conexao` reescrita pelo harness (papel próprio `app_teste`) | proxy de dor | tarde | **disparado em 2026-09-09**: quatro interrupções num dia; proposta escrita, não feita |
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
| rodar de novo mantém 1.209.313 linhas e acrescenta linha em `cep_carga` | sim |
| o script imprime fase e progresso a cada 50 mil entradas | sim |

Todos reproduzem exatamente os números do spike, através do pipeline inteiro: a
transformação não perde nem inventa linha.

A recarga foi feita junto com a verificação do progresso, e fechou o buraco que
tinha ficado aberto: **`TRUNCATE` de 1,2 milhão de linhas dentro de transação
funciona**, sem travamento visível, e o retrato antigo dá lugar ao novo sem
instante de tabela vazia. `cep_carga` ficou com duas linhas, como desenhado.

**Tempo real: 352,5 s na primeira carga, 431,7 s na recarga.**

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
`yauzl` levou 4,6× mais.

### Dois números do spike que a carga real corrigiu

O progresso por fase mostrou o que a medição do spike não separava:

| | Spike | Carga real |
|---|---|---|
| leitura e conversão | 77 s (Python) | **359,1 s** (Node) |
| gravação no banco | 6,0 s | **72,6 s** |

Os 6,0 s do spike eram um `COPY` puro numa tabela vazia, sem índice para
manter. A gravação de verdade é `TRUNCATE` de 1,2 milhão de linhas, `COPY` para
a temporária e `INSERT ... DISTINCT ON` numa tabela com chave primária — doze
vezes mais. O número do spike não estava errado; estava medindo outra coisa, e é
o tipo de comparação que engana quem só lê a tabela.

### Suspeita sobre os 4,6×, com gatilho

**É suspeita, não diagnóstico.** Duas observações, nenhuma investigada:

1. Um fluxo de leitura por entrada, aberto e fechado 1,2 milhão de vezes.
2. **O ritmo piora ao longo da carga**: os primeiros 50 mil levaram 12,2 s e os
   últimos 50 mil levaram 22,2 s, quase o dobro. Um custo por entrada constante
   não faria isso. O suspeito mais óbvio é o vetor de CSV crescendo até 1,2
   milhão de strings e a pressão de coleta de lixo que vem junto — mas ninguém
   mediu, e "o suspeito mais óbvio" é exatamente como se erra diagnóstico.

**Gatilho:** se alguém precisar rodar a carga com frequência — mais de uma vez
por trimestre, ou dentro de um deploy — aí investiga. Hoje é operação anual, e
seis a sete minutos com progresso visível é aceitável. É gatilho de **proxy de
dor**, que erra para tarde: a dor chega quando alguém já estiver esperando.

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
  **Fechado em 2026-09-09 pela fatia `empresas`**, e não pelo substituto
  candidato: o gatilho disparou de verdade, tarde, e a leitura está em "Fatia
  empresas: o estado inicial da tela de importar".
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

## Fatia empresas: verificado à mão, sem teste de render

Mesma regra da 0b e da 0c: action fina e JSX sem teste automático — com a
exceção nova do primeiro render, que agora tem
`app/empresas/importar/formulario.test.tsx`. Verificação manual feita em
**2026-09-09** pelo usuário no navegador contra o container local, com a 0014
aplicada e a base de CEP carregada. Refazer quando mexer em `app/empresas/**`.

**O passo 8 é o que justificou o corte desta fatia.** Modelo e tela ficaram na
primeira fatia, e não na `empresas.1`, porque a armadilha do Excel é a única
coisa aqui que teste automático não pega — e ela só aparece com os dois na mão.
Se ele não produzir a mensagem que explica a causa, a fatia não está pronta.

| # | Caminho | Esperado | Verificado |
|---|---|---|---|
| 0 | `/empresas/importar` como gestor, sem importar nada | mostra o campo de arquivo e o botão "Conferir" — **não** "empresas importadas" | sim, depois da correção |
| 1 | `/empresas/importar` como vendedor | redireciona para `/`, não mostra a tela | sim |
| 2 | baixar o modelo pelo link da própria tela | abre no Excel com 7 colunas; CEP na linha 2 é `01310100`, com o zero | sim |
| 3 | preencher 3 empresas e salvar como **CSV UTF-8 (delimitado por vírgulas)** | — | sim |
| 4 | enviar e conferir | "3 novas · 0 já cadastradas · 0 recusadas"; nada foi gravado ainda | sim |
| 5 | confirmar | "3 empresas importadas", **com o número na frente** | sim |
| 6 | enviar o **mesmo arquivo** de novo | "0 novas · 3 já cadastradas"; o botão de importar não aparece | sim |
| 7 | salvar de novo como **CSV** comum (não UTF-8), com acento na razão social | mensagem citando "CSV UTF-8" | sim |
| 8 | abrir o CSV com **duplo-clique**, salvar por cima, reenviar | mensagem de notação científica **ou** de CEP com 7 dígitos, dizendo para formatar a coluna como Texto | sim: CNPJ em notação científica, com a causa e o conserto |
| 9 | duplicar uma linha mudando só o telefone | recusa **as duas**, nomeando a coluna divergente | sim, e rendeu duas correções — ver abaixo |
| 10 | uma linha com CEP `00000000` (**não** `99999999`: existe, é Sarandi/PR) | a empresa entra; o relatório diz "1 CEP não encontrado na base de 2024-07-08" | sim, na segunda tentativa — ver abaixo |
| 11 | arquivo com o cabeçalho fora de ordem | mensagem mostrando o cabeçalho que veio, **sem contagem nenhuma** | sim, na `empresas.1` |

**Os doze passos rodaram.** O 11 ficou em aberto ao fim da fatia `empresas` e
foi fechado durante a `empresas.1`, com um arquivo de cabeçalho fora de ordem —
as sete colunas certas, só a ordem trocada. A conferência que importava era
negativa: o arquivo é recusado na **fase 0**, então nenhuma contagem podia
aparecer, e nenhuma apareceu. As duas linhas de dados do arquivo eram válidas de
propósito.

**Três achados, todos de passos que "passaram".** É o argumento a favor desta
tabela existir, e vale mais que as dez linhas de `sim`:

- **Passo 0 não existia no plano.** Foi acrescentado depois que a tela abriu no
  terceiro estado ("empresas importadas", sem número) antes de qualquer
  importação. Causa em "o estado inicial da tela de importar", abaixo.
- **Passo 9 passou e ainda assim rendeu duas correções.** A recusa da duplicata
  funcionava, mas a mensagem dizia `razaoSocial` — o nome do campo em
  TypeScript, não o da coluna que a pessoa digitou no cabeçalho. Quem lê o
  relatório está com a planilha aberta do lado e procura o nome que não existe.
- **Passo 10 passou por acidente na primeira rodada.** O relatório disse "1 CEP
  não encontrado", e parecia certo — mas a base de CEP estava vazia (recriação
  do banco de dev), então *todos* os CEPs eram não encontrados e o "1" era a
  Avenida Paulista. Na segunda rodada, com a base carregada, apareceu o oposto:
  nada foi reportado, porque `99999999` **existe** — é Sarandi/PR, o maior CEP
  da base. O valor veio de uma frase errada da spec da `cep`, corrigida lá.
  Rodou de verdade com `00000000`.

Nenhum dos três seria pego por teste automático: o primeiro porque a diretiva
`'use server'` é inerte no Vitest, o segundo porque a mensagem estava
"funcionando", o terceiro porque todo teste cria banco novo e popula o que
precisa.

**O que a tabela não cobre, e é escolha:** o limite de 5.000 linhas e o de 2 MB
do transporte. Os dois têm teste de unidade (`planilha.test.ts`), e produzir um
CSV de 5.001 linhas à mão para conferir uma mensagem não paga o trabalho.

## Fatia empresas.1: verificado à mão

Verificação manual feita em 2026-09-09 pelo usuário, contra o container local.
Refazer quando mexer em `src/features/empresas/csv.ts` ou `planilha.ts`.

Os quatro arquivos foram gerados e **rodados contra a fase 1 antes de serem
entregues**, e a saída prevista na conversa era saída medida, não palpite — a
R-019 aplicada a quem escreve o caso de teste, que era exatamente onde ela tinha
falhado três vezes.

| Arquivo | O que exercita | Esperado | Verificado |
|---|---|---|---|
| `1-linha-em-branco.csv` | linha em branco na 3, recusa na 4 | recusa reportada como **Linha 4**, não 3 | sim |
| `2-colunas-erradas.csv` | coluna a mais, e linha terminada em separador | **as duas** recusadas, com "8 colunas; o modelo tem 7" | sim |
| `3-byte-nul.csv` | NUL em `razao_social` (linha 3) e em `email` (linha 4) | nomeia **colunas diferentes** nas duas linhas | sim |
| `4-cabecalho-fora-de-ordem.csv` | as sete colunas certas, ordem trocada | só a mensagem com o cabeçalho que veio, **sem contagem** | sim |

O terceiro só vale enviado direto pela tela: abrir no Excel destrói o byte NUL e
o arquivo perde a graça. Confirmado antes da entrega que os dois bytes NUL estavam
fisicamente no arquivo, nos offsets 143 e 231.

**O que a `empresas.1` NÃO verificou à mão:** a corrida que produz `23505`. Ela
exige duas importações simultâneas do mesmo CNPJ, e reproduzir isso na tela é
mais frágil que o teste de integração que já existe — `gravar` duas vezes, a
segunda devolvendo `cnpj_ja_gravado` e o segundo CNPJ do lote não entrando.

## Fatia empresas: a coluna "Atividade" existe na planilha real

A spec cortou `cnae_codigo`, `cnae_descricao`, `atividade_categoria`, `porte`,
`capital_social` e `data_abertura` com **um argumento só**: eles existiam no
`crm-ch` porque vinham da Receita, e *"ninguém digita capital social à mão numa
planilha de prospecção"*.

**A premissa é falsa para atividade.** A planilha real do gestor tem uma coluna
**"Atividade"**, e ela não é digitada: vem da origem da base. O argumento
continua valendo para `capital_social` e `data_abertura`, que ninguém preenche
de fato — mas foi aplicado em bloco a seis colunas quando só descrevia algumas.

Registrado em 2026-09-09, depois da fatia `empresas.2`.

**Por que não entra agora.** Ter o dado não é ter o uso. Uma coluna que a
importação grava e nenhuma tela lê é a R-014 pelo lado do dado em vez do lado da
função — e a fatia `empresas` já recusou `numero` e `complemento` por
exatamente isso. O que falta não é a coluna: é a decisão de o que a atividade
faz com a fila de ligação.

**Gatilho: quando o vendedor precisar filtrar ou priorizar por atividade.**
Tipo: **proxy de dor**, erra para **tarde** — que é o padrão aceito desta
página (R-016). O custo de errar para tarde aqui é baixo e conhecido: a coluna
vem por `ALTER TABLE`, e a planilha do gestor **continua guardando o dado no
arquivo** enquanto isso. Reimportar preenche o passado; nada se perde por
esperar.

**O que fazer quando disparar**, e a ordem importa: primeiro olhar a coluna
"Atividade" de uma planilha real e ver **que forma ela tem** — texto livre,
vocabulário fechado, ou código CNAE. A spec cortou três colunas diferentes
(`cnae_codigo`, `cnae_descricao`, `atividade_categoria`) que não são a mesma
coisa, e qual delas volta depende do que o arquivo traz. Decidir isso pelo nome
que o `crm-ch` usava seria repetir o erro que este registro corrige.

**O modelo `.xlsx` não muda até lá.** Acrescentar a coluna ao cabeçalho literal
que a fase 0 confere quebraria toda planilha já preenchida pelo gestor, para
guardar dado que nenhuma tela lê.

## Fatia empresas.2: verificado à mão

Não há teste de render além dos três de `renderToStaticMarkup` em
`app/empresas/`. Verificação manual feita pelo usuário em 2026-09-09 e
2026-09-10, no container local, com a `0015` aplicada, a base de CEP carregada
e uma planilha importada. Refazer quando mexer em `app/empresas/**`.

**Os quatorze passos rodaram. Dois reprovaram e os dois foram corrigidos na
própria fatia**, não viraram bilhete: a busca por raiz de CNPJ (4b) e o `?q=`
pendurado na URL (13).

| # | Passo | Esperado | Passou? |
|---|---|---|---|
| 0 | `/empresas` como gestor, sem termo | a lista, com a contagem total; sem paginação se couber numa página | sim |
| 1 | `/empresas` como vendedor | redireciona para `/` | sim |
| 2 | buscar `sao` numa base com "Iluminação São João" | acha | sim |
| 3 | buscar `LAMPADAS` em caixa alta, com a empresa cadastrada como `LÂMPADAS` | acha | sim |
| 4 | buscar o CNPJ com máscara | acha exatamente aquele estabelecimento | sim |
| 4b | buscar a **raiz** (8 dígitos, sem pontuação) | acha todos os estabelecimentos daquela empresa | **reprovado em 2026-09-09; corrigido na mesma fatia** — ver a seção abaixo |
| 5 | buscar quatro dígitos que existem dentro de um CNPJ | não acha nada | sim |
| 6 | buscar `%` | não traz a base inteira | sim |
| 7 | importar mais de 50 empresas e virar a página | a segunda página não repete nem pula, e a contagem continua a mesma | sim |
| 8 | buscar um termo e virar a página | o termo continua no campo e no resultado | sim |
| 9 | empresa com CEP fora da base | mostra o CEP e "não encontrado na base", não "sem CEP" | sim |
| 10 | empresa sem CEP | mostra "sem CEP" | sim |
| 11 | `/empresas?pagina=99` | página vazia com o link "Ver todas" funcionando | sim |
| 12 | link `Empresas` no início | leva à listagem como gestor; como vendedor, o link não aparece | sim |
| 13 | buscar e apagar o campo | a URL volta a `/empresas`, sem `?q=` pendurado | **reprovado em 2026-09-10; corrigido na mesma fatia** (`destinoCanonico`) |

**Antes de subir o `next dev`, rode a suíte** — o harness de integração
reescreve a senha de `app_conexao` e derruba a `DATABASE_URL` do dev. Se já
subiu, `npm run db:senha` refaz.

### A busca por raiz de CNPJ não achava nada

Reprovado na verificação manual, corrigido na mesma fatia. Medido pelo usuário
contra o container local:

| Digitado | Antes | Depois |
|---|---|---|
| `11222333` (a raiz, só dígitos) | **0 empresas**, com quatro na base começando assim | acha as quatro |
| `11.222.333/0099-95` (formatado, como aparece na tela) | acha | acha, só aquela |

**A causa não era a que o sintoma sugeria.** Não havia comparação contra texto
formatado em lugar nenhum — `formatarCnpj` só desenha tela e nunca toca
consulta. O formatado funcionava **porque** `normalizarCnpj` tirava a pontuação
e devolvia um CNPJ de 14 caracteres, que casava na igualdade. O de oito dígitos
falhava porque `normalizarCnpj` **exige** os 14, devolvia `null`, e
`cnpj = NULL` nunca é verdadeiro — enquanto `busca` não contém o CNPJ, de
propósito. Ou seja: **a única condição sobre `cnpj` era igualdade com um CNPJ
inteiro; busca por prefixo não existia.**

**Duas perguntas coladas numa função só.** `normalizarCnpj` valida identidade
para gravar, e por isso exige os 14 — está certa. Buscar é outra pergunta.
Reusá-la para as duas foi o que produziu o defeito, e o conserto é
`prefixoCnpj`, ao lado dela, com o piso na raiz.

**A raiz é a unidade certa, e não um número escolhido por gosto.** As oito
primeiras posições do CNPJ identificam a **empresa**; as quatro seguintes, o
estabelecimento (matriz `0001`, filiais `0002`…); as duas últimas são os
dígitos verificadores. Foi exatamente por isso que quatro linhas começavam
igual. Abaixo de oito o termo não identifica empresa nenhuma — então `'1122'`
continua não achando nada, como antes.

**O que a spec quis dizer com "exata", e o que meu teste tinha entendido.** A
spec diz *"busca por CNPJ é exata e é condição separada no `WHERE`, nunca `LIKE`
dentro de `busca`"*, e o argumento dela é contra **substring não ancorada**:
`'1122'` casando pedaço do CNPJ de empresa nenhuma a ver, de forma diferente
conforme o nome fantasia da vizinha. Prefixo **ancorado na própria coluna
`cnpj`** não é esse caso.

O teste `pedaço de CNPJ não acha ninguém` codificou a **letra** da spec —
"exata" — em vez do **argumento** dela, e por isso passava verde enquanto o
caminho que o gestor mais usa estava quebrado. Teste que fixa a palavra da spec
em vez da razão dela protege a frase, não o usuário. O teste continua existindo,
renomeado para `pedaço curto`, porque a coisa que ele protege — substring solta
não achar — continua valendo.

**O passo não estava na tabela de conferência.** Havia "buscar o CNPJ com
máscara" e "buscar quatro dígitos", e nenhum dos dois é o caminho real: quem
procura uma empresa específica digita o que tem à mão, que é a raiz. A tabela
ganhou o passo 4b. Uma tabela de conferência que só percorre os caminhos que o
implementador já pensou testa a implementação, não o uso.

### O que os testes desta fatia NÃO provam, medido

Os dois estão escritos no comentário do SQL em `listagem.ts`, e estão aqui
porque são a classe de erro que a R-017 registra: afirmação com cara de prova.

- **`ESCAPE '\'` não acrescenta comportamento.** A barra invertida já é o escape
  padrão do `LIKE` no Postgres. Medido: removida a cláusula, os 14 testes de
  `empresas-listagem` continuam passando. Ela fica por ser explícita, não por
  ser necessária. Quem faz o trabalho é `escaparLike` em `consulta.ts` — sem
  ela, o teste do `_` falha (`expected 3 to be +0`).
- **O teste do `%` passa por acaso.** Sem escape, `100%` vira o padrão `%100%%`,
  que ainda só acha quem tem "100" na razão social. A regressão real é pega pelo
  teste do `_`.
- **Os totais da paginação eram somados à mão.** `POR_PAGINA + 8` acoplava o
  `describe` de paginação à quantidade de fixtures dos outros: acrescentar três
  linhas noutro bloco quebrou dois testes que não tinham nada a ver com a
  mudança. Agora a contagem sai de um `count(*)` no próprio `beforeAll`, que é
  o que o teste queria dizer — a janela do `count(*) OVER ()` concorda com a
  tabela inteira.
- **O desempate `ORDER BY ..., e.id` não é cobrado por teste nenhum.** Medido:
  removido o `, e.id`, os 14 continuam passando — com esta tabela e este plano
  de consulta o Postgres devolve ordem estável por acaso. O desempate fica
  porque o SQL não promete ordem entre linhas iguais, e um teste que dependesse
  do plano de consulta para falhar seria pior que nenhum.

## Fatia empresas: auditoria

Feita em 2026-09-09, depois da verificação manual, no formato das auditorias da
0b e da 0c. O que vira fatia está marcado; o resto fica aqui.

### Afirmações da spec sem teste

- **"Confirmar reenvia o mesmo arquivo"** não é garantido por nada. O navegador
  lê o arquivo do disco no envio: se ele mudar entre conferir e confirmar,
  grava-se conteúdo que ninguém conferiu. O teste existente prova que os dois
  relatórios são iguais **para os mesmos bytes**, que é outra pergunta.
- **`bodySizeLimit: '2mb'`** não é lido por teste nenhum. Apagar a chave deixa a
  suíte verde e devolve o limite de 1 MB do Next, com a requisição morrendo
  antes do nosso código.
- **"A empresa entra mesmo com CEP não resolvido"** — `gravar` com `cep` nulo é
  testado; empresa com CEP **preenchido e não resolvido** nunca é inserida em
  teste. É o caso que justifica não haver FK.
- **"O modelo é servido em `/modelo-empresas.xlsx`"** — o arquivo é comparado
  byte a byte, a rota não é conferida.
- **"A página é uma só em dois estados"** — sem teste; só o primeiro render.
- **"As mensagens dizem a causa"** vale só para o CNPJ:
  `pareceNotacaoCientifica` não é aplicada a telefone nem a CEP.

### Código sem cobertura

- **`app/empresas/importar/acao.ts` inteiro.** Inclui `limpar`, "arquivo ausente
  ou vazio", o ramo `confirmar` e `aoFalhar`. É a camada onde nasceu o bug do
  estado inicial.
- **`textoDoMotivo`** — exportada, usada na action, sem teste.
- **`formulario.tsx`, três dos quatro estados** (relatório, erro, gravado).
- **`page.tsx`.**
- **`importar` quando `gravar` falha** — `repoFalso` sempre devolve `ok`.
- **`LIMITE_DE_LINHAS` como símbolo:** os testes usam o literal `5001`, então
  mudar a constante para 3.000 deixa tudo verde e a mensagem mentindo.

### Superfície de ataque

Com **sessão de vendedor: nada encontrado.** Duas barreiras independentes,
`exigir('gestor')` e a política do banco, e a segunda foi conferida sozinha.

Com **sessão de gestor**, o interessante é o que ele consegue sem querer:

- Gravar arquivo não conferido, trocando-o no disco entre conferir e confirmar.
- **Corrida entre duas abas:** `gravar` não tem `ON CONFLICT`; `23505` não é
  traduzido e vira 500. **Corrigido na `empresas.1`.**
- **Byte NUL** (`U+0000`) é UTF-8 válido, passa a fase 1 e o Postgres recusa com
  `22021`, também não traduzido. **Corrigido na `empresas.1`.**

Com **CSV malicioso**:

- **Numeração de linha erra quando há linha em branco no meio.** Demonstrado:
  linha vazia na 3 faz a recusa da linha 4 ser reportada como linha 3.
  `lerCsv` descarta vazias e `analisarPlanilha` numera pelo índice do array
  filtrado. **Corrigido na `empresas.1`.**
- **Colunas a mais entram em silêncio.** Demonstrado: linha com 9 campos é
  aceita e as duas extras somem. Faltar recusa, sobrar não. **Corrigido na `empresas.1`.**
- O limite de 5.000 linhas é conferido **depois** de parsear o arquivo inteiro.
  Limitado pelos 2 MB, então é desperdício e não vetor.
- Fórmula em campo de texto (`=cmd|...`) é guardada como veio. Inofensivo hoje
  — React escapa e não há exportação. Vira problema no dia em que houver
  exportar CSV, e é dívida registrada por isso.

### O que a `empresas.1` e a fila herdam com fragilidade

- A `0015` reescreve a tabela com `ACCESS EXCLUSIVE` (gatilho registrado).
- `sem_acento` marcado `IMMUTABLE` é promessa que o Postgres não cobra:
  dicionário diferente entre 17 e 18 desatualiza a coluna em silêncio.
- **Duas formas de resolver endereço:** `resolverCeps` na importação e
  `LEFT JOIN cep` na listagem. Duas implementações da mesma pergunta, livres
  para divergir.
- A política gestor-só será trocada, e o mascaramento volta à mesa — onde o
  `crm-ch` se enforcou.
- `Relatorio` nasceu com dois campos e já tem cinco, todos por pressão de tela.
- A numeração de linha errada é herdada por qualquer relatório futuro que
  aponte para o arquivo.

### Afirmações sobre dado escritas sem verificação

O achado que virou **R-019**. Medido contra a base carregada em 2026-09-09:

| Afirmação da spec da `cep` | Medido |
|---|---|
| 1.209.313 linhas | 1.209.313 ✓ |
| `logradouro` falta em 10.392 (0,86%) | 10.392 (0,86%) ✓ |
| `bairro` falta em 7.200 (0,6%) | 7.200 (0,60%) ✓ |
| `faixa` só em 16,3% | 16,31% ✓ |
| 27 UFs distintas | 27 ✓ |
| `localidade`, `uf`, `ibge` sem furo | 0 furos ✓ |
| consulta por PK em 0,25 ms | 0,098 ms — melhor que o registrado |

**Todo agregado conferiu. O que falhou foi valor singular**, três vezes:

1. `'99999999'`, "um CEP que nunca existiu" — existe, é Sarandi/PR, e é o
   **maior CEP da base**. Corrigido na spec da `cep`.
2. "as sete colunas dão ~150 bytes por linha" — nunca medido. Medido depois:
   **142 bytes** numa linha cheia realista, **50** numa esparsa. Certo por
   acidente no pior caso, 3× superestimado no comum. O `bodySizeLimit` foi
   dimensionado sobre esse número.
3. "5.000 linhas ≈ 750 KB" — derivado do anterior; real **693 KB**. Conclusão
   sobrevive, a conta não era conta.

E uma coberta pela metade: **"o Excel destrói CNPJ e CEP"**. A verificação
manual confirmou o CNPJ em notação científica. O **CEP com zero comido nunca foi
observado** — há código, mensagem e teste de unidade para um comportamento que
ninguém viu acontecer.

## Fatia empresas: a 0014 foi corrigida antes do merge

`numero` e `complemento` chegaram a ser escritas, aplicadas no container e
testadas. Saíram na revisão final, com o `CHECK`
`empresa_endereco_precisa_de_cep` junto: o endereço existe nesta tabela porque o
CEP dá cidade e UF para segmentar ligação, e número de porta serve para visitar
— coisa que este CRM não faz.

**Como isso foi feito, e por que não foi migração nova.** A regra 3 de
`fundacao.md` diz "aplicada é imutável", e a `0014` estava aplicada. Mas o único
ambiente que a tinha rodado era o container de dev: `origin/main` estava no
commit da fatia `cep`, não havia branch no remoto, a Railway não tinha visto
nada, e cada arquivo de teste de integração cria o próprio banco e o derruba. A
regra existe para ninguém reescrever história que outro ambiente já rodou; aqui
não havia outro ambiente.

A alternativa era pior e barrada: `DROP COLUMN` é recusado por `checar.ts:47`, e
mesmo que passasse deixaria duas migrações onde uma basta, mais duas colunas
mortas em qualquer ambiente que aplicasse só a `0014`.

**O preço, e é o que torna isso escolha e não conveniência:** o banco de dev do
container ficou divergente do arquivo e precisou ser recriado à mão. Uma vez.
Depois do merge, essa saída deixa de existir — daí em diante é migração nova, e
`DROP COLUMN` não é permitido.

## Harness com papel próprio — proposta, gatilho disparado

**O que acontece.** `criarBancoDeTeste` faz
`ALTER ROLE app_conexao LOGIN PASSWORD 'teste'` a cada arquivo de teste de
integração (`tests/integracao/ajuda.ts:39`). Papel é global no cluster, então a
senha do `app_conexao` do banco de dev é reescrita junto. A `DATABASE_URL` do
`.env.local` para de funcionar até alguém rodar `npm run db:senha`.

**O gatilho disparou, e o que mudou foi a contagem.** Isso estava registrado
desde 2026-08 como "consequência concreta", sem gatilho — o padrão "pegar quando
doer", proxy de dor que erra para tarde. Em **2026-09-09**, durante a
verificação manual da fatia `empresas`, interrompeu o trabalho **quatro vezes no
mesmo dia**. Quatro não é anedota: é o custo aparecendo junto, e é o que
transforma a observação em proposta.

Também vale dizer o que fez o número saltar: a fatia `empresas` é a primeira com
verificação manual longa **intercalada com rodadas de teste**. Nas fatias
anteriores as duas coisas eram fases separadas, e a colisão quase não acontecia.

**A proposta:** o harness usa papel próprio, `app_teste`, em vez de reescrever o
`app_conexao`. Papel de teste não tem por que ser o mesmo papel da aplicação — o
motivo de ser o mesmo é histórico, não desenhado.

O que isso resolve, além da interrupção: o harness deixa de mexer num papel que
a aplicação usa, então **rodar teste para de ter efeito colateral em ambiente
nenhum** — inclusive na Railway, se um `.env.test.local` apontar para lá por
engano. Hoje esse risco existe e não tem conferência de host.

**O que custa:** uma migração criando `app_teste` como membro de `app_usuario`
sem herança, no molde do `app_conexao` (`0006`); `ajuda.ts` passa a alterar
`app_teste`; e a invariante de papéis ganha mais um nome. Não é grande, mas é
migração — não cabe no meio de uma fatia de produto.

**Enquanto não for feito:** não rodar a suíte durante verificação manual sem
avisar. O conserto é `npm run db:senha -- app_conexao <senha do .env.local>`.

**Observação de 2026-09-08, que continua sem explicação:** depois de rodar a
suíte inteira, a `DATABASE_URL` do `.env.local` **continuou funcionando** contra
o container naquela ocasião. O fato está registrado, a causa não foi
investigada, e as quatro interrupções de 2026-09-09 mostram que o
comportamento não é confiável nos dois sentidos.

## Fatia empresas: o terceiro estado do CEP

A spec da `cep` criou `cep_carga` para desfazer uma ambiguidade de dois estados:
**um CEP que não resolve não existe, ou é mais novo que a base?** Apareceu um
terceiro, na verificação manual desta fatia: **a base nunca foi carregada neste
banco.**

Ele é o mais provável em ambiente novo, e não é hipotético — a Railway está
assim neste momento, porque a carga só rodou no container. Sem separar, uma base
ausente vira "todos os CEPs não encontrados": verdade literal, conclusão errada,
e manda procurar defeito nos dados quando o que falta é rodar um comando.

`textoDoEndereco` em `src/features/empresas/mensagens.ts` separa os três, e a
mensagem do caso novo **dá a saída** — cita `db:cep:carregar` —, como as
mensagens de estrago do Excel. `Relatorio` ganhou `cepsPedidos` para distinguir
"a base não está carregada e isso importa" de "não há CEP nenhum neste arquivo",
onde avisar seria ruído.

Foi achado por uso, não por revisão: a base tinha sumido de verdade, por causa
da recriação do banco de dev registrada em `fundacao.md`.

## Fatia empresas: o estado inicial da tela de importar

`/empresas/importar` abria no terceiro estado — "empresas importadas", sem
número na frente, e o botão de recomeçar — antes de qualquer importação.

**A causa, conferida no build e não deduzida:** `app/empresas/importar/acao.ts`
exportava a constante `IMPORTAR_INICIAL` de um arquivo `'use server'`. O
`server-reference-manifest.json` listava **duas** `createServerReference` para o
arquivo: uma para a action e outra para a constante. Todo export não-função de
um arquivo `'use server'` vira referência de servidor. No cliente,
`IMPORTAR_INICIAL` chegava como função; `estado.inseridas` era `undefined`;
`undefined !== null` é verdadeiro; o ramo de "gravado" renderizava, com
`{estado.inseridas}` vazio.

Nada acusava. `typecheck`, `lint`, `build` e os 383 testes passavam. Só a tela
mostrava, e só para quem abrisse.

### A lição não é "faltava teste de render"

Isso precisa estar escrito porque é a conclusão que o caso *parece* ter, e é a
errada.

Os dois testes que entraram com a correção foram medidos contra o bug ainda
presente, um de cada vez:

| Teste | Trabalho | Com o bug presente |
|---|---|---|
| `app/empresas/importar/formulario.test.tsx` | o primeiro render mostra o formulário | **passa** |
| `src/server/diretivas.test.ts` | arquivo `'use server'` só exporta função | **falha**: `expected [ 'IMPORTAR_INICIAL' ] to deeply equal []` |

O teste de render **passa com o bug**, porque no Vitest a diretiva `'use server'`
é uma string literal inerte: a constante importada ali é o objeto de verdade,
não a referência de servidor que o Next produz. Ele guarda o ramo; não vê a
causa. Quem vê é a catraca de diretivas.

Então o teste de render entrou porque render sem cobertura nenhuma é dívida
real — e o gatilho do jsdom era exatamente sobre isso. Mas **não foi ele que
teria evitado este bug**, e tratar o caso como prova de que faltava jsdom
levaria a instalar jsdom, testing-library e um projeto Vitest novo para pegar
uma classe de erro que eles não pegam.

### O gatilho aposentado, e o que entrou no lugar

O gatilho do jsdom era `proxy de complexidade` errando para "nunca", e a página
já suspeitava disso. Ele disparou — tarde, que é o defeito previsto: a condição
"componente cliente que decide algo sozinho" só ficou verdadeira quando o
componente já estava escrito, publicado e errado.

No lugar entra **evento observável**: primeiro `.tsx` em `app/` com ramo
condicional no corpo do componente. A condição aparece no `git diff`, como a de
`app/**` da conferência manual — e a diferença entre proxy e evento observável é
exatamente essa: um espera alguém lembrar de perguntar, o outro se mostra.

O que **não** entrou: nenhuma catraca vê "escreveu componente sem olhar o
vizinho que já resolve o mesmo problema". Isso virou R-018, que é bilhete.

## Fatia fila.1: os cinco gatilhos

Todos no formato da R-016: tipo, lado do erro e o número quando há. Desenho em
`docs/superpowers/specs/2026-09-10-fila-design.md`.

> **Reauditados pela fatia `contato`.** O 1 foi resolvido e substituído; o 4 foi
> trocado; o 2, o 3 e o 5 continuam de pé sem alteração. A auditoria um a um
> está em "Fatia contato: o que acontece com os gatilhos da fila.1", adiante.

| # | O que dispara | Tipo | Erra para | Estado |
|---|---|---|---|---|
| 1 | empresas já reservadas alguma vez encostando no total da base → **histórico de tentativa** | medição | tarde | **resolvido na fatia `contato`**; virou o gatilho A |
| 2 | menor descanso que a fila está entregando encostando no piso → **revisar os 30 dias** | medição | **cedo** | vivo, sem dado |
| 3 | vendedor perguntar "está com alguém?" ao gestor mais de 1×/semana → **consulta por CNPJ** | proxy de dor | tarde | vivo, 0 |
| 4 | algum vendedor passar de 200 na carteira → **teto de carteira** | medição (chute) + proxy | tarde | **substituído pelo gatilho C** |
| 5 | a base crescer → **promover a `fila.2`** (bloqueio) | medição | tarde | vivo, 3/mês; adiado pela fatia `contato` |

### 1. Histórico de tentativa: o custo central da fatia

Empresa que cumpriu o descanso volta à fila **indistinguível de uma nunca
tocada**. Sem histórico, "já ligamos para esta?" não tem resposta na aplicação.

```sql
SELECT count(*) FILTER (WHERE primeira_reserva_em IS NOT NULL), count(*) FROM empresa_fila;
SELECT count(*) FROM empresa;
```

Hoje 0 de 65. Dispara quando o primeiro se aproximar do segundo — ou seja,
quando a fila der a primeira volta completa. **Não é tempo passando: é a base
girando.** Erra para tarde, e o custo de errar para tarde é uma fatia feita
depois, não dado perdido: nada do que existe hoje é apagado por ela.

### 2. O piso de 30 dias: a única medição desta página que erra para cedo

A medição óbvia — "quantas empresas voltaram dentro do piso" — **é impossível
por construção**: o piso é filtro, então a resposta é sempre zero. A pergunta
certa é o inverso, **quanto descanso a fila está de fato entregando**, e ela é
legível do estado atual sem coluna nova, porque a data de devolução está
codificada no piso:

```sql
SELECT min(now() - (f.elegivel_em - interval '30 days')) AS descanso_mais_curto
  FROM empresa_fila f
 WHERE f.elegivel_em IS NOT NULL AND f.elegivel_em <= now()
   AND f.vendedor_id IS NULL AND (f.reservado_ate IS NULL OR f.reservado_ate < now());
```

"A mais fresca que a fila está a ponto de entregar descansou X dias." Com base
folgada, X fica bem acima de 30 e ninguém olha. Quando X encostar no piso, a
base é pequena demais para o consumo, e isso aparece **antes** de alguém
reclamar. É snapshot, não histórico: diz o que a fila faria hoje, não o que ela
fez — cada devolução sobrescreve a anterior.

Os 30 dias são **chute declarado**. O outro gatilho para revisitá-los é a
primeira reclamação de empresa ligada demais, que é proxy e erra para tarde.

### 4. Teto de carteira: por que adiar é seguro

Posse é ilimitada. No `crm-ch` o limite de reserva era estrutural (uma por vez)
e posse não tinha limite nenhum.

**O mecanismo caro não é `CHECK`.** Um `CHECK` no Postgres não consegue
expressar "no máximo 200 por vendedor": é por linha, e subconsulta é proibida. A
versão cara é **gatilho** contando as linhas do vendedor, ou coluna contadora
denormalizada com o problema de consistência que ela traz. A versão barata é uma
conferência dentro de `empresa_assumir`, e cabe a qualquer momento.

**E ela é mais barata do que parece, porque teto como alarme não precisa ser
exato.** Dois `assumir` simultâneos em 199 passam os dois e a carteira fica com
201. Se o teto fosse lei, a corrida exigiria trava e a conversa mudaria; como
alarme para alguém olhar, 201 não significa nada. É essa frouxidão consciente
que torna adiar seguro.

**200 é chute e serve como alarme, não como limite.** Quando disparar, a
pergunta certa é "quantas o melhor vendedor consegue trabalhar de verdade", e só
a operação responde.

### 5. Promover a `fila.2`: o custo do bloqueio adiado, com número

Empresa sem futuro reaparece a cada 30 dias e o vendedor devolve de novo: **uma
ligação desperdiçada por empresa bloqueável, por mês.**

| Base | Bloqueáveis | Ligações desperdiçadas/mês |
|---|---|---|
| 65 (hoje) | ~3 | **3** |
| 2.246 | 5% = 112 | **112** |

**O gatilho é a base crescer, não o tempo passar.** Três por mês não paga uma
fatia; 112 paga. A próxima importação grande é o momento de reavaliar, e o
número sai da conta acima, não de impressão.

O par bloquear/desbloquear é indivisível: bloqueio é a única operação
irreversível do desenho e quem o executa é o vendedor. Entregar o gatilho sem o
desfazer faria erro de clique custar `psql`.

## Fatia fila.1: verificado à mão

Não há teste que exercite as telas de verdade — `Cartao`, `ListaCarteira` e
`Formulario` têm render por `renderToStaticMarkup`, e a action
`agirNaFilaAcao` não tem teste nenhum. Esta verificação é o que cobre isso.
Feita pelo usuário em **2026-09-10**, no container local, com a `0016`
aplicada, a base de CEP carregada, as 65 empresas importadas, um gestor e dois
vendedores. Refazer quando mexer em `app/fila/**` ou `app/carteira/**`.

**Os dez passos rodaram e os dez passaram.**

| # | Passo | Esperado | Passou? |
|---|---|---|---|
| 1 | vendedor puxa | empresa com endereço resolvido e contagem correndo | sim |
| 2 | puxa de novo | vem **outra**, e a primeira volta a aparecer depois | sim |
| 3 | assume | sai de `/fila` e aparece em `/carteira` | sim |
| 4 | devolve | sai da carteira e **não reaparece** ao puxar | sim |
| 5 | gestor em `/empresas` | continua vendo as 65 | sim |
| 6 | vendedor B | **não** vê a empresa que está com o A | sim |
| 7 | reserva expira sem assumir | volta a ser puxável, e o A deixa de ler o contato | sim |
| 8 | gestor desativa o vendedor A | a carteira dele volta a ser puxável | sim |
| 9 | senha provisória pendente tenta puxar | recusa **com mensagem**, não tela branca | sim |
| 10 | base inteira indisponível | estado vazio diz **por que**, sem a palavra "quarentena" | sim |

**Ordem que a rodada usou, e por que ela importa:** criar o vendedor B como
gestor deixa ele com senha provisória pendente, então o passo 9 sai de graça
antes de trocar a senha. Sem essa ordem, o passo 9 exige desfazer estado ou
criar um terceiro usuário.

**Dois passos admitem atalho por SQL**, e o roteiro os ofereceu: o 7 forçando
`reservado_ate = now() - interval '1 minute'`, e o 10 pondo a base inteira em
descanso por `INSERT ... ON CONFLICT` com `elegivel_em = now() + interval '30
days'`. **Qual caminho foi usado nesta rodada não ficou registrado** — esperar
os 30 minutos e forçar o relógio provam a mesma regra, mas só a espera prova
que o prazo gravado é o que o banco gravou. Vale escolher e anotar na próxima.

**O que esta verificação NÃO cobriu:** nenhuma corrida. Duas abas puxando no
mesmo instante é o que os testes de `SKIP LOCKED` e da trava cobrem, e
reproduzir isso no navegador é mais frágil que o teste que já existe — mesma
decisão que a `empresas.1` tomou sobre o `23505`.

## Fatia fila.1: fragilidades herdadas

- **Abandono é gratuito e invisível.** Fechar o navegador não grava nada.
  Empresa com telefone ruim pode ser puxada, abandonada e reoferecida
  indefinidamente, para um vendedor depois do outro, sem sair do topo. Não há
  como distinguir "abandonou" de "ligou e não devolveu" sem histórico — é o
  gatilho 1.
- **A assimetria devolver × abandonar.** Devolver custa 30 dias de descanso;
  abandonar custa zero. Quem quisesse a empresa de volta logo bastaria
  abandoná-la. Não há ganho pessoal nisso (ela não volta com preferência para
  ele), então fica registrado e não corrigido.
- **A reserva não se renova.** Ligação de 35 minutos perde a reserva, e outro
  vendedor pode puxar a empresa. O caminho é assumir antes de a conversa
  esticar. Se doer, o conserto é renovar na tela, não aumentar o prazo.
- **A tabela guarda estado atual.** Toda escrita sobrescreve o dono anterior sem
  rastro — inclusive `empresa_devolver`. "Quem trabalhou essa empresa antes?" é
  a fatia do histórico.
- **`empresa_leitura` depende de `empresa_fila_leitura`.** Estreitar a segunda
  estreita a primeira em silêncio; nenhuma invariante lê conteúdo de política
  além de `USING (true)` literal, e não vai ler — comparar texto de expressão
  quebra na primeira reformatação do Postgres. A rede é um par de testes em
  `fila-politicas.test.ts`: um pega o estreitamento, o outro nomeia de qual
  tabela ele veio.
- **`elegivel_em ASC` só é "voltou há mais tempo" enquanto houver um prazo só.**
  A `fila.2` não pode introduzir um segundo prazo sem revisitar a ordenação.
- **A trava é em `empresa` e a escrita em `empresa_fila`.** Função nova que
  escreva na fila precisa travar `empresa` primeiro. Quem esquecer não recebe
  erro: só perde corridas em silêncio.
- **`empresas.test.ts > vendedor nao le nenhuma linha` passa hoje por outro
  motivo que o nome sugere.** Ele foi escrito para a política gestor-só; com a
  política nova ele continua verde porque o vendedor não tem linha em
  `empresa_fila`. Não é falso — é frágil de ler. Renomear quando alguém mexer
  naquele arquivo.
- **O `Cartao` conta minutos no servidor, sem relógio no cliente.** O número
  congela até a próxima navegação. Suficiente para 30 minutos, e mantém o
  componente testável por `renderToStaticMarkup`.
- **O estado vazio da fila não conta empresas.** O vendedor não lê `empresa`
  fora do que está com ele, então a tela explica a causa sem número. Dar a
  contagem exigiria função nova, e é fatia própria.

## Fatia fila.1: o que os testes NÃO provam

- **Nenhum teste exercita as telas de verdade.** `Cartao`, `ListaCarteira` e
  `Formulario` têm render por `renderToStaticMarkup`; ninguém clica, e a action
  `agirNaFilaAcao` não tem teste. O que cobre isso é a verificação manual.
- **O `Formulario` é testado com `useActionState` trocado por mock.** O que se
  prova é qual ramo renderiza para cada estado, não que o estado chegue.
- **A corrida `devolver` × `fila_puxar` não tem teste**, só a de `assumir`. A
  trava é a mesma linha nas duas funções, e o argumento é o mesmo — mas isso é
  raciocínio, não medição.
- **Nada roda contra Postgres 18.6**, que é a versão da Railway. Os testes rodam
  em 17.
- **Nenhuma invariante confere o conteúdo de `usuario_publico`.** A view contorna
  a RLS de `usuario` por desenho, e acrescentar `email` a ela é uma linha de SQL
  numa migração futura. O obstáculo é um teste de coluna inexistente, que
  falharia por um motivo que parece burocrático para quem não leu
  `docs/db/0020.md`.

## Fatia contato: o que acontece com os gatilhos da `fila.1`

Os cinco, um a um, no formato da R-016. Desenho em
`docs/superpowers/specs/2026-09-10-contato-design.md`.

### 1 — resolvido, e o numerador troca de pergunta

O gatilho existia para cronometrar uma fatia: *"quando a fila der a primeira
volta, faça o histórico"*. A fatia `contato` **é** o histórico. Gatilho cujo
remédio embarcou não fica esperando.

**Mas a medição não vira redundante**, porque `primeira_reserva_em` e `contato`
respondem coisas diferentes: a primeira diz que alguém **recebeu** a empresa na
tela, a segunda diz que alguém **ligou**. A diferença entre as duas é exatamente
o abandono, que a `fila.1` registrou como fragilidade sem medida. Vira o gatilho
A, adiante.

### 2 — o piso de 30 dias: não muda

É sobre tamanho de base contra consumo. Contato não toca nisso.

### 3 — consulta por CNPJ: não muda

Contato não responde "está com alguém?": o vendedor continua sem enxergar
empresa alheia, porque `contato_leitura` delega para `empresa_leitura`.

### 4 — teto de carteira: substituído, não mantido

O `200` sai. A `fila.1` já o registrara como chute, e ele era **proxy de uma
coisa que passou a ser mensurável direto**: próximos passos vencidos na carteira
de um vendedor. Vira o gatilho C.

Manter os dois deixaria um alarme que dispara pelo motivo errado ao lado de um
que dispara pelo certo — e alarme que dispara sem problema treina a ignorar
alarme, que é o custo que a R-016 registra para o proxy que erra para cedo.

### 5 — promover a `fila.2`: adiado, não aposentado

O número de ligações desperdiçadas por mês não muda, mas **o custo de cada uma
cai**: o vendedor B, ao puxar, lê "A ligou três vezes, sem interesse" e gasta
trinta segundos em vez de uma ligação. Adiar é o resultado certo — bloqueio
continua sendo a única operação irreversível do desenho, e o par
bloquear/desbloquear continua indivisível.

## Fatia contato: os gatilhos novos

| # | O que dispara | Tipo | Erra para | Hoje |
|---|---|---|---|---|
| A | reservadas com **zero** contatos, de qualquer tipo (abandono) | medição | tarde | 0 de 0 |
| B | proporção alta de `nao_liguei` sobre reservadas (descarte) | medição | tarde | 0 de 0 |
| C | próximos passos vencidos há mais de **7 dias** por vendedor | medição (chute) | tarde | 0 |
| D | carteira de uma pessoa passando de **80 empresas** | medição (chute) | tarde | máx. possível 65 |
| E | pedido de segundo prazo de devolução | proxy de dor | tarde | 0 |

### A — empresas que passam pela tela sem deixar rastro

```sql
SELECT count(*) FILTER (WHERE f.primeira_reserva_em IS NOT NULL AND c.n = 0) AS abandonadas,
       count(*) FILTER (WHERE f.primeira_reserva_em IS NOT NULL) AS reservadas
  FROM empresa_fila f
  LEFT JOIN LATERAL (SELECT count(*) AS n FROM contato WHERE empresa_id = f.empresa_id) c ON true;
```

**Esta é a contagem de _rastro_, e por isso `nao_liguei` NÃO é excluído dela.**
Empresa com `nao_liguei` foi vista e descartada por decisão de alguém; ela não
foi abandonada. Excluí-la aqui somaria descarte deliberado com abandono e
apagaria justamente a distinção que o tipo nasceu para criar. Quem conta descarte
é o gatilho B.

**Remédio, e ele vai escrito porque gatilho sem remédio dispara e fica parado:**
a tela cobrar o registro antes de liberar o botão. Não é tabela nova, é regra de
action. Isso também termina de corrigir a assimetria devolver × abandonar —
abandonar deixa de custar zero e passa a custar uma linha faltando numa conta.

### B — descarte sem ligar mede problema de cadastro, não de fila

Proporção alta de `nao_liguei` sobre reservadas significa que a importação está
trazendo empresa fora do segmento. **Hoje isso é invisível, porque ninguém está
olhando para lá** — e o remédio não é mexer na fila, é rever de onde a base vem.

### C e D — os dois chutes, rotulados como chute

- **7 dias** (C) é o intervalo em que alguém ainda lembra da conversa. Passou
  disso, o próximo passo vencido deixou de ser atraso e virou combinado perdido.
  Substitui o `200` da `fila.1`. Remédio: teto dentro de `contato_registrar`, ou
  conversa com a operação — a medição diz qual.
- **80 empresas** (D) é a base de hoje mais folga, e o gatilho é sobre **custo de
  leitura**: o próximo passo é derivado por `LEFT JOIN LATERAL` a cada
  renderização da carteira. Remédio: view materializada ou coluna de cache, **com
  medição antes** — é a medição que separa esse cache do que a auditoria do
  `crm-ch` pegou. **Está estruturalmente mudo enquanto a base for 65**: a maior
  carteira possível é a base inteira, e 65 não chega a 80. É registro, não
  vigilância — ninguém precisa olhar para ele até a próxima importação.

### E — segundo prazo de devolução: não é mudança isolada

`nao_atendeu` deveria voltar em dias, `retornar_depois` em meses, `sem_interesse`
em muito tempo. Hoje os três custam 30 dias.

**A dependência vai escrita junto, porque quem implementar precisa dela:**
`elegivel_em ASC` só significa "voltou há mais tempo" **enquanto houver um prazo
só**, e a conta do gatilho 2 da `fila.1`
(`dias desde a devolução = now() - (elegivel_em - interval '30 days')`) lê a data
de devolução **de dentro** do `elegivel_em`, assumindo intervalo fixo — com dois
prazos ela passa a devolver número errado **sem errar**. Quem implementar
revisita a ordenação e o gatilho 2 na mesma fatia, ou grava a data de devolução
em coluna própria.

**O dado para calibrar os três prazos nasce nesta fatia**, nos tipos. É o oposto
de `primeira_reserva_em`: coluna barata hoje que evita medição impossível depois.

## Fatia contato: verificado à mão

No container, com a base de CEP carregada, as 65 empresas importadas e dois
vendedores. Doze passos.

| # | O que se esperava | Passou |
|---|---|---|
| 0 | criar segundo vendedor e trocar a senha dele | sim |
| 1 | puxar traz empresa com endereço, contagem e histórico vazio | sim |
| 2 | registrar `nao_atendeu` com devolver tira a empresa da fila | sim |
| 3 | `interessado` assume; a carteira mostra o grupo "sem próximo passo" contado | sim |
| 4 | acompanhamento com data de ontem sobe ao topo com "(vencido)" | sim |
| 5 | acompanhamento com data futura substitui o anterior | sim |
| 6 | acompanhamento sem próximo passo é recusado pela tela | sim |
| 7 | "Registrar e devolver" tira a empresa da carteira | **não — dois defeitos** |
| 8 | `retornar_depois` avisa que a data não agenda nada | sim |
| 9 | vendedor B lê o contato que A escreveu | **parcial**, e um defeito |
| 10 | `nao_liguei` devolve sem inventar ligação | sim |
| 11 | senha provisória pendente recusa o registro | sim |
| 12 | gestor vê as 65; ficha de empresa alheia é 404 | sim |

**O passo 9 passou no que importa e falhou na mecânica de chegar lá.** O
vendedor B leu a nota do vendedor A numa empresa que A tocou — o histórico
atravessa a troca de dono, que é o propósito da fatia. Mas a empresa não voltou
ao topo da fila sozinha: foi preciso forçar a elegibilidade pelo banco. A
ordenação já tem teste de integração; o que o passo provou foi a leitura.

### Os quatro defeitos, e três deles são o mesmo erro

**Três têm uma causa só: a tela raciocinava sobre o estado ANTERIOR à ação, não
sobre o desfecho dela.**

1. **O aviso dos 30 dias era fixo.** Aparecia nos cinco tipos de reserva,
   inclusive em `interessado` — que **assume** a empresa em vez de devolvê-la. O
   aviso mentia. Consertado: o aviso segue `DESFECHO_SUGERIDO[tipo]`, e o ramo
   que assume diz que a empresa vai para a carteira.
2. **"Registrar e devolver" exigia próximo passo.** A empresa está saindo da
   carteira: não há o que combinar com quem você não vai mais ligar. Consertado
   em `regras.ts` — a exigência passou de `posse` para
   `posse && desfecho === 'nenhum'`, isto é, "a empresa continua comigo depois
   disto".
3. **Devolver pela ficha mostrava erro E funcionava.** A ação dava certo, e a
   revalidação de `/carteira/[id]` renderizava uma página cuja empresa já não
   está na carteira — `notFound()`. Consertado: a ficha manda `voltarPara`, e a
   action redireciona para `/carteira` quando o desfecho é devolver. A fila não
   manda nada, porque `/fila` continua existindo depois de devolver.

**O quarto é separado, e o diagnóstico inicial estava errado.** O histórico
mostrava `sistema` como autor. `criado_por` **não** estava nulo — conferido no
banco, com os nomes certos. O que sumia era o **nome**: `usuario_ler` é
`pode_ler() AND (id = usuario_atual() OR eh_gestor())`, então o vendedor B não
lê a linha de `usuario` do vendedor A e o `LEFT JOIN` devolvia nulo. Consertado
com `usuario_publico` (`0020`), a view que a fundação registrava como parada
*"até ter consumidor"* — o consumidor apareceu como defeito de tela.

### Reconferido à mão depois dos consertos

| Achado | Confirmado na tela |
|---|---|
| 1 — aviso dos 30 dias | sim: o aviso muda com o tipo escolhido |
| 2 — devolver exigindo combinado | sim: "Registrar e devolver" não exige mais |
| 3 — erro depois do sucesso | **por consequência, não por observação direta**: o passo 2 só é observável clicando "Registrar e devolver", e não houve relato de erro. Coberto por teste. |
| 4 — autor `sistema` | sim: aparece `Alexandre Teste` |

**O que os três primeiros ensinam sobre os testes que existiam.** Todos os
quatro passaram por `typecheck`, `lint`, 418 unitários e 300 de integração. Os
testes de render exercitam **um estado por vez** e o padrão do projeto é
`renderToStaticMarkup` sem DOM: sem clique, o `useState` do tipo nunca muda,
então o aviso só era renderizado no tipo inicial — e o tipo inicial devolve. O
conserto trouxe `tipoInicial` como prop, que é o que permite ao render alcançar
os outros ramos sem jsdom.

O quarto não é limite de render: **é limite de cenário**. O teste de integração
lia o histórico como o **autor**, e a própria linha de `usuario` sempre é
visível. Precisava de um segundo vendedor lendo o histórico do primeiro — que é
exatamente o cenário que a fatia existe para servir, e o que o teste novo faz.

## Fatia contato: fragilidades herdadas

- **O vendedor devolve uma empresa, lembra que anotou algo importante nela, e
  não consegue mais ver.** A política segue a empresa, não o autor. Não foi
  consertado porque a cláusula `OR criado_por = usuario_atual()` não teria tela
  que a consumisse — não existe "meus contatos" — e política com cláusula sem
  consumidor é a R-014 na forma que a catraca não pega. Volta com a tela no dia
  em que doer. **É a fragilidade desta fatia com mais chance de virar
  reclamação**, e está escrita pelo sintoma de propósito: quem receber a
  reclamação procura por ela, não pela política.
- **`retornar_depois` grava data que ninguém honra.** "Me liga em março" é
  gravado, mas a empresa volta à fila com os mesmos 30 dias de todo mundo. A tela
  avisa com todas as letras; o dado serve ao histórico de quem puxar depois e ao
  gatilho E. **Se a tela parar de avisar, vira promessa falsa.**
- **O próximo passo é anulável em dois lugares pelo mesmo motivo.** Na
  prospecção, porque não há o que combinar; no acompanhamento, porque o vendedor
  pode não combinar nada — e é essa segunda que faz "o último contato manda"
  funcionar. **É uma frouxidão só, vista duas vezes**, e o conserto, se um dia
  virar problema, é um só: a tela cobrar por tipo. Registrada uma vez de
  propósito — duas fragilidades separadas convidam a dois consertos, e o segundo
  é sempre o que fica pela metade.
- **`nota` é texto livre e é lida por quem puxar a empresa depois.** Não há
  máscara, de propósito: o motivo da máscara do `crm-ch` (`GRANT` por coluna) não
  existe aqui. O que se escreve ali chega a colegas.
- **A cadeia de políticas agora tem três elos:** `contato_leitura` →
  `empresa_leitura` → `empresa_fila_leitura`. Estreitar a última estreita as três
  **em silêncio**. Nenhuma invariante lê conteúdo de política e não vai ler —
  comparar texto de expressão quebra na primeira reformatação do Postgres. A rede
  é o par de testes em `contato-politicas.test.ts`: um pega o estreitamento, o
  outro nomeia de qual tabela ele veio.
- **`features/fila` lê a tabela `contato`.** Acoplamento por tabela, não por
  importação de módulo: legal pela regra do `CLAUDE.md`, e ainda assim um lugar
  onde mexer numa feature quebra a outra **sem o `tsc` avisar**.
- **A tabela é imutável por ausência de função, não por gatilho.** `REVOKE` que
  se perca numa migração futura abre escrita sem nada acusar além do teste de
  integração dos três verbos.
- **Contato falso continua possível.** Nada prova que a ligação aconteceu; o que
  a fatia faz é remover o incentivo a mentir, dando `nao_liguei` a quem não
  ligou.
- **O SQL não se explica.** `checar.ts:44` recusa comentário fora da primeira
  linha da migração, então o motivo da ordem de travamento de
  `contato_registrar` mora em `docs/db/0018.md`. Quem mexer no SQL não encontra
  aviso ao lado do código.

## Fatia contato: o que os testes NÃO provam

- **Nenhum teste exercita as telas de verdade.** `Cartao`, `Ficha`,
  `ListaCarteira`, `FormularioContato` e `LinhaDoTempo` têm render por
  `renderToStaticMarkup`; ninguém clica, e `registrarContatoAcao` não tem teste
  próprio. O que cobre isso é a verificação manual.
- **O `FormularioContato` é testado com `useActionState` trocado por mock.** O
  que se prova é qual ramo renderiza para cada estado, não que o estado chegue.
  **E foi por aí que três defeitos passaram**: sem clique, o `useState` do tipo
  nunca muda, então o aviso de desfecho só era renderizado no tipo inicial. A
  prop `tipoInicial` existe para o render alcançar os outros ramos sem DOM, e é
  a única forma que este projeto tem de cobrir isso sem jsdom.
- **A regra de "exige próximo passo onde há posse" é provada como função pura**,
  em `regras.ts`. Que a action a chame é bilhete, não catraca: existe um teste
  que confere o `import`, e ele não pega validação duplicada dentro da action.
- **A corrida `devolver` × `fila_puxar` continua sem teste**, como na `fila.1`.
  Só `assumir` tem. A trava é a mesma linha, e o argumento é o mesmo — mas isso é
  raciocínio, não medição.
- **Nada roda contra Postgres 18.6**, que é a versão da Railway. Os testes rodam
  em 17.
- **Nenhuma invariante confere o conteúdo de `usuario_publico`.** A view contorna
  a RLS de `usuario` por desenho, e acrescentar `email` a ela é uma linha de SQL
  numa migração futura. O obstáculo é um teste de coluna inexistente, que
  falharia por um motivo que parece burocrático para quem não leu
  `docs/db/0020.md`.
- **Uma falha unitária vista uma vez e não explicada.** Numa rodada da fatia, o
  unitário deu 1 falha em 415 e a saída foi truncada antes de alguém ler qual.
  Cinco rodadas depois, incluindo `build` seguido de `test:unit`, deram 415
  verdes. Não reproduziu e não se sabe o que era. Para a próxima ocorrência ser
  **comparável** em vez de outro mistério do mesmo tamanho, o inventário dos
  testes está em `tests/inventario-unitario.txt`, regenerável por
  `npm run test:inventario` — `git diff` sobre ele responde que teste sumiu,
  apareceu ou mudou de nome.

## Ferramental


- Sem jsdom e sem testing-library, por escolha medida (ver "Fatia empresas: o
  estado inicial"). Render é testado por `renderToStaticMarkup` de
  `react-dom/server`, que exercita o primeiro render sem DOM e sem dependência
  nova. O limite está escrito no próprio arquivo de teste: não clica, não envia
  formulário, não exercita a action.
- `jsdom` e plugin continuam instalados e não configurados. Se um teste precisar
  de clique ou de efeito, é aí que eles entram — não antes.
- Next 16 usa `proxy.ts`, não `middleware.ts`. Portar o guarda do crm-ch,
  não copiar.
