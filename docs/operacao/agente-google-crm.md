# Agente Google com planejamento no CRM

## O que muda

O vendedor planeja nicho, região e critérios opcionais em `/fila/google`.
A primeira visualização é sempre a semana corrente, de segunda a sexta,
com Hoje destacado. Hoje e dias anteriores não podem ser editados. É
possível salvar dias vazios: ficam Não definido e não geram coleta. Um dia
configurado exige nicho, cidade e UF; bairro vazio cobre a cidade inteira.
O espelhamento copia separadamente nicho, critérios e região de qualquer
dia salvo no histórico, para datas futuras da semana exibida ou seguinte.

A rotina existente deve rodar de segunda a sexta às **17h de São Paulo**.
De segunda a quinta prepara o dia seguinte; na sexta prepara a segunda.
Não cria novas rotinas no sábado ou domingo. Uma fila já iniciada pode
terminar depois. O snapshot da execução congela revisão, nicho, região e
critérios. Editar um dia futuro depois desse início salva uma nova revisão,
sem mudar o que já está em execução nem abrir outra execução para a data.
Sem revisão sincronizada com a planilha, a coleta fica pendente. A interface
não dispara pesquisas instantâneas. As entregas ficam em
`/fila/google?aba=entregas` e `/fila/google/[id]`.

Todo vendedor novo recebe automaticamente seu agente lógico, planejamento
vazio e critérios neutros. Não herda empresas nem precisa de outra planilha,
workflow ou agendamento. Deve configurar seus dias antes da primeira busca.

O gestor acompanha todos em `/empresas/google`, com filtros por semana,
vendedor e situação. O detalhe conserva ocorrências indisponíveis,
incompletas e conflitantes. A ficha central reúne as coletas de cada empresa
e quem solicitou. Utilização é atendimento registrado pelo destinatário
depois da entrega, sem contar abertura, contato anterior ou de outro usuário.

Cada vendedor tem seu agente e estado próprios no CRM. Os gestores
compartilham a equipe e a planilha, sem agentes ou planilhas por gestor.
**Pausar novas buscas** impede iniciar outros pedidos; uma execução iniciada
pode concluir e entregar se o vendedor continuar elegível. Ao retomar,
pedidos vencidos que não começaram ficam no histórico como não executados.
O coordenador usa a rotina existente e atende os agentes em fila, sem criar
um novo agendamento por vendedor.

A empresa pertence à base central. A primeira entrega cria exclusividade
permanente de distribuição, separada da carteira e da reserva temporária.
Outros vendedores não recebem nem reservam essa empresa, inclusive por
lista antiga ou alvo direto. O gestor vê as ocorrências de todos. Virar a
semana, expirar reserva ou desativar o vendedor não transfere suas empresas.
Grupos novos são privados por vendedor e reúnem o mesmo nicho e região
pesquisada (bairro, cidade e UF), sem a data na identidade. A execução usa
o snapshot congelado para escolher o grupo. Novas semanas acrescentam
empresas, preservando o nome e a situação do grupo já existente. Listas
compartilhadas anteriores conservam seu comportamento.

## Critérios e limite da entrega V2

Cada vendedor/data recebe até **50 empresas confirmadas**, com no máximo
**3 lotes de 50 candidatas**, total de até **150 empresas distintas
analisadas**. Consultar primeiro o pool já coletado, sem gastar outro job
quando ainda houver candidatas novas. Só então fazer coleta complementar,
mantendo nicho, região e critérios congelados. Encerrar ao atingir 50,
esgotar 3 lotes/150 candidatas ou não encontrar novidades. Não há paginação
inventada nem ampliação da região para completar a meta.

Sem critérios extras, ou somente com termos adicionais, a entrega é direta:
não chama n8n, não exige WhatsApp, telefone, email, site ou endereço. As
regras de identidade, exclusividade e duplicidade continuam obrigatórias.
Os dados incompletos permanecem honestos: ausência de telefone não vira
um número fictício nem impede o registro da empresa.

Um único workflow n8n atende todos os vendedores e executa só as etapas
necessárias: dados do Google, presença digital, perfil comercial, WhatsApp
e formato de telefone fixo. Campos diferentes combinam com E; alternativas
do mesmo campo com OU. WhatsApp e fixo marcados aceitam qualquer um dos
dois. Com e Sem marcados juntos neutralizam o filtro. Preferências apenas
ordenam, sem excluir. Email, site e perfil precisam de evidência da fonte;
falha de acesso não comprova ausência. Resultado não confirmado fica no
histórico do gestor. Falha sistêmica mantém o lote pendente para reconciliação.
Fixo confere formato sem WhatsApp, sem afirmar que a linha está ativa.

O gestor vê rodadas, critérios efetivamente usados, evidências, motivos de
recusa e destinatário. Candidatas brutas e recibos são restritos ao gestor;
o vendedor vê apenas as empresas entregues e canais conferidos.

## Preparar a ativação

A sincronização de planejamento está publicada e validada, conforme registro
abaixo. A coleta automática foi ativada após o piloto real, conforme registro
final. O aplicativo não provisiona
abas nem aplica migrações automaticamente; essas operações são separadas.
A ativação da coleta exige versão revisada, migrações 0040–0042 aplicadas e
as configurações de servidor e executor listadas a seguir:

- `GOOGLE_AGENTE_TOKEN`: segredo aleatório de pelo menos 32 caracteres;
- `GOOGLE_AGENTE_USUARIO_ID`: UUID de um gestor ativo, com senha definitiva;
- no executor local, o mesmo segredo e `GOOGLE_CRM_URL`, origem HTTPS do CRM.
- `GOOGLE_PLANILHA_ID`: ID do mesmo arquivo compartilhado;
- `GOOGLE_PLANILHA_ABA_ID`: ID numérico da aba **Planejamento CRM**;
- para reutilizar a conexão Google já existente no n8n:
  `GOOGLE_PLANILHA_N8N_URL` e `GOOGLE_PLANILHA_N8N_TOKEN`;
- como alternativa de transporte direto, `GOOGLE_PLANILHA_CLIENT_EMAIL` e
  `GOOGLE_PLANILHA_PRIVATE_KEY`: conta de serviço dedicada, RSA de pelo
  menos 2048 bits. Não são necessárias no transporte n8n.

No transporte n8n, a autorização Google permanece na credencial OAuth2
selecionada dentro do workflow. O CRM usa um token Header Auth próprio para
pedir a sincronização, sem receber tokens Google. A chave administrativa
`N8N_API_KEY` serve somente para preparar a instalação e não é usada pelo CRM.
Configuração n8n incompleta mantém a sincronização pendente, sem trocar
silenciosamente de transporte.

No transporte direto, habilitar Sheets e conceder à conta de serviço acesso
ao arquivo necessário. A conexão Google deste chat não é uma credencial do
servidor. O código não cria contas, chaves, permissões ou abas automaticamente.

Provisionar **Planejamento CRM** no mesmo arquivo, preservando a aba antiga
e o restante do workbook. A1:N1 precisa ter exatamente estes cabeçalhos:

```text
Pedido ID | Revisão | Vendedor ID | Vendedor | Data | Dia da semana | Nicho | Bairro | Cidade | UF | Situação | Atualizado em | Versão | Critérios de busca
```

### Aba preparada em 25/10/2026

A aba **Planejamento CRM** foi criada no arquivo existente
[PLANILHA BASE CRM Prospecção](https://docs.google.com/spreadsheets/d/17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU/edit#gid=10151006),
com os IDs que deverão ser configurados no servidor:

```text
GOOGLE_PLANILHA_ID=17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU
GOOGLE_PLANILHA_ABA_ID=10151006
```

A grade inicial tem 1.000 linhas e 14 colunas, cabeçalho congelado e células
como texto. A1:N1 foi conferido por leitura e coincide com o contrato acima.
Nenhum pedido foi inserido: os registros virão do CRM, com uma linha fixa por
pedido de vendedor/data. As oito abas anteriores foram mantidas; os cabeçalhos
da coleta, validação e exportação e o início do planejamento antigo foram
conferidos antes e depois, sem alteração.

A estrutura passou por revisão independente de compatibilidade com o cliente
existente. Na preparação inicial da aba, foram conferidos os valores, formatos
e propriedades devolvidos pela API; não houve alteração de permissões,
workflows ou agendamentos. A conexão posterior pelo n8n usa a autorização
Google existente, conforme registrado abaixo, e dispensa conta de serviço
adicional.

Preparar a aba antes de configurar o workflow mantém os identificadores e o
contrato definidos. A planilha continua sendo um espelho do CRM; o workflow
recebe o pedido e os critérios congelados pelo executor e não transforma
edições manuais da planilha em comandos.

### Conexão n8n conferida em 25/10/2026

O workflow preparado tem ID `gITBY7vBYNfgUWMp` e nome
**CRM · Prospecção e planejamento**, na instalação
`https://primary-production-04eb.up.railway.app`. É um único workflow com
duas entradas autenticadas: sincronização de planejamento e verificação
condicional de candidatas. Foi importado com a credencial **Google Sheets
account** existente e autenticação Header Auth própria, sem exportar tokens
Google ou modificar o workflow legado.

A primeira conferência identificou que a autorização Google precisava ser
reconectada. Depois da reconexão feita pelo usuário, uma chamada real do
tipo `conferir` leu metadados e A1:N1: destino e 14 cabeçalhos corretos.
Sem autenticação, o webhook respondeu 403. Nenhuma célula foi escrita,
nenhum pedido fictício foi inserido e nenhuma coleta ou mensagem foi iniciada.
O workflow foi desativado ao terminar a conferência; o legado permaneceu
preservado.

A revisão independente identificou que uma fórmula pode devolver texto vazio
ou um valor igual ao esperado. O ramo n8n passou a conferir `userEnteredValue`
antes e depois da gravação, recusando fórmulas e preservando textos literais
que começam com `=`. Essa leitura de grade também foi conferida na aba real
(A2:N2), sem escrita; os nós temporários de diagnóstico foram removidos e a
cópia final permaneceu inativa, com 32 nós.

Os parâmetros privados locais permanecem em
`.env.n8n-planilha.local`, ignorado pelo Git e sem carregamento automático.
Em 25/10/2026, os quatro parâmetros do transporte n8n e
`GOOGLE_AGENTE_USUARIO_ID` foram cadastrados como variáveis sensíveis
somente em Production no projeto Vercel `crm-prospeccao`. A identidade
operacional usa o único gestor ativo com senha definitiva existente.
Os metadados confirmaram tipo e escopo; são 13 variáveis, com as oito
anteriores preservadas e Preview sem variáveis.

O banco foi atualizado pelo runner separado após backup conferido:
45 migrações aplicadas, sem pendências/divergências e invariantes aprovadas.
O deployment `dpl_5nqm29e4oSrmLJM33eXe5Jk761r1`, fonte `e42adfa` com
CI #153 aprovado, foi promovido ao endereço estável do CRM. O workflow
está ativo para webhooks autenticados, sem agendamento de coleta.

Uma sessão real de vendedor salvou um dia futuro de teste com cidade
inteira e critério de e-mail. A revisão/versão confirmada no banco coincidiu
com a intenção e os 14 valores lidos diretamente na linha 2 do Google Sheets,
com envio liberado e erro nulo. O teste voltou a **Não definido**, com
critérios neutros e revisão/versão 3 na mesma linha. Nenhuma coleta foi
iniciada. Escrita real e atualização sem duplicação estão validadas.

A conexão básica das verificações foi homologada em 25/10, incluindo
WhatsApp. A qualificação de perfil continua pendente conforme descrito abaixo. O estado operacional e a
conferência de preservação estão em [Produção Vercel](producao-vercel.md).

O ramo de sincronização só aceita o destino fixo da aba preparada. Confere
cabeçalho, linha vazia ou intenção conhecida, escreve RAW na posição alocada
e relê A:N, inclusive ao reconciliar uma intenção legada de 13 colunas.
O recibo devolve pedido, envio, revisão, versão, destino, linha e células.
Qualquer retorno incerto conserva o bloqueio no banco, sem novo POST automático.
Tokens e payloads não são guardados nos dados das execuções do workflow.

### Conferência e sincronização

O servidor confere arquivo, ID/título da aba, cabeçalho e conteúdo antes de
gravar. N contém o JSON canônico dos critérios, na mesma revisão da linha.
Intenções legadas de 13 colunas já persistidas conservam seu contrato até
serem reconciliadas; não criar novas intenções sem N. Escreve como texto
RAW, inclusive nichos que começam com `=`. O bairro
vazio permanece vazio no espelho; a indicação operacional de cidade inteira
continua separada. Cada pedido tem linha alocada no banco e suas intenções
de escrita guardadas antes do HTTP. Resposta HTTP concluída, mas sem confirmação,
permite conferir a mesma linha, sem append. Linhas desconhecidas ou editadas manualmente ficam
para conferência. A aba é administrada pelo CRM; evitar edições estruturais
ou manuais concorrentes nela. Não há sincronização de volta das células para
alterar pedidos do CRM.

Perda de transporte ou queda do processo após a reserva do envio conserva
um bloqueio durável por pedido. A operação pode ainda terminar no Google;
uma leitura dos valores, sozinha, não comprova seu encerramento. Novas edições
continuam salvas no CRM, mas não são enviadas nem confirmadas enquanto houver
esse envio pendente. O botão de nova conferência não remove esse bloqueio.
O operador precisa identificar `envio_id`/`envio_versao` no histórico e obter
evidência de que a requisição anterior terminou antes de liberar o envio
exato por `google_planilha_liberar`, sob identidade de gestor. Sem essa prova,
manter pendente; não apagar a intenção, trocar a linha/destino ou inventar um
prazo de liberação. Depois, conferir novamente os critérios atuais. A expansão
da grade apenas acrescenta linhas; nunca reduz a grade existente.

Salvar confirma primeiro o CRM e tenta sincronizar. A interface diferencia
salvo no CRM, sincronizado e pendente. Sem Google disponível, o pedido e sua
pendência continuam gravados. **Sincronizar novamente** repete a conferência
do mesmo pedido/revisão, sem iniciar coleta. Antes de começar uma busca nova,
o coordenador exige a revisão correta confirmada.

Nenhuma dessas variáveis tem prefixo `NEXT_PUBLIC_`. O token não vai em URL,
argumento de processo, log, arquivo versionado ou navegador. A API também
verifica o papel vigente do gestor no banco. Revogação do acesso impede
novos comandos mesmo que o token continue configurado.

Conferir os lotes pendentes do agente antigo antes da transição. Atualizar o
texto da automação existente para usar este contrato e os pedidos do CRM;
ajustar seu horário para segunda a sexta às 17h, sem criar outro agendamento.
Os comandos abaixo são operacionais, não são executados pelo aplicativo.

O template `workflows/n8n/google/verificar-empresas.json` é único e está
inativo. Antes de ativar, importar e testar na versão instalada do n8n,
configurar Header Auth, `GOOGLE_VERIFICACOES_URL` e
`GOOGLE_VERIFICACOES_TOKEN` no executor. O webhook verifica Authorization
Bearer, sem credenciais exportadas no JSON. Reutiliza Evolution para a
consulta de números, sem enviar mensagens. As etapas de presença/perfil
que não puderem ser resolvidas pelos dados publicados exigem um
qualificador de fontes públicas configurado em `GOOGLE_QUALIFICADOR_URL`
e `GOOGLE_QUALIFICADOR_TOKEN` no n8n. Esse serviço não foi provisionado nesta
entrega. Por decisão do usuário, sem esse serviço cada critério não comprovado
recebe `nao_confirmado`, e as demais verificações básicas continuam. Não
aprovar automaticamente produtos, tipo de empresa ou observações. Site/e-mail
publicados comprovam presença; ausência de valor não comprova ausência.
Entrega direta continua independente. Detalhes do contrato e variáveis:
`workflows/n8n/google/README.md`.

## Executar contratos V2, um pedido e lote por vez

Usar a mesma pasta privada `.google-agente`, ignorada pelo Git. O comando
`proximo` persiste executor e snapshot; repetir reutiliza a execução.
Nunca gerar outra identidade para contornar pendência ou limite.

```powershell
npx tsx scripts/google/agente.mts proximo --pasta .google-agente
python scripts/google/coletar.py coletar --pedido .google-agente/<pedido>.json --campanha "C:\Users\ADM\projetos\05 - IA e automações\Web Scraping\armarinhos" --rodada 1
python scripts/google/rodadas.py selecionar --candidatas <dados_preparados.json> --vistas <identidades-analisadas.json> --restante 150 --saida <lote.json>
npx tsx scripts/google/agente.mts reservar_lote --pedido <pedido> --lote <lote.json> --pasta .google-agente
npx tsx scripts/google/agente.mts verificar --contexto .google-agente/<pedido>.json --lote <lote.json> --saida <verificacoes.json> --pasta .google-agente
```

`vistas` é o conjunto de aliases Place ID/CNPJ dos lotes anteriores da mesma
execução; o servidor também bloqueia repetições e aplica os contadores. O
arquivo de lote preserva seu UUID. `restante` cai conforme o total reservado
no CRM; não é reiniciado por rodada. Antes de outra coleta, consumir o pool
com outro lote, se houver novidades. Rodadas 2 e 3 usam arquivos e jobs
próprios no mesmo contexto; retomada de uma rodada reutiliza seu job.
Intenção sem resposta do motor exige reconciliação, sem outro POST cego.
Conservar a cópia completa do download, os CSVs, contexto e hashes.

`verificar` produz evidências do workflow ou um resultado neutro local sem
HTTP. Arquivar origem e resultado no Drive pelo procedimento já existente,
inclusive no caminho direto. Não usar o disparador legado de WhatsApp para
uma execução V2. Conservar as nove colunas originais do CSV nesta ordem:

```text
telefone,cnpj,razao_social,nome_fantasia,contato_nome,email,cep,cnae_principal,google_place_id
```

Preparar o recibo V2 com `versao:2`, `pedido_id`, `execucao_id`, `lote_id`,
`revisao`, `snapshot_sha256`, `origem_sha256`, `resultado_sha256`,
`arquivo_original_id`, `arquivo_resultado_id`, `verificacoes_requeridas` e
`evidencias`. Os IDs Drive e hashes são conferidos após arquivamento; não
inferir que um arquivo foi publicado só porque existe localmente. Evidências
incluem candidata, critério, opção, estado, motivo, fonte e horário; telefone
aprovado identifica também o contato exato. Entregar o mesmo lote reservado,
incluindo recusadas para auditoria, sem truncar ou trocar candidatas.

```powershell
python scripts/google/coletar.py preparar --pedido .google-agente/<pedido>.json --coletadas <lote.json> --original <origem.csv> --resultado <resultado-conferido.json> --recibo <recibo-v2.json> --saida <publicacao-crm.json>
npx tsx scripts/google/agente.mts entregar --publicacao <publicacao-crm.json> --original <origem.csv> --resultado <resultado-conferido.json> --pasta .google-agente
python scripts/google/rodadas.py decidir --entregues <total-confirmado> --analisadas <total-reservado> --lotes <total-lotes> --novidades <novas-no-pool>
npx tsx scripts/google/agente.mts concluir --pedido <pedido> --motivo <motivo-da-decisao> --pasta .google-agente
```

Se a decisão for `continuar`, reservar/verificar/entregar o próximo lote;
não chamar concluir com esse valor. Motivos finais: `meta_atingida`,
`limite_lotes`, `sem_novidades` ou `sem_resultados`. O CRM valida os limites.
Somente depois da confirmação persistida pedir outro trabalho.

Reserva, entrega e conclusão persistem a intenção antes do HTTP e admitem
reconciliação do mesmo pedido/lote. Uma resposta perdida do workflow
**não** dispara outra verificação: obter o retorno daquela execução e usar
`verificar` com os mesmos argumentos mais `--reconciliar <retorno.json>`.
Os arquivos pendentes bloqueiam o avanço. Nunca apagá-los para tentar de
novo nem fabricar um recibo. Dados manuais, carteira, responsáveis e
reservas existentes permanecem preservados.

## Retomar somente contratos legados em andamento (V1)

O procedimento desta seção é exclusivo das execuções que o CRM devolve
com `contrato:1`. Novos pedidos usam V2. Não converter arquivos pendentes
nem inserir o campo V2 em um recibo antigo. As regras abaixo preservam a
validação antiga até a conclusão daquela execução; não são o padrão novo.

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

Antes do primeiro POST, o cliente persiste `executor.json`. Esse UUID é
enviado em todos os comandos e fica vinculado ao gestor, agente e pedido no
banco. Conservar a pasta e essa identidade nas retomadas; não gerar outro
executor para contornar um bloqueio. Outro processo recebe `ocupado` enquanto
o dono não conclui a publicação. Não há liberação automática por prazo.
Pedido nulo com `sincronizar`/`aviso` indica pendência da planilha, sem licença
para iniciar outro job com aqueles critérios.

Se estiver em `coletando`, usar a ponte para o coletor já instalado:

```powershell
python scripts/google/coletar.py coletar --pedido .google-agente/<pedido-uuid>.json --campanha "C:\Users\ADM\projetos\05 - IA e automações\Web Scraping\armarinhos"
```

A ponte conserva o serviço 8087, a configuração do motor, o exportador, a
extração de emails publicados e o enriquecimento social desligado. Usa o
mesmo lock da campanha antiga e pasta
`coletas/agentes/<vendedor-uuid>/<pedido-uuid>`, com job,
consulta e histórico próprios. Nicho, bairro, cidade e UF são valores
literais de uma consulta; não viram comandos nem recebem o filtro comercial
fixo de armarinhos. Bairro vazio significa cidade inteira.

Se a pasta legada `coletas/crm/<pedido-uuid>` já existir, a ponte a reutiliza
para não perder uma execução em andamento. Os IDs de vendedor e pedido são
validados antes de compor caminhos. Nenhum critério vira nome de pasta.
Na retomada, IDs, data, critérios e snapshot precisam coincidir. A introdução
de `executor` e `revisao` é compatível com pedidos antigos sem esses campos;
metadados já presentes não podem trocar de valor. O job e os arquivos
existentes permanecem vinculados ao mesmo pedido.

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
3. Usar as abas de origem/resultado somente como transporte serial da validação,
   preservando as nove colunas, o lote e o manifesto `CRM_DRIVE_V1`.
   Conferir valores/retorno e não substituir uma publicação pendente.
4. Guardar o vínculo entre `<pedido-uuid>`, lote do workflow, arquivo original
   e seus hashes na pasta desse pedido. Os critérios vêm do CRM; a aba antiga
   de planejamento não é uma segunda fila de pedidos novos. O espelho dos
   pedidos novos fica em Planejamento CRM.
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

## Conexão do coletor e verificações básicas em 25/10/2026

O coletor foi localizado após a reorganização das pastas em
`C:/Users/ADM/projetos/05 - IA e automações/Web Scraping/armarinhos`.
O serviço existente `gmaps-mooca-prospeccao` foi iniciado, mantendo somente
`127.0.0.1:8087`. A conferência da ponte leu 7 jobs existentes, nenhum ativo,
sem criar job ou alterar o histórico da campanha.

O workflow único `gITBY7vBYNfgUWMp` está ativo com 35 nós e zero gatilhos de
agenda. Reutiliza a credencial Evolution existente, confere conexão aberta
e o envelope `success/data`, rejeita respostas ambíguas e vincula a evidência
ao número exato. O teste real consultou o registro de um número comercial
de uma coleta já existente, retornando não encontrado. Não houve envio de
mensagem, nova coleta nem importação de empresas.

A homologação também conferiu critérios neutros, combinação de filtros
básicos, pendências individuais e os 14 cabeçalhos do planejamento sem escrita.
O ramo da planilha e o fluxo legado foram preservados. Na etapa de conexão,
a automação ainda estava pausada; o piloto e a ativação posteriores estão
registrados na seção seguinte.

O arquivo privado `.env.google-agente.local` reúne a configuração do executor.
Carregá-lo apenas no processo local, por exemplo com
`node --env-file=.env.google-agente.local --import tsx scripts/google/agente.mts ...`.
Para a ponte Python, passar a campanha conferida em `--campanha`. O arquivo
não é carregado automaticamente pelo Next nem pelo Python. Não copiar seus
tokens para prompts, argumentos, planilhas ou repositório.

## Piloto real e ativação em 25/10/2026

O usuário escolheu Junior, Armarinhos e variedades, Brás, São Paulo/SP.
O planejamento de 26/10 foi salvo pela sessão autenticada do vendedor e
sincronizado com a planilha na revisão 4. Como era domingo, a operação
liberou pontualmente somente esse pedido na fila, com horário real e
checagens de exclusividade da liberação. Não foi simulado outro relógio nem
alterada a regra automática de dias úteis às 17h.

Duas coletas dos mesmos critérios retornaram 16 candidatas cada. O primeiro
lote reservou 16 identidades distintas e entregou 13 empresas; três
ocorrências ficaram como repetidas. A segunda coleta não trouxe identidades
novas. O pedido foi concluído por `sem_novidades`, com um lote, 16 analisadas
e 13 entregues. Nenhuma verificação externa foi chamada no caminho neutro.
Os arquivos original, bruto e verificações do lote foram arquivados no Drive
e seus downloads conferidos por tamanho e SHA256; o bruto complementar
também foi arquivado e seu download conferido pelos mesmos critérios.
Os quatro arquivos coincidiram com seus originais. O mesmo recibo devolveu
`repetida` sem alterar contagens.

A listagem pessoal do Junior mostrou as 13 empresas como A contatar. As 13
exclusividades pertencem somente ao destinatário. O cadastro total passou de
30 para 43 empresas, com um novo grupo. A planilha confirmou concluido,
revisão 4, versão 6; o envio estava liberado e sem erro. A consulta seguinte
não encontrou pedido elegível, intenção pendente ou lock.

A automação existente `prospec-o-de-armarinhos-e-variedades` foi atualizada,
sem duplicata, para **CRM · Coleta Google por vendedor**, e ativada.
Horário: segunda a sexta às 17h, America/Sao_Paulo; sexta prepara segunda.
O destino do heartbeat e as demais automações foram preservados. As
instruções ficam em [Rotina Google](agente-google-rotina.md). A operação
automática usa somente a API do CRM, sem a liberação administrativa do piloto.
O computador, o Codex e o Docker precisam estar disponíveis para a execução
local; dias sem planejamento continuam sem coleta. Não houve envio de
mensagens nem consulta paga ao CNPJ.biz.

## Instalação dos motores paralelos

Configuração versionada em `scripts/google/motores.json`, em homologação.
O coordenador novo depende da migração 0045 e das demais etapas do plano;
a existência desses scripts não ativa coletas.

`powershell -NoProfile -File scripts/google/motores.ps1 -Acao Conferir` lê a
imagem, portas, volumes, limites e cache dos motores 01–03. Retorno ok falso
indica instalação incompleta; não dispara jobs. O comando Preparar fica para
a janela de ativação depois da revisão independente, com o original ocioso.

O motor 01 preserva container e volumes atuais. O 02 usa loopback 8088 e
`crm_google_motor02_data`; o 03 usa loopback 8089 e
`crm_google_motor03_data`. O cache original é compartilhado com escrita pela
mesma imagem fixada; os dados de cada motor ficam separados. Nenhum recurso
divergente é apagado/recriado. Limites do original só mudam após conferir jobs
inativos, com a mesma imagem e volumes. A preparação repetida é idempotente.

Cada motor usa dois trabalhadores, CPU 2, memória 2 GiB, memória mais swap
2,5 GiB, pids 512 e shm 64 MiB. O total memória mais swap segue a semântica
oficial de [restrições Docker](https://docs.docker.com/engine/containers/resource_constraints/).
Portas, mounts e shm não são ajustados por recriação automática do original.
As consultas de localização do kit continuam no serviço Nominatim existente.
O cache local reutiliza a mesma região entre vendedores e rodadas; consultas
novas são serializadas e separadas por pelo menos 16 segundos, conforme a
[política de uso recorrente](https://operations.osmfoundation.org/policies/nominatim/).
Esse intervalo limita somente a localização, mantendo as coletas simultâneas.
O cache e os locks ficam no estado privado, sem versionar coordenadas.

## Coordenador paralelo e retomada

A entrada �nica � scripts/google/coordenar.mts rodar|retomar, carregada com
.env.google-agente.local. O agente atende somente as solicita��es de Drive;
para V2 n�o chama proximo/coletar por fora do coordenador. As instru��es
completas e o protocolo de stdin est�o na [rotina](agente-google-rotina.md).
O journal fica em .google-agente/coordenador/journal.json. A porta local 8096
mant�m a exclus�o durante coletas e esperas; n�o encerre seu dono nem apague
inten��es para retomar. O processo anterior precisa estar comprovadamente
encerrado. Identidades s�o preservadas; rodar recusa pend�ncias, retomar as
atende antes de reivindicar outros pedidos.

At� tr�s pipelines usam as portas 8087, 8088 e 8089 com estados separados.
Uma falha preserva sua posi��o enquanto as outras progridem. Antes de novas
admiss�es/ondas, s�o necess�rios 5.632 MiB dispon�veis no Windows; abaixo de
512 MiB durante execu��o, novas admiss�es ficam suspensas. Falha de medi��o
bloqueia coleta nova. Reportar falta de RAM; n�o reduzir para fila sequencial
nem fechar programas automaticamente. O iniciado permanece recuper�vel.

O arquivamento emite manifesto imut�vel antes da cria��o remota. O agente
reencontra pasta/arquivo em resposta perdida. conferir-drive.mts compara
metadados e os bytes baixados pelo conector, ou HTTPS tempor�rio permitido,
sem gravar URL/token. O comprovante � correlacionado por associa��o, lote e
solicita��o e persistido antes de liberar a entrega. Nenhum sucesso de upload
isolado basta. CSV original de nove colunas, JSON nativo de verifica��es e
brutos permanecem distintos, com tamanho e SHA256. V1 conserva o runbook
anterior, somente no motor 01, sem convers�o de recibo.

A instala��o permanece em homologa��o at� revis�o, migra��o, prepara��o dos
motores e atualiza��o da mesma automa��o. A coleta foi pausada para esta
mudan�a; o hist�rico de ativa��o do piloto acima n�o comprova ativa��o do pool.
