# Validação simples de WhatsApp no Google Sheets

## Objetivo e decisões do usuário

Substituir a entrada por arquivo CSV por uma aba fixa na mesma planilha. O gestor cola a coleta completa, executa o workflow manualmente e recebe os telefones separados entre válidos e inválidos e uma aba no formato de importação do CRM.

O usuário escolheu Google Sheets, reutilização da planilha atual, telefone na coluna A e números a partir de A2. A aba original permanece como fonte de conferência. As saídas são substituídas a cada execução concluída, em vez de acumular listas antigas.

Esta especificação altera a experiência operacional descrita em `2026-10-14-base-prospeccao-n8n-design.md`. Está em revisão: não representa um workflow instalado ou executado.

## Estado conferido em 15/10/2026

- Planilha: `17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU`, título PLANILHA BASE CRM Prospecção.
- Aba de entrada: `planilha original scraping`, sheetId 10151001, A1 `telefone`, coluna A como texto, sem empresas preenchidas na leitura A1:J5.
- Abas históricas existentes e ainda visíveis: Empresas, Telefones e Coletas. A implementação vai ocultá-las, preservando seus dados; o novo fluxo cotidiano não dependerá de preenchê-las manualmente.
- O gerador atual em `src/server/prospeccao-base/workflow.ts` usa entrada de CSV e o nó comunitário Evolution API. O pacote e a credencial já foram escolhidos pelo usuário.
- O importador em `src/features/empresas/planilha.ts` aceita o modelo Google de nove colunas. Seu telefone é nacional, com DDD e sem DDI. O CSV atual não aceita endereço publicado e link de origem como colunas adicionais.
- A instalação anterior foi feita pelo editor do n8n. Não há acesso autenticado confirmado nesta etapa para editar ou testar o workflow remotamente.

## Entrada e campos

Uma empresa por linha, cabeçalhos na linha 1. A coluna A deve ter o cabeçalho exato `telefone`; os telefones começam em A2. Os outros campos são localizados pelo nome do cabeçalho, independentemente da posição.

Para a coleta do Google Maps, reconhecer os nomes já utilizados pelo coletor: `nome_empresa`, `place_id`, `cnpj`, `email`, `cep`, `endereco` e `link_maps`. Reconhecer também os campos explícitos do modelo CRM: `razao_social`, `nome_fantasia`, `contato_nome`, `cnae_principal` e `google_place_id`. Se aliases de um mesmo campo estiverem preenchidos com valores diferentes, informar a divergência e exigir correção; não escolher silenciosamente.

Somente `telefone` é suficiente para consultar WhatsApp. Para exportar uma empresa, exigir nome (`nome_empresa`, `nome_fantasia` ou `razao_social`) e identidade (`place_id`/`google_place_id` ou CNPJ válido). CNPJ continua opcional para empresa identificada por Place ID. E-mail, CEP, CNAE e contato podem ficar vazios. Dados ausentes não são inventados.

A exportação usa `nome_empresa` como nome fantasia quando este não vier preenchido. Não fabricar razão social a partir do nome comercial. Endereço completo, link do Maps e campos extras continuam preservados na origem; o modelo de nove colunas não os transporta ao CRM. A ampliação de endereço é uma entrega separada e não pode ser presumida publicada.

Recusar coletas com mais de 5.000 empresas, conforme o limite atual do importador; não truncar silenciosamente a leitura. Ignorar linhas totalmente vazias e identificar problemas pelo número original da linha. Cabeçalhos duplicados ou ambíguos bloqueiam a execução antes de publicar resultados.

## Validação de WhatsApp

1. Acionamento manual no editor do n8n, sem formulário de upload.
2. Ler uma fotografia da aba de entrada e validar a estrutura antes de consultar ou escrever.
3. Normalizar números para `55` + DDD + número, aceitando os separadores já suportados. Manter fixos de oito dígitos locais; nunca inserir ou remover o nono dígito para tentar obter resultado positivo.
4. Consultar cada número completo único uma vez por execução, mesmo se aparecer em várias empresas. A deduplicação de telefone não funde empresas e não exclui automaticamente empresas distintas do arquivo final.
5. Reutilizar o nó comunitário `n8n-nodes-evolution-api.evolutionApi`, operação `check-number`. Manter `Verificar conexao` como HTTP Request ao endpoint de estado da instância, com a mesma credencial Evolution API.
6. Processar lotes de dez, com intervalo de 750 ms e no máximo uma tentativa adicional após falha, conforme a configuração existente.
7. Considerar válido apenas resultado associado exatamente ao número consultado, em envelope de sucesso, com `exists: true` booleano. `exists: false` booleano, em resposta válida, entra em inválidos.
8. Telefones sem DDD, vazios, malformados ou com múltiplos números na mesma célula são pendências de entrada. Timeout, desconexão, erro de API, retorno ausente ou ambíguo são pendências de consulta. Nenhum deles vira automaticamente inválido.
9. Revalidar os números da coleta atual. Resultados antigos da aba Telefones não são prova de validade atual e não autorizam excluir uma empresa da coleta nova.

A deduplicação desta entrega evita consultas repetidas e números repetidos nas colunas de resultado. Não constitui bloqueio global de abordagem comercial nem remoção de empresas diferentes que compartilham telefone.

## Três abas visíveis na mesma planilha

A organização solicitada pelo usuário é: 1. Validar numero whatsapp; 2. planilha original scraping; 3. Planilha exportar CRM. A primeira apresenta automaticamente os resultados; a segunda recebe a coleta completa e fornece os números para consulta; a terceira recebe os cadastros filtrados. Não é preciso copiar os telefones novamente em outra aba.

Ocultar Empresas, Telefones e Coletas para manter somente essas três abas visíveis, sem excluir o histórico. Não criar abas adicionais de controle nem depender das abas antigas para operar.

## Saídas na mesma planilha

### Validar numero whatsapp

Exatamente duas colunas: A1 `Válidos`, B1 `Inválidos`. Números completos únicos como texto, com DDI e DDD. As duas listas são independentes; valores na mesma linha não indicam associação entre si.

Pendências não entram em nenhuma das duas colunas. Aparecem no relatório final do workflow, com linha de origem e motivo objetivo. Notas dos cabeçalhos indicam execução, data, situação e quantidade de pendências, sem criar outras colunas técnicas.

### Planilha exportar CRM

Exatamente as nove colunas aceitas pelo importador atual, nesta ordem:

`cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep,cnae_principal,google_place_id`

Incluir apenas empresas cujo telefone foi confirmado como WhatsApp e cujos campos atendem ao contrato do CRM. O telefone desta aba é nacional, sem DDI, para ser aceito pelo importador. CNPJ, CEP e telefones permanecem como texto. Campos são escritos como valores literais, sem interpretar fórmulas da coleta.

Uma empresa repetida com a mesma identidade e os mesmos campos exportáveis gera uma linha. Divergências entre ocorrências da mesma identidade, inclusive CNPJ e Place ID apontando para empresas diferentes, ficam pendentes de revisão. Empresas distintas com um mesmo telefone são preservadas e o compartilhamento aparece no relatório.

O teste de compatibilidade precisa passar o CSV gerado pelo parser real do CRM, sem alterar esse parser para aceitar uma saída incorreta. Rejeições de cadastro não podem aparecer como inválidos de WhatsApp. O relatório informa empresas exportadas, empresas sem cadastro suficiente, duplicidades e compartilhamentos.

O gestor baixa somente a aba Planilha exportar CRM como CSV UTF-8 e usa a importação existente, com escolha de grupo, prévia e confirmação. O workflow não cadastra empresas diretamente no banco.

## Publicação e falhas

Montar e validar as duas saídas integralmente antes de substituir seus dados. A origem e as três abas históricas não são limpas nem reescritas por este fluxo.

Nas execuções sem falha de infraestrutura, substituir as saídas com resultados da coleta atual, inclusive removendo sobras de execuções maiores. Zero resultados gera somente os cabeçalhos, nunca dados antigos apresentados como atuais. Ler de volta as saídas e conferir contagens e valores antes de indicar conclusão.

Se houver pendência de consulta após a tentativa adicional, interromper a publicação das duas saídas e mostrar os números pendentes no relatório. Não gerar uma lista final parcial com aparência de coleta completa. Pendências de entrada ou cadastro podem produzir saída parcial, desde que as notas dos cabeçalhos e o relatório indiquem expressamente essa situação e suas contagens.

Antes da substituição, marcar as notas dos cabeçalhos das saídas como em processamento para identificar uma eventual gravação incompleta. Só indicar concluído ou concluído com pendências depois do readback. Falha de escrita ou conferência interrompe o fluxo e conserva a indicação de incompleto; não declarar sucesso. Se uma falha de consulta impedir a publicação, as saídas anteriores mantêm a identificação da execução anterior.

Uma execução por vez; não substituir a aba de origem enquanto o workflow estiver em andamento. Esta entrega não oferece concorrência transacional entre operadores. Um novo clique após uma falha refaz a leitura e a validação da coleta atual.

Credenciais Google e Evolution permanecem no n8n. O JSON de entrega não contém chaves, senhas ou dados fixados. Não alterar compartilhamento da planilha, outros workflows, configuração global de concorrência ou banco do CRM.

## Verificação e entrega

- TDD para a leitura/mapeamento, números fixos e celulares, normalização, duplicidade e exportação compatível com o parser real do CRM.
- Cenários de resposta positiva/negativa, falha repetida, resposta incompleta, número compartilhado, ausência de nome/identidade e conflito de aliases.
- Testar nova execução menor, lista vazia, nenhum válido, nenhum inválido, escrita parcial e falha de readback.
- Conferir no JSON que a origem só é lida, apenas as duas saídas são substituídas, os nós são compatíveis com n8n 2.36.8 e não há nós de envio de mensagem nem credenciais embutidas.
- Entregar novo JSON com nome distinto e instruções curtas para importar pelo editor e selecionar as credenciais existentes.
- Considerar instalação operacional concluída somente após execução real no n8n e leitura de volta das abas. Gerar um JSON local não comprova que o workflow remoto foi alterado.

## Próxima etapa do SDD

Revisão desta especificação pelo usuário. Depois da aprovação, preparar o plano de implementação e submetê-lo à escolha de execução antes de iniciar código. Não alterar o workflow externo durante esta etapa de especificação.
