# Validar WhatsApp e exportar empresas pelo Google Sheets

## Estado da entrega em 15/10/2026

O uso cotidiano passa a ser pelas três abas abaixo, na mesma planilha. Este manual substitui as instruções do fluxo antigo de CSV/formulário para esta operação.

| Ordem | Aba | Uso | sheetId |
| --- | --- | --- | --- |
| 1 | Validar numero whatsapp | Resultado automático, Válidos e Inválidos | 10151002 |
| 2 | planilha original scraping | Colar a coleta completa, com telefone na coluna A | 10151001 |
| 3 | Planilha exportar CRM | Cadastros elegíveis no modelo do CRM | 10151003 |

Planilha autorizada: [PLANILHA BASE CRM Prospecção](https://docs.google.com/spreadsheets/d/17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU/edit). Empresas, Telefones e Coletas ficam ocultas e preservadas. O workflow não as usa como cache nem modifica a origem.

A preparação real das abas foi conferida por metadata, leitura de retorno e inspeção visual local de uma exportação XLSX. Há somente `telefone` em A1 da origem, sem coleta atual. Fonte e formatos foram preservados; os destinos têm cabeçalhos, primeira linha congelada e identificadores como texto.

Código e testes locais, preparação da planilha e entrega do JSON são evidências separadas. **Instalação no editor, execução real no n8n e validação de CSV baixado desta execução estão pendentes.** A automação do editor falhou ao carregar os assets do kernel (erro de sistema 3), e a consulta de tipos do editor exigiu autenticação (401). O caminho escolhido é a importação manual, sem solicitar outra chave de API. Os números históricos 29/13 não representam uma consulta atual.

## Arquivos de entrega

Os três arquivos privados ficam em `outputs/validacao-whatsapp-sheets-2026-10-15/`, também copiados para o mesmo subdiretório de `C:/Users/ADM/projetos/crm/outputs/`:

- `config-simples.json`: IDs reais das abas, host e nome da instância, sem chave.
- `workflow-whatsapp-sheets-nativo.json`: workflow com três leituras nativas Google Sheets para importar no editor, sem credenciais ou dados fixados.
- `aceite-sheets-nativo.json`: verificações locais e pendências operacionais; não é comprovante de execução remota.

Os JSONs anteriores e o `aceite-operacional.json` permanecem preservados; esta entrega tem nomes distintos. Não usar o instalador antigo desta base: seu alvo é outro workflow/projeto. Não alterar compartilhamento da planilha, outros workflows, concorrência global ou banco do CRM.

Para regenerar em um arquivo novo, executar na raiz do projeto:

```powershell
node --import tsx scripts/prospeccao-base/gerar-workflow-simples.mts --config outputs/validacao-whatsapp-sheets-2026-10-15/config-simples.json --saida outputs/validacao-whatsapp-sheets-2026-10-15/workflow-whatsapp-sheets-nativo-regenerado.json
```

Use um nome de destino livre a cada regeneração. O CLI recusa sobrescrever um destino existente. O contrato de configuração é `planilhaId`, `evolutionUrl`, `instancia` e `abas` com `origem`, `validacao` e `exportacao` numéricos. Credenciais permanecem no n8n.

## Importar e configurar no editor

1. Abra o editor autenticado do n8n no projeto em que está a cópia atual escolhida para esta operação. Confira a URL, o projeto e a identidade dessa cópia; preserve o workflow anterior antes de substituir seu conteúdo. Se ainda não existir uma cópia dedicada, crie um workflow vazio nesse projeto para receber esta entrega.
2. No cabeçalho do canvas, abra o menu de três pontos do workflow, escolha **Import from File** e selecione `workflow-whatsapp-sheets-nativo.json`. Confira o nome importado: `CRM Prospecção Validação WhatsApp Sheets Simples`. Confirme que o canvas contém os 27 nós desta entrega: três Google Sheets, cinco HTTP Request e dois Evolution API, além dos nós de controle e código.
3. Confira os tipos de nó disponíveis na instância n8n 2.36.8: Manual Trigger 1, Code 2, Google Sheets 2, HTTP Request 4.2, If 2.2, Loop Over Items 3, Wait 1.1 e Evolution API comunitário 1 (`n8n-nodes-evolution-api.evolutionApi`). Se houver nó desconhecido, interrompa a configuração e revise a disponibilidade do pacote; não substitua uma consulta por envio de mensagem.
4. Nos três nós Google Sheets (`Ler scraping`, `Ler validação` e `Ler exportação`), mantenha **Authentication → OAuth2**, **Resource → Sheet**, **Operation → Read**, **RAW Data** ligado e **Data Property → values**; selecione a credencial Google existente com acesso à planilha em cada nó. Confira **Value Render Mode → Formatted Value**, **Continue If Empty** ligado e **Always Output Data** ligado. Nos quatro HTTP Request Google (`Ler metadados`, `Marcar processamento`, `Substituir saídas` e `Concluir notas`), mantenha **Authentication → Predefined Credential Type → Google Sheets OAuth2 API** e selecione a mesma credencial Google em cada um.
5. Em `Verificar conexão`, mantenha **Predefined Credential Type → Evolution API** e selecione a credencial Evolution existente. Em `Consultar WhatsApp` e `Consultar novamente`, selecione essa mesma credencial no nó comunitário. Não cole chaves em parâmetros, cabeçalhos, JSON ou planilha.
6. Confira o servidor da credencial: `https://crm-whatsapp-production-b341.up.railway.app`; a instância é `NTV Box - Suporte`, com espaços exatos. No JSON, `instanceName` e o segmento da URL de conexão estão codificados como `NTV%20Box%20-%20Suporte`.
7. Confira nos parâmetros que a planilha é `17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU`, a fonte é 10151001 e os destinos são 10151002/10151003. Os três títulos precisam coincidir exatamente com a tabela deste manual. A checagem de metadata bloqueia execução com IDs/títulos trocados.
8. Salve a cópia configurada e registre sua URL/ID e projeto no aceite privado. Mantenha apenas o acionamento `Iniciar manual`, sem gatilho automático. A importação e o salvamento ainda precisam de uma execução real com leitura de retorno para comprovar o funcionamento.

Os nós Google Sheets usam explicitamente `typeVersion: 2`, registrado no n8n 2.36.8. O editor pode mostrar um aviso de versão anterior. Essa versão oferece leitura RAW da matriz inteira em `values`, incluindo cabeçalhos duplicados, zeros iniciais e linhas vazias intermediárias; a leitura por objetos converteria cabeçalhos em chaves antes de validá-los. Preserve essa versão e esse modo ao configurar. Os ranges vêm dos metadados validados e cobrem as grades completas; as duas releituras cobrem também dimensões expandidas e colunas extras. Origem totalmente vazia ou retorno sem matriz gera diagnóstico estrutural; somente cabeçalhos válidos produz zero consultas e saídas só com cabeçalhos. Falha de qualquer leitura interrompe o fluxo; retorno vazio ou malformado no readback impede concluir notas e relatório.

O HTTP permanece para conferir IDs, títulos e dimensões e para três gravações `spreadsheets.batchUpdate`: notas em processamento, limpeza/substituição conjunta das duas saídas e notas de conclusão após a conferência integral. A checagem de conexão Evolution também permanece por HTTP. A entrega não usa HTTP `values.get` ou `values:batchGet` nas leituras comuns. O contrato RAW v2 está no código oficial da versão [Google Sheets V1](https://github.com/n8n-io/n8n/blob/n8n%402.36.8/packages/nodes-base/nodes/Google/Sheet/v1/GoogleSheetsV1.node.ts), com [parâmetros e aviso de versão anterior](https://github.com/n8n-io/n8n/blob/n8n%402.36.8/packages/nodes-base/nodes/Google/Sheet/v1/versionDescription.ts) e [registro de versões](https://github.com/n8n-io/n8n/blob/n8n%402.36.8/packages/nodes-base/nodes/Google/Sheet/GoogleSheets.node.ts).

Referências do editor: [importação e exportação](https://docs.n8n.io/workflows/export-import/) e [credenciais predefinidas no HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).

## Colar a coleta e executar

Cole a coleta completa em `planilha original scraping`, com os cabeçalhos na linha 1, `telefone` exatamente em A1 e telefones a partir de A2. Substitua a coleta anterior inteira, removendo sobras de linhas anteriores. Preserve números e identificadores como texto. Não é preciso copiar telefones para a aba de validação. Máximo: 5.000 empresas; o fluxo recusa excedentes em vez de truncar. Antes de publicar, também confere o limite de 1.500.000 bytes do importador, estimando CSV UTF-8 com escapes, todos os campos entre aspas, CRLF e BOM. Se exceder, interrompe as duas saídas e orienta dividir a coleta em partes menores. Essa estimativa conservadora pode pedir divisão mesmo quando um download mais compacto caberia; a origem permanece intacta.

Os demais campos são reconhecidos pelo cabeçalho, independentemente da posição: `nome_empresa`, `place_id`, `cnpj`, `email`, `cep`, `endereco`, `link_maps`, `razao_social`, `nome_fantasia`, `contato_nome`, `cnae_principal` e `google_place_id`. Campos extras, endereço e link do Maps permanecem na origem; o CSV atual de nove colunas não os transporta ao CRM. Cabeçalhos duplicados/ambíguos e células ilegíveis bloqueiam o fluxo; o erro de Preparar coleta informa motivo e detalhes com linha/coluna, sem reproduzir o conteúdo da célula. Corrija as posições indicadas antes de executar novamente; aliases preenchidos com valores diferentes exigem correção.

Só telefone basta para consultar registro no WhatsApp. Para exportar, a empresa também precisa de nome e identidade: Place ID ou CNPJ válido. Não fabricar os dados ausentes. `nome_empresa` pode preencher nome fantasia; não é usado para inventar razão social.

No editor, clique **Execute Workflow** uma única vez e aguarde o término. Execute uma coleta por vez; não clique novamente nem substitua a origem durante a execução. Os números completos únicos são consultados em lotes de dez, com intervalo de 750 ms entre lotes e no máximo uma tentativa adicional para resultados inconclusivos. Números fixos mantêm oito dígitos locais com DDD. O fluxo nunca insere ou remove o nono dígito.

## Conferir resultados e pendências

Abra o resultado do nó `Relatório final` na execução atual. Registre ID/data, `empresasLidas`, `empresasExportadas`, `validos`, `invalidos`, `pendencias`, `duplicadas`, `compartilhados` e `mensagensEnviadas` (zero). A quantidade recebida é `empresasLidas`; a contagem de números únicos consultáveis pode ser conferida em `Preparar coleta`, campo `coleta.numeros.length`. Em conclusão sem pendências de consulta, ela coincide com válidos mais inválidos.

Em `Validar numero whatsapp`, A contém válidos e B inválidos, únicos e com DDI + DDD. As listas são independentes: dois números na mesma linha não estão relacionados. Apenas `exists: true` booleano, em resposta válida e associada ao número exato, confirma registro; `exists: false` booleano válido classifica como inválido. Registro WhatsApp não confirma titularidade da empresa nem autorização de abordagem.

Pendências de entrada incluem telefone ausente, sem DDD, malformado ou vários números na mesma célula. Falta de nome/identidade, campos inválidos e conflitos de cadastro também aparecem no relatório por linha de origem, sem virar inválidos de WhatsApp. A saída pode ser parcial nesses casos; confira as notas dos cabeçalhos, com execução/data/situação e contagem de pendências.

Timeout, desconexão, resposta ausente/ambígua ou falha da API permanecem pendências de consulta. Se persistirem após a tentativa adicional, as duas saídas não são publicadas. As listas anteriores continuam identificadas pela execução anterior; não as trate como resultado da tentativa que falhou. Confira o erro do nó e seu relatório de pendências.

Antes de substituir as saídas, suas notas são marcadas em processamento. Só após releitura e conferência dos valores recebem conclusão. Se houver falha de escrita ou readback, o fluxo interrompe, mantém indicação incompleta e não emite `Relatório final` de sucesso. Corrija a causa e execute novamente a coleta atual. Não aprove uma saída com nota em processamento.

A cada publicação concluída, as duas saídas substituem as anteriores e removem sobras. Zero resultados produz só cabeçalhos. Isso foi coberto por harness offline, inclusive execuções menores e vazias, falhas e readback; não comprova execução real no n8n.

Duplicadas com a mesma identidade e campos exportáveis iguais geram uma linha. Divergências da mesma identidade ficam pendentes. Empresas distintas com telefone comum permanecem separadas na exportação; revise `compartilhados` comercialmente sem apagar uma empresa só por compartilhar número. O telefone é consultado uma vez por execução.

## Baixar e importar no CRM

1. Depois de conferir relatório, notas e valores das duas saídas, selecione somente a aba **Planilha exportar CRM**.
2. No Google Sheets, use **Arquivo → Fazer download → Valores separados por vírgulas (.csv, página atual)**. Preserve o arquivo CSV em UTF-8, sem regravar números como valores numéricos em outro editor.
3. Confira as nove colunas e sua ordem exata: `cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id`. Nesta aba, telefone é DDD + número, sem DDI. CNPJ e CEP continuam texto.
4. Abra a importação existente de empresas no CRM, escolha o grupo adequado e envie o CSV para a **prévia**. Confira a interpretação pelo parser real, as contagens, campos e eventuais rejeições. Só confirme a importação depois dessa revisão. O workflow não faz importação automática no banco.
5. Se não houver empresas elegíveis, confira apenas cabeçalhos, notas e relatório; não force uma importação vazia. Corrija na origem os cadastros pendentes antes de uma nova execução.

A compatibilidade do CSV gerado é testada offline pelo parser real do CRM. O aceite do arquivo efetivamente baixado continua pendente até ser conferido pelo mesmo parser/prévia, sem confundir essa etapa com o teste automatizado.

## Completar o aceite operacional

Atualize o `aceite-sheets-nativo.json` privado somente com evidência observada: URL/ID do workflow salvo, projeto, ID/data da execução real, recebidos, únicos consultados, válidos, inválidos, pendências, duplicadas, compartilhados e empresas exportadas. Registre a leitura de retorno das três abas e o resultado do parser/prévia do CSV baixado, sem guardar chaves ou credenciais. Não use telefones sintéticos em produção para testar.

A origem está só com cabeçalho nesta entrega. Aguarde a coleta autorizada da Mooca para comprovar a execução real. A remoção de sobras em cenário menor está comprovada apenas offline; não substitua a coleta real por um teste destrutivo. Considere instalação operacional concluída somente depois da execução real, leitura de retorno e conferência do CSV, ou comprovação de cabeçalhos/relatório se nenhuma empresa for elegível.
