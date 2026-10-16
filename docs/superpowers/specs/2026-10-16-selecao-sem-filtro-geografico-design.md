# Seleção sem filtro geográfico exato

## Pedido e decisão

Em 16/10/2026, após revisar o funil da coleta da Sé, o usuário determinou:
“Se ele puxou as empresas no scraping, vamos utilizar elas assim mesmo! Retira essa identificação”.

Bairro, cidade e UF continuam orientando as palavras-chave, a geocodificação,
a identidade da execução e sua pasta. A localização retornada pelo Maps deixa
de ser critério de elegibilidade. Não classificar como fora do bairro nem
substituir o endereço real pela região pesquisada. Endereço incompleto também
não impede a seleção. A confirmação de site/e-mail deve alcançar os resultados
retornados, sem restrição por bairro.

Permanecem os filtros de perfil comercial, encerramento, duplicidade e limite
de 50. O workflow mantém a validação de WhatsApp e seu histórico de telefones.
O coletor e sua conferência independente devem aceitar a mesma seleção.
Atualizar as instruções instaladas e a automação existente, preservando os
demais parâmetros e agendamento. Nenhuma coleta, revalidação ou substituição
da lista já publicada faz parte desta alteração.

## Implementação e conferência

1. Testes falhando: bairros diferentes/genéricos/ausentes e cidades/UFs
   diferentes devem permanecer elegíveis, com localização original preservada.
2. Retirar o filtro do coletor e a exigência geográfica do verificador.
3. Manter reconciliação do endereço selecionado com o download original.
4. Atualizar documentação e instruções da rotina; instalar somente os arquivos
   alterados, conferindo seus hashes e preservando configuração/histórico.
5. Executar a suíte da campanha e as verificações do projeto; registrar o
   resultado na branch existente e no PR aberto.
