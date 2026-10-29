# Validar WhatsApp e exportar empresas pelo Google Sheets

AVISO — LEGADO V1 HISTÓRICO (14–16/10/2026). Este documento preserva contratos e relatos da V1; não descreve a operação atual nem autoriza coleta, importação, instalação ou reinstalação. A rotina das 09h, a fila global, o WhatsApp obrigatório para exportar e o manifesto CRM_DRIVE_V1 pertencem à V1 histórica. O Google V2 vigente usa planejamento por vendedor e rotina das 17h; consulte [Agente Google CRM](agente-google-crm.md) e [Rotina do agente Google](agente-google-rotina.md). Resultados e pendências relatados em 16/10 são evidências daquela data, sem afirmar o estado atual. Os procedimentos abaixo são referência histórica, não próximos passos operacionais. O motor Node, exportar_csv.mjs e o kit instalado são fronteiras externas: não foram copiados para este repositório e sua execução real não é coberta pelos testes offline.

## Estado da entrega em 15/10/2026

Na entrega histórica de 15/10/2026, o uso da V1 passava pelas três abas abaixo, na mesma planilha. A substituição de instruções descrita aqui se limitava àquela V1.

| Ordem | Aba | Uso | sheetId |
| --- | --- | --- | --- |
| 1 | Validar numero whatsapp | Resultado automático, Válidos e Inválidos | 10151002 |
| 2 | planilha original scraping | Colar a coleta completa, com telefone na coluna A | 10151001 |
| 3 | Planilha exportar CRM | Cadastros elegíveis no modelo do CRM | 10151003 |

Planilha autorizada: [PLANILHA BASE CRM Prospecção](https://docs.google.com/spreadsheets/d/17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU/edit). Empresas, Telefones e Coletas ficam ocultas e preservadas. O workflow não as usa como cache nem modifica a origem.

A preparação real das abas foi conferida por metadata, leitura de retorno e inspeção visual local de uma exportação XLSX. Há somente `telefone` em A1 da origem, sem coleta atual. Fonte e formatos foram preservados; os destinos têm cabeçalhos, primeira linha congelada e identificadores como texto.

Código e testes locais, preparação da planilha e entrega do JSON são evidências separadas. **Instalação no editor, execução real no n8n e validação de CSV baixado desta execução estão pendentes.** A automação do editor falhou ao carregar os assets do kernel (erro de sistema 3), e a consulta de tipos do editor exigiu autenticação (401). Naquela data, o caminho escolhido era a importação manual, sem solicitar outra chave de API; não é recomendação atual. Os números históricos 29/13 não representam uma consulta atual.

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

## Contrato histórico do editor

A V1 usava n8n 2.36.8, Google Sheets `typeVersion: 2` com leitura RAW da matriz em `values`, preservando cabeçalhos duplicados, zeros iniciais e linhas vazias. O workflow simples tinha 27 nós e credenciais selecionadas no editor, sem chaves no export. As leituras, metadata, notas de processamento e readback eram etapas distintas; a conferência integral era condição para publicar resultados. Este contrato é preservado para entender o gerador offline, sem instrução de importação ou reconfiguração do editor atual.
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

## Compatibilidade histórica do CSV e aceite de 15/10

O CSV V1 tinha nove colunas nesta ordem: `cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id`. Telefone usava DDD + número sem DDI; CNPJ e CEP permaneciam texto. A compatibilidade é testada offline com o parser real do CRM, inclusive os limites de tamanho e de linhas. Isso não comprova importação ou execução real atual.

Em 15/10 a origem estava somente com cabeçalho, e execução real, leitura posterior e conferência do CSV baixado eram pendências daquela entrega. Este registro não recomenda completar aquele aceite, importar a V1 ou retomar uma coleta; para a operação atual, consulte os dois guias Google V2 do aviso.