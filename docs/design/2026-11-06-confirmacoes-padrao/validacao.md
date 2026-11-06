# Conferência dos mockups de confirmação

Data: 06/11/2026. Somente galeria local com dados fictícios. O usuário aprovou todos os exemplos na opção A após a conferência abaixo.

## Conteúdo e composição

- A e B de Sem interesse mostraram a mesma empresa, título, consequência e ações. A tem bloco destacado; B tem texto corrido.
- A e B de venda mostraram Horizonte Segurança Eletrônica, R$ 1.250,00, data efetiva 06/11/2026 e a mesma consequência de não poder editar/excluir a venda.
- Cancelar venda manteve os valores do formulário e devolveu foco a Conferir venda.
- A e B de descarte mantiveram a anotação fictícia ao Continuar editando. Em A, Escape também preservou o texto. Descartar em A removeu o editor e manteve o painel em leitura.
- Cancelar e Escape em Sem interesse mantiveram o painel e devolveram foco ao botão Sem interesse.

## Celular, temas e teclado

- Conferidos desktop escuro e celular claro, usando a moldura de 390 x 844.
- Desktop: confirmações A e B com largura 420; documento com largura 1280. Em A, os dois botões mediram 181 de largura e 40 de altura.
- Celular: confirmação com largura 356, documento com largura 390. Venda mediu topo 235 e limite inferior 609, dentro da tela.
- Os dois botões de venda mediram 151 de largura e 44 de altura. Em Sem interesse, a quebra de linha levou ambos a aproximadamente 49 de altura, sem cortar o nome da ação.
- Foco inicial em Cancelar ou Continuar editando. Shift+Tab no primeiro botão e Tab no último foram conferidos no desktop; Shift+Tab também foi conferido no celular.
- Foi reproduzida uma saída de foco do diálogo nativo no ciclo dos botões no navegador da prévia. A comparação local recebeu o ciclo explícito de teclado, limitado aos novos cenários; a repetição confirmou o foco dentro do pop-up. Isso não é evidência de falha no componente real do CRM.
- A galeria foi deixada em A, desktop e tema escuro, pronta para comparação.

## Limites

Não houve acesso autenticado nem alteração do produto. Aceitar venda ou Sem interesse continua sendo apenas o aviso de simulação existente; não foram ensaiadas gravações, permissões, concorrência ou recuperação de comandos. Formulários administrativos, exceção Fechar mantendo rascunho e confirmação nativa do navegador não foram exercitados nesta rodada.

## Verificações dos arquivos

270 testes de documentação aprovados. ESLint da galeria, sintaxe de mockup.js, catalogue.js e gallery.js e git diff --check aprovados.
