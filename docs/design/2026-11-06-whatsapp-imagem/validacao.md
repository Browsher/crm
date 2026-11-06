# Conferência da imagem do WhatsApp na lateral

Data: 06/11/2026. Somente galeria local; nenhuma mídia ou conversa real foi acessada.

## Comparação anterior: conteúdo e retorno

- O SVG foi comparado pelo DOM em A e B: idêntico. A legenda curta também foi igual nas duas opções.
- A mostrou imagem e legenda no corpo, com rodapé oculto.
- B manteve a imagem no corpo e a mesma legenda em um rodapé informativo.
- Fechar a consulta e clicar em Ampliar imagem abriu a mesma ilustração. Escape fechou e devolveu o foco a Ampliar imagem, mantendo o card de conversa.
- As duas legendas longas foram comparadas: texto idêntico, com 843 caracteres no exemplo observado.
- Não foram acrescentados comandos de envio, navegação de arquivos ou registro comercial.

## Comparação anterior: celular, temas e teclado

- A e B foram visualizadas em desktop e celular de 390 x 844, nos temas escuro e claro.
- A com legenda longa teve corpo visível de 753 e conteúdo de 767 de altura, com uma única rolagem e rodapé oculto.
- B com legenda longa teve painel de largura 390, topo 0 e limite inferior 844, sem transbordamento horizontal do documento.
- O SVG de B permaneceu dentro da área do corpo e conservou viewBox 0 0 640 500.
- A legenda separada teve altura visível 252 e conteúdo 478. End, com foco nessa área, levou a rolagem a 226; a área é acessível por teclado.
- A galeria ficou aberta em A, desktop e tema escuro, com a legenda curta no mesmo corpo da imagem.

## Opção A aprovada com Ampliar imagem

Conferência adicional em 06/11/2026, após o usuário escolher A e solicitar o botão.

- Desktop escuro: o painel normal mediu 520 de largura; Ampliar imagem abriu a mesma lateral com 1100. O documento permaneceu com largura 1280.
- A visualização maior mostrou Imagem ampliada e Voltar, sem legenda nem rodapé. O SVG permaneceu idêntico ao do modo normal.
- Voltar recuperou a largura normal, a legenda longa de 843 caracteres, a posição de leitura e o foco em Ampliar imagem.
- Após fechar e reabrir pela conversa, a imagem começou no modo normal. O primeiro Escape na ampliação retornou ao modo normal; o segundo fechou e devolveu o foco ao acionador da conversa.
- Celular claro: o painel e o documento mantiveram largura 390. Apenas a área da imagem rolou horizontalmente: corpo visível 375, conteúdo 756, canvas 720.
- A área ampliada conservou tabindex 0 e nome Imagem ampliada. ArrowRight movimentou a rolagem horizontal, observada em 40 após estabilizar.
- Voltar no celular recuperou a legenda inteira e o foco no botão de ampliação.
- A galeria foi deixada em A, desktop e tema escuro, com imagem e legenda curta juntas e Ampliar imagem no rodapé.

## Limites

Foi usada a ilustração fictícia já existente na galeria. Os estados de blob real, carregamento, falha de formato, autorização, conversa/fonte, expiração do arquivo e abortar requisição não foram exercitados.

A comparação foca na posição da legenda e no retorno ao acionador. Não é validação da mídia privada ou do componente real do WhatsApp.

O perfil do vendedor já está aprovado com consultas laterais e 50 empresas por página. A posição da legenda está aprovada em A, com Ampliar imagem na mesma lateral.

## Verificações dos arquivos

- 268 testes de documentação aprovados.
- ESLint da galeria aprovado.
- Sintaxe de mockup.js e catalogue.js e git diff --check aprovados.
- Nenhum arquivo do produto foi alterado nesta rodada.
