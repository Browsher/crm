# Coletor da campanha local

AVISO — LEGADO V1 HISTÓRICO (14–16/10/2026). Este documento preserva contratos e relatos da V1; não descreve a operação atual nem autoriza coleta, importação, instalação ou reinstalação. A rotina das 09h, a fila global, o WhatsApp obrigatório para exportar e o manifesto CRM_DRIVE_V1 pertencem à V1 histórica. O Google V2 vigente usa planejamento por vendedor e rotina das 17h; consulte [Agente Google CRM](../../docs/operacao/agente-google-crm.md) e [Rotina do agente Google](../../docs/operacao/agente-google-rotina.md). Resultados e pendências relatados em 16/10 são evidências daquela data, sem afirmar o estado atual. Os procedimentos abaixo são referência histórica, não próximos passos operacionais. O motor Node, exportar_csv.mjs e o kit instalado são fronteiras externas: não foram copiados para este repositório e sua execução real não é coberta pelos testes offline.

Cópia revisável de `coletor.py` e `verificar_coleta.py` da campanha existente.
A configuração real, o motor, o exportador, os downloads, o histórico e as credenciais continuam na instalação local. `campanha.exemplo.json` contém somente configuração de exemplo, os 25 bairros legados e termos públicos de pesquisa.

## Interface e região

O agente que lê o Google Sheets seleciona uma região e repassa valores em argumentos separados. Este script não lê a planilha nem precisa de autenticação Google.

```powershell
$python = 'C:\Users\ADM\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$campanha = 'C:\Users\ADM\Desktop\Web Scraping\armarinhos'
& $python -X utf8 (Join-Path $campanha 'coletor.py') --rodar --fila-planejada --bairro 'Centro' --cidade 'Guarulhos' --uf SP
```

`--fila-planejada` exige `--bairro`, `--cidade` e `--uf` explícitos, com UF brasileira válida. Continua após o índice 25 e não altera `proximo_indice` da fila legada. A automação conserva a responsabilidade por status e ordem da fila online.

Sem esse modo, `--rodar` mantém São Paulo/SP, a ordem fixa da configuração e o avanço do índice legado. `--cidade` e `--uf` também podem ser informados no modo legado. `--limite` aceita de 1 a 50, com padrão da configuração (50). `--piloto` conserva o comportamento de teste operacional legado e também aceita a região; ele usa histórico próprio. Não utilizar piloto para validar alterações de código, pois ele chama o motor real.

Uma execução diária concluída impede outra execução diária, inclusive de outra região. Falhas preservam a pendência para retomada do mesmo job. A comparação da pendência inclui bairro, cidade e UF; pendências anteriores sem esses campos correspondem a São Paulo/SP. O job também precisa conter exatamente as palavras-chave esperadas. Downloads full, IDs, deduplicação, histórico, lock e reconciliação dos CSVs permanecem ativos.

Buscas e geocodificação incluem bairro, cidade e UF. A seleção aproveita os resultados retornados pelo motor sem exigir correspondência geográfica, inclusive bairros genéricos/diferentes e endereços incompletos. O endereço, bairro e cidade reais são preservados; a região pesquisada identifica a busca e a pasta, sem substituir a localização da empresa. Sites/e-mails são conferidos sem restrição geográfica. Permanecem os filtros de perfil, encerramento, histórico e limite. A conferência independente reconcilia o endereço selecionado com o download original. O resumo registra `filtro_geografico: false`; não há coluna de classificação dentro/fora do bairro.

As pastas diárias ficam dentro de `coletas`. No modo planejado, o nome é `AAAA-MM-DD_bairro_cidade_uf`, com nomes sanitizados. A saída explícita e a retomada também precisam resolver dentro de `coletas`; arquivos antigos não são apagados. Uma saída antiga fora dessa pasta é recusada para conferência manual, preservando o histórico.

Configuração, histórico e dependências podem ser isolados definindo `PROSPECCAO_CAMPANHA_DIR`. Sem a variável, o diretório do próprio script continua sendo a campanha, com o motor/exportador na pasta acima. `--estado` permite selecionar outro arquivo de histórico. Sem `--rodar`, `--piloto` ou `--processar`, o script somente informa o estado da fila legada.

`--processar RAW.csv --mapa TERMOS.json --bairro NOME --saida PASTA` conserva o processamento offline para fixtures, com as mesmas opções de região. Esse modo não chama motor/exportador e aceita pasta temporária explícita fora de `coletas`; os dados de entrada devem ser sintéticos para teste. Por compatibilidade, esse modo permite várias chamadas no mesmo dia e grava o histórico indicado. O modo diário mantém o limite de uma execução.

## Testes isolados

O coletor usa Python 3.10+ e somente a biblioteca padrão. A suíte completa também exercita `arquivo_drive.py`, cujo uso de [`Path.is_junction`](https://docs.python.org/3.12/library/pathlib.html#pathlib.Path.is_junction) exige Python 3.12+; não há pacotes Python a instalar. Motor Node, `exportar_csv.mjs`, Docker e kit instalado são dependências da operação histórica, substituídas por fixtures ou fronteiras simuladas nos testes offline.

Antes dos testes, mantenha `.env.local` e `.env.test.local` operacionais fora do ambiente de teste, sem ler seus valores. No Windows, preserve o ambiente do processo (inclusive PATH, TEMP/TMP, LOCALAPPDATA e VITEST) e esvazie explicitamente as quatro variáveis de integração:

```powershell
$env:GOOGLE_PLANILHA_N8N_URL = ''
$env:GOOGLE_PLANILHA_N8N_TOKEN = ''
$env:GOOGLE_VERIFICACOES_URL = ''
$env:GOOGLE_VERIFICACOES_TOKEN = ''
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONUTF8 = '1'
python -B -m unittest discover -s scripts/prospeccao-campanha -p 'test_*.py' -v
python -B -m unittest discover -s scripts/google -p 'test_*.py' -v
npm run test:unit -- src/prospeccao-base-python.test.ts src/google-agente-python.test.ts
```

Em POSIX, com os mesmos arquivos de ambiente isolados:

```sh
export GOOGLE_PLANILHA_N8N_URL='' GOOGLE_PLANILHA_N8N_TOKEN=''
export GOOGLE_VERIFICACOES_URL='' GOOGLE_VERIFICACOES_TOKEN=''
export PYTHONDONTWRITEBYTECODE=1 PYTHONUTF8=1
python3 -B -m unittest discover -s scripts/prospeccao-campanha -p 'test_*.py' -v
python3 -B -m unittest discover -s scripts/google -p 'test_*.py' -v
npm run test:unit -- src/prospeccao-base-python.test.ts src/google-agente-python.test.ts
```

Os testes usam campanha sintética em `TemporaryDirectory`, com limpeza restrita ao estágio temporário. Testes diários simulam a API, geocodificação, logs Docker e a fronteira do exportador; todo o processamento/deduplicação/reconciliação é real. Nenhuma busca Maps, leitura de leads/histórico real ou mensagem é realizada. A exportação Node instalada e o motor real não são executados por essa suíte.

O lock é exercitado por processos reais concorrentes no Windows (`msvcrt`) e em POSIX (`fcntl.flock`): uma segunda execução é recusada sem alterar o histórico, e saída normal, exceção ou encerramento liberam o lock persistente. `test_integracao_crm.py` carrega a ponte Google atual e o coletor versionado com configuração pública e motor fictício; bloqueia rede, subprocessos e importação do kit externo. O cenário V2 preserva candidata sem telefone, endereço e bytes do CSV bruto, sem executar o classificador legado.

`src/prospeccao-base-python.test.ts` inclui a suíte da campanha no comando unitário já usado pela CI, com `python` no Windows e `python3` nas demais plataformas, UTF-8 e bytecode desativado. O subprocesso deve retornar zero em até 60 segundos, com limite de 65 segundos no teste Vitest. O limite foi definido após medir cerca de 23 segundos para a suíte completa local; não altera os limites globais nem o wrapper Google existente. Para atualizar a lista de testes, `npm run test:inventario` já executa a unidade inteira antes de gravar o inventário.

## CSV original para arquivar no Drive

`arquivo_drive.py` recebe a matriz de strings já conferida para o Sheets. Não mapeia nem qualifica empresas e não acessa a rede. Exige Python 3.12 ou superior, disponível no runtime local da campanha.

```powershell
& $python -X utf8 (Join-Path $campanha 'arquivo_drive.py') --matriz 'matriz.json' --bairro 'Brás' --cidade 'São Paulo' --uf SP --data-coleta 2026-10-16 --horario 09:05:07 --lote 'job-001' --saida 'pasta-da-coleta'
```

A saída JSON indica `ok` e `comprovante`, com pasta/arquivo, CSV SHA-256, tamanho em bytes, quantidade sem cabeçalho, região, lote e caminhos. O CSV usa UTF-8 BOM, todos os campos entre aspas e CRLF. Um arquivo local igual é reutilizado; um diferente não é substituído. A automação salva o CSV no Drive, confere conteúdo e registra seu ID no manifesto A1 e em `publicacao_sheets.json`.

## Disparo automático da validação

Após publicar e conferir a origem, o agente usa `disparar_workflow.py` para chamar o Webhook privado. A configuração `.workflow-prospeccao.local.json` fica somente na pasta instalada da campanha e contém a autenticação. Não versionar nem imprimir essa configuração, seus cabeçalhos ou token.

```powershell
& $python -X utf8 (Join-Path $campanha 'disparar_workflow.py') --publicacao 'pasta-da-coleta\publicacao_sheets.json' --config (Join-Path $campanha '.workflow-prospeccao.local.json')
```

O comprovante mantém `spreadsheetId`, `sheetId`, `lote` e `manifesto` no formato existente. Antes do disparo, `origem_publicada`, `arquivo_drive_confirmado`, `leitura_retorno.conferida` e `leitura_retorno.publicacao_nova_conferida` precisam estar verdadeiros. O controle da chamada é persistido em `workflow_automatico`; Concluído na fila continua significando coleta publicada.

O workflow confere lote, hash e IDs antes de operar. Uma publicação já validada devolve o arquivo existente. O lock é local ao cliente da campanha; não há lock distribuído nem suporte a chamadas diretas concorrentes ou operação manual simultânea.

Se a resposta for incerta, não reenviar. O agente deve conferir as notas/dados da exportação e o arquivo no Drive, gerar um resultado JSON correspondente ao mesmo lote/hash e usar a opção `--reconciliar <resultado.json>`, que não envia rede. Sem evidência de conclusão, preservar pendência e resolver antes de buscar outro bairro. A conferência do arquivo final mantém os dois CSVs na mesma pasta da coleta.

## Fronteiras históricas e verificação offline

A instalação local de 16/10 mantinha motor Node, `exportar_csv.mjs`, configuração, histórico, downloads e credenciais fora do repositório. Esta cópia não inclui esse kit e não oferece receita de reinstalação. Os testes substituem essas fronteiras por mocks; não provam funcionamento da exportação Node instalada nem do motor real.

Para revisão desta cópia, use somente a suíte isolada acima, com fixtures públicas e diretórios temporários. Os exemplos operacionais anteriores documentam a interface V1 e não autorizam executar coleta, piloto, publicação, disparo de webhook ou instalação. Os guias Google V2 indicados no aviso são a referência da rotina vigente.