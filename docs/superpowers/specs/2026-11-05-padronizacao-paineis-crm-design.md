# Padronização dos painéis e confirmações do CRM

Data: 05/11/2026. Base observada: d830a53c84bd1137e0808c6bfab4466127fe75de (PR #73 publicada).
Estado: conteúdo, organização por área e base visual aprovados e consolidados em 06/11/2026. Largura atual A no desktop e tela inteira A no celular. Este documento não autoriza implementar, integrar ou publicar.
Galeria: docs/design/2026-11-05-paineis-crm/index.html.
Inventário verificável: docs/auditorias/2026-11-05-inventario-paineis-crm.md.

## Intenção e escopo desta rodada

O usuário pediu organizar todos os pop-ups e painéis laterais, desenhar o conteúdo de cada área em mockups e salvar para implementar depois. A diferença atual é estrutural: algumas consultas ainda abrem no centro, enquanto Meu dia e Funil já usam laterais com variações no celular.

Esta rodada entrega documentação e protótipos locais com dados fictícios. Não altera arquivos de produto, banco, consultas, permissões, usuários, integrações ou implantação.

Abrange os fluxos que hoje usam Dialog ou PainelLateralCrm em vendedor e gestor. Páginas completas continuam como páginas; seu conteúdo serve de referência quando compartilhado. As exceções aprovadas são a ficha do cliente da Carteira na lateral e as consultas laterais do perfil do vendedor. Configuração do WhatsApp, planejamento semanal, login, troca de senha e demais rotas não mudam de superfície sem decisão específica.

## Decisões do usuário que já valem

- Conteúdos e formulários em painel lateral. Confirmações rápidas continuam em pop-up central. A distinção foi confirmada nesta rodada.
- Regra global aprovada em 06/11/2026: painéis com várias seções usam menu interno; tarefas curtas abrem diretamente. Os agrupamentos escolhidos por área estão reunidos abaixo.
- Meu dia inicia sem seleção, com cards compactos e os filtros Todos, Atrasos, Hoje e Próximos.
- O retorno tem Próximo passo e Histórico, sem botão Registrar atendimento duplicado. O registro acontece na Negociação.
- Na Negociação, o usuário escolheu o menu interno de seções: Atendimento e próximo passo reúne a consulta e o registro; Histórico abre a linha do tempo. Voltar retorna ao menu interno. Não há Resumo. A decisão atual substitui a divisão anterior em três abas apenas nesse painel.
- Registrar venda e Sem interesse ficam lado a lado no rodapé da negociação. Em 06/11/2026, o usuário escolheu o modelo A da comparação de botões: ações gerais no rodapé das seções de leitura; Cancelar e Salvar atendimento no rodapé durante a edição.
- Voltar aparece no cabeçalho interno. Não repetir Voltar ao retorno no rodapé.
- Dados da empresa mostra todos os campos autorizados em grupos organizados; não repetir cadastro dentro da negociação. Em 06/11/2026, o usuário escolheu três entradas no menu: Contato e localização; Cadastro e origem; Atividades e sócios.
- Histórico comercial usa linha do tempo expansível, eventos inicialmente recolhidos e detalhes disponíveis ao expandir.
- Sem interesse no Funil mostra as três últimas empresas arquivadas pelo próprio Funil, com Devolver. A devolução abre Primeiro contato. Ver todos segue ao arquivo geral.
- Arquivar encerra a negociação e cancela retornos, preservando vínculo e histórico.
- Listas permanece no gestor. Não reintroduzir importação de empresas ou Design system no menu.

As escolhas abaixo foram aprovadas em rodadas individuais. Os documentos por área conservam as alternativas anteriores e a galeria Modelos aprovados reúne somente as composições escolhidas. Aprovação de desenho não autoriza implementar, integrar ou publicar.

## Padrão comum aprovado

Uma lateral por vez, com largura comum para conteúdos e formulários. A largura atual A e a apresentação móvel A foram escolhidas. As exceções e contratos próprios de cada área continuam explícitos.

1. Um painel de conteúdo por vez. Consultas cadastrais, filtros e negociação substituem o conteúdo lateral sem empilhar várias laterais. Empresas retornadas pelo Banco expandem na página, conforme a decisão específica dessa área.
2. Cabeçalho fora da rolagem: contexto curto, título e Fechar no primeiro nível. No conteúdo interno, Voltar.
3. Menu interno nos painéis com várias seções. Tarefas curtas, imagem e renomeação abrem direto. Abas da página, como Buscar/Histórico no Banco, não se tornam abas artificiais dentro do painel.
4. Corpo com rolagem própria, seções com títulos, bordas discretas e espaçamento previsível.
5. Rodapé fora da rolagem, com ações da tarefa ativa. Sem botão escondido no final do formulário longo.
6. No desktop, lateral inteira à direita, usando a mesma largura para todos os conteúdos. O usuário escolheu A em 06/11/2026: clamp(380px, 47vw, 520px), com limite de 520 px. O fundo continua visível e identifica o contexto. Imagem ampliada conserva sua exceção aprovada.
7. Até 820 px, A aprovada: painel em tela inteira, acima da barra do CRM, com um único cabeçalho da tarefa. Não deixar a lateral embutida no fluxo da página como ocorre na base observada do Funil estreito.
8. Tokens, fonte Segoe UI, cores, foco e espaçamentos da identidade existente. Não redesenhar a identidade da empresa.
9. No celular, controles de pelo menos 44 px, campos com 16 px e nenhuma rolagem horizontal do documento. Abas podem rolar na própria faixa se necessário.
10. Ao fechar, restaurar foco e recorte de origem. Em mudança entre conteúdos, restaurar também aba, pesquisa, página e posição pertinente.

A referência visual de Meu dia/Funil já aprovada consta em 2026-11-05-meu-dia-cards-design.md e 2026-11-05-funil-painel-lateral-design.md. A mudança de Funil móvel de conteúdo na página para tela inteira foi aprovada nesta rodada e substitui apenas essa escolha de superfície da referência anterior.

## Conteúdo por área

### Meu dia

- Primeiro nível: nome da empresa e situação do retorno no cabeçalho.
- Próximo passo: ação combinada e data atual da agenda.
- Histórico: linha do tempo comercial sob o mesmo recorte de autorização.
- O usuário escolheu Próximo passo direto em 06/11/2026: ação/data visíveis ao abrir; Dados da empresa e Histórico como entradas do menu. Negociação no rodapé quando houver negociação aberta. Clientes mantêm seu caminho atual de atendimento na Carteira.
- Dados → Negociação → Voltar recupera a empresa e a aba de onde se saiu.
- Fechar no retorno inicial; Histórico → Voltar retorna ao início do retorno, com Próximo passo direto e menu. Não selecionar a próxima empresa automaticamente.

### Dados da empresa, compartilhados por vendedor e gestor

Conteúdo somente informativo: Contatos; Cadastro; Endereço; Atividades e tributação; Sócios e administradores; Origem.

Conservar os campos do componente EmpresaDetalhes: telefones, e-mail, razão social, nome fantasia, CNPJ, situação cadastral, porte, abertura, natureza jurídica, capital social, endereço completo, CNAE, atividades secundárias, regime e sócios disponíveis. Campos ausentes aparecem como não informados, sem completar por suposição.

A mesma aparência não significa a mesma autorização: referências de cadastro e de resultado de busca continuam distintas. O painel não recebe edição nem histórico adicional automaticamente. Rodapé comercial aparece apenas quando o consumidor já autoriza e fornece essa ação; gestor não recebe ações de vendedor por reutilizar a aparência.

### Funil

Negociação mantém nome e etapa no cabeçalho. Próximo passo mostra ação/data e avanço de etapa aplicável. Atendimento concentra resultado, anotação e próximo passo, com os campos e validações reais do FormularioContato. Histórico conserva somente os contatos autorizados do próprio vendedor.

Nos modos Próximo passo e Histórico: Registrar venda e Sem interesse lado a lado. Em Atendimento: Cancelar e Salvar atendimento. O mockup não substitui todos os condicionais do formulário de domínio; a implementação deve reutilizá-lo.

Registrar venda abre formulário no mesmo painel, com empresa, valor, data efetiva e observação. Conferir venda abre confirmação central. Corrigir/cancelar a confirmação preserva o formulário.

Sem interesse tem no máximo três registros elegíveis, ordenados do mais recente. Cada item tem apenas Devolver. Ver todos aponta a /fila/localizar?disponibilidade=sem_interesse&pagina=1. Animação de arquivamento permanece após sucesso novo, com movimento reduzido respeitado. O mockup não simula o arraste nem a transação de devolução.

### Prospecção e Banco de empresas

- O histórico fica em uma aba dentro da página Banco de empresas, ao lado de Buscar empresas. Opção A escolhida em 06/11/2026.
- Cada card principal de busca preserva nome/contexto, fornecedor, data e contagem/situação disponíveis, inclusive em buscas vazias.
- Ver empresas substitui Ver busca e expande/recolhe as empresas em um acordeão abaixo do card, na própria página, fora da lateral.
- Cada empresa expandida tem Ver empresa, abrindo os dados cadastrais na lateral comum de três grupos.
- Filtros usados fica somente no card principal da pesquisa e abre os critérios diretamente na lateral. Não repetir esse botão em cada empresa.
- Fechar dados ou filtros recupera o mesmo contexto, incluindo pesquisa, filtros, página, rolagem e grupos abertos. Não selecionar empresa automaticamente.
- Não adicionar paginação ou pesquisa ao histórico de buscas se o consumidor atual não as possui.
- A abertura de resultados após uma busca continua funcionando, agora na página, sem perder a recuperação do envio original nem repetir consulta paga.
- Não transformar os filtros de busca do Banco nem a central inteira em outro formulário lateral. São páginas atuais.
- O atendimento completo que hoje possui rota própria não é migrado nesta rodada de desenho; seu formulário continua sendo a fonte do conteúdo e das regras.
- Essa decisão substitui o menu lateral de Empresas encontradas/Filtros usados proposto na rodada anterior. Os conteúdos, fontes e permissões são preservados.

### Google: critérios e espelhamento

O conteúdo dos critérios permanece organizado em quatro blocos de origem: Procurar, Evitar, Contatos e Orientações. O menu interno seguirá o padrão global já escolhido. O usuário escolheu A em 06/11/2026: três entradas, Empresas e produtos, Contatos e presença digital, Preferências e restrições. A alternativa de duas entradas não foi escolhida. Ver docs/design/2026-11-06-criterios-google-grupos/README.md.

- Procurar: termos adicionais, produtos, tipos de negócio e forma de atendimento.
- Evitar: termos excluídos e situação no Google.
- Contatos: site, e-mail publicado, tipo de contato, nota mínima e mínimo de avaliações.
- Orientações: prioridades e outras orientações.
- Exemplos ficam nos placeholders dos campos pouco claros e somem durante o foco. Não colocar ajuda redundante nos títulos óbvios.
- Aplicar critérios altera o rascunho do dia. Não equivale a salvar o planejamento semanal nem a disparar coleta.
- Leitura de dias não editáveis conserva o mesmo arranjo, sem ações de gravação.
- Não adicionar CNAE ao contrato de CriteriosGoogle: este formulário atual não possui esse campo. CNAE existente no Banco e no cadastro permanece. Se a busca Google precisar dele, será uma decisão de domínio separada.

Espelhar planejamento agrupa Origem (semana e dia), O que copiar, Destino (semana e dias elegíveis). O usuário escolheu A em 06/11/2026: abrir esses blocos diretamente, sem menu intermediário. Ver docs/design/2026-11-06-espelhar-planejamento/README.md. Rodapé Cancelar e Espelhar nos dias escolhidos. Preservar revisão da origem, restrições de dias e resultado incerto, sem repetir uma operação cuja confirmação é desconhecida.

Planejamento semanal, histórico/detalhe de entregas Google e coletas do gestor são páginas atuais. Ficam mapeadas e não são transformadas em painéis silenciosamente. Não representar coleta Google como se fosse histórico de Banco: fornecedor, situação e campos são próprios.

### Carteira

Registrar venda passa do pop-up central ao formulário lateral comum, mantendo o alvo recompra e as regras de retorno atuais. Confirmação de venda e descarte passam a usar o mesmo padrão curto central, preservando o envio.

O usuário escolheu A em 06/11/2026: ficha do cliente na lateral, com menu para Atendimento e próximo passo, Dados da empresa e Histórico. Atendimento e recompra são tarefas diretas na mesma lateral; confirmações ficam no centro. Preservar as rotas e links diretos como contratos, incluindo entrada por Meu dia e primeira venda. Ver docs/design/2026-11-06-carteira-abertura-cliente/README.md. O histórico mantém suas fontes e recortes atuais; a escolha de superfície não autoriza ampliar consultas ou permissões. Primeira venda mantém o destino na ficha correta; recompra preserva a agenda conforme regra atual.

### Gestor: Empresas, Usuários e Listas

O usuário escolheu A em 06/11/2026: menu Ações na linha para acessar os comandos de usuários. As confirmações permanecem centrais e a entrega de senha na lateral. Ver perfil conserva a página de identificação e indicadores, com consultas laterais aprovadas em C, sem ampliação de consultas ou permissões. Ver docs/design/2026-11-06-gestor-acoes-usuarios/README.md.

- Ver empresa na lista usa o painel comum; a ficha completa mantém sua rota e blocos comerciais/legados autorizados.
- Novo usuário: nome, e-mail e papel. Cancelar/Criar usuário no rodapé.
- Após criar acesso ou confirmar nova senha, a lateral apresenta a entrega de senha provisória com Copiar senha e Concluir.
- A senha é exibida uma única vez, sem consulta posterior, persistência no protótipo ou histórico. Nenhuma credencial real entra nos mockups ou capturas.
- Nova senha, mudar papel, desativar e reativar continuam com confirmação central, nome e consequência. Restrições de própria conta e gestor único continuam valendo.
- Renomear lista usa painel curto, com nome e Cancelar/Salvar nome. Desativar/reativar lista continua como confirmação central.
- Atividade do vendedor e histórico da empresa reutilizam o componente comercial em suas páginas atuais, preservando o limite de 20 contatos onde existe. O usuário aprovou C em 06/11/2026: identificação e indicadores na página, com botões Empresas e Atendimentos abrindo consultas diretas na lateral. Nenhum painel abre automaticamente. Empresas mantém 50 por página, com navegação e contagem no rodapé quando necessárias. Preservar a página selecionada e o CNPJ como texto selecionável. Não renderizar todos os vínculos em uma lista única. A página do perfil e seus contratos permanecem. Ver docs/design/2026-11-06-perfil-vendedor-organizacao/README.md.
- O texto atual de confirmação de grupos ainda menciona reservas e descanso. Isso foi identificado por leitura em app/empresas/grupos/controles.tsx. Revisar a mensagem com o contrato comercial vigente antes de implementar; não recriar essas regras nem alterar elegibilidade por causa da troca de superfície.

### WhatsApp

Somente o pop-up Ampliar imagem passa a um painel de mídia. O usuário aprovou A em 06/11/2026: imagem e legenda no mesmo corpo rolável, com Ampliar imagem no rodapé. A ampliação usa a mesma lateral em uma visualização maior; Voltar ou Escape recupera o modo normal e a legenda. Não empilhar outro pop-up. Ver docs/design/2026-11-06-whatsapp-imagem/README.md. Cabeçalho Imagem da conversa, imagem contida e legenda quando existir. Fechar/Voltar recupera a mesma conversa, fonte e posição.

Áudio continua com player; documentos mantêm o download existente. Não adicionar leitura automática, envio de mensagem, transcrição ou download de dados reais para validar o mockup. Configuração, conversas e autorização de mídia continuam com suas regras atuais.

## Confirmações curtas no centro

Casos: Sem interesse; confirmar venda; descartar alterações; nova senha provisória; mudar papel; desativar/reativar usuário; desativar/reativar lista.

- Título diz a decisão, corpo identifica o alvo e a consequência.
- Cancelar mantém formulário, aba, rascunho e seleção.
- Ação principal tem verbo específico. Usar perigo quando a consequência justifica, sem transformar toda ação administrativa em exclusão.
- Não duplicar formulário dentro da confirmação.
- O botão neutro recebe foco inicial nas decisões destrutivas. Tab fica dentro do pop-up e Escape cancela quando permitido.
- Reload/saída do navegador preservam a proteção nativa já existente; não prometer substituir a confirmação nativa do navegador por um modal HTML.
- Exceção existente na Carteira e também no Funil: Fechar mantendo rascunho precisa continuar disponível onde hoje é suportado. A leitura de app/funil/modal.tsx na preparação do plano confirmou essa opção no descarte do Funil. A confirmação comum não pode remover essa capacidade.

Opção A aprovada em 06/11/2026 para todos os exemplos e como padrão das confirmações: alvo destacado em bloco próprio, consequência curta abaixo e ações no rodapé. Sem interesse, venda e descarte foram apresentados; nas confirmações administrativas, adaptar o alvo à pessoa ou lista sem alterar dados, permissões ou consequências. A alternativa B não foi escolhida. Ver docs/design/2026-11-06-confirmacoes-padrao/README.md. Preservar as exceções de rascunho da Carteira e a confirmação nativa do navegador.

## Históricos e estados

Comercial: tipo, data/hora de Brasília e autor na linha recolhida; detalhes disponíveis ao expandir. Filtros Todos, Atendimentos, Vendas; Expandir todos opera no filtro ativo. No Funil, só contatos próprios e autoria Você. Não fabricar vendas ou mudanças de etapa nessa consulta. Atividade do vendedor no gestor conserva empresa e limite.

Buscas, coletas e WhatsApp preservam campos próprios. Histórico comercial não é auditoria de todas as operações: mudanças de etapa, arquivo e retomada não viram eventos datados sem fonte e contrato próprios. Ver auditoria 2026-11-05-historicos-crm.md.

Em cada painel prever: carregando; vazio coerente; erro de leitura com nova tentativa; indisponível/sem permissão; edição alterada; envio pendente; resultado incerto; sucesso. Erro de leitura e resultado incerto de escrita são estados diferentes. Reenviar significa recuperar o mesmo comando preservado, não gerar outra venda/contato/arquivamento.

Padrão visual dos estados aprovado pelo usuário em 06/11/2026: faixas compactas e recuperação no rodapé; distinguir erro de leitura, histórico vazio, filtro vazio, indisponibilidade, edição, envio e resultado incerto. Primeira venda confirmada conserva a ficha correta na Carteira. Ver docs/design/2026-11-06-estados-paineis/README.md. Os tempos e resultados da amostra são cenários estáticos, sem rede ou persistência real.

## Limites dos mockups

São simulações HTML/CSS/JavaScript sem dependências, fetch, acesso a armazenamento persistente ou integrações. Não implementam RLS, transações, envio, recuperação real ou todos os condicionais de domínio. A galeria mostra organização e navegação; não comprova comportamento do produto.

Os exemplos de empresa, contato, CNPJ, valores e imagem são explicitamente ilustrativos. Não são afirmações de registros reais ou valores válidos. O visualizador local serve somente os arquivos da própria galeria no loopback.

## Situação consolidada por área

| Área | Escolha visual nova | Estado |
| --- | --- | --- |
| Base comum | Largura atual A no desktop; tela inteira A no celular | Aprovado para implementação posterior |
| Meu dia | Próximo passo direto, menu para dados/histórico e Negociação no rodapé | Aprovado para implementação posterior |
| Funil | Menu da negociação, tarefas diretas, venda lateral e Sem interesse preservado | Aprovado para implementação posterior |
| Prospecção | Histórico do Banco na página com empresas expansíveis; critérios em três grupos; espelhamento direto | Aprovado para implementação posterior |
| Carteira | Ficha lateral com menu; atendimento e recompra como tarefas diretas; confirmação central | Aprovado para implementação posterior |
| Gestor | Tarefas diretas, Ações na linha e consultas laterais do perfil com 50 empresas por página | Aprovado para implementação posterior |
| WhatsApp | Imagem e legenda juntas, com ampliação na mesma lateral | Aprovado para implementação posterior |
| Confirmações | A, alvo destacado, consequência abaixo e ações no rodapé; exceções de rascunho preservadas | Aprovado para implementação posterior |
| Estados | Faixas compactas; ações no rodapé; consulta, edição, envio e resultado incerto distintos | Aprovado para implementação posterior |

## Ordem sugerida para implementação posterior

1. Conferir a base de implementação contra a main atual e escrever o plano detalhado da primeira entrega.
2. Implementar o contêiner compartilhado e adaptar Meu dia/Funil, incluindo o cabeçalho móvel.
3. Dados da empresa e navegação de buscas; depois critérios e espelhamento.
4. Venda da Carteira e confirmações comerciais.
5. Formulários e confirmações do gestor; por último mídia WhatsApp.

A ordem é uma proposta de redução de risco, não uma autorização de implementação. Após aprovação do desenho completo, escrever plano detalhado e dividir entregas em PRs contra main, com testes e CI. Sem merge/publicação nesta rodada.

## Critérios da implementação futura

Reutilizar máquinas de estado, consultas, guardas de edição, regras de posse/vínculo, RLS, idempotência e recibos atuais. Não ampliar DTOs/SQL para preencher um mockup. Preservar navegação direta, retomada e recuperação de comandos da rota antiga.

Validar em dados isolados: todos os consumidores reais; 1440 e 390 px, além do limite de breakpoint; claro/escuro; teclado e foco; expansão; rolagem; fechar/voltar/Escape; rascunho; erro de leitura; envio lento; resposta perdida e reload; troca rápida de empresa; permissões dos dois papéis. Não usar negócios ou usuários reais para ensaiar gravações.

Ajustes de composição e detalhes menores de implementação podem ser definidos pelo implementador, desde que não alterem conteúdo, ações, estado ou regras aprovadas.


## Consolidação de 06/11/2026

As escolhas visuais foram concluídas: largura atual A, tela inteira A no celular, confirmações A e estados compactos, além dos agrupamentos e superfícies por área. A galeria Modelos aprovados reúne as versões escolhidas; alternativas antigas continuam disponíveis como referência histórica.

A próxima etapa é planejamento de implementação em entregas pequenas, com revisão independente e testes em dados isolados. Não existe implementação, PR, merge ou publicação autorizada por este documento.

Pendências reais de implementação: adequar textos legados de Listas ao comportamento vigente após leitura do consumidor; garantir compatibilidade de rotas e links diretos; validar guardas de edição, comandos incertos, permissões e mídia real em ambiente isolado. Nada disso foi comprovado pelos mockups.

Preservar rotas diretas como fallback utilizável sem estado prévio; a consulta em contexto passa a usar a lateral aprovada. Como decisão de compatibilidade do autor, não alterar os endereços públicos apenas para reproduzir o mockup. Reutilizar conteúdo e lógica compartilhados em vez de duplicar formulários.

Ver docs/design/2026-11-06-revisao-final/README.md para a matriz de decisões e a proposta de entregas. Essa proposta ainda precisa de planos executáveis antes do código.

Plano da primeira entrega preparado em docs/superpowers/plans/2026-11-06-paineis-entrega-1.md. A main foi conferida em 06/11/2026 e correspondeu à base d830a53; o plano não autoriza merge/publicação e deve ser revisado antes da execução.
