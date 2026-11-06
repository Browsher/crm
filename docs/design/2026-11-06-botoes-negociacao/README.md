# Negociação: organização dos botões

Data: 06/11/2026. Somente desenho e protótipo. Nenhum código do produto alterado.

## Decisões anteriores preservadas

- Conteúdo apresentado na galeria aprovado.
- Negociação com menu interno de seções: Atendimento e próximo passo; Histórico.
- Regra global aprovada em 06/11/2026: usar menu interno nos painéis com várias seções; tarefas curtas abrem direto. Cabeçalho, Voltar, espaçamento e padrão de ações comuns. Confirmações rápidas continuam em pop-up.
- A regra global não aprova automaticamente os nomes e o agrupamento dos demais painéis. A revisão segue uma área por vez.

## Comparação atual

Duas opções com as mesmas funções e o mesmo menu. O que varia é onde ficam as ações e qual delas recebe destaque em cada contexto.

### Ações no rodapé

Registrar venda e Sem interesse permanecem no rodapé em todas as seções de leitura. Registrar atendimento fica na seção Atendimento e próximo passo. Durante a edição, o rodapé troca para Cancelar e Salvar atendimento.

Benefício: as ações gerais estão sempre no mesmo lugar. Custo: continuam visíveis mesmo durante a leitura do histórico.

O usuário escolheu esta opção A, ações no rodapé, em 06/11/2026. A alternativa contextual permanece apenas para referência.

### Ações por contexto

Registrar venda e Sem interesse ficam juntos abaixo das entradas do menu inicial. Na seção Atendimento e próximo passo, Registrar atendimento ganha destaque. O Histórico fica livre de ações gerais. Durante a edição, Cancelar e Salvar atendimento permanecem no rodapé fixo.

Benefício: cada seção mostra ações ligadas à tarefa atual. Custo: vender ou marcar Sem interesse exige Voltar ao menu quando a pessoa está em uma seção. Nenhuma função é removida.

A mudança em relação à posição anterior aprovada é explícita e apenas proposta. A aprovação do menu não aprova esta distribuição dos botões.

## Proposta de tamanho e hierarquia

Estas regras são propostas para validar agora, não uma decisão já aprovada:

- Altura mínima comum de 40 px no desktop e 44 px no celular.
- Rótulos completos; não comprimir o texto para fazer caber.
- Ação principal com preenchimento; apoio com contorno. O destaque acompanha a tarefa ativa.
- Pares de ações no rodapé ocupam larguras iguais. Ações locais podem acompanhar o texto ou a largura do grupo conforme o contexto.
- Navegação entre seções usa os cards do menu, com espaço para nome e orientação. Não usar tamanho de botão pequeno para representar um conteúdo inteiro.
- Controle utilitário com ícone tem área de interação equivalente e nome acessível; não foi adicionado controle novo só para ilustrar esse caso.
- Operações de risco preservam confirmação central; cor ou tamanho não substitui explicação da consequência.

As alturas se aplicam somente aos cenários deste estudo no protótipo. A adoção nos demais componentes é trabalho de implementação posterior após validação.

## Prévia

- A: http://127.0.0.1:4338/?area=botoes&view=rodape
- B: http://127.0.0.1:4338/?area=botoes&view=contexto

Entrar em Atendimento e próximo passo, Histórico e Registrar atendimento para comparar os estados. Também abrir Registrar venda e Sem interesse para conferir que os destinos e confirmações continuam presentes.

## Situação

Menu interno da Negociação: aprovado.
Critério de uso de menu nos outros painéis: aprovado.
Distribuição das ações: aprovada na opção A, rodapé. As alturas de referência de 40 px no desktop e 44 px no celular, apresentadas nas duas opções, são mantidas nos mockups. Esta escolha não autoriza implementação.
Sem autorização de implementação, integração ou publicação nesta rodada.


## Conferência do protótipo em 06/11/2026

As duas distribuições foram abertas no navegador. Na opção de rodapé, Registrar venda permaneceu acessível no Histórico. Na opção contextual, as ações gerais estavam no menu e ausentes no Atendimento, onde Registrar atendimento ficou em destaque. Ao editar, Cancelar e Salvar atendimento apareceram no rodapé.

Medidas observadas: botão de venda com 40 px de altura no viewport desktop 1280 x 900; pares de ação com 44 px de altura e 173 px de largura no viewport móvel 390 x 844. Rodapé dentro da tela e documento sem vazamento horizontal no cenário medido. Temas claro e escuro foram usados. A confirmação de Sem interesse abriu e Cancelar a fechou sem executar nenhuma operação real.

A medição e a navegação do protótipo não substituem testes das regras de negócio ou permissões na implementação futura.
