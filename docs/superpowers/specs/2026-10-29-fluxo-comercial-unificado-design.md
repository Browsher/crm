# Fluxo comercial unificado e padrão de empresas

Data: 29/10/2026. Estado: proposta consolidada para revisão do usuário, antes do plano de implementação.

## Objetivo e motivo

O CRM passou a entregar empresas do Google e do Banco de empresas para cada vendedor, mas ainda apresenta regras e telas da antiga fila compartilhada. Reservas de 30 minutos, descanso de 30 dias, navegação por listas e conteúdos diferentes para a mesma empresa confundem o trabalho comercial.

Esta revisão alinha as regras de atendimento e a apresentação de empresas em Prospecção, últimas empresas, gestor, Funil, Meu dia e Carteira. O mesmo cadastro deve ter informações e ações consistentes, respeitando as permissões de cada papel. Essas visões não devem criar cópias da empresa.

Este documento descreve o comportamento pretendido. Não autoriza por si só migração de dados, merge ou publicação. Não houve alteração da aplicação ou de produção nesta etapa.

## Decisões confirmadas na conversa

| Tema | Regra |
| --- | --- |
| Prospecção por listas | Retirar a experiência antiga do vendedor, incluindo catálogo, escolha de lista e atalhos que a reabrem. Preservar os vínculos internos usados pelas buscas. |
| Atendimento | Empresa pessoal recebida fica vinculada ao vendedor. Atendimento direto, sem reserva ou expiração de 30 minutos. |
| Ver empresa | Abrir um pop-up apenas com informações da empresa selecionada. Visualizar não inicia atendimento nem registra contato comercial. |
| Padrão visual | Usar a mesma base de cards, dados, estados e ações na consulta pessoal, últimas empresas e empresas do gestor, com diferenças apenas de contexto e permissão. |
| Funil | A empresa entra ao registrar interesse ou retorno combinado com ela. Receber, visualizar ou iniciar atendimento não cria negociação. |
| Carteira | A empresa torna-se cliente da Carteira após a primeira venda. Negociações sem venda ficam no Funil. |
| Descanso automático | Retirar devolução e bloqueio automáticos de 30 dias, mantendo histórico e vínculo. |
| Não atendeu | O vendedor pode deixar sem retorno ou agendar uma tentativa em Meu dia, sem colocar a empresa no Funil. |
| Sem interesse | Situação própria, com área para consultar essas empresas, fora das listas de trabalho ativo. No Funil, usar um card para receber o arraste, com animação de lixeira, sem criar uma coluna de empresas arquivadas. |
| Efeito de Sem interesse | Encerrar a negociação quando houver e cancelar os retornos pendentes. Preservar histórico e vínculo com o vendedor. |

O usuário também sinalizou a preferência por filtrar empresas para não repeti-las entre vendedores. A proposta de distribuição abaixo concretiza esse objetivo e permanece identificada como recomendação do assistente.

A decisão posterior sobre Sem interesse substitui a opção anterior de manter novos retornos enquanto a empresa estiver nesse estado. Não atendeu e Sem interesse passam a ter comportamentos distintos.

## Fluxo e próxima ação

1. Google ou Banco entrega uma empresa ao vendedor, sem criar negociação ou cliente.
2. A empresa aparece em sua base pessoal. Ver empresa permite consultar os dados, sem efeitos comerciais.
3. Iniciar atendimento permite registrar o resultado diretamente, sem relógio de expiração.
4. O resultado determina os próximos efeitos:

| Resultado ou ação | Destino | Agenda |
| --- | --- | --- |
| Não atendeu | Continua no atendimento pessoal, sem negociação nova. | Pode ficar sem retorno ou ter uma tentativa marcada pelo vendedor. |
| Interesse | Cria ou continua negociação no Funil. | Próximo passo e data, quando definidos, alimentam Meu dia. |
| Retorno combinado com a empresa | Cria ou continua negociação no Funil, com o combinado e a data. | Alimenta Meu dia na data definida. |
| Marcar Sem interesse ou arrastar para esse destino | Arquiva em Sem interesse e encerra eventual negociação aberta. | Cancela os retornos pendentes. |
| Primeira venda | Encerra a negociação de primeira venda e passa a constar na Carteira. | Preserva o próximo passo ainda válido, conforme o fluxo atual. |

Meu dia mostra tarefas de hoje e atrasadas, considerando o dia em São Paulo. Inclui tentativas agendadas em empresas pessoais sem negociação, além das negociações e clientes. Datas futuras aparecem quando chegar o dia; não definir data não cria uma tarefa por suposição.

Uma tentativa escolhida pelo vendedor após Não atendeu não equivale a retorno combinado com a empresa. Ela não deve abrir negociação por ter uma data.

## Sem interesse

### Organização e acesso

As empresas arquivadas devem sair das listas de trabalho ativo e ficar numa área própria, proposta dentro de Prospecção. Essa área deve permitir encontrar e consultar empresas sem carregar centenas de cards de uma vez. Reutilizar o padrão visual das demais empresas, com situação Sem interesse e ações adequadas ao arquivo.

No Funil, criar um único card compacto Sem interesse, com aparência de recipiente de descarte, para receber uma negociação por arraste. Ele não é uma coluna do quadro e não empilha as empresas arquivadas. A movimentação tem o mesmo efeito da marcação pelo atendimento e não conta como oportunidade aberta.

Ao clicar no card Sem interesse, abrir a área própria com todas as empresas arquivadas, incluindo as que nunca tiveram negociação. Uma empresa marcada Sem interesse antes de qualquer interesse não ganha uma negociação apenas para aparecer nesse arquivo. O Funil continua reservado às negociações ativas, com o card servindo de destino de arquivamento e acesso à consulta.

### Interação do card de descarte

O usuário pediu uma animação semelhante a uma lixeira recebendo o item. A proposta de interação é:

- Em repouso, mostrar o card Sem interesse, seguindo o design system, com ícone de lixeira e um acesso claro à consulta das arquivadas. A posição exata e a eventual contagem ficam para o desenho da interface.
- Ao arrastar uma empresa sobre ele, destacar o alvo e animar a abertura do recipiente para indicar que pode receber o item.
- Após soltar e o arquivamento ser concluído com sucesso, realizar uma animação curta de entrada/recolhimento do card da empresa e retornar o recipiente ao estado de repouso.
- A animação representa arquivamento comercial. Não excluir empresa, contatos ou histórico do banco.
- Uma falha deve manter a empresa na situação original e informar que o arquivamento não foi concluído. A animação não pode comunicar sucesso de uma operação que falhou.
- Manter a ação equivalente Marcar como Sem interesse acessível por botão/menu, inclusive por teclado e em telas de toque. Respeitar a preferência por movimento reduzido, preservando a indicação de resultado sem animação intensa.

Essa definição corrige a interpretação anterior de criar uma coluna Sem interesse. O efeito comercial já confirmado permanece: encerrar a negociação e cancelar retornos, preservando histórico e vendedor.

### Encerramento e histórico

Arquivar deve encerrar a negociação aberta, cancelar retornos pendentes e preservar os contatos, combinados anteriores, autoria, vínculo com o vendedor e vendas existentes. Cancelar uma tarefa não apaga o fato de que ela foi combinada no passado.

Arrastar uma empresa ou classificá-la manualmente não significa que uma ligação aconteceu. Registrar a mudança comercial sem inventar contato realizado ou aumentar indevidamente os indicadores de atividade.

Uma venda existente não pode ser apagada por um encerramento posterior. O arquivamento não autoriza excluir clientes ou mudar o critério de entrada na Carteira.

### Retomada proposta

Oferecer Retomar atendimento na área Sem interesse. A recomendação é devolver a empresa ao atendimento sem restaurar tarefas canceladas nem reabrir negociação automaticamente. Novo interesse ou retorno combinado permite uma nova negociação. Não redistribuir a empresa por tempo decorrido.

## Distribuição sem repetição entre vendedores

Proposta do assistente para atender ao pedido de evitar repetições:

- A primeira entrega válida e confirmada estabelece um vínculo exclusivo com um vendedor, independentemente de iniciar atendimento.
- Google e Banco devem conferir os mesmos vínculos. Uma empresa já destinada não pode ser apresentada a outro vendedor como nova entrega disponível.
- Conferir novamente a exclusividade ao confirmar a entrega, protegendo também buscas simultâneas.
- Usar a identidade do cadastro e identificadores disponíveis, como CNPJ e identificação do estabelecimento no Google. Nome semelhante sozinho não identifica a mesma empresa. Preservar a proteção atual contra contatos repetidos, distinguindo contato compartilhado de identidade empresarial.
- Uma repetição pode permanecer no histórico da pesquisa com seu motivo, sem virar nova empresa de atendimento nem contar como entrega nova.
- Preservar responsáveis atuais e não transferir automaticamente empresas já atendidas.

O Google já tem exclusividade por vendedor. A Casa dos Dados já verifica CNPJ e contatos repetidos e revalida a inclusão. O trabalho futuro deve preservar essas proteções e uniformizar o contrato de distribuição entre fontes. Não foi realizada consulta a produção para afirmar que existem duplicidades reais.

## Card e visualização de empresa

### Informações comuns

Usar uma base de card com nome, situação comercial, atividade/nicho, localização, origem, CNPJ e CNAE quando conhecidos, e data de recebimento quando pertinente. Nomes longos precisam continuar legíveis. Não apresentar um código CNAE como se fosse descrição de atividade, nem inventar dados ausentes.

Informações adicionais, como responsável no gestor, devem aproveitar as permissões existentes. Dados iguais devem ter os mesmos nomes, ordem e tratamento de ausência nas diferentes telas.

### Ações propostas

| Contexto | Ação de consulta | Ação comercial principal |
| --- | --- | --- |
| Empresa pessoal a contatar | Ver empresa | Iniciar atendimento |
| Atendimento em andamento | Ver empresa | Continuar atendimento |
| Negociação aberta | Ver empresa | Abrir no Funil |
| Cliente com venda | Ver empresa | Abrir na Carteira |
| Empresa arquivada | Ver empresa | Retomar atendimento |
| Gestor | Ver empresa | Preservar as ações gerenciais já autorizadas. |

Iniciar atendimento é o rótulo recomendado para substituir Reservar para ligar e alinhar o texto à retirada da reserva. Últimas empresas deve oferecer as mesmas ações que a consulta pessoal para a mesma situação; não criar um segundo comportamento por usar outro card.

### Pop-up somente de informações

Exibir identificação, contatos, endereço e dados cadastrais disponíveis da empresa selecionada. Preservar a seleção exata, inclusive quando uma pesquisa retorna várias empresas.

Não incluir filtros ou metadados operacionais da busca, botões de prospectar lista, concluir inclusão ou reservar. O histórico Ver busca pode manter filtros e resultados porque é outra intenção.

Abrir e fechar o pop-up preserva filtros e posição/contexto da consulta. Não dispara nova aquisição, chamada ao fornecedor, reserva, contato ou alteração comercial. Registros técnicos de visualização continuam distintos de atendimento.

## Telas a alinhar

| Área | Adequação |
| --- | --- |
| Prospecção e Localizar | Usar a base pessoal; retirar catálogo e seleção antigos, além de links que reentram neles. |
| Google e Banco | Unificar distribuição, consulta e entrada de atendimento sem prazo, preservando os contratos das buscas. |
| Últimas empresas | Reutilizar dados, situação e ações do card pessoal, com seleção exata ao abrir informações. |
| Perfil e atendimento | Retirar contexto de listas, etapas antigas e mensagens/comandos de reserva temporária. |
| Funil | Preservar o gatilho de interesse/retorno e incluir o card de descarte Sem interesse com animação de lixeira e encerramento real, sem adicionar coluna. |
| Sem interesse | Criar consulta própria de arquivadas e retomada explícita. |
| Meu dia | Incluir tentativa agendada sem negociação e excluir retornos cancelados por arquivamento. |
| Carteira | Manter primeira venda como critério; corrigir mensagens que dizem para assumir/puxar para virar cliente. |
| Gestor / Empresas | Usar cards consistentes, sem ampliar acesso ou comandos comerciais. |
| Design system / galeria | Atualizar exemplos, estados, textos e ações junto com o produto. |

## Transição dos registros existentes

Proposta conservadora para planejar a mudança:

1. Inventariar vínculos, responsáveis, reservas antigas, descansos gravados, negociações, agendas e possíveis colisões antes de alterar dados.
2. Preservar os responsáveis existentes e a exclusividade do Google. Converter reservas recuperáveis para o novo vínculo sem criar outro relógio.
3. Retirar os bloqueios comprovadamente decorrentes do descanso automático de 30 dias, sem apagar datas de próximos passos ou outros motivos de indisponibilidade.
4. Não classificar todo descanso como Sem interesse. Distinguir o resultado real e alterações posteriores; converter apenas situações inequívocas. Dados ambíguos, responsáveis inativos e vínculos sem origem recuperável precisam ser apresentados ao gestor, sem redistribuição automática.
5. Preservar empresas, grupos internos de importação, buscas salvas, rascunhos, contatos, autoria, vendas e histórico de retornos.
6. Tratar endereços antigos sem reabrir catálogo ou cair na fila global. Preservar filtros pessoais válidos e trabalho em andamento.

Não se autoriza apagar registros para resolver colisões, atribuir empresas arbitrariamente ou confundir cadastro recebido com negociação/cliente. A estrutura técnica da transição fica para o plano, sob essas restrições.

## Restrições e limites

- A autoridade de acesso e dos efeitos comerciais continua no banco. Vendedor não recebe acesso ao catálogo inteiro ou a empresas alheias ao remover o prazo.
- Vínculo pessoal, atendimento iniciado, negociação, arquivamento e cliente são conceitos distintos. Não preencher indiscriminadamente o responsável atual para simular o novo modelo.
- Cliques repetidos e operações concorrentes não podem duplicar entregas, contatos, encerramentos, negociações ou vendas.
- Manter as fronteiras do projeto: funcionalidades não importam diretamente de outras funcionalidades; contratos compartilhados ficam na camada comum apropriada.
- Uniformidade visual não amplia permissões do gestor ou do vendedor.
- Esta revisão não troca fornecedores, muda preços/limites de coleta, instala automações, migra o coletor para servidor ou cria preenchimento por IA.
- Implementação, integração e publicação são etapas posteriores à revisão das regras e ao plano. Não fazem parte deste levantamento.

## Critérios para validar a implementação futura

| Cenário | Resultado esperado |
| --- | --- |
| Abrir uma empresa de uma pesquisa com várias empresas | Apenas os dados da empresa escolhida; nenhuma operação comercial ou de busca é executada. |
| Retomar atendimento após mais de 30 minutos | Mesma empresa e acesso autorizado, sem expiração, devolução ou perda de rascunho por tempo. |
| Registrar Não atendeu sem data | Histórico preservado; sem devolução, descanso, tarefa inventada ou negociação nova. |
| Registrar Não atendeu com tentativa agendada | Aparece em Meu dia quando devida, permanecendo fora do Funil até interesse/retorno combinado. |
| Registrar interesse ou retorno combinado | Negociação aberta para o vendedor, sem duplicação; retorno combinado preserva texto e data. |
| Marcar Sem interesse antes de haver negociação | Vai para a área própria, sem negociação artificial ou retornos pendentes. |
| Arrastar negociação para o card Sem interesse | Alvo destacado e animação de lixeira ao concluir; negociação encerrada, fora da contagem de abertas e da agenda, com histórico e vínculo preservados. Nenhuma coluna nova de arquivadas é criada. |
| Clicar no card Sem interesse | Abre a consulta das arquivadas, sem mudar a situação de uma empresa. |
| Falhar ao soltar ou usar movimento reduzido | Em falha, manter a empresa no estado original e informar o resultado; com movimento reduzido, manter a operação compreensível. Existe ação equivalente sem arraste. |
| Retomar uma arquivada | Volta ao atendimento; não restaura agenda cancelada ou negociação por efeito da retomada, conforme proposta. |
| Mesma empresa encontrada por dois vendedores/fontes | Só uma entrega válida; nenhum segundo atendimento disponível, inclusive com operações simultâneas. |
| Primeira venda | Entrada na Carteira, preservação do histórico e do próximo passo válido. |
| Consultar por vendedor e gestor | Mesmo padrão de informação, com autorização respeitada em cada tela e operação. |
| Abrir um endereço antigo de lista | Entrada atual segura, sem aquisição global ou perda silenciosa de contexto/dados. |

## Base e revisão

Levantamento estático sobre a árvore `8c5546546822638274840bd3d597fa1d863ccf29`, correspondente ao commit `fafd7fc11ee294e0aabc6b0e489b80971ac90d2d` usado como base local. Não foi feita leitura de dados de produção.

Uma revisão independente leu o levantamento. Após as respostas sobre exclusividade pretendida, próxima ação e Sem interesse, concluiu que o conjunto permite formular o plano, sem novas perguntas indispensáveis. As recomendações de distribuição, retomada e transição acima continuam sendo propostas do assistente para revisão do usuário.

Correção posterior do usuário: Sem interesse deve ser um card que recebe o arraste com animação de lixeira, e não uma coluna. Essa forma de interação foi incorporada sem mudar as regras de encerramento, cancelamento de retornos ou preservação de dados.

Referências principais para o planejamento:

- Navegação e cards pessoais: `app/fila/page.tsx`, `app/fila/localizar/page.tsx`, `app/fila/localizar/navegacao.ts`, `app/fila/localizar/pessoal.tsx`, `src/features/fila/repositorio.ts`.
- Pop-up e últimas empresas: `app/fila/buscar/empresas-recentes.tsx`, `app/empresas/busca/detalhe-acao.tsx`, `app/empresas/busca/conteudo.tsx`, `app/fila/buscar/resultados.tsx`.
- Atendimento e agenda: `app/fila/cartao.tsx`, `src/features/contato/tipos.ts`, `src/features/contato/formulario.tsx`, `src/features/fila/consulta.ts`, `app/meu-dia/agenda.ts`.
- Funil, Carteira e gestor: `app/funil/quadro.tsx`, `app/carteira/page.tsx`, `app/carteira/lista.tsx`, `app/empresas/lista.tsx`, `src/features/empresas/perfil.ts`, `app/design/galeria.tsx`.
- Permissões e efeitos comerciais atuais: `db/migracoes/0016_empresa_fila.sql`, `0017_contato.sql`, `0018_contato_registrar.sql`, `0028_comercial.sql`, `0029_funil_comandos.sql`, `0031_vendas_carteira_agenda.sql`.
- Distribuição e buscas: `db/migracoes/0040_google_planejamento.sql`, `0042_google_criterios_rodadas.sql`, `0046_casa_dados.sql`, `0048_prospeccao_grupo_origem.sql`, `0049_banco_inclusao_automatica.sql`.

O inventário detalhado e as seis capturas do usuário estão na pasta local `.superpowers/sdd/2026-10-29-revisao-fluxo-comercial/` como evidência da preparação.
