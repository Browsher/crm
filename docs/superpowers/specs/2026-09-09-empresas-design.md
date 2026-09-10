# Fatia `empresas`: cadastro por importação de planilha

> **Emenda de 2026-09-10 (R-015).** A premissa que cortou `cnae_codigo`,
> `cnae_descricao` e `atividade_categoria` desta fatia é **falsa**: a planilha
> real do gestor tem uma coluna "Atividade", vinda da origem da base. Ver
> "Fatia empresas: a coluna Atividade existe na planilha real" em
> `docs/db/divida-tecnica.md`, com o gatilho registrado.

A base de prospecção entra por um CSV que o gestor envia. A empresa existe pelo
CNPJ; o endereço é só o CEP, resolvido pela base local da fatia anterior. Não há
formulário de cadastro manual e não há fila — posse, reserva, quarentena e
bloqueio são fatia separada, como a spec de `cep` já decidiu.

Esta spec cobre **duas fatias**, e o corte entre elas tem um critério.

## As duas fatias, e por que o corte cai aqui

**`empresas`** — migração `0014`, as funções puras de normalização, o leitor de
CSV, a importação em três fases, o relatório, **o arquivo-modelo** e **a tela
`/empresas/importar`**.

**`empresas.1`** — três correções da auditoria, sem migração: numeração de
linha, simetria de colunas e tradução de `23505`/`22021`. Ver "O que a
`empresas.1` corrigiu", no fim.

**`empresas.2`** — migração `0015`, a listagem `/empresas` com busca e
paginação, e a maquinaria de busca sem acento que só ela consome.

A numeração segue a **ordem de execução**, não o escopo: `empresas.1` é o que
vem depois de `empresas`, seja qual for o assunto.

**O critério é o que dá para verificar à mão.** O modelo e a tela de importar
ficam na primeira **porque sem eles a primeira fatia só existe em teste de
integração com fixture**. Com eles, o gestor baixa o modelo, preenche, salva
como CSV e importa de verdade — e é exatamente aí que mora a armadilha do
Excel, que é **a única coisa desta fatia que teste automático não pega**. Uma
fatia cuja parte mais arriscada só é verificável na fatia seguinte está cortada
no lugar errado.

**Pela mesma lógica, ao contrário:** `unaccent`, `sem_acento` e a coluna `busca`
ficam na `empresas.2`, não na `0014`. Elas existem só para a busca. Criar um
schema, uma extensão, cinco `REVOKE` e uma promessa de `IMMUTABLE` que nenhuma
tela usa é a R-014 — o mesmo argumento com que a spec de `cep` segurou o `GRANT`
em `cep_carga` até existir o relatório que o consome.

As seções abaixo marcam a qual fatia pertencem quando não for óbvio.

## O que mudou desde o desenho original

O desenho começou com formulário manual e virou importação de planilha. A troca
não é só de tela: ela **transfere a identidade da empresa para dentro do
arquivo**. Num formulário, quem evita cadastro duplicado é a pessoa que digita —
ela vê a lista, procura, desiste. Numa importação, quem evita é a chave. Sem uma
coluna que diga "esta é a mesma empresa da planilha passada", a segunda
importação duplica tudo em silêncio.

É por isso que as decisões desta fatia giram em torno do CNPJ com um rigor que
um formulário não pediria.

## A identidade: CNPJ

**Obrigatório e único.** `cnpj text NOT NULL UNIQUE`. Linha sem CNPJ é recusada
na validação, antes de qualquer banco, e sai no relatório.

**Guardado com 14 caracteres, sem pontuação, letras em maiúscula.** Mesma dupla
de `cep`: uma função pura que normaliza e um `CHECK` de forma no banco. Guardar
`12.345.678/0001-95` significaria que a mesma empresa digitada com espaçamento
diferente vira duas empresas.

### O formato é alfanumérico, e isso já está valendo

O CNPJ alfanumérico **entrou em vigor em 6 de julho de 2026** — dois meses antes
desta spec. Instrução Normativa RFB nº 2.229/2024, validação em produção pela
Nota Técnica Conjunta nº 2025.001. As 12 primeiras posições passam a aceitar
letras; as 2 últimas continuam sendo dígitos verificadores numéricos. CNPJs
existentes não mudam — o alfanumérico é atribuído só a inscrições novas.

Daí `CHECK (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')`, e não `^[0-9]{14}$`.

**Por que aceitar agora um formato que a planilha de hoje não tem.** Na prática
nenhum CNPJ alfanumérico deve aparecer tão cedo: são inscrições de julho de 2026
para frente, e prospecção não vive de empresa aberta esta semana. O problema não
é hoje. É que **migração aplicada neste projeto é imutável byte a byte**: no dia
em que o primeiro alfanumérico chegar, o conserto custa migração nova, e até lá
a linha cai em erro de validação com uma mensagem que não explica a causa. Os
dois caracteres a mais na regex compram essa dívida inteira.

### O dígito verificador reprova a linha

`validarCnpj` implementa **a versão nova do cálculo**: cada caractere vale seu
código ASCII menos 48 (`'0'`→0 … `'9'`→9, `'A'`→17 … `'Z'`→42), pesos 2…9
ciclando da direita, módulo 11, resto menor que 2 vira dígito 0. Para CNPJ
numérico o resultado é idêntico ao cálculo antigo — **uma implementação cobre os
dois formatos**, e não existe versão antiga a manter.

DV reprovado **recusa a linha**, com o valor no relatório.

**A tensão, escrita de propósito.** O argumento "prospecção começa por telefone"
é o que faz a empresa **entrar mesmo com CEP não resolvido**, e aqui ele foi para
o outro lado. Não é incoerência: a perda é de natureza diferente nos dois casos.
Sem CEP você perde o endereço de uma empresa que existe e continua podendo
ligar. Com CNPJ errado você perde a capacidade de saber que ela é a mesma
empresa da próxima planilha — e o erro fica gravado *como identidade*, que é a
única coisa nesta tabela que não dá para consertar reimportando. A recusa também
é temporária de um jeito que a do CEP não seria: conserta na origem, reimporta,
a empresa entra.

**O que o banco garante e o que não garante**, na mesma forma da fatia `cep`:
forma garantida pelo banco, existência não. `AAAAAAAAAAAA00` passa no `CHECK`.
Quem pega isso é o DV, na fase 1. Quem sabe se o CNPJ existe é a Receita, e não
vamos perguntar a ela.

## A tabela — fatia `empresas`

Migração `0014_empresa.sql`.

```sql
CREATE TABLE empresa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  cnpj          text NOT NULL UNIQUE CHECK (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  razao_social  text NOT NULL CHECK (btrim(razao_social) <> ''),
  nome_fantasia text CHECK (btrim(nome_fantasia) <> ''),

  contato_nome  text CHECK (btrim(contato_nome) <> ''),
  telefone      text NOT NULL CHECK (telefone ~ '^[0-9]{10,11}$'),
  email         text CHECK (email = lower(btrim(email))
                            AND email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),

  cep           text CHECK (cep ~ '^[0-9]{8}$'),

  criado_em      timestamptz NOT NULL DEFAULT now(),
  criado_por     uuid REFERENCES usuario (id) ON DELETE RESTRICT,
  atualizado_em  timestamptz,
  atualizado_por uuid REFERENCES usuario (id) ON DELETE RESTRICT
);

CREATE TRIGGER empresa_auditoria BEFORE INSERT OR UPDATE ON empresa
FOR EACH ROW EXECUTE FUNCTION definir_auditoria();
```

Sete colunas de conteúdo e o quarteto de auditoria preenchido pelo gatilho
`definir_auditoria()` da `0003` — nunca pelo TypeScript. A coluna `busca` chega
na `0015`, junto com a busca que a consome.

**`telefone NOT NULL`.** Prospecção começa por telefone: empresa sem telefone é
uma linha que ninguém consegue trabalhar. Ela ocuparia a fila e não viraria
nada. Como a planilha é modelo nosso, a recusa é imediata e barata de consertar.

**`telefone` só em dígitos, 10 ou 11 (fixo ou celular, com DDD).** E fica dito
outra vez, porque é onde alguém vai querer economizar: **o DDD guardado aqui não
decide estado nenhum.** Medido no `crm-ch`, numa base de 2.246 empresas: o DDD
errou o estado em 845 delas, 38%. O telefone é habilitado onde o sócio mora, não
onde a loja funciona. O estado vem do CEP.

**`email` em minúscula, com `CHECK` deliberadamente frouxo** — tem `@`, não tem
espaço, e nada além disso. Espelha `usuario.email`. Regex "de verdade" para
e-mail é a armadilha clássica: a rigorosa recusa endereço válido e nenhuma prova
que a caixa existe. O `CHECK` pega lixo de transcrição; quem prova o resto é
mandar mensagem.

**`CHECK (btrim(x) <> '')` nas colunas anuláveis** aceita `NULL` e recusa `''`.
É a mesma regra da fatia `cep`: `''` e `NULL` significando a mesma coisa em
colunas diferentes é dívida que nasce barata e cobra caro.

### O que não entra, e por quê

**Endereço resolvido** (`logradouro`, `bairro`, `cidade`, `estado`): a spec de
`cep` já decidiu — vêm de `LEFT JOIN` ou de `resolverCeps`. Guardar cópia seria
derivado com duas fontes de verdade. A fatia `cep` renomeou o `complemento` do arquivo dos Correios para `faixa`
prevendo uma coluna `complemento` em `empresa`. Ela não existe (ver abaixo), e
o nome novo continua valendo por si: `faixa` é o trecho da rua, e chamar isso
de complemento sempre foi errado.

**`cnae_codigo`, `cnae_descricao`, `atividade_categoria`, `porte`,
`capital_social`, `data_abertura`**: existiam no `crm-ch` porque **vinham da
Receita**, não de digitação. Ninguém digita capital social à mão numa planilha
de prospecção.

**Correção de 2026-09-10:** o argumento vale para `capital_social` e
`data_abertura`, e **não** para atividade — a planilha real tem a coluna, e ela
não é digitada. O corte segue de pé por outro motivo, que está no registro:
ter o dado não é ter o uso. Ver `docs/db/divida-tecnica.md`.

**`empresas_no_endereco`**: era o achado mais valioso do `crm-ch` — empresa
recém-aberta costuma ser registrada no endereço do contador, e na base de teste
41% dividia endereço com dezenas de outras, com um único número somando 453. Sai
mesmo assim, e o motivo importa: **aquilo valia porque a base vinha em massa da
Receita**. Numa planilha digitada à mão você está digitando o endereço da loja
que achou, não o do contador. Gatilho para voltar: **a base voltar a vir da
Receita**.

**`numero` e `complemento`**: saíram na revisão final, e o motivo é o mesmo que
já tinha tirado `cnae` e `porte` — só que uma volta mais fundo. O endereço aqui
existe porque o CEP dá cidade e UF, e cidade e UF servem para **segmentar
ligação**. Número de porta não serve para ligar; serve para **visitar**. Este
CRM não tem visita: o vendedor liga.

Elas tinham entrado por hábito de cadastro de endereço, não por uso. Nenhuma
tela as mostrava, nenhuma decisão as lia, e o `CHECK`
`empresa_endereco_precisa_de_cep` existia inteiro para guardar a coerência de
dois campos que ninguém consulta — cerimônia em volta de dado morto.

**Voltam junto com a tela que as mostra**, quando existir visita. Não antes: é
uma coluna e um `ALTER TABLE`, e a fatia que precisar delas vai saber o que
fazer com o valor.

**`vendedor_id`, `reservado_por_id`, `reservado_ate`, `quarentena_ate`,
`bloqueada_em`**: fatia da fila.

## Busca sem acento — fatia `empresas.2`

`razao_social` e `nome_fantasia` têm acento, e a busca precisa achar "São"
digitando "sao". O `crm-ch` usava `unaccent`, e o caminho óbvio não funciona.

Migração `0015_empresa_busca.sql`, inteira:

```sql
CREATE SCHEMA extensoes;
CREATE EXTENSION unaccent WITH SCHEMA extensoes;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA extensoes FROM PUBLIC;

CREATE FUNCTION sem_acento(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = ''
AS $$ SELECT lower(extensoes.unaccent('extensoes.unaccent'::regdictionary, p)) $$;
REVOKE EXECUTE ON FUNCTION sem_acento(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION sem_acento(text) TO app_usuario;

ALTER TABLE empresa ADD COLUMN busca text GENERATED ALWAYS AS
  (sem_acento(razao_social || ' ' || coalesce(nome_fantasia, ''))) STORED;
```

### O custo do `ADD COLUMN ... GENERATED`, com número

`ADD COLUMN ... GENERATED ... STORED` **reescreve a tabela inteira**, segurando
`ACCESS EXCLUSIVE` durante toda a reescrita — quem tenta ler `empresa` nesse
intervalo espera. Então o custo real não é o tempo do comando: é por quanto
tempo a tabela fica indisponível.

O número tem que estar escrito **antes**, senão ele aparece quando alguém já
estiver esperando o `ALTER` terminar. Medido em 2026-09-09 no container
(`postgres:17`), com a tabela na forma da `0014` e texto acentuado de verdade:

| Linhas | Reescrita | Tamanho da tabela |
|---|---|---|
| 10 mil | 129 ms | — |
| 100 mil | 792 ms | — |
| 1 milhão | 5,6 s | 328 MB |

Linear, cerca de **5,6 µs por linha**.

**A leitura:** até **100 mil linhas** a reescrita é sub-segundo e ninguém
percebe — é trivial, e continua trivial mesmo que a `empresas.1` demore meses.
Como uma importação carrega no máximo 5.000 linhas, chegar lá são vinte
importações cheias.

**Acima de 500 mil linhas** (~3 s de tabela travada) o `ALTER` deixa de ser um
comando qualquer e vira janela de manutenção: aplicar fora do horário de uso, e
avisar. **Acima de 1 milhão**, reconsiderar a forma — coluna comum preenchida em
lotes e depois trocada por gerada custa mais trabalho e não trava a tabela.

**O que a medição não cobre, e é honesto dizer:** foi feita em disco local, no
Postgres 17. Produção é Railway, 18.6, com disco de rede. O tempo lá é
plausivelmente maior — a ordem de grandeza vale, o número exato não. Se a
`empresas.1` chegar com a tabela já grande, medir antes de aplicar.

### Medições de 2026-09-09

Contra o container local (`postgres:17`) e contra a Railway (leitura de catálogo).

| O que | Resultado |
|---|---|
| `unaccent` disponível no container | sim, 1.1 |
| `unaccent` disponível na Railway (PostgreSQL 18.6) | sim, 1.1 — não instalada |
| `provolatile` de `unaccent(text)` | `s` (STABLE), **não IMMUTABLE** |
| Coluna gerada usando `unaccent` direto | `ERROR: generation expression is not immutable` |
| Índice funcional usando `unaccent` direto | `ERROR: functions in index expression must be marked IMMUTABLE` |
| `proacl` após `CREATE EXTENSION` | nulo em `unaccent` (2 assinaturas), `unaccent_init`, `unaccent_lexize` |
| Invólucro `IMMUTABLE` com dicionário explícito | funciona; índice funcional aceita |
| `'Aurora Iluminação São Paulo'` procurada por `sao` | encontrada |
| `'LÂMPADAS LTDA'` procurada por `lampadas` | encontrada |

**Nem coluna gerada nem índice funcional aceitam `unaccent` direto.** A saída é
o invólucro `sem_acento` acima, que passa o dicionário explicitamente e por isso
pode ser declarado `IMMUTABLE`.

### A promessa que o `IMMUTABLE` faz, e que pode ser quebrada

Declarar `sem_acento` como `IMMUTABLE` é prometer que o dicionário de `unaccent`
nunca muda. Se mudar — e uma troca de versão maior do Postgres pode mudar — a
coluna gerada e qualquer índice sobre ela ficam desatualizados **em silêncio**:
nada dá erro, a busca só passa a não achar. Com produção em 18.6 e testes em 17,
isso não é hipótese distante; é a divergência que a `divida-tecnica.md:32` já
registra, aplicada a um lugar novo.

Fica registrado como limitação conhecida. O conserto, se acontecer, é recalcular
a coluna — barato, mas só se alguém souber que precisa.

### A invariante pega tudo isso, e é para pegar

A consulta de "função executável por PUBLIC" (`invariantes.ts:136-142`) varre
**todo schema que não é do sistema**. Botar a extensão num schema `extensoes`
não escapa dela — e é bom que não escape. Medido: `proacl` nulo é o padrão do
Postgres para EXECUTE a PUBLIC, e as quatro funções da extensão nascem assim, e
`sem_acento` também nasceria.

Então a migração traz `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA extensoes FROM
PUBLIC`, mais `REVOKE`/`GRANT` explícitos em `sem_acento`. Cinco funções ao
todo. Não é obstáculo à fatia: é a catraca funcionando como desenhada, e a
primeira vez que ela cobra alguma coisa.

### A coluna `busca` não contém o CNPJ

Deliberado. Busca por CNPJ é **exata e é condição separada no `WHERE`**, nunca
`LIKE` dentro de `busca`. Jogar 14 dígitos numa coluna de `LIKE '%...%'` faria
`'1122'` casar com pedaço de CNPJ de empresa nenhuma a ver — e casaria de forma
diferente conforme o nome fantasia da vizinha, o que é pior que não achar.

Está escrito porque alguém vai querer "simplificar" jogando tudo na mesma
coluna.

### Nenhum índice sobre `busca`, ainda

Índice btree **não serve** para `LIKE '%texto%'` — só `pg_trgm` GIN serve. Com
milhares de linhas, a varredura sequencial de uma coluna **já calculada e
gravada** é barata; a coluna gerada `STORED` é o que remove o custo real, que
seria chamar a função por linha em toda busca.

**Gatilho de medição** (R-016 e R-017): consulta acima de **300 ms medidos no
banco por `EXPLAIN ANALYZE`** — não na requisição inteira, que responderia outra
pergunta — **ou** `empresa` acima de **20 mil linhas**, o que vier primeiro.

## Políticas e privilégios

```sql
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_leitura  ON empresa FOR SELECT USING (eh_gestor());
CREATE POLICY empresa_insercao ON empresa FOR INSERT WITH CHECK (pode_escrever() AND eh_gestor());
GRANT SELECT, INSERT ON empresa TO app_usuario;
```

**Sem `UPDATE` e sem `DELETE`, de propósito.** A decisão "ignora e reporta"
significa que nesta fatia **nada nunca atualiza uma empresa**. Conceder `UPDATE`
seria superfície que nenhuma tela usa, que é a R-014. O `GRANT` chega junto com
a tela de edição, ou não chega.

**`pode_escrever()` na inserção** mantém a regra de senha provisória: quem ainda
não trocou a senha não escreve, nem importando planilha.

**Gestor-só, e isso não é permanente.** Vendedor não lê `empresa` nesta fatia. A
política foi desenhada para **um mundo sem posse** — sem `vendedor_id` não existe
"carteira alheia" para mascarar, e mascarar agora seria cerimônia sem ameaça.
Quem ler esta política depois precisa saber disso: ela **vai ser trocada na
fatia da fila**, junto com `vendedor_id`.

**A lição do `crm-ch`, a uma linha de distância de quando ela for necessária.**
Lá o mascaramento de `contato_nome`, `telefone` e `email` de empresa alheia foi
feito por view, com `SELECT` revogado na tabela. Foi exatamente essa combinação
que forçou `GRANT` por coluna e **deixou o gestor sem conseguir escrever cadastro
nenhum**: a migração `0017` revogou para mascarar, a `0021` concedeu `UPDATE` em
quatro colunas, e a `0025` existe só para reabrir a porta que a mesma tabela
fechou. Separar cadastro de posse em duas tabelas foi decidido na fatia `cep`
para que a fila não precise da mesma solução. Quando o mascaramento voltar à
mesa, esta é a página a reler.

**`USING (eh_gestor())` não é `USING (true)`**, então não entra na lista
`POLITICAS_DE_LEITURA_IRRESTRITA` da fatia `cep` — e é bom conferir que a
invariante concorda, porque uma política nova é exatamente o caso que ela existe
para vigiar.

## A importação

### Por onde entra

Upload de **CSV** numa Server Action, na tela `/empresas/importar`. Nunca xlsx
como entrada: ler xlsx exige dependência com histórico de CVE, e "Salvar como
CSV" no Excel são dois cliques.

**Limite de tamanho.** Medido na documentação do Next 16.3.4
(`01-app/02-guides/server-actions.md:83`): Server Action tem corpo limitado a
**1 MB por padrão**, configurável em `serverActions.bodySizeLimit`. As sete
colunas dão cerca de 150 bytes por linha, então 2.000 empresas são ~300 KB.

Mesmo cabendo, o limite do transporte não pode ser o limite de verdade: acima
dele a requisição morre **antes do nosso código rodar**, e a mensagem que sobra
não é nossa. Então `bodySizeLimit: '2mb'` no `next.config`, e o limite real vira
**5.000 linhas, conferido na fase 1** — cerca de 750 KB, com folga de mais de
duas vezes para baixo do transporte. Quem recusa é sempre o nosso relatório, em
português.

### Por que não é um script de operação

Um script no molde de `db:cep:carregar` encolheria muito a fatia — nenhuma tela,
nenhum componente. Foi recusado: ele escreve com `DATABASE_URL_ADMIN`, o que
**passa por fora da RLS e deixa `criado_por` nulo**. A auditoria de quem
cadastrou a empresa ficaria vazia justamente na única porta de entrada. Foi
aceitável em `cep` porque `cep` é dado de referência, sem dono. `empresa` tem
dono, e o `CLAUDE.md` diz que a autoridade é do banco.

### As três fases

**Fase 0 — bytes.** Tira BOM, exige UTF-8 válido, fareja o separador (`,` ou
`;`) pela linha de cabeçalho, exige o cabeçalho exato do modelo.

**Fase 1 — pura, sem banco e sem rede.** `normalizarCnpj`, `validarCnpj`,
`normalizarTelefone`, `normalizarCep`, contagem de linhas, duplicatas internas.
Devolve aceitas e recusadas, cada recusa com número da linha e motivo. Sendo
pura, tem teste de unidade barato e recusa `"CNPJ: consultar"` numa célula sem
precisar de conexão.

**Fase 2 — leitura, dentro de `comoUsuario`.** `resolverCeps` em lote — uma ida
ao banco com `= ANY`, que é o contrato que a fatia `cep` entregou justamente
para isto — e consulta dos CNPJs já cadastrados. **Nada é escrito.**

### A conferência, e por que não há estado no servidor

A tela mostra o relatório: *"1.980 novas · 12 já cadastradas · 8 recusadas · 42
CEPs não encontrados (base de julho/2024)"*, com as recusadas listadas.

Confirmar **reenvia o mesmo arquivo** e refaz as três fases. Não há estado
guardado entre a conferência e a gravação: nenhuma tabela temporária, nenhuma
sessão a expirar, nada a limpar. As fases são determinísticas, então o segundo
passe dá o mesmo resultado — e se alguém importar no meio-tempo, o relatório
muda e você vê antes de confirmar.

O custo é que a página de importação é **uma página em dois estados**, não duas
páginas: navegar para longe perde o arquivo escolhido.

**Gravação:** uma transação, um `INSERT` das aceitas. Recusadas ficam de fora;
já cadastradas são puladas.

### Reimportação: ignora e reporta

CNPJ do arquivo que já existe no banco **não é atualizado**. Sai no relatório
como "já cadastrada".

Nunca destruir vale mais que consertar em lote agora, e a planilha é do próprio
gestor — ela vai ser reimportada inteira várias vezes. Uma atualização em massa
a partir de um arquivo desatualizado reverteria correções em silêncio.

**Dívida registrada, com gatilho:** quando for preciso corrigir dado de empresa
já cadastrada, ou chega a tela de edição, ou a importação passa a atualizar
mostrando as diferenças antes de gravar. O que vier primeiro. Tipo: **proxy de
dor, erra para tarde** — que é o padrão aceito da dívida técnica (R-016).

### Duplicata dentro do próprio arquivo

O mesmo CNPJ em duas linhas **recusa as duas**. Escolher uma seria chutar qual
está certa, e o chute ficaria gravado como identidade.

O relatório diz **se as linhas são idênticas ou se divergem, e em qual coluna**:
*"linhas 41 e 902: mesmo CNPJ, telefone diferente"*. Duplicata idêntica é copiar
e colar sem querer, e dá para apagar uma sem pensar. Duplicata divergente exige
alguém decidir qual está certa — e sem essa informação o gestor apaga a errada
sem saber que estava escolhendo.

## O leitor de CSV

**Escrito aqui, com teste. Não existe leitor de CSV nativo no Node** — `node:csv`
não existe, e a alternativa seria uma dependência de runtime num projeto que hoje
tem quatro.

Cobre: aspas, separador dentro de aspas, aspas escapadas (`""`), CRLF e LF, BOM,
separador `,` ou `;`.

**O que ele não faz, e o teste que prova:** quebra de linha dentro de campo entre
aspas **não é aceita**. Recusa com mensagem que diz onde — *"aspas não fechadas
na linha 41"* — em vez de ler errado em silêncio. Para estas sete colunas, razão
social com quebra de linha no meio não é dado legítimo, é planilha estragada.

**Limite declarado vale mais que limite implícito**, e esta fatia é a terceira a
escrever a mesma frase: a lista `POLITICAS_DE_LEITURA_IRRESTRITA` que só pega
`true` literal, a busca por `prosrc` que só pega texto, e agora este leitor. As
três são catraca contra descuido e cópia, não contra quem quer burlar. Escrever
o limite é o que impede a catraca de parecer mais forte do que é.

## O arquivo-modelo, e a armadilha do Excel

**O Excel destrói coluna numérica ao abrir CSV**, e destrói exatamente as três
colunas que a fase 1 valida com mais rigor: `01310100` vira `1310100`, o zero à
esquerda some; o CNPJ de 14 dígitos vira `1,23457E+13`, e aí os dígitos estão
**perdidos de verdade**, não escondidos. Salvar de volta grava o estrago. Não é
caso raro: é o comportamento padrão de duplo-clique num `.csv`.

E, em português, **"Salvar como CSV" grava com `;` e em Windows-1252** — "CSV
UTF-8 (delimitado por vírgulas)" é uma opção diferente no mesmo menu. Escolher a
errada transforma todo acento em lixo.

Duas defesas, e as duas são necessárias:

**O modelo é `.xlsx` com as colunas formatadas como Texto.** Um arquivo pequeno,
feito uma vez e versionado; **nós nunca o lemos**, só servimos para download.
Como as colunas nascem Texto, CNPJ, CEP e telefone sobrevivem à digitação e ao
"Salvar como CSV".

**A fase 1 detecta o estrago mesmo assim**, porque o modelo reduz a chance e não
fecha a porta: alguém vai colar de outra planilha, ou reformatar uma coluna sem
perceber. As mensagens dizem a causa, não só o sintoma:

- *"CNPJ em notação científica na linha 12 — formate a coluna como Texto"*
- *"CEP com 7 dígitos na linha 40 — o zero à esquerda foi comido; formate como Texto"*
- *"Telefone inválido (987654321). Informe DDD + número, com 10 ou 11 dígitos."*
- *"o arquivo não está em UTF-8 — no Excel use Salvar como > CSV UTF-8"*

Mensagem que explica a causa transforma "erro de validação" em conserto de
trinta segundos.

**Correção de 2026-09-09.** Esta lista dizia *"telefone com 9 dígitos — zero à
esquerda comido"*, e o código nunca fez isso: telefone não começa com zero, e
nove dígitos é quase sempre celular sem DDD. A mensagem real diz o que preencher
(*"informe DDD + número"*), que é a causa certa. **Só o CNPJ tem diagnóstico de
notação científica** — telefone e CEP em notação científica caem nas mensagens
genéricas de forma, e isso está registrado na auditoria como buraco conhecido.
Spec que descreve comportamento inexistente é pior que spec omissa: manda
procurar bug onde não há.

**As colunas do modelo**, nesta ordem, e o cabeçalho é conferido literalmente:

```
cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep
```

## As telas

**`/empresas/importar`** — fatia `empresas`. A página em dois estados descrita
acima: escolher o arquivo, ver o relatório, confirmar. Gestor-só. É ela, com o
modelo, que torna a primeira fatia verificável à mão.

**`/empresas`** — fatia `empresas.2`. Listagem com busca e paginação, gestor-só.

**Repositório novo, não cópia do `listar()` de usuários.** O `listar()` existente
traz tudo, sem paginação nem busca, e foi escrito para cinco linhas. A
`divida-tecnica.md:446` liberou copiá-lo nesta fatia, com o argumento de que um
CRM sem nenhum login não tem volume real — mas o gatilho que substituiu o antigo
é **medição**: "mil linhas na tabela da entidade". Uma planilha de milhares
cruza esse gatilho na estreia. Então a paginação entra junto, não como dívida.

**Busca vale mais que paginação sozinha:** com milhares de linhas, ninguém
navega página por página procurando uma empresa. `LEFT JOIN cep` para cidade e
UF, corte no banco e não no Node:

```sql
WHERE (busca LIKE '%' || sem_acento($1) || '%' OR cnpj = $2)
ORDER BY razao_social
LIMIT $3 OFFSET $4
```

## O que fecha da fatia `cep` — fatia `empresas`

As duas heranças são do relatório de importação, então as duas ficam na primeira
fatia.

**`GRANT SELECT ON cep_carga`.** A spec de `cep` deixou a tabela sem `GRANT`
nenhum de propósito, dizendo que o consumidor natural seria o relatório de
importação e que o `GRANT` entraria junto com ele. É esta fatia. Entra com a
política que faltava:

```sql
CREATE POLICY cep_carga_leitura ON cep_carga FOR SELECT USING (eh_gestor());
GRANT SELECT ON cep_carga TO app_usuario;
```

É de lá que sai a linha "base de julho/2024" no relatório — que é o que torna
"42 CEPs não encontrados" uma informação em vez de um susto.

**O X do gatilho de defasagem.** A spec de `cep` deixou em aberto: "quando mais
de X% das empresas importadas cair em não encontrado, comprar base com data".
Fica **8% dos CEPs distintos de uma importação real**. É medição, não proxy —
conta a coisa com que nos importamos. A base tem 26 meses de defasagem e nasceu
assim; 8% é a fronteira entre "loteamento novo, era esperado" e "esta base não
serve mais para esta carteira".

## Testes

TDD, vermelho primeiro em cada um.

**Unidade, sem banco:**

- `normalizarCnpj`: com máscara, com espaço, minúscula virando maiúscula, com 13
  e com 15 caracteres, vazio.
- `validarCnpj`: numérico válido, numérico com um dígito trocado, alfanumérico
  válido, alfanumérico com DV errado, e o caso de resto menor que 2.
- `normalizarTelefone`: com máscara, com espaço, 10 e 11 dígitos, 9 dígitos.
- Leitor de CSV: aspas, separador dentro de aspas, `""` escapado, CRLF, BOM,
  separador `;`, **e a recusa de aspas não fechadas com a linha na mensagem**.
- Diagnósticos: notação científica **no CNPJ**, CEP de 7 dígitos, e bytes que
  não são UTF-8.
- Duplicata interna: idêntica e divergente, com o campo divergente nomeado.
- Limite de 5.000 linhas.

**Integração, fatia `empresas`:**

- A `0014` aplica e as invariantes passam.
- Controle negativo: `app_conexao` fora de `comoUsuario` lendo `empresa` → `42501`.
- Vendedor ativo lendo `empresa` → nenhuma linha (política gestor-só).
- Gestor com senha provisória pendente tentando inserir → recusado por
  `pode_escrever()`.
- `UPDATE` e `DELETE` em `empresa` por `app_usuario` → `42501` nos dois.
- Importação ponta a ponta com um CSV de fixture: novas, já cadastradas,
  recusadas e CEP não encontrado no mesmo arquivo.
- `cep_carga` legível pelo gestor e ilegível pelo vendedor.

**Integração, fatia `empresas.2`:**

- A `0015` aplica e as invariantes passam — incluindo a de PUBLIC, que só passa
  se os `REVOKE` estiverem lá, cobrindo as cinco funções.
- `busca` calculada pelo banco: inserir "Iluminação São João", achar por "sao
  joao".
- Busca por CNPJ é exata: `'1122'` não acha empresa cujo CNPJ contém `1122`.
- Paginação: segunda página não repete nem pula linha da primeira.

**Verificação manual**, registrada em `divida-tecnica.md` no formato das fatias
0b, 0c e `cep` — não há teste de render.

Na `empresas`, e é o motivo do corte: **baixar o modelo, preencher no Excel,
salvar como CSV e importar**, incluindo de propósito uma rodada salva errado
(ANSI, ou separador `;`, ou coluna reformatada como número) para conferir que a
mensagem de diagnóstico aparece e explica a causa. Na `empresas.1`: a listagem,
a busca com e sem acento, e a paginação.

## Dívida e gatilhos que esta fatia cria

| Item | Fatia | Gatilho | Tipo | Erra para |
|---|---|---|---|---|
| Sem tela de edição de empresa | `empresas` | precisar corrigir dado já cadastrado | proxy de dor | tarde |
| Base de CEP defasada | `empresas` | 8% dos CEPs distintos não encontrados | medição | — |
| `empresas_no_endereco` ausente | `empresas` | a base voltar a vir da Receita | evento observável | — |
| Empresa cadastrada só visível por `psql` | `empresas` | a própria `empresas.1` | evento observável | — |
| Reescrita da `0015` vira janela de manutenção | `empresas` | `empresa` acima de 500 mil linhas quando a `0015` for aplicada | medição | — |
| Sem índice GIN em `busca` | `empresas.1` | 300 ms por `EXPLAIN ANALYZE`, ou 20 mil linhas | medição | — |
| `sem_acento` `IMMUTABLE` pode mentir | `empresas.1` | troca de versão maior do Postgres | evento observável | — |

A quarta linha é dívida de propósito e de vida curta: entre uma fatia e outra, o
que foi importado não tem tela. O gatilho é a fatia seguinte, então ela se cobra
sozinha.

## O que a fatia fecha nos documentos

Parte do trabalho, não extra:

- `docs/db/0014.md` e, na fatia seguinte, `docs/db/0015.md`, com o porquê de cada
  migração; os `.sql` só apontam para lá.
- `docs/db/fundacao.md` na `empresas.1` passa a descrever o schema `extensoes` e
  a primeira função não-definidora concedida a `app_usuario`.
- `docs/db/divida-tecnica.md` recebe os gatilhos da tabela acima e a verificação
  manual, cada um na fatia que o cria.
- `REGRAS.md` só ganha regra se houver tropeço real durante a execução.

## O que a `empresas.1` corrigiu

Três achados da auditoria, todos de erro que chega ao gestor. Sem migração.

**Numeração de linha.** `lerCsv` passou a devolver `{ numero, campos }`, com o
número **do arquivo**. Antes, linha em branco no meio saía da lista e deslocava
todas as seguintes: uma recusa da linha 4 era reportada como linha 3, e a
mensagem parecia autoritativa. Era o pior dos três, porque mandava corrigir a
linha errada — e seria herdado por qualquer relatório futuro que apontasse para
o arquivo.

**Simetria de colunas.** `campos.length !== COLUNAS.length`, no lugar de `<`.
Faltar coluna sempre recusou; sobrar entrava em silêncio, com o excedente
descartado. Linha com contagem diferente está desalinhada, e ler os sete
primeiros campos de uma linha desalinhada grava dado trocado de coluna.

> **Mudança de comportamento observável:** linha terminada em separador —
> `...,01310100,` — produz um oitavo campo vazio e **passa a ser recusada**.
> Antes entrava. É decisão, não efeito colateral: o Excel não grava separador
> sobrando, então a linha veio de edição manual ou de outra ferramenta, e nos
> dois casos o alinhamento é suspeito. Se aparecer num arquivo real, a causa
> está aqui.

**`23505` e `22021` traduzidos.** Os dois viravam 500 em vez de mensagem. A
corrida entre duas abas é cenário real mesmo com um gestor só: o CNPJ não
existia quando ele conferiu. `23505` vira `cnpj_ja_gravado`, a transação inteira
desfaz e o contrato de tudo-ou-nada continua valendo — `ON CONFLICT DO NOTHING`
foi recusado justamente por criar sucesso parcial, que é um estado novo na tela
e uma invariante a menos.

O **byte NUL** é pego na **fase 1**, não traduzido do banco: `U+0000` é UTF-8
válido e só o Postgres recusa. Pego na fase 1, o gestor recebe a linha e a
coluna; traduzido, receberia mensagem sem localização nenhuma. `22021` continua
traduzido como rede, com texto vago de propósito.

## O que a fatia da fila herda

- `empresa` existe e é permanente; a fila é outra tabela, com um dono de escrita
  só.
- A política `empresa_leitura` é gestor-só **porque não há posse** — trocá-la é
  trabalho previsto, não conserto.
- O mascaramento de contato, se voltar, não deve repetir view + `SELECT`
  revogado + `GRANT` por coluna. A seção "Políticas e privilégios" tem o
  histórico.
- `GRANT UPDATE` em `empresa` ainda não existe. Quem precisar, traz.
