# Dashboard do gestor

Estado: implementado na branch `codex/dashboard-gestor`; validação visual e integração pendentes.

## Objetivo e apresentação

Transformar `/gestao` no resumo da equipe, preservando o acesso exclusivo do
gestor e os atalhos administrativos existentes. Layout aprovado: cards por
vendedor, sem campo de busca de vendedores. Duas colunas no desktop e uma no
celular, usando os componentes e os temas claro/escuro atuais.

O dashboard mostra somente usuários com papel vendedor e ativos. Usuários
continua sendo o lugar para consultar ativos e desativados. Desativar alguém
não apaga dados nem transfere suas empresas. Os indicadores da equipe e a
atividade recente usam o mesmo recorte dos vendedores ativos.

## Indicadores

- Retornos atrasados: empresas em carteira cujo último contato tem retorno
  anterior à data atual.
- Retornos hoje: empresas em carteira cujo último contato tem retorno na
  data atual. Não representa contatos já realizados.
- Clientes em carteira: empresas atribuídas aos vendedores ativos, sem contar
  reservas temporárias.
- Empresas disponíveis: estoque elegível para prospecção, considerando grupo
  ativo, posse, reserva e descanso conforme as regras existentes. É um total
  do estoque, não uma soma dos cards dos vendedores.

Cada card mostra nome, clientes em carteira, retornos atrasados, retornos hoje
e contatos registrados hoje. Contatos registrados hoje conta registros de
contato do vendedor, excluindo `nao_liguei`; mais de um registro para a mesma
empresa conta mais de uma vez. Não é comprovação de ligação realizada.

Datas usam America/Sao_Paulo. O retorno da empresa vem do contato mais recente,
com desempate por id, seguindo o padrão existente. Não somar retornos antigos
de uma empresa que já ganhou um contato posterior.

## Atividade e estados

Atividade recente usa somente informações efetivamente registradas: autor,
empresa, tipo de contato e horário. Não inferir devolução, venda ou outro
desfecho que o registro não guarda. Ordenar do mais recente para o mais antigo,
com desempate estável, e limitar a lista inicial a dez registros.

Cards ordenados por nome e id, sem ranking de produtividade. Mostrar estado
vazio quando não houver vendedores ativos e outro quando não houver atividade.
Não apresentar erro de consulta como contagens zeradas. Oferecer atualização
da página e estados acessíveis de carregamento/erro.

## Segurança e limites

Leitura pelo contexto autenticado do gestor, com RLS, sem credencial
administrativa no aplicativo. Vendedor não pode acessar o resumo da equipe.
Não alterar regras de posse, permissões ou dados para montar o painel.

Ficam fora desta fatia: perfil detalhado do vendedor, busca de vendedores,
gráficos, metas, ranking, rastreamento de telefone, presença online e filtros
históricos. Não criar botões de perfil sem destino implementado.

## Aceite

- Somente vendedores ativos aparecem nos cards e indicadores da equipe.
- Contatos registrados hoje e retornos hoje têm rótulos e cálculos distintos.
- Reservas não contam como carteira; múltiplos contatos não duplicam clientes.
- A desativação preserva os dados e retira o vendedor do resumo após atualizar.
- Gestor mantém Empresas, Grupos e Usuários; vendedor mantém sua navegação.
- Testes com dados fictícios em banco temporário local, nunca na Railway.
- Revisão final, CI verde no commit do PR e validação visual antes do merge.
