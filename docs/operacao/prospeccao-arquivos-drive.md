# Arquivos da prospecção no Drive

AVISO — LEGADO V1 HISTÓRICO (14–16/10/2026). Este documento preserva contratos e relatos da V1; não descreve a operação atual nem autoriza coleta, importação, instalação ou reinstalação. A rotina das 09h, a fila global, o WhatsApp obrigatório para exportar e o manifesto CRM_DRIVE_V1 pertencem à V1 histórica. O Google V2 vigente usa planejamento por vendedor e rotina das 17h; consulte [Agente Google CRM](agente-google-crm.md) e [Rotina do agente Google](agente-google-rotina.md). Resultados e pendências relatados em 16/10 são evidências daquela data, sem afirmar o estado atual. Os procedimentos abaixo são referência histórica, não próximos passos operacionais. O motor Node, exportar_csv.mjs e o kit instalado são fronteiras externas: não foram copiados para este repositório e sua execução real não é coberta pelos testes offline.

A pasta CRM reúne uma subpasta por bairro, cidade e data da coleta, por exemplo `2026-10-16 - Bom Retiro - São Paulo-SP`.

Cada pasta recebe arquivos separados:

- `planilha original scraping - ...csv`: salvo pelo agente, com telefone na primeira coluna e todos os campos da coleta publicada.
- `Planilha exportar CRM - ...csv`: salvo pelo workflow depois de publicar e conferir o resultado, no modelo de nove colunas para importar no CRM.

Os nomes incluem horário e identificador de lote/execução. Uma validação feita em outro dia conserva a pasta da coleta original. Arquivos anteriores permanecem guardados. A rotina que retoma um envio interrompido confere e reutiliza um arquivo idêntico, sem criar outra cópia do mesmo envio.

Os arquivos V1 eram CSV UTF-8 com BOM e identificadores preservados como texto. O arquivo cujo nome começava por Planilha exportar CRM era o destino da exportação; o original preservava a coleta completa.

A aba Backup telefones continua acumulativa. Ela registra telefones liberados para prospecção e impede que voltem nas listas seguintes; não comprova envio de mensagens. Guardar CSVs no Drive não dispara contatos nem importação no CRM.

Se houver falha no Drive, o agente mantém a publicação pendente e reutiliza a coleta pronta. No workflow, a exportação publicada fica marcada como arquivo pendente; a execução seguinte precisa salvar essa cópia antes de limpar resultados. Não remover o manifesto da nota A1 nem modificar uma exportação com arquivo pendente. Se a origem manual não tiver os dados necessários para identificar bairro, município e data, o workflow informa o que precisa ser preenchido antes de prosseguir. UF ausente na origem legada não é inventada.

A instalação e a conexão são conferidas separadamente da execução de uma lista real. Os testes desta alteração usam dados sintéticos; a primeira execução operacional era uma pendência registrada em 16/10, sem indicação do estado atual.

Pasta de destino: [CRM no Drive](https://drive.google.com/drive/folders/11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh). Workflow desta variante: [CRM Prospecção Arquivos Drive](https://primary-production-04eb.up.railway.app/workflow/nfuGFTAn6Uqd17fH). Em 16/10, o relato preservava o workflow anterior e indicava a nova variante para a V1. Esse relato não comprova disponibilidade atual nem recomenda trocar a variante vigente.

Verificação local em 16/10/2026: 285 testes TypeScript em 12 arquivos, 39 testes Python, tipos e lint dos arquivos alterados aprovados. O contrato cruzado confirmou igualdade dos bytes CSV, hash e nome de pasta entre Python e TypeScript. Um GET isolado confirmou que a conexão do n8n pode adicionar arquivos na pasta CRM. Nenhuma coleta ou validação real foi acionada nessa conferência.

A matriz publicada pelo agente deve terminar na última linha preenchida. Linhas totalmente vazias ao final são omitidas pela leitura do Sheets; se fizerem parte de um arquivo declarado, a divergência de hash bloqueia a execução antes da limpeza.
