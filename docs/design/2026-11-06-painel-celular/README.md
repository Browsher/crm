# Apresentação do painel no celular

Data: 06/11/2026. Comparação local com dados fictícios. Opção A, tela inteira, aprovada pelo usuário em 06/11/2026.

## Decisões preservadas

Largura atual A aprovada no computador, com limite de 520 px e adaptação à tela. Conteúdo, grupos, menus internos, tarefas diretas, rodapés, confirmação central A e estados já foram escolhidos. Esta rodada compara somente como a lateral ocupa a altura do celular.

A apresentação móvel foi mantida como proposta explícita na spec. Não deduzir aprovação dessa base por ter mostrado conteúdos anteriores dentro de uma moldura de celular.

## Opção escolhida: A

A, tela inteira: lateral cobre a barra do CRM e usa toda a altura disponível. Somente o cabeçalho da tarefa fica visível. Mais espaço para ler e preencher. Foi escolhida pelo usuário como padrão móvel.

B permanece como referência não escolhida. Barra do CRM visível: lateral continua sobreposta, com toda a largura, iniciando abaixo dos 58 px da barra. Mantém o contexto da página no topo, mas exibe dois cabeçalhos e reduz a área para o corpo. Não é página nova ou painel embutido no fluxo da página.

Os 58 px e o limite de tela estreita em 820 px são os valores existentes usados como composição no mockup. Nos computadores, ambas conservam a largura A. A imagem ampliada continua na mesma lateral e conserva sua regra especial; esta comparação não redesenha a imagem.

Mesmas cores, fonte Segoe UI, títulos e espaçamentos. Não reduzir fonte ou botões em B para compensar a altura. Não acrescentar resumo ou comandos em A para preencher o espaço maior.

## Exemplos e comportamento

- Retorno de Meu dia: Próximo passo direto e entradas para Dados/Histórico, com Negociação no rodapé.
- Formulário da Negociação: resultado, anotação e próximo passo, com Cancelar/Salvar no rodapé.
- Cabeçalho e rodapé do painel ficam fora da rolagem; apenas o corpo rola.
- Voltar continua no nível interno e Fechar no inicial. Não criar Voltar duplicado no rodapé.
- Sair com alterações usa a confirmação central A. Continuar editando conserva rascunho e seleção.
- Não alterar as regras de fechamento, envio em andamento, comando incerto, navegação direta ou recuperação após reload.

A área da galeria inicia no celular para esta comparação. O seletor ainda permite Notebook e Desktop para conferir que a escolha móvel não altera o computador.

Na alternativa B, a barra exibida é apenas o contexto visual fictício já existente. Não foi acrescentado um menu funcional, acesso novo a páginas ou desvio da proteção de edição. A implementação deve preservar as guardas em qualquer navegação disponível no cabeçalho real.

## Limites

Somente galeria e documentação. Sem alterações no CRM ou dados, chamadas de rede, usuários reais, integrações, migrações, merge ou publicação. A prévia não representa teclado virtual, barras do navegador móvel ou todos os dispositivos. Esses ensaios continuam na futura implementação isolada.

A: http://127.0.0.1:4338/?area=painel-celular&view=inteiro

B: http://127.0.0.1:4338/?area=painel-celular&view=contexto

## Situação

Tela inteira A aprovada para o padrão móvel, com um cabeçalho da tarefa e rodapé fixo. No computador, mantém a largura atual A. A escolha não autoriza alteração de produto, merge ou publicação.
