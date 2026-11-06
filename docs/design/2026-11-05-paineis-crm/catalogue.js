const CRM_CATALOGUE=[
{id:'dia',title:'Meu dia',description:'Retornos compactos. A tela começa sem seleção; os painéis mantêm a página de origem.',scenes:[
{id:'inicio',panel:'nenhum',title:'Tela inicial sem seleção',description:'Cards e filtros, sem abrir uma empresa automaticamente.',status:'Comportamento já aprovado'},
{id:'retorno',title:'Abrir retorno',description:'Próximo passo direto, menu para dados e histórico; Negociação no rodapé.',status:'Estrutura aprovada; padronizar superfície'},
{id:'dados',panel:'empresa',title:'Dados da empresa',description:'Todos os dados autorizados, em grupos organizados.',status:'Componente comum'},
{id:'negociacao',title:'Negociação do retorno',description:'A mesma negociação do Funil, sem Resumo e sem repetir cadastro.',status:'Estrutura aprovada'},
{id:'historico',panel:'retorno',tab:'historico',title:'Histórico do retorno',description:'Linha do tempo expansível, com filtros e datas originais.',status:'Padrão aprovado'}]},
{id:'funil',title:'Funil',description:'Três etapas e cards de mesma altura. O conteúdo lateral usa a mesma base de Meu dia.',scenes:[
{id:'negociacao',title:'Negociação',description:'Próximo passo, Atendimento e Histórico. Duas ações no rodapé.',status:'Estrutura aprovada'},
{id:'atendimento',panel:'negociacao',tab:'atendimento',title:'Registrar atendimento',description:'Resultado, anotação, próximo passo e data. Sem dados cadastrais repetidos.',kind:'form'},
{id:'dados',panel:'empresa',title:'Dados da empresa',description:'A mesma ficha organizada em todas as áreas.'},
{id:'venda',title:'Registrar venda',description:'Formulário lateral; conferência final em pop-up.',kind:'form'},
{id:'arquivo',title:'Sem interesse',description:'Três últimas do próprio Funil; Devolver sempre ao Primeiro contato.',status:'Regra já aprovada'}]},
{id:'prospeccao',title:'Prospecção',description:'Dados da empresa, buscas e planejamento Google. Uma lateral substitui a anterior e Voltar recupera o contexto.',scenes:[
{id:'empresa',title:'Ver empresa',description:'Substitui o pop-up cadastral pelo painel comum.'},
{id:'criterios',title:'Critérios do Google',description:'Procurar, Evitar, Contatos e Orientações. Exemplos só nos campos pouco claros.',kind:'form'},
{id:'espelho',title:'Espelhar planejamento',description:'Origem, campos e destinos, com ação fixa no rodapé.',kind:'form'},
{id:'historicoBuscas',panel:'nenhum',context:'banco',bankLayout:'pagina',bankTab:'historico',actions:'rodape',title:'Histórico de buscas do Banco',description:'Histórico na página; Ver empresas expande cada grupo e Filtros usados abre a lateral.'},
{id:'resultadoBusca',panel:'nenhum',context:'banco',bankLayout:'pagina',bankTab:'historico',actions:'rodape',title:'Empresas de uma busca',description:'Ver empresas expande abaixo do grupo. Cada empresa abre seus dados na lateral.'}]},
{id:'carteira',title:'Carteira',description:'Ficha lateral aprovada. Os links diretos e o contexto de Meu dia continuam como contratos a preservar.',scenes:[
{id:'venda',title:'Registrar nova venda',description:'O mesmo formulário lateral de venda, preservando as regras da recompra.',kind:'form'},
{id:'historico',title:'Conteúdo do histórico',description:'Referência do componente comum. A ficha atual continua sendo página.',status:'Referência visual; sem nova rota ou consulta'},
{id:'empresa',title:'Referência dos dados',description:'Conteúdo cadastral reutilizável. Não substitui a ficha completa automaticamente.',status:'Padrão de conteúdo compartilhado'}]},
{id:'gestor',title:'Gestor',description:'Consultas e formulários na lateral. Administração de acessos continua exclusiva do gestor.',scenes:[
{id:'empresa',title:'Ver empresa',description:'O mesmo painel cadastral, respeitando as consultas autorizadas ao gestor.'},
{id:'usuario',title:'Novo usuário',description:'Nome, e-mail e papel. Depois do sucesso, entrega da senha na lateral.',kind:'form'},
{id:'credencial',title:'Entregar senha provisória',description:'Conteúdo de uso único após criar acesso ou confirmar nova senha.',status:'Simulação; nenhuma credencial real'},
{id:'lista',title:'Renomear lista',description:'Um campo, contexto da lista e Salvar nome no rodapé.',kind:'form'},
{id:'historico',title:'Histórico comercial',description:'Referência para ficha da empresa e atividade do vendedor; fonte e limites preservados.',status:'Páginas atuais mantidas'}]},
{id:'whatsapp',title:'WhatsApp',description:'A ampliação de imagem passa para a lateral. Conversas, áudio e documentos mantêm seus formatos atuais.',scenes:[
{id:'midia',title:'Imagem da conversa',description:'Imagem contida, legenda disponível e retorno para a conversa.',status:'Proposta; sem carregar mídia privada'}]},
{id:'historicos',title:'Históricos',description:'Aparência comum, fontes diferentes. O mockup não promete eventos que o sistema não registra.',scenes:[
{id:'retorno',panel:'retorno',tab:'historico',title:'Meu dia',description:'Contatos e vendas que a consulta autorizada disponibiliza.'},
{id:'funil',panel:'negociacao',tab:'historico',title:'Funil',description:'Somente contatos do próprio vendedor. Autoria “Você”.'},
{id:'historico',title:'Carteira e gestor',description:'Atendimento e venda com autor, anotação e datas distintas.',status:'Prévia de conteúdo, não nova superfície obrigatória'},
{id:'busca',panel:'filtrosBusca',context:'banco',bankLayout:'pagina',bankTab:'historico',actions:'rodape',title:'Filtros de uma busca do Banco',description:'Filtros abertos direto pelo card principal da busca. Coletas Google mantêm suas páginas próprias.'}]},
{id:'confirmacoes',title:'Confirmações',description:'Pop-ups curtos sobre o painel, com consequência explícita. Cancelar preserva o que estava sendo editado.',scenes:[
{id:'semInteresse',panel:'negociacao',confirm:'arquivo',title:'Marcar como Sem interesse',description:'Encerra negociação e cancela retornos; preserva vínculo e histórico.'},
{id:'confirmarVenda',panel:'venda',confirm:'venda',title:'Confirmar venda',description:'Empresa, valor e data efetiva. Corrigir dados retorna ao formulário.',kind:'form'},
{id:'descartar',panel:'negociacao',tab:'atendimento',confirm:'descarte',title:'Descartar alterações',description:'Continuar editando ou Descartar, sem fechar o painel por acidente.',kind:'form'},
{id:'acesso',panel:'usuario',confirm:'desativarUsuario',title:'Desativar / reativar usuário',description:'Pop-up identifica pessoa e efeito no acesso.'},
{id:'papel',panel:'usuario',confirm:'papel',title:'Mudar papel',description:'Consequência de virar gestor ou vendedor, sem formulário duplicado.'},
{id:'novaSenha',panel:'nenhum',context:'gestor',confirm:'novaSenha',title:'Nova senha provisória',description:'Confirmação antes da geração; entrega de uso único na lateral.'},
{id:'grupo',panel:'lista',confirm:'desativarLista',title:'Desativar / reativar lista',description:'Explica o impacto existente; não remove dados nem recria a importação.'}]}
]

CRM_CATALOGUE.push({id:'estados',title:'Estados',description:'Como o mesmo painel mostra carregamento, vazio, erro e envio sem confirmação. São apenas representações visuais.',scenes:[
{id:'carregando',panel:'empresa',state:'carregando',title:'Carregando consulta',description:'Título e saída continuam acessíveis. Corpo mostra carregamento.'},
{id:'erro',panel:'empresa',state:'erro',title:'Falha de leitura',description:'Mensagem curta e Tentar novamente, sem alterar a empresa.'},
{id:'vazio',panel:'historico',state:'vazio',title:'Nenhum registro',description:'Um vazio compacto, dentro do painel.'},
{id:'enviando',panel:'venda',state:'enviando',title:'Envio em andamento',description:'Formulário e saída bloqueados enquanto aguarda confirmação.',kind:'form'},
{id:'incerto',panel:'venda',state:'incerto',title:'Resposta perdida',description:'Exibe o envio preservado e recupera o mesmo comando.',kind:'form'}
]})


const confirmationArea=CRM_CATALOGUE.find(a=>a.id==='confirmacoes')
confirmationArea.scenes.forEach(s=>{if(['acesso','papel','novaSenha'].includes(s.id)){s.panel='nenhum';s.context='gestor'}if(s.id==='grupo'){s.panel='nenhum';s.context='gestor'}})
confirmationArea.scenes.push(
{id:'reativarUsuario',panel:'nenhum',context:'gestor',confirm:'reativarUsuario',title:'Reativar usuário',description:'Confirma a volta do acesso da pessoa.'},
{id:'tornarVendedor',panel:'nenhum',context:'gestor',confirm:'tornarVendedor',title:'Tornar vendedor',description:'Explica a perda de acesso à administração.'},
{id:'reativarLista',panel:'nenhum',context:'gestor',confirm:'reativarLista',title:'Reativar lista',description:'Preserva a regra de elegibilidade atual e os vínculos existentes.'}
)


CRM_CATALOGUE.unshift({id:'estrutura',title:'Estrutura da Negociação',defaultScene:'menu',description:'Menu interno escolhido em 06/11/2026. Conteúdo aprovado; organização dos botões será discutida depois.',scenes:[
 {id:'abas',panel:'negociacao',context:'funil',layout:'abas',title:'Duas abas agrupadas',description:'Atendimento reúne próximo passo e registro. Histórico fica separado.',status:'Alternativa de comparação',note:'Menos abas, com o histórico sempre a um toque.'},
 {id:'secoes',panel:'negociacao',context:'funil',layout:'secoes',title:'Seções expansíveis',description:'Atendimento e Histórico se abrem no mesmo corpo, sem faixa de abas.',status:'Alternativa de estrutura',note:'As duas seções continuam visíveis como títulos.'},
 {id:'menu',panel:'negociacao',context:'funil',layout:'menu',title:'Menu interno de seções',description:'Uma entrada para Atendimento e próximo passo; outra para Histórico.',status:'Escolhido pelo usuário',note:'Estrutura aprovada: menu interno. Próxima discussão: organização dos botões.'},
 {id:'referencia',panel:'negociacao',context:'funil',layout:'original',title:'Referência anterior',description:'A organização anterior com Próximo passo, Atendimento e Histórico.',status:'Conteúdo de referência',note:'Referência para comparar; mesmas informações e ações.'}
]})


CRM_CATALOGUE.unshift({id:'botoes',title:'Botões da Negociação',defaultScene:'rodape',description:'Ações no rodapé escolhidas em 06/11/2026. A alternativa por contexto permanece apenas para comparação.',ruleTitle:'Proposta de tamanhos e funções',rules:[
 'Mesma altura: 40 px no desktop e 44 px no celular.',
 'Ação principal preenchida; ações de apoio com contorno.',
 'Menu troca a seção. Botão executa uma ação. Pares no rodapé têm larguras iguais.'
],scenes:[
 {id:'rodape',panel:'negociacao',context:'funil',layout:'menu',actions:'rodape',title:'Ações no rodapé',description:'Registrar venda e Sem interesse sempre no mesmo lugar. Salvar e Cancelar aparecem durante a edição.',status:'Escolhido pelo usuário',note:'Modelo A aprovado. Ações gerais no rodapé; edição usa Salvar e Cancelar.'},
 {id:'contexto',panel:'negociacao',context:'funil',layout:'menu',actions:'contexto',title:'Ações por contexto',description:'Venda e Sem interesse no início do menu. Atendimento destaca apenas o registro; edição mantém Salvar e Cancelar no rodapé.',status:'Alternativa para comparar',note:'Menos ações durante a leitura; Voltar ao menu para vender ou marcar Sem interesse.'}
]})


CRM_CATALOGUE.unshift({id:'dados',title:'Dados da empresa',defaultScene:'tres',badge:'Três grupos escolhidos',description:'Três grupos escolhidos em 06/11/2026. As outras divisões permanecem apenas como referência.',ruleTitle:'Decisões preservadas',rules:[
 'Menu interno para várias seções; Voltar retorna ao menu.',
 'Ações disponíveis no rodapé. Consulta sem ação comercial não ganha botão artificial.',
 'Os dados são os mesmos; telefone, CNPJ e CNAE aparecem nas orientações do menu.'
],scenes:[
 {id:'tres',panel:'empresa',context:'dia',actions:'rodape',companyGrouping:'tres',title:'A · Três grupos',description:'Contato e localização; Cadastro e origem; Atividades e sócios.',status:'Escolhido pelo usuário',note:'Três grupos aprovados. Telefone e endereço ficam juntos.'},
 {id:'quatro',panel:'empresa',context:'dia',actions:'rodape',companyGrouping:'quatro',title:'B · Quatro grupos',description:'Contatos; Cadastro e origem; Endereço; Atividades e sócios.',status:'Alternativa para comparar',note:'Contato e endereço têm acessos separados e mais curtos.'},
 {id:'referencia',panel:'empresa',context:'dia',companyGrouping:'original',title:'Referência do conteúdo',description:'Os mesmos dados em uma sequência contínua, para conferir a preservação.',status:'Conteúdo aprovado',note:'Referência anterior sem menu. Não é uma terceira proposta de estrutura.'}
]})


CRM_CATALOGUE.unshift({id:'meudia',title:'Navegação de Meu dia',defaultScene:'direto',badge:'Acesso direto escolhido',description:'Próximo passo direto escolhido em 06/11/2026. Dados e Histórico no menu; Negociação no rodapé.',ruleTitle:'Decisões preservadas',rules:[
 'Dados da empresa usa os três grupos aprovados.',
 'Negociação continua no rodapé; o atendimento é registrado dentro dela.',
 'Histórico e Voltar preservam o contexto. A página não escolhe uma empresa sozinha.'
],scenes:[
 {id:'direto',panel:'retorno',context:'dia',dailyLayout:'direto',actions:'rodape',title:'A · Próximo passo direto',description:'Ação e data aparecem ao abrir. Menu para Dados da empresa e Histórico, com Negociação no rodapé.',status:'Escolhido pelo usuário',note:'Próximo passo direto aprovado. O combinado aparece logo ao abrir.'},
 {id:'menu',panel:'retorno',context:'dia',dailyLayout:'menu',actions:'rodape',title:'B · Menu completo do retorno',description:'Próximo passo, Dados da empresa e Histórico são três entradas. Negociação fica no rodapé.',status:'Alternativa para comparar',note:'Todas as consultas começam pelo mesmo menu; próximo passo exige mais um toque.'},
 {id:'referencia',panel:'retorno',context:'dia',dailyLayout:'original',actions:'rodape',title:'Referência anterior',description:'Próximo passo e Histórico em abas, com Dados da empresa e Negociação no rodapé.',status:'Referência de conteúdo',note:'Organização anterior para comparar; não é uma nova proposta de padrão.'}
]})


CRM_CATALOGUE.unshift({id:'banco',title:'Histórico do Banco',defaultScene:'pagina',badge:'Aba e expansão escolhidas',description:'Histórico na página. Cada busca expande suas empresas abaixo do próprio card.',ruleTitle:'Organização escolhida',rules:[
 'Ver empresas expande e recolhe a lista na própria página.',
 'Cada empresa tem Ver empresa; Dados da empresa abre na lateral.',
 'Filtros usados aparece somente no card principal da busca e abre direto na lateral.'
],scenes:[
 {id:'pagina',panel:'nenhum',context:'banco',bankLayout:'pagina',bankTab:'historico',actions:'rodape',title:'A · Histórico na página com empresas expansíveis',description:'Ver empresas abre o acordeão abaixo da busca. Filtros usados fica somente no card principal.',status:'Ajuste aprovado pelo usuário',note:'Empresas na página; dados e filtros na lateral. Tudo começa recolhido.'},
 {id:'painel',panel:'historicoBuscas',context:'banco',bankLayout:'painel',actions:'rodape',title:'B · Referência anterior em painel lateral',description:'Lista e resultado dentro do painel, para consulta da alternativa anterior.',status:'Alternativa não escolhida',note:'Referência anterior. A opção A com expansão na página é a decisão atual.'}
]})


CRM_CATALOGUE.unshift({id:'criterios',title:'Grupos dos critérios Google',defaultScene:'tres',badge:'Três grupos escolhidos',description:'Três grupos escolhidos em 06/11/2026. Conteúdo e ações no rodapé preservados.',ruleTitle:'O que permanece',rules:[
 'Nenhum campo é removido ou adicionado; muda somente a organização.',
 'Voltar retorna ao menu e conserva o que foi preenchido.',
 'Cancelar e Aplicar critérios ficam no rodapé. Aplicar não dispara busca nem salva o planejamento semanal.'
],scenes:[
 {id:'tres',panel:'criterios',context:'prospeccao',criteriaLayout:'tres',actions:'rodape',title:'A · Três grupos',description:'Empresas e produtos; Contatos e presença digital; Preferências e restrições.',status:'Escolhido pelo usuário',note:'Três grupos aprovados. Orientações fica junto de Preferências e restrições.'},
 {id:'dois',panel:'criterios',context:'prospeccao',criteriaLayout:'dois',actions:'rodape',title:'B · Dois grupos',description:'Perfil e preferências; Contatos e presença digital.',status:'Alternativa para comparar',note:'Menu menor; Perfil e preferências concentra mais campos e exige mais rolagem.'},
 {id:'referencia',panel:'criterios',context:'prospeccao',criteriaLayout:'original',actions:'rodape',title:'Referência anterior · Quatro abas',description:'Procurar, Evitar, Contatos e Orientações. Referência do conteúdo anterior.',status:'Referência de conteúdo',note:'Arranjo anterior para conferir que os campos são os mesmos; não reabre a escolha global do menu.'}
]})


CRM_CATALOGUE.unshift({id:'espelhar',title:'Estrutura de Espelhar planejamento',defaultScene:'direto',badge:'Formulário direto escolhido',description:'Espelhamento aprovado como formulário direto, com ações no rodapé.',ruleTitle:'Mesma tarefa, mesmo conteúdo',rules:[
 'Origem, campos a copiar e dias de destino são os mesmos nas duas opções.',
 'Cancelar e Espelhar nos dias escolhidos ficam no rodapé.',
 'A prévia usa datas e planos fictícios. Nenhuma cópia ou coleta real é executada.'
],scenes:[
 {id:'direto',panel:'espelho',context:'prospeccao',mirrorLayout:'direto',actions:'rodape',title:'A · Formulário direto',description:'Origem, O que copiar e Destino aparecem juntos ao abrir.',status:'Escolhido pelo usuário',note:'Formulário direto aprovado em 06/11/2026.'},
 {id:'menu',panel:'espelho',context:'prospeccao',mirrorLayout:'menu',actions:'rodape',title:'B · Duas seções no menu',description:'Origem e conteúdo; Dias de destino. Voltar conserva as escolhas.',status:'Alternativa para comparar',note:'Reduz o conteúdo visível de cada vez; exige entrar em duas seções para concluir.'}
]})


CRM_CATALOGUE.unshift({id:'cliente',title:'Abertura do cliente na Carteira',defaultScene:'lateral',badge:'Ficha lateral escolhida',description:'Ficha do cliente aprovada na lateral, com lista ao fundo e tarefas preservando a seção de origem.',ruleTitle:'Conteúdo e regras preservados',rules:[
 'Atendimento e próximo passo, dados cadastrais e histórico usam os mesmos exemplos nas duas opções.',
 'Registrar atendimento e Registrar venda continuam como tarefas do cliente, sem avançar etapas do Funil.',
 'A lista é simplificada para comparar a abertura. Nenhum cliente, atendimento ou venda real é alterado.'
],scenes:[
 {id:'lateral',panel:'cliente',context:'carteira',walletLayout:'lateral',actions:'rodape',title:'A · Cliente no painel lateral',description:'Menu para Atendimento e próximo passo, Dados da empresa e Histórico. A lista permanece ao fundo.',status:'Escolhido pelo usuário',note:'Ficha lateral aprovada em 06/11/2026.'},
 {id:'pagina',panel:'nenhum',context:'carteira',walletLayout:'pagina',walletOpen:true,actions:'rodape',title:'B · Cliente em página própria',description:'Ficha com Atendimento, Dados da empresa e Histórico em abas. Voltar recupera a lista.',status:'Alternativa para comparar',note:'Mais largura para dados e histórico; exige sair da lista para consultar o cliente.'}
]})


CRM_CATALOGUE.unshift({id:'usuarios',title:'Ações dos usuários do gestor',defaultScene:'menu',badge:'Menu Ações escolhido',description:'Menu Ações na linha aprovado. Confirmações no centro e entrega de senha na lateral permanecem.',ruleTitle:'Mesmas ações autorizadas',rules:[
 'Pessoa ativa: nova senha, mudar papel e desativar. Pessoa inativa: somente reativar.',
 'A própria conta não oferece alterações administrativas. Ver perfil aparece só para vendedor ativo.',
 'Todos os usuários são fictícios. Nenhuma senha real, mudança de acesso ou mensagem é enviada.'
],scenes:[
 {id:'menu',panel:'nenhum',context:'usuarios',adminLayout:'menu',actions:'rodape',title:'A · Menu Ações na linha',description:'Um menu compacto reúne as ações de cada pessoa e abre a confirmação diretamente.',status:'Escolhido pelo usuário',note:'Menu Ações aprovado em 06/11/2026. Ver perfil mantém a página comercial existente.'},
 {id:'painel',panel:'adminAccess',context:'usuarios',adminLayout:'painel',actions:'rodape',title:'B · Painel Gerenciar acesso',description:'A lateral separa Senha de acesso de Papel e situação. Ações específicas ficam no rodapé.',status:'Alternativa não escolhida',note:'Referência anterior. O usuário escolheu o menu Ações na linha.'}
]})


CRM_CATALOGUE.unshift({id:'perfil',title:'Organização do perfil do vendedor',defaultScene:'lateral',badge:'Consultas laterais aprovadas',description:'Botões com painel lateral e 50 empresas por página aprovados. CNPJ permanece selecionável.',ruleTitle:'Mesmo conteúdo comercial',rules:[
 'Os quatro indicadores permanecem na página em todas as opções; não há uma aba isolada de Resumo.',
 'Empresas vinculadas e últimos atendimentos usam os mesmos dados fictícios.',
 'Ver perfil é consulta do gestor. Nenhuma ação de atendimento, venda ou permissão é adicionada.'
],scenes:[
 {id:'lateral',panel:'nenhum',context:'usuarios',profileLayout:'lateral',actions:'rodape',title:'C · Botões com painel lateral',description:'Indicadores na página; Empresas e Atendimentos abrem consultas diretas na lateral.',status:'Escolhido pelo usuário',note:'Botões com consultas laterais aprovados em 06/11/2026. Empresas mantém 50 registros por página.'},
 {id:'volume',panel:'nenhum',context:'usuarios',profileLayout:'lateral',profileVolume:1000,actions:'rodape',title:'C · Exemplo com 1.000 empresas',description:'Empresas abre com até 50 cards por página e controles fixos de Anterior/Próxima.',status:'Demonstração de volume com dados fictícios',note:'São 20 páginas de 50 empresas. Só a página selecionada é renderizada na consulta.'},
 {id:'abas',panel:'nenhum',context:'usuarios',profileLayout:'abas',actions:'rodape',title:'A · Empresas e Atendimentos em abas',description:'Indicadores no topo; cada aba usa a largura disponível para seu conteúdo.',status:'Alternativa anterior para comparar',note:'Referência anterior: o conteúdo usa toda a largura da página dentro de abas.'},
 {id:'blocos',panel:'nenhum',context:'usuarios',profileLayout:'blocos',actions:'rodape',title:'B · Dois blocos lado a lado',description:'Indicadores no topo; empresas e últimos atendimentos aparecem juntos.',status:'Alternativa para comparar',note:'Permite consultar os dois blocos juntos no desktop. No celular, eles ficam empilhados.'}
]})


CRM_CATALOGUE.unshift({id:'imagem',title:'Imagem do WhatsApp na lateral',defaultScene:'integrada',badge:'Imagem e legenda juntas aprovadas',description:'A aprovado com Ampliar imagem. A visualização maior usa a mesma lateral e Voltar recupera a legenda.',ruleTitle:'Conteúdo e contexto preservados',rules:[
 'A mesma imagem e legenda nas duas composições; sem corte do conteúdo.',
 'Voltar recupera a legenda após ampliar; Fechar devolve à conversa. Consulta direta, sem menu interno.',
 'A imagem é uma ilustração fictícia da galeria. Nenhuma mídia privada é carregada.'
],scenes:[
 {id:'integrada',panel:'midia',context:'whatsapp',mediaLayout:'integrada',actions:'rodape',title:'A · Imagem e legenda juntas',description:'Imagem e legenda no mesmo corpo; Ampliar imagem abre a visualização maior.',status:'Escolhido pelo usuário',note:'A aprovado em 06/11/2026 com botão Ampliar imagem. Voltar recupera imagem e legenda.'},
 {id:'separada',panel:'midia',context:'whatsapp',mediaLayout:'separada',actions:'rodape',title:'B · Legenda fixa no rodapé',description:'A imagem fica centralizada no corpo e a legenda tem uma área separada.',status:'Alternativa não escolhida',note:'Referência anterior. O usuário escolheu imagem e legenda juntas.'},
 {id:'integrada-longa',panel:'midia',context:'whatsapp',mediaLayout:'integrada',mediaCaption:'longa',actions:'rodape',title:'A · Exemplo com legenda longa',description:'A mesma composição A com mais texto para avaliar a rolagem.',status:'Exemplo de leitura',note:'Imagem e legenda longa compartilham a rolagem do corpo.'},
 {id:'separada-longa',panel:'midia',context:'whatsapp',mediaLayout:'separada',mediaCaption:'longa',actions:'rodape',title:'B · Exemplo com legenda longa',description:'A mesma composição B com mais texto para avaliar a área fixa.',status:'Exemplo de leitura',note:'A área da legenda tem altura limitada e rolagem própria, preservando espaço para a imagem.'}
]})


CRM_CATALOGUE.unshift({id:'confirmacao-padrao',title:'Padrão das confirmações',defaultScene:'alvo',badge:'Alvo destacado aprovado',description:'Opção A escolhida para todas as confirmações: alvo em bloco próprio, consequência abaixo e ações no rodapé.',ruleTitle:'O que permanece igual',rules:[
 'Os mesmos dados, consequências e botões em A e B. Só a organização visual muda.',
 'Cancelar ou Escape recupera o painel e o rascunho. A confirmação não repete o formulário.',
 'Foco inicial na ação neutra; ações no rodapé, com o mesmo tamanho. Exemplos totalmente fictícios.'
],scenes:[
 {id:'alvo',panel:'negociacao',context:'funil',layout:'menu',actions:'rodape',confirm:'arquivo',confirmationLayout:'destacado',confirmationDemo:true,title:'A · Empresa destacada',description:'Nome em um bloco próprio; consequência curta logo abaixo.',status:'Escolhido pelo usuário',note:'A aprovado em 06/11/2026, incluindo venda e descarte. Alvo destacado no pop-up central.'},
 {id:'texto',panel:'negociacao',context:'funil',layout:'menu',actions:'rodape',confirm:'arquivo',confirmationLayout:'texto',confirmationDemo:true,title:'B · Texto corrido',description:'Nome e consequência na sequência, sem bloco destacado.',status:'Alternativa não escolhida',note:'Referência anterior. O usuário escolheu A, com alvo destacado.'},
 {id:'venda-alvo',panel:'venda',context:'funil',actions:'rodape',confirm:'venda',confirmationLayout:'destacado',confirmationDemo:true,title:'A · Conferir venda',description:'Empresa, valor e data no mesmo bloco de conferência.',status:'Escolhido pelo usuário',note:'A aprovado. Os dados vêm do formulário fictício abaixo; Cancelar permite corrigir.'},
 {id:'venda-texto',panel:'venda',context:'funil',actions:'rodape',confirm:'venda',confirmationLayout:'texto',confirmationDemo:true,title:'B · Conferir venda',description:'Os mesmos dados em linhas de texto, sem bloco.',status:'Alternativa não escolhida',note:'Referência anterior com os mesmos dados e consequência. O usuário escolheu A.'},
 {id:'rascunho-alvo',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',actions:'rodape',confirm:'descarte',confirmationLayout:'destacado',confirmationDemo:true,title:'A · Descartar alterações',description:'Identifica o formulário e a empresa. Continuar editando preserva o texto.',status:'Escolhido pelo usuário',note:'A aprovado. O exemplo tem anotação fictícia não salva; Continuar editando preserva o texto.'},
 {id:'rascunho-texto',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',actions:'rodape',confirm:'descarte',confirmationLayout:'texto',confirmationDemo:true,title:'B · Descartar alterações',description:'Formulário e empresa em texto. As ações permanecem iguais.',status:'Alternativa não escolhida',note:'Referência anterior com o mesmo rascunho. O usuário escolheu A.'}
]})


CRM_CATALOGUE.unshift({id:'estados-padrao',title:'Estados dos painéis',defaultScene:'erro',badge:'Padrão aprovado',description:'Estados aprovados: faixas compactas e ações no rodapé, preservando as diferenças entre consulta, edição e envio.',ruleTitle:'Regras preservadas',rules:[
 'Erro de consulta permite tentar novamente. Envio sem confirmação exige verificar o mesmo registro.',
 'Durante envio ou verificação, os dados enviados ficam em leitura e não existe um segundo botão de salvar.',
 'Nada chama o CRM. Use os cenários para comparar os momentos; não há espera nem resposta de servidor real.'
],scenes:[
 {id:'carregando',panel:'empresa',context:'dia',state:'carregando',stateStudy:true,actions:'rodape',title:'Carregando dados',description:'Cabeçalho acessível e indicação curta de consulta.',note:'A saída continua disponível durante uma consulta. O cenário permanece carregando para avaliação visual.'},
 {id:'vazio',panel:'cliente',context:'carteira',walletLayout:'lateral',state:'vazio',stateStudy:true,actions:'rodape',title:'Histórico sem registros',description:'Vazio compacto, sem ação artificial ou orientação de filtro inexistente.',note:'Primeiro registro: os eventos aparecerão após atendimentos ou vendas. Nenhum dado é criado pelo mockup.'},
 {id:'filtrado',panel:'cliente',context:'carteira',walletLayout:'lateral',state:'filtrado',stateStudy:true,actions:'rodape',title:'Filtro sem resultados',description:'Mantém o filtro visível e oferece Ver todos no rodapé.',note:'Ver todos recupera a linha do tempo fictícia. É diferente de um histórico sem nenhum registro.'},
 {id:'erro',panel:'empresa',context:'dia',state:'erro',stateStudy:true,actions:'rodape',title:'Falha ao carregar',description:'Explica a falha e coloca Tentar novamente no rodapé.',note:'Tentar novamente mostra os dados fictícios. É recuperação de consulta, sem gravação.'},
 {id:'indisponivel',panel:'empresa',context:'dia',state:'indisponivel',stateStudy:true,actions:'rodape',title:'Conteúdo indisponível',description:'Saída disponível e mensagem sem dados restritos.',note:'Sem botão para contornar permissões. O título não expõe nome ou dados do conteúdo indisponível.'},
 {id:'alterado',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',state:'alterado',stateStudy:true,confirmationLayout:'destacado',actions:'rodape',title:'Edição não salva',description:'Cancelar e Salvar no rodapé; sair pede a confirmação A aprovada.',note:'O exemplo começa com anotação fictícia. Continuar editando preserva o texto.'},
 {id:'enviando',panel:'venda',context:'funil',state:'enviando',stateStudy:true,actions:'rodape',title:'Registrando venda',description:'Exibe os dados enviados; edição e nova gravação ficam bloqueadas.',note:'Exemplo congelado de envio lento. Use outro cenário para avaliar a etapa seguinte.'},
 {id:'incerto',panel:'venda',context:'funil',state:'incerto',stateStudy:true,actions:'rodape',title:'Envio sem confirmação',description:'Dados enviados em leitura e Verificar registro no rodapé.',note:'Verificar registro mostra a espera de verificação do mesmo envio. Fechar e Reabrir verificação conservam os dados na memória desta prévia.'},
 {id:'sucesso',panel:'cliente',context:'carteira',walletLayout:'lateral',state:'sucesso',stateStudy:true,actions:'rodape',title:'Primeira venda confirmada',description:'A ficha correta já está na Carteira, com aviso curto de sucesso.',note:'Estado ilustrativo após confirmação real. Nenhuma venda foi registrada. A navegação de primeira venda continua como contrato existente.'}
]})

CRM_CATALOGUE.find(area=>area.id==='estados-padrao').scenes.forEach(scene=>{scene.status='Aprovado pelo usuário'})


CRM_CATALOGUE.unshift({id:'largura-paineis',title:'Largura dos painéis',defaultScene:'atual',badge:'Largura atual aprovada',description:'A escolhida: mesma largura comum de até 520 px no computador. A opção B permanece como referência.',ruleTitle:'O que permanece igual',rules:[
 'Uma largura comum para consultas e formulários. A ampliação de imagem conserva a exceção já aprovada.',
 'Cabeçalho e ações fixos; só o corpo rola. Não acrescentar conteúdo para preencher o espaço.',
 'No celular, as duas opções ocupam a tela inteira. Notebook permite ver a adaptação em uma tela menor.'
],scenes:[
 {id:'atual',panel:'retorno',context:'dia',dailyLayout:'direto',panelSize:'base',actions:'rodape',title:'A · Largura atual',description:'Até 520 px. Deixa mais espaço da página visível ao fundo.',status:'Escolhido pelo usuário',note:'A aprovado em 06/11/2026. Limite de 520 px; a largura se adapta ao computador.'},
 {id:'amplo',panel:'retorno',context:'dia',dailyLayout:'direto',panelSize:'amplo',actions:'rodape',title:'B · Mais espaço',description:'Até 640 px. Dá mais espaço ao conteúdo e aos nomes longos.',status:'Alternativa não escolhida',note:'Referência anterior. O usuário escolheu A, com largura comum de até 520 px.'},
 {id:'form-atual',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',panelSize:'base',confirmationLayout:'destacado',actions:'rodape',title:'A · Formulário atual',description:'O atendimento aprovado dentro da largura de até 520 px.',status:'Escolhido pelo usuário',note:'A aprovado. Mesmos campos e ações; nenhum campo ou regra foi alterado.'},
 {id:'form-amplo',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',panelSize:'amplo',confirmationLayout:'destacado',actions:'rodape',title:'B · Formulário mais amplo',description:'O mesmo atendimento dentro da largura de até 640 px.',status:'Alternativa não escolhida',note:'Referência anterior com os mesmos campos. O usuário escolheu a largura A.'},
 {id:'curto-atual',panel:'lista',context:'gestor',panelSize:'base',confirmationLayout:'destacado',actions:'rodape',title:'A · Tarefa curta',description:'Renomear lista direto, usando a mesma largura de até 520 px.',status:'Escolhido pelo usuário',note:'A aprovado. Tarefa curta direta na mesma largura comum; sem blocos artificiais.'},
 {id:'curto-amplo',panel:'lista',context:'gestor',panelSize:'amplo',confirmationLayout:'destacado',actions:'rodape',title:'B · Tarefa curta',description:'A mesma renomeação, usando a largura comum de até 640 px.',status:'Alternativa não escolhida',note:'Referência anterior. A largura atual A foi escolhida também para tarefas curtas.'}
]})


CRM_CATALOGUE.unshift({id:'painel-celular',title:'Painel no celular',defaultScene:'inteiro',defaultDevice:'mobile',badge:'Tela inteira aprovada',description:'A escolhida no celular: tela inteira, com o cabeçalho da tarefa e rodapé fixo. No computador, largura atual A.',ruleTitle:'Conteúdo e navegação preservados',rules:[
 'Mesmos campos, menus, cabeçalho e ações. A diferença é manter ou cobrir a barra do CRM.',
 'Cabeçalho e rodapé do painel ficam acessíveis; o corpo tem sua própria rolagem.',
 'Fechar e Voltar preservam contexto e rascunho. Confirmações A continuam centrais.'
],scenes:[
 {id:'inteiro',panel:'retorno',context:'dia',dailyLayout:'direto',panelSize:'base',mobilePanel:'inteiro',actions:'rodape',title:'A · Tela inteira',description:'O painel ocupa toda a altura, com um único cabeçalho visível.',status:'Escolhido pelo usuário',note:'A aprovado em 06/11/2026: tela inteira e apenas o cabeçalho da tarefa.'},
 {id:'contexto',panel:'retorno',context:'dia',dailyLayout:'direto',panelSize:'base',mobilePanel:'contexto',actions:'rodape',title:'B · Barra do CRM visível',description:'Mantém a barra do CRM acima do painel e reduz a área disponível.',status:'Alternativa não escolhida',note:'Referência anterior. O usuário escolheu A, tela inteira.'},
 {id:'form-inteiro',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',panelSize:'base',mobilePanel:'inteiro',confirmationLayout:'destacado',actions:'rodape',title:'A · Formulário em tela inteira',description:'O mesmo atendimento, usando toda a altura do celular.',status:'Escolhido pelo usuário',note:'A aprovado. Voltar no topo, Cancelar/Salvar no rodapé e rolagem apenas no corpo.'},
 {id:'form-contexto',panel:'negociacao',context:'funil',layout:'menu',tab:'atendimento',panelSize:'base',mobilePanel:'contexto',confirmationLayout:'destacado',actions:'rodape',title:'B · Formulário com barra do CRM',description:'O mesmo atendimento, abaixo da barra do CRM visível.',status:'Alternativa não escolhida',note:'Referência anterior. A apresentação móvel A foi escolhida.'}
]})


const approvedScenes=[
 ['dia','inicio','dia','Meu dia sem seleção'],
 ['meudia','direto','retorno','Abrir retorno'],
 ['botoes','rodape','negociacao','Negociação'],
 ['largura-paineis','form-atual','atendimento','Registrar atendimento'],
 ['dados','tres','empresa','Dados da empresa'],
 ['funil','venda','venda','Registrar venda'],
 ['funil','arquivo','arquivo','Sem interesse'],
 ['banco','pagina','banco','Banco: histórico e empresas'],
 ['criterios','tres','criterios','Critérios Google'],
 ['espelhar','direto','espelho','Espelhar planejamento'],
 ['cliente','lateral','cliente','Cliente na Carteira'],
 ['usuarios','menu','usuarios','Ações dos usuários'],
 ['gestor','usuario','novoUsuario','Novo usuário'],
 ['gestor','credencial','entrega','Entrega de acesso'],
 ['gestor','lista','lista','Renomear lista'],
 ['perfil','lateral','perfil','Perfil do vendedor'],
 ['imagem','integrada','imagem','Imagem e legenda'],
 ['confirmacao-padrao','alvo','confirmacao','Confirmação padrão A'],
 ['estados-padrao','incerto','incerto','Envio sem confirmação']
].map(([areaId,sceneId,id,title])=>{
 const sourceArea=CRM_CATALOGUE.find(area=>area.id===areaId)
 const source=sourceArea?.scenes.find(scene=>scene.id===sceneId)
 if(!source)throw new Error('Referência de mockup ausente: '+areaId+'/'+sceneId)
 return {...source,id,title,context:source.context||areaId,panel:source.panel||source.id,panelSize:'base',mobilePanel:'inteiro',actions:'rodape',status:'Composição aprovada',note:'Modelo aprovado para implementação posterior. Dados e ações são simulações; o produto ainda não foi alterado.'}
})
CRM_CATALOGUE.unshift({id:'revisao-final',title:'Modelos aprovados',defaultScene:'dia',badge:'Desenho consolidado',description:'Escolhas reunidas, sem novas alternativas. Largura atual A no computador e tela inteira A no celular.',ruleTitle:'Base aprovada',rules:[
 'Conteúdos e formulários na lateral; confirmações A no centro.',
 'Menu para várias seções; tarefas curtas diretas. Cabeçalho e rodapé fixos, com rolagem no corpo.',
 'Os modelos são referências de composição. Regras, permissões, consultas e recuperação reais serão validadas na implementação.'
],scenes:approvedScenes})
