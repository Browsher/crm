# Perfil da empresa no assistente do Banco

O vendedor escolhe o SKU e recebe sugestões de empresas que podem comprar para revenda. Cada opção apresenta a atividade, os filtros cadastrais propostos e o motivo comercial. O vendedor escolhe o que aplicar ao rascunho do Banco.

## Sugestões por público

- **Atividade e região**. Usar a matriz atual de CNAEs por SKU e público. Mostrar a descrição oficial e o aviso de escopo amplo. Aproveitar a região do rascunho e permitir a edição já disponível no painel.
- **Porte e MEI**. Sugerir portes plausíveis para o objetivo, com justificativa. Oferecer **Qualquer**, **Somente MEI** ou **Excluir MEI**. A Casa dos Dados aceita consultar MEI separadamente dos demais portes. Selecionar **Somente MEI** substitui os portes comuns e desativa a exclusão de MEI.
- **Regime tributário**. Oferecer **Qualquer**, **Optante pelo Simples Nacional** e **Fora do Simples Nacional**. A API atual aceita filtrar participação no Simples Nacional. A opção Fora do Simples abrange vários regimes.
- **Capital social**. Os campos de mínimo e máximo começam vazios. Só aplicar valores informados pelo vendedor nesses campos, em reais inteiros. Ao deixar um campo vazio, preservar o respectivo valor já configurado no formulário. Capital social é um dado cadastral e pode servir como recorte de busca.
- **Outros filtros**. Matriz ou filial, idade da empresa e contato disponível podem aparecer quando ajudarem o objetivo e o Banco oferecer o filtro correspondente. Preservar os critérios do rascunho que o vendedor não marcou para substituir. Manter quantidade de resultados fora da sugestão inicial.

## Apresentação

O card reúne **Atividade e região** e **Perfil da empresa**. Cada filtro de perfil exibe seu valor, o motivo da sugestão e um controle para incluir ou retirar antes de aplicar. A IA pode apresentar porte, MEI e regime como opções de segmentação por público. As opções geradas ficam inicialmente desmarcadas para revisão. Os campos de capital são preenchidos diretamente pelo vendedor.

Campos sem proposta ficam de fora do resumo. Uma alteração explícita incompatível com o rascunho, como **Somente MEI** com **Excluir MEI**, informa quais campos serão substituídos antes da aplicação. Ao substituir uma exclusão por inclusão ou **Qualquer**, remover as datas dependentes da exclusão. **Somente MEI** e **Fora do Simples Nacional** exigem escolher um único recorte, pois a opção pelo Simei pressupõe adesão ao Simples Nacional. [Receita Federal](https://www.gov.br/pt-br/servicos/optar-pelo-sistema-de-recolhimento-do-mei)

Exemplo de hipótese comercial para o projetor QS-T-001. Um card pode sugerir lojas de games de porte ME ou EPP para uma campanha de revenda por caixa. O vendedor pode retirar o porte, manter qualquer regime ou informar uma faixa de capital. Um card separado pode sugerir distribuidores de áudio e vídeo com os CNAEs desse público. Os perfis são sugestões de prospecção e devem ser apresentados como tais.

## Aplicação e testes

- **Aplicar filtros** atualiza os campos selecionados no rascunho. A consulta continua no botão **Buscar empresas** do formulário.
- Validar o resultado da IA e a combinação dos campos de perfil alterados com o rascunho. Conferir valores inteiros e ordem do capital, exclusões incompatíveis, combinações de porte e regime, e a preservação de campos já preenchidos. A consulta valida o conjunto completo, inclusive a compatibilidade de regiões.
- Exercitar gerações com Claude simulado. Conferir em desktop e celular o card, a seleção dos filtros e o payload final sem enviar consulta a empresas.
