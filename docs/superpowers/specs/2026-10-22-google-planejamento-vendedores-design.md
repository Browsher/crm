# Planejamento semanal do Google e entregas por vendedor

Status: aprovado pelo usuário em 22/10/2026 para implementação inline, prévia e revisão independente.

## Pedido e decisões confirmadas

Em 22/10/2026, o usuário pediu reorganizar grupos/listas, esclarecer a parte
do Google e substituir ações em textos/linhas clicáveis por botões claros.
Esclareceu que não quer uma pesquisa imediata disparada pelo vendedor: ele
define critérios para o agente diário existente buscar e entregar empresas.
Cada vendedor terá seus próprios leads sem depender da exportação manual do
gestor. O gestor verá todas as empresas, o histórico e quem solicitou a coleta.

O vendedor define como o agente rodará de segunda a sexta e precisa alterar
o planejamento toda semana. Não há repetição automática da semana anterior.
A planilha enviada é referência de campos: dia, nicho, bairro, cidade/UF e
situação. A nova configuração será feita no CRM.

O usuário confirmou que a empresa será exclusiva do primeiro vendedor que
a receber. Outra coleta pode encontrá-la, mas não cria uma segunda entrega
disponível para outro vendedor. O gestor conserva as duas ocorrências.

Escolhas operacionais desta proposta para aprovação: corte dos pedidos no
início da rotina das 9h, dias não planejados sem coleta, até 50 empresas por
pedido e execução serializada no motor existente. Esses detalhes concretizam
o fluxo; não significam que a nova integração já esteja implementada.

## Experiência do vendedor

Na área Google, separar duas tarefas: **Planejamento semanal** e **Leads
recebidos**. O título explica que a coleta é feita pelo agente diariamente.
Não apresentar um botão de pesquisa instantânea nem chamar uma lista já
importada de nova busca.

O planejamento identifica a semana por datas no fuso de São Paulo e apresenta
segunda, terça, quarta, quinta e sexta. Cada dia tem nicho, bairro, cidade/UF,
situação e botão **Editar dia**. O nicho é um texto informado pelo vendedor;
não fica limitado à campanha antiga de armarinhos. Cidade/UF são obrigatórias;
bairro pode ficar vazio para pedir a cidade inteira. Os termos da pesquisa
usam esses valores como dados, nunca como comandos.

**Minha proposta de operação:** salvar os critérios válidos de cada dia, com
um botão explícito, e mostrar quantos dos cinco dias estão planejados. Dia sem
planejamento não gera coleta e fica sinalizado ao vendedor e ao gestor.
Não exigir um pedido fictício para um dia sem prospecção. Semana seguinte
começa vazia, sem copiar nem executar critérios antigos silenciosamente.

Manter a rotina existente de segunda a sexta, às 9h de São Paulo. Quando a
rotina do dia começar, capturar os pedidos válidos daquele dia e uma versão
imutável de vendedor, dia, nicho e região. Até esse início, o vendedor pode
editar os critérios; os próximos dias continuam editáveis. Não abrir outra
execução automática para uma edição tardia. Alterar o planejamento não
repete uma coleta já executada nem muda a autoria dos resultados.
Permitir consultar semanas anteriores e seus resultados, sem reexecutá-las.
Se a rotina não rodar ou falhar, mostrar o estado real, sem marcar o dia como
concluído. Dia sem pedido válido não utiliza os critérios de outro dia.

Leads recebidos mostra entregas por dia, nicho/região, quantidade e situação,
com botões **Ver empresas**, **Prospectar** e **Ver histórico da coleta**.
As entregas pessoais do Google só são acessíveis ao vendedor destinatário e
ao gestor, com autorização efetiva no banco e nas operações de atendimento.
Receber um lead garante sua exclusividade de distribuição, mas não o
transforma em carteira, cliente, atendimento ou venda. O atendimento segue
os estados comerciais existentes.

## Visão do gestor e significado de utilização

O gestor acompanha os planejamentos, pedidos e entregas de todos os
vendedores, filtrando por semana, vendedor e situação. Pode abrir cada
entrega e a ficha/histórico da empresa. A autoria vem do usuário autenticado
e das execuções registradas, não de um nome recebido do navegador.

Registrar separadamente:

- quem solicitou, os critérios e a data planejada;
- execução do agente, data da coleta, fonte, lote e vendedor destinatário;
- empresas encontradas, entregues, repetidas, indisponíveis e pendentes;
- quem assumiu ou reservou a empresa e os atendimentos registrados;
- retorno combinado, negociação e venda quando existirem.

O painel mostra entregues, com atendimento registrado após a entrega e ainda
sem atendimento, por vendedor e lote. Abrir a tela não conta como trabalhar
o lead. Atendimento de outra pessoa ou anterior à entrega não vira
utilização do solicitante. A definição usa fatos existentes no histórico,
sem inventar que houve contato ou venda.

## Dados, privacidade e duplicidade

Todos os dados permanecem no banco da empresa. Não haverá um banco separado
por vendedor. A empresa tem identidade central por CNPJ e/ou Place ID, e
cada ocorrência de coleta preserva quem pediu, recebeu e o lote de origem.

Encontrar novamente uma empresa não sobrescreve dados manuais, responsável,
reserva, carteira ou histórico. A primeira entrega confirmada grava no banco
um vínculo exclusivo de distribuição com seu vendedor. Esse vínculo é
separado da carteira comercial e da reserva temporária de atendimento, e
impede a distribuição ou apropriação da mesma empresa por outro vendedor.
Encontrar a empresa no motor de pesquisa, isoladamente, não é uma entrega.

Processar os pedidos do dia em ordem estável de criação, com o identificador
como desempate. Confirmar a exclusividade de forma atômica no banco, inclusive
em retornos concorrentes ou repetidos. Se houver vínculo exclusivo, posse ou
reserva de outra pessoa, registrar a ocorrência para o gestor e indicar que
a empresa não ficou disponível na nova entrega, sem expor contato protegido
ao solicitante. A mesma empresa pode ter várias ocorrências de pesquisa,
preservadas separadamente do cadastro e da responsabilidade atual.

A virada da semana ou a remoção de um planejamento não libera os leads já
entregues. A desativação de um vendedor impede novas execuções e entregas para
ele, preservando o histórico e sem transferir automaticamente suas empresas.

Resultados sem telefone válido continuam rastreáveis e visíveis como
pendência, mas não entram automaticamente na fila de atendimento. O painel
do gestor conserva também o que foi encontrado e não pôde ser liberado.

**Escopo desta etapa:** privacidade por destinatário nas novas entregas
Google. Listas públicas antigas, CNPJ.biz e importações existentes conservam
seus fluxos e ficam identificadas separadamente. A exclusividade de uma
empresa já entregue deve ser respeitada em todos os caminhos de distribuição
e atendimento, inclusive quando ela reaparecer em outra fonte. Isso não
torna toda a base privada nem altera a quota/UUID da busca CNPJ.biz.

## Integração com o agente existente

A investigação e o texto do agente enviado pelo usuário confirmam a sequência
coleta, arquivamento no Drive, publicação em planilha, validação pelo workflow
existente e arquivo final. A rotina prevista é de segunda a sexta às 9h de
São Paulo, com uma região por execução e até 50 empresas. O motor configurado
é o serviço local na porta 8087. Seu estado atual é de uma campanha, com termos
configurados, histórico comum e uma planilha global. Há bloqueio de coleta
simultânea. A automação localizada está pausada; nenhuma rotina foi ativada
durante esta investigação.

O coletor atual aceita a campanha de armarinhos e variedades; aceitar novos
nichos requer adaptar os termos e a classificação, em vez de apenas mudar um
rótulo no CRM. Preservar endereços reais e identificadores como texto, os
arquivos original e final, recibos, hashes e manifestos, a consulta de emails
publicados e o enriquecimento social desativado. A região é critério da busca;
não inventar endereço nem descartar automaticamente um resultado por cair
fora do bairro pesquisado. Não enviar mensagens aos leads.

O CRM guarda os pedidos e a identidade de cada execução. Adaptar a entrada
do agente para ler os pedidos autorizados e pendentes do dia, incluindo
vendedor, data, nicho e região, e devolver resultados com a mesma identidade.
Preservar o motor, o cliente autorizado do workflow e a etapa de validação
existentes. A publicação automática no CRM, acrescentada a esse fluxo, ocorre
somente depois do retorno validado e conferido. Ela elimina a necessidade de
exportação/importação manual pelo gestor; o agente antigo ainda não faz essa
entrega por vendedor.

Não depender de uma única aba global como fila de vários vendedores. Manter
uma coleta por vez no motor e estado de execução/retomada por pedido; a
proteção antiga de uma coleta global por dia não pode bloquear os outros
vendedores. A identidade e o isolamento devem valer também na validação e
na publicação, para um lote não substituir o resultado de outra pessoa.
Se a validação continuar usando as abas atuais, elas são um transporte
serializado: nunca substituir uma publicação ainda pendente de validação.
Propagar a identidade do pedido junto ao lote e aos recibos; o servidor do
CRM verifica seu vínculo com o destinatário, sem confiar em um vendedor
arbitrário enviado pelo coletor.

Para os novos pedidos, o planejamento do CRM passa a ser a fonte dos critérios.
Preservar o histórico da planilha antiga e reconciliar seus lotes pendentes
antes da transição, sem manter duas fontes concorrentes para o mesmo pedido.
Conservar os resultados brutos e suas pendências na auditoria do gestor;
somente empresas elegíveis e com telefone válido entram na entrega utilizável.

Repetir um retorno do mesmo lote deve reutilizar a entrega já persistida.
Falha, timeout ou dúvida de publicação não autorizam repetir a coleta;
reconciliar o mesmo pedido e conservar os dados/pendências. Novos nichos não
herdam o filtro comercial fixo de armarinhos. Manter até 50 empresas por
pedido nesta primeira proposta, como limite existente, sem prometer 50 novas.

Não criar outro agendamento diário concorrente. Definir o contrato do
adaptador com autenticação restrita ao agente, vínculo de pedido/vendedor
decidido pelo servidor e sem credenciais expostas na interface. A ativação
real será feita após validação com fornecedor simulado, preservando dados,
arquivos, configuração privada e pendências atuais do agente.

## Reorganização visual e botões

Usar **Listas** como termo visível, com origem e destinatário explícitos.
Separar entregas pessoais de listas compartilhadas na navegação. No gestor,
apresentar a fonte verdadeira em vez de tratar tudo como planilha ou migração.
Todas as ações de abrir, consultar, prospectar, gerenciar e paginar terão
aparência de botão; títulos e linhas não serão alvos ocultos de clique.
Manter semântica de navegação nos destinos e botões de ação nos formulários.

Reutilizar o redesign aprovado: CabecalhoPagina, Card, Button, tabela
responsiva, temas e abas existentes. Paleta: branco #ffffff, fundo #f5f6f8,
texto #202a35, secundário #65707d e verde #17634d, com os tokens escuros
existentes. Tipografia atual, alinhamento à esquerda, grade semanal clara,
sem decoração ou animações novas. Em celular, cada dia vira um registro com
campos e botão, sem exigir rolagem horizontal.

## Validação e limites da etapa

Antes do produto, validar este desenho e escrever o plano de implementação.
Testar isolamento entre vendedores inclusive por URL/operação direta,
gestor com visão completa, virada da semana sem reaproveitamento automático,
mudança de critérios depois de iniciado, mesma empresa em dois pedidos,
retorno duplicado, falha/retomada, lote fora de ordem e dados sem telefone.
Conferir uso contado somente por atendimento real do destinatário após a
entrega. Exercitar temas, 390 px e ações identificáveis como botões.

Revisão independente ao final, conforme preferência já solicitada. Não
realizar coleta real, alterar planilha/arquivos operacionais, ativar automação
ou aplicar migrações remotas durante a preparação do desenho.
