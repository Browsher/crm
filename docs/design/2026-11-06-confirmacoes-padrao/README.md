# Organização das confirmações

Data: 06/11/2026. Comparação na galeria local, com dados fictícios. Opção A aprovada pelo usuário para os três exemplos e como padrão comum das confirmações.

## Decisões preservadas

Conteúdos e formulários usam painel lateral; confirmações curtas continuam em pop-up central. Menu interno, tarefas diretas e ações no rodapé já foram escolhidos. Esta rodada compara somente como apresentar o alvo e a consequência na confirmação.

Não modificar regras de Sem interesse, venda, acesso, listas ou proteção de rascunho para acomodar o desenho.

## Composição escolhida: A

A, alvo destacado, foi aprovada em 06/11/2026: título da decisão; bloco discreto com empresa ou formulário; consequência curta; ações no rodapé. Na venda, valor e data efetiva ficam no mesmo bloco da empresa. Recomendação do autor: o alvo fica mais fácil de conferir antes de agir.

B permanece como referência não escolhida. Em texto corrido, os mesmos dados aparecem na sequência de leitura, sem bloco. Consequências e ações são idênticas. É mais enxuto, mas dá menos destaque ao alvo.

As opções usam os mesmos tokens da galeria: fonte Segoe UI, superfícies e bordas dos temas claro/escuro, preenchimento para ação principal e cor de perigo apenas nos casos já marcados como tal. Não criar ícones ou cores adicionais nesta comparação. Os dois botões dividem o espaço disponível e têm a mesma altura; textos longos podem quebrar linha. Dimensões do pop-up seguem a base existente, limitadas à tela.

## Exemplos disponíveis

- Sem interesse: empresa, encerramento da negociação, cancelamento de retornos e preservação de vínculo/histórico.
- Conferir venda: empresa, valor e data efetiva; a venda não pode ser editada nem excluída nesta versão. Os dados de exemplo vêm do formulário fictício abaixo.
- Descartar alterações: identifica Registrar atendimento e a empresa. O exemplo começa com anotação não salva. Continuar editando ou Escape preserva esse texto; Descartar retorna à leitura neste protótipo.

Cancelar mantém o contexto, aba, seleção e rascunho. O foco inicial é neutro, o teclado permanece na confirmação e o cancelamento devolve ao acionador. A confirmação não repete o formulário nem abre outro painel.

## Abrangência posterior e exceções

O padrão escolhido deverá orientar também confirmações administrativas, preservando nome, consequência e permissões próprias. A seleção visual está concluída: aplicar A, adaptando o alvo à empresa, pessoa, lista ou formulário da ação. Não acrescentar dados à consulta para preencher o bloco.

A Carteira conserva Fechar mantendo rascunho onde essa capacidade já existe. Não reduzir esse fluxo aos dois botões dos exemplos. Confirmação nativa ao sair/recarregar o navegador continua nativa. Envios em andamento e resultado incerto serão discutidos na rodada de estados; cancelar uma confirmação antes do envio não significa cancelar uma gravação já enviada.

Os textos legados de listas continuam pendentes de adequação ao contrato vigente na implementação, conforme inventário. Esta comparação não valida nem reintroduz reserva ou descanso.

## Limites

O protótipo usa dialog nativo e HTML/CSS/JavaScript locais. Não faz gravações, chamadas de rede, geração de senha, vendas ou arquivamento real. Aceitar Sem interesse ou venda apenas mostra o aviso de simulação existente; não comprova a transação nem a recuperação real de comandos.

Prévia A: http://127.0.0.1:4338/?area=confirmacao-padrao&view=alvo

Prévia B: http://127.0.0.1:4338/?area=confirmacao-padrao&view=texto

## Situação

Aprovado para implementação posterior. Sem interesse, conferir venda e descartar alterações usam a composição A. A direção comum também vale para as confirmações administrativas, com seus alvos e consequências próprios. A alternativa B fica apenas como referência. Esta aprovação não autoriza implementação, merge nem publicação.
