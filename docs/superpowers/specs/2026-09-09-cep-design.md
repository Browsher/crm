# Fatia `cep`: base local de CEP

Base de CEP carregada no próprio Postgres, resolvida por `SELECT` local. Nasce
para a fatia `empresas`, que importa planilha em que o endereço é só o CEP —
logradouro, bairro, cidade e estado vêm dele, nunca digitados e nunca deduzidos
do telefone.

Esta fatia não tem tela. Entrega duas tabelas, uma política, uma invariante
nova, o script de carga e um contrato de duas funções para `empresas` consumir.

## Por que ela existe antes de `empresas`

O desenho original resolvia CEP por API na hora da importação. Trocamos por base
local, e a troca **apaga uma categoria inteira de falha**: sem rede no caminho da
importação, não há serviço fora do ar, não há timeout, não há estado pendente,
não há re-tentativa. A resolução vira `JOIN`, dentro da mesma transação, com o
mesmo resultado toda vez.

Restam duas falhas, as duas determinísticas: CEP mal formado (pega na validação,
sem banco) e CEP que não existe na base (resposta legítima da consulta).

## Decisões, e o que cada uma fechou

**A fila não nasce com `empresa`.** Cadastro e mecânica de fila (posse, reserva,
quarentena, bloqueio) são fatias separadas. O motivo não é rotação de escrita — é
privilégio. No projeto anterior (`crm-ch`), uma tabela só com dois donos de
escrita forçou `GRANT` por coluna: a migração `0017` revogou `SELECT` para
mascarar contato, a `0021` concedeu `UPDATE` em quatro colunas, e o resultado foi
que **o gestor ficou sem conseguir escrever cadastro nenhum** — a `0025` existe só
para reabrir a porta que a mesma tabela fechou. Com duas tabelas, cada uma tem um
dono de escrita e a política vira uma frase.

**`GRANT` de coluna só entra acompanhado da invariante que o cataloga.** Ele não
aparece no `\d` e nenhuma invariante deste projeto o confere: some da revisão de
código *e* da inspeção manual. Se a fatia da fila precisar de um, ele nasce junto
com a catraca. Senão repetimos o `crm-ch` com uma catraca a menos.

**Endereço vem do CEP, nunca do DDD do telefone.** Medido no `crm-ch`: numa base
de 2.246 empresas, o DDD errou o estado em **845 delas, 38%**. O telefone é
habilitado onde o sócio mora, não onde a loja funciona. Está escrito aqui, e não
só na fatia da importação, porque é o tipo de atalho que alguém tenta "otimizar"
sem saber que já foi medido.

**A carga é operação, não funcionalidade.** Irmã de `db:aplicar`, não de
`/usuarios`. `app_usuario` recebe `SELECT` em `cep` e mais nada — dar escrita
seria conceder superfície que nenhuma tela usa, que é a R-014. Uma carga de
minutos também não cabe numa requisição HTTP.

**`empresa.cep` não tem FK para `cep`.** A FK garantiria que todo CEP guardado
existe na base. O preço seria transformar "sem endereço" em "sem empresa": uma
empresa cujo CEP não está no retrato de julho/2024 não poderia ser inserida.
Decidimos o contrário — a empresa entra mesmo sem endereço resolvido, porque
prospecção começa por telefone. Sem FK, a resolução é `LEFT JOIN` e o não
encontrado vira endereço nulo, que é o comportamento desenhado.

O que se perde, e é escolha: nada impede `empresa.cep` guardar `'00000000'`, um
CEP que nunca existiu.

**Correção de 2026-09-09:** esta frase dizia `'99999999'`, e estava errada.
`99999999` **existe** — é Sarandi/PR, e é o **maior CEP da base**, o último dos
1.209.313. O exemplo foi escolhido por parecer obviamente falso, sem consulta, e
de lá foi copiado para o passo 10 da verificação manual da fatia `empresas`, que
passou a esperar um "não encontrado" impossível de acontecer. `00000000` é
seguro por construção e não por sorte: o menor CEP existente é `01001000`, e CEP
todo zero não é atribuível — nenhuma base futura vai criá-lo. A defesa é o `CHECK` de oito dígitos mais a validação na
importação — **forma garantida pelo banco, existência não**. Tem que ser assim: a
base tem dois anos e a empresa real existe mesmo assim.

## A fonte: OpenCEP

<https://github.com/SeuAliado/OpenCEP>, release `2.0.1`.

### Licença: MIT, com ressalva

O `LICENSE` do repositório é MIT, "Copyright (c) 2023 Seu Aliado". Permite uso
comercial, sublicenciamento e venda, sem royalty.

**A ressalva:** MIT é uma licença que o dono do repositório aplicou sobre dados
que ele não originou. A base deriva do DNE dos Correios, que é produto pago
deles, e ninguém pode licenciar mais direito do que tem. Na prática muitos
produtos brasileiros usam essas bases e não se conhece histórico de cobrança, mas
o risco não é zero.

**A saída está mapeada, e é isso que torna o risco aceitável:** trocar por base
paga com direito claro (ZipData, QuaLoCEP, ordem de R$ 200, uma vez) é
**substituir o conteúdo da tabela, não refatorar**. O contrato de
`src/server/cep/` não muda, `empresa` não é tocada, e o único trabalho é um
carregador novo para o formato da base comprada. A fronteira do módulo é o que
mantém o risco contido em vez de difuso.

### Defasagem: 26 meses, e o número tem que ser dito em voz alta

Release única, `2.0.1`, de **2024-07-08**. Último push no repositório: o mesmo
dia. O README afirma "Atualizamos frequentemente a base de dados junto com os
Correios!" — **é falso**, e é o tipo de afirmação que se aceita sem conferir.

A base não vai envelhecer: **já nasce com dois anos.** Todo CEP criado desde
julho de 2024 cai em não encontrado. Aceito para este produto: prospecção por
telefone numa distribuidora atacadista não depende de CEP novo, e loteamento de
2025 não é onde estão as empresas que compram.

**Gatilho de medição** (R-016, e é medição, não proxy — conta a coisa com que nos
importamos): quando mais de X% das empresas importadas cair em não encontrado,
comprar base com data. O X se define na fatia `empresas`, quando houver primeira
importação real para medir contra.

A alternativa livre mais ativa, `ricardoapaes/opencep`, não publica dump e **não
tem licença nenhuma** — pior que MIT duvidoso.

## Medições do spike (2026-09-09)

Contra o container local (Postgres 17) e o arquivo real.

| O que | Valor |
|---|---|
| Formato | 1.209.314 arquivos JSON, um por CEP, num zip só |
| Campos | `cep`, `logradouro`, `complemento`, `bairro`, `localidade`, `uf`, `ibge` — UTF-8 |
| Zip | 326,4 MB, `sha256 cffa33783b7cb2bec060acd499eb8356698918efdc79238708aac46fcce9e62d` |
| Descompactado, lógico | 212,2 MB |
| Descompactado, alocado em NTFS | **≈ 4,6 GB** (1,2M arquivos × cluster de 4 KB, média real de 184 bytes) |
| Conversão zip → CSV (Python) | 77 s, 88 MB, 1.209.313 CEPs únicos (1 duplicata, 0 descartes) |
| `COPY` para o Postgres | 6,0 s |
| Tamanho no Postgres | 156 MB = 119 MB tabela + 36 MB índice da PK |
| Consulta por PK | 0,25 ms |
| Carga ponta a ponta | ≈ 83 s |

**Nunca extrair o zip.** 212 MB de conteúdo ocupariam ~4,6 GB em disco, porque
cada CEP de 184 bytes consome um cluster inteiro. O carregador lê de dentro do
zip — foi assim que o spike mediu.

**Corrigido pela carga real de 2026-09-09:** duas linhas desta tabela mediam
outra coisa. A conversão em Node levou 359,1 s, não os 77 s do Python, e a
gravação levou 72,6 s, não 6,0 s — os 6,0 s eram um `COPY` puro numa tabela
vazia, sem `TRUNCATE` de 1,2 milhão de linhas nem índice para manter. Números
reais e a suspeita sobre a diferença em `docs/db/divida-tecnica.md`, seção
"Fatia cep: verificado à mão".

### Qualidade do dado, conferida linha a linha

Em 1.209.313 linhas: `localidade`, `uf` e `ibge` **não têm um único furo**, e
`ibge` tem sempre 7 caracteres. 27 UFs distintas, exatamente. `logradouro` falta
em 10.392 (0,86%) e `bairro` em 7.200 (0,6%) — são os CEPs únicos de cidade
pequena, onde o município inteiro tem um CEP só. `complemento` só existe em
16,3%.

É essa conferência que autoriza os `NOT NULL` da seção seguinte. Sem ela, seriam
palpite.

## O banco

Migração `0013_cep.sql`. Cria as duas tabelas e a política; nenhum dado.

### Tabela `cep`

```sql
CREATE TABLE cep (
  cep         text PRIMARY KEY CHECK (cep ~ '^[0-9]{8}$'),
  logradouro  text,
  faixa       text,
  bairro      text,
  localidade  text  NOT NULL CHECK (btrim(localidade) <> ''),
  uf          char(2) NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  ibge        text  NOT NULL CHECK (ibge ~ '^[0-9]{7}$')
);
```

**`text` como PK, não `char(8)`.** A regra 7 da fundação abre exceção para "PK
textual de tabela de referência". O spike mediu com `char(8)`; o tamanho é o
mesmo (nove bytes nos dois), mas `char(n)` é `bpchar`, que preenche com espaço e
compara com regras próprias — o dia que alguém comparar a coluna com um parâmetro
`text` de sete dígitos, o resultado surpreende.

**`complemento` do arquivo virou `faixa`.** No arquivo dos Correios esse campo
não é complemento de endereço: é o trecho da rua que aquele CEP cobre — `lado
ímpar`, `lado par`, `s/n`, `Comércio`. Mas `empresa` vai ter uma coluna
`complemento` que significa "sala 302". Duas colunas com o mesmo nome e
significados diferentes, sentadas lado a lado num `JOIN`, é erro esperando data,
e **seria erro silencioso**: os dois campos são texto e os dois pareceriam
plausíveis numa tela. O carregador traduz; a confusão morre aqui.

**Só as três colunas medidas como cheias são `NOT NULL`.** `logradouro`, `faixa`
e `bairro` são anuláveis porque a base tem furo real neles, e o furo tem
significado. O carregador converte string vazia em `NULL`: `''` e `NULL`
significando a mesma coisa em colunas diferentes é dívida que nasce barata e
cobra caro.

**Nenhum índice além da PK.** A única consulta desta fatia é `WHERE cep = $1`,
medida em 0,25 ms. Índice por `uf` ou `localidade` é a R-014 aplicada a índice —
36 MB e escrita mais lenta em troca de nada. Entra quando existir tela que busque
por eles.

### Políticas e privilégios

```sql
ALTER TABLE cep ENABLE ROW LEVEL SECURITY;
CREATE POLICY cep_leitura ON cep FOR SELECT USING (true);
GRANT SELECT ON cep TO app_usuario;
```

E mais nada: sem `INSERT`, `UPDATE` ou `DELETE` para papel nenhum da aplicação;
sem `FORCE` (a invariante já barra).

`cep` é **a primeira tabela do projeto com leitura irrestrita.** A política
`USING (true)` parece anular a RLS e não anula: a regra 8 exige RLS em toda
tabela nova, e RLS ligada *sem* política nega tudo. `USING (true)` é a declaração
explícita de que este dado é público para quem está autenticado — e "quem está
autenticado" não é frouxidão, é consequência de `app_usuario` só ser alcançável
por dentro de `comoUsuario`, que exige um `usuario_id`. Fora dali, `app_conexao`
não herda nada e a tabela dá `42501`, igual a `usuario`.

O que a leitura irrestrita não concede: `cep` não tem dado de pessoa. É a lista
de logradouros do Brasil. Não há o que mascarar, e inventar política por usuário
aqui seria cerimônia sem ameaça.

**A próxima tabela não copia este padrão sem o mesmo argumento** — dado público
de referência, sem coluna de pessoa. A catraca da seção seguinte existe para
cobrar isso.

### Tabela `cep_carga`

```sql
CREATE TABLE cep_carga (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte          text NOT NULL,
  versao         text NOT NULL,
  publicado_em   date NOT NULL,
  arquivo_sha256 char(64) NOT NULL CHECK (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  linhas         integer NOT NULL CHECK (linhas > 0),
  carregado_em   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cep_carga ENABLE ROW LEVEL SECURITY;
```

Primeira linha após a carga: `opencep` / `2.0.1` / `2024-07-08` /
`cffa3378…9e62d` / `1209313`.

Ela responde a pergunta que sem ela não tem resposta: **um CEP que não resolve
não existe, ou é mais novo que a base?** Sem a data do retrato gravada, as duas
hipóteses são indistinguíveis, e a segunda é a provável.

Append-only por convenção: cada carga acrescenta linha. Uma linha por ano, na
prática.

**Nenhum `GRANT`, nem de `SELECT`.** R-014 de propósito: hoje nenhuma tela lê a
data da base. O consumidor natural é o relatório de importação de `empresas`
("42 CEPs não encontrados; base de julho/2024"), e ele é da fatia seguinte. O
`GRANT` entra junto com esse relatório, na mesma mudança, ou não entra. Até lá
quem lê é o operador, por `psql`. RLS ligada sem política nenhuma não é descuido:
é a regra 8 cumprida com o resultado certo — nega tudo para todos.

## Invariante nova: leitura irrestrita catalogada

**O buraco que ela fecha.** As invariantes de RLS leem dois booleanos de
`pg_class` (`invariantes.ts:145-150`): `relrowsecurity` e `relforcerowsecurity`.
Nada lê o conteúdo de política em `public` — a única invariante que olha política
é `politicasEmAutenticacao`, e ela pergunta outra coisa (existe *qualquer*
política em `autenticacao`?).

Consequência: **"RLS ligada sem política" e "RLS ligada com `USING (true)`" são
idênticas para a catraca**, e são opostas em efeito — a primeira nega tudo, a
segunda libera tudo. A regra 8 garante que ninguém esqueceu de ligar RLS; não
garante nada sobre o que a política faz. Uma migração futura que acrescente
`USING (true)` numa tabela que deveria ser restrita passa no `db:aplicar` e no
CI, em silêncio.

**A catraca**, irmã de `FUNCOES_CONCEDIDAS_A_APP_USUARIO`:

```ts
// Políticas de leitura irrestrita. Dado público de referência, sem coluna de
// pessoa. Entrar aqui exige o argumento, não só a vontade.
export const POLITICAS_DE_LEITURA_IRRESTRITA = ['public.cep.cep_leitura'] as const
```

A invariante colhe de `pg_policies` toda política em schema de aplicação cuja
`qual` seja `true` e acusa qualquer uma fora da lista. Acrescentar exige passar
pela lista, que é onde a pergunta "por quê?" é feita.

**O limite, honesto:** pega só `true` literal. `USING (1=1)` ou `USING (id IS NOT
NULL)` escapariam. É catraca **contra descuido e cópia, não contra quem quer
burlar** — mesma classe de limite honesto que a busca por `prosrc` tem. Está
escrito para a lista não parecer mais forte do que é.

**Por que entra nesta fatia** e não depois: a catraca nasce com o primeiro caso
que ela existe para vigiar. Se ficar para depois, será escrita quando já houver
três políticas e ninguém lembrar qual das três tinha argumento.

## O script de carga

`npm run db:cep:carregar`, em `scripts/db/cep-carregar.mts`. Produção é `ALVO=railway
npm run db:cep:carregar`, no molde de `db:aplicar`: `urlDe('DATABASE_URL_ADMIN')`
e `sair`.

### O manifesto, versionado

`db/cep/opencep.json` entra no repositório; o zip de 326 MB não — mesmo padrão do
`railway-ca.pem`, que já vive fora do repositório com o fingerprint documentado.

```json
{
  "fonte": "opencep",
  "versao": "2.0.1",
  "publicado_em": "2024-07-08",
  "url": "https://github.com/SeuAliado/OpenCEP/releases/download/2.0.1/v1.zip",
  "sha256": "cffa33783b7cb2bec060acd499eb8356698918efdc79238708aac46fcce9e62d",
  "linhas_esperadas": 1209313
}
```

O manifesto transforma "baixei um arquivo da internet" em "carreguei o retrato
que está registrado".

**A linha de comando**, na forma que o teste exige (nada fixo no código):

```
npm run db:cep:carregar -- <caminho-do-zip> [caminho-do-manifesto]
```

O caminho do zip é obrigatório — ele vive fora do repositório e não há lugar
padrão em que ele esteja. O manifesto tem padrão `db/cep/opencep.json`, e o teste
passa o seu próprio.

**Onde o zip está, nesta máquina:** `C:\Users\ADM\projetos\.bases\opencep-2.0.1.zip`,
fora de qualquer repositório, ao lado da pasta dos projetos. Soma conferida
depois de movido, igual à do manifesto.

Isto é **referência, não convenção do projeto**: é o caminho da máquina de quem
escreveu esta spec. Outra máquina põe onde quiser e passa na linha de comando —
o script não presume nada sobre esse caminho, e nada no repositório o menciona
além desta linha.

### Os cinco passos; três são catraca

1. Lê o manifesto e **confere o sha256 do zip**. Diferente, para.
2. Percorre o zip em fluxo, sem extrair. Vazio vira `NULL`; `complemento` vira
   `faixa`; `cep` perde o hífen.
3. Numa transação só: `TRUNCATE cep` → `COPY cep FROM STDIN` → `INSERT INTO
   cep_carga`.
4. Antes do `COMMIT`, **confere `count(*)` contra `linhas_esperadas`**.
   Diferente, `ROLLBACK`.
5. `COMMIT`. Imprime host, versão e linhas.

O passo 3 numa transação só dispensa staging: `TRUNCATE` é transacional no
Postgres, então nunca existe instante em que a aplicação veja a tabela vazia — ou
o retrato novo entra inteiro, ou o antigo continua. O passo 4 dentro da mesma
transação impede que uma carga truncada por erro de leitura fique de pé.

### Dependências novas

`yauzl` (leitura de zip em fluxo) e `pg-copy-streams` (`COPY ... FROM STDIN` do
lado do Node), as duas como **`devDependencies`**: o script é operação, não
runtime, e nada disso deve ir para o build. Se uma só for preferível,
`pg-copy-streams` troca por `INSERT` em lote — custa tempo de carga, não
corretude. R-003 vale: peer dependency incompatível se resolve subindo a versão,
nunca com `--force`.

### Tempo de conversão: qual é o limite acima do qual a decisão muda

**Os 77 segundos medidos são de Python.** Não medimos Node com `yauzl`. Os 6
segundos do `COPY` valem, porque ali quem trabalha é o Postgres. Para a primeira
medição real não virar um número sem critério, o critério está escrito antes:

| Conversão em Node | O que muda |
|---|---|
| até ~3 min | nada. Um comando, uma vez por ano. |
| ~3 a ~10 min | o script passa a **imprimir progresso**. Sem isso o operador não distingue "trabalhando" de "travado", e a reação natural é `Ctrl+C` no meio — a transação faria `ROLLBACK`, então não corrompe, mas desperdiça a rodada. |
| acima de ~10 min | **separar em dois comandos**: `db:cep:preparar` gera o CSV na máquina de quem prepara, e `db:cep:carregar` só faz o `COPY` do CSV (os 6 s). Produção deixa de pagar a conversão. O custo é um artefato intermediário de 88 MB para transportar. |

## O contrato para `empresas`

A regra de fronteira do `CLAUDE.md` decide onde mora: `features/` não importa de
outra `features/`, e `empresas` vai consumir. Então **`src/server/cep/`**, ao
lado de `src/server/autenticacao/`. Não é feature — é serviço de banco, sem tela.

```ts
export type Endereco = {
  cep: string
  logradouro: string | null
  faixa: string | null
  bairro: string | null
  localidade: string
  uf: string
  ibge: string
}

// Pura. Sem banco, sem rede. '01001-000' e ' 01001000 ' → '01001000'.
// Qualquer outra coisa → null.
export function normalizarCep(bruto: string): string | null

// Dentro de comoUsuario. Uma consulta só, com = ANY($1).
export function resolverCeps(
  executar: Executar,
  ceps: string[],
): Promise<Map<string, Endereco>>
```

**Lote, não um de cada vez.** É a chamada que a importação precisa: 2.000
empresas têm algumas centenas de CEPs distintos, e `= ANY` resolve todas numa ida
ao banco. A versão singular convidaria a um laço com centenas de idas — que
funciona, mede bem em teste com dez linhas, e só aparece como problema com a
planilha real.

**`Map` parcial, e não `{ ok, motivo }`. Isto contradiz o padrão do projeto de
propósito, e a frase está aqui porque alguém vai querer "uniformizar" depois:
consulta de referência não decide negócio.** A `PREFERENCIAS.md` manda regra de
negócio devolver resultado explícito, e CEP não encontrado **não é falha da
operação** — a consulta funcionou e a resposta é "não existe na base de
julho/2024". Quem decide o que fazer com isso é a importação de `empresas`, que
sabe que a empresa entra mesmo assim. Devolver `{ ok: false }` empurraria uma
decisão de negócio para dentro de uma consulta de referência.

**`normalizarCep` é pura de propósito.** Ela é a fase 1 da importação — a
validação que roda sem banco e sem rede e devolve o relatório de erro de planilha
antes de qualquer escrita. Sendo pura, tem teste de unidade barato e a importação
não precisa de conexão para recusar `"CEP: consultar"` numa célula.

## Testes

TDD, vermelho primeiro em cada um.

**Unidade, sem banco:**

- `normalizarCep`: com máscara, com espaço, com letra, com 7 e com 9 dígitos,
  vazio.
- Transformação linha a linha: vírgula e aspas dentro de `logradouro` escapando
  certo no CSV, string vazia virando `NULL`, `complemento` chegando em `faixa`.
- **A invariante nova**, pela função `avaliar` pura: política `USING (true)` fora
  da lista é acusada; a de `cep`, registrada, passa.

**Integração, com banco:**

- A migração aplica e as invariantes passam.
- `app_conexao`, fora de `comoUsuario`, lendo `cep` → `42501`. Controle negativo
  no molde do que a 0b fez para `usuario`.
- `app_usuario` lê; `INSERT`, `UPDATE` e `DELETE` em `cep` → `42501` nos três.
- `cep_carga` inalcançável por `app_usuario` — RLS sem política e sem `GRANT`, as
  duas barreiras.
- `resolverCeps` com lista contendo existentes e inexistentes: mapa parcial, sem
  lançar.

**O teste do carregador não carrega 1,2 milhão de linhas.** Roda contra
`tests/fixtures/cep-mini.zip`, uma dúzia de CEPs escolhidos para cobrir os casos
reais medidos: um com `faixa` (`lado ímpar`), um sem `logradouro` (CEP único de
cidade), um sem `bairro`, um com vírgula no logradouro. O manifesto do teste tem
o sha256 e o `linhas_esperadas` desse zip, então os dois passos de catraca são
exercitados de verdade, inclusive no vermelho: sha256 errado para, contagem
errada faz `ROLLBACK`.

Isso exige o script receber caminho do zip e do manifesto por parâmetro, não
fixos. É a única concessão de desenho que o teste impõe, e é boa por si.

**`.gitattributes` ganha `*.zip -text` nesta fatia, antes de o fixture existir.**
Hoje o arquivo é `* text=auto eol=lf`, e o `text=auto` provavelmente detectaria o
binário e deixaria quieto. "Provavelmente o git faz a coisa certa" é exatamente o
que custou a tarde de diagnóstico errado da **R-011**, onde a suspeita caiu no
banco e o culpado era o checkout em CRLF. A linha explícita tira a dúvida antes,
não depois.

**A carga completa fica na verificação manual**, uma vez, contra o container,
registrada em `divida-tecnica.md` no formato das fatias 0b e 0c: 1.209.313
linhas, 156 MB, tempo real medido, e a conferência de que `resolverCeps` acha um
CEP conhecido.

**O CEP de teste é `01310100` — Avenida Paulista, São Paulo.** Não é capricho, e
a razão é a defasagem de 26 meses: testar com o próprio CEP é o reflexo natural,
e se ele for de um endereço recente vai cair em não encontrado e **parecer bug
numa carga que funcionou**. Um logradouro antigo e conhecido remove essa
ambiguidade da verificação. `01310100` foi resolvido no spike contra a base real,
então é sabido que está lá.

Vale para qualquer conferência manual desta tabela, não só a da carga: quando um
CEP não resolve, a primeira hipótese a descartar é a idade do endereço, não o
defeito do código.

## Pré-requisito de produção

**Conferir o espaço no painel da Railway antes de rodar a carga.** O banco tem
8 MB hoje; a carga acrescenta 156 MB. No plano Hobby (volume padrão 5 GB) isso é
3%; no Free/Trial (0,5 GB) é 31%. O plano não foi confirmado: o CLI da Railway
não expõe volume nesta versão, `railway status` exige `link` interativo, e o
token do CLI é recusado pela API pública. O caminho pelo banco (`COPY FROM
PROGRAM 'df -h'`) foi descartado — executar shell no host de produção é martelo
grande demais para uma pergunta cuja resposta não muda o desenho.

## O que `empresas` herda

- `empresa.cep text CHECK (~ '^[0-9]{8}$')`, **sem FK**. Resolução por `LEFT
  JOIN` ou por `resolverCeps`.
- `empresa.complemento` significa "sala 302" e não colide com `cep.faixa`.
- Endereço do CEP; número e complemento são da empresa e não vêm da base.
- Empresa entra mesmo com CEP não resolvido. O relatório de importação diz
  quantas, e é ele que traz o primeiro `GRANT` de `SELECT` em `cep_carga`.
- O X do gatilho de defasagem se define na primeira importação real.
