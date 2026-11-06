# Conferência da organização do perfil do vendedor

Data: 06/11/2026. Galeria local com indicadores, empresas e eventos fictícios.

## Conteúdo e navegação

- Indicadores, conteúdo dos três cards de empresas e texto dos três eventos foram coletados pelo DOM nas opções A e B: iguais.
- A manteve os quatro indicadores acima de duas abas. B mostrou os mesmos quatro indicadores e os dois blocos simultaneamente.
- ArrowRight abriu Atendimentos a partir de Empresas.
- Enter expandiu o primeiro evento; abrir Empresas e voltar a Atendimentos conservou sua expansão.
- Vendas 0 apresentou Nenhum registro neste filtro e desabilitou Expandir todos.
- Todos recuperou os eventos. Expandir todos abriu os três exemplos.
- Atualizar exibiu a simulação e manteve Atendimentos selecionado.
- Voltar para Usuários mostrou as quatro pessoas fictícias. Ações → Ver perfil reabriu o perfil.
- O perfil não exibiu comandos administrativos, registro de atendimento ou registro de venda.

## Celular e temas

- A e B foram visualizadas em desktop e celular de 390 x 844, usando temas escuro e claro.
- No celular, B empilhou Empresas e Atendimentos. Seus indicadores ficaram em duas colunas, medindo 166,5 cada na composição observada.
- Documento de B mediu 390 de largura, sem transbordamento horizontal.
- Na aba Atendimentos de A, o documento também mediu 390 de largura, mantendo quatro indicadores e três eventos disponíveis.
- A galeria ficou aberta em A, desktop e tema escuro, com Empresas selecionado e os três exemplos visíveis.

## Limites

Os indicadores e registros são fictícios. A comparação não valida cálculos de produção, autorização, dados reais, perfis inexistentes, erros de servidor ou atualização real.

A amostra tem menos de uma página de empresas; a paginação real de 50 registros e a consulta de até 20 atividades não foram exercitadas no protótipo. Seus limites foram confirmados por leitura da fonte.

A volta à lista e a reentrada no perfil são simuladas no mesmo documento, sem teste de URL, filtros reais ou Voltar do navegador. Nenhuma consulta ou operação comercial foi executada.

A comparação inicial de A e B foi seguida da opção C, posteriormente escolhida pelo usuário.


## Nova opção C e demonstração de volume

Conferência adicional após o pedido de botões com consultas laterais e a dúvida sobre 1.000 empresas:

- C abriu sem painel selecionado. Empresas e Atendimentos ficaram como acionadores na página, mantendo os indicadores.
- Empresas abriu diretamente a consulta lateral. Na demonstração de volume, a primeira página informou 1–50 de 1.000 e teve exatamente 50 cards no DOM; Anterior começou desabilitado.
- A segunda página mostrou os exemplos 0051 a 0100.
- As 20 páginas foram percorridas. A última teve os exemplos 0951 a 1000, ainda com 50 cards, e Próxima desabilitado.
- Fechar e reabrir conservou a página 20. Anterior retornou à página 19.
- Fechar Empresas devolveu o foco ao seu botão na página.
- Atendimentos abriu diretamente os três eventos demonstrativos, sem rodapé de comando comercial.
- Vendas 0 mostrou o vazio. Todos restaurou a lista; Enter expandiu um evento e Escape fechou a lateral. Ao reabrir, filtro e expansão foram conservados.
- No celular de 390 x 844, Empresas mediu largura 390, topo 0 e limite inferior 844, sem transbordamento horizontal. A paginação permaneceu com limite inferior em 844 e seus botões mediram 44 de altura.
- A demonstração ficou aberta em desktop, tema escuro, primeira página de Empresas com 50 cards e navegação visível.

Os 1.000 exemplos são gerados em memória local; o teste verifica renderização e navegação da prévia, não consultas ou desempenho do banco real. A implementação deve continuar consultando até 50 empresas por página, com os vínculos e permissões atuais. Após esta conferência, C foi aprovada com botões laterais e 50 empresas por página.
