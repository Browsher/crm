# Simplificação dos avisos e dos destinos das ações do CRM

Data: 03/11/2026. Estado: escopo corrigido pelo usuário; mockups em avaliação,
sem implementação do produto. Revisão dos botões ampliada a todo o CRM.

## Pedido e intenção

O usuário quer consultar empresas sem interesse dentro de Localizar empresas,
simplificar os cards de aviso das abas, especialmente no Funil, e verificar se
os botões conduzem ao próximo passo correto. O exemplo é registrar um
atendimento que leva a empresa ao Funil e continuar preso na mesma página.

A interface deve mostrar o resultado da ação e levar ao lugar em que o trabalho
continua. Decisões abaixo identificadas como proposta são escolhas do autor,
ainda não aprovadas pelo usuário.

## Base conferida

Revisão de origem: `origin/main`, commit
`0cdafb0c9c204b4658f7072aea9924d62ced9c72`, conferido com `git fetch origin` e
`git log -1 origin/main` em 03/11/2026. A branch aberta no diretório original
era mais antiga que a interface anexada. Seus arquivos não foram alterados.

Evidências obtidas por `git show origin/main:<caminho>` e depois por leitura
dos mesmos arquivos no worktree isolado:

- `src/components/crm/composicoes.module.css`: `.vazio` tem altura mínima de
  286 px e o rodapé é empurrado para o fundo por `margin-top: auto`.
- `src/components/crm/estado-vazio.tsx`: a mesma composição de card, ícone,
  título, descrição e rodapé é reutilizada nas telas e nos históricos.
- `app/fila/localizar/pessoal.tsx`: Sem interesse já é uma opção de
  Disponibilidade, atualmente escondida em Mais filtros.
- `app/fila/central.tsx` e `app/funil/quadro.tsx`: há também um bloco de
  arquivo na Prospecção e um alvo de descarte permanente no topo do Funil.
- `src/features/contato/formulario.tsx`: ao salvar, limpa o comando confirmado,
  atualiza dados com `router.refresh()` e chama `onSaved`; não navega ao Funil.
- `src/features/contato/acao.ts`: revalida as rotas e devolve sucesso; não
  informa destino nem situação comercial atual.
- `db/migracoes/0052_atendimento_direto.sql`: interessado e retornar_depois
  criam negociação se a empresa ainda não é cliente; iniciar atendimento
  sozinho não cria negociação. Sem interesse encerra a negociação e a agenda.
- `src/lib/empresa-visual.ts`: os destinos já distinguem atendimento, Funil e
  Carteira. O modal de resumo não inicia atendimento.

Essas são constatações de código. A execução de todas as jornadas no navegador
continua pendente; não se afirma que todos os botões foram testados.

## 1. Sem interesse dentro de Localizar empresas

Decisão explícita do usuário após a primeira proposta: o acesso deve estar
no seletor **Origem das empresas**, dentro do bloco **Localizar empresas** na
central `/fila`. As opções são Google e banco de empresas, Buscas no Google,
Banco de empresas e **Sem interesse**. Não promover Disponibilidade a um novo
filtro principal como sugerido anteriormente.

Selecionar Sem interesse e clicar Localizar empresas abre a consulta das
empresas sem interesse do vendedor, independentemente de terem vindo do
Google ou do banco. Nome, CNPJ, nicho, bairro e paginação continuam disponíveis.
Na consulta, mostrar qual seleção está ativa e preservá-la ao filtrar,
paginar e voltar do atendimento.

Sem interesse é uma situação comercial, não uma origem de dados. A nova opção
do seletor é apresentação: converter a seleção em
`disponibilidade=sem_interesse`, sem restringir origem, na fronteira da rota.
Não inserir `sem_interesse` como origem de empresa no domínio ou no banco.
O plano pode escolher a codificação do valor de apresentação e a normalização
da URL; deve reaproveitar a validação e a consulta já existentes.

Retirar o bloco Sem interesse da central de Prospecção e o card/alvo de
arraste permanente do topo do Funil. O Funil preserva suas três etapas e o
arraste para a próxima etapa. A ação individual Marcar como Sem interesse
continua disponível no card e no modal: é necessária para encerrar uma
negociação, independentemente de onde se consulta o arquivo.

Links novos para consultar Sem interesse levam a
`/fila/localizar?disponibilidade=sem_interesse&pagina=1`. A rota antiga
`/fila/sem-interesse` redireciona para essa consulta, preservando nome, CNPJ e
página quando válidos; filtro inválido continua visível como erro com opção
de limpar. A autorização deve acontecer antes da consulta/redirecionamento.

Retomar atendimento dentro da consulta abre o atendimento da empresa,
preservando os filtros de origem. Não restaura agenda cancelada nem cria
negociação ou contato sozinho. Confirmação de resposta perdida usa a mesma
chave de comando, inclusive para sessões iniciadas na rota antiga: o plano
deve prever recuperação do comando legado antes de retirar a lista antiga.

O código de arquivamento do Funil conserva a persistência do comando pendente,
o botão Confirmar envio anterior e os avisos de resultado. Remover o alvo de
arraste não autoriza remover a proteção contra duplicação ou a recuperação.

## 2. Estados vazios compactos e alternativas visuais

O usuário pediu mockups antes da escolha visual. Há três alternativas para
comparar nas abas Funil, Meu dia e Carteira: **Linha discreta**, com mensagem
e link sem caixa; **Faixa compacta**, com ícone discreto e ação próxima; e
**No próprio conteúdo**, com a orientação dentro da primeira coluna do Funil
ou da região vazia da lista. Linha discreta é a recomendação do autor.
Nenhuma das três foi escolhida pelo usuário ainda.

Proposta sujeita à escolha: mudar o componente compartilhado EstadoVazio para
uma mensagem compacta com título, uma linha de orientação quando necessária
e ação próxima ao texto. Sem altura mínima, rodapé separado ou ícone em caixa
por padrão.
O espaço ocupado acompanha o conteúdo. Em celular, a ação pode passar para
a linha seguinte. Temas claro/escuro usam os tokens existentes.

No Funil vazio, a posição segue a alternativa escolhida: Linha discreta e
Faixa compacta ficam acima das colunas; No próprio conteúdo fica dentro da
primeira coluna, sem orientação global duplicada. Usar "Nenhuma negociação
aberta. Registre interesse ou combine um retorno para começar." e a ação Ir
para Prospecção. Não desenhar outro painel grande. Manter títulos e contagens
das três etapas, com as mensagens locais que não dupliquem a orientação.

Aplicar a composição compacta aos consumidores existentes de EstadoVazio,
incluindo Carteira, Meu dia, Localizar, históricos e consultas do gestor.
Preservar a mensagem específica e a ação útil de cada tela. Erros, bloqueios
de acesso, confirmações de venda, recuperação de envio e avisos sobre dados
não salvos mantêm sua semântica e visibilidade; não são estados vazios.

Preservar hierarquia de títulos, foco visível, navegação por teclado, texto
completo sem cortes e diferenças entre link, botão local e submit nativo.
Nenhum elemento interativo fica dentro de outro.

## 3. Depois de registrar atendimento

O registro tratado aqui é o botão Registrar do atendimento. Não é a busca ou
a importação de empresas na base. Apenas iniciar atendimento não deve levar
ao Funil, pois ainda não existe uma negociação criada por essa ação.

Proposta para o atendimento aberto por `/fila/atendimento/[id]`:

| Resultado confirmado e situação atual | Próximo passo |
| --- | --- |
| Interessado ou retorno combinado, com negociação ativa do vendedor | Abrir `/funil?negociacao=<id>` com essa negociação selecionada |
| Sem interesse | Abrir Localizar com Sem interesse selecionado, preservando os demais filtros e voltando à página 1 |
| Não liguei ou ninguém atendeu, sem nova negociação | Permanecer no atendimento com confirmação clara e dados atualizados |
| Contato de empresa já cliente | Permanecer no contexto atual; não voltar ao Funil |
| Falha de validação, perda de permissão ou versão antiga | Permanecer com os dados digitados e explicação do problema |
| Resultado de gravação desconhecido por falha de rede | Preservar rascunho e comando para Confirmar envio anterior; não navegar |

O destino deve vir de leitura autenticada da situação atual, após a gravação
confirmada, não apenas do tipo escolhido ou do estado antigo do navegador.
Isso é obrigatório no replay: uma negociação pode ter sido vendida,
arquivada ou retomada por outra aba desde o comando original. Nunca reabrir
automaticamente uma negociação que já terminou.

Confirmado o sucesso, limpar somente o rascunho do comando confirmado e o
estado correspondente no contexto de rascunhos. Para uma nova navegação após
salvar, a proposta é substituir o atendimento concluído no histórico, evitando
que Voltar reabra o formulário acabado. Não incorporar URLs arbitrárias do
cliente: os destinos são locais, construídos a partir de IDs autorizados.

Separar erro de gravação de erro de leitura posterior: se o registro já foi
confirmado mas o destino não pôde ser obtido, informar "Atendimento registrado.
Não foi possível abrir o destino. Atualize a página ou abra o Funil." Não
tratar isso como falha de gravação nem incentivar um segundo registro.

Formulários embutidos no modal do Funil e na ficha da Carteira preservam o
contexto da tela: fecham ou atualizam o editor conforme os callbacks atuais.
Não introduzir navegação global obrigatória no componente compartilhado.

## 4. Verificação dos botões e critérios de aceite

Pedido atualizado: revisar **todos os botões do CRM**, sem limitar a auditoria
ao vendedor ou aos componentes visualmente alterados. Incluir links de ação,
ícones acionáveis, selects, abas, filtros, paginação e voltar/cancelar/fechar.
Inventariar por tela e ação distinta, sem repetir instâncias de um card.

Além dos testes de regressão do que mudar, verificar as jornadas do vendedor:

| Ação | Resultado que deve ser comprovado |
| --- | --- |
| Ver empresa | Abre os dados sem criar contato ou negociação |
| Localizar, pesquisar, limpar e paginar | Atualizam a consulta e preservam os filtros que devem continuar ativos |
| Iniciar ou retomar atendimento | Abrem a empresa correta; cliques repetidos e replay não duplicam operações |
| Registrar interesse ou retorno | Salvam uma vez e abrem o Funil na negociação correta |
| Avançar negociação | Permite somente a próxima etapa e confirma o resultado |
| Marcar como Sem interesse | Some do Funil, aparece no filtro e cancela o retorno |
| Retomar uma empresa sem interesse | Abre atendimento sem restaurar retorno antigo |
| Registrar primeira venda | Sai do Funil, fica na Carteira e confirma o resultado; o plano deve corrigir o destino se a jornada mantiver o usuário preso no contexto encerrado |
| Registrar atendimento ou nova venda na Carteira | Atualiza a ficha sem perder o contexto |
| Cancelar, fechar e Voltar durante edição | Preservam ou pedem confirmação sobre os dados não salvos |

Revisar também Gestão, Empresas ativas/arquivadas, grupos/listas, buscas e
planejamento Google do gestor, Usuários, WhatsApp e sua configuração, login,
troca de senha, sair, menu lateral/mobile, tema, breadcrumbs e diálogos comuns.
Conferir para cada ação seu rótulo, efeito/destino, feedback, erro, trava de
envio, preservação de contexto e necessidade de confirmação sobre alterações.

Distinguir falha funcional confirmada no código, melhoria de UX proposta e
comportamento que depende de execução. A revisão por leitura não comprova
funcionamento no navegador. Não disparar integração paga nem alterar conta,
usuário ou dado real só para testar um botão. Usar fixtures e ambiente isolado
para os caminhos que escrevem.

Os mapas de referência ficam em `docs/auditorias/2026-11-03-botoes-vendedor.md`,
`docs/auditorias/2026-11-03-botoes-gestor.md` e
`docs/auditorias/2026-11-03-botoes-comuns.md`. A consolidação deve indicar
prioridade, evidência, cobertura e pendências para o chat que implementar.

TDD: teste falhando primeiro para cada comportamento novo. Cobrir navegação
após registro, ausência de navegação no erro, replay com situação alterada,
recuperação de comandos legados, filtro visível e seus links e estados vazios
compactos com ações semânticas. Reaproveitar os testes de domínio e de banco
que já protegem as operações.

Verificar no navegador os cenários vazio/preenchido, teclado, claro/escuro e
larguras 390, 820 e 1280 px. Testes de integração/E2E usam apenas o banco
temporário local do harness existente. Registrar o que foi executado, o que
falhou e qualquer limite de verificação, sem prometer que tudo funciona só
porque a compilação passou.

## Restrições e execução

Não alterar critérios de entrada no Funil, papéis, RLS, posse, idempotência,
regra de agenda ou retenção de histórico. A autoridade continua no banco.
`features/` não importa de outra feature; código comum sobe para `lib/` ou
`server/`. Sem dependência nova prevista e sem migração de banco prevista.

Depois da aprovação, produzir plano de implementação com Superpowers e
executar em branch `codex/simplificar-crm-fluxos`, baseada na main conferida.
Entregar PR contra main com verificações apropriadas e CI verde. Não fazer
merge ou publicar sem a autorização correspondente.

## Decisões do autor para revisão do usuário

- Sem interesse dentro de Origem das empresas na central, conforme correção
  explícita do usuário; a consulta usa a situação comercial internamente.
- Manter a ação individual de arquivar; remover seus blocos permanentes.
- Três alternativas de mensagens vazias em avaliação, com Linha discreta
  recomendada, aplicáveis aos consumidores do componente comum.
- Navegação automática no registro que cria negociação, mantendo editores
  embutidos e resultados sem negociação no contexto apropriado.

Até a aprovação visual, somente investigação, documentação e mockups
descartáveis. Não confundir a correção de escopo com produto já implementado.
