# Gestor: acesso às ações dos usuários

Data: 06/11/2026. Comparação visual local, com pessoas fictícias. Nenhuma mudança de acesso real.

## Decisão anterior

O usuário aprovou a ficha da Carteira na lateral, opção A. Preservar seus links diretos, origem, rascunhos e contratos na futura implementação.

As confirmações administrativas continuam em pop-up central. A entrega de senha continua em painel lateral. Esta rodada compara somente como chegar às ações de uma pessoa.

## A · Menu Ações na linha

Opção A escolhida pelo usuário em 06/11/2026.

Um acionador Ações reúne os comandos permitidos da linha e Ver perfil quando disponível. Selecionar o comando abre a confirmação diretamente. A confirmação de nova senha abre depois a entrega única na lateral.

Benefício: reduz os botões da lista e os passos para comandos curtos.
Custo: exige abrir o menu para descobrir as ações disponíveis.

Este menu é navegação, não um formulário ou conteúdo a migrar para a lateral. Não reabre a decisão de manter confirmações no centro.

## B · Painel Gerenciar acesso

Gerenciar acesso abre a identificação da pessoa na lateral. Pessoas ativas usam duas entradas: Senha de acesso e Papel e situação.

- Senha de acesso mostra Definida ou Troca pendente e Nova senha provisória no rodapé.
- Papel e situação mostra os valores atuais e as ações permitidas no rodapé.
- Ver perfil fica no rodapé do primeiro nível, quando permitido.
- Pessoa inativa abre diretamente Situação, com Reativar no rodapé.
- A própria conta abre somente uma consulta sem ações administrativas.

Benefício: mais contexto da pessoa e separação das responsabilidades.
Custo: adiciona um nível de navegação antes da confirmação.

## Ações e restrições preservadas

Fontes lidas nesta rodada: app/usuarios/tabela.tsx, linha.tsx, formulario-criar.tsx, senha.tsx e src/features/usuarios/regras.ts.

A tabela atual tem botões diretamente na linha. A e B são propostas de organização desses acessos; nenhuma é uma captura idêntica da página publicada.

As duas alternativas reutilizam quatro pessoas fictícias e as mesmas regras visuais da fonte:

| Pessoa | Ações disponíveis |
| --- | --- |
| Vendedor ativo de outra pessoa | Nova senha provisória, Tornar gestor, Desativar e Ver perfil |
| Outro gestor ativo | Nova senha provisória, Tornar vendedor e Desativar |
| Pessoa inativa | Reativar |
| Própria conta | Nenhuma alteração administrativa |

A confirmação identifica nome, e-mail e consequência. Cancelar mantém o contexto. Gerar nova senha invalida a senha anterior e as sessões conforme a regra atual; essa consequência é apenas exibida na prévia.

A entrega demonstra EXEMPLO-SEM-ACESSO. Copiar senha é simulado, sem escrever na área de transferência. Ao concluir ou voltar, a entrega deixa de estar disponível; consultar novamente exige outra ação de geração e confirmação.

Novo usuário continua como tarefa curta diretamente no formulário lateral já apresentado na galeria, seguida da entrega única. Não criar usuários reais para testar.

## O que Ver perfil mostra hoje

Página atual conferida em app/usuarios/vendedores/[id]/page.tsx em 06/11/2026, por leitura de código:

- Nome, e-mail e situação do vendedor.
- Resumo com Clientes em carteira, Retornos atrasados, Retornos hoje e Contatos registrados hoje.
- Empresas vinculadas ao vendedor, com nome, CNPJ, próximo retorno e próximo passo. A lista possui paginação.
- Últimos atendimentos, limitados a 20 registros, incluindo empresas atendidas anteriormente. A linha do tempo apresenta empresa, data/hora, resultado, anotação e próximo passo quando disponível.
- Atualizar e Voltar para Usuários, preservando o recorte de origem.

O acesso existe para vendedores ativos. A página é exclusiva do gestor e conserva sua rota atual. Na galeria desta rodada, Ver perfil apenas indica esse destino em uma mensagem; a página comercial do perfil ainda não foi redesenhada.

## Contexto para a implementação futura

- Preservar filtros, pesquisa, página e retorno do perfil do vendedor.
- Manter a função de domínio como fonte das ações; o desenho não substitui regras nem RLS.
- Conservar restrições da própria conta, gestor único e validações do servidor.
- Manter confirmação da ação, identificação do alvo e foco de retorno.
- Preservar pendência, resultado incerto e bloqueio de repetição dos comandos administrativos.
- Não guardar senha provisória para consulta futura nem inserir credenciais reais no histórico.
- Ver perfil continua com sua rota atual e só aparece para vendedor ativo. Não converter esse perfil para painel nesta rodada.

## Limites da prévia

A lista é simplificada e não exercita os filtros e a paginação reais. O perfil do vendedor é um destino indicado por mensagem simulada.

As confirmações de papel e ativação exibem conclusão simulada, sem mudar o conjunto de pessoas ou fingir que a lista foi reconsultada. A senha demonstrada não dá acesso ao CRM. Não há consultas de autenticação, geração real de senha, envio de mensagens ou chamadas administrativas.

## Prévia

- A: http://127.0.0.1:4338/?area=usuarios&view=menu
- B: http://127.0.0.1:4338/?area=usuarios&view=painel

B começa com uma pessoa aberta somente para facilitar a comparação. A entrada real continua sendo a lista.

## Situação

Acesso aprovado: A, menu Ações na linha. A alternativa B permanece para referência. Ver perfil foi depois aprovado com identificação/indicadores na página e botões Empresas/Atendimentos abrindo consultas laterais; ver docs/design/2026-11-06-perfil-vendedor-organizacao/README.md.
