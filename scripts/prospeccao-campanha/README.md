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

## Instalação após revisão

Instalar somente `coletor.py` e `verificar_coleta.py`. Não substituir `campanha.json`, `historico.json`, `coletas`, motor, exportador ou credenciais. O controlador executa a instalação; este bloco é a receita revisável e não foi executado pela tarefa do coletor.

```powershell
$origem = 'C:\Users\ADM\.codex\worktrees\producao-vercel\crm\scripts\prospeccao-campanha'
$destino = 'C:\Users\ADM\Desktop\Web Scraping\armarinhos'
$reserva = Join-Path $destino ('fontes-anteriores-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $reserva | Out-Null
foreach ($arquivo in @('coletor.py', 'verificar_coleta.py')) {
    Copy-Item -LiteralPath (Join-Path $destino $arquivo) -Destination (Join-Path $reserva $arquivo)
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
