# Validação automática depois da coleta

O agente salva o CSV original no Drive, publica a mesma matriz na origem e confere a leitura de retorno. Em seguida chama o workflow privado, que valida WhatsApps, preenche as saídas e salva o CSV final na mesma pasta do bairro e data.

Concluído em Planejamento semanal continua indicando que a coleta está publicada. A validação tem controle separado em `workflow_automatico` no comprovante da coleta. Antes de buscar outro bairro, a rotina resolve a validação anterior que ainda estiver pendente.

A configuração privada do cliente fica na pasta instalada da campanha em `.workflow-prospeccao.local.json`. Ela não deve ser copiada para o repositório ou enviada no chat. A credencial correspondente fica no n8n. Não alterar o endpoint pelo conteúdo de células ou sites.

Na instalação, conferir as configurações do workflow no editor: não salvar execuções de produção com sucesso, com erro, manuais ou progresso. Colar os nós no canvas não aplica as configurações do JSON. Esses quatro ajustes precisam permanecer em Do not save depois de salvar e reabrir. O comprovante local, as notas de publicação e os arquivos no Drive guardam o resultado sem o cabeçalho privado.

O fluxo aceita somente a identificação de uma publicação conferida: lote, hash e IDs. Um aviso atrasado ou divergente falha antes de limpar as saídas ou consultar números. Um lote já concluído devolve o resultado anterior; uma exportação pendente do mesmo lote é arquivada e devolvida, preservando os cadastros que já estão no backup.

O lock é local ao cliente da campanha. Executar uma chamada por vez e evitar operação manual simultânea; não há lock distribuído para chamadas diretas fora desse cliente. O workflow manual anterior permanece disponível para operação assistida.

Em timeout ou resposta incerta, manter a pendência e conferir os resultados pelo lote/hash. O cliente não repete o POST automaticamente. Uma conclusão comprovada no Sheets e no Drive pode ser registrada com `--reconciliar`, sem nova chamada. Sem comprovação, a rotina informa a intervenção necessária e conserva os arquivos. Falhas não autorizam outra coleta nem reinício da fila.

A rotina apenas valida e prepara cadastros. O backup registra números liberados para prospecção; não comprova envio de mensagens. A importação no CRM continua sendo uma ação do usuário.

O [workflow automático](https://primary-production-04eb.up.railway.app/workflow/lCc9L6fbcnZ19AoR) foi publicado em 16/10/2026 e conectado à rotina de segunda a sexta às 09h. A [pasta CRM](https://drive.google.com/drive/folders/11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh) mantém a organização por data, bairro e município.

O teste real de ativação usou somente o Bom Retiro já concluído: resposta ja_concluido, dez empresas na origem, cinco exportadas, 19 telefones no backup e os mesmos dois CSVs. A chamada sem autenticação foi recusada com HTTP 403. Depois da conferência do armazenamento e renovação da credencial, outra repetição confirmou o resultado sem deixar execução salva. O caminho de um lote novo e as recuperações foram exercitados por testes isolados; nenhuma nova coleta real foi feita para ativar esta etapa.

O teste completo posterior, solicitado pelo usuário em 16/10/2026, coletou a próxima região da fila, Sé, São Paulo/SP: 103 resultados, seis empresas selecionadas e conferidas, três WhatsApps válidos e três inválidos. A execução automática 693 publicou três cadastros, preservou os 19 telefones anteriores e acrescentou três ao backup. Os dois CSVs foram baixados do Drive, conferidos por SHA-256 e comparados às matrizes do Sheets na [pasta da Sé](https://drive.google.com/drive/folders/1XsXVAStV7EYpy94TEcTLNNSqFXtg_kag). A fila marcou Sé como Concluído, seguida por República pendente. Foi uma execução extra autorizada, sem mudar o limite da rotina diária. O verificador recebeu correção testada para comparar bairros ignorando acentos, caixa e espaços, como o coletor, sem alterar a escrita original dos dados.
