# Perfil do vendedor para o gestor

Escopo aprovado: abrir pelo card no dashboard um perfil somente de consulta,
com resumo da carteira/retornos, empresas sob responsabilidade, contatos
registrados hoje e últimos atendimentos. Sem ações administrativas ou de venda.

Rota `/gestao/vendedores/[id]`, guardada como gestor na página e SQL. Apenas
vendedor ativo, acompanhando o recorte do dashboard; alvo inválido, inexistente,
gestor ou desativado retorna 404. Usuários permanece o acesso aos desativados.

Quatro indicadores idênticos ao dashboard: clientes em carteira (não reservas),
retornos atrasados, retornos hoje e contatos registrados hoje, excluindo
`nao_liguei`. Retorno vem do último contato por criado_em/id. Datas civis e
limites do dia no SQL em America/Sao_Paulo. Contato contado por autor, não dono
atual da empresa. Não representa ligação comprovada.

Carteira paginada em 50 empresas por página, ordenada por razão social/id,
exibindo nome, CNPJ, próximo passo e retorno. Total considera toda a carteira.
Histórico mostra os 20 registros mais recentes desse autor, incluindo empresas
que já saíram da carteira, com tipo, empresa, horário, nota e próximo passo.
Não criar link para ficha de empresa aqui: o usuário restringiu essa entrada
a `/empresas`. Não inferir venda ou devolução pelo tipo de contato.

Visual usa componentes e temas atuais: cabeçalho com nome/e-mail, indicadores,
carteira e atividade; uma coluna no celular. Voltar ao dashboard é URL fixa.
Card é link nativo acessível por teclado e abrível em nova aba. Estados vazios
distintos de falha. Nenhuma reserva, visita ou escrita ao abrir o perfil.

Sem migração ou biblioteca nova. Testes somente em banco temporário Docker.
PR contra main com CI verde; merge após validação visual.
