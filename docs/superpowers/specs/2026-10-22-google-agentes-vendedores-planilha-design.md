# Agente de scraping por vendedor, planilha compartilhada e dias seguintes

Status: aprovado pelo usuário para implementação inline, prévia e revisão independente.

## O que o usuário confirmou

O agente pedido é por **vendedor**, para fazer web scraping com o nicho e a
região que esse vendedor configurar. Não é um agente por gestor. Os gestores
compartilham a equipe e a mesma planilha. Não criar separação de equipes ou
planilhas por gestor.

Ao ajustar o planejamento no CRM, os critérios precisam aparecer na planilha.
O dia anterior avança para a próxima semana, e assim sucessivamente. Continua
valendo a escolha anterior de preencher novos critérios a cada semana.
Preservar leads exclusivos do primeiro destinatário, histórico central e
visibilidade dos gestores. Não alterar o CNPJ.biz.

Esta proposta complementa o desenho de planejamento aprovado em 22/10/2026.
O comportamento entregue até `ce694d9` salva no CRM, mostra uma semana fixa e
usa um executor global autenticado como gestor. A sincronização de critérios
e a configuração individual dos agentes ainda não existem nessa versão.

## Como cada vendedor usa o agente

Cada vendedor tem um agente próprio identificado no CRM, com configuração,
estado, pedidos e histórico associados à sua identidade. O gestor acompanha
e pode pausar ou liberar cada agente. Alterar o planejamento não executa uma
busca instantânea. O navegador não recebe credenciais do executor ou do Google.

Minha escolha técnica: agentes individuais reutilizam o código, o motor local
8087 e a rotina diária existentes. Um coordenador encaminha os pedidos aos
agentes dos respectivos vendedores, com uma coleta e validação por vez nos
recursos compartilhados. Não é necessário duplicar máquinas, containers,
planilhas ou agendamentos para representar cada agente.

A autorização do executor continua independente do acesso do vendedor. O
destinatário vem do vínculo do agente e do pedido no banco, nunca de um nome
ou vendedor arbitrário recebido do navegador. O executor autorizado pode
trabalhar nos agentes da equipe compartilhada; nenhum vendedor lê ou controla
o agente de outro. Gestores ativos mantêm a visão global atual.

Gestor vê agente, vendedor, disponibilidade, última execução e motivo de
falha. Vendedor vê seu agente e a situação real do próximo pedido. Configuração
ausente não aparece como agente pronto. Desativação ou mudança de papel
interrompe novas buscas e entregas elegíveis, conservando o histórico.

## Dias que avançam

Minha interpretação proposta: a tela inicial apresenta os **próximos cinco
dias úteis**, incluindo hoje quando for dia útil, em ordem de data. À
meia-noite de São Paulo, ontem sai desse recorte e entra a próxima ocorrência
daquele dia da semana. No fim de semana, começa na próxima segunda-feira.

Exemplo: na quinta 22/10/2026, aparecem quinta 22, sexta 23, segunda 26,
terça 27 e quarta 28. Na sexta 23, aparecem sexta 23, segunda 26, terça 27,
quarta 28 e quinta 29. Datas e indicação de hoje/próxima semana evitam confusão.

Isso muda a apresentação; não altera datas nem move registros antigos. O
pedido da quinta 22 e suas empresas continuam no histórico. A quinta 29
começa vazia, salvo se já tiver sido planejada explicitamente. Não copiar
critérios, gerar pedidos vazios no banco ou disparar pesquisa por causa da
virada do dia. O dia de hoje continua visível e fechado para edição após o
início da rotina; só avança quando se torna um dia passado.

Leads recebidos e gestão preservam a consulta por semanas e filtros existentes.
A navegação de semanas anteriores continua mostrando os registros reais,
sem renovar ou reexecutar pedidos antigos.

## Planejamento na planilha compartilhada

O CRM continua sendo a origem dos critérios e da identidade do pedido. A
planilha é um espelho operacional e o transporte de validação já existente.
Alterações manuais em células não viram comandos nem alteram silenciosamente
o pedido autenticado e congelado do CRM.

Minha proposta: usar uma aba **Planejamento CRM** no mesmo arquivo Google
Sheets, com pedido, revisão, vendedor, data, dia da semana, nicho, bairro,
cidade, UF, situação e atualização. Isso permite vários vendedores no mesmo
dia sem sobrescrever a única linha de segunda-feira. A aba antiga de
planejamento permanece preservada, assim como arquivos, abas de validação,
origem, resultados e Backup telefones. Não criar outro arquivo ou mudar o
compartilhamento automaticamente. A criação da nova aba faz parte da futura
ativação, após conferir o arquivo e reconciliar o lote antigo.

Salvar um planejamento grava seus critérios e uma sincronização durável na
mesma transação. Uma revisão identifica cada edição do mesmo pedido. Com a
conexão do servidor configurada, a gravação tenta sincronizar a linha daquele
pedido e confirma por leitura. A interface distingue **Salvo no CRM**,
**Sincronizado com a planilha** e **Sincronização pendente**.

Falha do Google não perde o planejamento nem a pendência. A retomada usa o
mesmo pedido/revisão, encontra a linha por identidade e não acrescenta uma
duplicata após resposta incerta. Uma edição antiga não pode prevalecer sobre
outra mais recente. A sincronização de critérios fica separada da gravação de
CSV na origem da validação. Dados divergentes em uma linha que deveria ser
do pedido ficam para reconciliação, sem sobrescrever dados alheios.

O executor reconcilia a revisão pendente antes de iniciar sua coleta. Sem
confirmação da revisão correta, mantém o pedido parado com motivo visível.
Não troca silenciosamente para a campanha antiga, outra fonte ou critérios
de outro vendedor. Continua às 9h de São Paulo, de segunda a sexta, até 50
leads entregues por pedido, sem garantir que haverá 50 resultados novos.

Minha proposta para pausa: o controle se chama **Pausar novas buscas** e
impede iniciar outros pedidos do agente. Uma coleta/validação já iniciada
pode terminar e entregar o lote, desde que o vendedor continue elegível.
Desativar o vendedor mantém a regra mais restrita já existente: não liberar
novos leads para ele. Pausar não interrompe um arquivo em gravação nem
abandona uma validação que ocupa a planilha compartilhada.

Minha proposta para pedidos vencidos: ao liberar o agente, pedidos de dias
anteriores que nunca começaram ficam no histórico como não executados, com
o motivo. Não gerar um acúmulo automático de buscas atrasadas. Execução que
já começou é diferente: deve ser reconciliada e concluída usando o mesmo
job, arquivos e recibos antes de liberar os recursos compartilhados.

A integração permanente precisa de conexão Google autorizada no servidor;
a conexão interativa deste chat não se torna uma credencial da aplicação.
Minha escolha é uma credencial de serviço dedicada, fora do navegador e do
Git, com acesso concedido explicitamente ao arquivo necessário. Não mudar
permissões nem gerar credenciais reais como parte da implementação local.

## Concorrência, retomada e preservação

Agente individual não permite executar duas vezes o mesmo pedido. O banco
registra agente, execução e pedido; somente uma execução pode ocupar o motor
e o transporte compartilhados. Outro processo recebe ocupado, sem criar job
ou substituir uma validação em andamento. A exclusão precisa valer entre
processos e durante toda a etapa externa, não apenas na chamada HTTP inicial.

Expiração de uma execução ou queda do processo não autoriza uma nova coleta.
O próximo executor reconcilia o job, intenção, arquivos, lote e recibos do
mesmo pedido antes de retomá-lo. Se não puder provar o estado, conserva o
bloqueio e sinaliza intervenção. Os scripts e recibos já existentes continuam
valendo; não há chamadas paralelas a Evolution nem envio de mensagens.

Não sobrescrever cadastro manual, posse, reserva, carteira, históricos,
ocorrências incompletas ou identificadores conflitantes. Mantém a auditoria
de todos os encontros e a primeira entrega exclusiva, inclusive por outras
fontes. Dados cadastrais e quota/UUID do CNPJ.biz permanecem preservados.

## Validação e entrega

Testar primeiro: dois agentes de vendedores diferentes; tentativa de acessar
outro agente; gestão compartilhada; dois pedidos do mesmo dia; fila do motor
e da planilha; resposta incerta, retomada e publicação repetida; edições em
ordem invertida; falha de sincronização; desativação durante execução; virada
de dia, sexta, fim de semana e ano, com o relógio de São Paulo.

A prévia usa agentes e Google Sheets simulados, exibindo sincronização e
resultados fictícios. Testar celular, teclado e temas no visual aprovado.
Revisão independente ao final, conforme o pedido anterior do usuário.

Implementação local não ativa scraping real, automações, alterações no arquivo
Google, concessões de acesso, credenciais reais ou migrações remotas. Esses
passos dependem da configuração e ativação operacional posterior. O método
exato de OAuth, nomes de objetos, migração, processamento da pendência e
componentes são decisões do implementador dentro destas garantias.

## Conferência do desenho antes do plano

Um revisor independente fez a leitura de construção e levantou duas
ambiguidades: pedidos vencidos durante pausa e pausa durante uma execução.
As duas propostas acima esclarecem o comportamento para avaliação do usuário;
não são apresentadas como decisões que ele já confirmou. Não foi escrito
código de produto nem alterada a planilha real nesta revisão do desenho.
