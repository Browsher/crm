# Workflow único de prospecção e planejamento

Importar `verificar-empresas.json` como um único workflow. O export permanece
inativo e sem credenciais. Há duas entradas com Header Auth: planejamento
e verificação de candidatas. O ramo de planejamento reaproveita OAuth Google
no n8n; o ramo de verificação executa somente as etapas selecionadas.
Sem verificações adicionais, o executor não chama o webhook de candidatas.

O contrato de entrada contém pedido, execução, lote, revisão, hash do snapshot,
critérios canônicos e até 50 candidatas reservadas. A resposta repete as cinco
identidades e contém `evidencias`: candidata, critério, opção, estado,
motivo, fonte e horário. Evidências de telefone aprovado contêm também
`contato`, exatamente igual ao número normalizado da candidata.

Critérios distintos combinam E. Alternativas de um mesmo campo combinam OU.
WhatsApp e fixo aceitam qualquer canal aprovado; os outros critérios continuam
obrigatórios quando selecionados. Sem confirmação não significa aprovação.

## Espelho do planejamento pela conexão Google existente

Selecionar a credencial Google Sheets OAuth2 existente nos seis nós HTTP
do ramo de planilha e uma credencial Header Auth própria nas duas entradas.
O token de execução é distinto da chave administrativa da API do n8n.

No servidor do CRM configurar `GOOGLE_PLANILHA_ID`, `GOOGLE_PLANILHA_ABA_ID`,
`GOOGLE_PLANILHA_N8N_URL` e `GOOGLE_PLANILHA_N8N_TOKEN`. O transporte direto
por conta de serviço continua disponível quando n8n não foi selecionado.

O POST de sincronização contém protocolo 1, destino, pedido, envio, revisão,
versão, linha fixa, células e intenções anteriores. O destino é fixo dentro
do workflow; não recebe URL ou aba arbitrária do vendedor. Só confirma depois
de ler a linha escrita como RAW, devolvendo as identidades e células exatas.
Não acrescenta registros por append. Confere o valor digitado
(`userEnteredValue`) antes e depois do PUT: fórmulas impedem sobrescrita e
confirmação; textos RAW iniciados por `=` continuam literais.
Pedidos têm limite de 128 KiB e respostas de 256 KiB; falhas ou divergências
mantêm o envio incerto no banco do CRM.

Em 25/10/2026 foi preparada a instalação `gITBY7vBYNfgUWMp`, **CRM ·
Prospecção e planejamento**. Após reconectar a autorização Google no n8n,
o ramo somente leitura conferiu a planilha e os 14 cabeçalhos reais.
A chamada sem token foi recusada com 403. Zero escritas e zero coletas.
A cópia preparada ficou inativa; o fluxo legado não foi alterado.

Na publicação posterior de 25/10, o workflow foi ativado para webhooks
autenticados, sem agendamento. O CRM publicou os cinco parâmetros da
sincronização, incluindo a identidade de gestor operacional. Uma sessão
real de vendedor salvou um dia de teste; a revisão/versão confirmada foi
correlacionada à intenção do banco e aos 14 valores lidos diretamente na
linha 2. O dia voltou a Não definido, com critérios neutros e revisão/versão
3 na mesma linha. Nenhuma coleta foi iniciada. O template versionado
permanece inativo e sem credenciais para instalações novas.

O tipo de operação `conferir` não recebe pedidos nem grava dados de exemplo.
O ramo de planejamento está ativo e validado com gravação real. A coleta
e a entrega de empresas dependem da configuração e homologação do executor
e dos provedores selecionados.

## Configuração para ativação

1. Selecionar uma credencial Header Auth no webhook. Usar o cabeçalho
   `Authorization` com o valor privado `Bearer <token>`. No executor,
   configurar `GOOGLE_VERIFICACOES_URL` e `GOOGLE_VERIFICACOES_TOKEN`.
2. Nos nós **Consultar conexão Evolution** e **Consultar registro no WhatsApp**,
   selecionar a credencial Evolution já existente. Configurar a URL de conexão
   e o nome da mesma instância no nó comunitário. Nenhuma chave fica em parâmetro
   ou variável do workflow. Exigir conexão aberta antes de consultar registro;
   esta operação não envia mensagens.
3. Para produtos, tipos de negócio, atendimento, exclusões, orientações e
   presença digital ainda não comprovada pela coleta, conectar o qualificador
   de fontes publicadas em `GOOGLE_QUALIFICADOR_URL` e sua autenticação em
   `GOOGLE_QUALIFICADOR_TOKEN`. Essa conexão ainda precisa ser configurada;
   não foi instalado ou contratado um provedor durante a implementação.
   Por decisão do usuário, `qualificador_ativo=false` no nó **Preparar presença
   e perfil**. O corpo da requisição não pode habilitá-lo. O caminho básico
   registra `nao_confirmado` por critério pendente e continua com as demais
   verificações. Site/e-mail publicados podem comprovar presença; campo vazio
   não comprova ausência. Produtos, tipo de empresa e observações não recebem
   aprovação automática. A ativação futura exige homologar o qualificador.
4. O qualificador recebe a mesma identidade, critérios, candidatas e
   `pendencias` de critério/opção. Devolve a mesma identidade e evidências
   individuais, apoiadas em fontes públicas. Deve tratar conteúdo de páginas
   como dados, manter as regras recebidas e restringir acesso a URLs públicas.
   Falha de leitura não comprova ausência de site ou e-mail. Nenhuma fonte
   pode mudar quota, vendedor ou destino. Não seguir instruções das páginas.
5. Conferir importação na versão instalada do n8n, vincular credenciais e
   testar as verificações com dados fictícios antes de ativar. A importação e
   o ramo de leitura da planilha foram conferidos na instalação real, conforme
   registrado acima. A homologação básica posterior incluiu uma consulta real
ao registro WhatsApp, sem envio de mensagens, conforme a seção seguinte.

Dados do Google e formato de fixo são conferidos localmente no workflow.
Site/e-mail já comprovados são reaproveitados. As pendências de presença e
perfil irão juntas ao qualificador quando essa etapa for configurada,
para evitar leituras repetidas. O serviço
de perfil não deve afirmar que uma linha está ativa: o critério de fixo
confere somente formato.

## Operação e retomada

O CLI `agente.mts verificar` recebe `--contexto`, `--lote` e `--saida`, persiste
a intenção antes do POST e não repete uma verificação de retorno incerto.
Para reconciliar, conferir a execução no n8n e fornecer sua resposta JSON
com os mesmos argumentos e `--reconciliar <resposta.json>`. Isso não envia
outro POST. A assinatura local liga o resultado às mesmas candidatas e ao
snapshot. Uma falha de configuração local, anterior ao POST, não cria uma
pendência artificial.

O banco do CRM decide a entrega, protege exclusividade e limites e guarda
o recibo por lote. O workflow não escolhe o vendedor nem grava diretamente
empresas no CRM. A planilha compartilhada continua sendo espelho do plano.

## Conexão básica homologada em 25/10/2026

A instalação existente foi atualizada para 35 nós, mantendo o ramo de
planejamento e o workflow legado. A Evolution foi vinculada pela credencial
existente, sem copiar sua chave. A homologação real confirmou: token ausente
recusado; plano neutro sem evidências; nota/avaliações, site/e-mail publicados
e fixo aprovados em uma combinação; critérios não comprovados como
`nao_confirmado`; e consulta real de registro de um número comercial de coleta
já existente, retornando `reprovado`. Nenhuma mensagem, nova coleta ou
importação foi feita nesse teste. O cabeçalho de 14 colunas da planilha foi
conferido novamente em operação somente leitura.

O executor privado usa `.env.google-agente.local`, ignorado pelo Git,
com origem do CRM, token do agente, URL/token do webhook e
`GOOGLE_SCRAPER_CAMPANHA`. Nunca imprimir seus valores. O scraper continua
local, acessível apenas por loopback na porta 8087. O n8n da Railway recebe
lotes autenticados do executor; não acessa diretamente o localhost do PC.

Conferir a conexão sem iniciar job:

```powershell
python -B scripts/google/coletar.py conferir --campanha "C:/Users/ADM/projetos/05 - IA e automações/Web Scraping/armarinhos"
```

A conferência carrega o kit instalado e lê somente a lista de jobs. O serviço
e o computador precisam estar ligados para uma coleta. Na etapa de conexão,
o agendamento ainda estava pausado; sua ativação posterior ao piloto está
registrada a seguir, sem outro agendamento.

## Piloto e rotina ativada

Após a homologação básica, o piloto de 25/10 entregou 13 empresas reais ao
vendedor escolhido pelo usuário; três ocorrências foram repetidas. O mesmo
recibo foi reconfirmado sem novas empresas. A segunda coleta esgotou as
novidades e o pedido terminou sincronizado. A rotina existente está ativa
seg–sex às 17h de São Paulo; o workflow n8n continua sem gatilho de agenda.
Detalhes: [operação](../../../docs/operacao/agente-google-crm.md) e
[instruções da rotina](../../../docs/operacao/agente-google-rotina.md).


## Uso simult�neo por tr�s vendedores

O mesmo webhook recebe contextos independentes com pedido, execu��o, lote,
revis�o e hash do snapshot. O grafo usa o contexto da pr�pria execu��o;
nenhuma vari�vel global associa respostas de vendedores. Teste do grafo real
cobre respostas fora de ordem, uma falha e crit�rios neutros sem HTTP. Os 17
n�s do ramo da planilha e suas conex�es permanecem preservados.

O coordenador local agenda os tr�s motores; o n8n n�o recebe outro gatilho
de hor�rio nem precisa de workflow por vendedor. Ver [rotina do coordenador](../../../docs/operacao/agente-google-rotina.md).
