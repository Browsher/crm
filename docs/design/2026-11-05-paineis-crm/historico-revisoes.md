# Histórico das rodadas da galeria

Arquivo de referência. Inclui pendências que foram resolvidas em rodadas posteriores. O estado vigente está no README da galeria e na spec consolidada.

# Galeria de painéis do CRM

Proposta salva em 05/11/2026 para revisar antes de implementar.
Base: d830a53 (PR #73). Branch: codex/padroes-paineis-mockups.

## Abrir

Com a prévia em execução: http://127.0.0.1:4338/

Para abrir novamente, executar a partir desta pasta:

    node preview-server.mjs

O servidor usa somente 127.0.0.1:4338 e serve apenas arquivos da própria pasta. Se a porta estiver ocupada, informar outra: node preview-server.mjs 4339. O endereço impresso informa a porta efetiva. Sem dependências ou instalação. Também é possível abrir index.html localmente em um navegador que permita o iframe local.

## O que visualizar

Escolher uma área à esquerda ou nas abas superiores, selecionar o cenário e alternar Desktop/Celular e Claro/Escuro. Ampliar mockup abre a prévia sem a moldura da galeria.

Áreas: Meu dia; Funil; Prospecção; Carteira; Gestor; WhatsApp; Históricos; Confirmações; Estados.

Os controles do protótipo navegam entre painéis, expandem eventos e mostram confirmações simuladas. Nada chama o CRM, banco, Google, WhatsApp, e-mail ou serviço de autenticação. Não há senha de acesso, mídia privada ou dado de produção.

As datas/contagens/CNPJ são exemplos visuais, não registros reais. O CNPJ ilustrativo não é validado. O resultado dos botões é uma simulação, não uma implementação das regras comerciais.

## Onde ficam as decisões

- docs/superpowers/specs/2026-11-05-padronizacao-paineis-crm-design.md: padrão e conteúdo de cada área, decisões já confirmadas e propostas ainda a validar.
- docs/auditorias/2026-11-05-inventario-paineis-crm.md: fontes, consumidores e superfícies atuais.
- Esta pasta: HTML/CSS/JavaScript autocontidos e o servidor local.

## Situação de aprovação

Confirmado: conteúdos/formulários em painel lateral; confirmações rápidas em pop-up central.
Reaproveitados: conteúdo aprovado de Meu dia, Funil e linha do tempo.
Conteúdo dos painéis apresentado nesta galeria: aprovado pelo usuário em 06/11/2026. A validar: estrutura e navegação. A primeira comparação foi concluída: o usuário escolheu Menu interno de seções para a Negociação em 06/11/2026. A decisão está em docs/design/2026-11-06-estrutura-negociacao/README.md. Botões e demais áreas continuam em revisão.

Nenhum arquivo de produto foi modificado. Não houve migração, merge nem publicação nesta rodada.

## Roteiro de revisão

1. Base comum e Meu dia.
2. Funil e Sem interesse.
3. Prospecção/Banco e critérios/espelhamento Google.
4. Carteira e venda.
5. Gestor.
6. WhatsApp.
7. Históricos, confirmações e estados transversais.

Anotar a decisão de cada área na spec antes de preparar o plano de implementação. Não tratar acesso à galeria ou clique num cenário como aprovação.


Atualização de 06/11/2026: o menu interno é o padrão global para painéis com várias seções; tarefas curtas abrem direto. A comparação atual de botões está na área Botões da Negociação e em docs/design/2026-11-06-botoes-negociacao/README.md. Posição, prioridade e tamanhos ainda aguardam escolha.


Decisão de 06/11/2026: modelo A, ações no rodapé, escolhido para a Negociação. A próxima comparação é Dados da empresa, com três ou quatro grupos no menu. Ver docs/design/2026-11-06-dados-empresa/README.md.


Decisão de 06/11/2026: Dados da empresa aprovado em três grupos. A próxima comparação é Navegação de Meu dia: próximo passo direto ou menu completo do retorno, em docs/design/2026-11-06-meu-dia-navegacao/README.md.


Decisão de 06/11/2026: Meu dia aprovado com próximo passo direto. A próxima comparação é Histórico do Banco: aba dentro da página ou painel lateral, em docs/design/2026-11-06-banco-historico/README.md.


Decisão de 06/11/2026: Banco aprovado na opção A. Refinamento do usuário: Ver empresas expande um acordeão abaixo de cada busca na página; cada empresa tem Ver empresa; Filtros usados fica somente no card principal do grupo e abre direto na lateral. A opção B é uma referência não escolhida. O ajuste substitui o menu lateral de resultados/filtros da proposta anterior. Próxima revisão planejada: critérios Google.


Confirmação final de 06/11/2026: o usuário aprovou o refinamento do Banco com empresas expansíveis e Filtros usados no card principal. A comparação atual é Grupos dos critérios Google: A com três grupos ou B com dois, sem escolha ainda. Ver docs/design/2026-11-06-criterios-google-grupos/README.md.


Decisão de 06/11/2026: critérios Google aprovados na opção A, três grupos. A comparação atual é Estrutura de Espelhar planejamento: formulário direto ou duas seções no menu. Ver docs/design/2026-11-06-espelhar-planejamento/README.md.


Decisão de 06/11/2026: Espelhar planejamento aprovado na opção A, formulário direto. A comparação atual é Abertura do cliente na Carteira: ficha lateral ou página própria. Ver docs/design/2026-11-06-carteira-abertura-cliente/README.md.


Decisão de 06/11/2026: ficha do cliente na Carteira aprovada na lateral, opção A. A comparação atual é Ações dos usuários do gestor: menu Ações na linha ou painel Gerenciar acesso. Ver docs/design/2026-11-06-gestor-acoes-usuarios/README.md.


Decisão de 06/11/2026: ações dos usuários do gestor aprovadas na opção A, menu Ações na linha. Ver perfil conserva a página comercial atual; seu conteúdo foi conferido no código e registrado em docs/design/2026-11-06-gestor-acoes-usuarios/README.md. Não foi desenhado um novo perfil nesta rodada.


Revisão de 06/11/2026: organização do Perfil do vendedor na própria página, com Empresas e Atendimentos em abas ou dois blocos lado a lado. Os quatro indicadores permanecem no topo. Ver docs/design/2026-11-06-perfil-vendedor-organizacao/README.md; escolha pendente.


Nova opção solicitada em 06/11/2026 para o Perfil do vendedor: C, identificação e indicadores na página, com botões Empresas e Atendimentos abrindo as consultas diretamente na lateral. Nenhuma consulta abre automaticamente. Preservar fontes, histórico, filtros e retorno; escolha ainda pendente.


Dúvida de volume registrada em 06/11/2026: Empresas no perfil mantém até 50 registros por página. Há uma demonstração separada com 1.000 empresas fictícias e 20 páginas, acessível em area=perfil&view=volume. Não é consulta real nem alteração do tamanho da página de produção.


Decisão de 06/11/2026: perfil do vendedor aprovado em C, consultas laterais e 50 empresas por página; CNPJ mantido selecionável. Próxima comparação: Imagem do WhatsApp na lateral, legenda junto da imagem ou em área separada no rodapé. Ver docs/design/2026-11-06-whatsapp-imagem/README.md.


Decisão de 06/11/2026: imagem do WhatsApp aprovada em A, imagem e legenda juntas, com Ampliar imagem. A visualização maior usa a mesma lateral; Voltar recupera a legenda e a posição de leitura. Ver docs/design/2026-11-06-whatsapp-imagem/README.md.


Próxima comparação de 06/11/2026: Padrão das confirmações, A com empresa/formulário em bloco destacado ou B em texto corrido. O pop-up central continua escolhido; apenas a organização está em revisão. Ver docs/design/2026-11-06-confirmacoes-padrao/README.md.

Decisão de 06/11/2026: usuário aprovou todos os exemplos de confirmação em A, com empresa/formulário em bloco próprio, consequência abaixo e ações no rodapé. É o padrão comum para implementação posterior, adaptando os alvos administrativos e preservando exceções. B permanece como referência não escolhida. Próxima rodada prevista: Estados transversais.

Revisão de 06/11/2026: Estados dos painéis apresenta faixas compactas, ações no rodapé e cenários de consulta, vazio, edição e gravação. É uma proposta única aplicada a momentos distintos, ainda sem aprovação. Ver docs/design/2026-11-06-estados-paineis/README.md.

Decisão de 06/11/2026: padrão dos estados aprovado pelo usuário. A próxima comparação é Largura dos painéis: A até 520 px ou B até 640 px, com mesmo conteúdo. Foi incluída visualização Notebook de 1024 x 768 para comparar a adaptação; celular mantém tela inteira nas duas opções. Escolha de largura pendente. Ver docs/design/2026-11-06-largura-paineis/README.md.

Decisão de 06/11/2026: largura atual A aprovada, com máximo de 520 px. A comparação seguinte é Painel no celular: A em tela inteira ou B abaixo da barra do CRM. Conteúdo, menus, ações e confirmação de descarte permanecem iguais. Apresentação móvel ainda sem escolha. Ver docs/design/2026-11-06-painel-celular/README.md.
