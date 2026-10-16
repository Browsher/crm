# Coletor da campanha local

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

Buscas e geocodificação incluem cidade/UF. A seleção usa o bairro e a cidade do endereço informado pelo motor. Se houver estado no endereço, ele também precisa corresponder à UF (sigla ou nome completo); endereço sem estado conserva a compatibilidade legada. A conferência independente usa a cidade do resumo, ignorando diferenças de caixa/acentos; resumo antigo sem cidade mantém São Paulo como padrão.

As pastas diárias ficam dentro de `coletas`. No modo planejado, o nome é `AAAA-MM-DD_bairro_cidade_uf`, com nomes sanitizados. A saída explícita e a retomada também precisam resolver dentro de `coletas`; arquivos antigos não são apagados. Uma saída antiga fora dessa pasta é recusada para conferência manual, preservando o histórico.

Configuração, histórico e dependências podem ser isolados definindo `PROSPECCAO_CAMPANHA_DIR`. Sem a variável, o diretório do próprio script continua sendo a campanha, com o motor/exportador na pasta acima. `--estado` permite selecionar outro arquivo de histórico. Sem `--rodar`, `--piloto` ou `--processar`, o script somente informa o estado da fila legada.

`--processar RAW.csv --mapa TERMOS.json --bairro NOME --saida PASTA` conserva o processamento offline para fixtures, com as mesmas opções de região. Esse modo não chama motor/exportador e aceita pasta temporária explícita fora de `coletas`; os dados de entrada devem ser sintéticos para teste. Por compatibilidade, esse modo permite várias chamadas no mesmo dia e grava o histórico indicado. O modo diário mantém o limite de uma execução.

## Testes isolados

```powershell
& 'C:\Users\ADM\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -X utf8 -m unittest discover -s scripts/prospeccao-campanha -p 'test_*.py' -v
```

Os quatro testes legados e os novos usam campanha sintética em `TemporaryDirectory`, com limpeza restrita ao estágio temporário. Testes diários simulam a API, geocodificação, logs Docker e a fronteira do exportador; todo o processamento/deduplicação/reconciliação é real. Nenhuma busca Maps, leitura de leads/histórico real ou mensagem é realizada. A exportação Node instalada e o motor real não são executados por essa suíte.

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

## Instalação após revisão

No n8n, manter desativada a gravação de execuções com sucesso, com erro, manuais e de progresso desta variante privada. Colar os nós no canvas não importa as configurações do JSON: conferir os quatro ajustes em Do not save depois de salvar e reabrir. O comprovante local e os arquivos no Drive conservam o resultado sem o cabeçalho de autenticação.

Instalar as fontes revisadas `coletor.py`, `verificar_coleta.py`, `arquivo_drive.py`, `disparar_workflow.py` e as instruções atualizadas. Não substituir `campanha.json`, `historico.json`, `coletas`, motor, exportador ou credenciais. O controlador executa a instalação; este bloco é a receita revisável e não foi executado pela tarefa do coletor.

```powershell
$origem = 'C:\Users\ADM\.codex\worktrees\producao-vercel\crm\scripts\prospeccao-campanha'
$destino = 'C:\Users\ADM\Desktop\Web Scraping\armarinhos'
$reserva = Join-Path $destino ('fontes-anteriores-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $reserva | Out-Null
foreach ($arquivo in @('coletor.py', 'verificar_coleta.py', 'arquivo_drive.py', 'disparar_workflow.py', 'INSTRUCOES.txt')) {
    if (Test-Path -LiteralPath (Join-Path $destino $arquivo)) {
        Copy-Item -LiteralPath (Join-Path $destino $arquivo) -Destination (Join-Path $reserva $arquivo)
    }
    Copy-Item -LiteralPath (Join-Path $origem $arquivo) -Destination (Join-Path $destino $arquivo)
    if ((Get-FileHash -LiteralPath (Join-Path $origem $arquivo)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $destino $arquivo)).Hash) {
        throw ('Cópia divergente: ' + $arquivo)
    }
}
```

A conferência de uma coleta pronta usa a pasta indicada pelo resumo:

```powershell
& $python -X utf8 (Join-Path $campanha 'verificar_coleta.py') (Join-Path $campanha 'coletas\AAAA-MM-DD_centro_guarulhos_sp')
```
