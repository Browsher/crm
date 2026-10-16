# Fila de regiões e backup de telefones da prospecção

Data: 2026-10-16. Extensão da campanha e do workflow já autorizados neste chat.

## Objetivo e decisões do usuário
- A skill Mahanaicoach instalada atende à coleta; conservar o coletor e o motor existentes.
- Planejamento semanal mantém nicho por dia e ganha uma fila editável de bairro + cidade, um por execução.
- A rotina substitui a aba planilha original scraping pela coleta nova completa.
- O workflow preserva telefones da exportação anterior em backup antes de limpar os resultados; valida somente números ausentes no histórico e gera nova exportação.
- Ao concluir, também registra no backup os telefones das empresas liberadas para CRM. Isso é reserva/histórico de prospecção, não comprovação de mensagem enviada.
- Validar numero whatsapp e Planilha exportar CRM são resultados do lote atual. Backup telefones é cumulativo e nunca participa da limpeza.

## Planilha existente
Spreadsheet 17uQ8KmuboL808cvb9M9piIhZwCfHYDJRJ5uw2bUAxvU, privada.
Preservar origem 10151001, validação 10151002, exportação 10151003, planejamento 10151004.
A aba recém-criada 10151005 será renomeada para Backup telefones. Cabeçalho A1 telefone, dados texto desde A2. Não importar como contatados números apenas validados sem cadastro exportado.

Em Planejamento semanal:
- A1:B6 conserva Dia da semana | Nicho, segunda a sexta, Armarinhos e variedades.
- D1:F contém Bairro | Cidade/UF | Situação. Cidade/UF usa São Paulo/SP como exemplo.
- Migrar os 25 bairros de campanha.json, na mesma ordem; Brás já concluído pelo histórico real; os demais pendentes.
- O usuário pode alterar, excluir e acrescentar regiões. Selecionar primeira linha Pendente, ignorando linhas vazias e Concluído. Registrar Em processamento enquanto coleta/publicação está pendente; Concluído após conferência da publicação na origem.
- Bairro e município não vazios, UF brasileira válida; rejeitar duplicação de região e linha parcialmente preenchida antes de criar job. Toda validação é por valores, não executa conteúdo de células.
- A fila online substitui a posição fixa dos 25 bairros. Não reiniciar nem pausar definitivamente a automação por fila vazia: informar uma vez e aguardar novas linhas, sem avisos repetidos.

## Coletor
Versionar uma cópia revisável do coletor e seus testes no repositório; instalar os arquivos aprovados na campanha local existente após testes.
Adicionar cidade/UF e modo fila planejada, preservando São Paulo/SP e fila legada por padrão para retrocompatibilidade.
A execução da fila online recebe bairro, cidade e UF explicitamente; não modifica proximo_indice da fila legada e não bloqueia após 25 bairros.
Usar região completa nas buscas e geocodificação; filtrar endereço pelo bairro e município selecionados, sem inferir região pelo termo.
Preservar proteção diária, lock, retomada do mesmo job, histórico de empresas e CSV completo. Pendência registra cidade/UF; não retomar job de outro município homônimo.
Pasta da coleta inclui cidade/UF no novo modo, com nomes seguros dentro de coletas. Não apagar dados antigos.
Conferência usa a cidade do resumo; coleta de outro município precisa passar com endereços coerentes.
Instrução da automação lê a skill e o planejamento antes da coleta; a seleção online e as opções específicas prevalecem sobre exemplos genéricos da skill.
A publicação substitui valores da origem em uma gravação somente quando a nova coleta estiver pronta. Não limpar na largada nem operar durante validação em andamento. CSV anterior permanece local.

## Workflow com backup
Manter gerador simples existente e sua compatibilidade; criar variante com backup, reutilizando suas consultas, formatação, modelos e validação.
1. Ler metadados, origem, backup e exportação anterior por nós Google Sheets nativos.
2. Validar a origem e os cabeçalhos de backup/exportação antes de alterar células. Normalizar telefone com DDI 55 + DDD, preservando fixos de oito dígitos locais; jamais inventar nono dígito ou DDD.
3. Unir os telefones anteriores ao histórico sem duplicá-los. Persistir e conferir o backup antes de qualquer limpeza. Se a preservação falhar, interromper com os resultados anteriores intactos.
4. Limpar validação/exportação para seus cabeçalhos e marcar em processamento. A origem e o planejamento ficam intactos.
5. Excluir das consultas e da exportação todas as empresas com telefone presente no histórico consolidado. Contabilizar repetidos separadamente de inválidos de WhatsApp.
6. Validar os números restantes pela Evolution, mantendo lote 10, intervalo e uma repetição para inconclusivos. Falha/inconclusivo persistente não vira número inválido nem reserva novos telefones.
7. Montar saída CRM no contrato atual de nove colunas, CNPJ opcional com Place ID; manter regras de cadastro, tamanho e conflitos existentes.
8. Antes de publicar, reler backup; se foi alterado durante a execução, interromper antes da gravação final. Executar uma gravação atômica com as saídas novas e o acréscimo dos novos telefones exportados ao backup.
9. Conferir integralmente as duas saídas e o backup antes de concluir as notas e relatório. Relatório inclui repetidos ignorados e total no backup; mensagensEnviadas permanece zero.

O backup é acumulativo: conservar registros existentes; acrescentar apenas novos números, ampliando grade quando necessário. Uma entrada preenchida e ilegível bloqueia sem descartá-la. Registros duplicados preexistentes não causam perda: deduplicação é lógica.
Nova execução da mesma origem, depois de sua exportação reservada, exclui esses telefones e pode gerar somente cabeçalhos. Reexecução não é confirmação de envio. Em falha após escrita, conferir os dados existentes antes de reexecutar; não declarar sucesso sem leitura de retorno.
Não enviar mensagens, não importar no CRM e não acionar coletas reais como teste. Não alterar usuários, credenciais ou compartilhamento.

## Entrega e verificação
- Testes primeiro para normalização/deduplicação, preservação antes da limpeza, exclusão de repetidos, crescimento do backup, falhas e readback.
- Testes com dados sintéticos isolados para outro município, nomes homônimos e retomada; nenhum teste altera histórico real.
- Gerar JSON novo sem credenciais, copiar para outputs da pasta principal, preservar versões anteriores.
- Conferir alterações nativas e visualmente na planilha, incluindo fila e backup. Não apagar os resultados atuais enquanto instala a estrutura.
- Importação no n8n continua pelo editor, conforme escolha anterior do usuário. A entrega local e a execução remota são estados separados; não afirmar workflow instalado/rodado sem evidência.
- Reutilizar worktree e branch codex/base-prospeccao-n8n / PR #53, sem commit na main e sem merge.
