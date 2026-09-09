# Fatia 0c.1 — correções de usuários: design

Brainstorm de 2026-09-09. Correção sobre a 0c
(`2026-09-08-usuarios-design.md`), nascida da auditoria registrada em
`docs/db/divida-tecnica.md`. Precisa da 0c aplicada: a 0012 numera depois da
0011 e substitui funções dela.

## 1. Problemas

1. **`usuario.atualizado_por` mente na segunda redefinição de senha.** O
   `AND NOT senha_provisoria_pendente` no `UPDATE` de `credencial_definir`
   faz o `UPDATE` afetar zero linhas quando o alvo já está pendente, o gatilho
   de auditoria não roda, e a linha continua nomeando quem redefiniu da
   primeira vez. Verificado com dois gestores em sequência: o segundo trocou
   o hash e `usuario` seguiu apontando para o primeiro. Como
   `autenticacao.credencial` não guarda quem, não existe registro nenhum.
2. **A máquina de estados não é enforçada.** `acoesDe` decide o que a tela
   mostra e o servidor nunca reconfere. Verificado: definir senha provisória
   para usuário inativo funciona e sobe a marca; desativar quem já está
   inativo e reativar quem já está ativo dão `UPDATE 1` e sucesso.
3. **A conferência de permissão está duplicada verbatim** em
   `credencial_definir` e `sessoes_encerrar_de`. A terceira função copiaria de
   novo.
4. **A invariante da lista fechada só varre `public`,** e nada barra função
   executável por `PUBLIC`. Verificado: `definir_auditoria`, da 0003, está com
   `proacl` nulo, o que é `EXECUTE` para `PUBLIC` por padrão do Postgres.

## 2. Decisões deste brainstorm

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde mora a auditoria de "quem redefiniu" | `autenticacao.credencial` ganha `atualizado_por` | quem redefiniu a senha não é informação que `usuario` deva carregar. Resolve a mentira sem tirar o `AND NOT senha_provisoria_pendente`, que continua evitando carimbo à toa no caminho de criar |
| Onde mora a recusa de transição | função definidora `usuario_situacao_definir` | com `UPDATE` cru, `afetadas: 0` passa a ter três causas (não existe, é você, já estava) e a aplicação não separa três casos com um número que só sabe dizer zero |
| Sinal de recusa | `RAISE 42501` para permissão, valor de retorno para estado | mesmo padrão da 0c: permissão aborta a transação, estado é dado |
| Vocabulário do retorno | `text` de vocabulário fixo, não `enum` | enum é objeto a manter e migrar; o vocabulário é pequeno e tem um consumidor só. O risco de digitação se fecha com teste por valor (seção 6) e com erro no TypeScript para valor desconhecido |
| Valor fora do vocabulário | **lança**, não vira `{ ok: false }` | é defeito nosso, não estado de negócio |
| `sessoes_encerrar_de` | perde o `GRANT`, vira interna | função exposta sem consumidor não fica. `usuario_situacao_definir` absorveu o único chamador. Se voltar a precisar, volta com o consumidor junto |
| `exigir_gestor(p_alvo)` | parâmetro **obrigatório** | opcional com `DEFAULT NULL` cria o pior modo de falha: função futura esquece o argumento, o Postgres aceita, e a conferência de alvo some sem erro. Operação de gestor sem alvo ganha o próprio auxiliar quando existir |
| Mensagem de erro por função | some, e não faz falta | verificado: o `CONTEXT` do Postgres mostra a pilha e nomeia a função que chamou o auxiliar |
| Invariante de `PUBLIC` | entra nesta fatia | seu pedido já mexe na invariante; item de dívida sem catraca volta como surpresa |
| Critério da lista fechada | catalogar **toda definidora concedida a `app_usuario`**, substituindo o critério "toca `autenticacao`" | `usuario_situacao_definir` chega a `autenticacao` por outra função e não menciona o schema: nasceria no ponto cego. O gatilho registrado na dívida era "quando a próxima definidora nascer", e ela nasce aqui |
| As cinco funções de acesso na lista nova | entram | são definidoras concedidas a `app_usuario` como qualquer outra. Duas listas para a mesma classe de objeto é a divergência que a fatia elimina |
| `FUNCOES_DE_ACESSO` continua existindo | sim, renomeada | responde outra pergunta: "têm que existir", não "podem ter `GRANT`" |
| Conferência redundante em `sessoes_encerrar_de` | fica | se ganhar chamador novo, a conferência já está lá. Custo medido na seção 3.4 |

## 3. Migração `0012_situacao_e_auditoria.sql`

### 3.1 Coluna nova

```sql
ALTER TABLE autenticacao.credencial
  ADD COLUMN atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT;
```

Anulável, e as três leituras possíveis são:

| Valor | Significa |
|---|---|
| igual a `usuario_id` | a pessoa trocou a própria senha (`senha_trocar`) |
| diferente de `usuario_id` | um gestor redefiniu, e a coluna diz qual |
| nulo | foi o sistema; hoje só o seed do primeiro gestor |

**Sem gatilho, escrita explícita por cada função.** Diferente de `usuario`,
que usa `definir_auditoria`. O motivo é a troca própria: ali o GUC
`app.usuario_id` é nulo justamente quando queremos gravar alguém, então
gatilho baseado em `usuario_atual()` gravaria nulo. Não "uniformizar" depois.

### 3.2 `exigir_gestor(p_alvo uuid)`

`plpgsql`, `STABLE`, `SET search_path = ''`, **sem** `SECURITY DEFINER`,
**sem** `GRANT`, com `REVOKE EXECUTE FROM PUBLIC`.

```sql
IF NOT (public.pode_escrever() AND public.eh_gestor()) OR p_alvo = public.usuario_atual() THEN
  RAISE EXCEPTION 'so gestor ativo e sem senha provisoria age sobre outro usuario' USING ERRCODE = '42501';
END IF;
```

Não precisa ser definidora nem ter `GRANT` porque só é chamada de dentro de
funções definidoras, que já rodam como dona. Precisa do `search_path` vazio e
das referências qualificadas porque herda o `search_path` de quem a chama.
O `REVOKE` é obrigatório: função nova nasce com `EXECUTE` para `PUBLIC`.

Com identidade nula a primeira metade já é verdadeira e levanta; o
`p_alvo = NULL` nunca precisa ser avaliado como verdadeiro.

### 3.3 Funções de escrita

**`credencial_definir` exige `DROP` antes.** Verificado: `CREATE OR REPLACE`
recusa mudança de tipo de retorno com "cannot change return type of existing
function". O `DROP` leva junto o ACL, então `REVOKE`/`GRANT` são refeitos.
`DROP FUNCTION` é permitido pelo checador, que só barra `DROP TABLE` e
`DROP COLUMN`.

**Não há janela sem privilégio entre o `DROP` e o `GRANT`.** DDL no Postgres é
transacional, e a migração inteira roda numa transação só, de que o runner é
dono. Nenhuma outra sessão observa a função ausente nem sem `GRANT`: vê o
estado antigo até o `COMMIT` e o novo depois. Está escrito porque "dropar
função com `GRANT` ativo" assusta quem lê a migração sem reparar no `BEGIN`.

| Função | Assinatura depois | Devolve |
|---|---|---|
| `credencial_definir(uuid, text)` | `RETURNS text` (era `boolean`) | `ok`, `nao_encontrado`, `alvo_inativo` |
| `usuario_situacao_definir(uuid, boolean)` | nova, `RETURNS text` | `ok`, `nao_encontrado`, `ja_nesse_estado` |
| `sessoes_encerrar_de(uuid)` | `RETURNS integer`, inalterada | contagem |
| `autenticacao.senha_trocar(text, text)` | `RETURNS uuid`, inalterada | id ou nulo |

As três últimas por `CREATE OR REPLACE`, que basta porque o tipo de retorno
não muda.

`credencial_definir`, na ordem: `exigir_gestor(p_usuario_id)`; lê `ativo` do
alvo, nulo devolve `nao_encontrado`, falso devolve `alvo_inativo`; grava a
credencial com `atualizado_por = usuario_atual()`, inclusive no
`ON CONFLICT DO UPDATE`; sobe a marca com o `AND NOT
senha_provisoria_pendente` mantido; apaga as sessões do alvo; devolve `ok`.

`usuario_situacao_definir`, na ordem: `exigir_gestor(p_usuario_id)`; lê
`ativo`, nulo devolve `nao_encontrado`, igual a `p_ativo` devolve
`ja_nesse_estado`; faz o `UPDATE`; quando `p_ativo` é falso chama
`sessoes_encerrar_de`; devolve `ok`.

`senha_trocar` ganha `atualizado_por = v_usuario` no `UPDATE` da credencial,
usando o usuário que ela já deriva do hash da sessão.

`sessoes_encerrar_de` troca a conferência copiada por `exigir_gestor` e perde
`GRANT EXECUTE ... TO app_usuario`.

### 3.4 Custo da conferência redundante

Uma desativação faz **quatro leituras de `usuario` pelas funções de acesso**,
onde duas bastariam: `exigir_gestor` chama `pode_escrever()` e `eh_gestor()`,
uma leitura cada, e `sessoes_encerrar_de` chama `exigir_gestor` de novo por
dentro. Some uma leitura do estado do alvo e o próprio `UPDATE`. São buscas
por chave primária, então é barato. Está aqui para que, se um dia aparecer
num perfil, se saiba que foi escolha e não descuido.

### 3.5 Correção fora do escopo original

```sql
REVOKE EXECUTE ON FUNCTION definir_auditoria() FROM PUBLIC;
```

## 4. A autoridade migra da política para a função

Dentro de uma definidora cuja dona é isenta de RLS, a política não é
avaliada. Então `usuario_situacao_definir` **não passa** por
`usuario_alterar`: a `exigir_gestor` de dentro dela é a autoridade, e a
política continua valendo como rede de segurança para `UPDATE` direto. Quem
procurar na política a regra de desativar não vai achar; está na função.

**A isenção tem dois caminhos independentes, e a formulação importa.**
Verificado em 2026-09-09 no Postgres 17, com tabela de três linhas e política
que mostra uma:

| Dona da tabela e da função | `FORCE` | Linhas que a definidora vê |
|---|---|---|
| comum | não | 3 |
| comum | sim | 1 |
| superusuária | não | 3 |

Ou seja, não é "ser superusuária" que desliga a política: é a **isenção de
dono**, que vale para quem é dono da tabela sem `FORCE`, e também para
superusuário sempre. Hoje as duas valem ao mesmo tempo, no container e na
Railway. Trocar a dona por um papel comum, sozinho, não muda nada.

O único jeito de a política voltar a valer por dentro da definidora é ligar
`FORCE`. E aí o efeito não é "a política passa a decidir": é o bloqueio total
que a 0b.1 documentou em `docs/db/0010.md`, porque não existe política para a
dona e as funções de acesso passam a devolver nulo. A invariante que barra
`FORCE` continua sendo a prevenção, e agora tem um segundo motivo além do que
a 0010 registrou.

**Detecção, não só documentação** (seção 6): um teste prova a isenção pelo
lado de dentro, para o dia em que ela sumir ser um teste vermelho e não um
bloqueio em produção.

## 5. Código

Interface do repositório, que encolhe:

```ts
listar()
criar(dados, hash)
definirCredencial(id, hash)
mudarPapel(id, papel)
definirSituacao(id, ativo)
```

Saem `alterar(id, campos)` e `desativar(id)`. Com isso morre de graça o
`alterar(id, {})` da auditoria, que fazia `UPDATE 1` e carimbava auditoria sem
mudar nada: não existe mais forma de expressá-lo.

**Tradução do vocabulário**, um mapa só em `repositorio.ts`, usado pelas três
chamadas que devolvem texto (`criar`, `definirCredencial`,
`definirSituacao`). Consulta com `Object.hasOwn`, não indexação direta, para
`'toString'` não virar resultado. Valor fora do mapa lança
`ResultadoDesconhecido` com o nome da função e o valor recebido.

`criar` passa a **conferir** o retorno, fechando o item da auditoria em que o
booleano de `credencial_definir` era ignorado.

**Motivos novos** em `Motivo`: `alvo_inativo` e `ja_nesse_estado`. Como
`mensagens.ts` usa `Record<Motivo, string>`, o build quebra até os textos
existirem, que é o comportamento pedido pela R-012.

| Motivo | Texto |
|---|---|
| `alvo_inativo` | "Não dá para definir senha de um usuário desativado. Reative antes." |
| `ja_nesse_estado` | "Esse usuário já está nesse estado. Recarregue a lista." |

O primeiro diz o que fazer, seguindo o que a 0c decidiu para a senha
provisória.

**Serviço** sem mudança de assinatura: `desativar` e `reativar` delegam para
`definirSituacao` com booleano. **Tela** sem mudança: `acoesDe` já esconde
"nova senha provisória" de inativo, e agora o servidor concorda com ela em vez
de aceitar calado.

## 6. Invariantes e testes

### 6.1 Invariantes

**A lista fechada muda de critério, não só de escopo.** A versão da 0c
catalogava "definidora de `public` que menciona `autenticacao.` no corpo e tem
`GRANT` para `app_usuario`". Isso deixaria `usuario_situacao_definir` fora de
qualquer catálogo, porque ela chega a `autenticacao` **através de**
`sessoes_encerrar_de` e não menciona o schema no próprio corpo. A primeira
função criada nesta fatia nasceria no ponto cego da invariante que a fatia
existe para apertar.

Então `FUNCOES_DE_USUARIO_EM_AUTENTICACAO` é **substituída**, não ampliada.

**Duas constantes, com propósitos separados e nomes que os digam:**

| Constante | Pergunta que responde |
|---|---|
| `FUNCOES_DE_ACESSO_OBRIGATORIAS` | quais funções **têm que existir** |
| `FUNCOES_CONCEDIDAS_A_APP_USUARIO` | quais podem **ter `GRANT`** para `app_usuario` |

São perguntas diferentes sobre o mesmo conjunto, e por isso as duas listas se
sobrepõem sem se contradizer: as cinco funções de acesso entram nas duas.
Excluí-las da segunda seria manter duas listas para a mesma classe de objeto,
que é a divergência que esta fatia elimina. Elas são definidoras com `GRANT`
para `app_usuario` como qualquer outra; "de acesso" é como nós as chamamos,
não uma propriedade do banco.

Conteúdo de `FUNCOES_CONCEDIDAS_A_APP_USUARIO` depois da 0012, sete nomes
qualificados:

```
public.usuario_atual          public.credencial_definir
public.pode_ler               public.usuario_situacao_definir
public.eh_gestor
public.pode_escrever
public.senha_provisoria_de
```

**Leitura, sem heurística de texto.** Toda função definidora de schema de
aplicação com `has_function_privilege('app_usuario', p.oid, 'EXECUTE')`.
Some o `prosrc LIKE '%autenticacao.%'`, e com ele some o limite de substring
que a 0c documentava. Duas violações: concedida e fora da lista; na lista e
ausente ou sem `GRANT`.

**Segunda invariante: nenhuma função de schema de aplicação executável por
`PUBLIC`.** Considera `proacl` nulo, que é o padrão do Postgres, e entrada
explícita de `PUBLIC` no ACL.

**Custo conhecido da segunda:** extensão instalada em schema de aplicação teria
todas as funções acusadas. Nenhuma está hoje. Se alguma entrar, ela vai para
schema próprio ou a invariante ganha lista de exceções — decisão de quem
instalar, não desta fatia.

### 6.2 Testes de banco

**Um por valor do vocabulário, seis no total**, asserindo a string exata e não
só o efeito. Sem isso, `'ok '` com espaço ou `'nao_encontardo'` cairiam no ramo
de desconhecido e um teste que só olha o efeito nunca chegaria lá.

**Auditoria:** dois gestores em sequência redefinindo a senha do mesmo alvo,
com `credencial.atualizado_por` nomeando o **segundo**; `senha_trocar`
gravando o próprio usuário; seed deixando nulo.

**Transições recusadas:** senha para inativo, desativar quem já está inativo,
reativar quem já está ativo.

**Privilégios:** `exigir_gestor` e `usuario_situacao_definir` não executáveis
por `PUBLIC` nem por `app_conexao`; `sessoes_encerrar_de` deixando de ser
executável por `app_usuario`; `definir_auditoria` deixando de ser executável
por `PUBLIC`.

**Isenção de dono**, em `tests/integracao/politicas.test.ts`:

```ts
test('isenção de dono: definidora lê linha que a política esconde do chamador', async () => {
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [gestor])
  const direto = await banco.comoUsuario(vendedor, (e) =>
    e('SELECT senha_provisoria_pendente FROM usuario WHERE id = $1', [gestor]),
  )
  expect(direto.afetadas).toBe(0)
  const pelaDefinidora = await banco.comoUsuario(vendedor, (e) =>
    e<{ senha_provisoria_de: boolean | null }>('SELECT senha_provisoria_de($1)', [gestor]),
  )
  expect(pelaDefinidora.linhas[0].senha_provisoria_de).toBe(true)
})
```

Duas asserções que só valem juntas: a primeira prova que a linha está
escondida do vendedor, a segunda que a definidora a alcança mesmo assim.
`senha_provisoria_de` serve de sonda porque já é definidora e já tem `GRANT`
para `app_usuario`; nenhuma função nova é criada para o teste.

**Diagnóstico, para o dia em que falhar:** a causa provável é `FORCE ROW LEVEL
SECURITY` ligado ou a dona ter deixado de ser dona, e a consequência esperada
é a da `0010.md`, bloqueio geral e não degradação.

### 6.3 Controles negativos das invariantes

No molde dos que já existem em `runner.test.ts`: definidora em schema fora de
`public`, com `GRANT` para `app_usuario`, tocando `autenticacao`, sendo
nomeada; e função criada sem `REVOKE` sendo nomeada pela invariante de
`PUBLIC`.

### 6.4 Unitário

O mapeamento com valor de lixo lançando `ResultadoDesconhecido`, e não virando
`{ ok: false }`.

## 7. Objetos tocados fora do escopo original

Esta fatia mexe em objetos de três fatias anteriores. Cada um tem motivo
próprio, e cada doc de origem ganha ponteiro para cá.

| Objeto | Origem | O que muda | Por que entrou |
|---|---|---|---|
| `definir_auditoria` | 0003 | ganha `REVOKE ... FROM PUBLIC` | a invariante nova falharia com ele no banco |
| `autenticacao.senha_trocar` | 0009 | grava `atualizado_por` | é um dos três caminhos que escrevem em `credencial`; sem ele, nulo fica ambíguo |
| `sessoes_encerrar_de` | 0011 | perde o `GRANT`, vira interna | `usuario_situacao_definir` absorveu o único chamador |

## 8. Docs

- `docs/db/0012.md`, no molde dos anteriores.
- **Ponteiro de encaminhamento** no topo de `0003.md`, `0009.md` e `0011.md`:
  o objeto que o doc descreve foi alterado na 0012, existe capítulo depois.
- `0010.md` ganha a ligação nova: `FORCE` não só bloqueia as funções de
  acesso, ele derruba a isenção de dono da qual `usuario_situacao_definir`
  depende para ser a autoridade.
- `fundacao.md`: "Como o gestor define senha" passa a descrever
  `usuario_situacao_definir` e `exigir_gestor`, e a frase sobre a autoridade
  migrar da política para a função nessa operação.
- `divida-tecnica.md`: sai o bloco "Vai para a 0c.1"; ficam os itens que
  sobreviveram, mais os que esta fatia criar.
- `REGRAS.md`, duas regras que a sessão produziu e ainda não estão escritas.

**Regra "função exposta sem consumidor não fica"**, aplicada três vezes no
projeto: `AUTH_SECRET`, `usuario_publico`, `sessoes_encerrar_de`. Ela é
**meio catraca e meio bilhete**, e o texto precisa dizer qual metade é qual,
senão parece mais forte do que é.

| Situação | Quem pega |
|---|---|
| função de schema de aplicação executável por `PUBLIC` | catraca |
| definidora com `GRANT` para `app_usuario` fora da lista, **toque ou não `autenticacao`** | catraca |
| função **não** definidora com `GRANT` para `app_usuario` | bilhete |
| função concedida que ninguém chama | **bilhete** |

A última linha é o buraco que sobra. "Não tem consumidor" não é observável no
catálogo: exigiria cruzar o SQL com o código TypeScript que chama, e nada faz
isso. A catraca cobre exposição indevida, não desuso.

A terceira linha é limite deliberado: função não definidora roda como quem
chama, sujeita a RLS e aos mesmos `GRANT`s, então não escala privilégio. A
superfície que interessa catalogar é a definidora.

**Regra do ponteiro de encaminhamento:** doc de migração cujo objeto foi
alterado por migração posterior ganha uma linha no topo apontando o capítulo
seguinte. Bilhete: nada confere que o ponteiro existe.

## 9. Fora de escopo

Limite de taxa nas operações de gestor, que é o vetor de negação de serviço
por `scrypt` da auditoria; validação de e-mail além do `@`; cobertura
automática de `app/usuarios/**`; paginação; `usuario_publico`. Todos ficam em
`divida-tecnica.md`.

## 10. Limitações conhecidas

- Função **não** definidora com `GRANT` para `app_usuario` fica fora do
  catálogo. Deliberado: ela roda como quem chama, sujeita a RLS e aos mesmos
  privilégios, então não escala nada.
- Continua sem catraca o desuso: "concedida e ninguém chama" exigiria cruzar
  o catálogo com o TypeScript.
- Gestor A ainda redefine a senha de gestor B e entra como B. O que muda é
  que agora fica registrado em `credencial.atualizado_por`.
- A conferência redundante custa duas leituras a mais por desativação
  (seção 3.4).
- `usuario_situacao_definir` deixa de passar pela política `usuario_alterar`
  (seção 4).
