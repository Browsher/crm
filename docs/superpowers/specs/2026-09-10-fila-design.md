# Fatia `fila.1`: o ciclo do vendedor

A mecânica de fila: posse, reserva e descanso, em tabela separada de `empresa`.
Entrega uma migração, uma tabela, três funções definidoras, a troca de uma
política existente e duas telas de vendedor.

Bloqueio e desbloqueio **não** entram aqui — são a `fila.2`, e nascem juntos.

## Por que tabela separada, e o que isso já economizou

A decisão está registrada na spec da `cep` e repetida na `0014`; o resumo é que
o motivo **não é rotação de escrita, é privilégio**. No `crm-ch`, cadastro e
posse na mesma tabela forçaram `GRANT` por coluna: a `0017` revogou `SELECT`
para mascarar contato, a `0021` concedeu `UPDATE` em quatro colunas, e a `0025`
existe só para reabrir a porta que a mesma tabela fechou — com o gestor sem
conseguir escrever cadastro nenhum no meio do caminho.

Com duas tabelas, esta fatia **não concede um único privilégio de escrita em
`empresa`** e não concede `UPDATE` em `empresa_fila` tampouco: toda escrita
passa por três funções definidoras, e `app_usuario` recebe só `SELECT`. Nenhum
`GRANT` de coluna aparece, então a catraca que a spec da `cep` exigiria junto
com ele não precisa nascer.

## O que esta fatia entrega

| Objeto | O que é |
|---|---|
| `0016_empresa_fila.sql` | tabela, políticas, troca de `empresa_leitura`, três funções |
| `empresa_fila` | uma linha por empresa que já entrou na fila |
| `fila_puxar()` | entrega a próxima, reservada por 30 minutos |
| `empresa_assumir(uuid)` | reserva vira posse, sem prazo |
| `empresa_devolver(uuid)` | volta à base com descanso mínimo |
| `/fila` | puxar, ver o contato, assumir ou devolver |
| `/carteira` | as empresas que estão com você |

## O que ela não entrega, e onde cada coisa foi parar

- **Bloqueio e desbloqueio:** `fila.2`. O par é indivisível — bloqueio é a única
  operação irreversível do desenho e quem o executa é o vendedor; entregar o
  gatilho sem o desfazer faz erro de clique custar `psql`.
- **Tirar posse e reatribuir (gestor):** depois. Nada nelas é irreversível.
- **Histórico de tentativa:** não existe. É o custo central desta fatia, medido
  no gatilho 1.
- **Teto de carteira:** não existe. Posse é ilimitada.
- **Consulta por CNPJ ("está com alguém?"):** não existe.
- **Vocabulário de motivo:** não existe, e não deve nascer nesta fatia nem na
  `fila.2`. Ver a seção seguinte.

## O que não se copia do `crm-ch`

As duas funções de lá (`0026_puxar_proxima.sql`, `0027_devolver_empresa.sql`)
não rodam aqui, e não é questão de ajuste: elas dependem de duas tabelas que
este projeto não tem.

- `puxar_proxima_empresa` ordena por `max(tentativa_prospeccao.ocorreu_em)`.
- `devolver_empresa` decide entre quarentena e bloqueio lendo
  `motivo_perda.tipo`, tabela de referência do funil — e **levanta
  `check_violation` quando o motivo é `temporario`**, ou seja, uma função de
  fila recusando operação por causa de estado de negócio.

O que se herda é o **mecanismo**, e ele é o que há de melhor lá:

1. `FOR UPDATE ... SKIP LOCKED` na seleção. Sem isso, dois cliques simultâneos
   recebem a mesma empresa e dois vendedores ligam para o mesmo comprador no
   mesmo minuto — exatamente o que a reserva existe para evitar.
2. Uma reserva por vendedor, e **puxar libera a anterior**. Senão bastaria
   clicar várias vezes para prender meia base.
3. **Guardar qual era a anterior e excluí-la da busca.** Liberar antes de
   selecionar devolve a empresa ao conjunto elegível, e como ela costuma ser a
   primeira da ordem, a busca a escolheria de novo: "puxar outra" entregaria a
   mesma. `IS DISTINCT FROM`, não `<>`, porque a variável é nula quando não
   havia reserva e `e.id <> NULL` filtraria a base inteira.
4. `COALESCE` explícito em checagem de posse. Detalhado em `empresa_devolver`.

## A tabela

```sql
CREATE TABLE empresa_fila (
  empresa_id          uuid PRIMARY KEY REFERENCES empresa (id) ON DELETE RESTRICT,
  vendedor_id         uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_por       uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  reservado_ate       timestamptz,
  elegivel_em         timestamptz,
  primeira_reserva_em timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT empresa_fila_reserva_coerente
    CHECK ((reservado_por IS NULL) = (reservado_ate IS NULL)),
  CONSTRAINT empresa_fila_posse_ou_reserva
    CHECK (vendedor_id IS NULL OR reservado_por IS NULL)
);
```

Com o gatilho de auditoria de sempre (`definir_auditoria()`, `BEFORE INSERT OR
UPDATE`), no molde de `empresa`.

**Esparsa: a linha nasce na primeira reserva.** Empresa que nunca foi puxada não
tem linha. Elegibilidade e ordenação saem de `LEFT JOIN`, e o estado "livre e
intocada" é a ausência de linha — não um conjunto de nulos que alguém precise
manter em sincronia.

**PK que é FK**, pela exceção da regra 7 da fundação. Uma linha por empresa, sem
`id` próprio: não há duas filas para a mesma empresa, e um `id` gerado
convidaria a isso.

**`empresa_fila_posse_ou_reserva`.** Posse e reserva são estados mutuamente
exclusivos: quem já é dono não precisa de prazo. O `CHECK` transforma isso em
garantia do banco em vez de disciplina das três funções — e ele **pega de fato**
um caminho real, o do dono inativo descrito adiante.

### As três colunas de estado, e o que cada uma responde

| Coluna | Responde | Aparece no `ORDER BY`? |
|---|---|---|
| `primeira_reserva_em` | "já entrou na fila alguma vez?" | **não** |
| `elegivel_em` | "a partir de quando volta a ser elegível?" | **é a primeira chave** |
| `reservado_ate` | "até quando é dela?" | não |

Elas foram separadas depois de eu juntar duas numa e errar. A versão errada
usava `primeira_reserva_em IS NOT NULL` como balde de prioridade — "já reservada
vem depois". **Reserva não é trabalho:** empresa puxada e abandonada (vendedor
fechou o navegador, reserva expirou) não foi trabalhada por ninguém, e essa
ordenação a mandaria para o fim da fila.

Quem responde "alguém já trabalhou isto?" é `elegivel_em`, porque **só a
devolução explícita a grava**. Abandono não grava nada.

### `primeira_reserva_em` é a medição, não a prioridade

Ela existe por uma razão só: ser o numerador do gatilho do histórico
(`count(*) WHERE primeira_reserva_em IS NOT NULL` contra `count(*) FROM
empresa`). Sem ela o gatilho não seria medível e viraria proxy — "faz uns meses
que a base gira" — que é o que a R-016 manda evitar.

**Por que não a existência da linha, que seria de graça:** ela só é inequívoca
enquanto reserva for o único jeito de a linha nascer. A `fila.2` pode precisar
criar linha para bloquear uma empresa nunca puxada, e nesse dia a contagem
mudaria de significado em silêncio. Coluna que diz o que diz não depende de essa
suposição continuar verdadeira.

**Ela fica anulável embora nunca seja nula nesta fatia**, por isso mesmo: é a
`fila.2` que pode criar linha sem reserva. Um `NOT NULL` agora seria verdade de
hoje virando restrição de amanhã, e removê-lo custa migração.

### O declive que paramos: nenhuma coluna de último toque

`ultima_reserva_em` ou `ultimo_toque_em` **não entram, e a ausência é decisão.**
Uma coluna de *último* toque é uma tabela de tentativa com uma linha só — é
literalmente a chave de ordenação do `crm-ch` — e o próximo pedido ("por quem?",
"deu o quê?") a transforma em tabela. Uma coluna de *primeira* reserva não tem
esse declive: ninguém pede "quem fez a primeira reserva de 2024", e ela não
ordena nada.

### `elegivel_em`, e o sufixo `_em` com dois significados

O nome nasceu `quarentena_ate` e foi trocado antes de a coluna existir. Com
descanso virando piso e ordenação (seção seguinte), "até quando está de
quarentena" descreveria uma barreira que não existe mais.

O nome novo se paga em coisa concreta: **com `elegivel_em`, o `NULLS FIRST` se
lê sozinho.** Nulo é "elegível desde sempre", e elegível desde sempre vem antes
de elegível desde terça. A nunca reservada e a abandonada caem nesse nulo com o
significado certo, sem cláusula especial. Com `quarentena_ate`, `NULLS FIRST`
precisava de explicação.

**A quebra de convenção, e o aviso de não generalizar.** Neste projeto `_em` era
instante de coisa que **aconteceu** (`criado_em`, `atualizado_em`,
`bloqueada_em`) e `_ate` era **prazo** (`reservado_ate`). `elegivel_em` é um
instante **futuro** que não é nenhum dos dois, e não existe sufixo nosso para "a
partir de". A alternativa que respeitava a convenção era `descanso_ate`; ela
perde por nomear só o papel de filtro e deixar invisível o papel de chave de
ordenação, que é o que faz o desenho funcionar.

**Então o sufixo `_em` passou a ter dois significados neste projeto, e a próxima
coluna de instante futuro não copia este caso sem o mesmo argumento.** A regra
continua: `_em` é passado, `_ate` é prazo. `elegivel_em` é exceção nomeada, com
o porquê escrito aqui — não padrão novo. É a mesma disciplina que a spec da
`cep` impôs ao `USING (true)`. A diferença é que ali existe catraca de código e
aqui não existe catraca possível para nome de coluna; sobra este parágrafo, e
por isso ele é explícito em vez de subentendido.

## Elegibilidade e ordem

```sql
FROM empresa e
LEFT JOIN empresa_fila f ON f.empresa_id = e.id
LEFT JOIN usuario dono   ON dono.id = f.vendedor_id
WHERE (f.vendedor_id IS NULL OR dono.ativo = false)
  AND (f.reservado_ate IS NULL OR f.reservado_ate < now())
  AND (f.elegivel_em   IS NULL OR f.elegivel_em  <= now())
  AND e.id IS DISTINCT FROM v_anterior
ORDER BY f.elegivel_em ASC NULLS FIRST,
         e.criado_em   ASC,
         e.id          ASC
LIMIT 1
FOR UPDATE OF e SKIP LOCKED
```

**Três chaves, sem expressão de balde.** `NULLS FIRST` põe no mesmo grupo a
nunca reservada e a abandonada, e as duas competem por `criado_em`; depois vêm
as devolvidas, da mais antiga para a mais recente. `e.id` é desempate estável —
`criado_em` de uma importação em lote empata muito, e sem terceira chave a ordem
viraria sorteio.

**`e.criado_em`, não `f.criado_em`.** O que importa é há quanto tempo a empresa
espera na base, não quando a linha de fila nasceu.

### O piso de 30 dias, e por que 90 saiu

Um descanso de barreira define um teto de ligações por dia, e o teto é
`base ÷ dias`:

| Base | Descanso | Ligações/dia que a fila sustenta |
|---|---|---|
| 65 (hoje) | 90 dias | **0,7** |
| 2.246 | 90 dias | 25 |
| 65 | 30 dias | 2,2 |
| 2.246 | 30 dias | 75 |

Com 65 empresas, 90 dias sustenta menos de uma ligação por dia: não é "esvazia
rápido", é uma fila que nunca funcionou. E **nem com 2.246 o número fechava** —
cinco vendedores a dez ligações por dia consomem 50, o dobro do teto.

**Isso é o achado que explica por que o número enganou.** No `crm-ch`, 90 dias
parecia funcionar não por estar certo, e sim porque **a posse drenava o conjunto
elegível por um caminho que a quarentena não controlava**: a maioria das empresas
saía da fila virando carteira de alguém, não voltando à base. O parâmetro nunca
foi o que segurava a fila de pé; ele só não era o gargalo. Copiá-lo para uma
base de 65 sem a posse madura teria produzido uma fila vazia com 62 empresas
"descansando".

**Não existe calibrar descanso contra um tamanho de base que não se controla.** A
base cresce por importação, o consumo cresce por contratação, e número fixo fica
errado dos dois lados. O que se pode garantir é um piso.

Então: **o descanso deixou de ser barreira e virou ordenação, com piso de 30
dias.** O filtro é só o piso; o descanso real **emerge** do tamanho da base,
porque empresa devolvida só volta quando tudo mais fresco acabou. Com 2.246
empresas o descanso efetivo passa dos 90 dias sozinho; com 65 ele encurta em vez
de travar.

O ganho não é o número, é o **modo de errar**: com barreira, o erro é penhasco —
passou do teto, a fila zera e o vendedor fica sem o que fazer. Com piso, o erro
é gradual — a empresa volta antes do ideal, e volta na ordem certa. E o `90`
desaparece do desenho em vez de ser substituído por outro número vigiado.

**Repare que isso reforça a fragilidade da ordenação em vez de piorá-la.**
`elegivel_em ASC` significa "voltou há mais tempo primeiro" **porque** existe um
prazo só; com dois prazos diferentes a equivalência quebra em silêncio. Passou a
existir exatamente um, então a propriedade é garantida por construção — e é
justamente ela que a `fila.2` precisa não quebrar quando o bloqueio chegar.

**O risco de verdade: descanso deixou de ser promessa.** Com base pequena, quem
disse "não" pode ser chamado de novo em 30 dias, e o piso é a única coisa entre
isso e ligar toda semana. Os 30 dias são chute, e vão escritos como chute; o
gatilho 2 é como eles ficam revisáveis com dado em vez de reclamação.

### O dono inativo

`(f.vendedor_id IS NULL OR dono.ativo = false)`: empresa cujo dono está inativo
volta a ser elegível.

Sem essa linha, `usuario_situacao_definir` — que existe hoje e é a operação de
"essa pessoa saiu" — deixaria a carteira dela presa para sempre, e o gestor não
teria caminho nenhum na aplicação, só `psql`. É o mesmo argumento que trouxe o
desbloqueio para a `fila.2`, resolvido aqui por **uma linha no `WHERE` em vez de
uma tela**: sem função nova, sem `GRANT` novo, sem tela nova.

**O comportamento na suspensão temporária é decisão, não perda.** Desativar
também é usado como suspensão neste projeto — o gestor desativa e reativa. Quem
reativa **não recupera a carteira**: parte dela já foi puxada por outro. Está
certo (quem está inativo não está trabalhando carteira) e precisa estar escrito,
senão parece defeito.

**É o único caminho em que puxar limpa posse.** Ao entregar uma empresa de dono
inativo, `fila_puxar` zera `vendedor_id` — sem isso o `CHECK`
`empresa_fila_posse_ou_reserva` recusaria a linha, e é bom que recuse: o `CHECK`
é o que impede esse caminho de virar dois donos silenciosos.

### `FOR UPDATE OF e`, e por que a trava é em `empresa`

`FOR UPDATE` não pode ser aplicado ao lado anulável de um `LEFT JOIN`, então
`FOR UPDATE OF f` é recusado pelo Postgres. A trava vai em `empresa`, que é o
lado interno — **a escrita acontece em `empresa_fila` e a trava fica na outra
tabela.**

Funciona, e o motivo é preciso: toda puxada trava a linha de `empresa`, que
sempre existe (empresa não é apagada, a FK é `ON DELETE RESTRICT`). Duas puxadas
simultâneas disputam a mesma linha de `empresa` e `SKIP LOCKED` faz a segunda
pular para a próxima candidata. Se a trava fosse em `empresa_fila`, a empresa
nunca puxada não teria linha para travar e duas puxadas concorrentes poderiam
inserir a mesma — a corrida cairia no `PRIMARY KEY` como `23505` em vez de ser
evitada.

É consequência direta de separar as tabelas, é o tipo de coisa que se descobre
no primeiro teste de concorrência, e por isso está escrita antes.

## Políticas e privilégios

```sql
ALTER TABLE empresa_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_fila_leitura ON empresa_fila FOR SELECT
  USING (eh_gestor() OR vendedor_id = usuario_atual() OR reservado_por = usuario_atual());
GRANT SELECT ON empresa_fila TO app_usuario;
```

**`SELECT` e mais nada.** Sem `INSERT`, `UPDATE` ou `DELETE` para papel nenhum:
as três funções são definidoras e escrevem como donas. É o que mantém "um dono
de escrita por tabela" verdadeiro sem `GRANT` de coluna.

### A troca de `empresa_leitura`

A `0014` deixou `empresa_leitura` como `USING (eh_gestor())` e registrou que era
**provisório por desenho** — política escrita para um mundo sem posse. Esta
fatia cumpre a promessa:

```sql
DROP POLICY empresa_leitura ON empresa;
CREATE POLICY empresa_leitura ON empresa FOR SELECT USING (
  eh_gestor() OR EXISTS (
    SELECT 1 FROM empresa_fila f
     WHERE f.empresa_id = empresa.id
       AND (f.vendedor_id = usuario_atual()
            OR (f.reservado_por = usuario_atual() AND f.reservado_ate > now()))
  )
);
```

**O vendedor lê só o que está com ele.** É a única forma que não reabre o
problema em que o `crm-ch` se enforcou: não há coluna a mascarar, então não há
view mascaradora, `SELECT` revogado nem `GRANT` por coluna. A política é uma
frase, como a spec da `cep` prometeu que seria com duas tabelas.

**Reserva expirada deixa de dar leitura** (`reservado_ate > now()`), e é de
propósito: a empresa já voltou ao conjunto elegível, e continuar mostrando o
contato de quem outro vendedor pode estar ligando agora é o vazamento que a
posse existe para evitar.

**A sutileza da RLS aninhada, que é benigna aqui e não é óbvia.** A política de
`empresa` consulta `empresa_fila`, e a RLS de `empresa_fila` também se aplica
dentro dessa subconsulta, porque política é avaliada como quem consulta. As
linhas de que a subconsulta precisa são exatamente as que
`empresa_fila_leitura` já libera para a mesma pessoa — os dois filtros pedem
`usuario_atual()`. Coincidem por construção, não por sorte.

**E daí sai a fragilidade a registrar:** se algum dia `empresa_fila_leitura` for
estreitada, `empresa_leitura` estreita junto, **em silêncio**. Nenhuma
invariante lê conteúdo de política além de `USING (true)` literal. O teste de
integração que confere "vendedor lê a sua e não lê a alheia" é a única rede.

`empresa_insercao` não muda: importar continua sendo do gestor. `GRANT UPDATE`
em `empresa` continua não existindo.

Nenhuma política nova é `USING (true)`, então `POLITICAS_DE_LEITURA_IRRESTRITA`
não muda.

## As três funções

Todas `SECURITY DEFINER`, `SET search_path = ''`, `REVOKE EXECUTE ... FROM
PUBLIC` e `GRANT EXECUTE ... TO app_usuario` — e as três entram em
`FUNCOES_CONCEDIDAS_A_APP_USUARIO`, senão a invariante derruba o `db:aplicar`.

**Nome com entidade na frente**, como `credencial_definir` e
`usuario_situacao_definir`: `fila_puxar`, `empresa_assumir`, `empresa_devolver`.

**Por que definidoras, e não consulta na aplicação:** a elegibilidade lê
`usuario.ativo` de outra pessoa, e a fila precisa enxergar empresa que o
vendedor não pode ler. Dentro de definidora com dona superusuária a RLS não é
avaliada (`docs/db/0010.md`), então a função vê a base inteira e devolve **um
id**. É o mesmo desenho do `crm-ch` pelo mesmo motivo, menos o motivo que lá
vinha de `SELECT` revogado.

**`pode_escrever()` nas três.** Quem não trocou a senha provisória não puxa, não
assume e não devolve. Recusa é `42501`, o código que o repositório já traduz.

### `fila_puxar() RETURNS TABLE (empresa_id uuid, reservado_ate timestamptz)`

1. `pode_escrever()`, senão `42501`.
2. Libera a reserva própria, guardando qual era em `v_anterior`. **Não grava
   `elegivel_em`** — trocar de empresa não é trabalhar a anterior.
3. Seleciona pela consulta da seção anterior, excluindo `v_anterior`.
4. Nenhuma candidata: **devolve zero linhas.** Não `NULL`.
5. Grava a reserva:

```sql
INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
VALUES (v_empresa, v_eu, now() + interval '30 minutes', now())
ON CONFLICT (empresa_id) DO UPDATE
   SET reservado_por = excluded.reservado_por,
       reservado_ate = excluded.reservado_ate,
       vendedor_id   = NULL,
       primeira_reserva_em = coalesce(empresa_fila.primeira_reserva_em, excluded.primeira_reserva_em)
```

`coalesce` preserva a primeira: a coluna responde "quando pela primeira vez", e
sobrescrever a transformaria na coluna de último toque que decidimos não ter.
`vendedor_id = NULL` é só o caminho do dono inativo.

**Zero linhas em vez de `NULL`:** "fila vazia" deixa de ser um valor que alguém
pode comparar errado, e a tela distingue "não veio nada" de "veio algo" pela
contagem. O `crm-ch` devolvia `uuid` nulo e a tela tinha que sabê-lo.

**Devolver `reservado_ate` é o que apaga a duplicação de número.** Lá,
`REGRAS.reservaMinutos` em TypeScript e `interval '30 minutes'` na função eram
duas cópias do mesmo 30, com comentário de alerta na migração e um teste de
integração asserindo que concordavam. A duplicação existia porque a tela
precisava escrever "30 minutos". Devolvendo o **instante**, a tela não tem o que
recalcular: ela conta o tempo que falta a partir de um dado do banco. **Nenhuma
constante de prazo existe em TypeScript nesta fatia** — nem 30 minutos, nem 30
dias. Um teste que assere que duas cópias concordam é melhor que nada e pior que
não haver cópia.

### `empresa_assumir(p_empresa_id uuid) RETURNS text`

Vocabulário: `ok`, `reserva_expirada`, `ja_e_sua`, `nao_encontrada`. Reserva de
outra pessoa, ou nenhuma reserva, é `42501`. O TypeScript lança em valor fora do
vocabulário, porque isso é defeito nosso e não estado de negócio — padrão das
funções de escrita da 0c.1.

Limpa `reservado_por` e `reservado_ate`, grava `vendedor_id`. Posse não tem
prazo.

**A ordem das checagens é parte do contrato, não detalhe de implementação**, e
sem ela dois estados legítimos cairiam em `42501`:

1. Sem linha em `empresa_fila`, ou `empresa_id` inexistente → `nao_encontrada`.
2. `vendedor_id = eu` → `ja_e_sua`. **Antes** da checagem de reserva: quem já é
   dono tem `reservado_por` nulo pelo `CHECK`, então a checagem de reserva o
   trataria como "nenhuma reserva" e devolveria `42501` — sem permissão na
   própria empresa.
3. `reservado_por = eu` e `reservado_ate <= now()` → `reserva_expirada`.
4. `reservado_por` de outra pessoa, ou nulo → `42501`.
5. `reservado_por = eu` e reserva vigente → grava e devolve `ok`.

`nao_encontrada` significa "não há linha de fila para esta empresa", e isso
inclui empresa que existe mas nunca foi puxada. Para a tela é o mesmo caso: ela
mostra o que veio de `fila_puxar`, então uma empresa sem linha de fila só chega
aqui por id vindo de fora — defeito nosso ou URL montada à mão.

**`reserva_expirada` é estado de negócio, não permissão**, e por isso texto e
não `42501`: o vendedor tinha a reserva e o tempo passou enquanto ele falava. A
tela precisa dizer isso com essas palavras, senão "sem permissão" numa empresa
que ele acabou de ver na própria tela parece defeito.

### `empresa_devolver(p_empresa_id uuid) RETURNS text`

Vocabulário: `ok`, `nao_encontrada`. Empresa que não está com você é `42501`.

Limpa posse e reserva e grava `elegivel_em = now() + interval '30 days'`, **na
mesma operação**. Se fossem duas escritas, uma falha no meio devolveria a
empresa à fila sem descanso e ela reapareceria no mesmo dia.

**O `COALESCE` da checagem de posse não é decoração**, e a lição é do `crm-ch`:

```sql
IF NOT COALESCE(v_dono = v_eu OR v_resv = v_eu, false) THEN
```

Empresa sem reserva tem `v_resv` nulo, e `v_resv = v_eu` devolve `NULL`, não
`false`. A expressão inteira vira `false OR NULL` = `NULL`; `NOT NULL` = `NULL`;
e `IF NULL THEN` **não executa** — a checagem de posse seria pulada por completo
e qualquer vendedor devolveria a empresa de qualquer outro. Lógica de três
valores em checagem de segurança precisa sempre de default explícito. Tem teste
próprio.

**Sem `eh_gestor()` na checagem, ao contrário do `crm-ch`.** Gestor devolvendo
empresa alheia **é** tirar posse, e tirar posse foi adiado. Deixar o caminho
aberto na função entregaria a operação sem tela — superfície sem consumidor,
R-014 — e faria a `fila.2` herdar um privilégio que ninguém decidiu conceder.

**Gestor pode puxar, assumir e devolver as suas.** As funções checam
`pode_escrever()`, não papel. Não há razão para impedir o gestor de prospectar, e
inventar a proibição custaria uma checagem que nenhuma tela pediu.

## As duas telas

`/fila` — um botão "Puxar próxima". Vindo empresa: razão social, contato,
telefone, e o endereço resolvido por `resolverCeps` (`src/server/cep/`); a
contagem até `reservado_ate`; "Assumir" e "Devolver".

Vindo zero linhas, o estado vazio **diz por que**, e não a palavra quarentena:
"nenhuma empresa disponível agora — as demais estão com alguém ou foram
trabalhadas nos últimos 30 dias". Fila vazia com a base cheia é o estado que o
vendedor não entende sozinho.

`/carteira` — as empresas com `vendedor_id = eu`, mais a reserva vigente se
houver. Lê o vizinho que já faz isso (R-018): `app/empresas/linha.tsx` e
`paginacao.tsx` são o padrão a seguir.

**Fronteira.** `src/features/fila/` **não importa de `src/features/empresas/`**
(regra do `CLAUDE.md`). O que ela precisa de comum já está em `src/server/`:
`comoUsuario` e `resolverCeps`. A consulta de `empresa` desta fatia é própria —
uma empresa, contato inteiro — e diferente da listagem paginada do gestor.

**Endereço só por `resolverCeps`, nunca por `LEFT JOIN cep` novo.** A auditoria
já registra "duas formas de resolver endereço" como fragilidade herdada; uma
terceira não entra.

O repositório em `src/features/fila/repositorio.ts` traduz para `{ ok, motivo }`:
`42501` → `sem_permissao`, e o vocabulário de texto direto. `comoUsuario` não
traduz erro; quem traduz é o repositório da feature.

## Testes

TDD, vermelho primeiro em cada um.

**Unidade, sem banco:**

- Tradução do repositório: `42501` → `sem_permissao`; cada palavra do
  vocabulário; **valor fora do vocabulário lança.**
- A invariante com as três funções novas na lista: definidora concedida fora de
  `FUNCOES_CONCEDIDAS_A_APP_USUARIO` é acusada; as três, registradas, passam.
- Render de `/fila` e `/carteira` por `renderToStaticMarkup`, no molde de
  `app/empresas/`: estado vazio com o texto certo, contagem a partir de
  `reservado_ate`.

**Integração, com banco — o que sustenta o desenho:**

- A migração aplica e as invariantes passam.
- `app_conexao` fora de `comoUsuario` lendo `empresa_fila` → `42501`. Controle
  negativo no molde da 0b.
- `app_usuario`: `INSERT`, `UPDATE`, `DELETE` em `empresa_fila` → `42501` nos
  três.
- Vendedor lê a sua linha e **não lê** a de outro vendedor.
- **`empresa_leitura` nova:** vendedor lê a empresa reservada para ele; **não
  lê** a alheia; **deixa de ler** quando a reserva expira; gestor lê todas.
- Senha provisória pendente → `42501` nas três funções.
- **`SKIP LOCKED`:** duas transações concorrentes recebem empresas
  **diferentes**. Duas conexões de verdade, não simulação.
- **Puxar duas vezes**: libera a anterior e **não a re-entrega** na mesma
  chamada.
- **Ordem:** nunca reservada antes de devolvida; entre nunca reservadas, a de
  `criado_em` mais antigo; a **abandonada volta ao grupo dos nulos** e não para
  o fim.
- **Piso:** devolvida hoje não é elegível; devolvida há 31 dias é.
- **Dono inativo:** empresa com dono desativado volta a ser elegível, e puxar
  limpa `vendedor_id`.
- **`empresa_devolver` de empresa alheia → `42501`**, incluindo o caso do
  `COALESCE`: empresa **sem reserva nenhuma**, que é onde a lógica de três
  valores pularia a checagem.
- `empresa_assumir` com reserva expirada → `reserva_expirada`.
- Os dois `CHECK`: posse e reserva juntas é recusado; reserva sem prazo é
  recusada.

## Verificação manual

No container, com a base de CEP carregada e as 65 empresas importadas. Registrar
em `docs/db/divida-tecnica.md` no formato das fatias anteriores, com o que passou
e o que não passou.

1. Vendedor puxa; vem empresa com endereço resolvido e contagem correndo.
2. Puxa de novo; vem **outra**, e a primeira volta a aparecer depois.
3. Assume; sai de `/fila` e aparece em `/carteira`.
4. Devolve; sai da carteira e **não reaparece** ao puxar.
5. Gestor continua vendo as 65 em `/empresas`.
6. Vendedor B não vê a empresa que está com o vendedor A.
7. Espera a reserva expirar sem assumir; a empresa volta a ser puxável e o
   vendedor A deixa de ler o contato.
8. Gestor desativa o vendedor A; a carteira dele volta a ser puxável.
9. Usuário com senha provisória pendente tenta puxar; recusa com mensagem.
10. Base pequena: puxar até esvaziar e conferir o estado vazio **com o texto
    certo** — é o passo que o desenho todo existe para não errar.

## Gatilhos registrados

Todos no formato da R-016: tipo, lado do erro e o número quando há.

| # | O que dispara | Tipo | Erra para | Hoje |
|---|---|---|---|---|
| 1 | empresas já reservadas alguma vez encostando no total da base → **histórico de tentativa** | medição | tarde | **0 de 65** |
| 2 | menor descanso que a fila está entregando encostando no piso → **revisar os 30 dias** | medição | **cedo** | sem dado |
| 3 | vendedor perguntar "está com alguém?" ao gestor mais de 1×/semana → **consulta por CNPJ** | proxy de dor | tarde | 0 |
| 4 | algum vendedor passar de 200 na carteira, **ou** gestor reclamar que a base não gira → **teto de carteira** | medição (chute) + proxy | tarde | 0 |
| 5 | a base crescer → **promover a `fila.2`** | medição | tarde | 3/mês |

### 1. Histórico: o custo central desta fatia

Empresa que cumpriu o descanso volta à fila **indistinguível de uma nunca
tocada**. Sem histórico, "já ligamos para esta?" não tem resposta na aplicação.

Numerador: `count(*) WHERE primeira_reserva_em IS NOT NULL`. Denominador:
`count(*) FROM empresa`. Hoje 0 de 65. Dispara quando o primeiro se aproximar do
segundo, ou seja, quando a fila der a primeira volta completa. **Não é tempo
passando: é a base girando.**

Erra para tarde: quando disparar, as primeiras voltas indistinguíveis já
aconteceram. O custo de errar para tarde é uma fatia de histórico feita depois,
não dado perdido — nada do que existe hoje é apagado por ela.

### 2. O piso de 30 dias: a única medição que erra para cedo

A medição óbvia — "quantas empresas voltaram dentro do piso" — **é impossível
por construção**: o piso é filtro, então a resposta é sempre zero. A pergunta
certa é o inverso, **quanto descanso a fila está de fato entregando**, e ela é
legível do estado atual sem coluna nova, porque a data de devolução está
codificada no piso:

```
dias desde a devolução = now() - (elegivel_em - interval '30 days')
```

A consulta do gestor: entre as empresas hoje elegíveis e já devolvidas, **a
menor** dessa conta — "a mais fresca que a fila está a ponto de entregar
descansou X dias". Com base folgada, X fica bem acima de 30 e ninguém olha.
Quando X encostar no piso, a base é pequena demais para o consumo, e isso
aparece **antes** de alguém reclamar.

É a primeira medição desta página que erra para **cedo**; as outras todas erram
para tarde. E é snapshot, não histórico: diz o que a fila faria hoje, não o que
ela fez. O que ela fez continua indisponível — cada devolução sobrescreve a
anterior.

### 4. Teto de carteira: por que adiar é seguro

Posse é ilimitada nesta fatia. No `crm-ch` o limite de reserva era estrutural
(uma por vez) e posse não tinha limite nenhum.

**O mecanismo caro não é `CHECK`.** Um `CHECK` no Postgres não consegue
expressar "no máximo 200 por vendedor": é por linha e subconsulta é proibida. A
versão cara é **gatilho** contando as linhas do vendedor, ou coluna contadora
denormalizada com o problema de consistência que ela traz. A versão barata é uma
conferência dentro de `empresa_assumir`, e ela cabe a qualquer momento.

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

## Fragilidades herdadas por quem vier depois

- **Abandono é gratuito e invisível.** Fechar o navegador não grava nada.
  Empresa com telefone ruim pode ser puxada, abandonada e reoferecida
  indefinidamente, para um vendedor depois do outro, sem sair do topo. Não há
  como distinguir "abandonou" de "ligou e não devolveu" sem histórico — é o
  mesmo gatilho 1.
- **A assimetria devolver × abandonar.** Devolver custa 30 dias de descanso;
  abandonar custa zero. Um vendedor que quisesse a empresa de volta logo
  bastaria abandoná-la. Não há ganho pessoal nisso (ele não a recebe de volta
  com preferência), então fica registrado e não corrigido.
- **A reserva não se renova.** Ligação de 35 minutos perde a reserva, e outro
  vendedor pode puxar a empresa. O caminho é assumir antes de a conversa
  esticar. Se doer, o conserto é renovar na tela, não aumentar o prazo.
- **A tabela guarda estado atual.** Toda escrita sobrescreve o dono anterior sem
  rastro — inclusive `empresa_devolver`, que já está nesta fatia. "Quem
  trabalhou essa empresa antes?" é a fatia do histórico.
- **`empresa_leitura` depende de `empresa_fila_leitura`.** Estreitar a segunda
  estreita a primeira em silêncio; nenhuma invariante lê conteúdo de política.
- **`elegivel_em ASC` só é "voltou há mais tempo" enquanto houver um prazo só.**
  A `fila.2` não pode introduzir um segundo prazo sem revisitar a ordenação.
- **A trava é em `empresa` e a escrita em `empresa_fila`.** Quem mexer na
  consulta de elegibilidade precisa manter `FOR UPDATE OF e`.

## Documentação e regras a cumprir

- `docs/db/0016.md` com o porquê da migração.
- **`docs/db/0014.md` ganha ponteiro de encaminhamento (R-015):**
  `empresa_leitura` foi substituída pela `0016`. A `0014` prometeu a troca; o
  ponteiro é o que faz quem lê a `0014` primeiro descobrir isso.
- `docs/db/fundacao.md`: seção "Feito na fatia `fila.1`", e a limitação do `_em`
  com dois significados.
- `FUNCOES_CONCEDIDAS_A_APP_USUARIO` ganha as três funções.
- Branch e PR; a main é protegida.
