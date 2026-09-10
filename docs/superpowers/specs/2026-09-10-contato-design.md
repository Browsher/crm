# Fatia `contato`: o que aconteceu na ligação e o que ficou combinado

Uma tabela de eventos pendurada em `empresa`, uma função definidora que registra
o contato e move a fila na mesma transação, e três telas. Entrega o histórico
que a `fila.1` deixou registrado como o custo central dela.

## O que esta fatia entrega

| Objeto | O que é |
|---|---|
| `0017_contato.sql` | tabela, política, uma função, e a revogação de duas |
| `contato` | uma linha por ligação registrada, imutável |
| `contato_registrar(...)` | grava o contato e aplica o desfecho, numa transação |
| `/fila` | o cartão ganha histórico e formulário; os botões viram desfechos |
| `/carteira` | vira a agenda: ordenada por próximo passo, vencidos primeiro |
| `/carteira/[id]` | a ficha: cadastro, endereço, linha do tempo, formulário |

E duas coisas que não são objeto novo e contam como entrega:

- `empresa_assumir` e `empresa_devolver` **perdem o `GRANT`** e saem de
  `FUNCOES_CONCEDIDAS_A_APP_USUARIO`. Passam a ser chamadas só por dentro de
  `contato_registrar`.
- A catraca de `src/server/diretivas.test.ts` passa a varrer `src/**` além de
  `app/**`.

## O que ela não entrega

- **Segundo prazo de devolução.** "Não atendeu, tenta amanhã" continua custando
  30 dias, como tudo. Tem gatilho próprio, com a dependência escrita.
- **Ficha para o gestor.** Ele lê `contato` pela política e não tem tela. Ver
  "Decisões escritas".
- **Correção ou exclusão de contato.** A tabela é imutável.
- **Bloqueio e desbloqueio.** Continua sendo a `fila.2`.
- **Funil, proposta, valor, motivo de perda.** Nada disso nasce aqui.
- **Backdating.** Contato acontece no ato do registro.

## A decisão central: uma tabela, dois usos

No `crm-ch` isto eram duas tabelas. `tentativa_prospeccao` (0009) registrava a
ligação fria: `resultado` de lista fechada, `nota`, sem próximo passo.
`contato` (0011) registrava o acompanhamento de quem já estava no funil: `tipo`,
`nota`, `proximo_passo`, `proximo_passo_em`, `proposta_valor`. A separação era
por **fase do funil**, e foi `tentativa_prospeccao` que virou a chave de
ordenação da fila lá (`max(ocorreu_em)`).

Aqui não há funil. Há **posse** e **não-posse**, que é estado da fila, não do
relacionamento. Duas tabelas separadas por um eixo que não existe produziriam
duas respostas para "quando falaram com esta empresa pela última vez" — e duas
respostas para a mesma pergunta divergem, que é a lição que a `fila.1` já pagou
para aprender em outro lugar.

Então: **uma tabela, pendurada em `empresa`, com a linha do tempo contínua do
CNPJ.** Prospecção e acompanhamento são a mesma linha com `tipo` diferente.

O que os dois estados **não** compartilham é o que se registra:

| Estado | O que o contato registra | Próximo passo |
|---|---|---|
| reserva (prospecção) | o que aconteceu + o desfecho | não faz sentido |
| posse (carteira) | o que aconteceu + o que ficou combinado | é o ponto |

**O próximo passo pressupõe posse.** Empresa devolvida volta ao conjunto
elegível e qualquer um pode puxá-la; um compromisso gravado nela é promessa que
ninguém garante cumprir, e que apareceria na agenda de quem talvez já não tenha
a empresa. Isso não é limitação a contornar — é o que dá à tela uma regra que se
defende sozinha: **exige próximo passo onde há posse, não pede onde não há.**

## A tabela

```sql
CREATE TABLE contato (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresa (id) ON DELETE RESTRICT,
  tipo       text NOT NULL CHECK (btrim(tipo) <> ''),
  nota       text CHECK (btrim(nota) <> ''),
  proximo_passo      text CHECK (btrim(proximo_passo) <> ''),
  proximo_passo_data date,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  CONSTRAINT contato_proximo_passo_coerente
    CHECK ((proximo_passo IS NULL) = (proximo_passo_data IS NULL))
);
```

Com o gatilho de auditoria de sempre (`definir_auditoria()`, `BEFORE INSERT OR
UPDATE`), no molde de `empresa_fila`.

**`criado_por` é o autor, e não existe coluna separada de vendedor.** Quem
registra é quem estava com a empresa; a auditoria já responde isso. Uma segunda
coluna com a mesma pessoa seria duas verdades esperando divergir — o `crm-ch`
escreveu esse comentário na própria `tentativa_prospeccao` e estava certo.

**Sem `ocorreu_em`.** O `crm-ch` tinha `ocorreu_em` e `criado_em`, os dois com
`DEFAULT now()`, e a diferença entre eles só existiria com backdating, que esta
fatia não tem. Coluna cuja única razão de ser é uma funcionalidade inexistente é
a R-014 na forma de schema. A linha do tempo ordena por `criado_em`. Se
backdating chegar, `ocorreu_em` nasce com ele, na mesma fatia.

**`contato_proximo_passo_coerente`** é o mesmo desenho de
`empresa_fila_reserva_coerente`: passo e data são um par, e o banco garante o
par em vez de confiar na disciplina de quem escreve. Sem ele, "próximo passo sem
data" entraria pela função e sumiria da agenda em silêncio.

**`proximo_passo_data`, não `proximo_passo_em`.** A `fila.1` deixou escrito que
o sufixo `_em` já ganhou dois significados neste projeto (instante passado, e o
instante futuro de `elegivel_em`) e que **a próxima coluna não copia a exceção
sem o mesmo argumento**. Esta seria a terceira acepção — dia futuro — e não tem
argumento próprio. O nome é feio e não gasta a exceção.

**`date`, não `timestamptz`.** O `crm-ch` usava `timestamptz` gravando meio-dia
em São Paulo (`instanteDoDiaSP`) e comparando por `diaSP()`. Meio-dia é gambiarra
para guardar um **dia** dentro de um tipo de **instante**, e o próprio `crm-ch`
tinha o jeito certo ao lado, em `pedido.data date NOT NULL DEFAULT (now() AT TIME
ZONE 'America/Sao_Paulo')::date`. Com `date`, "vencido" é
`proximo_passo_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date`, e
**nenhuma função de fuso nasce em TypeScript**.

### Índice

```sql
CREATE INDEX contato_empresa_idx ON contato (empresa_id, criado_em DESC);
```

Um só. Serve a linha do tempo da ficha e a busca do contato mais recente por
empresa, que é a mesma ordem. Índice por `criado_por` não entra: a única
consulta que o pediria é medição de gatilho, rodada à mão pelo gestor, sobre uma
base de 65 empresas.

## O vocabulário do tipo

Lista fechada em TypeScript; no banco, só o piso de não-vazio.

| Tipo | Estado | O que significa |
|---|---|---|
| `nao_liguei` | reserva | olhei o cadastro e descartei sem ligar |
| `nao_atendeu` | reserva | liguei, não falei com ninguém |
| `retornar_depois` | reserva | falei, pediu para ligar em outro momento |
| `sem_interesse` | reserva | falei, não tem interesse |
| `interessado` | reserva | falei, tem interesse |
| `acompanhamento` | posse | falei, e ficou combinado o próximo passo |

**Todos descrevem resultado, nenhum descreve meio.** `conversa` foi considerado
e recusado por isso: numa lista em que os outros cinco dizem no que a ligação
deu, um item que diz apenas "falei" faz alguém escolher errado sem perceber. O
critério da lista tem que ser um só.

**Por que a lista não está no `CHECK`, sendo que `usuario.papel` está.** O
precedente existe (`0001_usuario.sql:7`) e não transfere: `papel` mora com lista
fechada no banco porque **o banco o lê** — `eh_gestor()` e metade das políticas
dependem daquele literal. `contato.tipo` **nenhuma função lê**; o desfecho é
parâmetro separado, de propósito, justamente para o banco não interpretar
vocabulário de negócio. Lista que só a tela lê e só a tela valida não ganha nada
no `CHECK` e perde: cada palavra nova viraria migração, e vocabulário de operação
muda mais que schema.

**O custo disso, e é real:** o banco aceita qualquer texto não-vazio em `tipo`.
A única defesa é teste. Ver a seção de testes — sem eles, isto é "sem validação"
com nome bonito.

**A tela propõe o desfecho por tipo; o vendedor confirma.** `interessado` propõe
assumir, os outros quatro de reserva propõem devolver, `acompanhamento` propõe
nenhum. É sugestão da tela, não regra do banco — e é a coerência dessa escolha
que mantém verdadeira a frase acima, de que nenhuma função lê `tipo`.

### `nao_liguei` conta como toque, não como conversa

Ele é o único item que registra a **ausência** de contato, e a medição do
gatilho 1 é exatamente a diferença entre "a empresa apareceu na tela de alguém" e
"alguém falou com ela". Se `nao_liguei` entrar no `count(*)` de contatos, as duas
voltam a ser a mesma coisa e o gatilho volta a ser cego para o abandono, que é o
problema que ele existe para medir.

Daí saem **três contagens diferentes**, e confundi-las é o erro que esta seção
existe para impedir:

| Contagem | O que conta | Responde |
|---|---|---|
| **rastro** | qualquer linha de `contato`, `nao_liguei` incluído | "a empresa deixou rastro?" |
| **conversa** | qualquer linha **menos** `nao_liguei` | "alguém falou com ela?" |
| **descarte** | só `nao_liguei` | "quantas foram descartadas sem ligar?" |

**A regra é por pergunta, não geral:** consulta que mede *conversa* exclui
`nao_liguei`; consulta que mede *rastro* não exclui, porque `nao_liguei` **é**
rastro — foi alguém decidindo. O motivo fica escrito na consulta, não só aqui.

Com ele, três estados onde havia dois:

| Estado | Como se lê no dado | O que significa |
|---|---|---|
| reservada, zero contatos | `primeira_reserva_em` sem linha em `contato` | abandonou, fechou o navegador |
| reservada, contato `nao_liguei` | linha com esse tipo | olhou e descartou de propósito |
| reservada, contato de conversa | qualquer outro tipo | ligou |

### `retornar_depois` grava um próximo passo que ninguém vai cumprir

**Decisão tomada ao escrever esta spec, e ela merece veto explícito se estiver
errada.**

"Me liga em março" é um próximo passo com data, e é o desfecho mais comum de uma
ligação fria que não termina em nada. Mas quem diz isso está na **reserva**, e o
desfecho dele é devolver — a empresa volta ao conjunto elegível com os mesmos 30
dias de todo mundo, e março não é honrado por ninguém.

A tela **deixa gravar o passo e a data mesmo assim**, e o motivo é duplo:

1. **É o histórico que a próxima pessoa precisa.** Quem puxar a empresa daqui a
   30 dias lê "pediu para ligar em março" e decide com isso — que é literalmente
   o valor que esta fatia existe para criar.
2. **É o dado que calibra o segundo prazo.** Sem ele, o dia em que os três
   prazos forem desenhados não terá com que escolher os números, e a `fila.1` já
   pagou uma vez por parâmetro escolhido sem dado (os 90 dias).

**O custo é uma promessa que o sistema não cumpre, e a tela precisa dizer isso
com todas as letras** — algo como "a empresa volta para a fila em 30 dias; a
data fica registrada no histórico". Sem essa frase, o vendedor acredita que
agendou alguma coisa. Se a decisão for proibir passo e data fora de posse, o
`CHECK` de coerência já está lá e a proibição é uma condição na função; o que se
perde é o item 2.

## Onde mora o próximo passo: derivado, sem cache

`proximo_passo` e `proximo_passo_data` vivem **só** em `contato`, gravados uma
vez e nunca alterados. "O que vale hoje" é derivado: **o contato mais recente
manda.**

O `crm-ch` tinha as duas colunas em `contato` **e** em `cliente`, e a spec de
fundação de lá escreveu a disciplina para mantê-las juntas: *"nunca é escrita
sozinha"*, *"o histórico é a verdade, e é dele que se reconstrói o cache se algum
dia divergir"*. É a última frase que denuncia o desenho: **um cache que já nasce
com procedimento de reconstrução documentado é um cache que se espera divergir.**

Aqui seria pior. A única tabela candidata a hospedar o cache é `empresa_fila`,
que a `0016` desenhou como **estado da fila** — posse, reserva, elegibilidade.
Pendurar nela "o que ficou combinado com o comprador" mistura mecânica de
distribuição com conteúdo de relacionamento, e a primeira pergunta seguinte é o
que acontece com o combinado quando a empresa é devolvida: a linha de fila é
reciclada, o combinado não é.

### O último contato manda, mesmo com passo nulo

Duas leituras existiam, e a diferença aparece quando o contato mais recente
**não** tem próximo passo:

- *o último contato manda, mesmo com passo nulo* → a empresa fica sem próximo
  passo;
- *o último contato **com** próximo passo manda* → o combinado de duas semanas
  atrás **ressuscita** e volta a aparecer na agenda.

Vale a primeira. A segunda faz um compromisso já superado reaparecer sozinho,
sem ninguém ter decidido isso, e o vendedor não teria como apagá-lo a não ser
combinando outra coisa. Com a primeira, **registrar contato sem próximo passo
significa exatamente "não há próximo passo"** — uma frase que o vendedor
consegue querer dizer.

É também o que faz a correção funcionar sem mecanismo de correção: errou a data,
registra outro contato.

### A consulta

```sql
LEFT JOIN LATERAL (
  SELECT c.proximo_passo, c.proximo_passo_data
    FROM contato c
   WHERE c.empresa_id = e.id
   ORDER BY c.criado_em DESC, c.id DESC
   LIMIT 1
) ultimo ON true
```

`c.id DESC` é desempate estável, pelo mesmo motivo que `e.id ASC` na ordenação
da fila: `criado_em` vem de `now()`, que é o instante de início da transação, e
ordem sem terceira chave vira sorteio quando há empate. Empate aqui é
improvável, e a alternativa a um desempate improvável não é "nenhum desempate",
é "ordem arbitrária que muda entre execuções".

### O gatilho de quando isto passa a doer

Medição, com o número declarado como chute:

> **Leitura derivada custando caro.** Dispara quando a carteira de uma pessoa
> passar de **80 empresas** — chute, e está aqui como chute. Remédio: view
> materializada ou coluna de cache — **com medição antes**, que é o que separa
> este cache do que a auditoria do `crm-ch` pegou. Hoje o gatilho está
> **estruturalmente mudo**: a maior carteira possível é 65, que é a base inteira,
> e 65 não chega a 80. É o gatilho D da tabela adiante.

## Políticas e privilégios

```sql
ALTER TABLE contato ENABLE ROW LEVEL SECURITY;
CREATE POLICY contato_leitura ON contato FOR SELECT USING (
  EXISTS (SELECT 1 FROM empresa e WHERE e.id = contato.empresa_id)
);
GRANT SELECT ON contato TO app_usuario;
```

**Uma frase, sem `eh_gestor()`, sem `usuario_atual()`, sem reserva, sem prazo.**
A RLS de `empresa` é avaliada dentro da subconsulta — o mesmo mecanismo que a
`0016` já documenta e do qual `empresa_leitura` já depende. A política lê
literalmente *"você lê o contato da empresa que você lê"*. Gestor entra pelo
`eh_gestor()` de `empresa_leitura`; reserva expirada sai sozinha pelo
`reservado_ate > now()` de lá. Nenhuma regra duplicada, e o dia em que a fila
mudar, esta política acompanha sem migração.

**Sem `INSERT`, `UPDATE` ou `DELETE` para papel nenhum.** A escrita é da função
definidora, e não existe função de alteração: a tabela é imutável por ausência,
não por gatilho.

**O contato acompanha a empresa, não o autor.** Vendedor B, ao puxar uma empresa,
lê o que o vendedor A escreveu — inclusive a `nota`, que é texto livre.

**Por que não copiamos a máscara do `crm-ch`.** Lá, `nota` era mascarada
(`tentativa_visivel`, 0018) porque o texto livre podia conter o telefone que
`empresa_visivel` acabara de esconder — e a máscara existia porque cadastro e
posse na mesma tabela forçaram `GRANT` por coluna. Este projeto matou isso com
duas tabelas: **quem lê a empresa já lê telefone e `contato_nome` inteiros**. Não
há o que vazar por texto livre que a linha ao lado não entregue de graça. Copiar
a defesa sem a ameaça custaria view mascaradora ou `GRANT` de coluna, que é
exatamente o que a `0016` não concedeu.

`POLITICAS_DE_LEITURA_IRRESTRITA` não muda: `contato_leitura` não é
`USING (true)`.

### A revogação de `empresa_assumir` e `empresa_devolver`

```sql
REVOKE EXECUTE ON FUNCTION empresa_assumir(uuid) FROM app_usuario;
REVOKE EXECUTE ON FUNCTION empresa_devolver(uuid) FROM app_usuario;
```

Conferido no código antes de decidir: hoje as duas têm **um chamador cada, e é o
mesmo** — `agirNaFilaAcao` em `app/fila/acoes.ts:30`, disparado pelos dois botões
do `Cartao`. Não há outro caminho; `app/carteira/lista.tsx` não tem botão nenhum.
Com todo desfecho passando por `contato_registrar`, as duas ficam sem chamador, e
a R-014 manda o `GRANT` sair junto.

**Revogar remove uma opção real, não uma duplicata**, e isso é deliberado.
Devolver e abandonar produzem estados diferentes:

| | `elegivel_em` | Efeito na fila |
|---|---|---|
| abandonar (reserva expira) | não é gravado | volta ao topo, no grupo dos nulos |
| devolver | `now() + 30 dias` | vai para o fim da ordem |

A `fila.1` registrou essa assimetria como fragilidade — devolver custa 30 dias,
abandonar custa zero. Exigir contato em toda devolução é o que começa a cobrar
por ela, e `nao_liguei` é o que impede a cobrança de virar contato inventado.

As duas saem de `FUNCOES_CONCEDIDAS_A_APP_USUARIO` e `public.contato_registrar`
entra. A invariante confere **os dois sentidos** (não registrada no banco, e
registrada e ausente), então lista e migração precisam mudar juntas ou o
`db:aplicar` cai.

## `contato_registrar`

```sql
contato_registrar(
  p_empresa_id         uuid,
  p_tipo               text,
  p_nota               text,
  p_proximo_passo      text,
  p_proximo_passo_data date,
  p_desfecho           text   -- 'nenhum' | 'assumir' | 'devolver'
) RETURNS text
```

`SECURITY DEFINER`, `SET search_path = ''`, `REVOKE EXECUTE ... FROM PUBLIC`,
`GRANT EXECUTE ... TO app_usuario`, no molde das três da `0016`. Nome com
entidade na frente, como `credencial_definir` e `empresa_assumir`.

Vocabulário de retorno: `ok`, `nao_encontrada`, `reserva_expirada`, `ja_e_sua`.
As duas últimas **vêm propagadas de `empresa_assumir`**, não são produzidas aqui:
`ja_e_sua` só aparece com `p_desfecho = 'assumir'` numa empresa que já é sua, e a
tela não oferece esse caminho — chega por clique duplo ou por `id` montado à mão.
Propagar em vez de traduzir é o que mantém um vocabulário só para a fila inteira.
"Esta empresa não está com você" e senha provisória pendente chegam como `42501`.
Valor fora do vocabulário lança no TypeScript — defeito nosso, não estado de
negócio, padrão da `0c.1`.

`p_desfecho` fora de `{nenhum, assumir, devolver}` **não** é `42501` e não entra
no vocabulário: é `RAISE EXCEPTION` cru. Permissão negada é resposta a uma
pergunta legítima; desfecho inventado é a aplicação passando lixo.

### A ordem, e ela é contrato

1. `pode_escrever()`, senão `42501`.
2. **`PERFORM 1 FROM public.empresa WHERE id = p_empresa_id FOR UPDATE`.**
3. Lê a linha de `empresa_fila`. Sem linha → `nao_encontrada`.
4. A empresa está comigo? Posse, ou reserva **vigente**. Reserva minha e
   expirada → `reserva_expirada`. Nem posse nem reserva → `42501`.
5. **Aplica o desfecho primeiro**, chamando `empresa_assumir` ou
   `empresa_devolver`. Resultado diferente de `ok` → **retorna esse resultado sem
   inserir nada.**
6. `INSERT INTO contato`.
7. `ok`.

**O passo 5 vem antes do 6 por atomicidade, não por gosto.** Em plpgsql, um
`RETURN` depois de um `INSERT` não desfaz o `INSERT`; aplicar o desfecho antes é
o que garante que nada fique pela metade sem precisar de subtransação. Se o
desfecho falha, o contato não existe; se o contato é inserido, o desfecho já
aconteceu.

E é também a razão de a operação ser uma só. A `0016` justificou gravar posse e
descanso juntos assim: *"Se fossem duas escritas, uma falha no meio devolveria a
empresa à fila sem descanso e ela reapareceria no mesmo dia."* Em duas
transações aqui a falha no meio é pior — **a empresa volta à fila e o registro do
que aconteceu na ligação se perde**, que é o dado que esta fatia inteira existe
para não perder.

### A trava, e onde o porquê dela mora

O passo 2 não é decoração. A `fila.1` deixou escrito que **função nova que
escreva em `empresa_fila` precisa travar `empresa` primeiro, e que quem esquecer
não recebe erro — só perde corridas em silêncio.** `contato_registrar` escreve em
`empresa_fila` pelo desfecho.

A trava vem **antes do `INSERT` em `contato`**, e o motivo é que invertê-la
(inserir o contato e travar depois) cria um caminho de deadlock que **não aparece
em teste de uma conexão só**.

**Correção de uma versão anterior desta spec, e ela mudou o desenho.** Estava
escrito aqui que esse motivo iria como comentário no corpo da função, com o
argumento de que *"o `COALESCE` de `empresa_devolver` continua lá por causa do
parágrafo ao lado dele"*. **Não há parágrafo ao lado dele.** Medido:
`db/migracoes/0016_empresa_fila.sql` não tem um único comentário além da primeira
linha, e `src/server/db/migracoes/checar.ts:44` é catraca que recusa qualquer
outro — comentário em migração só na linha 1, até 120 caracteres. O porquê do
`COALESCE` está em `docs/db/0016.md`, que é onde ele sempre esteve.

Então o comentário **não** vai no corpo da função: vai em `docs/db/0018.md`, que
é a convenção deste projeto e é o que a catraca impõe. A ordem no SQL fica sem
explicação ao lado, e a rede é o teste de corrida mais o doc.

Esse erro virou a **R-022**: afirmação sobre o estado do próprio repositório é
medição, não memória.

`empresa_assumir` e `empresa_devolver` refazem a trava por dentro
(`PERFORM ... FOR UPDATE` na mesma linha que já está travada). Isso é no-op, e é
bom que continuem fazendo: elas não podem depender de quem as chama ter travado.

## A leitura: agenda e linha do tempo

**`/carteira` vira a agenda.** Não há tela "Meu dia" separada — seriam duas telas
sobre as mesmas linhas, e o `crm-ch` só precisou dos baldes porque a carteira
dele era outra coisa.

Ordem: **vencidos primeiro, depois por data crescente, `NULLS LAST`.**

O `NULLS LAST` é decisão, não default do banco. Empresa sem próximo passo é a que
você assumiu e não combinou nada: precisa de atenção, mas **menos** que um
compromisso vencido há três dias, e `NULLS FIRST` a poria acima dele. Para não
sumir no fim da lista, o grupo "sem próximo passo" aparece **contado e nomeado**
na tela, não apenas ordenado por último.

"Vencido" é `proximo_passo_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date`,
calculado no banco. Nenhuma comparação de data em TypeScript.

**A linha do tempo** é da ficha: todos os contatos daquela empresa, do mais
recente para trás, com tipo, nota, quem registrou e quando.

## As telas

**`/fila`** continua sendo **uma tela onde tudo acontece**, e isso é o que a
assimetria desta fatia protege: quem puxou está discando com 30 minutos
correndo, e mandá-lo para outra página no meio da ligação é atrito com prazo.
O `Cartao` ganha, abaixo dos dados: o histórico da empresa (o que outros
vendedores registraram antes) e o formulário de contato. Os dois botões deixam de
ser "Assumir"/"Devolver" e passam a ser o envio do formulário com o desfecho.

**`/carteira`** ordenada pela agenda, com o grupo "sem próximo passo" contado, e
cada item linkando para a ficha.

**`/carteira/[id]`** — a ficha. Cadastro, endereço por `resolverCeps`, linha do
tempo completa, formulário de contato, e **o botão de devolver**.

O nome é `/carteira/[id]` e não `/empresas/[id]` de propósito: `/empresas` é a
área do gestor, e uma ficha ali prometeria uma coisa que esta não é. Se o gestor
precisar de ficha um dia, ela nasce em `/empresas/[id]` com outra política de
leitura e outro conteúdo.

**O botão de devolver na carteira é gap da `fila.1`, não requisito novo desta.**
Hoje não existe caminho de tela para devolver empresa da carteira: o `Cartao`
sabe renderizar o estado de posse (`app/fila/cartao.tsx:60` esconde "Assumir"
quando `posse`), mas o `Formulario` só passa a reserva para ele, então o ramo de
posse nunca é renderizado. Quem assume por engano fica com a empresa. Esta fatia
mexe na carteira de qualquer jeito, então o botão nasce junto.

## Quem é dono de quê, e a fronteira

`src/features/contato/` **não importa** de `src/features/fila/` nem de
`src/features/empresas/` (regra do `CLAUDE.md`).

| Módulo | Dono de |
|---|---|
| `src/features/fila/consulta.ts` | "o que está comigo" — a carteira, agora com o próximo passo derivado |
| `src/features/contato/tipos.ts` | a lista fechada |
| `src/features/contato/regras.ts` | quando o próximo passo é exigido |
| `src/features/contato/repositorio.ts` | `contato_registrar`, e a tradução do vocabulário |
| `src/features/contato/historico.ts` | a linha do tempo de uma empresa |
| `src/features/contato/acao.ts` | a action única |
| `app/carteira/[id]/page.tsx` | compõe os dois |

**A carteira com próximo passo fica na `fila`, não na `contato`, e isso é
escolha.** A alternativa era a `contato` ter a própria consulta de "o que está
comigo" — e aí o `WHERE` de posse-ou-reserva-vigente existiria em dois arquivos,
que é a duplicação silenciosa que a `fila.1` gastou um parágrafo para evitar em
outro lugar. A `fila` já é dona dessa pergunta; ela ganha um `LEFT JOIN LATERAL`.

**O limite que isso cria, escrito porque não é óbvio:** `features/fila` passa a
ler a tabela `contato`, que a `features/contato` é dona. É acoplamento por
tabela, não por importação de módulo — legal pela regra, e mesmo assim é um lugar
onde mexer numa feature quebra a outra sem o `tsc` avisar.

## A action única, e o que dá para provar

Duas telas, **um formulário e uma action**. A regra "exige próximo passo onde há
posse" mora em `src/features/contato/regras.ts` como função pura, com teste
próprio.

A action mora em **`src/features/contato/acao.ts`**, com `'use server'`, e as
duas rotas importam de lá. Isso quebra a convenção do projeto — hoje toda action
mora em `app/`, junto da rota (`app/fila/acoes.ts`, `app/usuarios/acoes.ts`,
`app/login/acao.ts`) — e a quebra tem motivo: a convenção serve quando **há uma
rota**. Com duas, pôr a action em `app/carteira/[id]/acoes.ts` criaria uma
dependência de rota para rota que ninguém adivinha lendo `/fila`, e criar
`app/contato/` para hospedá-la inventaria um segmento de URL que passaria a
existir sem página.

### A catraca, e o que ela não pega

```
O literal `contato_registrar` aparece em exatamente um arquivo fora de `tests/`.
```

Molde de `src/server/diretivas.test.ts`: `globSync` sobre `src/**` e `app/**`,
`readFileSync`, contagem. **Com o teste-guarda** que a `diretivas.test.ts` já tem
(*"existe pelo menos um, senão esta catraca não vigia nada"*) — sem ele, renomear
a função deixa a catraca verde vigiando zero arquivos. É a mesma lição da lista
de políticas irrestritas que a `cep` deixou vazia de propósito.

Isso pega o caso concreto: a segunda tela chamando o banco por conta própria.

**LIMITE DECLARADO, e vai no comentário do teste:** não pega duas actions
**importando o mesmo repositório** e validando cada uma do seu jeito. Aí
`contato_registrar` continua num arquivo só e a regra está em dois. Não há
catraca boa para isso — exigiria contar chamadores de uma função de domínio, e o
`tsc` não expõe isso sem ferramenta nova. A defesa é a regra ser função pura
testada, e o plano citar o arquivo por nome na tarefa da segunda tela. **Isso é
bilhete, e está rotulado como bilhete**: a R-013 é explícita sobre o custo de um
bilhete com aparência de catraca.

### A extensão do glob é tarefa própria

`src/server/diretivas.test.ts` varre **`app/**` só**. Mover a action para `src/`
a tiraria do alcance da catraca que nasceu porque uma constante exportada de um
arquivo `'use server'` chegou à tela sem nada acusar. O glob passa a incluir
`src/**` **na mesma fatia**, como tarefa numerada no plano — não como
consequência óbvia de outra tarefa, que é como coisas assim ficam para trás.

O ganho é maior que esta fatia, e vale registrar: hoje a catraca afirma *"toda
action em `app/` está vigiada"*; depois afirma **"toda superfície `'use server'`
do projeto está vigiada"**. A segunda é a afirmação que a gente achava que tinha
desde a `empresas`.

## Testes

TDD, vermelho primeiro em cada um.

**Unidade, sem banco:**

- `regras.ts`: exige próximo passo com posse; não exige sem posse; par
  incompleto (passo sem data, data sem passo) é recusado antes do banco.
- Tradução do repositório: `42501` → `sem_permissao`; cada palavra do
  vocabulário; **valor fora do vocabulário lança**.
- A lista de tipos: **um tipo fora dela não passa pela action**. É a única
  defesa que existe, dado que o banco só exige não-vazio.
- A invariante com `public.contato_registrar` presente e as duas revogadas
  ausentes — nos dois sentidos que ela confere.
- A catraca do `contato_registrar` em um arquivo só, com o teste-guarda.
- A catraca de diretivas com o glob novo, e um teste que prove que ela **vê**
  `src/features/contato/acao.ts` (senão a extensão passa sem cobrir nada).
- Render por `renderToStaticMarkup`, no molde de `app/empresas/` e
  `app/fila/cartao.test.tsx`: a carteira com vencido, com futuro e com nulo; o
  grupo "sem próximo passo" contado; a ficha com linha do tempo vazia e cheia; o
  aviso de que a data de `retornar_depois` não agenda nada.

**Integração, com banco:**

- A migração aplica e as invariantes passam.
- `app_conexao` fora de `comoUsuario` lendo `contato` → `42501`. Controle
  negativo no molde da 0b.
- `app_usuario`: `INSERT`, `UPDATE`, `DELETE` em `contato` → `42501` nos três.
  **É o que prova a imutabilidade** — ela é por ausência de função, e ausência
  precisa de teste ou não é verificável.
- `empresa_assumir` e `empresa_devolver` chamadas direto por `app_usuario` →
  `42501`. **O teste da revogação**, e ele é o que impede o `GRANT` de voltar por
  descuido numa migração futura.
- **Herança da leitura**, que é o par que sustenta o desenho:
  - vendedor lê os contatos da empresa que está com ele;
  - vendedor **não** lê os contatos de empresa alheia;
  - **vendedor B, ao puxar uma empresa devolvida, lê os contatos do vendedor A.**
    É o teste que prova que o histórico atravessa a troca de dono, que é o
    propósito da fatia inteira;
  - vendedor **deixa de ler** os contatos quando devolve — inclusive os que ele
    mesmo escreveu. Comportamento decidido, não defeito; ver Fragilidades.
- Senha provisória pendente → `42501` em `contato_registrar`.
- Cada desfecho: `nenhum` mantém o estado; `assumir` grava posse; `devolver`
  grava `elegivel_em`. **E o contato existe nos três.**
- **Desfecho que falha não deixa contato.** Reserva expirada com
  `p_desfecho = 'assumir'` → `reserva_expirada` **e zero linhas em `contato`**.
  É o teste do passo 5 antes do 6; sem ele a ordem parece arbitrária.
- Contato em empresa que não está com você → `42501`.
- Contato em empresa sem linha de fila → `nao_encontrada`.
- `p_desfecho` inválido → **lança**, e não vira `42501`.
- O `CHECK` de coerência: passo sem data e data sem passo, os dois recusados.
- **O último contato manda, mesmo com passo nulo:** registra passo e data,
  depois registra contato sem passo, e a agenda mostra a empresa **sem** próximo
  passo. É o teste da decisão que evita o compromisso ressuscitado.
- Ordem da agenda: vencido antes de futuro, futuro em ordem crescente, nulo por
  último.
- **A corrida:** `contato_registrar` com desfecho segurando a trava → o
  `fila_puxar` concorrente **pula** a empresa. Duas conexões de verdade, molde de
  `fila-posse.test.ts`.

## Verificação manual

No container, com a base de CEP carregada e as 65 empresas importadas. Registrar
em `docs/db/divida-tecnica.md` no formato das fatias anteriores, com o que passou
e o que não passou.

**Não rodar a suíte de testes durante a verificação manual** — o harness
reescreve a senha do `app_conexao` e derruba a `DATABASE_URL` do dev.

1. Vendedor A puxa; registra `nao_atendeu` com desfecho devolver.
2. A empresa some da fila de A e ele deixa de ler os contatos dela.
3. Vendedor A puxa outra; registra `interessado` com desfecho assumir; ela
   aparece em `/carteira` **sem** próximo passo, no grupo contado.
4. Abre a ficha; registra `acompanhamento` com próximo passo para ontem; a
   carteira mostra como vencido, no topo.
5. Registra outro `acompanhamento` com data futura; o vencido some e a data nova
   aparece. **É a correção sem mecanismo de correção.**
6. Registra `acompanhamento` sem próximo passo; a empresa vai para o grupo "sem
   próximo passo". **É a decisão do último contato mandar mesmo com passo nulo.**
7. Devolve pela ficha; sai da carteira.
8. Vendedor B puxa até receber a empresa do passo 1; **lê o contato de A na
   tela**. É o passo que a fatia inteira existe para fazer passar.
9. `retornar_depois` com data: a tela avisa que a empresa volta em 30 dias e a
   data é só histórico.
10. Tentar devolver sem escolher tipo: a tela recusa antes de chamar o banco.
11. Usuário com senha provisória pendente tenta registrar; recusa com mensagem.
12. Gestor continua vendo as 65 em `/empresas`, e não tem ficha.

## O que esta fatia faz com os gatilhos da `fila.1`

Os cinco, um por um. Formato da R-016: tipo, lado do erro, e o remédio.

### 1. Histórico de tentativa — aposenta como gatilho, e o numerador troca de pergunta

O gatilho existia para cronometrar uma fatia: *"quando a fila der a primeira
volta, faça o histórico"*. Esta fatia é o histórico. Gatilho cujo remédio embarcou
não fica esperando.

**Mas a medição não vira redundante**, porque `primeira_reserva_em` e `contato`
respondem coisas diferentes: a primeira diz que alguém **recebeu** a empresa na
tela, a segunda diz que alguém **ligou**. A diferença entre as duas é exatamente
o abandono, que a `fila.1` registrou como fragilidade sem medida.

O gatilho novo, no lugar dele:

> **Empresas que passam pela tela sem deixar rastro.** Numerador: reservadas
> alguma vez (`primeira_reserva_em IS NOT NULL`) com **zero linhas em `contato`,
> de qualquer tipo**. Denominador: reservadas alguma vez. Tipo: medição. Erra
> para tarde.
> **Remédio: a tela cobrar o registro antes de liberar o botão** — não é tabela
> nova, é regra de action.

**Esta é a contagem de _rastro_, e por isso `nao_liguei` NÃO é excluído dela.**
Empresa com `nao_liguei` foi vista e descartada por decisão de alguém; ela não
foi abandonada. Excluí-la aqui somaria descarte deliberado com abandono e
apagaria justamente a distinção que o tipo `nao_liguei` nasceu para criar. É o
gatilho B que conta descarte, e ele é outro.

O remédio vai escrito porque **gatilho cujo remédio ninguém sabe qual é dispara e
fica parado**, e isso é um modo de falha que a R-016 não cobre: ela exige tipo e
lado do erro, não remédio.

Isso também começa a corrigir a assimetria devolver × abandonar: abandonar deixa
de custar zero e passa a custar uma linha faltando numa conta.

### 2. O piso de 30 dias — não muda

É sobre tamanho de base contra consumo. Contato não toca nisso.

### 3. Consulta por CNPJ ("está com alguém?") — não muda

Contato não a responde: o vendedor continua sem enxergar empresa alheia, porque
`contato_leitura` delega para `empresa_leitura`.

### 4. Teto de carteira — trocado, não mantido

O `200` sai. A `fila.1` já o registrou como chute, e ele era proxy de uma coisa
que agora é mensurável direto:

> **Carteira maior do que a pessoa dá conta.** Próximos passos **vencidos há mais
> de 7 dias** na carteira de um vendedor — sete porque é o intervalo em que
> alguém ainda lembra da conversa; passou disso, o combinado virou perdido.
> Chute, rotulado como chute. Tipo: medição. Erra para tarde. Remédio: teto
> dentro de `contato_registrar`/`empresa_assumir`, ou conversa com a operação —
> a medição diz qual. É o gatilho C da tabela adiante.

Manter os dois deixaria um alarme que dispara pelo motivo errado ao lado de um
que dispara pelo certo.

### 5. Promover a `fila.2` (bloqueio) — adiado, não aposentado

O número de ligações desperdiçadas por mês não muda, mas **o custo de cada uma
cai**: o vendedor B, ao puxar, lê "A ligou três vezes, sem interesse" e gasta
trinta segundos em vez de uma ligação. Adiar é o resultado certo — bloqueio
continua sendo a única operação irreversível do desenho.

## Gatilhos novos desta fatia

| # | O que dispara | Tipo | Erra para | Hoje |
|---|---|---|---|---|
| A | reservadas com **zero** contatos, de qualquer tipo (abandono) | medição | tarde | 0 de 0 |
| B | proporção alta de `nao_liguei` sobre reservadas (descarte) | medição | tarde | 0 de 0 |
| C | próximos passos vencidos há mais de **7 dias** por vendedor | medição (chute) | tarde | 0 |
| D | carteira de uma pessoa passando de **80 empresas** | medição (chute) | tarde | máx. possível 65 |
| E | pedido de segundo prazo de devolução | proxy de dor | tarde | 0 |

**Os dois números são chute, e ficam rotulados como chute.** Eram um `N` só numa
versão anterior desta spec, e viraram dois nomes porque escritos com a mesma
letra a primeira releitura os trata como o mesmo número.

- **7 dias** (gatilho C) é o intervalo em que alguém ainda lembra da conversa.
  Passou disso, o próximo passo vencido deixou de ser atraso e virou combinado
  perdido.
- **80 empresas** (gatilho D) é a base de hoje mais folga. **Ele está
  estruturalmente mudo enquanto a base for 65** — a maior carteira possível é a
  base inteira, e 65 não chega a 80. Só volta a significar alguma coisa depois da
  próxima importação, e isso é registro, não vigilância: ninguém precisa olhar
  para ele até lá.

**B mede problema de cadastro, não de fila.** Proporção alta de empresas
descartadas sem ligar significa que a importação está trazendo empresa fora do
segmento — e hoje isso é invisível, porque ninguém está olhando para lá.

**E não é mudança isolada, e a dependência vai escrita junto:**

> **Segundo prazo de devolução** (`nao_atendeu` volta em dias, `retornar_depois`
> em meses, `sem_interesse` em muito tempo). `elegivel_em ASC` só significa
> "voltou há mais tempo" **enquanto houver um prazo só**, e a conta do gatilho 2
> da `fila.1` (`dias desde a devolução = now() - (elegivel_em - interval '30
> days')`) lê a data de devolução **de dentro** do `elegivel_em`, assumindo
> intervalo fixo — com dois prazos ela passa a devolver número errado sem errar.
> Quem implementar revisita a ordenação e o gatilho 2 na mesma fatia, ou grava a
> data de devolução em coluna própria.
>
> O dado para calibrar os três prazos **nasce nesta fatia**, nos tipos. É o
> oposto de `primeira_reserva_em`: coluna barata hoje que evita medição
> impossível depois.

## Decisões escritas

- **Fatia única, não dividida em `contato.1` e `contato.2`.** A divisão foi
  considerada — tabela, função, política e tela da fila numa; agenda e ficha na
  outra. A primeira metade fecharia o gatilho 1 sozinha e **pareceria pronta**:
  entregaria histórico sem lugar para ler histórico, com a carteira continuando
  a ser uma lista de leitura pura. É o mesmo argumento que manteve a `fila.1`
  inteira — fila sem posse parece pronta e não é.
- **Sem ficha para o gestor.** Ele lê `contato` pela política e não tem tela. Se
  precisar, nasce em `/empresas/[id]`, com outra política de leitura e outro
  conteúdo. Política de leitura não é `GRANT` de função, então a superfície não
  fica pendurada como a R-014 descreve.
- **A frouxidão do próximo passo anulável é uma, vista em dois lugares.** Ele é
  anulável porque a prospecção não tem o que combinar (a decisão da tabela) e
  porque `acompanhamento` pode não combinar nada (a decisão do último contato
  mandar). **É a mesma frouxidão**, e o conserto, se um dia virar problema, é um
  só: a tela cobrar por tipo. Registrada uma vez de propósito — duas fragilidades
  separadas convidam a dois consertos, e o segundo é sempre o que fica pela
  metade.

## Fragilidades herdadas por quem vier depois

- **O vendedor devolve uma empresa, lembra que anotou algo importante nela, e
  não consegue mais ver.** A política segue a empresa, não o autor. Não foi
  consertado porque a cláusula `OR criado_por = usuario_atual()` não tem tela que
  a consuma — não existe "meus contatos" — e política com cláusula sem consumidor
  é a R-014 na forma que a catraca não pega. Volta com a tela no dia em que doer.
  **É a fragilidade desta fatia com mais chance de virar reclamação**, e quem
  receber a reclamação precisa achar isto escrito pelo sintoma.
- **`retornar_depois` grava data que ninguém honra.** A tela avisa; o dado serve
  ao histórico e ao gatilho E. Se a tela parar de avisar, vira promessa falsa.
- **`nota` é texto livre e é lida por quem puxar a empresa depois.** Não há
  máscara, de propósito (ver Políticas). O que se escreve ali chega a colegas.
- **A cadeia de políticas agora tem três elos:** `contato_leitura` →
  `empresa_leitura` → `empresa_fila_leitura`. Estreitar a última estreita as três
  **em silêncio**. Nenhuma invariante lê conteúdo de política e não vai ler —
  comparar texto de expressão quebra na primeira reformatação do Postgres. A rede
  é o par de testes de `fila-politicas.test.ts`, estendido para contato: um pega
  o estreitamento, o outro nomeia de qual tabela ele veio.
- **`features/fila` lê a tabela `contato`.** Acoplamento por tabela, não por
  importação. O `tsc` não avisa.
- **A tabela é imutável por ausência de função, não por gatilho.** `REVOKE` que
  se perca numa migração futura abre escrita sem nada acusar além do teste de
  integração dos três verbos.
- **Contato falso continua possível.** Nada prova que a ligação aconteceu; o que
  a fatia faz é remover o incentivo a mentir, dando `nao_liguei` a quem não
  ligou.

## Documentação e regras a cumprir

- `docs/db/0017.md` com o porquê da migração.
- **`docs/db/0016.md` ganha ponteiro de encaminhamento (R-015)**, e são duas
  coisas, não uma: `empresa_assumir` e `empresa_devolver` perderam o `GRANT` para
  `app_usuario` e passaram a ser internas; e o gatilho 4 da `fila.1` foi
  substituído. Quem ler a `0016` primeiro precisa descobrir as duas.
- `docs/db/fundacao.md`: seção "Feito na fatia `contato`".
- `docs/db/divida-tecnica.md`: os gatilhos novos, a tabela de gatilhos vivos
  atualizada (o `200` sai), a verificação manual e as fragilidades.
- `FUNCOES_CONCEDIDAS_A_APP_USUARIO`: entra `public.contato_registrar`, saem
  `public.empresa_assumir` e `public.empresa_devolver`.
- Branch e PR; a main é protegida. **PR contra a `main` desde o começo**, sem
  empilhar (R-021).
