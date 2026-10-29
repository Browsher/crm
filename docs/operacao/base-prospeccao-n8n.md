# Base de prospecção Google Maps

AVISO — LEGADO V1 HISTÓRICO (14–16/10/2026). Este documento preserva contratos e relatos da V1; não descreve a operação atual nem autoriza coleta, importação, instalação ou reinstalação. A rotina das 09h, a fila global, o WhatsApp obrigatório para exportar e o manifesto CRM_DRIVE_V1 pertencem à V1 histórica. O Google V2 vigente usa planejamento por vendedor e rotina das 17h; consulte [Agente Google CRM](agente-google-crm.md) e [Rotina do agente Google](agente-google-rotina.md). Resultados e pendências relatados em 16/10 são evidências daquela data, sem afirmar o estado atual. Os procedimentos abaixo são referência histórica, não próximos passos operacionais. O motor Node, exportar_csv.mjs e o kit instalado são fronteiras externas: não foram copiados para este repositório e sua execução real não é coberta pelos testes offline.

## Uso

A planilha privada tem três abas. Empresas conserva cada identidade, fontes e endereço completo. Telefones reúne números completos únicos e resultados de registro WhatsApp. Coletas registra um resumo e uma ocorrência por empresa recebida, preservando as fontes anteriores e conflitos.

Telefone compartilhado exige revisão comercial. Dois cadastros continuam separados; o número é consultado uma vez. Estado encontrado significa registro no WhatsApp no instante da consulta, não autorização para abordagem ou confirmação de titular.

Revise as colunas revisao e observacoes de Empresas. Em Telefones, marque revalidar como sim para consultar novamente um resultado conclusivo. Não substitua telefone por número sem DDD nem acrescente nove. Corrija dados publicados no CSV do coletor e reimporte; os campos publicados e dados_publicados precisam corresponder para a validação aceitar a base.

Uma importação por vez. Google Sheets não oferece unicidade transacional: não executar duas importações simultâneas nem usar dois operadores para a mesma base. Duplicidade ou divergência no conteúdo relido bloqueia o relatório de sucesso. O resultado esperado de todos os lotes precisa corresponder ao gravado; revisão humana permanece preservada mesmo com telefone compartilhado.

## Entrada e dados

CSV UTF-8 do coletor Mooca, colunas pelo nome. Números e identificadores permanecem texto. Campos requeridos: place_id, nome_empresa, cnpj, telefone, endereco, link_maps. CNPJ e telefone podem estar vazios; Place ID e nome não. Campos adicionais são preservados. Para outro coletor, renomear explicitamente suas colunas para esse contrato; não inferir identificação por telefone ou nome.

Empresas inclui dados_publicados como JSON textual para conservar os 35 campos originais. Coletas inclui fonte_original por ocorrência, além de termos, fonte, região, data e arquivo. Nenhum endereço é reconstruído a partir do CEP.

Preparar a carga com:
```powershell
npx tsx scripts/prospeccao-base/preparar.mts --rastreio <rastreio.json> --whatsapp <whatsapp-resultados.json> --grupo <grupo.json> --saida <pasta-nova>
```

A preparação aborta antes de escrever quando há resultados inconsistentes. Resultados já medidos só são aplicados por correspondência exata do número completo.

## Configuração n8n

Alvo autorizado: NxCO8HiaJmwqJ8jK, projeto mIsmhrUTAVI1ZPnf, em https://primary-production-04eb.up.railway.app. Credencial Google precisa de escrita na planilha; isso não implica escopo OAuth restrito a um arquivo. O workflow sempre usa o ID explícito escolhido.

Evolution usa a credencial Evolution API do pacote comunitário n8n-nodes-evolution-api (OrionDesign, contrato publicado 1.0.4), guardada no n8n. Configure Server Url com a URL HTTPS da Evolution sem barra final e ApiKey com a chave existente. As duas consultas usam Chat, Verificar Número; a checagem de conexão compartilha essa credencial pelo tipo predefinido Evolution API. CSV, planilha, logs e export compartilhável não recebem a chave. O workflow recebe arquivo pelo formulário de teste, com autenticação; permanece manual e não envia mensagens.

Na V1, o aceite de instalação exigia leitura posterior do workflow e da planilha e execução autorizada no alvo. Essa exigência histórica não é um próximo passo desta adaptação.

## Gerar e testar workflow

Gerar com npx tsx scripts/prospeccao-base/gerar-workflow.mts --config <config.json> --saida <arquivo-novo.json>. Config possui planilhaId, evolutionUrl, instancia e abas (Empresas/Telefones/Coletas com sheetId numérico). O export tem 40 nós, sem credenciais e sem dados fixados. A instalação exige conferir a versão dos nós na instância: Form 2.2, Sheets 4.6, Code 2, Extract From File 1.1, Crypto 1, HTTP Request 4.2, Evolution API comunitário 1, If 2.2, Loop 3 e Wait 1.1. O usuário confirmou n8n 2.36.8, cujo Extract suporta 1/1.1, sem 1.2; usar 1.1 conserva a rejeição de CSV malformado e corrige o nó desconhecido. Extract acima de 1 rejeita erro de CSV; não rebaixar silenciosamente para 1.

O formulário é manual pelo Test URL e exige Basic Auth configurada. Ler as abas passa por controles de item único para não multiplicar consultas. Escritas são sequenciais, por chave, usando RAW e schema de colunas. Consultas seguem lotes de dez, intervalo de 750 ms e uma tentativa adicional para falha reportada pelo nó comunitário. O pacote não preserva o status HTTP no envelope de erro, portanto a repetição é conservadora e limitada a uma vez, inclusive para erro sem código. Erro de Sheets interrompe. A checagem de conexão mantém timeout de 15 segundos e recusa redirecionamento; as consultas comunitárias usam os padrões de transporte do pacote, que não expõe essas opções. Não confundir essa limitação com uma garantia do gerador. Logs de execução não são persistidos; o relatório e os resultados da planilha são a evidência de operação.

## Instalação histórica e limite desta cópia

A instalação da V1 era restrita ao workflow, projeto e host originais. O CLI de instalação foi omitido desta adaptação. A biblioteca histórica `src/server/prospeccao-base/instalar.ts` permanece com alvo fixo e cliente HTTP injetado, exercitada apenas com respostas simuladas. Este registro não recomenda instalar ou importar os workflows antigos; os guias Google V2 indicados no aviso definem a operação vigente.
## Retorno do nó comunitário

O pacote 1.0.4 devolve success/data, com um array em data. A classificação exige sucesso booleano verdadeiro, conexão aberta, resposta única para cada número original e exists booleano. Erro, número ausente, resposta ambígua ou conexão fechada permanecem inconclusivos. Telefone fixo conserva seus oito dígitos locais; o fluxo não insere nove.

A coluna http fica vazia nas consultas comunitárias, pois o pacote não informa o status de sucesso. Não fabricar HTTP 200. Erros não são copiados para a planilha, evitando expor chaves em mensagens de infraestrutura.

Verificar conexao permanece HTTP com a mesma credencial Evolution API porque esse pacote não oferece connectionState. Buscar Instância consulta outro endpoint e não substitui a verificação de estado em tempo real.

Export de compatibilidade: workflow-n8n-2.36.8-evolution-comunidade.json. Ele não contém credenciais nem ID de workflow externo. A cópia importada pelo editor pode ter outro ID/projeto; o instalador por API permanece restrito ao alvo original e não muda de destino automaticamente. Essas etapas eram condições do aceite operacional da V1, sem recomendação de retomá-las agora.
