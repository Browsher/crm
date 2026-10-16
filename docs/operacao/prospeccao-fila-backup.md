# Prospecção por fila de bairros e backup de telefones

## Planejamento da coleta

Na aba Planejamento semanal, A:B define o nicho de cada dia. A fila de regiões fica em D:F:

| Coluna | Campo | Preenchimento |
| --- | --- | --- |
| D | Bairro | Um bairro por linha |
| E | Cidade/UF | Município e sigla, por exemplo São Paulo/SP |
| F | Situação | Pendente ou vazia para pesquisar; o agente atualiza o andamento |

A rotina usa a primeira região pendente, um bairro por execução, até 50 empresas, nos dias úteis às 09h de São Paulo. Pode acrescentar regiões ao fim da fila ou reordenar as pendentes. Não repetir a mesma combinação bairro + cidade/UF. O Brás começa concluído porque sua coleta já existe no histórico local; os demais bairros iniciais foram mantidos da fila anterior.

Em processamento significa coleta ou publicação pendente. Concluído significa que a origem foi publicada e conferida. A ausência de linhas pendentes mantém o agente aguardando novas regiões, sem reiniciar concluídas. Não editar uma região enquanto ela estiver em processamento.

## Abas de trabalho e histórico

- planilha original scraping é substituída pela nova coleta completa quando o agente termina a conferência. Telefone continua na coluna A; CSVs antigos ficam preservados localmente.
- Validar numero whatsapp mostra válidos e inválidos da execução atual.
- Planilha exportar CRM mostra apenas empresas liberadas na execução atual, no modelo atual de nove colunas.
- Backup telefones é um histórico acumulado, com telefone na coluna A. Não é apagado nas limpezas. Registro aqui significa já reservado/liberado para prospecção; não comprova envio de WhatsApp.

## Workflow com backup

1. Ler a origem, o backup e a exportação anterior.
2. Salvar e conferir no backup os telefones da exportação anterior, antes de limpar qualquer resultado.
3. Limpar as duas saídas para receber o novo resultado, mantendo cabeçalhos e indicação de processamento.
4. Excluir da nova coleta telefones que já estejam no histórico; consultar os restantes na Evolution.
5. Gerar a nova exportação e acrescentar seus telefones ao backup na mesma publicação.
6. Conferir as saídas e o backup antes de concluir o relatório.

Telefones com ou sem máscara/DDI são comparados após normalização, sem acrescentar nono dígito. Repetidos são contados separadamente de inválidos. Uma nova execução da mesma coleta, depois de seus números terem sido reservados, poderá gerar uma exportação vazia. Números inválidos ou sem cadastro exportável não entram no backup só por terem sido consultados.

Se a preservação anterior falhar, os resultados antigos não são limpos. Se a consulta falhar depois da limpeza, as saídas permanecem incompletas e os novos telefones não são reservados. Confira a execução e os dados existentes antes de repetir. Não alterar origem ou backup durante a execução.

## Instalação do workflow

Esta versão é entregue em um JSON novo, sem credenciais. Em 16/10/2026 foi instalada pelo editor numa cópia do workflow, preservando o anterior. A conferência após reabrir o editor confirmou 38 nós, nomes sem sufixos, conexões Google Sheets account e Evolution account selecionadas e nenhum aviso de configuração. O novo fluxo se chama CRM Prospecção Validação WhatsApp Sheets com Backup. A instalação não comprova uma execução real: nenhuma validação ou coleta foi iniciada nesta entrega. Não usar o instalador de API da versão antiga.

Na primeira execução, os telefones que já estiverem em Planilha exportar CRM serão preservados no backup antes de limpar as saídas. Se a origem repetir a mesma lista, esses telefones serão ignorados e a nova exportação poderá ficar vazia. Não reexecutar apenas para testar sem considerar esse efeito.

A rotina de coleta foi atualizada para ler D:F e usar o coletor com região explícita. As fontes anteriores foram reservadas localmente; configuração e histórico da campanha foram preservados. Os testes usam dados sintéticos, sem Maps, Evolution ou importação no CRM.

O workflow não envia mensagens, não importa empresas no CRM e não altera a origem. O agente de coleta também não dispara o workflow; a execução segue manual.
