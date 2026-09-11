# Carteira, ficha e Meu dia

Status: layouts aprovados na conversa; especificação consolidada em 11/09/2026.

## Decisões aprovadas

- Meu dia e Carteira são páginas diferentes no menu, não abas da mesma página.
- Carteira usa cards de clientes, opção 2 do protótipo.
- Meu dia usa lista à esquerda e perfil à direita. No desktop, só a lista
  rola dentro dessa área; selecionar outro cliente não reinicia a rolagem.
- Ficha equilibrada em página própria: dados e próximo passo à esquerda,
  histórico à direita; Registrar atendimento no cabeçalho.
- Manter componentes, tipografia, temas e espaçamentos aprovados na Fila.
- Evitar travessões em textos da interface.

## Evidências do estado atual

Conferidos em 11/09/2026: `src/features/fila/consulta.ts`,
`src/features/contato/historico.ts`, `src/features/contato/regras.ts`,
`src/features/contato/formulario.tsx`, `app/carteira/page.tsx` e
`app/carteira/[id]/page.tsx`.

A consulta atual já deriva próximo passo do último contato, ordenado por
`criado_em DESC, id DESC`. O banco calcula vencido pela data civil de
America/Sao_Paulo. A carteira inclui posse do usuário, não reserva temporária.
A ficha verifica pertencimento antes de buscar histórico e responde 404 para
empresa fora da carteira. O cadastro contém contatoNome, não cargo do contato.

Os cargos e empresas fictícias dos mockups ilustram composição, não exigem
novos campos de banco. Não inventar cargo, telefone, contato ou histórico.

Esta decisão substitui somente a organização de telas da seção de agenda em
`2026-09-10-contato-design.md`, que antes unificava agenda e carteira. As regras
de contato, posse, permissões e data permanecem.

## Fonte da agenda

Uma única fonte: último contato autorizado de cada empresa da carteira.
Não criar tabela de tarefas, duplicar datas, nem estado independente de
conclusão de retorno. Registrar acompanhamento com próximo passo atualiza a
agenda conforme as regras atuais. Devolver remove a empresa da carteira e do
Meu dia. Não oferecer botão isolado de concluir/reagendar nesta fatia.

O banco classifica o próximo passo em atrasado, hoje, futuro ou sem data pela
data civil de São Paulo. Não usar relógio do navegador para classificação.
Uma data registrada numa empresa devolvida não a inclui na agenda pessoal.
Após escrita bem-sucedida, revalidar ficha, carteira e Meu dia. Erro preserva
rascunho; não simular sucesso. Navegar ou abrir perfil não conclui retorno.

## Carteira: /carteira

Cards em grade de duas colunas no desktop e uma em celular. Cada card exibe
nome, localização disponível, contato principal, última conversa com data,
próximo passo com data e estado textual. Ausências devem ser explícitas, sem
conteúdo inventado. Nota longa tem resumo na lista e conteúdo integral na ficha.
Sem histórico: "Ainda não há uma conversa registrada".

Busca pelo nome, seleção de estado e filtro de retorno: todos, atrasados,
hoje, próximos e sem agendamento. Opções derivadas da carteira autorizada.
Ordenação por nome com id como desempate. Contagem dos resultados filtrados.
Ver cliente abre /carteira/[id]. Voltar preserva filtros na URL e não troca
proprietário, faz reserva ou registra contato. Filtro inválido recebe mensagem
e ação de limpar; nenhum resultado é distinto de carteira vazia.

## Ficha: /carteira/[id]

Cabeçalho com nome, localização, vínculo com a carteira e Registrar atendimento.
Dados disponíveis: nome fantasia, contato, telefone, e-mail, localização,
CNPJ e CNAE quando houver. Próximo passo com data e atraso; nenhum tempo
restante de reserva, porque esta é uma empresa assumida.

Histórico do mais recente para trás com tipo, nota, autor e data. Identidade do
autor permanece baseada em usuario_publico. Não converter erro de carregamento
em histórico vazio.

Registrar atendimento abre o formulário existente estilizado, com foco no
primeiro campo. Preservar tipos/desfechos disponíveis para posse, validação do
par próximo passo/data e opção existente de devolver. O formulário reduzido do
mockup não substitui essas regras. Durante envio bloquear ações que desmontam
o editor. Cancelar/voltar com alterações pede confirmação; erro mantém texto.
Após sucesso, apresentar histórico e próximo passo atualizados. Em celular,
empilhar dados, próximo passo e histórico sem cortar conteúdo ou ações.

## Meu dia: /meu-dia

Mostrar apenas empresas próprias com retorno atrasado ou de hoje. Atrasados
primeiro, depois hoje; ordem de data e desempate por nome/id. Busca por nome e
filtro entre todos os retornos do dia, atrasados e hoje.

Selecionar item atualiza perfil e histórico à direita, com verificação de
acesso no servidor. O perfil não é editor automático; Abrir atendimento leva à
ficha da empresa. Não carregar históricos de toda a carteira para compor lista.
Ignorar respostas antigas se a seleção mudar durante carregamento.

Lista com altura limitada à área útil, rolagem independente e posição
preservada durante seleção. Perfil fica fora do contêiner rolável da lista.
Não capturar roda globalmente nem impedir zoom/teclado. Se perfil ou viewport
curta exigir mais espaço, permitir acesso ao conteúdo completo; nunca cortar
botões para manter o painel parado. No celular, usar lista e resumo empilhados.

Sem retornos: "Nenhum retorno pendente para hoje", com acesso à Carteira.
Futuros e sem agendamento continuam acessíveis na Carteira, não são atrasados.
Ao recarregar, datas refletem o dia atual do banco. Sem promessa de atualização
automática na virada da meia-noite nesta versão.

## Segurança e limites

Guarda de usuário em ambas as rotas. Gestor vê a própria carteira; esta fatia
não cria visão de todos os vendedores. RLS continua sendo autoridade.
Nenhuma leitura usa credencial administrativa. Perda de posse revoga o painel
e a ficha sem reaproveitar dados privados anteriores.
Sem alterar migrações existentes, regras de reserva ou integração Railway.
Sem novas bibliotecas, campos comerciais, score ou funil.
Shell compartilhável fora de features; nenhuma feature importa outra feature.

## Fatias de implementação

1. Dados: resumo do último contato e classificação SQL dos retornos, com
   testes de isolamento, datas, ausência e desempate.
2. Carteira e ficha: cards, filtros, shell e ficha equilibrada, formulário
   real preservado, testes de navegação e escrita.
3. Meu dia: rota separada, seleção, perfil e rolagem independente, usando
   os dados e a ficha já integrados.

Cada fatia usa branch própria, testes RED/GREEN, PR contra main e CI verde.
Não empilhar PRs. Validar visual real ao final de cada fatia de interface.

## Critérios de aceite

- Nenhum cliente de outro vendedor aparece em consulta, filtro, contador ou ficha.
- Data de hoje não é marcada atrasada; nulo não vira hoje; decisão vem do banco.
- Cards, ficha e Meu dia refletem o mesmo último contato.
- Novo atendimento e devolução atualizam todas as visões pertinentes.
- Busca/volta preservam filtros; erro de gravação preserva anotações.
- Meu dia não move perfil ao rolar lista e não reseta posição ao selecionar.
- Teclado, foco, erros, carregamento, vazio, 390/820/1280 px e temas conferidos.
- Fila continua passando os testes de reserva, rascunho e concorrência.
