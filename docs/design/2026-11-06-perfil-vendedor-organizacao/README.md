# Perfil do vendedor: organização da página

Data: 06/11/2026. Comparação local com dados fictícios, sem alterações no produto.

## Contexto

O usuário aprovou o menu Ações na linha dos usuários e perguntou o que Ver perfil mostra. O conteúdo atual foi conferido no código. Depois autorizou seguir para o próximo ajuste.

Esta rodada compara a organização dessa página. Após A e B, o usuário pediu uma opção C com botões abrindo Empresas e Atendimentos na lateral. A identificação e os indicadores permanecem na página. Nenhuma opção adiciona operações comerciais.

## Conteúdo preservado

Fontes lidas nesta rodada:

- app/usuarios/vendedores/[id]/page.tsx.
- src/features/gestao/perfil-vendedor.ts.
- src/components/crm/historico-comercial.tsx.

O perfil continua apresentando nome, e-mail e situação do vendedor, Atualizar e Voltar para Usuários.

Os quatro indicadores existentes ficam sempre visíveis: Clientes em carteira, Retornos atrasados, Retornos hoje e Contatos registrados hoje. Não criar uma aba isolada de Resumo com apenas esses indicadores.

Empresas do vendedor mostra nome, CNPJ quando disponível, próximo retorno e próximo passo. Nas duas prévias, esses dados da tabela atual são representados em cards compactos, sem adicionar comandos por empresa. A fonte atual usa 50 empresas por página; preservar a paginação na implementação.

Últimos atendimentos usa a linha do tempo expansível comum: empresa, resultado, natureza, data/hora, autoria, anotação e próximo passo quando disponível. A consulta atual retorna até 20 registros, incluindo empresas atendidas anteriormente.

A fonte do perfil não inclui vendas como eventos nessa consulta. O componente comum oferece Todos, Atendimentos e Vendas; Vendas pode estar vazio. A prévia conserva esse comportamento e não inventa vendas.

## A · Empresas e Atendimentos em abas

Alternativa anterior mantida para referência; o usuário escolheu C.

Os indicadores permanecem no topo. Empresas e Atendimentos são duas abas na própria página, cada uma usando a largura disponível.

Benefício: mais espaço para ler nomes, próximos passos e eventos, especialmente no celular.
Custo: é necessário alternar a aba para consultar a outra lista.

## B · Dois blocos lado a lado

Os mesmos indicadores ficam no topo e os dois conteúdos aparecem juntos em colunas. No celular, os blocos ficam empilhados.

Benefício: permite cruzar visualmente as duas listas no desktop.
Custo: cada coluna fica mais estreita; no celular a página é mais longa.

## C · Botões com consultas laterais

Opção C aprovada pelo usuário em 06/11/2026: botões com consultas laterais e 50 empresas por página.

A página mostra a identificação, os quatro indicadores e dois botões no padrão visual comum: Empresas e Atendimentos. Ao abrir, nenhuma consulta está selecionada.

- Empresas abre a lista diretamente na lateral.
- Atendimentos abre a linha do tempo diretamente na lateral, com seus filtros e expansões.
- Cada painel tem título, identificação do vendedor e Fechar no cabeçalho.
- A consulta não recebe comandos comerciais. Se houver mais de uma página de empresas, Anterior/Próxima e a contagem ficam fixos no rodapé; fora desse caso, o rodapé fica oculto.
- Fechar ou Escape retorna o foco ao botão que abriu a consulta.
- Filtro e expansões do histórico são conservados ao fechar e reabrir.
- Um painel substitui o outro; não empilhar laterais nem inserir um menu intermediário.

Benefício: página inicial mais compacta, mantendo o contexto do vendedor ao consultar cada conteúdo.
Custo: a área de leitura da consulta é mais estreita no desktop. No celular, a lateral ocupa a tela inteira.

A decisão não elimina a página do perfil nem muda as fontes, recortes e regras de consulta.

Em resposta à dúvida sobre volume: Empresas permite consultar os vínculos autorizados do vendedor, não apresenta todos os registros em uma rolagem única. Preservar o tamanho real de página (50), a contagem, a página selecionada e a ordenação estável da fonte. Com 1.000 vínculos visíveis, são 20 páginas. Últimos atendimentos conserva seu recorte atual de até 20 registros.

## Contexto e navegação

- A entrada continua sendo Ver perfil de vendedor ativo, exclusiva do gestor.
- Voltar para Usuários conserva os filtros, pesquisa e página de origem na implementação real.
- Manter links diretos, paginação de empresas, Atualizar e as validações do alvo.
- Não adicionar Ver cliente, Registrar atendimento, Registrar venda ou ações administrativas a esse perfil sem decisão específica.
- Filtros e expansões da linha do tempo pertencem ao mesmo conteúdo; trocar a organização não amplia a consulta nem o recorte de autorização.
- A prévia A conserva a seleção de filtro e as expansões ao alternar as duas abas. Preservar o contexto escolhido na implementação.
- Não acrescentar filtros de data, indicadores de venda, metas ou outros dados ausentes da página atual.

## Dados demonstrativos

Os indicadores 2, 1, 1 e 2 são fictícios. Há três empresas demonstrativas; duas representam clientes, uma representa uma oportunidade. Uma tem retorno em 06/11/2026, outra em 05/11/2026 e outra sem data.

Os três eventos são dois atendimentos em 06/11 e uma atividade sem ligação em 05/11, também fictícios. Uma empresa atendida anteriormente não aparece na lista de vínculos, ilustrando o recorte já descrito na página real.

Não foram fornecidos CNPJs reais ou números inventados como registros válidos. O campo mostra sua ausência apenas na demonstração; a implementação conserva o formatador e os valores autorizados atuais.

## Limites da prévia

As três opções básicas compartilham os mesmos três exemplos e campos. Como o conjunto cabe em uma página, não há paginação nesses exemplos. Foi adicionada uma demonstração separada com 1.000 empresas fictícias para visualizar o limite atual de 50 por página: 20 páginas, com somente os 50 cards da página selecionada no DOM. A amostra é gerada em memória local; não é um ensaio de consulta ou carga no banco. Paginação real, dados autorizados, erros de servidor e perfis inexistentes não são exercitados aqui.

Voltar e Ver perfil alternam a página demonstrativa e a lista de usuários dentro do mesmo HTML. Não é um teste de rotas, consultas ou Voltar do navegador. Atualizar mostra somente uma mensagem de simulação.

Nenhuma empresa, vendedor, contato, venda ou acesso real é lido ou alterado.

## Prévia

- C, nova opção: http://127.0.0.1:4338/?area=perfil&view=lateral
- C, exemplo com 1.000 empresas: http://127.0.0.1:4338/?area=perfil&view=volume
- A: http://127.0.0.1:4338/?area=perfil&view=abas
- B: http://127.0.0.1:4338/?area=perfil&view=blocos

## Situação

Organização aprovada: C, botões Empresas e Atendimentos com consultas laterais, mantendo 50 empresas por página. Identificação e indicadores permanecem na página. O usuário destacou o CNPJ como informação útil para copiar e consultar manualmente no Banco em outra aba; manter como texto selecionável, sem transformar essa observação em uma busca automática ou novo comando.
