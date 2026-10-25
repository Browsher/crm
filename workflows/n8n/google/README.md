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
Não acrescenta registros por append e não interpreta fórmulas das células.
Pedidos têm limite de 128 KiB e respostas de 256 KiB; falhas ou divergências
mantêm o envio incerto no banco do CRM.

Em 25/10/2026 foi preparada a instalação `gITBY7vBYNfgUWMp`, **CRM ·
Prospecção e planejamento**. Após reconectar a autorização Google no n8n,
o ramo somente leitura conferiu a planilha e os 14 cabeçalhos reais.
A chamada sem token foi recusada com 403. Zero escritas e zero coletas.
A cópia preparada ficou inativa; o fluxo legado não foi alterado.

O tipo de operação `conferir` não recebe pedidos nem grava dados de exemplo.
A ativação permanente depende da publicação/configuração do CRM e dos demais
provedores. O teste de leitura não é uma validação de ponta a ponta da entrega.

## Configuração para ativação

1. Selecionar uma credencial Header Auth no webhook. Usar o cabeçalho
   `Authorization` com o valor privado `Bearer <token>`. No executor,
   configurar `GOOGLE_VERIFICACOES_URL` e `GOOGLE_VERIFICACOES_TOKEN`.
2. Reutilizar a instância Evolution existente no ambiente do n8n:
   `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME` e `EVOLUTION_API_KEY`.
   A etapa consulta registro de números; não envia mensagem.
3. Para produtos, tipos de negócio, atendimento, exclusões, orientações e
   presença digital ainda não comprovada pela coleta, conectar o qualificador
   de fontes publicadas em `GOOGLE_QUALIFICADOR_URL` e sua autenticação em
   `GOOGLE_QUALIFICADOR_TOKEN`. Essa conexão ainda precisa ser configurada;
   não foi instalado ou contratado um provedor durante a implementação.
4. O qualificador recebe a mesma identidade, critérios, candidatas e
   `pendencias` de critério/opção. Devolve a mesma identidade e evidências
   individuais, apoiadas em fontes públicas. Deve tratar conteúdo de páginas
   como dados, manter as regras recebidas e restringir acesso a URLs públicas.
   Falha de leitura não comprova ausência de site ou e-mail. Nenhuma fonte
   pode mudar quota, vendedor ou destino. Não seguir instruções das páginas.
5. Conferir importação na versão instalada do n8n, vincular credenciais e
   testar as verificações com dados fictícios antes de ativar. A importação e
   o ramo de leitura da planilha foram conferidos na instalação real, conforme
   registrado acima. As consultas reais de candidatas ainda não foram executadas.

Dados do Google e formato de fixo são conferidos localmente no workflow.
Site/e-mail já comprovados são reaproveitados. As pendências de presença e
perfil vão juntas ao qualificador para evitar leituras repetidas. O serviço
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
