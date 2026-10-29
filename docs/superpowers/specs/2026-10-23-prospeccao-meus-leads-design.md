# Prospecção com todos os meus leads e seleção de lista

Status: desenho para aprovação. Nenhum código de produto implementado nesta etapa.

Leitura independente do desenho concluída: nenhum ponto importante pendente.
A proposta visual usa dados fictícios; seleção de lista, busca por nome e
limpeza dos filtros foram conferidas no navegador antes da apresentação.

## Pedido confirmado

O usuário pediu reorganizar a Prospecção, pois cada vendedor configura seu
agente e também busca empresas no CNPJ.biz. Quer uma relação de todos os seus
leads, podendo escolher uma lista específica ou todas. Confirmou explicitamente
que os já trabalhados devem aparecer com sua situação. Como referência visual,
escolheu a tela existente **Localizar empresas**.

Este desenho complementa o redesign e os agentes por vendedor entregues no
commit `8ece2ba`. Não altera a execução, planilha compartilhada ou CNPJ.biz.

## Tela e navegação

`/fila` abre uma visão **Prospecção**, com os mesmos componentes, filtros e
cartões da referência. A listagem aparece mesmo sem digitar uma pesquisa;
não começa restrita a recentes ou sugestões. O filtro **Lista** inicia em
**Todas as minhas listas**. A seleção de uma lista restringe os resultados
sem obrigar o vendedor a navegar pelos antigos cartões de grupos.

O cabeçalho conserva acessos em botões a **Configurar agente**, **Buscar no
CNPJ.biz** e **Localizar empresas**. Este último mantém o acesso existente
às consultas e listas compartilhadas anteriores.

Filtros: Lista, Nome, CNAE, Estado, Cidade e Bairro. Reutilizar os controles
da referência; UF/cidade limpam dependentes como hoje. Consultar, limpar e
paginar conservam a lista selecionada. Limpar filtros não troca uma lista
específica por Todas; a opção Todas faz essa troca explicitamente. O seletor
permite buscar e paginar listas, sem um limite silencioso às mais recentes.

Cada cartão mostra empresa, localização, CNAE quando informado, origem,
lista(s), data de entrada e situação. Ações ficam em botões, sem cartão ou
linha inteira clicável. Desktop segue a grade existente; celular usa uma
coluna, sem rolagem horizontal. Não expor telefones ou email em consultas
resumidas: continuam disponíveis conforme as regras das fichas e reservas.

## O que pertence à relação pessoal

- Google: empresas efetivamente entregues ao vendedor, com empresa central
  identificada. Cada pedido entregue funciona como uma lista identificada
  por nicho, região e data. Pendentes, conflitos e ocorrências sem entrega
  continuam na auditoria e não são apresentados como leads recebidos.
- CNPJ.biz: empresas selecionadas e importadas nas buscas do próprio
  vendedor, pelo vínculo persistido entre busca e grupo. Consultar a API sem
  importar não cria um lead nessa relação. Não usar apenas o texto de origem
  ou o criador genérico de um grupo para atribuir autoria.
- Todas: união dessas origens, sem duplicar a mesma `empresa_id`. Se a
  empresa consta em duas listas, conserva ambos os vínculos e aparece uma
  vez. Filtrar por qualquer uma delas continua encontrando a empresa.

Minha escolha de compatibilidade: a nova visão organiza as importações do
CNPJ.biz por autoria, mas não cria exclusividade permanente para essa fonte.
O usuário confirmou exclusividade anteriormente para entregas Google; as
importações CNPJ.biz hoje reutilizam cadastros compartilhados e preservam
posse e reserva. Uma empresa da lista pessoal que esteja indisponível aparece
com essa situação, sem liberar contatos ou assumir o responsável de outra
pessoa. Uma eventual mudança dessa regra seria outro pedido.

Empresas trabalhadas continuam vinculadas às suas listas. Listas desativadas
podem ser consultadas como histórico pessoal, com indicação e sem reabrir
disponibilidade por causa da nova tela. Não apagar, reatribuir ou transformar
listas compartilhadas antigas em listas pessoais.

## Situação e ações

Usar fatos do banco; não inferir atendimento de uma abertura de ficha.
Exibir prioridade coerente entre disponibilidade e situação comercial:

- Sem atendimento e disponível: **Novo**, botão **Prospectar**.
- Reserva vigente do próprio vendedor: **Reservado**, **Continuar atendimento**.
- Posse atual própria, negociação aberta: etapa real do Funil, **Abrir no funil**.
- Cliente da carteira própria: **Cliente**, **Abrir na carteira**.
- Atendimento próprio sem negociação/venda: **Em atendimento**, abrir seu fluxo.
- Empresa anteriormente trabalhada, liberada novamente: **Disponível novamente**.
- Descanso, reserva/posse alheia ou origem desativada: situação de
  indisponibilidade correspondente, sem botão de aquisição indevida.

Nunca exibir estágio comercial ou contatos de outro responsável. O histórico
do solicitante pode permanecer resumido sem ampliar acesso ao atendimento
alheio. A prioridade e a decisão de adquirir são calculadas no servidor/banco.

O atendimento atual permanece no componente existente, em posição estável,
com proteção de rascunho, confirmação ao trocar e verificação do contexto.
Ter uma reserva não esconde os filtros e a relação completa dos leads.
Prospectar uma empresa direciona ao atendimento. A próxima empresa, quando
usada nesse fluxo pessoal, respeita os filtros e a lista, inclusive Todas;
não puxa uma empresa aleatória da base compartilhada. A disputa é resolvida
atomicamente, e falta de candidata não descarta o atendimento atual.

Links antigos com grupo continuam tratando o grupo explicitamente ou
apontam para a consulta legada; nunca ignorar um grupo inválido e cair em
Todas. O caminho legado permanece funcional e separado da seleção pessoal.

## Dados e autorização

Criar leitura resumida pessoal no banco e seleção de listas própria, com
identidade obtida da sessão, sem receber vendedor do navegador. A autoridade
continua no banco; filtrar no React depois de paginar a base global seria
incorreto. Paginação e contagem operam sobre empresas únicas e autorizadas.

Paginar 20 empresas por página, com ordenação estável e desempate por ID.
Filtro inválido, lista alheia ou inexistente falha fechado, sem consultar
Todas. Proteger aquisição direta por ID, próximos candidatos e revisões do
contexto de reserva, não somente a renderização dos botões.

Funções compartilhadas ficam em `server/` ou `lib/`. Uma feature não importa
de outra. Acrescentar migração sem editar 0038–0041 já entregues. Preservar
RLS, dados manuais, carteira, reserva, quotas, UUID da busca e exclusividade
Google. Nenhuma consulta paga, coleta, alteração de planilha ou migração
remota integra a implementação ou a prévia.

## Direção visual

Reutilizar o sistema atual: Segoe UI, corpo 14 px, título 28/36, conteúdo
alinhado à esquerda e componentes shadcn. Base clara #ffffff e #f5f6f8,
texto #202a35, secundário #65707d, borda #e1e5e9 e ação #17634d; modo escuro
usa os tokens existentes. Sem novo hero, novos indicadores ou biblioteca.

Estrutura: cabeçalho e botões; atendimento atual quando houver; painel
compacto de filtros com Lista primeiro; quantidade/contexto; grade de
cartões; paginação em botões. A listagem substitui o catálogo inicial de
grupos. Não redesenhar o formulário de contato neste pedido.

## Validação e entrega futura

Após aprovação, plano de implementação inline com TDD. Cobrir união das
fontes, duplicidade, situação já trabalhada, lista específica/Todas, lista
alheia, histórico desativado, aquisição direta/contexto obsoleto, rascunho
durante filtragem e paginação estável. Executar unidade, integração, build,
lint/typecheck, migrações e jornadas reais com serviços fictícios.

Atualizar a prévia local, conferir desktop e 390 px nos dois temas e fazer
uma revisão independente da implementação. Manter branch e PR #55; não
alterar o checkout compartilhado ou ativar serviços reais.
