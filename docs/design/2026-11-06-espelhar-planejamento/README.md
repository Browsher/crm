# Espelhar planejamento: entrada e organização

Data: 06/11/2026. Protótipo local, com datas e planos fictícios. Sem alterações no produto.

## Decisões anteriores

Critérios Google aprovado na opção A: Empresas e produtos, Contatos e presença digital, Preferências e restrições.

Permanecem: conteúdos na lateral, confirmações no centro, menu para várias seções, tarefas curtas abertas diretamente e ações no rodapé. Esta comparação decide como aplicar esse padrão à tarefa Espelhar planejamento.

## Comparação atual

### A · Formulário direto

Opção A escolhida pelo usuário em 06/11/2026. Interpretação do autor: espelhar é uma única tarefa curta de copiar um dia, em vez de um painel de consulta com conteúdos independentes.

Origem, O que copiar e Destino aparecem ao abrir, em blocos visuais separados. O rodapé conserva Cancelar e Espelhar nos dias escolhidos. O cabeçalho tem Fechar.

Benefício: os passos ficam visíveis na mesma sequência, sem entrar e voltar ao menu.
Custo: a rolagem é maior no celular.

### B · Duas seções no menu

Origem e conteúdo agrupa semana/dia de origem e os campos que serão copiados.
Dias de destino agrupa semana de destino e seus dias elegíveis.

Voltar no cabeçalho retorna ao menu e conserva as escolhas. As ações de conclusão continuam no rodapé.

Benefício: menos conteúdo por vez.
Custo: exige visitar duas seções para concluir uma única tarefa.

Nenhuma nova confirmação de espelhamento foi adicionada: a fonte atual conclui pelo formulário. O pop-up demonstrado aqui é somente o descarte de alterações.

## Conteúdo e regras preservadas

Fonte lida nesta rodada: app/fila/google/espelhar.tsx.

- Escolher semana e dia de origem entre os planos salvos disponíveis.
- Copiar Nicho, Critérios de busca e/ou Região: bairro, cidade e UF.
- Nicho inicia selecionado, conforme a fonte atual.
- Destino pode ser Semana exibida ou Próxima semana.
- Alterar a semana de destino limpa seus dias selecionados.
- Datas passadas, o dia atual e o próprio dia de origem não são destinos elegíveis.
- Cancelar, fechar e Escape protegem escolhas ainda não concluídas.
- Preservar na futura implementação a revisão do plano de origem, autorização, limites, bloqueios, sucesso, envio pendente e resultado incerto. A cópia atua no planejamento; não é uma coleta do Google.
- Resultado incerto exige conferir o destino antes de repetir; não criar um comando novo para representar recuperação do anterior.

## Dados demonstrativos e limites

A prévia fixa hoje em 06/11/2026, com a semana exibida iniciando em 02/11 e a seguinte em 09/11. Mostra uma semana de origem com dois planos fictícios. Não pretende representar todo o histórico do produto.

A semana e o dia de origem são controles distintos, mas só existe uma semana demonstrativa. O exemplo permite mudar o dia salvo, os campos, a semana de destino e os dias elegíveis.

As duas composições usam os mesmos controles e escolhas locais. O formulário demonstra seleção mínima e uma conclusão simulada, sem invocar copiarPlanoAcao, guardar rascunhos, consultar planos reais ou copiar qualquer registro.

## Prévia

- A: http://127.0.0.1:4338/?area=espelhar&view=direto
- B: http://127.0.0.1:4338/?area=espelhar&view=menu

## Situação

Entrada e organização aprovadas: A, formulário direto. A alternativa B permanece para referência. Próxima comparação: abertura da ficha do cliente na Carteira.
