# Disparo automático após publicação da coleta

## Pedido e resultado esperado

O usuário pediu: “Agora ajusta pra o workflow rodar automaticamente assim que o agente terminar de preencher a planilha de scraping, já salvando os dois CSVs no Drive.” O vendedor deixa de precisar abrir o n8n e clicar em Execute workflow depois de cada coleta do agente.

Continuam valendo a fila de um bairro por execução, até 50 empresas, a deduplicação por histórico, os telefones fixos com oito dígitos locais e a publicação de valores como texto. Não há envio de mensagens nem importação automática no CRM.

## Base conferida

- Planilha existente: `17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU`; origem `10151001`, validação `10151002`, exportação `10151003`, planejamento `10151004`, backup `10151005`.
- Gerador atual: `src/server/prospeccao-base/workflow-drive.ts`, que estende a variante de backup. O workflow manual instalado é `nfuGFTAn6Uqd17fH`.
- A execução operacional 689 terminou com sucesso, lendo dez empresas do Bom Retiro e exportando cinco. O Drive contém os dois CSVs na mesma pasta. O backup contém 19 números. Evidência local em `outputs/arquivos-prospeccao-drive-2026-10-16/teste-operacional.json` do workspace principal.
- O agente já gera e verifica o CSV original antes de publicar a origem. A nota A1 contém manifesto `CRM_DRIVE_V1` com lote, hash dos bytes, região e IDs do arquivo/pasta. O workflow recupera uma exportação pendente no Drive antes de limpar as saídas.

## Integração proposta

Usar uma chamada HTTP privada do agente para um Webhook POST publicado no n8n, com autenticação por cabeçalho. Essa escolha é de implementação: evita disparos por cada linha alterada e permite avisar somente depois da conferência final da publicação. Não depende de o agente operar o editor do n8n.

1. O agente conclui a coleta e salva/confere o CSV original no Drive, como hoje.
2. Publica a origem em uma gravação conjunta e confere matriz, manifesto e ausência de sobras. Só então marca a região como Concluído na fila; esse estado continua significando coleta publicada. O estado separado da validação fica no comprovante local.
3. Inicia a etapa automática passando somente identificação da publicação: versão, lote, hash CSV da origem e IDs da planilha, aba, pasta e arquivo original. Não enviar os cadastros nem aceitar destinos arbitrários no corpo da chamada.
4. O n8n autentica, valida o sinal e relê a publicação. Lote, hash e IDs devem corresponder ao manifesto e aos dados atuais. Um sinal atrasado, incompleto ou de outra origem é recusado antes de limpar ou consultar WhatsApps.
5. Executa a lógica já validada de backup, consultas Evolution, publicação/conferência das saídas e arquivo CSV final na pasta da origem.
6. A resposta e o comprovante local registram execução, contagens, pendências, arquivo/pasta e hash. O agente confere o resultado antes de anunciar conclusão. Falta de telefone permanece pendência de dados, sem impedir o arquivo dos demais válidos.

O workflow manual atual permanece disponível e os geradores anteriores mantêm seus contratos. Uma variante automática separada é instalada e publicada; a automação passa a apontar para ela. Publicar é necessário para o endereço de produção do Webhook funcionar.

## Repetição, concorrência e retomada

O lote da coleta é imutável e associado a uma assinatura da origem. O fluxo automático deve reconhecer um lote já concluído e devolver o resultado existente, sem limpar saídas, repetir consultas, acrescentar telefones ou criar outro CSV. Quando houver assinatura anterior, o mesmo lote com outro hash é conflito. Um lote legado já concluído não deve ser reprocessado automaticamente apenas por faltar um campo novo de controle; preservar a exportação e informar/reutilizar o resultado conhecido com conferências disponíveis.

Uma exportação pendente do mesmo lote deve ser arquivada e devolvida como resultado existente, sem revalidar a lista e produzir uma exportação vazia por causa do backup. Pendência de outro lote é resolvida antes de processar o novo lote, preservando a pasta correta.

A rotina mantém um único disparo em andamento no computador da campanha, com lock local e comprovante persistido antes da chamada. Não há novo banco, Redis ou alteração global de concorrência da instância n8n. Chamadas concorrentes feitas diretamente fora do cliente da campanha e operação manual simultânea não são suportadas; não prometer lock distribuído. O desenho e a documentação devem tornar esse limite claro.

Timeout, queda de conexão ou resposta incerta não autorizam um novo POST automático. Antes de qualquer retomada, reconciliar os manifestos/resultados pelo lote e assinatura; se houver processamento em andamento, aguardar, e se não for possível comprovar o estado, manter pendência para intervenção. O bloqueio não pode causar nova coleta nem perda dos resultados já escritos. Não remover locks de processo vivo nem presumir falha somente pelo tempo decorrido.

Uma falha na chamada automática não desfaz a origem ou o original arquivado. O próximo ciclo retoma a validação pendente antes de buscar outro bairro. Publicação ou conferência da origem que falhou não dispara o n8n.

## Credenciais e operação

Criar uma credencial Header Auth exclusiva no n8n e guardar o segredo somente em arquivo privado local da campanha, fora de Git, CSVs, comprovantes, export do workflow e respostas do chat. O arquivo de configuração informa o endpoint de produção e os IDs esperados; logs e erros não podem revelar o cabeçalho, segredo ou conteúdo de respostas sensíveis. A chave é gerada pelo sistema, sem solicitar que o usuário a envie pelo chat.

Reutilizar Google Sheets account, Evolution account e N8N Google Drive ds. Não alterar compartilhamento, banco do CRM, variáveis globais da Railway ou outras automações/workflows. Preservar horário, modelo e notificações atuais da rotina Codex.

Atualizar o prompt da automação, instruções instaladas e guia de operação para a nova etapa. Remover a orientação de que o usuário precisa executar o n8n manualmente nessa rotina. Manter a proibição de mensagens comerciais e importação no CRM.

Rejeição por revisão automática de autorização não pode ser contornada por outro meio de acesso. Preservar a pendência e informar a ação e o motivo, seguindo as regras do ambiente. A ligação automática não altera esse controle.

## Critérios de aceite

- Testes com HTTP simulado e código exportado: disparo após publicação conferida, autenticação, corpo inválido, sinal de outro lote/hash/IDs, sucesso e leitura do resultado, lote já concluído, pendência de mesmo/outro lote, resposta incerta e concorrência local. TDD antes do código.
- JSON exportado sem credenciais; tipos, lint e contratos das variantes anteriores aprovados.
- Credencial/configuração privada instalada sem revelar o segredo. Workflow automático publicado e conexões conferidas após reabrir.
- Teste real limitado ao lote do Bom Retiro já concluído deve provar autenticação e resposta de repetição sem alterar os cinco exportados, os 19 números do backup ou os dois CSVs existentes. Testes sintéticos provam o caminho de lote novo sem consumir outro bairro nem burlar o limite diário.
- A próxima publicação nova do agente fica conectada à etapa automática. Distinguir no relatório os caminhos comprovados por teste real e por simulação.

## Decisões que ficam com a implementação

Nomes dos arquivos, funções, campos internos de controle, mensagem do cabeçalho e formato exato da resposta podem ser definidos pelo implementador, mantendo versionamento e os contratos acima. O tempo da chamada e as leituras de reconciliação devem ter limites explícitos; expiração de tempo mantém pendência e nunca significa confirmação de sucesso ou autorização para reenviar.

## Referências conferidas

- [Webhook n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/): POST, Header Auth, resposta ao terminar e publicação do endereço de produção.
- [Especificação dos CSVs no Drive](2026-10-16-arquivos-prospeccao-drive-design.md): armazenamento e retomada existentes.

Builder check independente: nothing important left. Em 16/10/2026, o usuário aprovou expressamente implementar e ativar este desenho.
