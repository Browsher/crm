# Estados dos painéis

Data: 06/11/2026. Mockups locais com dados fictícios. Padrão visual aprovado pelo usuário em 06/11/2026, para implementação posterior.

## Intenção e decisões preservadas

Revisar como os painéis comunicam consulta em andamento, ausência de dados, falhas, edição e gravação. Não reabrir as escolhas de painel lateral para conteúdos/formulários, confirmação central A, menu interno, faixas compactas e ações no rodapé.

Esta rodada apresenta um padrão único em cenários diferentes. Não são alternativas concorrentes: erro de consulta e resposta perdida de uma gravação pedem orientações e ações diferentes.

## Composição aprovada

Faixa baixa no corpo, com borda discreta, símbolo pequeno, título e orientação curta. Sem altura mínima artificial, ilustração grande, resumo duplicado ou cor como único indicador. A ação de recuperação, quando existe, fica no rodapé. Cabeçalho e rodapé conservam as posições já escolhidas.

Usar os tokens da galeria: Segoe UI, superfícies e bordas comuns, tons de aviso/erro e verde de sucesso já existentes. Mensagens alinhadas à esquerda, com a largura disponível do painel e a mesma escala de texto. Indicador e três linhas estáticas de carregamento são escolhas do autor para demonstrar o estado, sem animação contínua ou tempo de resposta inventado.

## Cenários

| Momento | Conteúdo | Ação e saída |
| --- | --- | --- |
| Carregando consulta | Carregando dados e três linhas de exemplo | Fechar disponível; nenhuma ação depende de dados ainda não carregados |
| Histórico sem registros | Ainda não há registros e orientação do primeiro evento | Sem ação artificial ou orientação para filtros inexistentes |
| Filtro sem resultados | Filtros preservados e ausência de vendas no recorte | Ver todos no rodapé; recupera os eventos fictícios |
| Falha ao carregar | Explica a falha de leitura | Tentar novamente no rodapé; não gera gravação |
| Conteúdo indisponível | Mensagem genérica sem nome/dados restritos | Fechar, sem ação que contorne autorização |
| Edição não salva | Formulário com rascunho e aviso baixo | Cancelar/Salvar; sair usa a confirmação A e preserva o texto ao Continuar editando |
| Enviando venda | Faixa Registrando venda e dados enviados em leitura | Sem editar, reenviar ou fechar durante a espera atual |
| Envio sem confirmação | Confirmação pendente e os mesmos dados enviados | Verificar registro; não apresentar nova venda como solução |
| Primeira venda confirmada | Ficha correta na Carteira e aviso Venda registrada | Conserva o destino comercial já existente e o menu do cliente |

## Recuperação e limites comerciais

Verificar registro se refere ao mesmo envio preservado. Não gerar outro comando nem concluir que houve falha ou sucesso por ausência de resposta. O protótipo apenas troca a representação para Verificando registro, sem prazo ou resultado automático inventado. Os outros momentos são escolhidos na galeria.

No cenário de resposta perdida, Fechar e Reabrir verificação conservam o resumo na memória da prévia. Não há armazenamento persistente: reload reinicializa o exemplo. A persistência real de comando, recibos, idempotência e retomada após reload continua sendo obrigação da implementação conforme os contratos existentes.

O bloqueio de fechamento durante envio/verificação desta amostra não redefine a regra de todas as operações do CRM. Cada consumidor deve conservar a política atual de saída e recuperação; não alterar isso silenciosamente por causa do desenho. Na resposta incerta da amostra, Fechar está disponível, sem descartar os dados enviados.

Sucesso é uma representação separada do estado em que uma confirmação real já foi recebida. Não é resultado do clique de verificação nesta prévia. Primeira venda mantém sua ficha correta na Carteira; recompra e atendimento preservam seus próprios destinos e agenda. Não abrir um novo pop-up de sucesso ou criar uma nova confirmação de negócio.

Preservar as exceções Fechar mantendo rascunho da Carteira, proteção nativa de saída/reload, permissões, RLS, fontes e campos autorizados. Tentar novamente em consulta não é reenviar uma gravação. Mensagens de validação de campos continuam junto aos campos; esta rodada não as substitui por um aviso genérico.

## Escopo da prévia

HTML/CSS/JavaScript da galeria. Sem produto, migração, acesso autenticado, busca paga, chamada de integração, venda, envio de mensagem ou alteração de usuários reais. A comparação não ensaia falhas de rede reais, concorrência, autorização ou recuperação persistente.

Fonte do desenho: estados existentes de mockup.js e contratos já registrados na spec 2026-11-05-padronizacao-paineis-crm-design.md. Os exemplos foram aprovados pelo usuário. Os cenários estáticos e as limitações de rede/persistência continuam explícitos; a aprovação visual não comprova comportamento do produto.

Prévia: http://127.0.0.1:4338/?area=estados-padrao&view=erro

Resposta perdida: http://127.0.0.1:4338/?area=estados-padrao&view=incerto

## Situação

Padrão dos estados aprovado e salvo: faixas compactas, ações no rodapé e distinção entre consulta, edição, envio e resultado incerto. A implementação deverá preservar políticas de saída, recuperação, permissões e destinos próprios de cada operação. Sem autorização para alterar produto, integrar ou publicar nesta rodada.
