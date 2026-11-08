# Banco de empresas: histórico e empresas expansíveis

Data: 06/11/2026. Desenho e protótipo local, sem alteração do produto.

## Decisão do usuário

A opção A foi aprovada: Histórico de buscas como aba dentro da página Banco de empresas, ao lado de Buscar empresas. Não criar nova entrada no menu principal.

Em seguida o usuário refinou a navegação:

- Ver empresas substitui Ver busca e expande um acordeão abaixo do próprio card da pesquisa, fora do painel lateral.
- O card principal da busca tem os botões Ver empresas e Filtros usados.
- Cada empresa expandida tem somente Ver empresa como ação desta consulta.
- Filtros usados aparece somente no card principal do grupo e abre os critérios diretamente na lateral.
- Ver empresa abre a ficha cadastral na lateral, com os três grupos já aprovados.
- A lista de pesquisas começa recolhida, sem abrir dados automaticamente.
- Recolher uma busca não remove as empresas; fechar a lateral preserva as expansões e o contexto da página.

A confirmação A e esse refinamento substituem a proposta inicial de abrir Empresas encontradas e Filtros usados em um menu lateral de busca. A alternativa B permanece identificada como referência não escolhida.

## Organização do protótipo

A mesma lista fictícia mantém três pesquisas, inclusive uma sem resultados. Na pesquisa vazia, Ver empresas expande uma mensagem na página e Filtros usados continua disponível no card principal.

Mais de um grupo pode ficar aberto na prévia. Essa é uma escolha de composição do autor para permitir comparação, sem alterar a lista ou criar novas consultas.

As linhas mostram os nomes das empresas e o contexto regional da pesquisa. Como os resultados são amostras, o rodapé de cada expansão declara quantos exemplos estão representados nesta prévia. Não simula ter carregado todas as empresas.

A primeira ficha tem os dados demonstrativos completos da galeria. As demais conservam o nome escolhido e mostram Não informado nesta prévia onde não há dados demonstrativos próprios, sem reutilizar os contatos de outra empresa.

## Contexto e regras para a futura implementação

- O formulário de busca ao fundo é simplificado para focar a revisão do histórico; não propõe substituir seus campos.
- A aba Histórico abre automaticamente apenas na prévia. A página real conserva a entrada de busca, salvo navegação explícita para o histórico.
- Preservar todos os campos reais de HistoricoBuscas, inclusive horário de Brasília, solicitadas, retornadas, região, estado e motivo quando presentes.
- Preservar pesquisa, filtros, página, rolagem e grupos expandidos ao consultar e fechar dados ou filtros.
- Não adicionar paginação ou pesquisa onde o consumidor não as possui.
- Preservar a abertura de resultados após buscar e a recuperação do envio/inclusão anterior sem refazer consulta paga. Na composição aprovada, os resultados ficam na página.
- Manter inclusão automática, limites, bloqueios, regras comerciais e autorização atuais.
- Referências de empresa cadastrada e resultado de busca continuam distintas.
- Histórico do Banco não se transforma em histórico comercial ou de entregas Google.
- Consulta sem ação comercial não recebe rodapé artificial.
- O protótipo não envia buscas, integrações ou registros reais.

## Prévia

http://127.0.0.1:4338/?area=banco&view=pagina

## Situação

Histórico na página e empresas expansíveis aprovados pelo usuário, incluindo a confirmação final do refinamento em 06/11/2026. Próxima revisão planejada: organização dos critérios Google, sem reabrir as decisões já tomadas.

Nenhuma implementação, integração ou publicação do produto autorizada nesta rodada.
