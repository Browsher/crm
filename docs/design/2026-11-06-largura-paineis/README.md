# Largura comum dos painéis

Data: 06/11/2026. Comparação visual local com dados fictícios. Opção A, largura atual, aprovada pelo usuário em 06/11/2026.

## Contexto e escopo

Conteúdos, grupos, menus, tarefas diretas, ações no rodapé, confirmações A e estados compactos já foram aprovados. A base comum ainda mantinha largura de desktop e apresentação móvel como propostas explícitas na spec. Esta rodada compara somente o espaço horizontal dos painéis no computador.

Não mudar campos, agrupamento, rótulos, regras de formulário ou destinos para acomodar uma opção. O usuário deve ver os mesmos conteúdos em A e B.

## Largura escolhida: A

A, largura atual, foi escolhida: clamp(380px, 47vw, 520px), já usada nos mockups. Mantém mais contexto da página visível ao fundo. Limite máximo de 520 px.

B, mais espaço: clamp(380px, 55vw, 640px). Dá mais espaço de leitura e aos campos, reduzindo a largura da página ao fundo. Limite máximo de 640 px. Foi recomendação do autor, mas não foi escolhida; permanece apenas como referência.

Os números são valores de composição do autor, não exigências do usuário. Nos dois casos há uma largura comum para consultas e formulários; não variar a largura conforme o número de campos. Até 820 px, ambas mantêm a proposta de tela inteira. A apresentação móvel continua explícita para a revisão final da base, sem deduzir que a aprovação anterior do conteúdo já aprovou esse comportamento no produto.

A imagem ampliada conserva sua exceção aprovada de visualização maior na mesma lateral; a comparação não muda a ampliação ou acrescenta outro pop-up.

## Exemplos e controles

- Meu dia: mesmo próximo passo direto, menu de Dados e Histórico e Negociação no rodapé.
- Negociação: mesmo formulário de atendimento e mesmas ações. Voltar continua protegido quando há alterações.
- Gestor: mesmo formulário direto de Renomear lista, para avaliar a largura comum também em tarefas curtas.

Desktop usa moldura de 1280 x 900; Notebook usa 1024 x 768; Celular usa 390 x 844. Notebook foi acrescentado como controle de demonstração para comparar o efeito em tela menor. Não é uma configuração do CRM.

Cabeçalho e rodapé continuam fora da rolagem, com apenas o corpo rolável. Os tokens da marca, tipografia Segoe UI, seções e botões não mudam. Não reduzir texto ou controles para fazer caber em A, nem acrescentar resumos para preencher B.

## Limites

Somente HTML/CSS/JavaScript e documentação da galeria. Sem alteração do produto, consultas reais, gravações, integrações, migrações, merge ou publicação. A comparação não ensaia todos os consumidores ou a recuperação persistente; esses requisitos permanecem na implementação posterior isolada.

A: http://127.0.0.1:4338/?area=largura-paineis&view=atual

B: http://127.0.0.1:4338/?area=largura-paineis&view=amplo

## Situação

A é o padrão comum aprovado para consultas e formulários, com adaptação à tela e limite máximo de 520 px. A aprovação vale para largura de desktop; apresentação móvel segue para comparação própria. A exceção de imagem ampliada permanece. Esta rodada continua sem autorização de implementação, merge ou publicação.
