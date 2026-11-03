# Ajustes do CRM: decisões, mockups e revisão dos botões

Data: 03/11/2026. Material para continuidade em outro chat.

## Estado do trabalho

Worktree: `C:\Users\ADM\.codex\worktrees\crm-fluxos-comerciais\crm`.
Branch: `codex/simplificar-crm-fluxos`, criada de `origin/main` no commit
`0cdafb0c9c204b4658f7072aea9924d62ced9c72`. O commit inicial `af5fb1d`
contém a primeira spec. A versão corrigida e os mapas desta rodada devem
ser lidos no estado atual da branch, não apenas naquele commit.

Não houve implementação de produto, alteração de teste ou mutação em banco
real. A revisão de botões foi feita por leitura de componentes, handlers,
actions, consultas e testes existentes. Testes do CRM e jornadas reais no
navegador não foram executados nesta revisão. As prévias visuais são
descartáveis e não representam o CRM já alterado.

## Decisão explícita: onde fica Sem interesse

Na central de Prospecção, dentro do bloco Localizar empresas, o seletor
**Origem das empresas** deve oferecer:

- Google e banco de empresas;
- Buscas no Google;
- Banco de empresas;
- Sem interesse.

Escolher Sem interesse e clicar Localizar empresas abre as empresas nessa
situação comercial, vindas de qualquer origem. Remover o card separado da
Prospecção e o alvo permanente no topo do Funil. Manter a ação individual
Marcar como Sem interesse, pois ela encerra a negociação.

Essa correção substitui a proposta anterior de colocar Disponibilidade em
destaque. Sem interesse continua sendo situação comercial no domínio; a opção
visual deve normalizar para a consulta `disponibilidade=sem_interesse`.
Não gravar Sem interesse como origem de aquisição.

Preservar seleção, busca e paginação ao abrir/voltar do atendimento. A rota
antiga deve continuar encaminhando corretamente, inclusive para confirmar
uma retomada cujo comando ficou pendente no armazenamento da sessão.

## Escolha visual ainda pendente

O usuário pediu ver mockups antes de escolher. Alternativas:

- **Linha discreta**, recomendada: mensagem curta e link, sem card em volta.
- **Faixa compacta**: superfície baixa, ícone pequeno e ação junto ao texto.
- **No próprio conteúdo**: orientação na primeira coluna do Funil ou na
  região vazia de uma lista, sem aviso global adicional.

Aplicação prevista: Funil, Meu dia, Carteira, Localizar, históricos e outras
telas que usam EstadoVazio. O componente atual impõe mínimo de 286 px. Remover
o espaço artificial, preservar os tokens e manter os erros e confirmações
de operação com a visibilidade necessária.

Referência editável das prévias nesta conversa:
`C:\Users\ADM\.codex\visualizations\2026\11\03\01a1a1d8-24d5-70e0-8db8-43584df9284a\avisos-crm.html`.
O exemplo de empresas vazio é um cenário ilustrativo, sem consulta aos dados.

As três alternativas foram conferidas em Chromium local nas larguras de
1064 e 390 px, em cenário escuro e também Carteira em claro. A conferência
automatizada passou sem overflow horizontal nem erro de script. Exercitou
o menu, a escolha Sem interesse e sua consulta, outra origem e a Carteira.
Isso valida a prévia descartável; não é teste dos botões do CRM real.

## Revisão de todos os botões: mapas completos

- [Vendedor](2026-11-03-botoes-vendedor.md): Prospecção, Localizar, atendimento,
  Google, banco de empresas, Funil, Carteira e Meu dia.
- [Gestor](2026-11-03-botoes-gestor.md): Gestão, Empresas ativas e arquivo,
  listas, busca, Google, Usuários e WhatsApp/configuração.
- [Comuns e autenticação](2026-11-03-botoes-comuns.md): menu desktop/mobile,
  tema, breadcrumbs, login, troca de senha, sair, cards, diálogos e abas.

Cada mapa inventaria ações distintas por tela, destino/efeito atual,
arquivo/linha, feedback, erros, travas e pendências de verificação.
Uma ligação coerente no código não equivale a uma jornada aprovada no
navegador. Não há evidência nesta rodada de que todos os botões funcionam.

## Prioridades para a implementação

### Integridade do registro de venda

No Funil e na Carteira, chave e dados da venda permanecem só em memória.
O mesmo editor consegue repetir a chave, mas recarregar/fechar perde o comando.
Se uma resposta se perder depois da gravação, uma tentativa nova pode usar
outra chave. O risco não foi reproduzido no banco nesta rodada.

Planejar recuperação do mesmo comando antes de permitir outra venda.
Persistir dados antes do envio, congelar payload enquanto o resultado for
desconhecido e oferecer confirmação do envio anterior. Testar resposta
perdida, reload e confirmação sem duplicar venda. Não usar só uma notificação
de sucesso como correção para este risco.

### Destino depois da ação

- Interessado ou retorno combinado no atendimento: abrir a negociação
  autorizada no Funil, se essa for a situação atual confirmada pelo servidor.
- Sem interesse: abrir Localizar com a opção correspondente selecionada.
- Retomar empresa arquivada: abrir seu atendimento, mantendo a pesquisa.
- Primeira venda: propor abrir a ficha do cliente na Carteira, em vez de
  deixá-lo procurar a empresa que acabou de sair do Funil.
- Contato/venda em ficha de cliente e editores embutidos: manter o contexto
  adequado, sem redirecionamento global indiscriminado.

O servidor deve fornecer a situação atual, inclusive em replay de um comando
antigo. Falha ao ler o destino após gravação confirmada não pode ser anunciada
como falha de gravação. Não apagar rascunho de outra empresa ou comando incerto.

### Acesso e preservação de contexto

- Google do vendedor renderiza histórico de entregas, mas o planejamento não
  oferece entrada para essa aba. Criar caminho visível.
- Listas arquivadas do gestor carregam só a primeira página de até 50 listas
  e não oferecem paginação de listas. Corrigir sem supor volume no banco real.
- Vazio da busca no arquivo leva a empresas ativas. A recuperação deve ficar
  no arquivo e limpar somente a busca apropriada.
- Arquivo → ficha → voltar perde busca/página; grupos, Google, WhatsApp e
  perfil de vendedor também têm retornos que descartam contexto.
- Breadcrumb não descreve atendimento e arquivo Sem interesse. Ajustar o
  que continuar existindo após a unificação de navegação.

### Edição, cancelamento e ações de conta

- Planejamento, critérios e espelhamento Google têm proteção parcial de
  rascunho/fechamento. Verificar Cancelar, Escape, clique externo e fechamento
  durante gravação.
- Acompanhamento usa um tipo inicial que já é considerado rascunho alterado;
  abrir e cancelar sem digitar pode pedir descarte. Comparar com o estado
  inicial real de cada contexto.
- Troca voluntária de senha não tem entrada visível no menu; a tela de troca
  obrigatória não oferece Sair. São decisões de UX para confirmar, sem
  alegar falha de autenticação.
- Confirmar pending, erro, recuperação e cliques repetidos de Sair, limite de
  buscas e mutações administrativas em ambiente isolado. Ausência de pending
  em um componente genérico não prova duplicação: rastrear a trava do pai.

## Condições de aceite e limites

Antes de concluir, comprovar navegação e resultado persistido nos caminhos
relevantes, não somente mensagem ou URL. Usar fixtures locais para escrever.
Não disparar busca paga, envio de WhatsApp, sincronização externa ou alteração
de usuário real apenas para testar botões.

Cobrir vendedor e gestor, vazio e preenchido, claro/escuro, teclado, celular,
voltar/fechar, dados digitados, envio lento, erro, resposta perdida e comando
confirmado por outra aba. Os relatórios separam defeitos observáveis por
leitura, melhorias de UX e hipóteses que precisam de reprodução.

Produto e banco mantêm a autoridade atual de permissões, RLS, idempotência e
transições. A spec detalhada está em
[simplificação dos fluxos](../superpowers/specs/2026-11-03-simplificacao-fluxos-crm-design.md).
Concluir a escolha visual antes de aplicar o padrão em todas as abas.
