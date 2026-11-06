# Carteira: abertura da ficha do cliente

Data: 06/11/2026. Comparação de navegação em protótipo local. Sem mudanças no produto.

## Decisão anterior

Espelhar planejamento foi aprovado em A, formulário direto. Critérios Google permanece aprovado em três grupos.

Conteúdos em painéis laterais, confirmações no centro e ações no rodapé são decisões anteriores. Páginas completas existentes não tinham sido convertidas automaticamente. Esta rodada coloca a ficha da Carteira em comparação explícita.

## O que comparar

Onde Ver cliente deve abrir a consulta e o trabalho do cliente. Não redesenhar a tabela completa, adicionar filtros novos ou mudar o critério de entrada na Carteira.

### A · Cliente no painel lateral

Opção A escolhida pelo usuário em 06/11/2026.

A lista permanece ao fundo. A ficha usa um menu interno com Atendimento e próximo passo, Dados da empresa e Histórico. Registrar venda fica no rodapé.

Atendimento e próximo passo mostra o combinado e dá acesso a Registrar atendimento. Dados usa o painel comum de três grupos, substituindo a mesma lateral. Histórico usa a linha do tempo comercial já aprovada.

Benefício: mantém a lista e permite fechar a consulta sem perder seu contexto.
Custo: menos largura para consultar dados extensos. No celular, ocupa toda a tela.

### B · Cliente em página própria

A ficha substitui a lista na área principal e oferece Atendimento, Dados da empresa e Histórico em abas. Voltar para a carteira recupera a lista.

O conteúdo é compartilhado com A. Dados da empresa aproveita a largura da página para mostrar os três grupos organizados. Atendimento e venda continuam como tarefas em painel lateral.

Benefício: mais espaço para cadastro e histórico.
Custo: exige sair da lista para consultar o cliente.

B preserva a ideia de uma ficha com rota própria; não é uma captura idêntica da interface atual, que possui Dados e Histórico e um editor inline. A proposta organiza seus conteúdos sem criar dados ou permissões.

## Conteúdo e ações preservados

Fontes lidas nesta rodada:

- app/carteira/page.tsx, lista.tsx, filtros.ts e a ficha app/carteira/[id]/page.tsx.
- app/carteira/[id]/ficha.tsx e app/carteira/registrar-venda.tsx.
- src/features/contato/formulario.tsx e tipos.ts.

O exemplo contém um cliente fictício. Mostra contato principal, telefone/e-mail/endereço cadastrais autorizados, próximo passo, histórico de atendimentos/vendas e acesso ao registro de uma recompra.

Não adicionar Avançar para Proposta enviada nem um atalho novo de Sem interesse para o cliente. As opções do formulário de atendimento continuam sendo definidas pelo contrato atual e pela fase autorizada; os rótulos da prévia foram conferidos na fonte. Condicionais reais não são substituídos pelo exemplo fixo.

Dados cadastrais conserva os três grupos aprovados. Contato principal aparece nessa composição de cliente porque já existe na ficha da Carteira, sem impor um campo novo aos demais consumidores.

Registrar atendimento abre a tarefa diretamente na lateral, com resultado, nota, próximo passo e data. Cancelar e Salvar atendimento ficam no rodapé.

Registrar venda abre o formulário curto já aprovado e sua confirmação central. É uma recompra; manter o cliente na Carteira e a agenda existente conforme as regras atuais.

## Contexto e regras para implementação futura

- Preservar nome, UF, retorno, demais filtros existentes, página, rolagem e a origem de Meu dia quando presentes.
- A primeira venda e links diretos devem continuar abrindo o cliente correto, mesmo se a entrada principal passar a ser lateral. Não remover rotas ou contratos ao escolher A.
- Dados → Voltar recupera o nível anterior. Atendimento e venda também retornam ao cliente e à seção de origem.
- Proteger rascunhos, envio pendente e resultado desconhecido; manter a opção existente de fechar conservando rascunho quando aplicável.
- Preservar a recuperação do mesmo comando de contato ou venda após falha/reload. Uma mudança de superfície não permite duplicar o envio.
- Manter clientes arquivados em modo autorizado, confirmação de comandos antigos e ações condicionais de retomada já existentes.
- Preservar RLS, autorização, recortes do histórico e fontes atuais. Uma aparência comum não autoriza consultar mais dados.

## Limites da prévia

A lista e os filtros ao fundo são simplificados para comparar a abertura. Os valores digitados na demonstração são conservados ao abrir/voltar; a filtragem real não é implementada.

Na opção B, a troca entre lista e ficha é simulada no mesmo HTML. Não é navegação real entre rotas nem teste de Voltar do navegador.

O formulário de atendimento, a confirmação de venda e as mensagens de conclusão são simulações. Nenhum contato, venda, arquivo, retorno ou empresa real é alterado. O protótipo não resolve regras comerciais nem recupera comandos reais.

Os dados são fictícios e compartilhados pelas alternativas. A consulta normal de um cliente é o foco; estados arquivados, erro de servidor, permissões e resposta perdida pertencem à futura validação isolada.

## Prévia

- A: http://127.0.0.1:4338/?area=cliente&view=lateral
- B: http://127.0.0.1:4338/?area=cliente&view=pagina

As prévias começam com a ficha já aberta apenas para facilitar a comparação. A entrada real da Carteira continua sendo sua lista de clientes.

## Situação

Abertura aprovada: A, ficha do cliente no painel lateral. Preservar rotas e links diretos como contratos na implementação posterior. A alternativa B fica para referência; nenhum arquivo do produto foi alterado nesta rodada.
