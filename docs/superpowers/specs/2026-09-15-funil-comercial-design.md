# Funil comercial e Carteira de clientes

Estado: decisões de produto aprovadas; primeira fatia de base implementada e validada localmente. UI e comandos comerciais ainda pendentes.
Esta especificação substitui, neste escopo, a decisão de 12/09 em
PREFERENCIAS.md de adiar a separação comercial. Não autoriza apagar dados.

## Fluxo aprovado

- Assumir uma empresa inicia uma negociação em Primeiro contato.
- Etapas abertas: Primeiro contato, Em negociação e Proposta enviada.
- É permitido registrar venda em qualquer etapa, sem percorrer todas.
- Venda registra data, valor e observação opcional. A primeira venda encerra
  a negociação e transforma a empresa em cliente na Carteira do vendedor.
- Não há coluna Venda concluída. A venda permanece no histórico.
- Novas compras são registradas na Carteira, sem devolver o cliente ao funil.
- Cliente não perde o responsável por inatividade e não pode ser devolvido
  à prospecção pela ação comum de devolução.
- Gestor pode transferir clientes de vendedor desativado para outro vendedor,
  preservando vendas e histórico. Não redistribuir automaticamente.
- Prospecto com 30 dias sem atendimento registrado volta a ficar disponível
  para prospecção; registrar a devolução no histórico e encerrar a negociação.
- Abrir perfil, visualizar telefone ou mudar etapa não renova esse prazo.
- O grupo de importação permanece. Se a origem estiver desativada, a devolução
  não deve reativar o grupo nem tornar a empresa elegível contra essa regra.
- Dados atuais foram declarados de teste. Não inventar compras para migrá-los,
  nem apagar empresas, contatos ou grupos sem uma operação específica.

## Telas com funções distintas

- Prospecção: localizar e reservar empresas disponíveis; assumir inicia funil.
- Funil: negociações abertas do próprio vendedor, organizadas por etapa.
- Carteira: empresas com primeira venda registrada e suas novas compras.
- Meu dia: retornos atrasados e de hoje de prospectos e clientes. A primeira
  venda não deve apagar um retorno agendado que ainda precisa ser atendido.
- Gestor administra e consulta a equipe; não realiza atendimento comercial.

## Visual aprovado

Quadro Essencial com três colunas, contadores e cards com nome e cidade.
Sem busca por empresa, sem menu de três pontinhos e sem coluna de concluídas.
Clicar no card abre modal centralizado; o quadro não encolhe nem perde rolagem.
No celular o modal ocupa a tela. Conteúdo longo rola dentro dele.

Modal: nome/cidade, etapa com seleção e confirmação, dados da empresa,
próximo passo/retorno, histórico e ações Registrar atendimento, Registrar venda
e Devolver à prospecção. Registrar venda pede confirmação e os campos da venda.
Devolver pede motivo e confirmação. Não implementar arrastar cards nesta versão.
Telefone continua no fluxo de atendimento, sem ampliar sua exposição no resumo.
Fechar devolve foco ao card. Rascunho não deve ser descartado silenciosamente.

Referência visual: imagem aprovada exec-965be9ca-6abd-49ae-8180-3c17ec439acc.png
na pasta de imagens geradas da sessão. Texto da especificação prevalece sobre
artefatos da imagem: remover busca e menus que a geração tenha desenhado.

## Privacidade no Funil

Vendedor vê somente negociações sob sua responsabilidade e seus próprios
atendimentos/anotações. Ao assumir empresa já atendida por colega, não recebe
notas desse colega. Próximo passo e resumo não podem vazar a última nota global.
Filtrar no servidor antes de serializar; esconder no navegador não é suficiente.
Eventos automáticos relacionados à sua negociação podem informar sua devolução,
sem revelar conteúdo de outro vendedor. Gestor preserva consulta administrativa
completa. Esta decisão não determina mudanças globais na leitura de outras telas.

## Estado atual conferido em 15/09/2026

- src/features/fila/consulta.ts: lerMinhasEmpresas trata toda posse como carteira
  e usa o último contato global da empresa para resumo/retorno.
- src/features/contato/historico.ts: lerHistorico consulta todos os contatos
  legíveis da empresa, sem filtro de autor. Não reutilizar cru no Funil.
- src/features/contato/repositorio.ts: registrarContato chama contato_registrar
  com desfechos nenhum, assumir ou devolver.
- db/migracoes/0027_grupos_importacao.sql: fila_reservar admite dono inativo;
  isso precisará excluir clientes mesmo quando o dono estiver desativado.
- Última migração encontrada: 0027. Conferir novamente antes de numerar a nova.

## Arquitetura proposta

Separar negociação, venda e posse. Manter empresa_fila como fonte única do
responsável, sem copiar um dono atual para múltiplos lugares. Venda guarda autor
e data histórica; transferência futura não reescreve autor de vendas/contatos.
Negociação guarda responsável daquele ciclo e estado aberto/encerrado; permitir
novo ciclo após devolução, mas apenas um aberto por empresa.

Venda e mudança de estado devem ser atômicas, autorizadas no banco, com proteção
contra duplo envio. Concorrência entre venda, devolução e expiração usa o mesmo
bloqueio da linha de posse. Ao repetir uma requisição de venda, não duplicá-la.
Persistir valor em centavos inteiros ou numeric exato, nunca float monetário.

## Fatias e ordem

1. Base comercial e proteções: modelar negociação/venda/eventos, integrar assumir
   e devolver, proteger cliente na fila, consultas de leitura e testes de banco.
2. Funil e registro de venda: quadro/modal, privacidade, ações e integração da
   classificação em Carteira/Meu dia no mesmo lançamento funcional.
3. Ajustes de Carteira e Meu dia: novas compras, textos, contagens administrativas,
   fluxos de ida/volta e validação completa, sem período com clientes invisíveis.
4. Expiração e transferência: execução recorrente observável, devolução aos 30
   dias e transferência explícita de clientes de vendedor desativado.

Não expor venda na UI antes de Carteira e Meu dia reconhecerem a classificação.
Cada PR contra main, sem empilhar branches dependentes. Sem migration Railway
até revisão da migração concreta e autorização para sua aplicação.

## Detalhes a resolver nas respectivas fatias

- Expiração: definição exata de 30 dias (instante ou data civil), frequência e
  executor que funcione quando o computador estiver desligado. Caso sem contato
  deve partir da assunção; nao_liguei não comprova atendimento para renovação.
- Venda: limites do valor/data, moeda e correção de lançamento errado devem
  ser definidos antes de publicar o formulário. Não incluir estorno silencioso.
- Transferência: seleção do destino ativo e preservação de retornos. Histórico
  anterior segue preservado para o gestor, sem liberar notas de colega no Funil.

## Verificação e limites

TDD, testes temporários Docker, RLS e funções definidoras como autoridade.
features não importa outra features; comum sobe para lib ou server.
Usar componentes atuais, Next local documentado, nenhum pacote novo previsto.
Testar isolamento, sessão/posse perdida, repetição e concorrência, limites de
data, primeira/repetida venda, grupo inativo, vendedor desativado, teclado,
rascunho, rolagem e responsividade. Uma revisão independente final por fatia.
Aplicação continua intacta durante este trabalho de documentação.
