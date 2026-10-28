# Reaproveitar a conexão Google do n8n no espelho do planejamento

Complemento operacional do desenho e implementação aprovados de Google,
critérios e rodadas. O usuário confirmou em 25/10 que sua conta Google já
está conectada no n8n e configurou a chave de administração local.

## Intenção e fronteiras

Usar a credencial Google Sheets OAuth2 existente no n8n, sem copiar seus
tokens ao CRM ou pedir outra conta Google. A planilha é espelho; pedido,
vendedor, revisão, linha, exclusividade e limites continuam sob autoridade
do banco. O comportamento aprovado e as migrações permanecem os mesmos.

Minha decisão de implementação: acrescentar transporte n8n opcional ao
cliente de planilha e um ramo de sincronização no mesmo workflow de
verificações. O transporte direto por conta de serviço continua compatível.
Sem configuração completa, o CRM mantém o planejamento salvo e pendente.

## Contrato e preservação

O CRM envia por HTTPS, Header Auth e POST único a identidade do envio,
pedido/revisão/versão, linha fixa, destino, células canônicas e intenções
anteriores conhecidas. Não envia credenciais Google. O token do webhook
é próprio da integração, distinto da chave administrativa do n8n.

O workflow tem destino fixo: arquivo compartilhado já identificado,
aba Planejamento CRM, ID 10151006. Confere arquivo, título, grade e os
14 cabeçalhos antes de gravar. Aceita linhas de 13 células para reconciliar
intenções legadas. Só escreve se a linha estiver vazia, idêntica ou for
uma intenção anterior conhecida do mesmo pedido. Escreve texto RAW, relê
a mesma linha e devolve as identidades e células conferidas. Não usa append
de registros, ordenação, instruções das células ou destino arbitrário.

O servidor mantém o bloqueio durável existente antes do HTTP. Perda de
resposta, redirecionamento, erro ou resposta divergente conservam o envio
incerto; não há repetição automática. Só uma confirmação exata após leitura
autoriza confirmar a revisão no banco. Limite de corpo: 128 KiB no pedido,
256 KiB na resposta; erros públicos genéricos, sem payload ou segredos.

O ramo também aceita conferência somente leitura de metadados/cabeçalho,
sem pedido fictício ou escrita na planilha real. A credencial Google
permanece selecionada no n8n. Export versionado não contém tokens nem IDs
privados de credenciais. O workflow não salva dados das execuções.

## Validação e ativação

TDD no transporte, estado de incerteza e execução do grafo exportado com
Sheets simulado: destino/cabeçalho divergente, conteúdo manual, RAW,
idempotência, revisão seguinte, legado e expansão de grade. Integração
real do banco confirma que uma resposta perdida impede envio posterior.

Importar como revisão preparada inativa, vinculando a credencial existente.
Conferir compatibilidade na instalação e testar o ramo somente leitura
com Header Auth próprio. Não executar scraping, consulta paga ou envio
de mensagem. O fluxo legado deve ser preservado até a troca operacional;
não ligar outro agendamento. Configurar o servidor e liberar a rotina real
exige publicar a versão revisada, migrações e provedores já previstos.

Revisão independente ao final. Não alterar o checkout principal nem
commitar arquivos privados de ambiente ou backups de workflows reais.
