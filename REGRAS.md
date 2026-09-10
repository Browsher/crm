# Regras

Cada regra aqui nasceu de um tropeço real. Se não doeu, não entra.

Quando algo der errado, a pergunta é: **eu perceberia isso sozinho?**
Se sim, vira bilhete. Se não, vira catraca (hook ou CI).

---

## R-001 — Nada entra na main sem CI verde

O que aconteceu: eu commitava direto na main e só descobria o erro dias depois.
A regra: toda mudança passa por branch e PR. Merge só com CI verde.
Tipo: catraca
Onde: branch protection no GitHub + `.github/workflows/ci.yml`

---

## R-002 — Um gerenciador de pacotes só por projeto

O que aconteceu: o CI foi escrito para pnpm num projeto npm. Falhou em 13s
procurando um `pnpm-lock.yaml` que não existia.
A regra: o lockfile manda. `package-lock.json` = npm em tudo, inclusive no CI.
Tipo: bilhete

---

## R-003 — Peer dependency incompatível: sobe a versão, não força

O que aconteceu: `npm i -D vitest` quebrou porque o Vitest 5 exigia
`@types/node` 22+ e o projeto tinha 20.
A regra: subir o pacote antigo. Nunca `--force` nem `--legacy-peer-deps` —
eles escondem o conflito e quebram depois, num erro difícil de rastrear.
Tipo: bilhete

---

## R-004 — Não depender de tipo gerado pelo build no typecheck

O que aconteceu: `app/layout.tsx` usava `LayoutProps<"/">`, tipo que o Next
gera durante o build. No CI o build não roda, e o typecheck falhou.
A regra: tipar props na mão (`{ children: React.ReactNode }`) em vez de usar
tipo gerado, a não ser que o build rode antes no CI.
Tipo: catraca (o typecheck no CI já pega)

---

## R-005 — `Set-Content -Encoding utf8` no PowerShell gera BOM

O que aconteceu: o JSON de branch protection foi rejeitado pela API do GitHub
com "Problems parsing JSON" por causa do BOM no começo do arquivo.
A regra: para arquivo que vai para API ou parser, usar
`[System.IO.File]::WriteAllText()`.
Tipo: bilhete

---

## R-006 — PowerShell 5.1 engole o `--` em comandos com flags repassadas

O que aconteceu: `claude mcp add obsidian -- npx -y obsidian-mcp <path>`
falhou com "unknown option" porque o PowerShell descartou o `--` e passou
o `-y` para o próprio claude.
A regra: usar `--%` antes dos argumentos, ou rodar pelo Git Bash.
Tipo: bilhete

---

## R-007 — RESET ALL não restaura o papel no Postgres

O que aconteceu: o crm-ch usava RESET ALL no finally achando que devolvia o
papel. O parâmetro `role` é marcado com GUC_NO_RESET_ALL. Ficou seguro por
acidente porque SET LOCAL ROLE já volta sozinho no fim da transação.
A regra: RESET ROLE explícito, sempre, além do RESET ALL.
Tipo: catraca
Onde: teste de controle negativo em tests/integracao/identidade.test.ts

---

## R-008 — tsx trata .ts como CommonJS sem "type": "module"

O que aconteceu: os CLIs com await no topo do arquivo falharam.
A regra: script com top-level await usa extensão .mts.
Tipo: bilhete

---

## R-009 — senha dentro de URL não pode ter caractere de delimitação

O que aconteceu: senha gerada em Base64 tinha "/" e quebrou o parser de URL
do Node no CI, com "Invalid URL".
A regra: senha que vai em connection string é alfanumérica, ou
percent-encoded (@ = %40, / = %2F, # = %23, % = %25).
Tipo: bilhete


## R-010 — No PG 16+, NOINHERIT no papel não muda grant existente

O que aconteceu: a auditoria da fundação propôs `ALTER ROLE app_conexao NOINHERIT`
para app_conexao parar de herdar app_usuario. Verificado no container: o grant
continuou com `inherit_option = t` e a leitura sem SET ROLE seguiu funcionando.
Desde o PG 16 a herança mora no grant; o atributo do papel só define o padrão
de grants futuros.
A regra: herança se revoga no grant, com
`REVOKE INHERIT OPTION FOR <papel> FROM <membro>`. Conferir em
`pg_auth_members.inherit_option`, não em `pg_roles.rolinherit`.
Tipo: catraca
Onde: invariante em src/server/db/migracoes/invariantes.ts

---

## R-011 — Fim de linha muda a soma de migração; o .gitattributes vem antes da primeira migração

O que aconteceu: `db:pendentes` local acusou as seis migrações da fatia 0a como
alteradas na Railway. Diagnóstico inicial errado: "a normalização mudou a soma
na Railway". Conferindo soma a soma, a Railway e o índice do git estavam em
LF, iguais ao CI. Quem divergia era o disco local: `core.autocrlf=true` no
Windows fez o checkout em CRLF antes de o `.gitattributes` existir, e o runner
calcula a soma do byte em disco. Quase custou um `DROP SCHEMA` desnecessário.
A regra: (a) `.gitattributes` com `eol=lf` explícito para `db/migracoes/*.sql`
existe antes da primeira migração, nunca depois; (b) antes de concluir que a
soma mudou "no banco", comparar a soma gravada com o sha256 do índice
(`git show HEAD:arquivo`) e do disco, e ler `git ls-files --eol`; (c) disco em
CRLF se corrige apagando o arquivo e refazendo o checkout, não com migração
nova nem re-registro de soma.
Tipo: catraca
Onde: `.gitattributes` previne; `db:checar` recusa `\r` em migração
(src/server/db/migracoes/checar.ts), e o CI roda o checador.

---

## R-012 — Excluir membros de união por comparação negativa não estreita a união

O que aconteceu: `mensagemDeUsuario` excluía os três motivos de `Falha`
(`sem_permissao`, `nao_encontrado`, `email_em_uso`) com `if` seguidos e depois
usava `r.faltas`, do outro membro da união. O teste passou; o `tsc` recusou
com "Property 'faltas' does not exist on type 'Falha'". O discriminante de
`Falha` já é uma união de literais num campo só, então excluir os literais
estreita o campo para `never` e **mantém o membro** na união. Mesma família,
logo depois: `'senhaProvisoria' in r` sobre união onde um membro não tem o
campo devolve `unknown`, não remove o membro.
A regra: comparação positiva do membro que tem o campo, ou `Record` completo
sobre o tipo do discriminante. O `Record` é melhor onde couber: caso novo sem
entrada quebra o build, em vez de cair num `else` silencioso.
Tipo: catraca (o typecheck no CI já pega)

## R-013 — Branch protection sem `enforce_admins` não vale para admin

O que aconteceu: o PR da fatia 0c foi mergeado enquanto o assistente trabalhava,
e o repositório local passou para a `main`. O commit seguinte foi direto na main
e o push passou. A proteção existia e exigia o check `catraca`, mas estava com
`enforce_admins: false`, e o token era de admin do repositório. Em repositório de
uma pessoa só, que é sempre admin, a proteção é decorativa até isso ser ligado:
a R-001 estava registrada como catraca e na prática era bilhete.
A regra: `enforce_admins` ligado, senão não é catraca. Conferir com
`gh api repos/<dono>/<repo>/branches/main/protection --jq '.enforce_admins.enabled'`.
Segunda parte, do mesmo tropeço: conferir a branch atual **imediatamente antes**
de commitar, não no início da sessão. Merge e checkout acontecem por fora.
Tipo: catraca, ligada em 2026-09-09
Onde: branch protection da `main` (`enforce_admins: true`, `strict: true`,
check obrigatório `catraca`)


**Complemento de 2026-09-09, e ele corrige a segunda parte acima.** O mesmo
tropeço aconteceu de novo, idêntico: o PR da fatia `empresas` foi mergeado
enquanto o assistente trabalhava, o `checkout main` + `pull` veio de fora, e o
commit seguinte foi na `main`. A conferência que esta regra prescreve **estava
lá** — o plano mandava rodar `git branch --show-current` antes de cada commit,
e ela rodou. Imprimiu `main`. O commit passou assim mesmo, porque estava
encadeada com `&&`: a checagem informa, não barra.

Então a segunda parte desta regra vale como hábito de quem lê, e **não** como
mecanismo. Automatizada desse jeito ela vira **bilhete com aparência de
catraca**, que é pior que nada: ocupa o lugar da proteção real e dá confiança
que não corresponde a nada. Foi removida do plano da fatia `empresas`.

O que de fato barrou o estrago nas duas vezes foi o servidor. Aqui, o push nem
chegou a ser tentado; o commit foi movido para uma branch e a `main` local
voltou para `origin/main`.

## R-014 — Função exposta sem consumidor não fica

O que aconteceu: três vezes. `AUTH_SECRET` no `.env` sem ninguém lendo,
`usuario_publico` como view sem consumidor, e `sessoes_encerrar_de` com `GRANT`
para `app_usuario` depois que `usuario_situacao_definir` absorveu o único
chamador. Superfície concedida sem uso não é neutra: ninguém a testa, ninguém
lembra por que existe, e ela continua chamável.
A regra: se o consumidor sumiu, o `GRANT` sai junto. Se voltar a precisar,
volta com o consumidor na mesma mudança.

Metade catraca, metade bilhete, e a diferença importa:

| Situação | Quem pega |
|---|---|
| função de schema de aplicação executável por `PUBLIC` | catraca |
| definidora com `GRANT` para `app_usuario` fora da lista fechada | catraca |
| função **não** definidora com `GRANT` para `app_usuario` | bilhete, por decisão |
| função concedida que ninguém chama | **bilhete** |

A última linha é o buraco: desuso não é observável no catálogo, exigiria
cruzar o SQL com o TypeScript que chama. A catraca cobre exposição indevida,
não desuso. A terceira é escolha: função não definidora roda como quem chama,
sujeita a RLS e aos mesmos privilégios, então não escala nada.

Atenção ao padrão do Postgres: **função nova nasce com `EXECUTE` para
`PUBLIC`**. Sem `REVOKE` explícito na migração, ela é chamável por todo papel.
Foi assim que `definir_auditoria` ficou aberta da 0003 até a 0012.
Tipo: catraca para exposição, bilhete para desuso
Onde: `FUNCOES_CONCEDIDAS_A_APP_USUARIO` e a invariante de `PUBLIC` em
`src/server/db/migracoes/invariantes.ts`

---

## R-015 — Doc de migração alterada depois ganha ponteiro de encaminhamento

O que aconteceu: a 0012 mudou objetos criados pela 0003, 0009 e 0011. Migração
é imutável, mas o doc que a explica passa a descrever um comportamento que não
é mais o do banco. Quem ler `0009.md` daqui a três meses precisa saber que
existe um capítulo depois.
A regra: uma linha no topo do doc antigo, logo abaixo do título, dizendo o que
mudou e apontando o doc novo. O doc novo, por sua vez, lista os objetos que
tocou fora do próprio escopo, com o motivo de cada um.
Tipo: bilhete (nada confere que o ponteiro existe)

---

## R-016 — Gatilho nasce com o tipo e o lado do erro escritos

O que aconteceu: a faxina de `tentativa_login` foi registrada com o gatilho
"a primeira tela do gestor, **ou** 50 mil linhas". A primeira tela do gestor
entrou na 0c, o gatilho disparou e a fatia entrou na fila. Medindo a Railway
antes de desenhar: zero linhas nas duas tabelas, um usuário, o gestor semeado.
O banco de produção nunca tinha recebido um login. As duas condições não eram
do mesmo tipo — "50 mil linhas" contava a coisa; "primeira tela do gestor" era
palpite sobre quando a coisa apareceria. Revisando os outros gatilhos, o mesmo
erro estava escrito de novo em "a primeira entidade com volume real não pode
copiar este repositório", que dispararia na fatia seguinte, `empresas`, também
sem volume nenhum.

A regra: gatilho registrado diz **de que tipo é** e, se for proxy, **para que
lado erra**. Antes de agir sobre um gatilho que disparou, medir a coisa que ele
representa; se a medição desmentir, o gatilho estava errado, não o problema.

| Tipo | Erra para | O que custa | Precisa de vigilância? |
|---|---|---|---|
| evento observável no diff | — | nada | **não**: a condição aparece sozinha na revisão |
| medição: conta o que importa | — | nada | sim, mas só a conta: alguém tem que rodar o `count(*)` |
| proxy de uso | cedo | dispara sem problema, e gatilho que dispara sem problema treina a ignorar gatilho | sim, relendo |
| proxy de complexidade | nunca | fica mudo e a dívida cresce calada | sim, relendo |
| proxy de dor | tarde | a dor chega depois do estrago; é o padrão aceito da dívida técnica | sim, relendo |

Só a primeira linha se cobra sozinha. Medição é confiável mas muda: não avisa
quando cruza o número, e o proxy que erra para "nunca" também não avisa —
a diferença é que a medição responde quando perguntada, e o proxy nem isso.
As três de proxy precisam ser **relidas** de tempos em tempos, não esperadas.

Proxy de uso em produto sem uso medido não vale como gatilho: ele mede a
existência de uma tela, não a existência do problema. Trocar por contagem
("mil linhas na tabela", "10 mil em `tentativa_login`") ou amarrar à fatia que
resolve a causa junto.

Não dá para automatizar: o catálogo não sabe distinguir contagem de palpite.
O que dá é exigir as duas palavras no momento de escrever o gatilho, quando o
motivo ainda está fresco.
Tipo: bilhete
Onde: seção "Gatilhos" de `docs/db/divida-tecnica.md`, com a tabela de todos
os gatilhos vivos classificados

## R-017 — Medição diz o que exatamente foi medido

O que aconteceu: o spike da fatia `cep` registrou "`COPY` para o Postgres: 6,0 s"
numa tabela de medições. A carga real levou **72,6 s** na gravação, doze vezes
mais. O número não estava errado: os 6,0 s eram um `COPY` puro numa tabela
**vazia e sem índice**, e a gravação de verdade é `TRUNCATE` de 1,2 milhão de
linhas, `COPY` para uma temporária e `INSERT ... DISTINCT ON` numa tabela com
chave primária. A medição respondeu outra pergunta, com cara de resposta certa,
e ficou na spec por dias como se fosse o custo da gravação.

O contraste está no mesmo spike, e é o que fecha a regra. A outra linha dizia
"conversão zip → CSV (**Python**) — 77 s", com a linguagem escrita. Essa não
enganou ninguém: justamente por estar rotulada, a spec escreveu uma tabela de
decisão para quando o número de Node aparecesse. Ele apareceu — 359,1 s — a
tabela disparou e virou fatia de trabalho. **A linha rotulada produziu uma
decisão; a não rotulada produziu uma correção.**

A regra: número medido nasce com a frase do que foi medido ao lado. Não a
unidade, não a ferramenta apenas — a **condição**: em que estado estava o
sistema, com que dado, com que caminho. "6,0 s" é um número; "6,0 s de `COPY` em
tabela vazia sem índice" é uma medição.

O sinal de alarme é a tabela de medições enxuta, onde cada linha tem duas
colunas e parece uma ficha técnica. Ela é bonita e é o formato que mais engana,
porque some com a condição justamente onde ela cabia.

Tipo: bilhete
Onde: nenhuma catraca confere isso — o catálogo não sabe o que uma linha de
tabela quis dizer. O que dá é exigir a condição na hora de escrever o número,
quando ela ainda está na cabeça de quem mediu.

---

## R-018 — Arquivo novo em `app/` lê o vizinho que já faz aquilo

O que aconteceu: a fatia `empresas` escreveu `app/empresas/importar/` sem abrir
`app/usuarios/`, que já tinha uma action, um formulário com `useActionState` e
um estado de formulário. Deu nos dois problemas que o `usuarios` **já havia
resolvido**, com o motivo escrito no código:

- `'inseridas' in r` para estreitar uma união. Não estreita — o membro sem o
  campo ganha a propriedade como `unknown`. O comentário em
  `app/usuarios/acoes.ts:47-49` avisa isso em três linhas. Pego pelo
  `typecheck`, custou minutos.
- Constante de estado inicial exportada de um arquivo `'use server'`. O Next a
  transforma em referência de servidor e o cliente recebe função em vez de
  objeto. `app/usuarios/formulario-criar.tsx:5` sempre definiu o inicial dentro
  do componente cliente. **Não pego por nada** — passou por `typecheck`, `lint`,
  `build` e 383 testes, e apareceu como bug de tela.

Os dois desvios vieram do mesmo diretório, na mesma fatia, e o custo foi
crescente: o primeiro o compilador pegou, o segundo chegou à tela.

A regra: quando o plano criar em `app/` um arquivo que faz o que outro em `app/`
já faz — action, formulário com `useActionState`, estado de formulário, guarda
de papel — **ler o existente antes de escrever**, inteiro, inclusive os
comentários. Eles costumam ser o registro de um erro que já custou uma vez.

Vale para o plano também: plano que manda escrever componente novo em `app/`
cita o arquivo irmão que serve de molde.

Tipo: bilhete. Nenhuma catraca vê "escreveu sem olhar o vizinho" — o código
resultante compila, passa e parece normal. A catraca que nasceu deste caso
(`src/server/diretivas.test.ts`) pega **uma** das duas consequências, não o
hábito.

---

## R-019 — Afirmação sobre valor singular é medição, não ilustração

O que aconteceu: a spec da fatia `cep` escreveu *"nada impede `empresa.cep`
guardar `'99999999'`, um CEP que nunca existiu"*. `99999999` **existe** — é
Sarandi/PR, e é o **maior CEP da base**, o último dos 1.209.313. O valor foi
escolhido por parecer obviamente falso, sem consulta. De lá foi copiado para o
passo 10 da verificação manual da fatia `empresas`, que passou a esperar um "não
encontrado" impossível: numa rodada passou por acidente (a base estava vazia) e
na outra falhou pelo motivo oposto.

O contraste, medido na auditoria e no mesmo documento: **todo agregado daquela
spec conferiu exatamente** — 10.392 logradouros nulos, 0,86%; 7.200 bairros,
0,6%; 16,3% de `faixa`; 27 UFs; zero furos em `localidade`, `uf` e `ibge`.
Quem escreveu aqueles números rodou consulta. A mesma pessoa, na mesma spec, no
mesmo dia, inventou o valor singular.

**A assimetria tem causa, e é ela que a regra ataca:** ninguém escreve "0,86%"
por intuição — o formato do número já avisa que precisou de um `SELECT`.
"Um CEP que nunca existiu" parece um **exemplo**, não uma afirmação sobre o
dado. E exemplo é justamente o que vira valor de teste depois.

Mais duas do mesmo tipo na fatia `empresas`, achadas na mesma auditoria: "as
sete colunas dão cerca de 150 bytes por linha" (nunca medido; real 142 no pior
caso e 50 no comum) e "5.000 linhas ≈ 750 KB" (derivado do anterior; real 693
KB). O `bodySizeLimit` foi dimensionado sobre o primeiro.

A regra: afirmação sobre **valor singular** — este CEP, este CNPJ, este
tamanho, este arquivo — é medição, e nasce com a consulta ao lado. Vale mesmo
quando a frase parece ilustração, e principalmente aí: **agregado ninguém
escreve sem medir; singular todo mundo escreve por intuição.**

Casos que a regra cobre: um valor citado como impossível, inexistente, típico ou
extremo; um tamanho ou uma contagem sem unidade de medição declarada; um exemplo
que vai virar fixture.

Tipo: bilhete (nada confere que a consulta foi feita)

---

## R-020 — Caractere de controle se ilustra pelo nome, não pelo caractere

O que aconteceu: duas vezes, e as duas no parágrafo que **explicava o byte
NUL**. Na `empresas.1` dois NUL literais entraram na `divida-tecnica.md` e foram
pegos antes de virar commit. Na spec de `empresas` um entrou e ficou, entre
crases, ilustrando o byte que o texto descreve.

O estrago não é de renderização — no Markdown renderizado ninguém percebe. É que
o `grep` passa a tratar o arquivo inteiro como binário e responde
`Binary file matches` em vez das linhas. Custou uma busca falhada na própria
spec, procurando `pode_ler` para conferir uma política: a resposta parecia
"não sei ler isso" quando a resposta certa era "não existe".

A ferramenta desiste do documento **inteiro** por causa de um byte, e desiste
justamente no documento que mais vai ser consultado — a spec da fatia recém
escrita.

A regra: para ilustrar um caractere de controle, escreva o **nome do ponto de
código** (`U+0000`, `U+001B`), não o caractere. Vale para prosa: doc, spec,
regra, comentário de commit. Em código o escape (`\x00`) já é o normal, e
fixture de teste que precisa do byte de verdade precisa dele de verdade.

O sintoma a reconhecer: `grep` respondendo `Binary file matches` sobre um
arquivo que você sabe que é texto. Não é o grep quebrado; é um byte de controle
lá dentro.

Tipo: catraca
Onde: `src/docs.test.ts` varre `docs/**/*.md` e os `.md` da raiz, recusando todo
o bloco C0 fora de tab e LF, mais DEL. CR entra na recusa porque o
`.gitattributes` normaliza o working tree para LF (`* text=auto eol=lf`), então
um CR ali é um CR que alguém escreveu.

**LIMITE DECLARADO:** varre só prosa. `src/**` fica de fora de propósito —
`planilha.test.ts` precisa do byte NUL de verdade para provar que a fase 1 o
recusa, e uma catraca que proíbe isso proibiria o teste que importa.

---

<!-- próximas regras aqui -->