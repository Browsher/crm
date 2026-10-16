# Arquivos CSV por coleta no Drive

Spec: docs/superpowers/specs/2026-10-16-arquivos-prospeccao-drive-design.md. Builder check independente: nothing important left. Escolhas de CSV e organização aprovadas nas respostas do usuário; detalhes de retomada são implementação para preservar os dados já autorizados. Usar worktree/branch e PR #53 existentes. Não fazer merge.

## Contrato comum

- Raiz CRM conferida: 11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh. Subpasta `AAAA-MM-DD - Bairro - Cidade-UF`, usando data de coleta de São Paulo. Nomes seguros, sem controles/barra; não juntar bairros homônimos de municípios diferentes.
- CSV exato da matriz de strings, UTF-8 BOM, vírgula, todos os campos entre aspas, aspas duplicadas, CRLF inclusive ao final. SHA-256 dos bytes do CSV. Não converter strings numéricas, perder zeros, acrescentar nono dígito ou eliminar extras da origem.
- Nomes mantêm Unicode; escapar caracteres proibidos Windows, controles e todo hífen dinâmico como %XX, incluindo % como %25, para evitar colisões inclusive entre as fronteiras de componentes. Somente o template acrescenta seus separadores literais. Matriz local retangular; leituras Sheets completam células vazias finais até a largura do cabeçalho antes de comparar o mesmo CSV. Rejeitar valores preenchidos além dessa largura.
- Fallback manual não exige uma coluna UF que o contrato anterior não tinha: usar UF publicada quando inequívoca; sem ela, permitir UF vazia somente no contexto manual/exportação e omitir o sufixo da pasta. O agente sempre fornece UF válida da fila.
- Nota A1 com texto humano preservado e uma linha `CRM_DRIVE_V1:` seguida de JSON. Manifesto versionado, validado como dados: tipo origem/exportacao, raizId, pastaId, bairro, cidade, uf, dataColeta, lote, nome, csvSha256, linhas, estado pendente/salvo, arquivoId quando salvo. Exportação inclui execucaoId e dataExecucao. Origem salva inclui identificador do arquivo original.
- Arquivo original usa lote estável da coleta. Arquivo CRM usa execução estável; retomada mantém o mesmo nome e hash. Arquivo diferente/ambíguo não é sobrescrito. Conteúdo/ID/pasta precisam de conferência, além de nome.
- Pasta declarada por uma nota/célula não pode desviar dados: confirmar que é pasta não excluída com pai igual à raiz CRM configurada. Query Drive sempre escapa literais; não executar conteúdo de células.

## Tarefa 1: variante n8n e testes (worker exclusivo TypeScript)

1. RED para serialização/manifestos/nomes/retomada e workflow exportado. Criar helper em src/lib/prospeccao-base/arquivos-drive.ts e testes; variante src/server/prospeccao-base/workflow-drive.ts e testes/CLI novos. Não alterar contrato de gerarWorkflowComBackup/gerarWorkflowSimples; wrapper novo estende config com driveRaizId. Alterações mínimas no bundler somente se necessárias, mantendo caches anteriores isolados.
2. Conferir contratos dos nós Drive na documentação/código oficiais da versão instalada. Usar nativos para busca/criação/upload/download; HTTP autenticado permitido para metadados/atualização de notas. Não incluir credenciais no JSON. Conexão Drive selecionada no editor.
3. Acrescentar leitura dos manifestos antes de qualquer limpeza. Resolver exportação anterior com arquivo pendente, conferindo hash e arquivo determinístico, antes de consultas/limpeza; leitura ou upload falhos preservam tudo. Sem pendência, seguir fluxo existente. Notas legadas sem manifesto não afirmam ter arquivo Drive.
4. Associar nova execução à pasta da origem. Validar manifesto/hash; fallback de origem manual sem manifesto exige bairro/data inequívocos nos dados, sem inferir pelo termo. Não aceitar nota antiga com hash divergente.
5. Acrescentar manifesto pendente na mesma escrita atômica dos dados finais + backup. Após conferir as três abas, salvar CSV da matriz CRM conferida, verificar arquivo, concluir notas com arquivoId e incluir link no relatório. Exportação vazia salva só cabeçalho. Em falha, manifesto pendente permite recuperar sem perder a exportação na próxima execução.
6. Cobrir no harness JS real: sucesso, falhas antes/depois da gravação, arquivo já existente, divergência de hash/pasta, origem alterada/notas antigas, vazio, telefones fixos, zeros, recuperação com outra origem atual e preservação dos contratos legados. Provar RED/GREEN. Sem APIs reais, uploads de leads, validações ou mensagens.
7. Entregar CLI gerar-workflow-drive.mts com JSON separado, sem credenciais/pinData; typecheck/lint/focused tests. Não commitar nem instalar em serviços reais.

## Tarefa 2: construtor CSV local e testes (worker exclusivo Python)

1. Criar arquivo_drive.py e test_arquivo_drive.py em scripts/prospeccao-campanha, usando apenas biblioteca padrão. Entrada: arquivo JSON de matriz de strings + região/data/lote por argumentos; saída CSV e comprovante com nome de pasta/arquivo, sha256, bytes e linhas. CLI não conecta Google e não modifica coleta/histórico.
2. RED para escapes, zeros/DDD, acentos, cabeçalho, campos não-string, região/data inválidas, nomes seguros, saída existente divergente; GREEN. Região e data explícitas; não inferir bairro ou data do computador sem instrução do agente. Saída nova ou exatamente igual aceita, divergência não sobrescreve.
3. Original e exportação usam o contrato CSV comum. Não mapear/requalificar os leads: o agente fornece a matriz já conferida usada para Sheets. Não alterar coletor.py, configuração, histórico ou dependências reais. Não commitar nem instalar na campanha.

## Tarefa 3: integração e rotina (root)

1. Aguardar revisões independentes e testes; instalar somente o helper novo e instruções atualizadas, sem substituir configuração/histórico. Reservar instruções anteriores.
2. Atualizar automação pela ferramenta: manter horário, estado, nicho e fila; gerar matriz/CSV, criar/reusar pasta, subir e conferir arquivo original, publicar origem + manifesto, conferir e concluir região. Persistir publicacao_sheets.json com arquivo Drive e pendências; retomada sem job novo nem arquivo repetido.
3. Validar nomes da pasta raiz/metadados; preservar compartilhamento. Não criar cópias retroativas da lista atual como se fossem novas execuções.
4. Gerar JSON de entrega, instalar pelo editor em cópia do fluxo atual, selecionar Google Sheets account, Evolution account e N8N Google Drive ds. Confirmar salvamento sem avisos. Apenas conferir acesso Drive por leitura isolada, sem acionar o processamento da lista.
5. Conferir artefatos, prompt por leitura de retorno, hashes de arquivos/histórico/configuração e testes focados. Atualizar guia e PR; relatar claramente instalação versus execução real. Manter arquivos anteriores, outputs e worktree.
