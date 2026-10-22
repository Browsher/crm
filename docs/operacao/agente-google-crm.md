# Agente Google com planejamento no CRM

## O que muda

O vendedor planeja nicho e região por dia em `/fila/buscar?fonte=google`.
Há cinco dias por semana, sem copiar critérios da semana anterior. Os
pedidos do dia são congelados quando a rotina começa, a partir das 9h de
São Paulo. Dias sem pedido não recebem coleta. A interface não inicia uma
pesquisa instantânea. `/fila/google` e `/fila/google/[id]` mostram as entregas.

O gestor acompanha todos em `/empresas/google`, com filtros por semana,
vendedor e situação. O detalhe conserva ocorrências indisponíveis,
incompletas e conflitantes. A ficha central reúne as coletas de cada empresa
e quem solicitou. Utilização é atendimento registrado pelo destinatário
depois da entrega, sem contar abertura, contato anterior ou de outro usuário.

A empresa pertence à base central. A primeira entrega cria exclusividade
permanente de distribuição, separada da carteira e da reserva temporária.
Outros vendedores não recebem nem reservam essa empresa, inclusive por
lista antiga ou alvo direto. O gestor vê as ocorrências de todos. Virar a
semana, expirar reserva ou desativar o vendedor não transfere seus leads.

## Preparar a ativação

Esta entrega mantém a rotina operacional pausada. Não aplica migrações em
produção, não altera a planilha, não chama o motor real e não consome créditos.
Antes de ativar, publicar a versão revisada, aplicar a migração 0040 pelo
procedimento de banco existente e configurar no servidor:

- `GOOGLE_AGENTE_TOKEN`: segredo aleatório de pelo menos 32 caracteres;
- `GOOGLE_AGENTE_USUARIO_ID`: UUID de um gestor ativo, com senha definitiva;
- no executor local, o mesmo segredo e `GOOGLE_CRM_URL`, origem HTTPS do CRM.

Nenhuma dessas variáveis tem prefixo `NEXT_PUBLIC_`. O token não vai em URL,
argumento de processo, log, arquivo versionado ou navegador. A API também
verifica o papel vigente do gestor no banco. Revogação do acesso impede
novos comandos mesmo que o token continue configurado.

Conferir os lotes pendentes do agente antigo antes da transição. Atualizar o
texto da automação existente para usar este contrato e os pedidos do CRM;
manter seu horário de segunda a sexta às 9h, sem criar outro agendamento.
Os comandos abaixo são operacionais, não são executados pelo aplicativo.

## Execução diária, um pedido por vez

Executar do checkout revisado do CRM. Usar uma pasta privada e estável para
os recibos do cliente, fora de arquivos versionados. A pasta padrão
`.google-agente` está ignorada pelo Git.

```powershell
npx tsx scripts/google/agente.mts proximo --pasta .google-agente
```

O cliente salva `<pedido-uuid>.json` com a identidade e o snapshot do pedido.
O servidor escolhe vendedor e data; o executor não envia um destinatário.
Pedido nulo significa que não há trabalho elegível. `coletando`, `validando`
ou `falhou` pendente sempre retornam o mesmo pedido antes de avançar.

Se estiver em `coletando`, usar a ponte para o coletor já instalado:

```powershell
python scripts/google/coletar.py coletar --pedido .google-agente/<pedido-uuid>.json --campanha "C:\Users\ADM\Desktop\Web Scraping\armarinhos"
```

A ponte conserva o serviço 8087, a configuração do motor, o exportador, a
extração de emails publicados e o enriquecimento social desligado. Usa o
mesmo lock da campanha antiga e pasta `coletas/crm/<pedido-uuid>`, com job,
consulta e histórico próprios. Nicho, bairro, cidade e UF são valores
literais de uma consulta; não viram comandos nem recebem o filtro comercial
fixo de armarinhos. Bairro vazio significa cidade inteira.

A ponte grava `contexto-operacional.json` na pasta do pedido. Para um pedido
antigo que ainda não tenha esse arquivo, gerá-lo sem iniciar coleta:

```powershell
python scripts/google/coletar.py contexto --pedido .google-agente/<pedido-uuid>.json --saida <pasta-do-pedido>/contexto-operacional.json
```

Usar o campo `bairro` desse contexto no argumento de `arquivo_drive.py`, no
manifesto `CRM_DRIVE_V1` e no campo `bairro` da publicação conferida entregue a
`disparar_workflow.py`. Ele contém o bairro solicitado ou a indicação literal
`Cidade inteira`, aceita pelos helpers existentes. Cidade e UF também vêm
desse contexto. `criterios.bairro` conserva o valor original vazio; essa
indicação operacional nunca entra na consulta do motor, nos endereços das
empresas ou como preenchimento das células de bairro dos leads. O mesmo
contexto acompanha arquivo original e final e permite conferir o pedido por
UUID. Não fabricar um nome de bairro para passar pela validação.

Não descartar um endereço real por cair fora do bairro pesquisado, não
inferir endereço/DDD e não repetir a pesquisa para atingir 50. Reutilizar o
job e os arquivos existentes em uma retomada. Se houver `intencao.json` sem
`job.json`, a criação do job pode ter ocorrido sem resposta: reconciliar no
motor, conferir nome `crm-<pedido-uuid>` e os critérios antes de vincular seu
ID. Não remover a intenção para criar outro job por tentativa.

## Arquivo, planilha e validação existentes

Após a coleta, seguir o procedimento já configurado do agente:

1. Arquivar os CSVs no Drive com `arquivo_drive.py`, preservando dados,
   identificadores textuais, BOM/CRLF e recibos. Manter também o download
   completo do motor. Não alterar arquivos ou compartilhamento de terceiros.
2. Usar até 50 selecionadas de `empresas_novas.csv` na publicação de origem.
   Preservar todas as ocorrências de `dados_preparados.json` para auditoria,
   inclusive fechadas, repetidas e sem telefone. Não validar milhares de
   registros para ampliar a entrega diária.
3. Usar a planilha antiga somente como transporte serial da validação,
   preservando as nove colunas, o lote e o manifesto `CRM_DRIVE_V1`.
   Conferir valores/retorno e não substituir uma publicação pendente.
4. Guardar o vínculo entre `<pedido-uuid>`, lote do workflow, arquivo original
   e seus hashes na pasta desse pedido. Os critérios vêm do CRM; a aba antiga
   de planejamento não é uma segunda fila de pedidos novos.
5. Marcar a etapa no CRM e chamar somente o cliente existente
   `disparar_workflow.py`, com o arquivo de publicação conferido e a
   configuração privada já utilizada. Não chamar Evolution ou o webhook
   paralelamente, nem clicar no editor para repetir o workflow.
6. Esperar a confirmação dos resultados, do Backup telefones cumulativo e do
   arquivo final no Drive. Conferir lote, contagens e hashes. Timeout exige
   reconciliação do mesmo lote, não outra chamada cega.

```powershell
npx tsx scripts/google/agente.mts etapa --pedido <pedido-uuid> --estado validando --pasta .google-agente
```

O recibo para o CRM é produzido pelo executor **após** essa conferência. Deve
conter `pedido_id`, `origem_sha256`, `final_sha256`, `arquivo_original_id`,
`arquivo_final_id` e `validacao_conferida: true`. Guardar também o ID do lote
conferido. Não marcar validação por inferência ou editar um recibo antigo
para fazê-lo parecer de outro pedido. A API confia nesse executor autorizado;
os navegadores dos vendedores não podem publicar resultados.

## Preparar e confirmar a entrega

```powershell
python scripts/google/coletar.py preparar --pedido .google-agente/<pedido-uuid>.json --coletadas <pasta-do-pedido>/dados_preparados.json --original <csv-original-conferido> --final <csv-final-validado> --recibo <recibo-conferido.json> --saida <pasta-do-pedido>/publicacao-crm.json
npx tsx scripts/google/agente.mts entregar --publicacao <pasta-do-pedido>/publicacao-crm.json --original <csv-original-conferido> --final <csv-final-validado> --pasta .google-agente
```

A preparação confere hashes e cruza Place ID e telefone com o arquivo final.
Sem correspondência, o resultado continua pendente. Não acrescenta DDD nem
o nono dígito. O servidor reaproveita o cadastro central por CNPJ/Place ID,
preservando dados manuais e vínculos. Identificadores conflitantes vão para
conferência, sem fundir empresas. Até 50 leads são entregues; excedentes
ficam na auditoria. Capacidade de auditoria por pedido: 5.000 ocorrências e
8 MB de JSONB, com limite de 9 MB no corpo HTTP. Excesso mantém o lote para
conferência, sem truncamento silencioso.

O cliente salva `publicacao-pendente.json` **antes** do POST. Se o retorno for
incerto, o arquivo bloqueia pedir outro lote. Reenviar exatamente a mesma
publicação e recibo reconcilia o resultado: `repetida` significa que a entrega
já estava confirmada; divergência é recusada. `vendedor_inativo` conserva
resultados para o gestor e não libera leads. Só depois de confirmação local
pedir o próximo trabalho. O fluxo não envia mensagens nem registra vendas.

Se houver falha que exija conferência, registrar um motivo curto sem
credenciais com `etapa --estado falhou --motivo <texto>`. Retomar explicitamente
a etapa correspondente depois de reconciliar. Um lock local remanescente de
interrupção só pode ser removido após conferir que seu processo terminou.

## Validação local

O harness prepara usuários e empresas fictícios, um agente autenticado de
teste e resultados com recibos simulados. A jornada cobre planejamento,
publicação idempotente, isolamento, reserva e auditoria do gestor. A ponte
Python é exercitada somente com arquivos temporários, sem iniciar o motor.
As regras também são verificadas em PostgreSQL descartável, com RLS real.

As listas compartilhadas anteriores continuam disponíveis no catálogo,
identificadas separadamente das novas entregas pessoais. O CNPJ.biz conserva
sua quota, chave exclusivamente no servidor e controle de repetição por UUID.
