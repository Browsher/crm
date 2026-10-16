# CSVs de cada coleta e validação no Drive

Data: 16/10/2026. Extensão da rotina de prospecção e do workflow com backup existentes.

## Decisões do usuário

- Guardar no Drive arquivos separados de planilha original scraping e Planilha exportar CRM a cada execução dos respectivos responsáveis: agente de coleta e workflow.
- Formato CSV, para baixar/importar no CRM.
- Usar a pasta CRM encontrada no Drive e organizar por bairro buscado + data.

## Organização proposta

Pasta raiz CRM, ID 11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh, conferida por busca e listagem (vazia nesta inspeção). A planilha base permanece onde está.

Cada coleta usa uma subpasta como `2026-10-16 - Bom Retiro - São Paulo-SP`. Incluir município/UF evita confundir bairros homônimos; a data é a data da coleta em America/Sao_Paulo. Ambos os arquivos ficam nessa mesma subpasta, mesmo quando a validação acontece em outro dia.

Exemplos de arquivos:
- `planilha original scraping - 2026-10-16_09-00-00 - lote-<id>.csv`
- `Planilha exportar CRM - 2026-10-16_09-15-00 - exec-<id>.csv`

Conservar arquivos anteriores. Uma nova validação gera outro arquivo; uma retomada da mesma publicação reutiliza seu identificador e confere o arquivo existente antes de criar outra cópia. Nome não é prova de igualdade: conferir tipo, pasta e conteúdo/hash. Se houver mais de uma correspondência ambígua ou conteúdo divergente, interromper sem substituir arquivos.

## Agente: CSV original

Após coletar e conferir os dados, gerar um CSV da matriz exata preparada para a aba de origem: telefone na coluna A, nove primeiras colunas atuais e todos os extras preservados. Não subir o bruto nem trocar silenciosamente o esquema pelo CSV local antigo de outros cabeçalhos.

CSV UTF-8 com BOM, vírgulas, aspas/escapes corretos e identificadores preservados como strings. Guardar uma cópia local junto da coleta. Criar/reutilizar a pasta da região e salvar/conferir o arquivo no Drive antes da publicação da nova origem. Depois publicar a matriz e sua identificação na nota A1, em uma gravação, e conferir o conteúdo.

Adicionar ao comprovante publicacao_sheets.json e à nota A1 um manifesto versionado com lote, bairro, cidade/UF, data da coleta, pasta Drive, arquivo original, nome, hash da matriz/CSV e estado. A situação Concluído exige CSV no Drive e origem conferidos. Se a gravação no Drive ou Sheets falhar, manter a pendência e retomar o mesmo CSV; não coletar outro bairro nem criar arquivos duplicados. O agente continua sem consultar Evolution, disparar n8n ou importar no CRM.

## Workflow: CSV de exportação

Criar uma variante do gerador com backup, mantendo os geradores existentes compatíveis. A conexão de Google Drive será selecionada no editor; preferir os nós nativos de Drive para arquivos. Manter leituras nativas de Sheets e consultas Evolution atuais.

Antes de limpar resultados, ler os contextos de origem e exportação. Usar o manifesto da origem para associar a validação à pasta correta, conferindo a identidade da matriz. Para origem legada/manual sem manifesto, aceitar somente bairro, cidade e data de coleta inequívocos nos dados, criar/reutilizar a pasta correspondente e registrar o contexto; ausência/ambiguidade bloqueia antes de limpar e informa quais dados faltam. A origem legada não exigia coluna UF: quando não houver UF inequívoca publicada, o contexto manual permite UF vazia e omite o sufixo da pasta, sem inventar estado. Não inferir bairro pelo termo da busca nem reaproveitar uma nota de outra matriz.

O CSV final tem exatamente o cabeçalho e as nove colunas da exportação CRM atual, preservando zeros e telefones. Gerar a partir da matriz efetivamente publicada e conferida, sem reler uma origem alterada durante o processamento. Se não houver empresas exportáveis, guardar o arquivo com o cabeçalho e informar zero empresas.

Manter o fluxo existente de backup anterior, limpeza das saídas, exclusão de telefones históricos, validação e gravação conjunta de saídas + novos telefones no backup. Na mesma publicação dos dados finais, registrar na nota da exportação um manifesto de arquivo pendente: pasta, região, lote, execução, nome determinístico, quantidade e hash do CSV. Depois da conferência integral das duas saídas e backup, enviar/conferir o CSV no Drive. Só então concluir notas e relatório com o ID/link do arquivo salvo.

Se o envio ao Drive falhar depois de publicar saídas/backup, preservar ambos e deixar arquivamento pendente. Ao iniciar novamente, antes de limpar resultados ou consultar WhatsApp, resolver o CSV pendente usando a exportação e seu manifesto, mesmo quando a origem já for de outra coleta. Divergência entre a matriz e o hash pendente impede continuar. Uma gravação de resultado incerto procura e confere o arquivo determinístico antes de reenviar. Não repetir consultas nem reservar novamente números só para recuperar um arquivo. Depois de preservar a pendência, pode continuar o ciclo solicitado normalmente.

Exportações legadas sem manifesto não afirmam possuir arquivo histórico no Drive. O backup de telefones anterior continua obrigatório antes da limpeza. Arquivos salvos a partir desta versão registram seu estado completo e verificável.

## Conexões, entrega e testes

A conexão `N8N Google Drive ds` (Google Drive OAuth2 API) foi localizada na lista de credenciais do projeto Personal. Conferir seu acesso à pasta CRM, sem abrir/expor chaves ou tokens. Se faltar autenticação, entregar primeiro o JSON/configuração concretos e indicar exatamente a conexão que o usuário precisa autorizar; não substituir por credenciais expostas no código.

Não alterar compartilhamento da pasta/arquivos, não apagar históricos e não disparar busca, validação ou mensagens reais só para testar. Atualizar a automação e instruções de operação após aprovação, preservando horário, nicho, fila, lock, limites e estado.

TDD: CSV com vírgulas/aspas/quebras/acentos/zeros, cabeçalho vazio, pasta e data por região, arquivos separados, datas de coleta/validação distintas, retomada sem duplicação, falhas de upload/verificação, manifesto divergente, recuperação antes da limpeza, backup e contratos legados. Testar o JavaScript exportado no runner sintético. Conferir tipos/lint e gerar novo JSON sem credenciais. Instalar pelo editor preservando o fluxo anterior e confirmar o salvamento, sem executar a lista real. Reutilizar worktree/branch e PR existentes, sem merge na main.

## Escolhas deixadas ao implementador

Estrutura interna das funções/arquivos, identificador curto dos nomes, implementação da conferência de conteúdo e detalhes dos nós n8n. Esses detalhes devem respeitar os contratos descritos, a versão instalada 2.36.8 e as permissões disponíveis. Incluir na documentação qualquer etapa que dependa de conexão do usuário.
