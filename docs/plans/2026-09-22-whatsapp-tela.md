# Tela de acompanhamento do WhatsApp

Escopo solicitado: finalizar a tela do piloto aproximando do mockup, com busca e histórico ao rolar. Alteração delimitada ao fluxo existente, preservando acesso do gestor, atualização automática e mídias.

## Desenho

Manter o tema e a tipografia do CRM. Painel com lista à esquerda e conversa à direita, iniciais dos contatos, horários discretos e destaque verde na seleção e nas mensagens enviadas. Cabeçalho compacto, identificação do número de teste e indicação de somente visualização. Sem indicadores globais inferidos de amostras nem vendedores fictícios.

A busca filtra nome, telefone confirmado e texto das mensagens já carregadas, ignorando acentos e pontuação do telefone. Informar seu alcance e permitir continuar carregando histórico quando não houver resultados. Preservar a conversa selecionada durante busca e atualização.

Rolar a lista até o fim carrega a próxima página. Rolar a conversa para o início carrega uma página anterior, preservando a posição de leitura. Como a API pagina a instância inteira, uma página pode não conter mensagens daquela conversa. Manter ação acessível para carregar mais quando não houver rolagem suficiente ou para repetir uma falha. Não disparar consultas automáticas em loop nem repetir após erro sem ação do usuário.

Abrir uma conversa posiciona nas mensagens recentes. Atualizações acompanham o fim apenas quando o gestor já está nele. Se estiver lendo acima, não deslocar a leitura. Em telas pequenas, empilhar lista compacta e conversa, com controles e mídia dentro da largura disponível.

## Verificação

TDD para busca por nome, telefone e texto; resultado vazio; paginação automática sem duplicação; erro sem repetição automática; manutenção da seleção e posição de leitura. Preservar testes atuais de acesso e mídia. Conferir tipos, lint, build e navegador local em larguras de desktop e celular.

## Resultado

68 testes do WhatsApp e das diretivas do servidor passaram. Typecheck e lint passaram. Build isolado compilou a página. Dois timeouts de importação na primeira execução da suíte não se repetiram na execução separada.

No navegador local, a busca filtrou por nome preservando a conversa aberta e a rolagem aumentou o histórico carregado de 50 para 100 mensagens. Em largura de celular, a largura do documento ficou igual à área disponível, sem transbordamento horizontal. A lista e a conversa ficam empilhadas. O botão manual permanece como alternativa de teclado, para listas sem rolagem e para repetir falhas.
